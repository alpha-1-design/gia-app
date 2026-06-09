import { create } from 'zustand';

export interface SearchEvent {
  id: string;
  type: 'query' | 'fetch' | 'result' | 'error' | 'info';
  message: string;
  url?: string;
  timestamp: number;
  done: boolean;
}

interface SearchActivityState {
  active: boolean;
  events: SearchEvent[];
  sources: { title: string; url: string; snippet: string; source: string }[];
  panelOpen: boolean;
  queryCount: number;
  fetchCount: number;
  startSearch: () => void;
  endSearch: () => void;
  addEvent: (ev: Omit<SearchEvent, 'id' | 'timestamp'>) => void;
  completeEvent: (message: string) => void;
  addSource: (s: { title: string; url: string; snippet: string; source: string }) => void;
  setPanelOpen: (v: boolean) => void;
  clear: () => void;
}

let evId = 0;

export const useSearchActivity = create<SearchActivityState>((set) => ({
  active: false,
  events: [],
  sources: [],
  panelOpen: false,
  queryCount: 0,
  fetchCount: 0,

  startSearch: () => set({ active: true, queryCount: 0, fetchCount: 0 }),

  endSearch: () => set({ active: false }),

  addEvent: (ev) => {
    const event: SearchEvent = { ...ev, id: `sev_${++evId}`, timestamp: Date.now() };
    set(s => ({
      events: [...s.events, event],
      queryCount: s.queryCount + (ev.type === 'query' ? 1 : 0),
      fetchCount: s.fetchCount + (ev.type === 'fetch' ? 1 : 0),
    }));
  },

  completeEvent: (message) => set(s => ({
    events: s.events.map(e => e.message === message ? { ...e, done: true } : e),
  })),

  addSource: (src) => set(s => {
    if (s.sources.find(x => x.url === src.url)) return s;
    return { sources: [...s.sources, src] };
  }),

  setPanelOpen: (v) => set({ panelOpen: v }),

  clear: () => set({ events: [], sources: [], active: false, queryCount: 0, fetchCount: 0 }),
}));
