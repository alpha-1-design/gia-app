import { describe, it, expect, vi } from 'vitest';
import { logger } from '../logger';

describe('logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('has error method', () => {
    expect(logger.error).toBeInstanceOf(Function);
  });

  it('has warn method', () => {
    expect(logger.warn).toBeInstanceOf(Function);
  });

  it('has info method', () => {
    expect(logger.info).toBeInstanceOf(Function);
  });

  it('has log method', () => {
    expect(logger.log).toBeInstanceOf(Function);
  });

  it('calls console.log when in dev mode', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.log('test message');
    expect(spy).toHaveBeenCalledWith('test message');
    spy.mockRestore();
  });

  it('calls console.error when in dev mode', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('error message');
    expect(spy).toHaveBeenCalledWith('error message');
    spy.mockRestore();
  });

  it('calls console.warn when in dev mode', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('warn message');
    expect(spy).toHaveBeenCalledWith('warn message');
    spy.mockRestore();
  });

  it('calls console.info when in dev mode', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('info message');
    expect(spy).toHaveBeenCalledWith('info message');
    spy.mockRestore();
  });

  it('handles multiple arguments', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.log('a', 'b', 'c');
    expect(spy).toHaveBeenCalledWith('a', 'b', 'c');
    spy.mockRestore();
  });
});
