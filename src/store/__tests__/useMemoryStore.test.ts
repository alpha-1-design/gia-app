import { describe, it, expect, beforeEach, vi } from 'vitest';

let idCounter = 0;

vi.mock('../idb-storage', () => {
  const store = new Map<string, string>();
  return {
    idbStorage: {
      getItem: vi.fn(async (name: string) => store.get(name) ?? null),
      setItem: vi.fn(async (name: string, value: string) => { store.set(name, value); }),
      removeItem: vi.fn(async (name: string) => { store.delete(name); }),
    },
  };
});

vi.mock('../../utils/id', () => ({
  genId: vi.fn(() => `test-id-${++idCounter}`),
}));

const { useMemoryStore } = await import('../useMemoryStore');
type MemEntry = import('../useMemoryStore').MemoryEntry;

function makeEntry(overrides: Partial<MemEntry> = {}): MemEntry {
  return {
    id: overrides.id ?? 'test-id-1',
    key: overrides.key ?? 'test_key',
    value: overrides.value ?? 'test value',
    category: overrides.category ?? 'fact',
    tier: overrides.tier ?? 'semantic',
    confidence: overrides.confidence ?? 0.9,
    timestamp: overrides.timestamp ?? 1000,
    lastAccessed: overrides.lastAccessed ?? 1000,
  };
}

