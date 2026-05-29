import { useMemoryStore, MemoryCategory, MemoryTier } from '../store/useMemoryStore';
import { useGiaStore } from '../store/useGiaStore';
import { useGiaIdentity } from '../store/useGiaIdentity';
import { useProviderStore } from '../store/useProviderStore';

export interface BrainDump {
  version: 1;
  exportedAt: string;
  gia: {
    name: string;
    personalityStyle: string;
    customPrompt: string;
    avatarIcon: string;
    focusAreas: string[];
    proactiveness: number;
    allowsMemory: boolean;
    tone: string;
  };
  memories: {
    id: string;
    key: string;
    value: string;
    category: string;
    tier: string;
    timestamp: number;
    lastAccessed: number;
    confidence: number;
  }[];
  pinnedMemories: string[];
  skills: {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
    tools: string[];
    category: string;
  }[];
  userProfile: {
    name: string;
    bio: string;
    goals: string;
  };
  customInstructions: string;
}

export interface CloudConfig {
  url: string;
  username: string;
  password: string;
  enabled: boolean;
}

const STORAGE_KEY = 'gia-cloud-config';

export function loadCloudConfig(): CloudConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { url: '', username: '', password: '', enabled: false };
}

export function saveCloudConfig(config: CloudConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function serializeBrain(): BrainDump {
  const identity = useGiaIdentity.getState().identity;
  const memStore = useMemoryStore.getState();
  const giaStore = useGiaStore.getState();
  const memories = memStore.memories.map((m) => ({
    id: m.id,
    key: m.key,
    value: m.value,
    category: m.category,
    tier: (m as any).tier || 'semantic',
    timestamp: m.timestamp,
    lastAccessed: m.lastAccessed,
    confidence: (m as any).confidence || 1,
  }));

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    gia: {
      name: identity.name,
      personalityStyle: identity.personalityStyle,
      customPrompt: identity.customPrompt,
      avatarIcon: identity.avatarIcon,
      focusAreas: identity.focusAreas,
      proactiveness: identity.proactiveness,
      allowsMemory: identity.allowsMemory,
      tone: identity.tone,
    },
    memories,
    pinnedMemories: giaStore.pinnedMemories,
    skills: giaStore.skills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      systemPrompt: s.systemPrompt,
      tools: s.tools,
      category: s.category,
    })),
    userProfile: { ...giaStore.userProfile },
    customInstructions: giaStore.customInstructions,
  };
}

export function exportBrainToFile(): void {
  const data = serializeBrain();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gia-brain-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function importBrainFromFile(file: File): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data: BrainDump = JSON.parse(e.target?.result as string);
        if (!data.version || !data.memories || !data.gia) {
          resolve({ success: false, message: 'Invalid brain file format.' });
          return;
        }

        const memStore = useMemoryStore.getState();
        if (data.memories.length > 0) {
          data.memories.forEach((m) => {
            memStore.addMemory({ key: m.key, value: m.value, category: m.category as MemoryCategory, tier: m.tier as MemoryTier, confidence: m.confidence });
          });
        }

        const giaStore = useGiaStore.getState();
        if (data.pinnedMemories.length > 0) {
          useGiaStore.setState({ pinnedMemories: data.pinnedMemories });
        }
        if (data.skills.length > 0) {
          data.skills.forEach((s) => {
            const exists = giaStore.skills.find((existing) => existing.id === s.id);
            if (!exists) {
              giaStore.addSkill({
                id: s.id,
                name: s.name,
                description: s.description,
                systemPrompt: s.systemPrompt,
                tools: s.tools,
                category: s.category as any,
              });
            }
          });
        }
        if (data.userProfile.name) {
          giaStore.setUserProfile(data.userProfile);
        }
        if (data.customInstructions) {
          giaStore.setCustomInstructions(data.customInstructions);
        }

        const identityStore = useGiaIdentity.getState();
        if (data.gia.name) {
          identityStore.setName(data.gia.name);
          identityStore.setPersonality(data.gia.personalityStyle as any);
          identityStore.setCustomPrompt(data.gia.customPrompt);
          identityStore.setAvatar(data.gia.avatarIcon);
          identityStore.setFocusAreas(data.gia.focusAreas);
          identityStore.setProactiveness(data.gia.proactiveness);
          identityStore.setAllowsMemory(data.gia.allowsMemory);
          identityStore.setTone(data.gia.tone);
        }

        resolve({
          success: true,
          message: `Imported ${data.memories.length} memories, ${data.skills.length} skills, and GIA identity.`,
        });
      } catch {
        resolve({ success: false, message: 'Failed to parse brain file.' });
      }
    };
    reader.onerror = () => resolve({ success: false, message: 'Failed to read file.' });
    reader.readAsText(file);
  });
}

export async function exportBrainToCloud(config: CloudConfig): Promise<string> {
  const data = serializeBrain();
  const body = JSON.stringify(data, null, 2);

  try {
    const res = await fetch(config.url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(config.username ? { Authorization: 'Basic ' + btoa(`${config.username}:${config.password}`) } : {}),
      },
      body,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return 'Brain uploaded to cloud successfully.';
  } catch (e: any) {
    throw new Error(`Cloud upload failed: ${e.message}`);
  }
}
