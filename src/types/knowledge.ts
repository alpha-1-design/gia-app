export type EntityType =
  | 'person'
  | 'project'
  | 'concept'
  | 'location'
  | 'organization'
  | 'event'
  | 'date'
  | 'technology'
  | 'tool'
  | 'topic'
  | 'habit'
  | 'goal'
  | 'document'
  | 'note'
  | 'preference'
  | 'custom';

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  aliases: string[];
  description: string;
  firstMentioned: number;
  lastMentioned: number;
  mentionCount: number;
  confidence: number;
  metadata: Record<string, string>;
}

export type RelationType =
  | 'works_on'
  | 'mentions'
  | 'related_to'
  | 'depends_on'
  | 'part_of'
  | 'located_in'
  | 'created_by'
  | 'used_in'
  | 'leads_to'
  | 'precedes'
  | 'follows'
  | 'contradicts'
  | 'prefers'
  | 'improves'
  | 'blocks'
  | 'custom';

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  strength: number;
  context: string;
  firstObserved: number;
  lastObserved: number;
  observationCount: number;
}

export interface Mention {
  id: string;
  entityId: string;
  messageId: string;
  timestamp: number;
  context: string;
}

export interface KnowledgeGraph {
  entities: Entity[];
  relationships: Relationship[];
  mentions: Mention[];
}
