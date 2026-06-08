import { describe, it, expect, vi, beforeEach } from 'vitest';
import ToolboxService from '../ToolboxService';

describe('ToolboxService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('wikipedia', () => {
    const mockSearchResponse = {
      query: {
        search: [{ pageid: 123, title: 'Test Page' }],
      },
    };

    const mockDetailResponse = {
      query: {
        pages: {
          '123': {
            title: 'Test Page',
            extract: 'This is a test page about testing.',
            thumbnail: { source: 'https://example.com/thumb.jpg' },
          },
        },
      },
    };

    beforeEach(() => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes('action=query&list=search')) {
          return new Response(JSON.stringify(mockSearchResponse));
        }
        if (urlStr.includes('action=query&prop=extracts|pageimages')) {
          return new Response(JSON.stringify(mockDetailResponse));
        }
        return new Response('{}', { status: 404 });
      });
    });

    it('returns WikipediaResult for a valid query', async () => {
      const result = await ToolboxService.wikipedia('test');
      expect(result.title).toBe('Test Page');
      expect(result.extract).toBe('This is a test page about testing.');
      expect(result.url).toBe('https://en.wikipedia.org/wiki/Test_Page');
      expect(result.thumbnail).toBe('https://example.com/thumb.jpg');
    });

    it('respects maxChars parameter', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes('action=query&list=search')) {
          return new Response(JSON.stringify(mockSearchResponse));
        }
        return new Response(JSON.stringify(mockDetailResponse));
      });

      const result = await ToolboxService.wikipedia('test', 10);
      expect(result.extract.length).toBeLessThanOrEqual(10);
    });

    it('throws on failed search request', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
      await expect(ToolboxService.wikipedia('test')).rejects.toThrow('Wikipedia search failed');
    });

    it('throws when no results found', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ query: { search: [] } }))
      );
      await expect(ToolboxService.wikipedia('nonexistent')).rejects.toThrow(/No Wikipedia results/);
    });
  });

  describe('weather', () => {
    const mockWeatherResponse = {
      current_condition: [{
        weatherDesc: [{ value: 'Sunny' }],
        temp_C: '25',
        FeelsLikeC: '27',
        humidity: '60',
        windspeedKmph: '15',
        winddir16Point: 'NE',
      }],
      nearest_area: [{
        areaName: [{ value: 'London' }],
      }],
    };

    it('returns WeatherResult for a valid location', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockWeatherResponse))
      );

      const result = await ToolboxService.weather('London');
      expect(result.location).toBe('London');
      expect(result.condition).toBe('Sunny');
      expect(result.temp).toBe('25°C');
      expect(result.feelsLike).toBe('27°C');
      expect(result.humidity).toBe('60%');
      expect(result.wind).toContain('15');
      expect(result.wind).toContain('NE');
    });

    it('throws on fetch failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
      await expect(ToolboxService.weather('Nowhere')).rejects.toThrow('Weather fetch failed');
    });
  });

  describe('define', () => {
    const mockDictResponse = [{
      word: 'test',
      phonetic: '/test/',
      meanings: [{
        partOfSpeech: 'noun',
        definitions: [
          { definition: 'A procedure for critical evaluation.', example: 'Put it to the test.' },
        ],
      }],
    }];

    it('returns DictResult for a valid word', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockDictResponse))
      );

      const result = await ToolboxService.define('test');
      expect(result.word).toBe('test');
      expect(result.phonetic).toBe('/test/');
      expect(result.meanings).toHaveLength(1);
      expect(result.meanings[0].partOfSpeech).toBe('noun');
      expect(result.meanings[0].definitions[0].definition).toBe('A procedure for critical evaluation.');
    });

    it('throws 404 for unknown word', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not Found', { status: 404 }));
      await expect(ToolboxService.define('xyzzy')).rejects.toThrow(/No definition found/);
    });

    it('limits definitions to 3 per meaning', async () => {
      const manyDefs = {
        word: 'test',
        meanings: [{
          partOfSpeech: 'noun',
          definitions: Array.from({ length: 10 }, (_, i) => ({
            definition: `Definition ${i + 1}`,
          })),
        }],
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify([manyDefs]))
      );

      const result = await ToolboxService.define('test');
      expect(result.meanings[0].definitions).toHaveLength(3);
    });
  });

  it('is a singleton', () => {
    expect(ToolboxService).toBeDefined();
    expect(ToolboxService.wikipedia).toBeInstanceOf(Function);
    expect(ToolboxService.weather).toBeInstanceOf(Function);
    expect(ToolboxService.define).toBeInstanceOf(Function);
    expect(ToolboxService.getPageMetadata).toBeInstanceOf(Function);
  });
});
