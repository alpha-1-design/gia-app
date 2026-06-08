export interface WikipediaResult {
  title: string;
  extract: string;
  url: string;
  thumbnail?: string;
}

export interface WeatherResult {
  location: string;
  condition: string;
  temp: string;
  feelsLike: string;
  humidity: string;
  wind: string;
}

export interface DictResult {
  word: string;
  phonetic: string;
  meanings: { partOfSpeech: string; definitions: { definition: string; example?: string }[] }[];
}

export interface QRResult {
  svg: string;
}

class ToolboxService {
  async wikipedia(query: string, maxChars = 5000): Promise<WikipediaResult> {
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=1`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!searchRes.ok) throw new Error(`Wikipedia search failed: ${searchRes.status}`);
    const searchData = await searchRes.json();
    const page = searchData.query?.search?.[0];
    if (!page) throw new Error(`No Wikipedia results for "${query}"`);

    const detailRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro&explaintext&exlimit=1&pithumbsize=300&pageids=${page.pageid}&format=json&origin=*`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!detailRes.ok) throw new Error(`Wikipedia detail failed: ${detailRes.status}`);
    const detailData = await detailRes.json();
    const pages = detailData.query?.pages;
    if (!pages) throw new Error('No page data');
    const pageData = Object.values(pages)[0] as { title?: string; extract?: string; thumbnail?: { source?: string } };

    return {
      title: pageData.title || page.title,
      extract: (pageData.extract || '').slice(0, maxChars),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageData.title?.replace(/ /g, '_') || page.title.replace(/ /g, '_'))}`,
      thumbnail: pageData.thumbnail?.source,
    };
  }

  async weather(location: string): Promise<WeatherResult> {
    const res = await fetch(
      `https://wttr.in/${encodeURIComponent(location)}?format=j1`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
    const data = await res.json();
    const cc = data.current_condition?.[0];
    if (!cc) throw new Error('No weather data');
    return {
      location: data.nearest_area?.[0]?.areaName?.[0]?.value || location,
      condition: cc.weatherDesc?.[0]?.value || 'Unknown',
      temp: `${cc.temp_C}°C`,
      feelsLike: `${cc.FeelsLikeC}°C`,
      humidity: `${cc.humidity}%`,
      wind: `${cc.windspeedKmph} km/h ${cc.winddir16Point || ''}`,
    };
  }

  async define(word: string): Promise<DictResult> {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error(res.status === 404 ? `No definition found for "${word}"` : `Dictionary error: ${res.status}`);
    const data = await res.json();
    const entry = data[0];
    return {
      word: entry.word,
      phonetic: entry.phonetic || entry.phonetics?.find((p: { text?: string }) => p.text)?.text || '',
      meanings: entry.meanings?.map((m: { partOfSpeech: string; definitions: { definition: string; example?: string }[] }) => ({
        partOfSpeech: m.partOfSpeech,
        definitions: m.definitions?.slice(0, 3).map((d: { definition: string; example?: string }) => ({
          definition: d.definition,
          example: d.example,
        })) || [],
      })) || [],
    };
  }

  async getPageMetadata(url: string): Promise<{ title: string; description: string; image: string; siteName: string }> {
    const wf = (await import('./WebFetchService')).default;
    const page = await wf.fetch(url, { format: 'markdown', maxChars: 1000 });
    return {
      title: page.title,
      description: page.excerpt,
      image: '',
      siteName: page.siteName,
    };
  }
}

export default new ToolboxService();
