import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';
import { genId } from '../utils/id';
import RAGService from '../services/RAGService';
import PDFService from '../services/PDFService';

export interface AgentFile {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: number;
}

export interface CustomAgent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  icon: string;
  createdAt: number;
  files: AgentFile[];
  tools: string[];
}

export interface AgentSource {
  fileName: string;
  score: number;
  excerpt: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  sources?: AgentSource[];
}

interface AgentStore {
  agents: CustomAgent[];
  chatSessions: Record<string, AgentMessage[]>;
  addAgent: (agent: Omit<CustomAgent, 'id' | 'createdAt' | 'files'>) => CustomAgent;
  updateAgentTools: (id: string, tools: string[]) => void;
  updateAgent: (id: string, updates: Partial<CustomAgent>) => void;
  removeAgent: (id: string) => void;
  addFileToAgent: (agentId: string, file: File) => Promise<void>;
  removeFileFromAgent: (agentId: string, fileId: string) => void;
  getAgent: (id: string) => CustomAgent | undefined;
  addMessage: (agentId: string, msg: AgentMessage) => void;
  clearChat: (agentId: string) => void;
}

function agentNamespace(agentId: string): string {
  return `agent:${agentId}:`;
}

async function extractFileText(file: File): Promise<string> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (isPdf) {
    // Raw PDF bytes decoded as UTF-8 text (the old file.text() path) produce
    // garbled binary with almost no sentence boundaries, which used to blow
    // up into a single multi-megabyte "chunk" during indexing below and lock
    // the main thread — this looked like the upload just hanging forever.
    return PDFService.extractText(file);
  }
  return file.text();
}

export async function indexAgentFile(agentId: string, file: File): Promise<void> {
  const text = await extractFileText(file);
  const docId = `${agentNamespace(agentId)}${file.name}`;
  await RAGService.indexDocument(docId, file.name, text);
}

export async function searchAgentRAG(agentId: string, query: string, topK = 5) {
  return RAGService.search(query, topK, agentNamespace(agentId));
}

export const useAgentStore = create<AgentStore>()(
  persist(
    (set, get) => ({
      agents: [],
      chatSessions: {},

      addAgent: (input) => {
        const agent: CustomAgent = {
          ...input,
          id: genId(),
          createdAt: Date.now(),
          files: [],
          tools: input.tools || [],
        };
        set(s => ({ agents: [...s.agents, agent] }));
        return agent;
      },

      updateAgent: (id, updates) => {
        set(s => ({
          agents: s.agents.map(a => a.id === id ? { ...a, ...updates } : a),
        }));
      },

      updateAgentTools: (id, tools) => {
        set(s => ({
          agents: s.agents.map(a => a.id === id ? { ...a, tools } : a),
        }));
      },

      removeAgent: (id) => {
        set(s => {
          const rest: Record<string, AgentMessage[]> = {};
          for (const key of Object.keys(s.chatSessions)) {
            if (key !== id) rest[key] = s.chatSessions[key];
          }
          return {
            agents: s.agents.filter(a => a.id !== id),
            chatSessions: rest,
          };
        });
      },

      addFileToAgent: async (agentId, file) => {
        const agentFile: AgentFile = {
          id: genId(),
          name: file.name,
          type: file.type,
          size: file.size,
          uploadedAt: Date.now(),
        };
        set(s => ({
          agents: s.agents.map(a =>
            a.id === agentId
              ? { ...a, files: [...a.files, agentFile] }
              : a
          ),
        }));
        await indexAgentFile(agentId, file);
      },

      removeFileFromAgent: (agentId, fileId) => {
        const agent = get().agents.find(a => a.id === agentId);
        if (!agent) return;
        const file = agent.files.find(f => f.id === fileId);
        if (!file) return;
        const docId = `${agentNamespace(agentId)}${file.name}`;
        RAGService.deleteDocument(docId).catch(() => {});
        set(s => ({
          agents: s.agents.map(a =>
            a.id === agentId
              ? { ...a, files: a.files.filter(f => f.id !== fileId) }
              : a
          ),
        }));
      },

      getAgent: (id) => {
        return get().agents.find(a => a.id === id);
      },

      addMessage: (agentId, msg) => {
        set(s => ({
          chatSessions: {
            ...s.chatSessions,
            [agentId]: [...(s.chatSessions[agentId] || []), msg],
          },
        }));
      },

      clearChat: (agentId) => {
        set(s => ({
          chatSessions: {
            ...s.chatSessions,
            [agentId]: [],
          },
        }));
      },
    }),
    {
      name: 'gia-agents',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        agents: state.agents,
        chatSessions: state.chatSessions,
      }),
    }
  )
);
