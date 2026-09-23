import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ConfigManager } from '../config.js';

function makeConfig() {
  const dir = fs.mkdtempSync(path.join(process.cwd(), '.daemon-config-test-'));
  const file = path.join(dir, 'gateway.json');
  const messages = [];
  const logger = {
    log: (...args) => messages.push(args.join(' ')),
    error: (...args) => messages.push(args.join(' ')),
  };
  return { dir, file, messages, logger };
}

test('reload applies a valid config and preserves it when a write is invalid', () => {
  const fixture = makeConfig();
  try {
    fs.writeFileSync(fixture.file, JSON.stringify({
      telegram: { enabled: true, botToken: 'secret-token' },
    }));
    const config = new ConfigManager(fixture.file, fixture.logger);
    assert.equal(config.get('telegram.enabled'), true);

    fs.writeFileSync(fixture.file, '{');
    assert.equal(config.reload(), false);
    assert.equal(config.get('telegram.botToken'), 'secret-token');

    fs.writeFileSync(fixture.file, JSON.stringify({
      telegram: { enabled: false },
    }));
    assert.equal(config.reload(), true);
    assert.equal(config.get('telegram.enabled'), false);
  } finally {
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test('missing config creates safe bridge-only defaults', () => {
  const fixture = makeConfig();
  try {
    const config = new ConfigManager(path.join(fixture.dir, 'missing.json'), fixture.logger);
    assert.equal(config.get('telegram.enabled'), false);
    assert.equal(config.get('telegram.mode'), 'bridge');
    assert.equal(JSON.parse(fs.readFileSync(path.join(fixture.dir, 'missing.json'))).llm.apiKey, '');
  } finally {
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
});
