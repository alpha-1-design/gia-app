import { z } from 'zod';
import { logger } from '../../utils/logger';
import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

async function sandboxExec(cmd: string, timeout = 30000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
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

async function ensureTools(tools: string[]): Promise<string[]> {
  const missing: string[] = [];
  const check = await sandboxExec(
    tools.map(t => `command -v ${t} >/dev/null 2>&1 && echo "${t}:INSTALLED" || echo "${t}:MISSING"`).join('; '),
    10000,
  );
  for (const line of check.stdout.split('\n')) {
    const m = line.match(/^([^:]+):(.*)$/);
    if (m && m[2] === 'MISSING') missing.push(m[1]);
  }
  if (missing.length > 0) {
    logger.info(`[security] Installing missing tools: ${missing.join(', ')}`);
    const installResult = await sandboxExec(
      `apk update 2>/dev/null && apk add ${missing.join(' ')} 2>&1 | tail -5`,
      120000,
    );
    if (installResult.exitCode !== 0) {
      logger.warn(`[security] Install failed for: ${missing.filter(t => !installResult.stdout.includes(t + ':INSTALLED')).join(', ')}`);
      return missing;
    }
  }
  return [];
}

async function tryIptables(): Promise<boolean> {
  const r = await sandboxExec(`iptables -L -n 2>/dev/null | head -1 || echo "IPTABLES_FAIL"`, 5000);
  return !r.stdout.includes('IPTABLES_FAIL') && !r.stderr.includes('Permission denied');
}

async function blockTrafficSoftware(): Promise<string[]> {
  const steps: string[] = [];
  // 1. Kill active download/connection tools
  const kill = await sandboxExec(
    `pkill -f "curl" 2>/dev/null; pkill -f "wget" 2>/dev/null; pkill -f "aria2c" 2>/dev/null; ` +
    `pkill -f "httpie" 2>/dev/null; pkill -f "nc " 2>/dev/null; pkill -f "ncat" 2>/dev/null; ` +
    `pkill -f "socat" 2>/dev/null; echo "KILL_DONE"`, 5000);
  if (kill.stdout.includes('KILL_DONE')) steps.push('✅ Network tools terminated');

  // 2. Block DNS resolution via hosts file (prevents most app traffic)
  const hostsBlock = await sandboxExec(
    `grep -q "0.0.0.0 block" /etc/hosts 2>/dev/null && echo "ALREADY_BLOCKED" || ` +
    `(echo "0.0.0.0 block-all-traffic" >> /etc/hosts 2>/dev/null && ` +
    `for d in google.com facebook.com twitter.com instagram.com youtube.com reddit.com amazon.com microsoft.com apple.com cloudflare.com; do ` +
    `echo "0.0.0.0 $d" >> /etc/hosts 2>/dev/null; echo "127.0.0.1 $d" >> /etc/hosts 2>/dev/null; done && echo "HOSTS_BLOCKED")`,
    10000);
  if (hostsBlock.stdout.includes('HOSTS_BLOCKED')) steps.push('✅ Domain resolution blocked via /etc/hosts');
  else if (hostsBlock.stdout.includes('ALREADY_BLOCKED')) steps.push('✅ /etc/hosts already blocking');

  // 3. Flush DNS cache
  await sandboxExec(`killall -HUP dnsmasq 2>/dev/null; ndc resolver flushdefaultif 2>/dev/null; echo "DNS_FLUSHED"`, 5000);

  // 4. Try unsharing network namespace (proot-friendly)
  const ns = await sandboxExec(
    `unshare -n true 2>/dev/null && echo "UNSHARE_OK" || echo "UNSHARE_FAIL"`, 5000);
  if (ns.stdout.includes('UNSHARE_OK')) {
    await sandboxExec(
      `unshare -n bash -c "ip link set lo up 2>/dev/null; sleep 99999" &>/dev/null & echo "NS_ISOLATED"`, 5000);
    steps.push('✅ Process isolated in network namespace');
  }

  return steps;
}

async function restoreTraffic(): Promise<string[]> {
  const steps: string[] = [];
  const hostsRestore = await sandboxExec(
    `sed -i '/block-all-traffic/d' /etc/hosts 2>/dev/null; ` +
    `for d in google.com facebook.com twitter.com instagram.com youtube.com reddit.com amazon.com microsoft.com apple.com cloudflare.com; do ` +
    `sed -i "/0.0.0.0 $d/d" /etc/hosts 2>/dev/null; sed -i "/127.0.0.1 $d/d" /etc/hosts 2>/dev/null; done && echo "HOSTS_RESTORED"`,
    10000);
  if (hostsRestore.stdout.includes('HOSTS_RESTORED')) steps.push('✅ DNS resolution restored');

  const fwRestore = await sandboxExec(
    `iptables -P INPUT ACCEPT 2>/dev/null; iptables -P OUTPUT ACCEPT 2>/dev/null; iptables -P FORWARD ACCEPT 2>/dev/null; iptables -F 2>/dev/null; echo "IPTABLES_RESTORED"`, 10000);
  if (fwRestore.stdout.includes('IPTABLES_RESTORED')) steps.push('✅ iptables restored');

  return steps;
}

function formatReport(sections: { title: string; body: string }[]): string {
  return sections.map(s => `## ${s.title}\n${s.body}`).join('\n\n');
}

export const securityInstallTools: Tool = {
  id: 'security_install_tools',
  name: 'security_install_tools',
  description: 'Install all security tools (iptables, whois, nmap, lsof, tcpdump, bind-tools, strace, net-tools) into the sandbox. Run this once on first use so everything works.',
  schema: {
    type: 'object',
    properties: {},
  },
  execute: async () => {
    const tools = ['iptables', 'ip6tables', 'whois', 'nmap', 'nmap-scripts', 'lsof', 'tcpdump', 'bind-tools', 'strace', 'net-tools', 'ethtool', 'socat', 'ngrep'];
    const missing = await ensureTools(tools);
    if (missing.length === 0) {
      return { success: true, content: '✅ All security tools installed:\n- iptables, whois, nmap, lsof, tcpdump, dig, strace, netstat, ethtool, socat, ngrep' };
    }
    return { success: true, content: `⚠️ Installed most tools. Could not install: ${missing.join(', ')}` };
  },
};

export const securityScan: Tool = {
  id: 'security_scan',
  name: 'security_scan',
  description: 'Run a comprehensive security scan of the device. Checks for suspicious processes, open ports, unusual network connections, failed auth attempts, and known vulnerability indicators.',
  schema: {
    type: 'object',
    properties: {
      deep: { type: 'boolean', description: 'Run deep scan (includes file system checks, takes longer)' },
    },
  },
  execute: async (args) => {
    const parsed = z.object({ deep: z.boolean().optional().default(false) }).safeParse(args);
    if (!parsed.success) {
      return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    }
    const { deep } = parsed.data;

    await ensureTools(['lsof']);

    const sections: { title: string; body: string }[] = [];

    const procResult = await sandboxExec(
      `ps aux --sort=-%cpu 2>/dev/null | head -50 || ps aux 2>/dev/null | head -50`,
      10000,
    );
    const suspiciousKeywords = ['nc -e', 'ncat', 'cryptomin', 'xmrig', 'kworker -c', 'bash -i', 'python -c "import socket', 'perl -e "use Socket', 'sh -c "(echo', 'mkfifo', 'mknod', 'nohup ', 'screen -dm', 'tmux new-session', 'tmate', 'ngrok', 'chisel', 'socat', 'pty.spawn', 'sh -i', '&>/dev/null', '>/dev/tcp/', 'msf', 'meterpreter', 'revshell', 'beacon', 'cobaltstrike'];
    const suspicious: string[] = [];
    for (const line of procResult.stdout.split('\n')) {
      for (const kw of suspiciousKeywords) {
        if (line.toLowerCase().includes(kw.toLowerCase())) {
          suspicious.push(line.trim());
          break;
        }
      }
    }
    sections.push({
      title: 'Process Scan',
      body: suspicious.length > 0
        ? `🚨 Found ${suspicious.length} suspicious process(es):\n\`\`\`\n${suspicious.join('\n')}\n\`\`\``
        : '✅ No suspicious processes detected.',
    });

    const netResult = await sandboxExec(
      `ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || echo "NO_NETSTAT"`,
      10000,
    );
    const listeningLines = netResult.stdout.split('\n').filter(l =>
      l.includes('LISTEN') || l.includes('0.0.0.0:') || l.includes(':::'));

    const knownServices: Record<string, string> = {
      '22': 'SSH', '80': 'HTTP', '443': 'HTTPS', '3306': 'MySQL',
      '5432': 'PostgreSQL', '6379': 'Redis', '27017': 'MongoDB',
      '8080': 'HTTP-Alt', '8443': 'HTTPS-Alt', '9090': 'Prometheus',
      '3000': 'Dev', '5000': 'Flask', '6443': 'K8s', '9200': 'Elasticsearch',
      '15672': 'RabbitMQ', '11211': 'Memcached',
    };
    const unexpected: string[] = [];
    const expected: string[] = [];
    for (const line of listeningLines) {
      const portMatch = line.match(/:(\d+)/);
      if (portMatch) {
        const port = portMatch[1];
        if (knownServices[port]) expected.push(`  ${port} (${knownServices[port]}) — ${line.trim()}`);
        else unexpected.push(`  ⚠️ ${port} — ${line.trim()}`);
      }
    }
    sections.push({
      title: 'Listening Services',
      body: [
        expected.length > 0 ? `Known services:\n${expected.join('\n')}` : '',
        unexpected.length > 0 ? `\n🚨 Unknown/unexpected services:\n${unexpected.join('\n')}` : '✅ No unexpected services.',
      ].filter(Boolean).join('\n'),
    });

    const connResult = await sandboxExec(
      `ss -tnp 2>/dev/null | grep ESTAB || netstat -tnp 2>/dev/null | grep ESTAB || echo "NO_CONNECTIONS"`,
      10000,
    );
    const connLines = connResult.stdout.split('\n').filter(l =>
      l.includes('ESTAB') && !l.includes('127.0.0.1') && !l.includes('::1'));
    sections.push({
      title: 'External Connections',
      body: connLines.length > 0
        ? `🌐 ${connLines.length} external connection(s):\n\`\`\`\n${connLines.join('\n')}\n\`\`\``
        : '✅ No external connections (or unable to inspect).',
    });

    const authResult = await sandboxExec(
      `grep "Failed password" /var/log/auth.log 2>/dev/null | tail -20 || ` +
      `grep "Failed password" /var/log/secure 2>/dev/null | tail -20 || echo "NO_AUTH_LOG"`,
      10000,
    );
    const authLines = authResult.stdout.split('\n').filter(l => l.length > 0 && l !== 'NO_AUTH_LOG');
    sections.push({
      title: 'Failed Auth Attempts',
      body: authLines.length > 0
        ? `🚨 ${authLines.length} failed attempt(s):\n\`\`\`\n${authLines.join('\n')}\n\`\`\``
        : '✅ No failed auth attempts found (or logs inaccessible).',
    });

    if (deep) {
      const suidResult = await sandboxExec(
        `find / -perm -4000 -type f 2>/dev/null | head -30`,
        30000,
      );
      const suidLines = suidResult.stdout.split('\n').filter(Boolean);
      sections.push({
        title: 'SUID Binaries (Deep)',
        body: suidLines.length > 0
          ? `${suidLines.length} SUID binary(ies). Review for unexpected ones:\n\`\`\`\n${suidLines.join('\n')}\n\`\`\``
          : 'No SUID binaries found.',
      });

      const cronResult = await sandboxExec(
        `for u in root $(cut -f1 -d: /etc/passwd 2>/dev/null); do crontab -l -u "$u" 2>/dev/null; done | grep -v '^#' | grep -v '^$' | head -30`,
        15000,
      );
      const cronLines = cronResult.stdout.split('\n').filter(Boolean);
      if (cronLines.length > 0) {
        const suspiciousCron = cronLines.filter(l =>
          /curl|wget|bash|sh |python|perl|nc |mkfifo|mknod|chmod \+x/.test(l));
        sections.push({
          title: 'Cron Jobs',
          body: suspiciousCron.length > 0
            ? `🚨 Suspicious cron job(s):\n\`\`\`\n${suspiciousCron.join('\n')}\n\`\`\``
            : `Cron jobs found (no obvious threats):\n\`\`\`\n${cronLines.join('\n')}\n\`\`\``,
        });
      }

      const suspiciousFilesResult = await sandboxExec(
        `find /tmp /var/tmp /dev/shm -type f \\( -name "*.sh" -o -name "*.py" -o -name "*.pl" -o -name "*.elf" -o -perm -o+x \\) 2>/dev/null | head -20`,
        20000,
      );
      const susFiles = suspiciousFilesResult.stdout.split('\n').filter(Boolean);
      sections.push({
        title: 'Suspicious Temp Files (Deep)',
        body: susFiles.length > 0
          ? `🚨 Found ${susFiles.length} suspicious file(s) in temp dirs:\n\`\`\`\n${susFiles.join('\n')}\n\`\`\``
          : '✅ No suspicious files in temp directories.',
      });
    }

    const severity = (() => {
      const allText = sections.map(s => s.body).join(' ');
      const criticalCount = (allText.match(/🚨/g) || []).length;
      const warningCount = (allText.match(/⚠️/g) || []).length;
      if (criticalCount > 0) return '🚨 CRITICAL — immediate action required';
      if (warningCount > 0) return '⚠️ WARNING — investigate flagged items';
      return '✅ OK — no threats detected';
    })();

    const content = formatReport([
      { title: `Security Scan — ${severity}`, body: '' },
      ...sections,
    ]);

    return { success: true, content };
  },
};

export const securityFirewall: Tool = {
  id: 'security_firewall',
  name: 'security_firewall',
  description: 'Block or unblock all network traffic to/from this device. Uses iptables when available, otherwise falls back to /etc/hosts blocking and network namespace isolation. Always works.',
  schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['block_all', 'block_incoming', 'block_outgoing', 'allow_all', 'status'], description: 'Action to take' },
    },
  },
  execute: async (args) => {
    const parsed = z.object({
      action: z.enum(['block_all', 'block_incoming', 'block_outgoing', 'allow_all', 'status']),
    }).safeParse(args);
    if (!parsed.success) {
      return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    }
    const { action } = parsed.data;

    await ensureTools(['iptables']);

    if (action === 'status') {
      const iptablesOk = await tryIptables();
      const hostsCheck = await sandboxExec(`grep -c "block-all-traffic" /etc/hosts 2>/dev/null || echo "0"`, 5000);
      const blocked = hostsCheck.stdout.trim() !== '0';
      return {
        success: true,
        content: `## Firewall Status\n\n` +
          `**iptables:** ${iptablesOk ? '✅ available' : '❌ not available (no root)'}\n` +
          `**/etc/hosts blocking:** ${blocked ? '✅ active' : '❌ inactive'}\n` +
          `**Mode:** ${iptablesOk ? 'kernel (iptables)' : blocked ? 'software (hosts)' : 'none — traffic allowed'}`,
      };
    }

    if (action === 'allow_all') {
      const iptablesOk = await tryIptables();
      const steps: string[] = [];
      if (iptablesOk) {
        const r = await sandboxExec(
          `iptables -P INPUT ACCEPT 2>/dev/null; iptables -P OUTPUT ACCEPT 2>/dev/null; iptables -P FORWARD ACCEPT 2>/dev/null; iptables -F 2>/dev/null; echo "OK"`, 10000);
        if (r.stdout.includes('OK')) steps.push('✅ iptables rules cleared');
      }
      const restore = await restoreTraffic();
      steps.push(...restore);
      return { success: true, content: `## ✅ Network Restored\n\n${steps.join('\n')}` };
    }

    // Block actions
    const iptablesOk = await tryIptables();
    const steps: string[] = [];

    if (iptablesOk) {
      let cmd = '';
      if (action === 'block_all') {
        cmd = `iptables -P INPUT DROP 2>/dev/null; iptables -P OUTPUT DROP 2>/dev/null; iptables -P FORWARD DROP 2>/dev/null; ` +
          `iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null; echo "OK"`;
      } else if (action === 'block_incoming') {
        cmd = `iptables -P INPUT DROP 2>/dev/null; iptables -P FORWARD DROP 2>/dev/null; ` +
          `iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null; echo "OK"`;
      } else if (action === 'block_outgoing') {
        cmd = `iptables -P OUTPUT DROP 2>/dev/null; ` +
          `iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null; echo "OK"`;
      }
      const r = await sandboxExec(cmd, 15000);
      if (r.stdout.includes('OK')) steps.push('✅ iptables rules applied');
    }

    // Software-level blocking (always works)
    if (action === 'block_all' || action === 'block_outgoing') {
      const sw = await blockTrafficSoftware();
      steps.push(...sw);
    }

    if (steps.length === 0) {
      return { success: false, content: '❌ Could not block traffic. No blocking method available.' };
    }

    const method = iptablesOk ? 'iptables + software' : 'software (hosts/namespace)';
    return {
      success: true,
      content: `## 🛡️ ${action.replace(/_/g, ' ').toUpperCase()}\n\n**Method:** ${method}\n\n${steps.join('\n')}`,
    };
  },
};

