import { logger } from '../utils/logger';
import { useKnowledgeGraphStore } from '../store/useKnowledgeGraphStore';
import type { EntityType, RelationType, Entity, Mention } from '../types/knowledge';

interface ExtractionResult {
  entities: Array<{
    name: string;
    type: EntityType;
    aliases: string[];
    description: string;
    confidence: number;
  }>;
  relationships: Array<{
    source: string;
    target: string;
    type: RelationType;
    strength: number;
    context: string;
  }>;
}

const COMMON_ENTITY_PATTERNS = [
  { type: 'person' as EntityType, pattern: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g },
  { type: 'date' as EntityType, pattern: /\b\d{4}-\d{2}-\d{2}\b/g },
  { type: 'date' as EntityType, pattern: /\b(?:yesterday|today|tomorrow|next week|last month)\b/gi },
  { type: 'location' as EntityType, pattern: /\b(?:at|in|from) ([A-Z][a-z]+(?: [A-Z][a-z]+)*)\b/g },
];

const RELATION_TRIGGERS: Array<{ pattern: RegExp; relation: RelationType }> = [
  { pattern: /\b(?:works? at|works? for|employed by|team at)\b/i, relation: 'works_on' },
  { pattern: /\b(?:part of|belongs to|member of)\b/i, relation: 'part_of' },
  { pattern: /\b(?:related to|connected to|linked to)\b/i, relation: 'related_to' },
  { pattern: /\b(?:depends? on|requires|needs)\b/i, relation: 'depends_on' },
  { pattern: /\b(?:located in|based in|situated in)\b/i, relation: 'located_in' },
  { pattern: /\b(?:created|built|made|developed by)\b/i, relation: 'created_by' },
  { pattern: /\b(?:uses?|using|utilizes?)\b/i, relation: 'used_in' },
  { pattern: /\b(?:leads? to|causes?|results? in)\b/i, relation: 'leads_to' },
  { pattern: /\b(?:prefers?|likes?|enjoys?)\b/i, relation: 'prefers' },
  { pattern: /\b(?:improves?|enhances?|bettered by)\b/i, relation: 'improves' },
  { pattern: /\b(?:blocks?|prevents?|hinders?)\b/i, relation: 'blocks' },
  { pattern: /\b(?:before|precedes)\b/i, relation: 'precedes' },
  { pattern: /\b(?:after|follows)\b/i, relation: 'follows' },
  { pattern: /\b(?:but|however|unlike|contrary)\b/i, relation: 'contradicts' },
];

function extractBasicEntities(text: string): ExtractionResult {
  const entities: ExtractionResult['entities'] = [];
  const relationships: ExtractionResult['relationships'] = [];

  for (const { type, pattern } of COMMON_ENTITY_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const name = match[1] || match[0];
      if (name.length > 2 && !entities.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
        entities.push({
          name,
          type,
          aliases: [],
          description: '',
          confidence: 0.5,
        });
      }
    }
  }

  for (const { pattern, relation } of RELATION_TRIGGERS) {
    if (pattern.test(text)) {
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          relationships.push({
            source: entities[i].name,
            target: entities[j].name,
            type: relation,
            strength: 0.4,
            context: text.slice(0, 200),
          });
        }
      }
    }
  }

  return { entities, relationships };
}

export class KnowledgeGraphService {
  private extractionCache = new Map<string, ExtractionResult>();
  private extractionInProgress = false;

  async extractFromDocument(title: string, text: string, messageId: string): Promise<void> {
    if (!text || text.length < 20) return;
    const store = useKnowledgeGraphStore.getState();

    // Create a document entity
    const docId = store.addEntity({
      name: title,
      type: 'document',
      description: text.length > 300 ? text.slice(0, 300) + '...' : text,
      aliases: [],
      confidence: 0.7,
      metadata: { source: 'document_upload', indexedAt: Date.now().toString() },
    });

    // Extract entities from the document text
    const result = text.length < 500 ? extractBasicEntities(text) : await this.deepExtract(text);
    if (!result) return;

    // Link each extracted entity to the document and record mentions
    for (const entityData of result.entities) {
      const id = store.addEntity({ ...entityData, metadata: { source: 'document' } });
      if (id && id !== docId) {
        store.addMention({
          entityId: id, messageId, timestamp: Date.now(),
          context: `Extracted from document: ${title}`,
        });
        store.addRelationship({
          sourceId: docId, targetId: id,
          type: 'related_to', strength: 0.6,
          context: `${title} mentions ${entityData.name}`,
        });
      }
    }

    // Link relationships between extracted entities
    for (const rel of result.relationships) {
      const source = store.findEntity(rel.source);
      const target = store.findEntity(rel.target);
      if (source && target) {
        store.addRelationship({
          sourceId: source.id, targetId: target.id,
          type: rel.type, strength: rel.strength, context: rel.context,
        });
      }
    }

    logger.info(`[KnowledgeGraph] Ingested document "${title}" — ${result.entities.length} entities, ${result.relationships.length} relationships`);
  }

  async extractFromText(text: string, messageId: string): Promise<void> {
    if (!text || text.length < 10) return;

    const store = useKnowledgeGraphStore.getState();
    const result = text.length < 500 ? extractBasicEntities(text) : await this.deepExtract(text);
    if (!result) return;

    for (const entityData of result.entities) {
      const id = store.addEntity({
        ...entityData,
        metadata: {},
      });
      if (id) {
        store.addMention({
          entityId: id,
          messageId,
          timestamp: Date.now(),
          context: text.slice(0, 300),
        });
      }
    }

    for (const rel of result.relationships) {
      const source = store.findEntity(rel.source);
      const target = store.findEntity(rel.target);
      if (source && target) {
        store.addRelationship({
          sourceId: source.id,
          targetId: target.id,
          type: rel.type,
          strength: rel.strength,
          context: rel.context,
        });
      }
    }

    logger.debug(`[KnowledgeGraph] Extracted ${result.entities.length} entities, ${result.relationships.length} relationships`);
  }

