import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';
import { genId } from '../utils/id';
import type { Entity, Relationship, Mention, EntityType } from '../types/knowledge';

const MAX_ENTITIES = 2000;
const MAX_RELATIONSHIPS = 5000;
const MAX_MENTIONS = 10000;

interface KnowledgeGraphState {
  entities: Entity[];
  relationships: Relationship[];
  mentions: Mention[];

  addEntity: (entry: Omit<Entity, 'id' | 'firstMentioned' | 'lastMentioned' | 'mentionCount'>) => string;
  addRelationship: (entry: Omit<Relationship, 'id' | 'firstObserved' | 'lastObserved' | 'observationCount'>) => void;
  addMention: (mention: Omit<Mention, 'id'>) => string;
  getEntity: (id: string) => Entity | undefined;
  findEntity: (name: string, type?: EntityType) => Entity | undefined;
  queryEntities: (query: string) => Entity[];
  searchEntities: (query: string) => Entity[];
  getRelationships: (entityId: string) => Relationship[];
  getRelatedEntities: (entityId: string, maxDepth?: number) => Entity[];
  getGraphContext: (query: string) => string;
  deleteEntity: (id: string) => void;
  deleteRelationship: (id: string) => void;
  compact: () => void;
  applyDecay: () => void;
  clear: () => void;
}

