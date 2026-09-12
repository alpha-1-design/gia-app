/**
 * CapabilityService — discovers what is actually available on this device
 * BEFORE GIA proposes an installation.
 *
 * Device-first rule: never ask the user to install something that is already
 * here, and never install blindly. `scan()` builds a real inventory of the
 * shell (binaries + versions), the package manager, the hardware
 * (RAM / CPU / storage / GPU / WebGPU) and the in-app engines (local LLM,
 * STT, connectors, MCP tools). `getContext()` returns a compact cached
 * snapshot that buildGiaSystem injects into the model prompt so GIA reasons
 * with what exists up front and gives the user a real choice when it doesn't.
 *
 * On GIA mobile (Capacitor) the probe runs against the on-device proot+Alpine
 * terminal. On a plain browser there is no shell, so only web/hardware/in-app
 * facts are reported. Mirrors gia-cowork's CapabilityService.
 */

import terminalService from './TerminalService';
import { isNativePlatform } from '../utils/helpers';
import { detectDeviceCapabilities } from './DeviceCapabilities';
import connectorManager from './connectors/ConnectorManager';
import MCPManager from './MCPManager';
import whisperService from './WhisperService';
import LocalLLMService from './LocalLLMService';
import { crossDeviceMesh, type CapabilityMeshPayload } from './CrossDeviceMesh';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CapabilityEntry {
  name: string;
  path: string;
  version: string;
}

export interface CapabilityScan {
  platform: 'desktop' | 'mobile' | 'web';
  shell: { available: boolean; kind: 'host' | 'sandbox' | 'none' };
  os: string;
  distroId: string;
  packageManagers: string[];
  binaries: CapabilityEntry[];
  present: string[];
  missing: string[];
  hardware: {
    cpuCores: number | null;
    ramTotalGB: number | null;
    ramAvailableGB: number | null;
    storageFreeGB: number | null;
    gpu: boolean;
    webgpu: boolean;
  };
  inApp: {
    connectors: string[];
    mcpTools: number;
    localLLMModels: number;
    localLLMReady: string[];
    whisper: 'ready' | 'idle' | 'loading' | 'error';
  };
  scannedAt: number;
}

// ---------------------------------------------------------------------------
// Probing
// ---------------------------------------------------------------------------

/** Tool names checked for on the shell. */
export const PROBED_BINARIES: string[] = [
  'node', 'npm', 'npx', 'bun', 'deno',
  'python3', 'python', 'pip3', 'pip', 'uv',
  'go', 'cargo', 'rustc',
  'java', 'javac', 'gcc', 'g++', 'clang', 'make', 'cmake', 'ninja',
  'git', 'svn',
  'curl', 'wget', 'ssh', 'openssl', 'jq', 'dig',
  'ffmpeg', 'ffprobe',
  'sqlite3', 'psql', 'mysql', 'mongosh', 'redis-cli',
  'docker', 'docker-compose', 'podman', 'kubectl', 'gh',
  'tesseract', 'pandoc', 'pdflatex',
  'unzip', 'zip', 'tar', 'xz', 'gzip', '7z',
  'rg', 'fzf', 'tmux',
];

const PROBED_PACKAGE_MANAGERS: string[] = [
  'apt-get', 'apt', 'dnf', 'yum', 'pacman', 'apk', 'brew', 'winget', 'choco', 'snap', 'flatpak', 'nix-env', 'pnpm', 'yarn',
];