  private async deepExtract(text: string): Promise<ExtractionResult | null> {
    const cacheKey = text.slice(0, 100) + ':' + text.length;
    if (this.extractionCache.has(cacheKey)) {
      return this.extractionCache.get(cacheKey)!;
    }

    if (this.extractionInProgress) {
      return extractBasicEntities(text);
    }

    try {
      this.extractionInProgress = true;
      const brain = (await import('./GiaBrain')).default;

      const response = await brain.generate({
        systemPrompt: `Extract entities and relationships from the text. Return ONLY valid JSON:
{
  "entities": [
    {"name": "...", "type": "person|project|concept|location|organization|event|date|technology|tool|topic|habit|goal", "aliases": [], "description": "...", "confidence": 0.0-1.0}
  ],
  "relationships": [
    {"source": "...", "target": "...", "type": "works_on|related_to|part_of|depends_on|used_in|prefers|blocks|improves|leads_to", "strength": 0.0-1.0, "context": "..."}
  ]
}
If no entities found, return {"entities":[],"relationships":[]}`,
        prompt: text,
        forceJson: true,
        maxTokens: 1000,
      });

      const json = JSON.parse(response.text);
      this.extractionCache.set(cacheKey, json);
      return json as ExtractionResult;
    } catch (e) {
      logger.warn('[KnowledgeGraph] Deep extraction failed, using basic:', e);
      return extractBasicEntities(text);
    } finally {
      this.extractionInProgress = false;
    }
  }

  getRelatedContext(query: string, maxResults = 5): string {
    const store = useKnowledgeGraphStore.getState();
    const entities = store.queryEntities(query).slice(0, maxResults);
    if (entities.length === 0) return '';

    const lines: string[] = [];
    for (const entity of entities) {
      const rels = store.getRelationships(entity.id);
      lines.push(`${entity.name} (${entity.type}): ${entity.description}`);
      for (const rel of rels.slice(0, 3)) {
        const target = store.getEntity(
          rel.sourceId === entity.id ? rel.targetId : rel.sourceId
        );
        if (target) {
          lines.push(`  → ${rel.type} → ${target.name}`);
        }
      }
    }
    return lines.join('\n');
  }

  async search(query: string, topK = 8): Promise<{
    entities: Array<{ entity: Entity; score: number }>;
    memories: Array<{ key: string; value: string; score: number }>;
  }> {
    const store = useKnowledgeGraphStore.getState();

    // Semantic entity search using word vectors
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const querySet = new Set(queryWords);

    const entityResults = store.searchEntities(query).slice(0, topK).map(e => {
      const text = `${e.name} ${e.description}`.toLowerCase();
      const textWords = text.split(/\s+/).filter(w => w.length > 2);
      const textSet = new Set(textWords);
      const overlap = [...querySet].filter(w => textSet.has(w)).length;
      const cosSim = overlap / Math.sqrt(queryWords.length * textWords.length || 1);
      return { entity: e, score: cosSim * 0.5 + e.confidence * 0.3 + Math.min(e.mentionCount / 10, 1) * 0.2 };
    }).sort((a, b) => b.score - a.score);

    // Memory search via store's query
    const { useMemoryStore } = await import('../store/useMemoryStore');
    const memResults = useMemoryStore.getState().queryMemories(query).slice(0, topK).map(m => ({
      key: m.key, value: m.value, score: m.confidence,
    }));

    return { entities: entityResults, memories: memResults };
  }

  findPathBetween(sourceName: string, targetName: string): Entity[] | null {
    const store = useKnowledgeGraphStore.getState();
    const source = store.findEntity(sourceName);
    const target = store.findEntity(targetName);
    if (!source || !target) return null;

    const visited = new Set<string>();
    const queue: { id: string; path: Entity[] }[] = [{ id: source.id, path: [source] }];

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;
      if (id === target.id) return path;
      if (visited.has(id)) continue;
      visited.add(id);

      const rels = store.getRelationships(id);
      for (const rel of rels) {
        const nextId = rel.sourceId === id ? rel.targetId : rel.sourceId;
        if (!visited.has(nextId)) {
          const nextEntity = store.getEntity(nextId);
          if (nextEntity) {
            queue.push({ id: nextId, path: [...path, nextEntity] });
          }
        }
      }
    }
    return null;
  }

  getEntityTimeline(entityName: string, days = 30): Mention[] {
    const store = useKnowledgeGraphStore.getState();
    const entity = store.findEntity(entityName);
    if (!entity) return [];

    const cutoff = Date.now() - days * 86400000;
    return store.mentions
      .filter((m) => m.entityId === entity.id && m.timestamp > cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getWeeklyDigest(): string {
    const store = useKnowledgeGraphStore.getState();
    const weekAgo = Date.now() - 7 * 86400000;

    const newEntities = store.entities.filter((e) => e.firstMentioned > weekAgo);
    const activeEntities = store.entities.filter((e) => e.lastMentioned > weekAgo);

    const lines: string[] = ['### Knowledge Graph Weekly Digest'];
    lines.push(`**New entities:** ${newEntities.length}`);
    lines.push(`**Active entities:** ${activeEntities.length}`);
    lines.push(`**Total relationships:** ${store.relationships.length}`);

    if (newEntities.length > 0) {
      lines.push('\n**What GIA learned about:**');
      for (const e of newEntities.slice(0, 10)) {
        lines.push(`- ${e.name} (${e.type})`);
      }
    }

    return lines.join('\n');
  }
}

export const knowledgeGraphService = new KnowledgeGraphService();
