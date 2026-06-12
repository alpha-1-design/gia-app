/**
 * GIA Gateway Daemon
 * 
 * Runs 24/7 in proot+Alpine terminal. Listens on Telegram, Discord, etc.
 * Reads config from ~/.gia/gateway.json (shared with the GIA app).
 * 
 * Usage:
 *   cd daemon && npm start
 * 
 * Or start it from GIA's terminal:
 *   node ~/gia-app/daemon/index.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { TelegramPoller } from './telegram.js';
import { ConfigManager } from './config.js';

const GIA_DIR = process.env.HOME + '/.gia';
const CONFIG_PATH = GIA_DIR + '/gateway.json';
const LOG_PATH = GIA_DIR + '/gateway-daemon.log';

function log(...args) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${args.join(' ')}`;
  console.log(msg);
  try { fs.appendFileSync(LOG_PATH, msg + '\n'); } catch {}
}

async function main() {
  log('=== GIA Gateway Daemon starting ===');
  log(`Config: ${CONFIG_PATH}`);
  log(`PID: ${process.pid}`);

  // Ensure config dir
  try { fs.mkdirSync(GIA_DIR, { recursive: true }); } catch {}

  const config = new ConfigManager(CONFIG_PATH);
  const pollers = [];

  // ── Telegram ───────────────────────────────────────────────
  if (config.get('telegram.botToken') && config.get('telegram.enabled') !== false) {
    const token = config.get('telegram.botToken');
    log(`Telegram: starting poller with token ${token.slice(0, 8)}...`);
    const tg = new TelegramPoller(token, config.get('telegram.channelId'));
    tg.onMessage(async (msg) => {
      log(`📩 Telegram message from ${msg.from?.username || msg.from?.id}: ${msg.text?.slice(0, 100)}`);
      // Send to LLM and reply
      await tg.sendMessage(msg.chat.id, `🤖 GIA received your message! (This is a daemon bridge — full LLM routing coming soon)`);
    });
    tg.onError((err) => log(`❌ Telegram error: ${err.message}`));
    tg.start();
    pollers.push(tg);
    log('✅ Telegram poller started');
  } else {
    log('⚠️ Telegram not configured — set "telegram.botToken" in gateway.json');
  }

  // ── Watch config for changes ──────────────────────────────
  let lastConfigStat = null;
  try { lastConfigStat = fs.statSync(CONFIG_PATH); } catch {}
  
  setInterval(() => {
    try {
      const stat = fs.statSync(CONFIG_PATH);
      if (stat.mtimeMs !== lastConfigStat?.mtimeMs) {
        lastConfigStat = stat;
        log('🔄 Config changed, reloading...');
        config.reload();
        // In future: restart pollers on config change
      }
    } catch {}
  }, 10000);

  // ── Health endpoint (pipe-based) ──────────────────────────
  process.on('SIGUSR1', () => {
    log(`📊 Status: ${pollers.length} poller(s) running`);
    for (const p of pollers) {
      log(`  - ${p.constructor.name}: ${p.isRunning() ? '✅ running' : '❌ stopped'}`);
    }
  });

  process.on('SIGTERM', () => {
    log('🛑 Shutting down...');
    for (const p of pollers) p.stop();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    log('🛑 Shutting down via SIGINT...');
    for (const p of pollers) p.stop();
    process.exit(0);
  });

  log(`✅ Daemon ready. PID: ${process.pid}. Send SIGUSR1 for status.`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
