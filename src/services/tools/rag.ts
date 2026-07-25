import type { Tool } from './types';
import RAGService from '../RAGService';
import ToolRegistry from '../ToolRegistry';

export const ragTools: Tool[] = [
  {
    id: 'rag_search',
    name: 'rag_search',
    description: 'Search your indexed documents using semantic similarity. Finds relevant passages from PDFs, docs, and other content you have indexed.',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query — what you want to find in the documents' },
        topK: { type: 'number', description: 'Number of results to return (default: 5, max: 20)' },
      },
      required: ['query'],
    },
    async execute(args: Record<string, unknown>) {
      const query = String(args.query);
      const topK = Math.min(Number(args.topK) || 5, 20);

      try {
        const stats = await RAGService.getStats();
        if (stats.chunkCount === 0) {
          return { success: true, content: 'No documents have been indexed yet. Upload documents in Settings → Knowledge → Documents tab first.' };
        }

        const results = await RAGService.search(query, topK);

        if (results.length === 0) {
          return { success: true, content: 'No relevant results found for your query.' };
        }

        const lines: string[] = [`Found ${results.length} relevant passages from ${new Set(results.map(r => r.title)).size} documents:\n`];

        for (const r of results) {
          lines.push(`**${r.title}** (relevance: ${(r.score * 100).toFixed(0)}%)`);
          lines.push(`> ${r.text.slice(0, 600)}`);
          lines.push('');
        }

        return { success: true, content: lines.join('\n') };
      } catch (e) {
        return { success: false, content: '', error: `RAG search failed: ${e instanceof Error ? e.message : 'Unknown error'}` };
      }
    },
  },
  {
    id: 'rag_list_docs',
    name: 'rag_list_docs',
    description: 'List all documents that have been indexed in the RAG knowledge base.',
    schema: { type: 'object', properties: {} },
    async execute() {
      try {
        const docs = await RAGService.listDocuments();
        if (docs.length === 0) {
          return { success: true, content: 'No documents indexed yet.' };
        }

        const stats = await RAGService.getStats();
        const lines = [`**Indexed Documents (${docs.length} docs, ${stats.chunkCount} chunks):**\n`];

        for (const d of docs) {
          const date = new Date(d.createdAt).toLocaleDateString();
          const size = d.charCount > 10000 ? `${(d.charCount / 1000).toFixed(0)}KB` : `${d.charCount} chars`;
          lines.push(`- **${d.title}** — ${d.chunkCount} chunks, ${size} (${date})`);
        }

        return { success: true, content: lines.join('\n') };
      } catch (e) {
        return { success: false, content: '', error: `Failed to list documents: ${e instanceof Error ? e.message : 'Unknown error'}` };
      }
    },
  },
];


export function registerRagTools() {
  for (const tool of ragTools) ToolRegistry.register(tool);
}
