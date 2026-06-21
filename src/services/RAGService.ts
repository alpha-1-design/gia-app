import { logger } from '../utils/logger';
import LocalAI from './LocalAI';

const DB_NAME = 'gia-rag';
const DB_VERSION = 1;

export interface RAGDocument {
  id: string;
  title: string;
  createdAt: number;
  charCount: number;
  chunkCount: number;
}

export interface RAGChunk {
  docId: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
}

export interface RAGSearchResult {
  docId: string;
  title: string;
  chunkIndex: number;
  text: string;
  score: number;
}

const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 64;

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

function chunkText(text: string): string[] {
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if (current.length + s.length > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim());
      const overlap = current.slice(-CHUNK_OVERLAP);
      current = overlap + ' ' + s;
    } else {
      current += ' ' + s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(c => c.length > 20);
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('docs')) {
        db.createObjectStore('docs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('chunks')) {
        const store = db.createObjectStore('chunks', { keyPath: 'id', autoIncrement: true });
        store.createIndex('docId', 'docId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

class RAGService {
  private static instance: RAGService;
  static getInstance() {
    if (!this.instance) this.instance = new RAGService();
    return this.instance;
  }

  private dbPromise: Promise<IDBDatabase> | null = null;

  private async db(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = getDB();
    return this.dbPromise;
  }

  async indexDocument(id: string, title: string, text: string): Promise<RAGDocument> {
    const db = await this.db();
    const chunks = chunkText(text);
    const embeddings = await Promise.all(
      chunks.map(chunk => LocalAI.embed(chunk))
    );

    const doc: RAGDocument = {
      id, title, createdAt: Date.now(),
      charCount: text.length, chunkCount: chunks.length,
    };

    const tx = db.transaction(['docs', 'chunks'], 'readwrite');
    tx.objectStore('docs').put(doc);

    for (let i = 0; i < chunks.length; i++) {
      tx.objectStore('chunks').put({
        docId: id, chunkIndex: i,
        text: chunks[i], embedding: embeddings[i].embedding,
      });
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    logger.log(`[RAG] Indexed "${title}" — ${chunks.length} chunks, ${text.length} chars`);
    return doc;
  }

  async search(query: string, topK: number = 5, namespace?: string): Promise<RAGSearchResult[]> {
    const db = await this.db();
    const queryEmbed = await LocalAI.embed(query);
    const vector = queryEmbed.embedding;

    const chunks: RAGChunk[] = await new Promise((resolve, reject) => {
      const tx = db.transaction('chunks', 'readonly');
      const req = tx.objectStore('chunks').getAll();
      req.onsuccess = () => {
        let all = req.result as RAGChunk[];
        if (namespace) all = all.filter(c => c.docId.startsWith(namespace));
        resolve(all);
      };
      req.onerror = () => reject(req.error);
    });

    const docs: Map<string, string> = await new Promise((resolve, reject) => {
      const tx = db.transaction('docs', 'readonly');
      const req = tx.objectStore('docs').getAll();
      req.onsuccess = () => {
        const map = new Map<string, string>();
        for (const d of req.result) {
          if (!namespace || d.id.startsWith(namespace)) map.set(d.id, d.title);
        }
        resolve(map);
      };
      req.onerror = () => reject(req.error);
    });

    const scored = chunks.map(c => ({
      ...c,
      score: cosineSimilarity(vector, c.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(c => ({
      docId: c.docId,
      title: docs.get(c.docId) || c.docId,
      chunkIndex: c.chunkIndex,
      text: c.text,
      score: c.score,
    }));
  }

  async listDocuments(namespace?: string): Promise<RAGDocument[]> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('docs', 'readonly');
      const req = tx.objectStore('docs').getAll();
      req.onsuccess = () => {
        let all = req.result as RAGDocument[];
        if (namespace) all = all.filter(d => d.id.startsWith(namespace));
        resolve(all);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteDocument(id: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(['docs', 'chunks'], 'readwrite');
    tx.objectStore('docs').delete(id);
    const index = tx.objectStore('chunks').index('docId');
    const req = index.openCursor(IDBKeyRange.only(id));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getStats(): Promise<{ docCount: number; chunkCount: number }> {
    const db = await this.db();
    const docs = await new Promise<RAGDocument[]>((resolve, reject) => {
      const tx = db.transaction('docs', 'readonly');
      const req = tx.objectStore('docs').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const chunks = await new Promise<RAGChunk[]>((resolve, reject) => {
      const tx = db.transaction('chunks', 'readonly');
      const req = tx.objectStore('chunks').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return { docCount: docs.length, chunkCount: chunks.length };
  }
}

export default RAGService.getInstance();
