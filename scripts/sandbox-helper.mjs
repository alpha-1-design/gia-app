import { readFileSync } from 'fs';
const BASE = 'http://localhost:3081';

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd) { console.log('Commands: upload <local> <remote>, exec <cmd>, test'); process.exit(1); }

  if (cmd === 'upload') {
    const [local, remote] = args;
    const content = readFileSync(local, 'utf-8');
    const r = await fetch(`${BASE}/fs/write`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({path: remote || local.split('/').pop(), content})
    });
    const d = await r.json();
    console.log('Upload:', JSON.stringify(d));
  }

  if (cmd === 'exec') {
    const command = args.join(' ');
    const r = await fetch(`${BASE}/exec`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({command, timeout: 60000})
    });
    const d = await r.json();
    console.log('stdout:', d.stdout);
    if (d.stderr) console.log('stderr:', d.stderr);
    console.log('exitCode:', d.exitCode);
  }

  if (cmd === 'test-browse') {
    const payload = JSON.stringify({action: 'navigate', url: 'https://example.com', options: {wait: 2}});
    const r = await fetch(`${BASE}/exec`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        command: `SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt python3 /workspace/browse_web.py`,
        timeout: 60000,
        stdin: payload
      })
    });
    const d = await r.json();
    console.log(JSON.stringify(d, null, 2));
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