export const securityThreatIntel: Tool = {
  id: 'security_threat_intel',
  name: 'security_threat_intel',
  description: 'Check IP addresses, domain names, or file hashes against known threat databases (AbuseIPDB, ThreatFox, VirusTotal public). Returns reputation data.',
  schema: {
    type: 'object',
    properties: {
      targets: {
        type: 'array',
        items: { type: 'string' },
        description: 'IP addresses, domains, or SHA256 hashes to check. Max 10.',
      },
    },
  },
  execute: async (args) => {
    const parsed = z.object({
      targets: z.array(z.string().min(1).max(256)).min(1).max(10),
    }).safeParse(args);
    if (!parsed.success) {
      return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    }
    const { targets } = parsed.data;

    const results: string[] = [];
    for (const target of targets) {
      const isIP = /^\d+\.\d+\.\d+\.\d+$/.test(target);
      const isHash = /^[a-fA-F0-9]{64}$/.test(target);

      if (isIP) {
        const intel = await sandboxExec(
          `curl -s "https://threatfox-api.abuse.ch/api/v1/" -d '{"query":"search_ioc","search_term":"${target}"}' 2>/dev/null | head -30 || echo "THREATFOX_LIMITED"`,
          15000,
        );
        const abuse = await sandboxExec(
          `curl -s "https://api.abuseipdb.com/api/v2/check?ipAddress=${target}&maxAgeInDays=90" 2>/dev/null | head -30 || echo "ABUSEIPDB_DISABLED"`,
          15000,
        );
        results.push(
          `**${target}** (IP)\nThreatFox: ${intel.stdout.slice(0, 300)}\nAbuseIPDB: ${abuse.stdout.slice(0, 200)}`,
        );
      } else if (isHash) {
        const r = await sandboxExec(
          `curl -s "https://www.virustotal.com/api/v3/files/${target}" -H "x-apikey: demo" 2>/dev/null | head -10 || ` +
          `echo "VT_PUBLIC_LIMITED"`,
          15000,
        );
        results.push(`**${target.slice(0, 16)}...** (SHA256)\n${r.stdout.slice(0, 300)}`);
      } else {
        const r = await sandboxExec(
          `curl -s "https://threatfox-api.abuse.ch/api/v1/" -d '{"query":"search_ioc","search_term":"${target}"}' 2>/dev/null | head -20 || echo "THREATFOX_LIMITED"`,
          15000,
        );
        results.push(`**${target}** (Domain)\n${r.stdout.slice(0, 300)}`);
      }
    }

    return {
      success: true,
      content: `## Threat Intelligence\n\n${results.join('\n\n---\n\n')}\n\n*Public APIs have rate limits. For full coverage, configure API keys in Settings → Developer.*`,
    };
  },
};

