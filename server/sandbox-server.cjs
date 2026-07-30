#!/usr/bin/env node
/**
 * Sandbox Server — Alpine Linux PRoot execution environment for GIA.
 *
 * Provides a REST API for GIA to execute commands, install packages, clone
 * repos, and manage files in a persistent Alpine PRoot sandbox.
 *
 * Two backends:
 *   - PRoot  (default) — userspace chroot, no root needed. Requires proot binary.
 *   - Docker (--docker) — Docker-based container (fallback).
 *
 * Usage:
 *   node sandbox-server.js [--port 3081] [--workspace ./sandbox-workspace] [--proot | --docker]
 *   node sandbox-server.js --proot --rootfs ./alpine-rootfs --workspace ./sandbox-workspace
 *
 * Required:
 *   - Alpine rootfs at --rootfs (or run scripts/setup-alpine-sandbox.sh first)
 *   - 'proot' command in PATH, or a static binary at --proot-bin
 */

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || process.env.SANDBOX_PORT || '3081');
function getRootfsPath() {
  const arg = process.argv.find(a => a.startsWith('--rootfs='))?.split('=')[1];
  if (arg) return path.resolve(arg);
  if (process.env.SANDBOX_ROOTFS) return path.resolve(process.env.SANDBOX_ROOTFS);
  if (fs.existsSync('/app/alpine-rootfs')) return '/app/alpine-rootfs';
  return path.join(__dirname, 'alpine-rootfs');
}

function getWorkspacePath() {
  const arg = process.argv.find(a => a.startsWith('--workspace='))?.split('=')[1];
  if (arg) return path.resolve(arg);
  if (process.env.SANDBOX_WORKSPACE) return path.resolve(process.env.SANDBOX_WORKSPACE);
  if (fs.existsSync('/app/sandbox-workspace')) return '/app/sandbox-workspace';
  return path.join(__dirname, 'sandbox-workspace');
}

const ROOTFS = getRootfsPath();
const WORKSPACE = getWorkspacePath();
const PROOT_BIN = process.argv.find(a => a.startsWith('--proot-bin='))?.split('=')[1] ||
  process.env.SANDBOX_PROOT_BIN ||
  path.join(__dirname, 'proot');

const USE_DOCKER = process.argv.includes('--docker') || process.env.SANDBOX_USE_DOCKER === '1';
const CONTAINER_NAME = 'gia-alpine-sandbox';
const ALPINE_IMAGE = 'alpine:latest';

let backendReady = false;

