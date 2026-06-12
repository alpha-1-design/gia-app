/**
 * Config manager for the GIA gateway daemon.
 * Reads from ~/.gia/gateway.json — the same file the GIA app syncs to.
 */
import fs from 'node:fs';

export class ConfigManager {
  constructor(configPath) {
    this.path = configPath;
    this.data = {};
    this.load();
  }

  load() {
    try {
      const raw = fs.readFileSync(this.path, 'utf-8');
      this.data = JSON.parse(raw);
      console.log(`[config] Loaded ${Object.keys(this.data).length} top-level keys`);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log(`[config] No config file at ${this.path}, creating defaults`);
        this.data = {
          telegram: { enabled: false },
          discord: { enabled: false },
          llm: {
            provider: 'openai',
            model: 'gpt-4o',
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1',
          },
          logLevel: 'info',
        };
        this.save();
      } else {
        console.error(`[config] Error loading config: ${err.message}`);
        this.data = {};
      }
    }
  }

  reload() {
    this.load();
  }

  save() {
    try {
      const dir = this.path.substring(0, this.path.lastIndexOf('/'));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error(`[config] Error saving config: ${err.message}`);
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
