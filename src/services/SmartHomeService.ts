import { logger } from '../utils/logger';

interface SmartDevice {
  id: string;
  name: string;
  type: 'tv' | 'light' | 'thermostat' | 'speaker' | 'switch' | 'sensor' | 'unknown';
  protocol: 'ssdp' | 'mdns' | 'http' | 'mqtt' | 'websocket';
  brand?: string;
  model?: string;
  ip: string;
  port: number;
  location: string;
  capabilities: string[];
  metadata: Record<string, string>;
  lastSeen: number;
  online: boolean;
}

interface TVStatus {
  power: boolean;
  muted: boolean;
  volume: number;
  input?: string;
  app?: string;
  mediaUrl?: string;
  mediaTitle?: string;
  mediaState?: 'playing' | 'paused' | 'stopped';
}

interface CastResult {
  success: boolean;
  method?: string;
  message: string;
}

interface CommandResult {
  success: boolean;
  status: string;
  data?: Record<string, unknown>;
}

interface SSDPResponse {
  location: string;
  server: string;
  st: string;
  usn: string;
  ext: string;
  cacheControl: string;
}

type DeviceFilter = {
  type?: SmartDevice['type'];
  protocol?: SmartDevice['protocol'];
  brand?: string;
};

const SSDP_DISCOVER_MS = 3000;
const DISCOVERY_CACHE_TTL = 120_000;

class SmartHomeService {
  private devices: Map<string, SmartDevice> = new Map();
  private lastDiscovery: number = 0;
  private mqttClients: Map<string, { broker: string; connected: boolean }> = new Map();

