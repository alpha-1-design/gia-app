/**
 * GIA Gateway Daemon
 * 
 * Runs 24/7 in proot+Alpine terminal. Provides a Telegram bridge.
 * Reads config from ~/.gia/gateway.json (shared with the GIA app).
 * 
 * Usage:
 *   cd daemon && npm start
 */
import fs from 'node:fs';
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

  const config = new ConfigManager(CONFIG_PATH, { log: (...args) => log(...args), error: (...args) => log(...args) });
  const pollers = [];
  let telegram = null;

  const stopTelegram = () => {
    if (!telegram) return;
    telegram.stop();
    const index = pollers.indexOf(telegram);
    if (index !== -1) pollers.splice(index, 1);
    telegram = null;
  };

  const reconcileTelegram = () => {
    const token = config.get('telegram.botToken');
    const enabled = config.get('telegram.enabled') !== false;
    const mode = config.get('telegram.mode') || 'bridge';
    if (!token || !enabled) {
      if (telegram) log('Telegram: stopping (disabled or not configured)');
      stopTelegram();
      if (!token) log('⚠️ Telegram not configured — set "telegram.botToken" in gateway.json');
      return;
    }
    if (mode !== 'bridge') {
      log(`⚠️ Telegram mode "${mode}" is unsupported; only bridge mode is available`);
      stopTelegram();
      return;
    }
    stopTelegram();
    log('Telegram: starting bridge poller (no LLM routing)');
    const tg = new TelegramPoller(token, config.get('telegram.channelId'));
    tg.onMessage(async (msg) => {
      log(`📩 Telegram message from ${msg.from?.username || msg.from?.id}: ${msg.text?.slice(0, 100)}`);
      await tg.sendMessage(msg.chat.id, 'GIA received your Telegram message. This daemon currently sends acknowledgements only; LLM routing is not enabled.');
    });
    tg.onError((err) => log(`❌ Telegram error: ${err.message}`));
    tg.start();
    telegram = tg;
    pollers.push(telegram);
    log('✅ Telegram poller started');
  };

  reconcileTelegram();

  // ── Watch config for changes ──────────────────────────────
  let lastConfigSignature = null;
  try {
    const stat = fs.statSync(CONFIG_PATH);
    lastConfigSignature = `${stat.mtimeMs}:${stat.size}`;
  } catch {}
  
  setInterval(() => {
    try {
      const stat = fs.statSync(CONFIG_PATH);
      const signature = `${stat.mtimeMs}:${stat.size}`;
      if (signature !== lastConfigSignature) {
        log('🔄 Config changed, reloading...');
        if (config.reload()) {
          lastConfigSignature = signature;
          reconcileTelegram();
          log('✅ Config reloaded');
        } else {
          log('⚠️ Config reload rejected; keeping the last valid configuration');
        }
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