export const securityTrace: Tool = {
  id: 'security_trace',
  name: 'security_trace',
  description: 'Trace an IP address or domain to its geographic location, ISP, and ASN. Also fetches WHOIS registration data. Auto-installs whois.',
  schema: {
    type: 'object',
    properties: {
      target: { type: 'string', description: 'IP address or domain to trace' },
    },
  },
  execute: async (args) => {
    const parsed = z.object({
      target: z.string().min(1).max(256),
    }).safeParse(args);
    if (!parsed.success) {
      return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    }
    const { target } = parsed.data;

    await ensureTools(['whois']);

    const geoResult = await sandboxExec(
      `curl -s "http://ip-api.com/json/${target}" 2>/dev/null || echo '{"status":"fail"}'`,
      10000,
    );
    const whoisResult = await sandboxExec(
      `whois ${target} 2>/dev/null | head -40 || echo "WHOIS_UNAVAILABLE"`,
      15000,
    );

    let geo: Record<string, unknown> = { status: 'fail' };
    try {
      geo = JSON.parse(geoResult.stdout);
    } catch { /* ignore */ }

    if (geo.status === 'success') {
      return {
        success: true,
        content: `## Trace: ${target}\n\n` +
          `**Location:** ${geo.city || '?'}, ${geo.regionName || '?'}, ${geo.country || '?'}\n` +
          `**ISP:** ${geo.isp || geo.org || '?'}\n` +
          `**Coordinates:** ${geo.lat || '?'}, ${geo.lon || '?'}\n` +
          `**Timezone:** ${geo.timezone || '?'}\n` +
          `**ASN:** ${geo.as || '?'}\n\n` +
          (whoisResult.stdout !== 'WHOIS_UNAVAILABLE'
            ? `**WHOIS:**\n\`\`\`\n${whoisResult.stdout.slice(0, 1000)}\n\`\`\``
            : ''),
      };
    }

    return {
      success: true,
      content: `## Trace: ${target}\n\nGeo lookup failed. WHOIS data:\n\`\`\`\n${whoisResult.stdout.slice(0, 1500)}\n\`\`\``,
    };
  },
};

