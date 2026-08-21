import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../idb-storage', () => ({
  idbStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

import { useMCPStore } from '../useMCPStore';

describe('useMCPStore', () => {
  beforeEach(() => {
    useMCPStore.setState({ servers: [], connections: {} });
  });

  describe('addServer', () => {
    it('adds server with generated id', () => {
      const id = useMCPStore.getState().addServer({
        name: 'My Server', transport: 'sse', url: 'http://localhost:3000',
        command: '', args: [], enabled: true, autoConnect: false,
      });
      expect(id).toBeDefined();
      expect(useMCPStore.getState().servers).toHaveLength(1);
      expect(useMCPStore.getState().servers[0].name).toBe('My Server');
    });
  });

  describe('removeServer', () => {
    it('removes server and its connection state', () => {
      const id = useMCPStore.getState().addServer({
        name: 'Test', transport: 'sse', url: '', command: '', args: [],
        enabled: true, autoConnect: false,
      });
      useMCPStore.getState().setConnectionState(id, { status: 'connected', toolCount: 5 });
      useMCPStore.getState().removeServer(id);
      expect(useMCPStore.getState().servers).toHaveLength(0);
      expect(useMCPStore.getState().connections[id]).toBeUndefined();
    });
  });

  describe('updateServer', () => {
    it('updates server fields', () => {
      const id = useMCPStore.getState().addServer({
        name: 'Old Name', transport: 'sse', url: '', command: '', args: [],
        enabled: true, autoConnect: false,
      });
      useMCPStore.getState().updateServer(id, { name: 'New Name', enabled: false });
      expect(useMCPStore.getState().getServer(id)?.name).toBe('New Name');
      expect(useMCPStore.getState().getServer(id)?.enabled).toBe(false);
    });
  });

  describe('getServer', () => {
    it('returns server by id', () => {
      const id = useMCPStore.getState().addServer({
        name: 'Test', transport: 'stdio', url: '', command: 'node', args: [],
        enabled: true, autoConnect: true,
      });
      const server = useMCPStore.getState().getServer(id);
      expect(server?.transport).toBe('stdio');
    });

    it('returns undefined for non-existent id', () => {
      expect(useMCPStore.getState().getServer('ghost')).toBeUndefined();
    });
  });

  describe('setConnectionState', () => {
    it('sets connection state for a server', () => {
      const id = useMCPStore.getState().addServer({
        name: 'Test', transport: 'sse', url: '', command: '', args: [],
        enabled: true, autoConnect: false,
      });
      useMCPStore.getState().setConnectionState(id, { status: 'connected', toolCount: 3 });
      expect(useMCPStore.getState().connections[id]).toEqual({ status: 'connected', toolCount: 3 });
    });

    it('sets error state', () => {
      const id = useMCPStore.getState().addServer({
        name: 'Test', transport: 'sse', url: '', command: '', args: [],
        enabled: true, autoConnect: false,
      });
      useMCPStore.getState().setConnectionState(id, { status: 'error', error: 'Connection refused', toolCount: 0 });
      expect(useMCPStore.getState().connections[id].status).toBe('error');
      expect(useMCPStore.getState().connections[id].error).toBe('Connection refused');
    });
  });

  describe('setTokens / clearTokens', () => {
    it('stores OAuth tokens', () => {
      const id = useMCPStore.getState().addServer({
        name: 'OAuth Server', transport: 'sse', url: '', command: '', args: [],
        enabled: true, autoConnect: false, oauthUrl: 'https://auth.example.com',
      });
      useMCPStore.getState().setTokens(id, { accessToken: 'at-123', refreshToken: 'rt-456', expiresIn: 3600 });
      const server = useMCPStore.getState().getServer(id);
      expect(server?.accessToken).toBe('at-123');
      expect(server?.refreshToken).toBe('rt-456');
    });

    it('clearTokens removes tokens', () => {
      const id = useMCPStore.getState().addServer({
        name: 'Test', transport: 'sse', url: '', command: '', args: [],
        enabled: true, autoConnect: false,
      });
      useMCPStore.getState().setTokens(id, { accessToken: 'at-123' });
      useMCPStore.getState().clearTokens(id);
      expect(useMCPStore.getState().getServer(id)?.accessToken).toBeUndefined();
    });
  });
});
