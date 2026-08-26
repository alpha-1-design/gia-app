import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';
import { genId } from '../utils/id';
import type { Entity, Relationship, Mention, EntityType } from '../types/knowledge';

const MAX_ENTITIES = 2000;
const MAX_RELATIONSHIPS = 5000;
const MAX_MENTIONS = 10000;

/**
 * Normalize a name for fuzzy matching — lowercase, collapse punctuation and
 * whitespace so "OpenAI" == "Open AI" == "open-ai" when deduping entities.
 */
function normalizeName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#_.-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

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
  /** Merge `dropId` into `keepId` — unions aliases, keeps the richer
   * description, sums mention counts, and rewires relationships/mentions. */
  mergeEntities: (keepId: string, dropId: string) => void;
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
          // Merge new facts into the existing entity instead of overwriting:
          // keep the richer description, union aliases, raise confidence.
          const richerDesc = (entry.description || '').length > (existing.description || '').length
            ? entry.description
            : existing.description;
          set((s) => ({
            entities: s.entities.map((e) =>
              e.id === existing.id
                ? {
                    ...e,
                    lastMentioned: Date.now(),
                    mentionCount: e.mentionCount + 1,
                    confidence: Math.max(e.confidence, entry.confidence),
                    description: richerDesc,
                    aliases: [...new Set([...e.aliases, ...entry.aliases])],
                    metadata: { ...e.metadata, ...entry.metadata },
                  }
                : e
            ),
          }));
          // Still auto-link: new aliases/description may mention known entities.
          linkToKnownEntities(existing.id);
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
        // Neural wiring: connect this entity to any already-known entity whose
        // name/alias appears in its name/aliases/description. This is what
        // makes the graph denser on its own — no manual linking needed.
        linkToKnownEntities(id);
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
        const lower = normalizeName(name);
        if (!lower) return undefined;
        return get().entities.find(
          (e) =>
            (normalizeName(e.name) === lower || e.aliases.some((a) => normalizeName(a) === lower)) &&
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

        // Score each entity by semantic overlap + recency + graph centrality,
        // so well-connected, recently-active entities surface above stale ones.
        const now = Date.now();
        const relCounts = new Map<string, number>();
        for (const r of get().relationships) {
          relCounts.set(r.sourceId, (relCounts.get(r.sourceId) || 0) + 1);
          relCounts.set(r.targetId, (relCounts.get(r.targetId) || 0) + 1);
        }
        let maxDegree = 0;
        for (const c of relCounts.values()) maxDegree = Math.max(maxDegree, c);

        const scored = get().entities.map(e => {
          const text = `${e.name} ${e.aliases.join(' ')} ${e.description}`.toLowerCase();
          const wordMatches = queryWords.filter(w => text.includes(w)).length;
          const semanticScore = wordMatches / Math.max(queryWords.length, 1);
          // Boost for name prefix matches
          const nameBoost = e.name.toLowerCase().startsWith(lower) ? 0.3 : 0;
          // Boost for exact alias match
          const aliasBoost = e.aliases.some(a => normalizeName(a) === normalizeName(query)) ? 0.3 : 0;
          // Cosine similarity using word overlap
          const textWords = text.split(/\s+/).filter(w => w.length > 2);
          const textSet = new Set(textWords);
          const overlap = queryWords.filter(w => textSet.has(w)).length;
          const cosSim = overlap / Math.sqrt(queryWords.length * textWords.length || 1);
          const daysSince = (now - e.lastMentioned) / 86400000;
          const recency = daysSince < 7 ? 1 : daysSince < 30 ? 0.55 : 0.2;
          const degree = relCounts.get(e.id) || 0;
          const centrality = maxDegree > 0 ? degree / maxDegree : 0;
          return {
            entity: e,
            score: cosSim * 0.45 + semanticScore * 0.25 + nameBoost + aliasBoost
              + Math.min(e.mentionCount / 15, 1) * 0.1 * recency
              + e.confidence * 0.08 + centrality * 0.07,
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
        const entities = get().searchEntities(query);
        if (entities.length === 0) return '';

        const lines: string[] = ['## Knowledge Graph Context:'];
        for (const entity of entities.slice(0, 8)) {
          const rels = get()
            .getRelationships(entity.id)
            .sort((a, b) => b.strength - a.strength);
          lines.push(`- ${entity.name} (${entity.type}): ${entity.description || 'No description'}`);
          for (const rel of rels.slice(0, 4)) {
            const target = get().getEntity(
              rel.sourceId === entity.id ? rel.targetId : rel.sourceId
            );
            if (target) {
              lines.push(`  → ${rel.type.replace(/_/g, ' ')} (${(rel.strength * 100).toFixed(0)}%): ${target.name}`);
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

      mergeEntities: (keepId, dropId) => {
        if (keepId === dropId) return;
        set((s) => {
          const keep = s.entities.find((e) => e.id === keepId);
          const drop = s.entities.find((e) => e.id === dropId);
          if (!keep || !drop) return s;

          const merged: Entity = {
            ...keep,
            // Union names + aliases so either spelling resolves to this entity
            aliases: [...new Set([...keep.aliases, ...drop.aliases, keep.name, drop.name].filter(Boolean))],
            description: keep.description.length >= drop.description.length ? keep.description : drop.description,
            mentionCount: keep.mentionCount + drop.mentionCount,
            confidence: Math.max(keep.confidence, drop.confidence),
            firstMentioned: Math.min(keep.firstMentioned, drop.firstMentioned),
            lastMentioned: Math.max(keep.lastMentioned, drop.lastMentioned),
            metadata: { ...drop.metadata, ...keep.metadata },
          };

          const entities = s.entities
            .filter((e) => e.id !== dropId)
            .map((e) => (e.id === keepId ? merged : e));

          // Rewire relationships, dropping self-loops and duplicate pairs
          const relationships = s.relationships
            .filter((r) => r.sourceId !== dropId && r.targetId !== dropId)
            .map((r) => ({
              ...r,
              sourceId: r.sourceId === dropId ? keepId : r.sourceId,
              targetId: r.targetId === dropId ? keepId : r.targetId,
            }))
            .filter((r) => r.sourceId !== r.targetId)
            .filter(
              (r, i, arr) =>
                arr.findIndex((x) =>
                  ((x.sourceId === r.sourceId && x.targetId === r.targetId) ||
                    (x.sourceId === r.targetId && x.targetId === r.sourceId)) &&
                  x.type === r.type
                ) === i
            );

          const mentions = s.mentions.map((m) =>
            m.entityId === dropId ? { ...m, entityId: keepId } : m
          );

          return { entities, relationships, mentions };
        });
      },

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
              // Prune dead, weak links — a relationship nobody has touched in
              // a month with negligible strength is noise, not knowledge.
              .filter((r) => r.strength >= 0.1 || r.lastObserved > monthAgo)
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
            // Relationships decay too — forgotten connections fade.
            relationships: s.relationships.map((r) => {
              const daysSince = (now - r.lastObserved) / dayMs;
              if (daysSince < 1) return r;
              const decay = Math.pow(0.99, daysSince);
              const newStrength = Math.max(0.05, r.strength * decay);
              return { ...r, strength: Math.round(newStrength * 1000) / 1000 };
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

/**
 * Auto-link: connect an entity to any already-known entity whose name or alias
 * appears in its name/aliases/description (or vice versa). This is what makes
 * the graph denser on its own — no manual linking needed. Skips the entity
 * itself and self-referential pairs.
 */
function linkToKnownEntities(id: string): void {
  const s = useKnowledgeGraphStore.getState();
  const entity = s.entities.find((e) => e.id === id);
  if (!entity) return;

  const normalizedId = normalizeName(entity.name);
  const entityText = [entity.name, ...entity.aliases, entity.description].join(' ');

  for (const other of s.entities) {
    if (other.id === id) continue;
    const otherNames = [other.name, ...other.aliases];
    const otherNormalized = new Set(otherNames.map(normalizeName));
    const otherText = [other.name, ...other.aliases, other.description].join(' ');

    const mentionsOther = otherNormalized.has(normalizedId) ||
      otherNames.some((n) => n.length >= 3 && entityText.toLowerCase().includes(n.toLowerCase()));
    const mentionedByOther = normalizeName(other.name) === normalizedId ||
      otherNames.some((n) => n.length >= 3 && otherText.toLowerCase().includes(n.toLowerCase()));

    if (mentionsOther || mentionedByOther) {
      s.addRelationship({
        sourceId: id,
        targetId: other.id,
        type: 'related_to',
        strength: 0.5,
        context: 'auto-linked (name/alias overlap)',
      });
    }
  }
}
