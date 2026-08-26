import { useKnowledgeGraphStore } from '../../store/useKnowledgeGraphStore';
import { useMemoryStore } from '../../store/useMemoryStore';
import type { Tool, ToolContext } from './types';

const ENTITY_TYPES = ['person', 'project', 'concept', 'location', 'organization', 'event', 'technology', 'tool', 'topic', 'habit', 'goal', 'preference'] as const;

export const neuraTools: Tool[] = [
  {
    id: 'neura_query',
    name: 'neura_query',
    description: 'Query the knowledge graph (Neura) for entities and relationships related to a topic. Returns known people, projects, concepts, locations, and how they connect, ranked by semantic relevance, recency and graph centrality. Use this when you need to recall what GIA has learned about someone or something.',
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
      // searchEntities scores semantic overlap + recency + graph centrality,
      // so the most relevant, well-connected knowledge surfaces first.
      const entities = store.searchEntities(q).slice(0, limit);

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

        lines.push(`**${entity.name}** (${entity.type}) — confidence ${(entity.confidence * 100).toFixed(0)}%, mentioned ${entity.mentionCount}x, ${rels.length} connection${rels.length === 1 ? '' : 's'}`);
        if (entity.description) lines.push(`  ${entity.description}`);
        if (entity.aliases.length > 0) lines.push(`  Also known as: ${entity.aliases.join(', ')}`);

        if (rels.length > 0) {
          ctx?.onThought?.(`  ${rels.length} connection${rels.length > 1 ? 's' : ''} to explore`);
          lines.push(`  Connections:`);
          for (const rel of rels.sort((a, b) => b.strength - a.strength).slice(0, 5)) {
            const target = store.getEntity(rel.sourceId === entity.id ? rel.targetId : rel.sourceId);
            if (target) {
              lines.push(`    → ${rel.type.replace(/_/g, ' ')} (${(rel.strength * 100).toFixed(0)}%) → ${target.name}`);
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
    description: 'Find entities connected to a specific entity in the knowledge graph, up to N degrees of separation. Traces the actual paths between entities so you can see HOW they are connected, not just that they are. Useful for exploring networks, finding links between two topics, and understanding context.',
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
      const rels = store.getRelationships(entity.id);
      const relByTarget = new Map<string, { type: string; strength: number }>();
      for (const rel of rels) {
        const otherId = rel.sourceId === entity.id ? rel.targetId : rel.sourceId;
        const existing = relByTarget.get(otherId);
        if (!existing || rel.strength > existing.strength) {
          relByTarget.set(otherId, { type: rel.type.replace(/_/g, ' '), strength: rel.strength });
        }
      }

      // BFS with path tracking so we can report the actual chain of connections.
      const paths = new Map<string, string[]>();
      const queue: { id: string; depth: number; path: string[] }[] = [{ id: entity.id, depth: 0, path: [] }];
      const visited = new Set<string>([entity.id]);
      while (queue.length > 0) {
        const { id: curId, depth: curDepth, path } = queue.shift()!;
        if (curDepth >= d) continue;
        for (const rel of store.getRelationships(curId)) {
          const nextId = rel.sourceId === curId ? rel.targetId : rel.sourceId;
          if (visited.has(nextId)) continue;
          visited.add(nextId);
          const nextPath = [...path, `${curId}:${rel.type}`];
          paths.set(nextId, nextPath);
          queue.push({ id: nextId, depth: curDepth + 1, path: nextPath });
        }
      }

      const related = [...paths.keys()]
        .map((id) => store.getEntity(id))
        .filter((e): e is NonNullable<typeof e> => Boolean(e));

      ctx?.onThought?.(`${rels.length} direct connections, ${related.length} entities in extended network`);

      const lines: string[] = [
        `**${entity.name}** (${entity.type}) — ${entity.description || 'No description'}`,
        `Direct connections: ${rels.length}, Network (depth ${d}): ${related.length} entities\n`,
      ];

      if (rels.length > 0) {
        lines.push('**Direct relationships:**');
        for (const rel of rels.sort((a, b) => b.strength - a.strength).slice(0, 10)) {
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
          const path = paths.get(r.id);
          const firstRel = path && path.length > 0 ? path[0] : undefined;
          const via = firstRel ? ` via ${firstRel.split(':')[1]}` : '';
          const direct = relByTarget.get(r.id);
          const hint = direct ? ` — ${direct.type} (${(direct.strength * 100).toFixed(0)}%)` : via;
          lines.push(`  • ${r.name} (${r.type})${hint}`);
        }
      }

      ctx?.onThought?.(`✅ Connection trace complete for ${entity.name}`);
      return { success: true, content: lines.join('\n') };
    },
  },
  {
    id: 'neura_stats',
    name: 'neura_stats',
    description: 'Get statistics about the knowledge graph — how many entities, relationships, network density, top entities, hub nodes, and recent activity. Use this to understand how much GIA knows and how interconnected that knowledge is.',
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

      // Network density: how interconnected is the knowledge?
      const degree = new Map<string, number>();
      for (const r of relationships) {
        degree.set(r.sourceId, (degree.get(r.sourceId) || 0) + 1);
        degree.set(r.targetId, (degree.get(r.targetId) || 0) + 1);
      }
      const connected = entities.filter((e) => (degree.get(e.id) || 0) > 0).length;
      const avgDegree = entities.length > 0 ? relationships.length * 2 / entities.length : 0;
      const hubs = [...entities]
        .sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0))
        .filter((e) => (degree.get(e.id) || 0) > 0)
        .slice(0, 5);

      const typeCount: Record<string, number> = {};
      for (const e of entities) {
        typeCount[e.type] = (typeCount[e.type] || 0) + 1;
      }
      ctx?.onThought?.(`Entity types: ${Object.entries(typeCount).map(([t, c]) => `${t} (${c})`).join(', ')}`);

      const lines: string[] = [
        '## Neura Knowledge Graph',
        `**${entities.length}** entities · **${relationships.length}** relationships\n`,
        `**Network density:** ${connected}/${entities.length} entities connected · avg ${avgDegree.toFixed(1)} connections/entity`,
        '**Entity types:**',
        ...Object.entries(typeCount).sort((a, b) => b[1] - a[1]).map(([t, c]) => `  • ${t}: ${c}`),
      ];

      if (hubs.length > 0) {
        lines.push('', '**Hubs (most connected):**');
        for (const h of hubs) {
          lines.push(`  • ${h.name} (${h.type}) — ${degree.get(h.id)} connections`);
        }
      }

      lines.push('', '**Most referenced:**');
      for (const [i, e] of top.entries()) {
        lines.push(`  ${i + 1}. ${e.name} (${e.type}) — ${e.mentionCount}x mentions`);
      }

      lines.push('', '**Recently active:**');
      for (const e of recent) {
        lines.push(`  • ${e.name} — last mentioned ${new Date(e.lastMentioned).toLocaleDateString()}`);
      }

      ctx?.onThought?.('✅ Neura stats ready');
      return { success: true, content: lines.join('\n') };
    },
  },
  {
    id: 'neura_add',
    name: 'neura_add',
    description: 'Add a new entity or relationship to the knowledge graph (Neura). Use this when you discover new information, concepts, people, or connections during a conversation. Entities are stored permanently, auto-linked to related knowledge, and can be queried later with neura_query.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Entity name (e.g. "GPT-5", "Quantum Computing", "Alice Chen")' },
        type: { type: 'string', enum: [...ENTITY_TYPES], description: 'Entity type' },
        description: { type: 'string', description: 'What GIA knows about this entity — description, context, key facts' },
        aliases: { type: 'string', description: 'Comma-separated alternative names' },
        confidence: { type: 'number', description: 'Confidence level 0.0-1.0 (default 0.7)' },
      },
      required: ['name', 'type', 'description'],
    },
    execute: async ({ name, type, description, aliases, confidence }, _ctx?: ToolContext) => {
      const n = String(name ?? '');
      const t = String(type ?? 'concept') as import('../../types/knowledge').EntityType;
      const d = String(description ?? '');
      const al = String(aliases ?? '').split(',').map(s => s.trim()).filter(Boolean);
      const conf = Math.min(1, Math.max(0, Number(confidence) || 0.7));

      const store = useKnowledgeGraphStore.getState();
      const existing = store.findEntity(n);
      if (existing) {
        store.addEntity({
          name: n, type: t,
          aliases: al.length > 0 ? al : existing.aliases,
          description: d || existing.description,
          confidence: Math.max(existing.confidence, conf),
          metadata: { ...existing.metadata, lastUpdated: Date.now().toString() },
        });
        return { success: true, content: `✅ Updated existing entity "${n}" in Neura with new knowledge.` };
      }

      store.addEntity({
        name: n, type: t,
        aliases: al,
        description: d,
        confidence: conf,
        metadata: { source: 'neura_add', addedAt: Date.now().toString() },
      });
      _ctx?.onThought?.(`🧠 Added "${n}" (${t}) to Neura knowledge graph`);
      return { success: true, content: `✅ Added "${n}" (${t}) to Neura knowledge graph.\n  Description: ${d}` };
    },
  },
  {
    id: 'neura_evolve',
    name: 'neura_evolve',
    description: 'Show how the knowledge graph has evolved — recently added entities, confidence growth, new connections formed, and learning velocity. Use this to understand what GIA has been learning and how her understanding is deepening.',
    schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'How many days back to analyze (default 7)' },
      },
    },
    execute: async ({ days }, ctx?: ToolContext) => {
      const d = Math.max(1, Math.min(365, Number(days) || 7));
      const cutoff = Date.now() - d * 86400000;
      ctx?.onThought?.(`📈 Analyzing Neura evolution over the last ${d} days...`);
      const store = useKnowledgeGraphStore.getState();
      const { entities, relationships, mentions } = store;

      const recentEntities = entities.filter(e => e.firstMentioned > cutoff);
      const recentMentions = mentions.filter(m => m.timestamp > cutoff);

      const grown = entities
        .filter(e => {
          const entMentions = mentions.filter(m => m.entityId === e.id && m.timestamp > cutoff);
          return entMentions.length > 1;
        })
        .sort((a, b) => b.mentionCount - a.mentionCount)
        .slice(0, 5);

      const newRels = relationships.filter(r => r.firstObserved > cutoff);

      ctx?.onThought?.(`${recentEntities.length} new entities, ${newRels.length} new connections, ${recentMentions.length} total mentions`);
      ctx?.onThought?.('✅ Evolution analysis complete');

      const lines: string[] = [
        `## Neura Evolution (last ${d} days)\n`,
        `**Growth:** ${recentEntities.length} new entities · ${newRels.length} new connections · ${recentMentions.length} mentions\n`,
      ];

      if (recentEntities.length > 0) {
        lines.push('**New knowledge added:**');
        for (const e of recentEntities.slice(0, 8)) {
          const shortDesc = e.description ? e.description.slice(0, 80) : 'No description';
          lines.push(`  • ${e.name} (${e.type}) — ${shortDesc}`);
        }
        lines.push('');
      }

      if (grown.length > 0) {
        lines.push('**Deepening understanding:**');
        for (const e of grown) {
          lines.push(`  • ${e.name} — now at ${(e.confidence * 100).toFixed(0)}% confidence (${e.mentionCount} mentions)`);
        }
        lines.push('');
      }

      if (newRels.length > 0) {
        lines.push('**New connections formed:**');
        for (const r of newRels.slice(0, 8)) {
          const source = store.getEntity(r.sourceId);
          const target = store.getEntity(r.targetId);
          if (source && target) {
            lines.push(`  • ${source.name} → ${r.type.replace(/_/g, ' ')} → ${target.name}`);
          }
        }
      }

      return { success: true, content: lines.join('\n') };
    },
  },
  {
    id: 'neura_forget',
    name: 'neura_forget',
    description: 'Delete an entity from the knowledge graph (Neura). Removes the entity along with all its relationships and mention history. Use this when knowledge is wrong, outdated, or the user asks GIA to forget something. The deletion is permanent.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name (or alias) of the entity to delete' },
      },
      required: ['name'],
    },
    execute: async ({ name }, ctx?: ToolContext) => {
      const q = String(name ?? '').trim();
      if (!q) return { success: true, content: 'No entity name provided. Pass the name of the entity to forget.' };
      ctx?.onThought?.(`🧹 Searching Neura for "${q}" to forget...`);
      const store = useKnowledgeGraphStore.getState();
      const entity = store.findEntity(q);

      if (!entity) {
        const fuzzy = store.searchEntities(q);
        if (fuzzy.length > 0) {
          ctx?.onThought?.(`No exact match — did you mean ${fuzzy.slice(0, 3).map(e => e.name).join(', ')}?`);
          return {
            success: true,
            content: `No entity named "${q}" found. Did you mean: ${fuzzy.slice(0, 3).map(e => `"${e.name}"`).join(', ')}?`,
          };
        }
        ctx?.onThought?.(`No entity named "${q}" in the knowledge graph`);
        return { success: true, content: `No entity named "${q}" exists in the knowledge graph.` };
      }

      const relCount = store.getRelationships(entity.id).length;
      store.deleteEntity(entity.id);
      ctx?.onThought?.(`🗑️ Forgotten ${entity.name} (${entity.type}) and ${relCount} connections`);
      return {
        success: true,
        content: `🗑️ Forgotten "${entity.name}" (${entity.type}) — removed ${relCount} associated connection${relCount === 1 ? '' : 's'} and all mention history.`,
      };
    },
  },
  {
    id: 'neura_merge',
    name: 'neura_merge',
    description: 'Merge two entities that are actually the same thing (e.g. "Elon" and "Elon Musk" stored as duplicates). Combines their aliases, keeps the richer description, sums mentions, and rewires all relationships to the surviving entity. Use this to clean up the knowledge graph.',
    schema: {
      type: 'object',
      properties: {
        keep: { type: 'string', description: 'Name of the entity to keep (the canonical name)' },
        drop: { type: 'string', description: 'Name of the duplicate entity to merge into the kept one' },
      },
      required: ['keep', 'drop'],
    },
    execute: async ({ keep, drop }, ctx?: ToolContext) => {
      const keepName = String(keep ?? '').trim();
      const dropName = String(drop ?? '').trim();
      if (!keepName || !dropName) {
        return { success: true, content: 'Both "keep" and "drop" names are required for neura_merge.' };
      }
      ctx?.onThought?.(`🔀 Merging "${dropName}" into "${keepName}"...`);
      const store = useKnowledgeGraphStore.getState();
      const keepEntity = store.findEntity(keepName);
      const dropEntity = store.findEntity(dropName);

      if (!keepEntity && !dropEntity) {
        return { success: true, content: `Neither "${keepName}" nor "${dropName}" exists in the knowledge graph.` };
      }
      if (!keepEntity) {
        return { success: true, content: `Entity "${keepName}" not found — cannot merge. Did you mean: ${store.searchEntities(keepName).slice(0, 3).map(e => `"${e.name}"`).join(', ')}?` };
      }
      if (!dropEntity) {
        return { success: true, content: `Entity "${dropName}" not found — nothing to merge. Did you mean: ${store.searchEntities(dropName).slice(0, 3).map(e => `"${e.name}"`).join(', ')}?` };
      }
      if (keepEntity.id === dropEntity.id) {
        return { success: true, content: `"${keepName}" and "${dropName}" are already the same entity — nothing to merge.` };
      }

      const droppedRels = store.getRelationships(dropEntity.id).length;
      store.mergeEntities(keepEntity.id, dropEntity.id);
      ctx?.onThought?.(`✅ Merged ${dropEntity.name} into ${keepEntity.name} — ${droppedRels} relationships rewired`);
      return {
        success: true,
        content: `🔀 Merged "${dropEntity.name}" into "${keepEntity.name}".\n  • Aliases combined (${dropEntity.aliases.length} added)\n  • ${droppedRels} relationships rewired to "${keepEntity.name}"\n  • Mentions summed (now ${keepEntity.mentionCount + dropEntity.mentionCount})`,
      };
    },
  },
];
