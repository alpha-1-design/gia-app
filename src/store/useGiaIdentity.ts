import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';

export type PersonalityStyle = 'warm' | 'professional' | 'witty' | 'direct' | 'custom';

export interface GiaIdentity {
  name: string;
  personalityStyle: PersonalityStyle;
  customPrompt: string;
  avatarIcon: string;
  focusAreas: string[];
  proactiveness: number;
  allowsMemory: boolean;
  tone: string;
}

interface GiaIdentityState {
  identity: GiaIdentity;
  setName: (name: string) => void;
  setPersonality: (style: PersonalityStyle) => void;
  setCustomPrompt: (p: string) => void;
  setAvatar: (icon: string) => void;
  setFocusAreas: (areas: string[]) => void;
  setProactiveness: (v: number) => void;
  setAllowsMemory: (v: boolean) => void;
  setTone: (tone: string) => void;
  resetIdentity: () => void;
}

const DEFAULT_IDENTITY: GiaIdentity = {
  name: 'GIA',
  personalityStyle: 'warm',
  customPrompt: '',
  avatarIcon: 'Sparkles',
  focusAreas: [],
  proactiveness: 0.5,
  allowsMemory: true,
  tone: 'casual',
};

export const useGiaIdentity = create<GiaIdentityState>()(
  persist(
    (set) => ({
      identity: { ...DEFAULT_IDENTITY },
      setName: (name) => set((s) => ({ identity: { ...s.identity, name } })),
      setPersonality: (personalityStyle) => set((s) => ({ identity: { ...s.identity, personalityStyle } })),
      setCustomPrompt: (customPrompt) => set((s) => ({ identity: { ...s.identity, customPrompt } })),
      setAvatar: (avatarIcon) => set((s) => ({ identity: { ...s.identity, avatarIcon } })),
      setFocusAreas: (focusAreas) => set((s) => ({ identity: { ...s.identity, focusAreas } })),
      setProactiveness: (proactiveness) => set((s) => ({ identity: { ...s.identity, proactiveness } })),
      setAllowsMemory: (allowsMemory) => set((s) => ({ identity: { ...s.identity, allowsMemory } })),
      setTone: (tone) => set((s) => ({ identity: { ...s.identity, tone } })),
      resetIdentity: () => set({ identity: { ...DEFAULT_IDENTITY } }),
    }),
    {
      name: 'gia-identity-v1',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
