import { useCallback, useMemo } from 'react';
import { useKnowledgeGraphStore } from '../store/useKnowledgeGraphStore';
import { knowledgeGraphService } from '../services/KnowledgeGraphService';
import type { EntityType } from '../types/knowledge';

export function useKnowledgeGraph() {
  const store = useKnowledgeGraphStore();

  const searchEntities = useCallback(
    (query: string) => store.queryEntities(query),
    [store]
  );

  const getRelated = useCallback(
    (entityId: string, maxDepth?: number) => store.getRelatedEntities(entityId, maxDepth),
    [store]
  );

  const getTimeline = useCallback(
    (entityName: string, days?: number) => knowledgeGraphService.getEntityTimeline(entityName, days),
    []
  );

  const findPath = useCallback(
    (source: string, target: string) => knowledgeGraphService.findPathBetween(source, target),
    []
  );

  const extractFromText = useCallback(
    (text: string, messageId: string) => knowledgeGraphService.extractFromText(text, messageId),
    []
  );

  const getDigest = useCallback(
    () => knowledgeGraphService.getWeeklyDigest(),
    []
  );

  const addEntity = useCallback(
    (data: { name: string; type: EntityType; aliases?: string[]; description?: string; confidence?: number }) =>
      store.addEntity({
        name: data.name,
        type: data.type,
        aliases: data.aliases || [],
        description: data.description || '',
        confidence: data.confidence ?? 0.7,
        metadata: {},
      }),
    [store]
  );

  const entityCount = useMemo(() => store.entities.length, [store.entities.length]);
  const relationshipCount = useMemo(() => store.relationships.length, [store.relationships.length]);

  return {
    entities: store.entities,
    relationships: store.relationships,
    entityCount,
    relationshipCount,
    searchEntities,
    getRelated,
    getTimeline,
    findPath,
    extractFromText,
    getDigest,
    addEntity,
    getEntity: store.getEntity,
    findEntity: store.findEntity,
    deleteEntity: store.deleteEntity,
    compact: store.compact,
  };
}