export const useKnowledgeGraphStore = create<KnowledgeGraphState>()(
  persist(
    (set, get) => ({
      entities: [],
      relationships: [],
      mentions: [],

      addEntity: (entry) => {
        const existing = get().findEntity(entry.name, entry.type);
        if (existing) {
          set((s) => ({
            entities: s.entities.map((e) =>
              e.id === existing.id
                ? {
                    ...e,
                    lastMentioned: Date.now(),
                    mentionCount: e.mentionCount + 1,
                    confidence: Math.max(e.confidence, entry.confidence),
                    description: entry.description || e.description,
                    aliases: [...new Set([...e.aliases, ...entry.aliases])],
                    metadata: { ...e.metadata, ...entry.metadata },
                  }
                : e
            ),
          }));
          return existing.id;
        }
        const id = genId();
        const entity: Entity = {
          ...entry,
          id,
          firstMentioned: Date.now(),
          lastMentioned: Date.now(),
          mentionCount: 1,
        };
        set((s) => ({
          entities: [...s.entities, entity].slice(-MAX_ENTITIES),
        }));
        return id;
      },

      addRelationship: (entry) => {
        const existing = get().relationships.find(
          (r) =>
            (r.sourceId === entry.sourceId && r.targetId === entry.targetId && r.type === entry.type) ||
            (r.sourceId === entry.targetId && r.targetId === entry.sourceId && r.type === entry.type)
        );
        if (existing) {
          set((s) => ({
            relationships: s.relationships.map((r) =>
              r.id === existing.id
                ? {
                    ...r,
                    strength: Math.min(1, r.strength + entry.strength * 0.3),
                    lastObserved: Date.now(),
                    observationCount: r.observationCount + 1,
                    context: entry.context || r.context,
                  }
                : r
            ),
          }));
          return;
        }
        const rel: Relationship = {
          ...entry,
          id: genId(),
          firstObserved: Date.now(),
          lastObserved: Date.now(),
          observationCount: 1,
        };
        set((s) => ({
          relationships: [...s.relationships, rel].slice(-MAX_RELATIONSHIPS),
        }));
      },

      addMention: (mention) => {
        const id = genId();
        const m: Mention = { ...mention, id };
        set((s) => ({
          mentions: [...s.mentions, m].slice(-MAX_MENTIONS),
          entities: s.entities.map((e) =>
            e.id === mention.entityId
              ? { ...e, lastMentioned: mention.timestamp, mentionCount: e.mentionCount + 1 }
              : e
          ),
        }));
        return id;
      },

      getEntity: (id) => get().entities.find((e) => e.id === id),
      findEntity: (name, type) => {
        const lower = name.toLowerCase();
        return get().entities.find(
          (e) =>
            (e.name.toLowerCase() === lower || e.aliases.some((a) => a.toLowerCase() === lower)) &&
            (!type || e.type === type)
        );
      },

      queryEntities: (query) => {
        const lower = query.toLowerCase();
        return get().entities
          .filter(
            (e) =>
              e.name.toLowerCase().includes(lower) ||
              e.aliases.some((a) => a.toLowerCase().includes(lower)) ||
              e.description.toLowerCase().includes(lower)
          )
          .sort((a, b) => b.mentionCount - a.mentionCount)
          .slice(0, 20);
      },

      searchEntities: (query) => {
        const lower = query.toLowerCase().trim();
        if (!lower) return get().entities.slice(0, 20);
        const queryWords = lower.split(/\s+/).filter(w => w.length > 2);
        if (queryWords.length === 0) return get().entities.slice(0, 20);

        // Score each entity by semantic overlap with query
        const scored = get().entities.map(e => {
          const text = `${e.name} ${e.aliases.join(' ')} ${e.description}`.toLowerCase();
          const wordMatches = queryWords.filter(w => text.includes(w)).length;
          const semanticScore = wordMatches / Math.max(queryWords.length, 1);
          // Boost for name prefix matches
          const nameBoost = e.name.toLowerCase().startsWith(lower) ? 0.3 : 0;
          // Boost for exact alias match
          const aliasBoost = e.aliases.some(a => a.toLowerCase() === lower) ? 0.3 : 0;
          // Cosine similarity using word overlap
          const textWords = text.split(/\s+/).filter(w => w.length > 2);
          const textSet = new Set(textWords);
          const overlap = queryWords.filter(w => textSet.has(w)).length;
          const cosSim = overlap / Math.sqrt(queryWords.length * textWords.length || 1);
          return {
            entity: e,
            score: cosSim * 0.6 + semanticScore * 0.3 + nameBoost + aliasBoost + e.confidence * 0.1,
          };
        });

        return scored
          .sort((a, b) => b.score - a.score)
          .slice(0, 20)
          .map(s => s.entity);
      },

      getRelationships: (entityId) =>
        get().relationships.filter((r) => r.sourceId === entityId || r.targetId === entityId),

      getRelatedEntities: (entityId, maxDepth = 2) => {
        const visited = new Set<string>();
        const results: Entity[] = [];
        const queue: { id: string; depth: number }[] = [{ id: entityId, depth: 0 }];
        const entities = get().entities;
        const relationships = get().relationships;

        while (queue.length > 0) {
          const { id, depth } = queue.shift()!;
          if (visited.has(id) || depth > maxDepth) continue;
          visited.add(id);

          const entity = entities.find((e) => e.id === id);
          if (entity && id !== entityId) results.push(entity);

          const rels = relationships.filter((r) => r.sourceId === id || r.targetId === id);
          for (const rel of rels) {
            const nextId = rel.sourceId === id ? rel.targetId : rel.sourceId;
            if (!visited.has(nextId)) {
              queue.push({ id: nextId, depth: depth + 1 });
            }
          }
        }
        return results;
      },

      getGraphContext: (query) => {
        const entities = get().queryEntities(query);
        if (entities.length === 0) return '';

        const lines: string[] = ['## Knowledge Graph Context:'];
        for (const entity of entities.slice(0, 10)) {
          const rels = get().getRelationships(entity.id);
          lines.push(`- ${entity.name} (${entity.type}): ${entity.description}`);
          for (const rel of rels.slice(0, 5)) {
            const target = get().getEntity(
              rel.sourceId === entity.id ? rel.targetId : rel.sourceId
            );
            if (target) {
              lines.push(`  → ${rel.type}: ${target.name}`);
            }
          }
        }
        return lines.join('\n');
      },

      deleteEntity: (id) =>
        set((s) => ({
          entities: s.entities.filter((e) => e.id !== id),
          relationships: s.relationships.filter((r) => r.sourceId !== id && r.targetId !== id),
          mentions: s.mentions.filter((m) => m.entityId !== id),
        })),

      deleteRelationship: (id) =>
        set((s) => ({
          relationships: s.relationships.filter((r) => r.id !== id),
        })),

      compact: () =>
        set((s) => {
          const now = Date.now();
          const monthAgo = now - 30 * 86400000;

          const activeEntities = s.entities.filter(
            (e) => e.lastMentioned > monthAgo || e.confidence > 0.5
          );
          const activeIds = new Set(activeEntities.map((e) => e.id));

          return {
            entities: activeEntities.slice(0, MAX_ENTITIES),
            relationships: s.relationships
              .filter((r) => activeIds.has(r.sourceId) && activeIds.has(r.targetId))
              .slice(0, MAX_RELATIONSHIPS),
            mentions: s.mentions.slice(-MAX_MENTIONS),
          };
        }),

      applyDecay: () =>
        set((s) => {
          const now = Date.now();
          const dayMs = 86400000;
          const decayFactor = 0.97;

          return {
            entities: s.entities.map((e) => {
              const daysSinceMention = (now - e.lastMentioned) / dayMs;
              if (daysSinceMention < 1) return e; // Recently mentioned — no decay
              // Decay confidence: 3% per day since last mention, floor at 0.1
              const decay = Math.pow(decayFactor, daysSinceMention);
              const newConfidence = Math.max(0.1, e.confidence * decay);
              return { ...e, confidence: Math.round(newConfidence * 1000) / 1000 };
            }),
          };
        }),

      clear: () => set({ entities: [], relationships: [], mentions: [] }),
    }),
    {
      name: 'gia-knowledge-graph-v1',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ entities: s.entities, relationships: s.relationships, mentions: s.mentions }),
    }
  )
);
