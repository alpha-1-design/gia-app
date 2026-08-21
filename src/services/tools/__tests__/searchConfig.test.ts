import { describe, it, expect, vi, beforeEach } from 'vitest';

const setSearchProviderKeyMock = vi.fn();
const setSearchProviderEnabledMock = vi.fn();
const setActiveSearchProviderMock = vi.fn();
const searchState = {
  providers: {
    exa: { apiKey: '', enabled: false },
    browserless: { apiKey: '', enabled: false },
  },
  activeSearchProvider: 'none' as string,
  setSearchProviderKey: (...args: unknown[]) => setSearchProviderKeyMock(...args),
  setSearchProviderEnabled: (...args: unknown[]) => setSearchProviderEnabledMock(...args),
  setActiveSearchProvider: (...args: unknown[]) => setActiveSearchProviderMock(...args),
};

vi.mock('../../../store/useSearchStore', () => ({
  useSearchStore: {
    getState: () => searchState,
  },
}));

vi.mock('../../../services/ToolRegistry', () => ({
  default: { register: vi.fn() },
}));

import { searchConfigTools, registerSearchConfigTools } from '../searchConfig';
import ToolRegistry from '../../../services/ToolRegistry';

const configureTool = searchConfigTools.find(t => t.id === 'search_provider_configure')!;
const statusTool = searchConfigTools.find(t => t.id === 'search_provider_status')!;

describe('searchConfig tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchState.providers.exa = { apiKey: '', enabled: false };
    searchState.providers.browserless = { apiKey: '', enabled: false };
    searchState.activeSearchProvider = 'none';
  });

  describe('search_provider_configure', () => {
    it('configures Exa provider', async () => {
      const result = await configureTool.execute({ provider: 'exa', apiKey: 'exa-key-123' });
      expect(result.success).toBe(true);
      expect(result.content).toContain('Exa Search');
      expect(setSearchProviderKeyMock).toHaveBeenCalledWith('exa', 'exa-key-123');
      expect(setSearchProviderEnabledMock).toHaveBeenCalledWith('exa', true);
      expect(setActiveSearchProviderMock).toHaveBeenCalledWith('exa');
    });

    it('configures Browserless provider', async () => {
      const result = await configureTool.execute({ provider: 'browserless', apiKey: 'bl-key-456' });
      expect(result.success).toBe(true);
      expect(result.content).toContain('Browserless');
      expect(setSearchProviderKeyMock).toHaveBeenCalledWith('browserless', 'bl-key-456');
    });

    it('rejects invalid provider name', async () => {
      const result = await configureTool.execute({ provider: 'serpapi', apiKey: 'key' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('exa');
    });

    it('rejects empty apiKey', async () => {
      const result = await configureTool.execute({ provider: 'exa', apiKey: '' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('apiKey');
    });

    it('sets the same store that Settings screen reads from', async () => {
      await configureTool.execute({ provider: 'exa', apiKey: 'ai-key' });
      expect(setSearchProviderKeyMock).toHaveBeenCalledWith('exa', 'ai-key');
      // The store method delegates to the same function the mock verifies
      expect(typeof searchState.setSearchProviderKey).toBe('function');
    });
  });

  describe('search_provider_status', () => {
    it('reports not configured when no keys', async () => {
      const result = await statusTool.execute({});
      expect(result.success).toBe(true);
      expect(result.content).toContain('not configured');
    });

    it('reports configured when key is set and enabled', async () => {
      searchState.providers.exa = { apiKey: 'exa-key', enabled: true };
      searchState.activeSearchProvider = 'exa';
      const result = await statusTool.execute({});
      expect(result.content).toContain('configured & active');
    });

    it('reports key saved but not enabled', async () => {
      searchState.providers.browserless = { apiKey: 'bl-key', enabled: false };
      const result = await statusTool.execute({});
      expect(result.content).toContain('key saved, not enabled');
    });

    it('shows fallback when no active provider', async () => {
      searchState.activeSearchProvider = 'none';
      const result = await statusTool.execute({});
      expect(result.content).toContain('fallback');
    });

    it('shows active provider name when set', async () => {
      searchState.providers.exa = { apiKey: 'key', enabled: true };
      searchState.activeSearchProvider = 'exa';
      const result = await statusTool.execute({});
      expect(result.content).toContain('exa');
    });
  });

  describe('registerSearchConfigTools', () => {
    it('registers both tools with ToolRegistry', () => {
      registerSearchConfigTools();
      expect(ToolRegistry.register).toHaveBeenCalledTimes(2);
    });
  });
});
