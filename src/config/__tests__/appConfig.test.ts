import { describe, it, expect, beforeEach } from 'vitest';
import { appConfig, prefOrDefault } from '../appConfig';

describe('appConfig', () => {
  it('loads defaults from config.json', () => {
    expect(appConfig.app.name).toBe('GIA');
    expect(appConfig.ui.floatingOrbDefault).toBe(false);
    expect(appConfig.ui.reduceMotionDefault).toBe(false);
    expect(appConfig.model.defaultLocalModel).toMatch(/^onnx-community\//);
  });

  describe('prefOrDefault', () => {
    beforeEach(() => localStorage.clear());

    it('uses the stored value when present', () => {
      localStorage.setItem('k', 'true');
      expect(prefOrDefault('k', false)).toBe(true);
      localStorage.setItem('k', 'false');
      expect(prefOrDefault('k', true)).toBe(false);
    });

    it('falls back to the config default when nothing is stored', () => {
      expect(prefOrDefault('k', true)).toBe(true);
      expect(prefOrDefault('k', false)).toBe(false);
    });
  });
});