  private async sandboxExec(cmd: string, timeout = 15000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const baseUrl = 'http://localhost:3081';
      const res = await fetch(`${baseUrl}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, timeout: Math.floor(timeout / 1000) }),
        signal: AbortSignal.timeout(timeout + 2000),
      });
      if (!res.ok) {
        const text = await res.text();
        return { stdout: '', stderr: text, exitCode: 1 };
      }
      const data = await res.json();
      return { stdout: data.stdout || '', stderr: data.stderr || '', exitCode: data.exitCode ?? 1 };
    } catch (e) {
      return { stdout: '', stderr: (e instanceof Error ? e.message : String(e)), exitCode: 1 };
    }
  }

  private async ssdpDiscover(timeoutMs = SSDP_DISCOVER_MS): Promise<SSDPResponse[]> {
    const pythonScript = `
import socket
import struct
import time
import sys
import re

MCAST_GRP = '239.255.255.250'
MCAST_PORT = 1900
TIMEOUT = ${timeoutMs / 1000}

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
sock.settimeout(TIMEOUT)

try:
    sock.bind(('', 0))
except OSError:
    sock.bind(('0.0.0.0', 0))

mreq = struct.pack("4sl", socket.inet_aton(MCAST_GRP), socket.INADDR_ANY)
sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)

DISCOVER_MSG = (
    'M-SEARCH * HTTP/1.1\\r\\n'
    'HOST: 239.255.255.250:1900\\r\\n'
    'MAN: "ssdp:discover"\\r\\n'
    'MX: 1\\r\\n'
    'ST: ssdp:all\\r\\n'
    'USER-AGENT: GIA/1.0 UPnP/1.0\\r\\n'
    '\\r\\n'
)

sock.sendto(DISCOVER_MSG.encode(), (MCAST_GRP, MCAST_PORT))
start = time.time()
results = []

while time.time() - start < TIMEOUT:
    try:
        data, addr = sock.recvfrom(4096)
        text = data.decode('utf-8', errors='replace')
        loc = ''
        server = ''
        st = ''
        usn = ''
        cache = ''
        for line in text.split('\\r\\n'):
            low = line.lower()
            if low.startswith('location:'):
                loc = line.split(':', 1)[1].strip()
            elif low.startswith('server:'):
                server = line.split(':', 1)[1].strip()
            elif low.startswith('st:'):
                st = line.split(':', 1)[1].strip()
            elif low.startswith('usn:'):
                usn = line.split(':', 1)[1].strip()
            elif low.startswith('cache-control:'):
                cache = line.split(':', 1)[1].strip()
        if loc:
            results.append({
                'location': loc,
                'server': server,
                'st': st,
                'usn': usn,
                'ext': '',
                'cacheControl': cache
            })
    except socket.timeout:
        break

sock.close()
import json
print(json.dumps(results))
`;
    const result = await this.sandboxExec(`python3 -c '${pythonScript.replace(/'/g, "'\\''")}'`, timeoutMs + 5000);
    if (result.exitCode !== 0) {
      logger.warn(`[SmartHome] SSDP discovery failed: ${result.stderr}`);
      return [];
    }
    try {
      const parsed = JSON.parse(result.stdout);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      logger.warn('[SmartHome] Failed to parse SSDP response');
      return [];
    }
  }

  private async mdnsDiscover(timeoutMs = SSDP_DISCOVER_MS): Promise<Array<{ name: string; ip: string; port: number; type: string }>> {
    const pythonScript = `
import socket
import struct
import time
import json
import sys

TIMEOUT = ${timeoutMs / 1000}
MDNS_ADDR = '224.0.0.251'
MDNS_PORT = 5353

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
sock.settimeout(TIMEOUT)

try:
    sock.bind(('', 0))
except OSError:
    sock.bind(('0.0.0.0', 0))

mreq = struct.pack("4sl", socket.inet_aton(MDNS_ADDR), socket.INADDR_ANY)
sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)

# mDNS query for _services._dns-sd._udp.local
query = bytes([
    0x00, 0x00,  # Transaction ID
    0x00, 0x00,  # Flags: standard query
    0x00, 0x01,  # Questions: 1
    0x00, 0x00,  # Answer RRs
    0x00, 0x00,  # Authority RRs
    0x00, 0x00,  # Additional RRs
    # _services._dns-sd._udp.local
    0x09, ord('_'), ord('s'), ord('e'), ord('r'), ord('v'), ord('i'), ord('c'), ord('e'), ord('s'),
    0x07, ord('_'), ord('d'), ord('n'), ord('s'), ord('-'), ord('s'), ord('d'),
    0x04, ord('_'), ord('u'), ord('d'), ord('p'),
    0x05, ord('l'), ord('o'), ord('c'), ord('a'), ord('l'),
    0x00,
    0x00, 0x0C,  # QTYPE: PTR
    0x00, 0x01,  # QCLASS: IN
])

sock.sendto(query, (MDNS_ADDR, MDNS_PORT))
start = time.time()
results = []

while time.time() - start < TIMEOUT:
    try:
        data, addr = sock.recvfrom(4096)
        ip = addr[0]
        port = addr[1]
        if ip not in [r['ip'] for r in results]:
            results.append({'name': f'mdns-{ip}', 'ip': ip, 'port': port, 'type': 'unknown'})
    except socket.timeout:
        break

sock.close()
print(json.dumps(results))
`;
    const result = await this.sandboxExec(`python3 -c '${pythonScript.replace(/'/g, "'\\''")}'`, timeoutMs + 5000);
    if (result.exitCode !== 0) {
      logger.warn(`[SmartHome] mDNS discovery failed: ${result.stderr}`);
      return [];
    }
    try {
      const parsed = JSON.parse(result.stdout);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      logger.warn('[SmartHome] Failed to parse mDNS response');
      return [];
    }
  }

  private extractDeviceInfo(ssdp: SSDPResponse): Partial<SmartDevice> {
    const location = ssdp.location;
    const usn = ssdp.usn;
    const st = ssdp.st.toLowerCase();
    const server = ssdp.server.toLowerCase();

    let ip = '';
    let port = 80;
    try {
      const url = new URL(location);
      ip = url.hostname;
      port = parseInt(url.port) || 80;
    } catch {
      ip = location;
    }

    let type: SmartDevice['type'] = 'unknown';
    let brand: string | undefined;

    if (st.includes('mediarenderer') || st.includes('avtransport') || server.includes('tizen') || server.includes('webos') || server.includes('android')) {
      type = 'tv';
    } else if (st.includes('light') || st.includes('bulb') || server.includes('hue') || server.includes('philips')) {
      type = 'light';
    } else if (st.includes('thermostat') || st.includes('temperature')) {
      type = 'thermostat';
    } else if (st.includes('speaker') || st.includes('audio') || st.includes('sonos')) {
      type = 'speaker';
    } else if (st.includes('switch') || st.includes('smartplug')) {
      type = 'switch';
    } else if (st.includes('sensor')) {
      type = 'sensor';
    }

    if (server.includes('tizen')) brand = 'Samsung';
    else if (server.includes('webos')) brand = 'LG';
    else if (server.includes('android') || server.includes('googlecast')) brand = 'AndroidTV';
    else if (server.includes('philips')) brand = 'Philips';
    else if (server.includes('sonos')) brand = 'Sonos';
    else if (server.includes('hue')) brand = 'Philips Hue';
    else if (server.includes('yeelight')) brand = 'Yeelight';
    else if (server.includes('tplink') || server.includes('kasa')) brand = 'TP-Link';
    else if (server.includes('xiaomi') || server.includes('mi')) brand = 'Xiaomi';

    const id = usn || `ssdp-${ip}-${port}`;
    const name = brand ? `${brand} ${type}` : `UPnP ${type} at ${ip}`;

    return {
      id,
      ip,
      port,
      type,
      brand,
      location,
      name,
    };
  }

  async discoverDevices(timeoutMs = SSDP_DISCOVER_MS): Promise<SmartDevice[]> {
    const now = Date.now();
    if (this.lastDiscovery > 0 && now - this.lastDiscovery < DISCOVERY_CACHE_TTL) {
      return Array.from(this.devices.values());
    }

    logger.info('[SmartHome] Starting device discovery');
    this.devices.clear();

    const [ssdpResults, mdnsResults] = await Promise.all([
      this.ssdpDiscover(timeoutMs),
      this.mdnsDiscover(timeoutMs),
    ]);

    for (const ssdp of ssdpResults) {
      const info = this.extractDeviceInfo(ssdp);
      if (!this.devices.has(info.id!)) {
        const device: SmartDevice = {
          id: info.id!,
          name: info.name || `Device at ${info.ip}`,
          type: info.type || 'unknown',
          protocol: 'ssdp',
          brand: info.brand,
          ip: info.ip!,
          port: info.port!,
          location: info.location || '',
          capabilities: this.inferCapabilities(info.type || 'unknown', info.brand),
          metadata: {},
          lastSeen: now,
          online: true,
        };
        this.devices.set(device.id, device);
      }
    }

    for (const mdns of mdnsResults) {
      const id = `mdns-${mdns.ip}`;
      if (!this.devices.has(id)) {
        const device: SmartDevice = {
          id,
          name: mdns.name,
          type: 'unknown',
          protocol: 'mdns',
          ip: mdns.ip,
          port: mdns.port,
          location: `http://${mdns.ip}:${mdns.port}`,
          capabilities: [],
          metadata: {},
          lastSeen: now,
          online: true,
        };
        this.devices.set(device.id, device);
      }
    }

    await this.probeDevices();

    this.lastDiscovery = now;
    logger.info(`[SmartHome] Discovery complete: ${this.devices.size} devices found`);
    return Array.from(this.devices.values());
  }

  private inferCapabilities(type: SmartDevice['type'], brand?: string): string[] {
    const caps: string[] = [];
    switch (type) {
      case 'tv':
        caps.push('power', 'volume', 'mute', 'input', 'cast', 'media_control');
        if (brand === 'Samsung') caps.push('tizen_apps',('tizen_remote'));
        if (brand === 'LG') caps.push('webos_apps', 'webos_remote');
        if (brand === 'AndroidTV') caps.push('androidtv_remote', 'google_cast');
        break;
      case 'light':
        caps.push('power', 'brightness', 'color', 'color_temp');
        break;
      case 'thermostat':
        caps.push('power', 'temperature', 'mode', 'fan');
        break;
      case 'speaker':
        caps.push('power', 'volume', 'mute', 'playback');
        break;
      case 'switch':
        caps.push('power');
        break;
      case 'sensor':
        caps.push('read_sensor');
        break;
    }
    return caps;
  }

  private async probeDevices(): Promise<void> {
    const devices = Array.from(this.devices.values());
    const probePromises = devices.map(async (device) => {
      const online = await this.pingDevice(device.ip, device.port);
      this.devices.set(device.id, { ...device, online, lastSeen: Date.now() });
    });
    await Promise.allSettled(probePromises);
  }

  private async pingDevice(ip: string, port: number): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      await fetch(`http://${ip}:${port}`, {
        method: 'GET',
        signal: controller.signal,
        mode: 'no-cors',
      });
      clearTimeout(timeout);
      return true;
    } catch {
      return false;
    }
  }

  async getDevices(filter?: DeviceFilter): Promise<SmartDevice[]> {
    let devices = Array.from(this.devices.values());
    if (filter) {
      if (filter.type) devices = devices.filter(d => d.type === filter.type);
      if (filter.protocol) devices = devices.filter(d => d.protocol === filter.protocol);
      if (filter?.brand) devices = devices.filter(d => d.brand?.toLowerCase() === filter.brand!.toLowerCase());
    }
    return devices;
  }

  async getDevice(deviceId: string): Promise<SmartDevice | null> {
    return this.devices.get(deviceId) || null;
  }

  async getTVStatus(deviceId: string): Promise<TVStatus | null> {
    const device = this.devices.get(deviceId);
    if (!device) return null;
    if (device.type !== 'tv') return null;

    if (!device.online) {
      return { power: false, muted: false, volume: 0 };
    }

    if (device.brand === 'Samsung') {
      return this.samsungTVStatus(device);
    }
    if (device.brand === 'LG') {
      return this.lgTVStatus(device);
    }
    if (device.brand === 'AndroidTV') {
      return this.androidTVStatus(device);
    }

    return {
      power: true,
      muted: false,
      volume: 50,
      input: 'unknown',
      mediaState: 'stopped',
    };
  }

  private async samsungTVStatus(device: SmartDevice): Promise<TVStatus> {
    try {
      const res = await fetch(`http://${device.ip}:8001/api/v2/`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return { power: false, muted: false, volume: 0 };
      const data = await res.json();
      return {
        power: data?.PowerState === 'on' || data?.PowerState === 'On',
        muted: data?.Mute || false,
        volume: data?.Volume || 0,
        input: data?.Source,
        app: data?.RunningApp,
        mediaState: 'stopped',
      };
    } catch {
      try {
        const wsUrl = `ws://${device.ip}:8001/api/v2/channels/samsung.remote.control`;
        const ws = new WebSocket(wsUrl);
        await new Promise<void>((resolve, reject) => {
          ws.onopen = () => {
            ws.send(JSON.stringify({ method: 'ms.remote.control', params: { cmd: 'GetPowerState' } }));
            resolve();
          };
          ws.onerror = () => reject(new Error('WS connection failed'));
          setTimeout(() => { ws.close(); reject(new Error('Timeout')); }, 3000);
        });
        ws.close();
        return { power: true, muted: false, volume: 50, input: 'TV', mediaState: 'stopped' };
      } catch {
        return { power: false, muted: false, volume: 0 };
      }
    }
  }

  private async lgTVStatus(device: SmartDevice): Promise<TVStatus> {
    try {
      const res = await fetch(`http://${device.ip}:8080/api/v1/status`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return { power: false, muted: false, volume: 0 };
      const data = await res.json();
      return {
        power: data?.status === 'active' || data?.powerState === 'on',
        muted: data?.muted || data?.mute || false,
        volume: data?.volume || data?.Volume || 0,
        input: data?.inputLabel || data?.InputSource,
        app: data?.foregroundApp || data?.appName,
        mediaState: data?.playState === 1 ? 'playing' : data?.playState === 2 ? 'paused' : 'stopped',
      };
    } catch {
      return { power: false, muted: false, volume: 0 };
    }
  }

  private async androidTVStatus(device: SmartDevice): Promise<TVStatus> {
    try {
      const res = await fetch(`http://${device.ip}:5555/status`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return { power: false, muted: false, volume: 0 };
      const data = await res.json();
      return {
        power: data?.poweredOn ?? true,
        muted: data?.muted ?? false,
        volume: data?.volumeLevel ?? 50,
        input: data?.currentInput,
        app: data?.currentApp,
        mediaState: data?.mediaState,
      };
    } catch {
      return { power: true, muted: false, volume: 50 };
    }
  }

  async castToTV(mediaUrl: string, deviceId: string, options?: {
    title?: string;
    mimeType?: string;
    subtitles?: string;
  }): Promise<CastResult> {
    const device = this.devices.get(deviceId);
    if (!device) return { success: false, message: `Device ${deviceId} not found` };
    if (device.type !== 'tv') return { success: false, message: `${device.name} is not a TV` };
    if (!device.online) return { success: false, message: `${device.name} is offline` };

    const encodedUrl = encodeURI(mediaUrl);
    const title = options?.title || 'Media';

    switch (device.brand) {
      case 'Samsung':
        return this.samsungCast(device, encodedUrl);
      case 'LG':
        return this.lgCast(device, encodedUrl, title);
      case 'AndroidTV':
        return this.androidTVCast(device, encodedUrl);
      default:
        return this.dlnaCast(device, encodedUrl, title);
    }
  }

  private async samsungCast(device: SmartDevice, url: string): Promise<CastResult> {
    try {
      const res = await fetch(`http://${device.ip}:8001/api/v2/applications/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'org.tizen.browser',
          action_type: 'DEEP_LINK',
          meta_tag: { url },
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        return { success: true, method: 'samsung_tizen', message: `Launched media on Samsung TV via Tizen browser` };
      }
      const wsUrl = `ws://${device.ip}:8001/api/v2/channels/samsung.remote.control?name=${btoa('GIA')}`;
      const ws = new WebSocket(wsUrl);
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
          ws.send(JSON.stringify({
            method: 'ms.remote.control',
            params: {
              Cmd: 'Click',
              DataOfCmd: url,
              Option: 'false',
              TypeOfRemote: 'SendRemoteKey',
            },
          }));
          resolve();
        };
        ws.onerror = () => reject(new Error('WS connection failed'));
        setTimeout(() => { ws.close(); reject(new Error('Timeout')); }, 5000);
      });
      ws.close();
      return { success: true, method: 'samsung_websocket', message: `Opened URL on Samsung TV` };
    } catch (e) {
      return { success: false, message: `Samsung cast failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  private async lgCast(device: SmartDevice, url: string, title: string): Promise<CastResult> {
    try {
      const res = await fetch(`http://${device.ip}:8080/api/v1/media/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          title,
          contentType: 'video/mp4',
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        return { success: true, method: 'lg_webos', message: `Playing media on LG webOS TV` };
      }
      const pairRes = await fetch(`http://${device.ip}:8080/api/v1/auth/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientKey: 'GIA' }),
        signal: AbortSignal.timeout(3000),
      });
      if (pairRes.ok) {
        const playRes = await fetch(`http://${device.ip}:8080/api/v1/media/play`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, title, contentType: 'video/mp4' }),
          signal: AbortSignal.timeout(5000),
        });
        if (playRes.ok) {
          return { success: true, method: 'lg_webos', message: `Playing media on LG webOS TV` };
        }
      }
      return { success: false, message: `LG TV did not respond to cast request` };
    } catch (e) {
      return { success: false, message: `LG cast failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  private async androidTVCast(device: SmartDevice, url: string): Promise<CastResult> {
    try {
      const res = await fetch(`http://${device.ip}:5555/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageName: 'com.google.android.youtube.tv',
          dataUri: url,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return { success: true, method: 'androidtv_adb', message: `Launched on Android TV` };
      const vlcRes = await fetch(`http://${device.ip}:8080/requests/status.xml?command=in_play&input=${url}`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      if (vlcRes.ok) return { success: true, method: 'androidtv_vlc', message: `Playing via VLC on Android TV` };
      try {
        const ws = new WebSocket(`ws://${device.ip}:5555/remote`);
        await new Promise<void>((resolve, reject) => {
          ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'open_url', url }));
            resolve();
          };
          ws.onerror = () => reject(new Error('WS connection failed'));
          setTimeout(() => { ws.close(); reject(new Error('Timeout')); }, 5000);
        });
        ws.close();
        return { success: true, method: 'androidtv_websocket', message: `Sent URL to Android TV` };
      } catch {
        return { success: false, message: 'Android TV not reachable on any known endpoint' };
      }
    } catch (e) {
      return { success: false, message: `Android TV cast failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  private async dlnaCast(device: SmartDevice, url: string, title: string): Promise<CastResult> {
    try {
      const body = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      <CurrentURI>${url}</CurrentURI>
      <CurrentURIMetaData>&lt;DIDL-Lite xmlns=&quot;urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/&quot; xmlns:dc=&quot;http://purl.org/dc/elements/1.1/&quot; xmlns:upnp=&quot;urn:schemas-upnp-org:metadata-1-0/upnp/&quot;&gt;&lt;item id=&quot;0&quot; parentID=&quot;0&quot; restricted=&quot;0&quot;&gt;&lt;dc:title&gt;${title}&lt;/dc:title&gt;&lt;upnp:class&gt;object.item.videoItem&lt;/upnp:class&gt;&lt;/item&gt;&lt;/DIDL-Lite&gt;</CurrentURIMetaData>
    </u:SetAVTransportURI>
  </s:Body>
</s:Envelope>`;

      const ctlUrl = device.location.replace('/description.xml', '/control');
      const res = await fetch(ctlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset="utf-8"',
          SOAPAction: '"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI"',
        },
        body,
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        return { success: true, method: 'dlna_upnp', message: `Playing via DLNA on ${device.name}` };
      }
      return { success: false, message: `DLNA cast rejected by ${device.name}` };
    } catch (e) {
      return { success: false, message: `DLNA cast failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  async sendCommand(deviceId: string, command: string, params?: Record<string, unknown>): Promise<CommandResult> {
    const device = this.devices.get(deviceId);
    if (!device) return { success: false, status: `Device ${deviceId} not found` };
    if (!device.online) return { success: false, status: `${device.name} is offline` };

    const knownCommands = ['power_on', 'power_off', 'volume_up', 'volume_down', 'set_volume', 'mute', 'unmute', 'toggle_mute', 'set_input', 'launch_app', 'home', 'back', 'up', 'down', 'left', 'right', 'select', 'play', 'pause', 'stop', 'rewind', 'fast_forward', 'set_brightness', 'set_color', 'set_temperature', 'set_mode'];

    if (!knownCommands.includes(command)) {
      return { success: false, status: `Unknown command: ${command}. Known: ${knownCommands.join(', ')}` };
    }

    switch (command) {
      case 'power_on': return this.powerOn(device);
      case 'power_off': return this.powerOff(device);
      case 'volume_up': return this.volumeUp(device);
      case 'volume_down': return this.volumeDown(device);
      case 'set_volume': return this.setVolume(device, params);
      case 'mute': return this.setMute(device, true);
      case 'unmute': return this.setMute(device, false);
      case 'toggle_mute': return this.setMute(device, undefined);
      case 'set_input': return this.setInput(device, params);
      case 'launch_app': return this.launchApp(device, params);
      case 'home': return this.remoteKey(device, 'HOME');
      case 'back': return this.remoteKey(device, 'BACK');
      case 'up': return this.remoteKey(device, 'UP');
      case 'down': return this.remoteKey(device, 'DOWN');
      case 'left': return this.remoteKey(device, 'LEFT');
      case 'right': return this.remoteKey(device, 'RIGHT');
      case 'select': return this.remoteKey(device, 'ENTER');
      case 'play': return this.remoteKey(device, 'PLAY');
      case 'pause': return this.remoteKey(device, 'PAUSE');
      case 'stop': return this.remoteKey(device, 'STOP');
      case 'rewind': return this.remoteKey(device, 'REWIND');
      case 'fast_forward': return this.remoteKey(device, 'FF');
      case 'set_brightness': return this.setLightBrightness(device, params);
      case 'set_color': return this.setLightColor(device, params);
      case 'set_temperature': return this.setThermostatTemp(device, params);
      case 'set_mode': return this.setDeviceMode(device, params);
      default:
        return { success: false, status: `Command ${command} not implemented` };
    }
  }

  private async powerOn(device: SmartDevice): Promise<CommandResult> {
    if (device.type === 'tv') {
      if (device.brand === 'LG') {
        try {
      const res = await fetch(`http://${device.ip}:8080/api/v1/power/on`, {
        method: 'POST', signal: AbortSignal.timeout(3000),
      });
      if (res.ok) return { success: true, status: `Powered on ${device.name}` };
    } catch { /* LG power endpoint not reachable */ }
      }
      try {
      const res = await fetch(`http://${device.ip}:8001/api/v2/power/on`, {
        method: 'POST', signal: AbortSignal.timeout(3000),
      });
      if (res.ok) return { success: true, status: `Powered on ${device.name}` };
    } catch { /* Samsung power endpoint not reachable */ }
      return this.wolOn(device);
    }
    if (device.type === 'light' || device.type === 'switch') {
      return this.httpDeviceCommand(device, 'on');
    }
    return { success: false, status: `Power on not supported for ${device.type}` };
  }

  private async powerOff(device: SmartDevice): Promise<CommandResult> {
    if (device.type === 'tv') {
      const key = device.brand === 'LG' ? 'POWER' : 'KEY_POWER';
      return this.remoteKey(device, key);
    }
    if (device.type === 'light' || device.type === 'switch') {
      return this.httpDeviceCommand(device, 'off');
    }
    return { success: false, status: `Power off not supported for ${device.type}` };
  }

  private async wolOn(device: SmartDevice): Promise<CommandResult> {
    const mac = device.metadata.mac;
    if (!mac) return { success: false, status: 'Wake-on-LAN requires MAC address. Please configure device MAC.' };
    try {
      const pythonScript = `
import socket
import struct

mac = '${mac.replace(/[^a-fA-F0-9]/g, '').toUpperCase()}'
packet = bytes.fromhex('FF' * 6 + mac * 16)
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
sock.sendto(packet, ('255.255.255.255', 9))
sock.close()
print('WOL sent')
`;
      await this.sandboxExec(`python3 -c '${pythonScript.replace(/'/g, "'\\''")}'`, 5000);
      return { success: true, status: `Wake-on-LAN magic packet sent to ${device.name}` };
    } catch (e) {
      return { success: false, status: `WOL failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  private async volumeUp(device: SmartDevice): Promise<CommandResult> {
    if (device.type === 'tv' || device.type === 'speaker') {
      return this.remoteKey(device, 'VOLUME_UP');
    }
    if (device.type === 'light') return { success: false, status: 'Volume not applicable to lights' };
    return this.httpDeviceCommand(device, 'volume_up');
  }

  private async volumeDown(device: SmartDevice): Promise<CommandResult> {
    if (device.type === 'tv' || device.type === 'speaker') {
      return this.remoteKey(device, 'VOLUME_DOWN');
    }
    return this.httpDeviceCommand(device, 'volume_down');
  }

  private async setVolume(device: SmartDevice, params?: Record<string, unknown>): Promise<CommandResult> {
    const volume = params?.level as number ?? params?.volume as number;
    if (typeof volume !== 'number' || volume < 0 || volume > 100) {
      return { success: false, status: 'Volume must be a number between 0 and 100' };
    }
    if (device.type === 'tv' && device.brand === 'Samsung') {
      try {
        const ws = new WebSocket(`ws://${device.ip}:8001/api/v2/channels/samsung.remote.control?name=${btoa('GIA')}`);
        await new Promise<void>((resolve, reject) => {
          ws.onopen = () => {
            ws.send(JSON.stringify({
              method: 'ms.remote.control',
              params: {
                Cmd: 'SetVolume',
                DataOfCmd: String(volume),
                Option: 'false',
                TypeOfRemote: 'SendRemoteKey',
              },
            }));
            resolve();
          };
          ws.onerror = () => reject(new Error('WS connection failed'));
          setTimeout(() => { ws.close(); reject(new Error('Timeout')); }, 3000);
        });
        ws.close();
        return { success: true, status: `Volume set to ${volume} on ${device.name}` };
      } catch (e) {
        return { success: false, status: `Failed to set volume: ${e instanceof Error ? e.message : String(e)}` };
      }
    }
    if (device.type === 'tv' && device.brand === 'LG') {
      try {
        const res = await fetch(`http://${device.ip}:8080/api/v1/volume/set`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ volume }),
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) return { success: true, status: `Volume set to ${volume} on ${device.name}` };
      } catch { /* LG volume endpoint not reachable */ }
    }
    return this.httpDeviceCommand(device, 'set_volume', { value: volume });
  }

  private async setMute(device: SmartDevice, mute?: boolean): Promise<CommandResult> {
    if (device.type !== 'tv' && device.type !== 'speaker') {
      return { success: false, status: 'Mute not applicable to this device' };
    }
    if (mute === undefined) {
      return this.remoteKey(device, 'MUTE');
    }
    if (device.brand === 'Samsung') {
      return this.httpDeviceCommand(device, mute ? 'mute_on' : 'mute_off');
    }
    if (device.brand === 'LG') {
      try {
        await fetch(`http://${device.ip}:8080/api/v1/volume/set`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mute }),
          signal: AbortSignal.timeout(3000),
        });
        return { success: true, status: `${mute ? 'Muted' : 'Unmuted'} ${device.name}` };
      } catch { /* LG mute endpoint not reachable */ }
    }
    return this.remoteKey(device, 'MUTE');
  }

  private async setInput(device: SmartDevice, params?: Record<string, unknown>): Promise<CommandResult> {
    const input = (params?.input as string) || (params?.source as string);
    if (!input) return { success: false, status: 'Input source required' };
    if (device.brand === 'Samsung') {
      const sourceMap: Record<string, string> = { hdmi1: 'HDMI1', hdmi2: 'HDMI2', hdmi3: 'HDMI3', hdmi: 'HDMI1', tv: 'TV', av: 'AV', component: 'COMPONENT', usb: 'USB' };
      const source = sourceMap[input.toLowerCase()] || input;
      try {
        const ws = new WebSocket(`ws://${device.ip}:8001/api/v2/channels/samsung.remote.control?name=${btoa('GIA')}`);
        await new Promise<void>((resolve, reject) => {
          ws.onopen = () => {
            ws.send(JSON.stringify({
              method: 'ms.remote.control',
              params: {
                Cmd: 'ChangeInput',
                DataOfCmd: source,
                Option: 'false',
                TypeOfRemote: 'SendRemoteKey',
              },
            }));
            resolve();
          };
          ws.onerror = () => reject(new Error('WS connection failed'));
          setTimeout(() => { ws.close(); reject(new Error('Timeout')); }, 3000);
        });
        ws.close();
        return { success: true, status: `Input set to ${source} on ${device.name}` };
      } catch (e) {
        return { success: false, status: `Failed to set input: ${e instanceof Error ? e.message : String(e)}` };
      }
    }
    return this.httpDeviceCommand(device, 'set_input', { input });
  }

  private async launchApp(device: SmartDevice, params?: Record<string, unknown>): Promise<CommandResult> {
    const appId = (params?.appId as string) || (params?.app as string);
    if (!appId) return { success: false, status: 'App ID required' };
    if (device.brand === 'Samsung') {
      try {
        await fetch(`http://${device.ip}:8001/api/v2/applications/${appId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action_type: 'NATIVE_LAUNCH' }),
          signal: AbortSignal.timeout(3000),
        });
        return { success: true, status: `Launched ${appId} on Samsung TV` };
      } catch (e) {
        return { success: false, status: `Failed to launch app: ${e instanceof Error ? e.message : String(e)}` };
      }
    }
    if (device.brand === 'LG') {
      try {
        await fetch(`http://${device.ip}:8080/api/v1/apps/${appId}`, {
          method: 'POST',
          signal: AbortSignal.timeout(3000),
        });
        return { success: true, status: `Launched ${appId} on LG TV` };
      } catch (e) {
        return { success: false, status: `Failed to launch app: ${e instanceof Error ? e.message : String(e)}` };
      }
    }
    return this.httpDeviceCommand(device, 'launch_app', { appId });
  }

  private async remoteKey(device: SmartDevice, key: string): Promise<CommandResult> {
    if (device.brand === 'Samsung') {
      const keyMap: Record<string, string> = {
        POWER: 'KEY_POWER', HOME: 'KEY_HOME', BACK: 'KEY_RETURN', UP: 'KEY_UP',
        DOWN: 'KEY_DOWN', LEFT: 'KEY_LEFT', RIGHT: 'KEY_RIGHT', ENTER: 'KEY_ENTER',
        VOLUME_UP: 'KEY_VOLUP', VOLUME_DOWN: 'KEY_VOLDOWN', MUTE: 'KEY_MUTE',
        PLAY: 'KEY_PLAY', PAUSE: 'KEY_PAUSE', STOP: 'KEY_STOP',
        REWIND: 'KEY_REWIND', FF: 'KEY_FF', CHANNEL_UP: 'KEY_CHUP',
        CHANNEL_DOWN: 'KEY_CHDOWN', INFO: 'KEY_INFO', MENU: 'KEY_MENU',
        EXIT: 'KEY_EXIT', SOURCE: 'KEY_SOURCE',
      };
      const samsungKey = keyMap[key] || key;
      try {
        const ws = new WebSocket(`ws://${device.ip}:8001/api/v2/channels/samsung.remote.control?name=${btoa('GIA')}`);
        await new Promise<void>((resolve, reject) => {
          ws.onopen = () => {
            ws.send(JSON.stringify({
              method: 'ms.remote.control',
              params: {
                Cmd: 'Click',
                DataOfCmd: samsungKey,
                Option: 'false',
                TypeOfRemote: 'SendRemoteKey',
              },
            }));
            resolve();
          };
          ws.onerror = () => reject(new Error('WS connection failed'));
          setTimeout(() => { ws.close(); reject(new Error('Timeout')); }, 3000);
        });
        ws.close();
        return { success: true, status: `Sent ${key} to ${device.name}` };
      } catch (e) {
        return { success: false, status: `Remote key failed: ${e instanceof Error ? e.message : String(e)}` };
      }
    }
    if (device.brand === 'LG') {
      const keyMap: Record<string, string> = {
        POWER: 'POWER', HOME: 'HOME', BACK: 'BACK', UP: 'UP', DOWN: 'DOWN',
        LEFT: 'LEFT', RIGHT: 'RIGHT', ENTER: 'ENTER', VOLUME_UP: 'VOLUMEUP',
        VOLUME_DOWN: 'VOLUMEDOWN', MUTE: 'MUTE', PLAY: 'PLAY', PAUSE: 'PAUSE',
        STOP: 'STOP', REWIND: 'REWIND', FF: 'FASTFORWARD',
        CHANNEL_UP: 'CHANNELUP', CHANNEL_DOWN: 'CHANNELDOWN',
        INFO: 'INFO', MENU: 'MENU', EXIT: 'EXIT',
      };
      const lgKey = keyMap[key] || key;
      try {
        const res = await fetch(`http://${device.ip}:8080/api/v1/remote/key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: lgKey }),
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) return { success: true, status: `Sent ${key} to ${device.name}` };
        return { success: false, status: `LG remote key ${key} failed: ${res.status}` };
      } catch (e) {
        return { success: false, status: `LG remote failed: ${e instanceof Error ? e.message : String(e)}` };
      }
    }
    if (device.brand === 'AndroidTV') {
      const keyMap: Record<string, string> = {
        POWER: 'KEYCODE_POWER', HOME: 'KEYCODE_HOME', BACK: 'KEYCODE_BACK',
        UP: 'KEYCODE_DPAD_UP', DOWN: 'KEYCODE_DPAD_DOWN', LEFT: 'KEYCODE_DPAD_LEFT',
        RIGHT: 'KEYCODE_DPAD_RIGHT', ENTER: 'KEYCODE_DPAD_CENTER',
        VOLUME_UP: 'KEYCODE_VOLUME_UP', VOLUME_DOWN: 'KEYCODE_VOLUME_DOWN',
        MUTE: 'KEYCODE_VOLUME_MUTE', PLAY: 'KEYCODE_MEDIA_PLAY',
        PAUSE: 'KEYCODE_MEDIA_PAUSE', STOP: 'KEYCODE_MEDIA_STOP',
        REWIND: 'KEYCODE_MEDIA_REWIND', FF: 'KEYCODE_MEDIA_FAST_FORWARD',
        MENU: 'KEYCODE_MENU', EXIT: 'KEYCODE_ESCAPE',
      };
      const androidKey = keyMap[key] || key;
      try {
        const res = await fetch(`http://${device.ip}:5555/keyevent/${androidKey}`, {
          method: 'POST',
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) return { success: true, status: `Sent ${key} to ${device.name}` };
        return { success: false, status: `Android TV remote key ${key} failed` };
      } catch (e) {
        return { success: false, status: `Android TV remote failed: ${e instanceof Error ? e.message : String(e)}` };
      }
    }
    return { success: false, status: `Remote key not supported for ${device.brand || 'generic'} device` };
  }

  private async setLightBrightness(device: SmartDevice, params?: Record<string, unknown>): Promise<CommandResult> {
    const brightness = params?.brightness as number ?? params?.level as number;
    if (typeof brightness !== 'number' || brightness < 0 || brightness > 100) {
      return { success: false, status: 'Brightness must be a number between 0 and 100' };
    }
    return this.httpDeviceCommand(device, 'set_brightness', { brightness });
  }

  private async setLightColor(device: SmartDevice, params?: Record<string, unknown>): Promise<CommandResult> {
    const color = params?.color as string;
    if (!color) return { success: false, status: 'Color value required (hex or name)' };
    return this.httpDeviceCommand(device, 'set_color', { color });
  }

  private async setThermostatTemp(device: SmartDevice, params?: Record<string, unknown>): Promise<CommandResult> {
    const temp = params?.temperature as number ?? params?.temp as number;
    if (typeof temp !== 'number') return { success: false, status: 'Temperature value required' };
    return this.httpDeviceCommand(device, 'set_temperature', { temperature: temp });
  }

  private async setDeviceMode(device: SmartDevice, params?: Record<string, unknown>): Promise<CommandResult> {
    const mode = params?.mode as string;
    if (!mode) return { success: false, status: 'Mode value required (e.g. cool, heat, auto, fan)' };
    return this.httpDeviceCommand(device, 'set_mode', { mode });
  }

  private async httpDeviceCommand(device: SmartDevice, command: string, params?: Record<string, unknown>): Promise<CommandResult> {
    const endpoints: Record<string, string> = {
      'philips_hue': '/api/{apiKey}/lights/{id}/state',
      'yeelight': '/control',
      'tplink_kasa': '/smartplug',
      'generic_http': '/command',
    };
    const endpoint = endpoints[device.brand || 'generic_http'] || '/api/command';

    if (device.brand === 'Philips Hue') {
      const apiKey = device.metadata?.apiKey || '';
      if (!apiKey) {
        const pythonScript = `
import json, urllib.request
try:
    req = urllib.request.Request('http://${device.ip}/api')
    req.add_header('Content-Type', 'application/json')
    data = json.dumps({"devicetype":"GIA#SmartHome"}).encode()
    res = urllib.request.urlopen(req, data, timeout=5)
    print(res.read().decode())
except Exception as e:
    print(f"Error: {e}")
`;
        try {
          const result = await this.sandboxExec(`python3 -c '${pythonScript.replace(/'/g, "'\\''")}'`, 8000);
          return { success: true, status: `Hue bridge at ${device.ip} requires press-link pairing. Run discovery again after pressing bridge button.\n${result.stdout}` };
        } catch (e) {
          return { success: false, status: `Hue bridge unreachable: ${e instanceof Error ? e.message : String(e)}` };
        }
      }
    }

    try {
      const url = `http://${device.ip}:${device.port}${endpoint}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, ...params }),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const body = await res.text();
        try { return { success: true, status: `Command ${command} sent to ${device.name}`, data: JSON.parse(body) }; } catch { return { success: true, status: `Command ${command} sent to ${device.name}` }; }
      }
      return { success: false, status: `${device.name} responded with ${res.status}` };
    } catch {
      return { success: false, status: `${device.name} at ${device.ip}:${device.port} unreachable for command ${command}` };
    }
  }

  async sendMQTT(topic: string, message: string, broker?: string): Promise<{ success: boolean; status: string }> {
    const brokerUrl = broker || 'localhost';
    const pythonScript = `
import paho.mqtt.client as mqtt
import time

def on_connect(client, userdata, flags, rc):
    print(f"Connected:{rc}")

client = mqtt.Client()
client.on_connect = on_connect
try:
    client.connect('${brokerUrl}', 1883, 5)
    client.loop_start()
    time.sleep(0.5)
    result = client.publish('${topic.replace(/'/g, "\\'")}', '${message.replace(/'/g, "\\'")}', qos=1)
    print(f"Published:{result.rc}")
    client.disconnect()
except Exception as e:
    print(f"Error:{e}")
`;
    try {
      const result = await this.sandboxExec(`python3 -c '${pythonScript.replace(/'/g, "'\\''")}'`, 10000);
      if (result.stdout.includes('Published:0') || result.stdout.includes('Connected:0')) {
        return { success: true, status: `MQTT message sent to ${topic}` };
      }
      return { success: false, status: `MQTT publish failed: ${result.stderr || result.stdout}` };
    } catch (e) {
      return { success: false, status: `MQTT error: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  async addDevice(device: Omit<SmartDevice, 'lastSeen' | 'online'>): Promise<SmartDevice> {
    const now = Date.now();
    const newDevice: SmartDevice = { ...device, lastSeen: now, online: true };
    this.devices.set(newDevice.id, newDevice);
    newDevice.online = await this.pingDevice(newDevice.ip, newDevice.port);
    this.devices.set(newDevice.id, newDevice);
    return newDevice;
  }

  async removeDevice(deviceId: string): Promise<boolean> {
    return this.devices.delete(deviceId);
  }

  clearCache(): void {
    this.devices.clear();
    this.lastDiscovery = 0;
  }
}

export default new SmartHomeService();