function log(...args) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] [sandbox]`, ...args);
}

function execCmd(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', cmd], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: opts.timeout || 30000,
      maxBuffer: 10 * 1024 * 1024,
      ...opts,
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());
    child.on('close', code => resolve({ stdout, stderr, exitCode: code }));
    child.on('error', err => reject(err));
  });
}

// --- Docker Backend ---

async function ensureDockerImage() {
  log('Checking for Alpine Docker image...');
  const { exitCode } = await execCmd(`docker images -q ${ALPINE_IMAGE} 2>/dev/null | head -c1`);
  if (exitCode !== 0 || !exitCode) {
    log('Pulling Alpine image...');
    const result = await execCmd(`docker pull ${ALPINE_IMAGE}`, { timeout: 120000 });
    if (result.exitCode !== 0) throw new Error(`Failed to pull Alpine: ${result.stderr}`);
  }
}

async function ensureDockerContainer() {
  await ensureDockerImage();

  const { stdout } = await execCmd(`docker ps -a --filter name=^/${CONTAINER_NAME}$ --format '{{.Status}}'`);
  const status = stdout.trim();
  if (status.startsWith('Up')) { log('Docker container running'); return; }
  if (status) await execCmd(`docker rm -f ${CONTAINER_NAME}`, { timeout: 10000 });

  log('Starting Docker container...');
  const result = await execCmd(
    `docker run -d --name ${CONTAINER_NAME} -v "${WORKSPACE}:/workspace" -w /workspace --init --rm ${ALPINE_IMAGE} sleep infinity`,
    { timeout: 30000 }
  );
  if (result.exitCode !== 0) throw new Error(`Docker start failed: ${result.stderr}`);

  log('Installing packages...');
  await execCmd(
    `docker exec ${CONTAINER_NAME} sh -c "apk update && apk add --no-cache bash git openssh curl python3 nodejs npm build-base"`,
    { timeout: 120000 }
  );
}

async function dockerExec(command, opts = {}) {
  const timeout = opts.timeout || 60000;
  const wd = opts.workdir || '/workspace';
  const cmd = `docker exec -w "${wd}" ${CONTAINER_NAME} sh -c ${JSON.stringify(command)}`;
  const result = await execCmd(cmd, { timeout });
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim(), exitCode: result.exitCode };
}

// --- PRoot Backend ---

let useHostFallback = false;

async function ensureProotRootfs() {
  if (!fs.existsSync(ROOTFS) || !fs.existsSync(path.join(ROOTFS, 'bin', 'sh'))) {
    log(`Alpine rootfs not found at ${ROOTFS}. Attempting auto-setup...`);
    const setupScript = path.join(__dirname, '..', 'scripts', 'setup-alpine-sandbox.sh');
    if (fs.existsSync(setupScript)) {
      try {
        const setupResult = await execCmd(`bash "${setupScript}" --dir "${ROOTFS}"`, { timeout: 120000 });
        if (setupResult.exitCode !== 0) {
          log(`Setup script failed: ${setupResult.stderr}`);
        } else {
          log(`Auto-setup completed successfully.`);
        }
      } catch (err) {
        log(`Auto-setup error: ${err.message}`);
      }
    }
  }

  if (!fs.existsSync(ROOTFS) || !fs.existsSync(path.join(ROOTFS, 'bin', 'sh'))) {
    log(`WARNING: Alpine rootfs still unavailable at ${ROOTFS}. Falling back to host execution in workspace.`);
    useHostFallback = true;
    if (!fs.existsSync(WORKSPACE)) {
      fs.mkdirSync(WORKSPACE, { recursive: true });
    }
    return;
  }

  log(`Rootfs found at ${ROOTFS}`);

  if (!fs.existsSync(WORKSPACE)) {
    fs.mkdirSync(WORKSPACE, { recursive: true });
  }

  // Ensure resolv.conf exists in rootfs for network
  const resolvPath = path.join(ROOTFS, 'etc', 'resolv.conf');
  if (!fs.existsSync(resolvPath)) {
    try {
      fs.writeFileSync(resolvPath, 'nameserver 8.8.8.8\nnameserver 1.1.1.1\n');
    } catch {}
  }

  // Mount workspace inside rootfs
  const wsMount = path.join(ROOTFS, 'workspace');
  if (!fs.existsSync(wsMount)) {
    try { fs.mkdirSync(wsMount, { recursive: true }); } catch {}
  }
}

function getProotPrefix(workdir) {
  let proot = 'proot';
  let canUseProot = false;

  try {
    require('child_process').execSync('proot --version', { stdio: 'ignore' });
    canUseProot = true;
  } catch {
    if (fs.existsSync(PROOT_BIN)) {
      try {
        require('child_process').execSync(`"${PROOT_BIN}" --version`, { stdio: 'ignore' });
        proot = PROOT_BIN;
        canUseProot = true;
      } catch {
        canUseProot = false;
      }
    }
  }

  if (!canUseProot && process.getuid && process.getuid() === 0) {
    const wsMount = path.join(ROOTFS, 'workspace');
    try {
      require('child_process').execSync(`mountpoint -q "${wsMount}" || mount --bind "${WORKSPACE}" "${wsMount}"`, { stdio: 'ignore' });
    } catch {}
    return `chroot "${ROOTFS}"`;
  }

  const wd = workdir || '/workspace';
  return `SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt PATH=/bin:/usr/bin:/sbin:/usr/sbin:/usr/local/bin "${proot}" -r "${ROOTFS}" -b "${WORKSPACE}:/workspace" -w "${wd}"`;
}

async function prootExec(command, opts = {}) {
  const timeout = opts.timeout || 60000;
  if (useHostFallback) {
    const cwd = opts.workdir ? path.join(WORKSPACE, opts.workdir.replace(/^\/workspace/, '')) : WORKSPACE;
    const targetCwd = fs.existsSync(cwd) ? cwd : WORKSPACE;
    const result = await execCmd(command, { timeout, cwd: targetCwd });
    return { stdout: result.stdout.trim(), stderr: result.stderr.trim(), exitCode: result.exitCode };
  }
  const prefix = getProotPrefix(opts.workdir);
  const wd = opts.workdir || '/workspace';
  let cmd;
  if (prefix.startsWith('chroot')) {
    const guestCmd = `cd "${wd}" && export PATH=/bin:/usr/bin:/sbin:/usr/sbin && ` + command;
    cmd = `${prefix} /bin/sh -c ${JSON.stringify(guestCmd)}`;
  } else {
    const guestCmd = "export PATH=/bin:/usr/bin:/sbin:/usr/sbin && " + command;
    cmd = `${prefix} /bin/sh -c ${JSON.stringify(guestCmd)}`;
  }
  const result = await execCmd(cmd, { timeout });
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim(), exitCode: result.exitCode };
}

// --- Generic exec ---

async function execInSandbox(command, opts = {}) {
  if (USE_DOCKER) return dockerExec(command, opts);
  return prootExec(command, opts);
}

async function ensureBackend() {
  if (USE_DOCKER) {
    await ensureDockerContainer();
  } else {
    await ensureProotRootfs();
  }
  backendReady = true;
}

// --- HTTP Server ---

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function sendSSE(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.flushHeaders();
  let closed = false;
  req.on('close', () => { closed = true; });
  return {
    send(event, data) { if (closed) return false; res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); return true; },
    close() { if (!closed) res.end(); closed = true; },
  };
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

async function handleExec(req, res) {
  const { command, timeout, workdir } = await parseBody(req);
  if (!command) return sendJSON(res, 400, { error: 'command is required' });
  try {
    const result = await execInSandbox(command, { timeout, workdir });
    sendJSON(res, 200, result);
  } catch (e) { sendJSON(res, 500, { error: e.message }); }
}

async function handleExecStream(req, res) {
  const { command, workdir } = await parseBody(req);
  if (!command) return sendJSON(res, 400, { error: 'command is required' });
  const sse = sendSSE(req, res);

  const prefix = getProotPrefix(workdir);
  const shellCmd = `${prefix} sh -c ${JSON.stringify(command)}`;

  const child = spawn('sh', ['-c', shellCmd], { timeout: 300000 });
  child.stdout.on('data', d => sse.send('stdout', d.toString()));
  child.stderr.on('data', d => sse.send('stderr', d.toString()));
  child.on('close', code => { sse.send('exit', { code }); sse.close(); });
  child.on('error', err => { sse.send('error', err.message); sse.close(); });
}

async function handleInstall(req, res) {
  const { packages } = await parseBody(req);
  if (!packages || !packages.length) return sendJSON(res, 400, { error: 'packages array is required' });
  try {
    const pkgList = Array.isArray(packages) ? packages.join(' ') : packages;
    const result = await execInSandbox(`apk add --no-cache ${pkgList}`, { timeout: 120000 });
    sendJSON(res, 200, result);
  } catch (e) { sendJSON(res, 500, { error: e.message }); }
}

async function handleClone(req, res) {
  const { repo, dest } = await parseBody(req);
  if (!repo) return sendJSON(res, 400, { error: 'repo URL is required' });
  try {
    const destPath = dest || repo.split('/').pop().replace('.git', '');
    const result = await execInSandbox(`GIT_ASKPASS= GIT_TERMINAL_PROMPT=0 git clone --depth 1 ${repo} ${destPath}`, { timeout: 120000 });
    sendJSON(res, 200, result);
  } catch (e) { sendJSON(res, 500, { error: e.message }); }
}

async function handleFSRead(req, res) {
  const p = new url.URL(req.url, 'http://localhost').searchParams.get('path');
  if (!p) return sendJSON(res, 400, { error: 'path is required' });
  try {
    const safePath = p.replace(/\.\./g, '');
    const result = await execInSandbox(`cat ${JSON.stringify("/workspace/" + safePath)}`);
    if (result.exitCode !== 0) return sendJSON(res, 404, { error: result.stderr || 'File not found' });
    sendJSON(res, 200, { content: result.stdout });
  } catch (e) { sendJSON(res, 500, { error: e.message }); }
}

async function handleFSWrite(req, res) {
  const { path: p, content } = await parseBody(req);
  if (!p || content === undefined) return sendJSON(res, 400, { error: 'path and content are required' });
  try {
    const safePath = p.replace(/\.\./g, '');
    const fullPath = '/workspace/' + safePath;
    await execInSandbox(`mkdir -p /workspace`, { timeout: 5000 });
    // Write content via base64 to avoid shell escaping issues
    const encoded = Buffer.from(content).toString('base64');
    const result = await execInSandbox(`echo "${encoded}" | base64 -d > "${fullPath}"`, { timeout: 10000 });
    if (result.exitCode !== 0) return sendJSON(res, 500, { error: result.stderr });
    sendJSON(res, 200, { ok: true });
  } catch (e) { sendJSON(res, 500, { error: e.message }); }
}

async function handleFSDelete(req, res) {
  const { path: p } = await parseBody(req);
  if (!p) return sendJSON(res, 400, { error: 'path is required' });
  try {
    const safePath = p.replace(/\.\./g, '');
    const result = await execInSandbox(`rm -rf "/workspace/${safePath}"`);
    if (result.exitCode !== 0) return sendJSON(res, 500, { error: result.stderr });
    sendJSON(res, 200, { ok: true });
  } catch (e) { sendJSON(res, 500, { error: e.message }); }
}

async function handleFSList(req, res) {
  const p = new url.URL(req.url, 'http://localhost').searchParams.get('path') || '';
  try {
    const safePath = p.replace(/\.\./g, '');
    const lsPath = safePath ? `"/workspace/${safePath}"` : '"/workspace"';
    const result = await execInSandbox(`ls -la ${lsPath}`);
    if (result.exitCode !== 0) return sendJSON(res, 404, { error: result.stderr || 'Path not found' });
    const lines = result.stdout.split('\n').filter(l => l).slice(1);
    const entries = lines.map(l => {
      const parts = l.split(/\s+/);
      return { name: parts.slice(8).join(' '), isDir: parts[0]?.startsWith('d'), size: parseInt(parts[4] || '0'), mode: parts[0] };
    });
    sendJSON(res, 200, { entries, path: p || '/' });
  } catch (e) { sendJSON(res, 500, { error: e.message }); }
}

async function handleRestart(req, res) {
  try {
    backendReady = false;
    if (USE_DOCKER) {
      await execCmd(`docker rm -f ${CONTAINER_NAME}`, { timeout: 10000 });
    }
    await ensureBackend();
    sendJSON(res, 200, { ok: true });
  } catch (e) { sendJSON(res, 500, { error: e.message }); }
}

const MIME_TYPES = {
  // Text & code
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.csv': 'text/csv', '.md': 'text/markdown',
  '.txt': 'text/plain', '.yaml': 'text/yaml', '.yml': 'text/yaml',
  '.xml': 'application/xml', '.ts': 'text/typescript', '.tsx': 'text/typescript',
  '.py': 'text/x-python', '.sh': 'text/x-shellscript',
  // Images
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webp': 'image/webp', '.bmp': 'image/bmp', '.tiff': 'image/tiff',
  '.tif': 'image/tiff', '.avif': 'image/avif', '.heic': 'image/heic',
  '.heif': 'image/heif',
  // Audio
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.flac': 'audio/flac', '.aac': 'audio/aac', '.m4a': 'audio/mp4',
  '.wma': 'audio/x-ms-wma', '.opus': 'audio/opus',
  // Video
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska', '.mov': 'video/quicktime',
  '.wmv': 'video/x-ms-wmv', '.flv': 'video/x-flv',
  '.m4v': 'video/mp4', '.3gp': 'video/3gpp',
  // Documents
  '.pdf': 'application/pdf', '.zip': 'application/zip',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  '.epub': 'application/epub+zip',
  '.rtf': 'application/rtf',
  // Archives
  '.tar': 'application/x-tar', '.gz': 'application/gzip',
  '.bz2': 'application/x-bzip2', '.7z': 'application/x-7z-compressed',
  '.rar': 'application/vnd.rar',
  // Fonts
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

async function handleFSDownload(req, res) {
  const p = new url.URL(req.url, 'http://localhost').searchParams.get('path');
  if (!p) return sendJSON(res, 400, { error: 'path query parameter is required' });
  try {
    const safePath = p.replace(/\.\./g, '');
    const fullPath = path.join(WORKSPACE, safePath);
    const resolvedPath = path.resolve(fullPath);
    if (!resolvedPath.startsWith(path.resolve(WORKSPACE)))
      return sendJSON(res, 403, { error: 'Access denied' });
    if (!fs.existsSync(resolvedPath))
      return sendJSON(res, 404, { error: 'File not found' });
    const stats = fs.statSync(resolvedPath);
    if (stats.isDirectory())
      return sendJSON(res, 400, { error: 'Cannot download a directory' });
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Content-Disposition': `inline; filename="${path.basename(resolvedPath)}"`,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    const stream = fs.createReadStream(resolvedPath);
    stream.pipe(res);
    stream.on('error', () => { if (!res.headersSent) sendJSON(res, 500, { error: 'Failed to read file' }); else res.end(); });
  } catch (e) { if (!res.headersSent) sendJSON(res, 500, { error: e.message }); else res.end(); }
}

async function ensureRunning(req, res, next) {
  if (!backendReady) {
    try { await ensureBackend(); }
    catch (e) { return sendJSON(res, 503, { error: `Sandbox unavailable: ${e.message}` }); }
  }
  next();
}

async function main() {
  log(`Backend: ${USE_DOCKER ? 'Docker' : 'PRoot'}`);
  log(`Workspace: ${WORKSPACE}`);
  if (!USE_DOCKER) log(`Rootfs: ${ROOTFS}`);
  log(`Port: ${PORT}`);

  try {
    await ensureBackend();
    log('Sandbox ready');
  } catch (e) {
    log('WARNING: Failed to initialize sandbox:', e.message);
    log('Server will start but /health will show sandbox as unavailable.');
  }

  const server = http.createServer((req, res) => {
    const parsed = url.parse(req.url);
    const method = req.method;

    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      return res.end();
    }

    if (parsed.pathname === '/health' && method === 'GET') {
      return sendJSON(res, 200, {
        ok: backendReady,
        backend: USE_DOCKER ? 'docker' : 'proot',
        workspace: WORKSPACE,
        rootfs: USE_DOCKER ? null : ROOTFS,
        backendReady,
      });
    }

    const routes = {
      'POST /exec': handleExec,
      'POST /exec/stream': handleExecStream,
      'POST /install': handleInstall,
      'POST /clone': handleClone,
      'GET /fs/read': handleFSRead,
      'POST /fs/write': handleFSWrite,
      'POST /fs/delete': handleFSDelete,
      'GET /fs/list': handleFSList,
      'GET /fs/download': handleFSDownload,
      'POST /container/restart': handleRestart,
    };

    const routeKey = `${method} ${parsed.pathname}`;
    const handler = routes[routeKey];
    if (!handler) return sendJSON(res, 404, { error: `Not found: ${routeKey}` });

    ensureRunning(req, res, () => handler(req, res));
  });

  server.listen(PORT, () => {
    log(`Sandbox server listening on http://localhost:${PORT}`);
  });
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