describe('useMemoryStore', () => {
  beforeEach(() => {
    idCounter = 0;
    useMemoryStore.setState({ memories: [] });
  });

  describe('addMemory', () => {
    it('adds a new memory entry', () => {
      useMemoryStore.getState().addMemory({
        key: 'user_name',
        value: 'Alice',
        category: 'profile',
        tier: 'semantic',
        confidence: 0.95,
      });

      const { memories } = useMemoryStore.getState();
      expect(memories).toHaveLength(1);
      expect(memories[0].key).toBe('user_name');
      expect(memories[0].value).toBe('Alice');
      expect(memories[0].id).toBe('test-id-1');
    });

    it('deduplicates by key — updates existing entry', () => {
      useMemoryStore.getState().addMemory({
        key: 'user_name', value: 'Alice', category: 'profile', tier: 'semantic', confidence: 0.9,
      });
      useMemoryStore.getState().addMemory({
        key: 'user_name', value: 'Alice Smith', category: 'profile', tier: 'semantic', confidence: 0.95,
      });

      const { memories } = useMemoryStore.getState();
      expect(memories).toHaveLength(1);
      expect(memories[0].value).toBe('Alice Smith');
    });

    it('keeps the higher confidence on dedup', () => {
      useMemoryStore.getState().addMemory({
        key: 'user_name', value: 'Alice', category: 'profile', tier: 'semantic', confidence: 0.5,
      });
      useMemoryStore.getState().addMemory({
        key: 'user_name', value: 'Alice Smith', category: 'profile', tier: 'semantic', confidence: 0.95,
      });

      const { memories } = useMemoryStore.getState();
      expect(memories[0].confidence).toBe(0.95);
    });

    it('sorts by confidence descending', () => {
      useMemoryStore.getState().addMemory({
        key: 'a', value: 'low', category: 'fact', tier: 'semantic', confidence: 0.3,
      });
      useMemoryStore.getState().addMemory({
        key: 'b', value: 'high', category: 'fact', tier: 'semantic', confidence: 0.9,
      });

      const { memories } = useMemoryStore.getState();
      expect(memories[0].key).toBe('b');
      expect(memories[1].key).toBe('a');
    });

    it('defaults tier to semantic', () => {
      useMemoryStore.getState().addMemory({
        key: 'test', value: 'val', category: 'fact', tier: 'semantic', confidence: 0.8,
      });

      const { memories } = useMemoryStore.getState();
      expect(memories[0].tier).toBe('semantic');
    });
  });

  describe('addMemories', () => {
    it('adds multiple entries at once', () => {
      useMemoryStore.getState().addMemories([
        { key: 'a', value: '1', category: 'fact', tier: 'semantic', confidence: 0.8 },
        { key: 'b', value: '2', category: 'fact', tier: 'working', confidence: 0.9 },
      ]);

      expect(useMemoryStore.getState().memories).toHaveLength(2);
    });

    it('deduplicates within batch', () => {
      useMemoryStore.getState().addMemories([
        { key: 'a', value: '1', category: 'fact', tier: 'semantic', confidence: 0.8 },
        { key: 'a', value: 'updated', category: 'fact', tier: 'working', confidence: 0.95 },
      ]);

      expect(useMemoryStore.getState().memories).toHaveLength(1);
      expect(useMemoryStore.getState().memories[0].value).toBe('updated');
    });
  });

  describe('getMemories', () => {
    it('returns all memories when no category filter', () => {
      useMemoryStore.getState().addMemories([
        { key: 'a', value: '1', category: 'fact', tier: 'semantic', confidence: 0.8 },
        { key: 'b', value: '2', category: 'preference', tier: 'semantic', confidence: 0.9 },
      ]);

      expect(useMemoryStore.getState().getMemories()).toHaveLength(2);
    });

    it('filters by category', () => {
      useMemoryStore.getState().addMemories([
        { key: 'a', value: '1', category: 'fact', tier: 'semantic', confidence: 0.8 },
        { key: 'b', value: '2', category: 'preference', tier: 'semantic', confidence: 0.9 },
      ]);

      const filtered = useMemoryStore.getState().getMemories('preference');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].key).toBe('b');
    });
  });

  describe('queryMemories', () => {
    it('finds memories by key match', () => {
      useMemoryStore.getState().addMemory({
        key: 'user_name', value: 'Alice', category: 'profile', tier: 'semantic', confidence: 0.9,
      });
      const results = useMemoryStore.getState().queryMemories('user_name');
      expect(results).toHaveLength(1);
    });

    it('finds memories by value match', () => {
      useMemoryStore.getState().addMemory({
        key: 'info', value: 'Alice likes pizza', category: 'preference', tier: 'semantic', confidence: 0.9,
      });
      const results = useMemoryStore.getState().queryMemories('pizza');
      expect(results).toHaveLength(1);
    });

    it('returns empty array for no match', () => {
      const results = useMemoryStore.getState().queryMemories('nonexistent');
      expect(results).toHaveLength(0);
    });

    it('limits to 15 results', () => {
      const entries = Array.from({ length: 20 }, (_, i) => ({
        key: `key_${i}`, value: 'test', category: 'fact' as const, tier: 'semantic' as const, confidence: 0.5,
      }));
      useMemoryStore.getState().addMemories(entries);
      const results = useMemoryStore.getState().queryMemories('test');
      expect(results).toHaveLength(15);
    });
  });

  describe('deleteMemory / clearMemories', () => {
    it('deletes a memory by id', () => {
      useMemoryStore.getState().addMemory({
        key: 'test', value: 'val', category: 'fact', tier: 'semantic', confidence: 0.9,
      });
      const id = useMemoryStore.getState().memories[0].id;
      useMemoryStore.getState().deleteMemory(id);
      expect(useMemoryStore.getState().memories).toHaveLength(0);
    });

    it('clears all memories', () => {
      useMemoryStore.getState().addMemories([
        { key: 'a', value: '1', category: 'fact', tier: 'semantic', confidence: 0.8 },
        { key: 'b', value: '2', category: 'fact', tier: 'semantic', confidence: 0.9 },
      ]);
      useMemoryStore.getState().clearMemories();
      expect(useMemoryStore.getState().memories).toHaveLength(0);
    });
  });

  describe('getRelevantContext', () => {
    it('returns empty string when no memories', () => {
      const ctx = useMemoryStore.getState().getRelevantContext();
      expect(ctx).toBe('');
    });

    it('includes working memory in Active Context section', () => {
      useMemoryStore.getState().addMemory({
        key: 'current_project', value: 'GIA', category: 'fact', tier: 'working', confidence: 0.95,
      });
      const ctx = useMemoryStore.getState().getRelevantContext('project');
      expect(ctx).toContain('Active Context');
      expect(ctx).toContain('current_project');
    });

    it('includes semantic memories in Facts section', () => {
      useMemoryStore.getState().addMemory({
        key: 'user_name', value: 'Alice', category: 'profile', tier: 'semantic', confidence: 0.95,
      });
      const ctx = useMemoryStore.getState().getRelevantContext('Alice');
      expect(ctx).toContain('Facts');
      expect(ctx).toContain('user_name');
    });
  });

  describe('compactMemories', () => {
    it('prunes old working memories', () => {
      const oldDate = Date.now() - 2 * 86400000;
      useMemoryStore.setState({
        memories: [{
          id: '1', key: 'old_working', value: 'old', category: 'fact', tier: 'working',
          confidence: 0.9, timestamp: oldDate, lastAccessed: oldDate,
        }],
      });
      useMemoryStore.getState().compactMemories();
      expect(useMemoryStore.getState().memories).toHaveLength(0);
    });

    it('merges duplicate entries by key', () => {
      useMemoryStore.setState({
        memories: [
          makeEntry({ id: '1', key: 'same', value: 'shorter', confidence: 0.5 }),
          makeEntry({ id: '2', key: 'same', value: 'longer value here', confidence: 0.9 }),
        ],
      });
      useMemoryStore.getState().compactMemories();
      const { memories } = useMemoryStore.getState();
      expect(memories).toHaveLength(1);
      expect(memories[0].value).toBe('longer value here');
    });

    it('merges near-duplicate paraphrased facts within a category', () => {
      useMemoryStore.setState({
        memories: [
          makeEntry({ id: '1', key: 'edu_a', value: 'studies computer science at the university', category: 'fact', confidence: 0.7 }),
          makeEntry({ id: '2', key: 'edu_b', value: 'is studying computer science at university', category: 'fact', confidence: 0.8 }),
        ],
      });
      useMemoryStore.getState().compactMemories();
      const { memories } = useMemoryStore.getState();
      expect(memories).toHaveLength(1);
    });
  });

  describe('near-duplicate merging on add', () => {
    it('merges a paraphrased memory into an existing same-category one', () => {
      useMemoryStore.getState().addMemory({
        key: 'edu_a', value: 'studies computer science at the university', category: 'fact', tier: 'semantic', confidence: 0.7,
      });
      useMemoryStore.getState().addMemory({
        key: 'edu_b', value: 'is studying computer science at university', category: 'fact', tier: 'semantic', confidence: 0.8,
      });
      const { memories } = useMemoryStore.getState();
      expect(memories).toHaveLength(1);
    });

    it('does not merge memories from different categories', () => {
      useMemoryStore.getState().addMemory({
        key: 'a', value: 'studies computer science at the university', category: 'fact', tier: 'semantic', confidence: 0.7,
      });
      useMemoryStore.getState().addMemory({
        key: 'b', value: 'is studying computer science at university', category: 'preference', tier: 'semantic', confidence: 0.8,
      });
      expect(useMemoryStore.getState().memories).toHaveLength(2);
    });
  });

  describe('getCoreContext', () => {
    it('returns empty string when there are no core memories', () => {
      expect(useMemoryStore.getState().getCoreContext()).toBe('');
    });

    it('returns a Knows-you block for high-confidence profile/preference/goal facts', () => {
      useMemoryStore.getState().addMemories([
        { key: 'user_name', value: 'Alice', category: 'profile', tier: 'semantic', confidence: 0.95 },
        { key: 'likes', value: 'hiking', category: 'preference', tier: 'semantic', confidence: 0.9 },
        { key: 'low', value: 'trivial fact', category: 'fact', tier: 'semantic', confidence: 0.9 },
      ]);
      const ctx = useMemoryStore.getState().getCoreContext();
      expect(ctx).toContain('What I know about you');
      expect(ctx).toContain('user_name');
      expect(ctx).toContain('likes');
      expect(ctx).not.toContain('trivial fact');
    });
  });
});