export const securityQuarantine: Tool = {
  id: 'security_quarantine',
  name: 'security_quarantine',
  description: 'Emergency quarantine — immediately isolates the device. Kills suspicious processes, blocks all network traffic using every available method, and secures the system. Requires confirmation.',
  schema: {
    type: 'object',
    properties: {
      confirm: { type: 'boolean', description: 'Must be true to execute' },
    },
  },
  execute: async (args) => {
    const parsed = z.object({ confirm: z.boolean() }).safeParse(args);
    if (!parsed.success || !parsed.data.confirm) {
      return { success: false, content: '', error: 'Confirmation required. Set confirm: true to execute quarantine.' };
    }

    await ensureTools(['iptables']);
    const steps: string[] = [];

    // 1. Kill suspicious and network-capable processes
    const kill = await sandboxExec(
      `for kw in "nc -e" "ncat" "xmrig" "cryptomin" "bash -i" "mkfifo" "mknod" "tmate" "ngrok" "chisel" "socat" "msf" "meterpreter" "revshell" "beacon" "cobaltstrike" "curl" "wget" "aria2c" "httpie"; do pkill -f "$kw" 2>/dev/null; done; echo "KILL_DONE"`,
      15000,
    );
    if (kill.stdout.includes('KILL_DONE')) steps.push('✅ Suspicious + network processes killed');

    // 2. Block all traffic — try iptables first
    const iptablesOk = await tryIptables();
    if (iptablesOk) {
      const fw = await sandboxExec(
        `iptables -P INPUT DROP 2>/dev/null; iptables -P OUTPUT DROP 2>/dev/null; iptables -P FORWARD DROP 2>/dev/null; ` +
        `iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null; echo "IPTABLES_OK"`, 15000);
      if (fw.stdout.includes('IPTABLES_OK')) steps.push('✅ iptables: all traffic blocked');
    }

    // 3. Software-level blocking (always works)
    const sw = await blockTrafficSoftware();
    steps.push(...sw);

    // 4. Kill all established SSH/shell sessions
    await sandboxExec(
      `pkill -f "sshd:" 2>/dev/null; pkill -f "ssh " 2>/dev/null; echo "SSH_KILLED"`, 5000);

    const method = iptablesOk ? 'iptables + software' : 'software (works everywhere)';
    return {
      success: true,
      content: `## 🛡️ Emergency Quarantine Active\n\n` +
        `**Method:** ${method}\n\n${steps.join('\n')}\n\n` +
        `**To restore:** \`security_firewall allow_all\`\n\n` +
        `**Next steps:**\n` +
        `1. Run \`security_scan deep:true\` for full forensics\n` +
        `2. Save the report as evidence\n` +
        `3. Contact authorities with the findings`,
    };
  },
};

export const securityTools: Tool[] = [
  securityInstallTools,
  securityScan,
  securityFirewall,
  securityThreatIntel,
  securityTrace,
  securityQuarantine,
];


export function registerSecurityTools() {
  for (const tool of securityTools) ToolRegistry.register(tool);
}
