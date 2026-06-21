export interface BibleVerse {
  reference: string;
  text: string;
  translation: string;
}

export interface Devotional {
  title: string;
  verse: BibleVerse;
  message: string;
  prayer: string;
}

const BIBLE_API = 'https://bible-api.com';
const OURMANNA_API = 'https://beta.ourmanna.com/api/v1/get';

class BibleService {
  private static instance: BibleService;

  static getInstance(): BibleService {
    if (!this.instance) this.instance = new BibleService();
    return this.instance;
  }

  async getVerseOfDay(): Promise<BibleVerse> {
    const res = await fetch(`${OURMANNA_API}?format=json`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return {
      reference: data.verse?.details?.reference || 'Unknown',
      text: data.verse?.details?.text || '',
      translation: data.verse?.details?.version || 'KJV',
    };
  }

  async searchVerse(query: string, translation: string = 'kjv'): Promise<BibleVerse[]> {
    const res = await fetch(`${BIBLE_API}/?search=${encodeURIComponent(query)}&translation=${translation}`, {
      signal: AbortSignal.timeout(10000),
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      return [{
        reference: 'Search unavailable',
        text: 'bible-api.com search only returns web pages. Try a specific verse reference instead (e.g. "John 3:16").',
        translation,
      }];
    }
    const data = await res.json();
    if (!data.verses) return [];
    return data.verses.map((v: { reference: string; text: string }) => ({
      reference: v.reference,
      text: v.text,
      translation: data.translation || translation,
    }));
  }

  async getChapter(book: string, chapter: number, translation: string = 'kjv'): Promise<BibleVerse[]> {
    const res = await fetch(`${BIBLE_API}/${encodeURIComponent(book)}+${chapter}?translation=${translation}`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (!data.verses) return [];
    return data.verses.map((v: { reference: string; text: string }) => ({
      reference: v.reference,
      text: v.text,
      translation: data.translation || translation,
    }));
  }

  getDailyDevotional(): Devotional {
    const today = new Date();
    const verses = [
      { ref: 'Philippians 4:13', text: 'I can do all things through Christ who strengthens me.' },
      { ref: 'Jeremiah 29:11', text: 'For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.' },
      { ref: 'Isaiah 40:31', text: 'But those who hope in the Lord will renew their strength. They will soar on wings like eagles.' },
      { ref: 'Psalm 23:1-6', text: 'The Lord is my shepherd; I shall not want.' },
      { ref: 'Joshua 1:9', text: 'Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.' },
      { ref: 'Proverbs 3:5-6', text: 'Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.' },
      { ref: 'Romans 8:28', text: 'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.' },
    ];
    const verse = verses[today.getDate() % verses.length];
    return {
      title: `Daily Devotion — ${today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
      verse: { reference: verse.ref, text: verse.text, translation: 'NIV' },
      message: `Take a moment to reflect on ${verse.ref}. God's Word is alive and active. Let this verse guide your thoughts and actions today.`,
      prayer: `Lord, thank You for Your Word. Help me to live out ${verse.ref} in my life today. Amen.`,
    };
  }
}

export default BibleService.getInstance();
