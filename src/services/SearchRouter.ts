import { useSearchStore } from '../store/useSearchStore';
import { exaSearch } from './search/ExaSearch';
import { browserlessIO } from './search/BrowserlessIO';
import { logger } from '../utils/logger';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface ScrapeResult {
  url: string;
  title: string;
  content: string;
  source: string;
}

class SearchRouter {
  private static instance: SearchRouter;

  static getInstance() {
    if (!this.instance) this.instance = new SearchRouter();
    return this.instance;
  }

  async search(query: string): Promise<SearchResult[]> {
    const store = useSearchStore.getState();
    if (!store.hasActiveProvider()) return [];

    const apiKey = store.getActiveKey();
    const provider = store.activeSearchProvider;

    switch (provider) {
      case 'exa': {
        try {
          return await exaSearch.search(query, apiKey);
        } catch (e) {
          logger.warn('[SearchRouter] Exa search failed:', e);
          return [];
        }
      }
      case 'browserless': {
        try {
          return await browserlessIO.search(query, apiKey);
        } catch (e) {
          logger.warn('[SearchRouter] Browserless search failed:', e);
          return [];
        }
      }
      default:
        return [];
    }
  }

  async fetch(url: string): Promise<ScrapeResult | null> {
    const store = useSearchStore.getState();
    if (!store.hasActiveProvider()) return null;

    const apiKey = store.getActiveKey();
    const provider = store.activeSearchProvider;

    switch (provider) {
      case 'exa': {
        try {
          const result = await exaSearch.fetchContents(url, apiKey);
          return { url, title: result.title, content: result.content, source: 'exa' };
        } catch (e) {
          logger.warn('[SearchRouter] Exa fetch failed:', e);
          return null;
        }
      }
      case 'browserless': {
        try {
          return await browserlessIO.scrape(url, apiKey);
        } catch (e) {
          logger.warn('[SearchRouter] Browserless fetch failed:', e);
          return null;
        }
      }
      default:
        return null;
    }
  }

  async screenshot(url: string): Promise<string | null> {
    const store = useSearchStore.getState();
    if (store.activeSearchProvider !== 'browserless' || !store.providers.browserless.enabled) return null;

    try {
      return await browserlessIO.screenshot(url, store.providers.browserless.apiKey);
    } catch (e) {
      logger.warn('[SearchRouter] Browserless screenshot failed:', e);
      return null;
    }
  }
}

export default SearchRouter.getInstance();
