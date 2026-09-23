/**
 * Config manager for the GIA gateway daemon.
 * Reads from ~/.gia/gateway.json — the same file the GIA app syncs to.
 */
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_CONFIG = Object.freeze({
  telegram: { enabled: false, mode: 'bridge' },
  discord: { enabled: false },
  llm: {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
  },
  logLevel: 'info',
});

export class ConfigManager {
  constructor(configPath, logger = console) {
    this.path = configPath;
    this.logger = logger;
    this.data = {};
    this.load(true);
  }

  load(initial = false) {
    try {
      const raw = fs.readFileSync(this.path, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('config root must be an object');
      }
      this.data = parsed;
      this.logger.log(`[config] Loaded ${Object.keys(this.data).length} top-level keys`);
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') {
        this.logger.log(`[config] No config file at ${this.path}, creating defaults`);
        this.data = structuredClone(DEFAULT_CONFIG);
        this.save();
        return true;
      } else {
        // Never replace a known-good config with an incomplete parse during a
        // concurrent/partial write. On startup, use safe defaults in memory.
        this.logger.error(`[config] Error loading config: ${err.message}`);
        if (initial) this.data = structuredClone(DEFAULT_CONFIG);
        return false;
      }
    }
  }

  reload() {
    return this.load(false);
  }

  save() {
    try {
      const dir = path.dirname(this.path);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2));
    } catch (err) {
      this.logger.error(`[config] Error saving config: ${err.message}`);
    }
  }

  get(key) {
    const parts = key.split('.');
    let val = this.data;
    for (const p of parts) {
      if (val === null || val === undefined || typeof val !== 'object') return undefined;
      val = val[p];
    }
    return val;
  }

  set(key, value) {
    const parts = key.split('.');
    let obj = this.data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    this.save();
  }

  getAll() {
    return { ...this.data };
  }
}