const PROBE_SCRIPT = `
for b in ${PROBED_BINARIES.join(' ')}; do
  p=$(command -v "$b" 2>/dev/null) || continue
  v=""
  case "$b" in
    node) v=$(node --version 2>/dev/null) ;;
    npm) v=$(npm --version 2>/dev/null) ;;
    bun) v=$(bun --version 2>/dev/null) ;;
    python3) v=$(python3 -V 2>&1) ;;
    python) v=$(python -V 2>&1) ;;
    git) v=$(git --version 2>/dev/null) ;;
    go) v=$(go version 2>/dev/null) ;;
    cargo) v=$(cargo --version 2>/dev/null) ;;
    rustc) v=$(rustc --version 2>/dev/null) ;;
    ffmpeg) v=$(ffmpeg -version 2>/dev/null | head -n1) ;;
    docker) v=$(docker --version 2>/dev/null) ;;
    docker-compose) v=$(docker-compose --version 2>/dev/null) ;;
    curl) v=$(curl --version 2>/dev/null | head -n1) ;;
    gh) v=$(gh --version 2>/dev/null | head -n1) ;;
    java) v=$(java -version 2>&1 | head -n1) ;;
    sqlite3) v=$(sqlite3 --version 2>/dev/null | head -n1) ;;
    tesseract) v=$(tesseract --version 2>/dev/null | head -n1) ;;
  esac
  if [ -n "$v" ]; then echo "BIN|$b|$p|$v"; else echo "BIN|$b|$p|"; fi
done
for pm in ${PROBED_PACKAGE_MANAGERS.join(' ')}; do
  command -v "$pm" >/dev/null 2>&1 && echo "PM|$pm"
done
if [ -r /etc/os-release ]; then grep -E '^(ID=|ID_LIKE=|PRETTY_NAME=)' /etc/os-release; fi
echo "UNAME|$(uname -srm 2>/dev/null)"
echo "PROBE_DONE"
`;

/**
 * Parse the batched probe output into structured results.
 * Exported for tests.
 */
export function parseProbeOutput(output: string): {
  binaries: CapabilityEntry[];
  packageManagers: string[];
  os: string;
  distroId: string;
} {
  const binaries: CapabilityEntry[] = [];
  const packageManagers: string[] = [];
  let idLike = '';
  let prettyName = '';
  let uname = '';

  for (const raw of output.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('BIN|')) {
      const [, name, path, version = ''] = line.split('|');
      if (name && path) binaries.push({ name, path, version });
    } else if (line.startsWith('PM|')) {
      const name = line.slice(3).trim();
      if (name) packageManagers.push(name);
    } else if (line.startsWith('UNAME|')) {
      uname = line.slice(6).trim();
    } else if (line.startsWith('ID=')) {
      idLike = line.slice(3).trim();
    } else if (line.startsWith('ID_LIKE=')) {
      idLike = idLike || line.slice(8).trim();
    } else if (line.startsWith('PRETTY_NAME=')) {
      prettyName = line.slice(12).trim().replace(/^"|"$/g, '');
    }
  }

  const osLabel = [prettyName, uname].filter(Boolean).join(' · ');
  return { binaries, packageManagers, os: osLabel, distroId: idLike };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 45_000;

class CapabilityService {
  private _scan: CapabilityScan | null = null;
  private _ctx = '';
  private _scanPromise: Promise<CapabilityScan> | null = null;

  private detectWebGPU(): boolean {
    try {
      const nav = navigator as unknown as { gpu?: unknown };
      return !!nav.gpu;
    } catch {
      return false;
    }
  }

  private detectPlatform(): 'desktop' | 'mobile' | 'web' {
    if (isNativePlatform()) return 'mobile';
    return 'web';
  }

  /** A compact, reusable one-line "what exists" string for the model prompt. */
  getContext(): string {
    return this._ctx;
  }

  /** True if a scan has already completed this session. */
  get hasScanned(): boolean {
    return this._scan !== null;
  }

  /** Drop the cached scan so the next read does a real rescan. */
  invalidate(): void {
    this._scan = null;
    this._ctx = '';
  }

