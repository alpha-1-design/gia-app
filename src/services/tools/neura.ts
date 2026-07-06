import { useKnowledgeGraphStore } from '../../store/useKnowledgeGraphStore';
import { useMemoryStore } from '../../store/useMemoryStore';
import type { Tool, ToolContext } from './types';

export const neuraTools: Tool[] = [
  {
    id: 'neura_query',
    name: 'neura_query',
    description: 'Query the knowledge graph (Neura) for entities and relationships related to a topic. Returns known people, projects, concepts, locations, and how they connect. Use this when you need to recall what GIA has learned about someone or something.',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The topic or entity name to search for' },
        maxResults: { type: 'number', description: 'Maximum results to return (default 8)' },
      },
      required: ['query'],
    },
    execute: async ({ query, maxResults }, ctx?: ToolContext) => {
      const q = String(query ?? '');
      const limit = Math.min(Math.max(Number(maxResults) || 8, 1), 20);
      ctx?.onThought?.(`🔍 Querying Neura index for "${q}"...`);
      const store = useKnowledgeGraphStore.getState();
      const entities = store.queryEntities(q).slice(0, limit);

      if (entities.length === 0) {
        ctx?.onThought?.('No relevant entities found.');
        return { success: true, content: 'No relevant entities found in the knowledge graph.' };
      }

      ctx?.onThought?.(`Found ${entities.length} entit${entities.length === 1 ? 'y' : 'ies'} matching "${q}"`);

      const lines: string[] = [`Found ${entities.length} relevant entit${entities.length === 1 ? 'y' : 'ies'} in Neura:\n`];
      for (const entity of entities) {
        ctx?.onThought?.(`📌 ${entity.name} (${entity.type})`);
        const rels = store.getRelationships(entity.id);
        const memStore = useMemoryStore.getState();
        const relatedMems = memStore.queryMemories(entity.name).slice(0, 3);

        lines.push(`**${entity.name}** (${entity.type}) — confidence ${(entity.confidence * 100).toFixed(0)}%, mentioned ${entity.mentionCount}x`);
        if (entity.description) lines.push(`  ${entity.description}`);
        if (entity.aliases.length > 0) lines.push(`  Also known as: ${entity.aliases.join(', ')}`);

        if (rels.length > 0) {
          ctx?.onThought?.(`  ${rels.length} connection${rels.length > 1 ? 's' : ''} to explore`);
          lines.push(`  Connections:`);
          for (const rel of rels.slice(0, 5)) {
            const target = store.getEntity(rel.sourceId === entity.id ? rel.targetId : rel.sourceId);
            if (target) {
              lines.push(`    → ${rel.type.replace(/_/g, ' ')} → ${target.name}`);
            }
          }
        }

        if (relatedMems.length > 0) {
          lines.push(`  Related memories:`);
          for (const m of relatedMems) {
            lines.push(`    • ${m.key}: ${m.value.slice(0, 120)}`);
          }
        }
        lines.push('');
      }

      ctx?.onThought?.('✅ Neura query complete');
      return { success: true, content: lines.join('\n') };
    },
  },
  {
    id: 'neura_related',
    name: 'neura_related',
    description: 'Find entities connected to a specific entity in the knowledge graph, up to N degrees of separation. Useful for exploring how things are connected.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The entity name to find connections for' },
        depth: { type: 'number', description: 'Maximum depth of connections (1-3, default 2)' },
      },
      required: ['name'],
    },
    execute: async ({ name, depth }, ctx?: ToolContext) => {
      const q = String(name ?? '');
      const d = Math.min(Math.max(Number(depth) || 2, 1), 3);
      ctx?.onThought?.(`🔗 Looking up "${q}" in Neura...`);
      const store = useKnowledgeGraphStore.getState();
      const entity = store.findEntity(q);

      if (!entity) {
        ctx?.onThought?.(`No entity named "${q}" found in knowledge graph`);
        return { success: true, content: `No entity named "${q}" found in the knowledge graph. Try neura_query first to see what's indexed.` };
      }

      ctx?.onThought?.(`Found ${entity.name} — tracing connections (depth ${d})...`);
      const related = store.getRelatedEntities(entity.id, d);
      const rels = store.getRelationships(entity.id);
      ctx?.onThought?.(`${rels.length} direct connections, ${related.length} entities in extended network`);

      const lines: string[] = [
        `**${entity.name}** (${entity.type}) — ${entity.description || 'No description'}`,
        `Direct connections: ${rels.length}, Network (depth ${d}): ${related.length} entities\n`,
      ];

      if (rels.length > 0) {
        lines.push('**Direct relationships:**');
        for (const rel of rels.slice(0, 10)) {
          const target = store.getEntity(rel.sourceId === entity.id ? rel.targetId : rel.sourceId);
          if (target) {
            lines.push(`  ${rel.type.replace(/_/g, ' ')} → ${target.name} (strength: ${(rel.strength * 100).toFixed(0)}%)`);
          }
        }
      }

      if (related.length > 0) {
        ctx?.onThought?.(`Found ${related.length} indirectly connected entities`);
        lines.push(`\n**Extended network (top ${Math.min(related.length, 15)}):**`);
        for (const r of related.slice(0, 15)) {
          const conn = store.getRelationships(r.id).find(rel => {
            const otherId = rel.sourceId === r.id ? rel.targetId : rel.sourceId;
            return otherId === entity.id || store.getRelatedEntities(entity.id, 1).some(e => e.id === r.id);
          });
          const via = conn ? ` via ${conn.type.replace(/_/g, '')}` : '';
          lines.push(`  • ${r.name} (${r.type})${via}`);
        }
      }

      ctx?.onThought?.(`✅ Connection trace complete for ${entity.name}`);
      return { success: true, content: lines.join('\n') };
    },
  },
  {
    id: 'neura_stats',
    name: 'neura_stats',
    description: 'Get statistics about the knowledge graph — how many entities, relationships, top entities, and recent activity.',
    schema: {
      type: 'object',
      properties: {},
    },
    execute: async (_args, ctx?: ToolContext) => {
      ctx?.onThought?.('📊 Aggregating Neura knowledge graph stats...');
      const store = useKnowledgeGraphStore.getState();
      const { entities, relationships } = store;
      ctx?.onThought?.(`${entities.length} entities, ${relationships.length} relationships in index`);

      const top = [...entities].sort((a, b) => b.mentionCount - a.mentionCount).slice(0, 10);
      const recent = [...entities].sort((a, b) => b.lastMentioned - a.lastMentioned).slice(0, 5);

      const typeCount: Record<string, number> = {};
      for (const e of entities) {
        typeCount[e.type] = (typeCount[e.type] || 0) + 1;
      }
      ctx?.onThought?.(`Entity types: ${Object.entries(typeCount).map(([t, c]) => `${t} (${c})`).join(', ')}`);

      const lines: string[] = [
        '## Neura Knowledge Graph',
        `**${entities.length}** entities · **${relationships.length}** relationships\n`,
        '**Entity types:**',
        ...Object.entries(typeCount).sort((a, b) => b[1] - a[1]).map(([t, c]) => `  • ${t}: ${c}`),
        '',
        '**Most referenced:**',
        ...top.map((e, i) => `  ${i + 1}. ${e.name} (${e.type}) — ${e.mentionCount}x mentions`),
        '',
        '**Recently active:**',
        ...recent.map(e => `  • ${e.name} — last mentioned ${new Date(e.lastMentioned).toLocaleDateString()}`),
      ];

      ctx?.onThought?.('✅ Neura stats ready');
      return { success: true, content: lines.join('\n') };
    },
  },
];