  /** Simple djb2-ish hash so peers can tell when an inventory changed. */
  private fingerprint(scan: CapabilityScan): string {
    const src = JSON.stringify([
      scan.os, scan.distroId, scan.packageManagers,
      scan.present, scan.binaries.map(b => `${b.name}@${b.version}`),
      scan.hardware.gpu, scan.hardware.webgpu, scan.inApp,
    ]);
    let h = 5381;
    for (let i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  /** Build the compact mesh payload from a completed scan. */
  buildMeshProfile(scan: CapabilityScan): CapabilityMeshPayload {
    return {
      platform: scan.platform,
      os: scan.os,
      distroId: scan.distroId,
      packageManagers: scan.packageManagers,
      binaryCount: scan.binaries.length,
      tools: scan.present,
      missing: scan.missing,
      gpu: scan.hardware.gpu,
      webgpu: scan.hardware.webgpu,
      ramFreeGB: scan.hardware.ramAvailableGB,
      engines: {
        localLLMModels: scan.inApp.localLLMModels,
        localLLMReady: scan.inApp.localLLMReady,
        kokoro: 'idle',
        speech5: 'idle',
        whisper: scan.inApp.whisper,
      },
      hash: this.fingerprint(scan),
      scannedAt: scan.scannedAt,
    };
  }

  /** Announce the current scan to paired devices (no-op when mesh is off). */
  broadcastProfile(): void {
    if (this._scan) crossDeviceMesh.broadcastCapabilityProfile(this.buildMeshProfile(this._scan));
  }

  /** Rescan then announce, for callers that just installed something. */
  async rescanAndBroadcast(): Promise<void> {
    await this.scan(true);
    this.broadcastProfile();
  }

  get lastScan(): CapabilityScan | null {
    return this._scan;
  }

  private isCacheFresh(force = false): boolean {
    if (force) return false;
    if (!this._scan) return false;
    return Date.now() - this._scan.scannedAt < CACHE_TTL_MS;
  }

  /**
   * Scan the device for available capabilities. Cached for 45s; pass
   * `force: true` to rescan (used by the capabilities_scan tool).
   */
  async scan(force = false): Promise<CapabilityScan> {
    if (this.isCacheFresh(force) && this._scan) return this._scan;
    if (!force && this._scanPromise) return this._scanPromise;

    this._scanPromise = this.doScan().finally(() => {
      this._scanPromise = null;
    });
    return this._scanPromise;
  }

  private async doScan(): Promise<CapabilityScan> {
    const platform = this.detectPlatform();
    const shellAvailable = terminalService.isAvailable();
    const shellKind = !shellAvailable ? 'none' : (platform === 'mobile' ? 'sandbox' : 'sandbox');

    const caps = await detectDeviceCapabilities().catch(() => null).then((c) => {
      const fallback = {
        cpuCores: null,
        availableRAMGB: null,
        availableStorageGB: null,
        totalRAMGB: null,
        hasGPU: false,
        measured: false,
        isMobile: false,
        ramMeasured: false,
        notes: [] as string[],
      };
      return c ?? fallback;
    });

    let binariesRaw: CapabilityEntry[] = [];
    let packageManagers: string[] = [];
    let os = '';
    let distroId = '';

    // Probe the shell only when it exists; skip on plain web.
    if (shellAvailable) {
      try {
        const result = await terminalService.exec(PROBE_SCRIPT, undefined, undefined, 20_000);
        const parsed = parseProbeOutput(result.output ?? '');
        binariesRaw = parsed.binaries;
        packageManagers = parsed.packageManagers;
        os = parsed.os;
        distroId = parsed.distroId;
      } catch (e) {
        console.warn('[CapabilityService] shell probe failed:', e);
      }
    }

    const binaries = binariesRaw.slice().sort((a, b) => a.name.localeCompare(b.name));
    const present = binaries.map(b => b.name);
    const missing = shellKind === 'none'
      ? []
      : PROBED_BINARIES.filter(b => !present.includes(b));

    const whisperStatus = whisperService.status === 'unloaded'
      ? 'idle' as const
      : whisperService.status;

    const llmStatus = LocalLLMService.getStatus();
    const localLLMReady = Object.entries(llmStatus)
      .filter(([, s]) => s?.status === 'ready')
      .map(([id]) => id);

    const connectors = connectorManager.getAll()
      .filter(c => c.status === 'connected')
      .map(c => c.name);

    let mcpTools = 0;
    try {
      mcpTools = MCPManager.getConnectedTools().length;
    } catch {
      mcpTools = 0;
    }

    const scan: CapabilityScan = {
      platform,
      shell: { available: shellAvailable, kind: shellKind },
      os: os || (platform === 'mobile' ? 'Android' : 'Browser'),
      distroId,
      packageManagers,
      binaries,
      present,
      missing,
      hardware: {
        cpuCores: caps.cpuCores,
        ramTotalGB: caps.totalRAMGB,
        ramAvailableGB: caps.availableRAMGB,
        storageFreeGB: caps.availableStorageGB,
        gpu: caps.hasGPU,
        webgpu: this.detectWebGPU(),
      },
      inApp: {
        connectors,
        mcpTools,
        localLLMModels: Object.keys(llmStatus).length,
        localLLMReady,
        whisper: whisperStatus,
      },
      scannedAt: Date.now(),
    };

    this._scan = scan;
    this._ctx = this.formatScan(scan, false);
    try {
      this.broadcastProfile();
    } catch (e) {
      console.warn('[CapabilityService] mesh broadcast failed:', e);
    }
    return scan;
  }

  /** Human/M model-readable inventory. `full` widens versions + missing list. */
  formatScan(scan: CapabilityScan, full = false): string {
    const lines: string[] = [
      `- Platform: ${scan.platform === 'mobile' ? 'Android/iOS (GIA app)' : 'Web browser'}`,
      `- Shell: ${scan.shell.kind === 'none' ? 'not available' : `${scan.shell.kind} (${scan.shell.available ? 'available' : 'unavailable'})`}`,
    ];
    if (scan.os) lines.push(`- OS: ${scan.os}`);
    if (scan.distroId) lines.push(`- Distro: ${scan.distroId}`);
    if (scan.packageManagers.length > 0) {
      lines.push(`- Package manager(s): ${scan.packageManagers.join(', ')}`);
    }

    const ram = scan.hardware.ramAvailableGB != null
      ? `~${scan.hardware.ramAvailableGB.toFixed(1)} GB free of ${scan.hardware.ramTotalGB?.toFixed(1) ?? '?'} GB`
      : 'unknown';
    lines.push([
      scan.hardware.cpuCores != null ? `${scan.hardware.cpuCores} cores` : 'CPU cores unknown',
      `RAM ${ram}`,
      scan.hardware.storageFreeGB != null ? `storage ~${scan.hardware.storageFreeGB.toFixed(1)} GB free` : 'storage unknown',
      `GPU ${scan.hardware.gpu ? 'yes' : 'no'} · WebGPU ${scan.hardware.webgpu ? 'yes' : 'no'}`,
    ].join(' · '));

    if (scan.shell.kind !== 'none') {
      const versioned = scan.binaries.map(b => (b.version ? `${b.name} ${b.version}` : b.name));
      const maxBin = full ? versioned.length : Math.min(versioned.length, 14);
      const binList = versioned.slice(0, maxBin).join(', ');
      const overflow = versioned.length > maxBin ? ` +${versioned.length - maxBin} more` : '';
      lines.push(`- Installed on this device (${scan.binaries.length}): ${binList}${overflow}`);

      if (scan.missing.length > 0) {
        const maxMissing = full ? scan.missing.length : Math.min(scan.missing.length, 10);
        const missingList = scan.missing.slice(0, maxMissing).join(', ');
        const overflowMissing = scan.missing.length > maxMissing ? ` +${scan.missing.length - maxMissing} more` : '';
        lines.push(`- NOT installed (${scan.missing.length}): ${missingList}${overflowMissing}`);
      }
    }

    const engines: string[] = [];
    engines.push(`Local LLM: ${scan.inApp.localLLMModels} model${scan.inApp.localLLMModels === 1 ? '' : 's'} available${scan.inApp.localLLMReady.length ? ` (${scan.inApp.localLLMReady.join(', ')} ready)` : ''}`);
    engines.push(`Whisper STT: ${scan.inApp.whisper === 'ready' ? 'ready' : scan.inApp.whisper === 'idle' ? 'available (downloadable)' : scan.inApp.whisper}`);
    if (scan.inApp.connectors.length > 0) engines.push(`API connectors: ${scan.inApp.connectors.join(', ')}`);
    if (scan.inApp.mcpTools > 0) engines.push(`MCP servers active: ${scan.inApp.mcpTools} tools`);
    lines.push(`- In-app: ${engines.join(' · ')}`);

    return lines.join('\n');
  }

  /** Force a background scan on boot so context is ready before first prompt. */
  async warm(): Promise<void> {
    try {
      await this.scan(false);
    } catch (e) {
      console.warn('[CapabilityService] warm scan failed:', e);
    }
  }
}

export default new CapabilityService();