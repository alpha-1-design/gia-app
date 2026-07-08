import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGiaState = {
  userProfile: { name: '', bio: '', goals: '' },
  activeSkillId: null as string | null,
  skills: [] as { id: string; name: string; description: string }[],
  extThinking: false,
  customInstructions: '',
  pinnedMemories: [] as string[],
  handsOff: false,
  sessions: [] as unknown[],
};

const mockIdentityState = {
  identity: {
    name: 'GIA',
    personalityStyle: 'warm',
    customPrompt: '',
    focusAreas: [] as string[],
    proactiveness: 0.5,
    tone: 'casual',
  },
};

const mockMemoryState = {
  memories: [] as unknown[],
  getRelevantContext: vi.fn(() => ''),
};

const mockProviderState = {
  activeProvider: 'openai',
  providers: {
    openai: { enabled: true, apiKey: 'sk-test', model: 'gpt-4o' },
  },
  availableModels: {
    openai: [
      { id: 'gpt-4o', label: 'GPT-4o', free: false, tools: true, vision: true, context: { length: 128000 } },
    ],
  },
};

let mockGetState: Record<string, unknown> = {};

vi.mock('../../store/useGiaStore', () => ({
  useGiaStore: {
    getState: vi.fn(() => mockGetState.gia || mockGiaState),
  },
}));

vi.mock('../../store/useMemoryStore', () => ({
  useMemoryStore: {
    getState: vi.fn(() => mockGetState.memory || mockMemoryState),
  },
}));

vi.mock('../../store/useProviderStore', () => ({
  useProviderStore: {
    getState: vi.fn(() => mockGetState.provider || mockProviderState),
  },
}));

vi.mock('../../store/useGiaIdentity', () => ({
  useGiaIdentity: {
    getState: vi.fn(() => mockGetState.identity || mockIdentityState),
  },
}));

vi.mock('../../utils/helpers', () => ({
  isNativePlatform: vi.fn(() => false),
}));

vi.mock('../../config/gia-identity', () => ({
  GIA_VOICE: {
    name: 'GIA',
    subtitle: 'Your Co-Work Agent',
    tagline: 'Built for the work, built for you.',
    traits: ['Direct but warm', 'Gets excited about good ideas'],
    speech: {
      openings: ['Here we go.', 'Let\'s get into it.', 'Alright —'],
      confirmations: ['Got it.', 'On it.', 'Done.'],
    },
    rules: ['Be direct', 'Use tools', 'Stay helpful'],
    context: {
      chat: { tone: 'conversational', energy: 'moderate', warmth: 'high' },
      debugging: { tone: 'technical', energy: 'focused', warmth: 'medium' },
      planning: { tone: 'strategic', energy: 'measured', warmth: 'medium' },
      writing: { tone: 'creative', energy: 'high', warmth: 'medium' },
    },
  },
}));

const { buildGiaSystem } = await import('../buildGiaSystem');

describe('buildGiaSystem', () => {
  beforeEach(() => {
    mockGetState = {};
    vi.clearAllMocks();
  });

  it('returns a string', () => {
    const result = buildGiaSystem();
    expect(typeof result).toBe('string');
  });

  it('contains GIA name in the prompt', () => {
    const result = buildGiaSystem();
    expect(result).toContain('GIA');
  });

  it('includes tool table with web_search', () => {
    const result = buildGiaSystem();
    expect(result).toContain('web_search');
    expect(result).toContain('terminal_run');
  });

  it('includes user name when provided', () => {
    mockGetState.gia = {
      ...mockGiaState,
      userProfile: { name: 'Alice', bio: 'Developer', goals: 'Build great things' },
    };
    const result = buildGiaSystem();
    expect(result).toContain('Alice');
    expect(result).toContain('Developer');
    expect(result).toContain('Build great things');
  });

  it('includes memory context when provided', () => {
    mockGetState.memory = {
      ...mockMemoryState,
      memories: [{ id: 'mem-1', key: 'user_name', value: 'Alice', category: 'profile', tier: 'core', confidence: 0.9, createdAt: 0, updatedAt: 0 }],
      getRelevantContext: vi.fn(() => '\n\n## What GIA remembers:\n- user_name: Alice\n'),
    };
    const result = buildGiaSystem();
    expect(result).toContain('What GIA remembers');
  });

  it('includes custom instructions when set', () => {
    mockGetState.gia = {
      ...mockGiaState,
      userProfile: { name: 'Alice', bio: '', goals: '' },
      customInstructions: 'Always respond in French.',
    };
    const result = buildGiaSystem('test');
    expect(result).toContain('French');
  });

  it('includes active skill section', () => {
    mockGetState.gia = {
      ...mockGiaState,
      activeSkillId: 'skill-1',
      skills: [{ id: 'skill-1', name: 'Coding', description: 'Help with code', systemPrompt: 'Focus on best practices.' }],
    };
    const result = buildGiaSystem();
    expect(result).toContain('Coding');
    expect(result).toContain('best practices');
  });

  it('uses "the user" when no name is provided', () => {
    const result = buildGiaSystem();
    expect(result).toContain('the user');
  });

  it('includes provider and model info', () => {
    const result = buildGiaSystem();
    expect(result).toContain('OPENAI');
    expect(result).toContain('gpt-4o');
  });

  it('includes language detection instruction', () => {
    const result = buildGiaSystem();
    expect(result).toContain('Detect the language');
    expect(result).toContain('ALWAYS respond in the same language');
  });

  it('applies custom GIA name from identity', () => {
    mockGetState.identity = {
      identity: { ...mockIdentityState.identity, name: 'Zara' },
    };
    const result = buildGiaSystem();
    expect(result).toContain('calls you Zara');
  });

  it('shows no-tool-support section when model lacks tools', () => {
    mockGetState.provider = {
      activeProvider: 'openai',
      providers: { openai: { enabled: true, apiKey: 'sk-test', model: 'gpt-3.5-turbo' } },
      availableModels: {
        openai: [
          { id: 'gpt-3.5-turbo', label: 'GPT-3.5', free: false, tools: false, vision: false, context: { length: 16000 } },
        ],
      },
    };
    const result = buildGiaSystem();
    expect(result).toContain('Limited tool support');
    expect(result).not.toContain('## Tools you can use');
  });

  it('includes collapsible sections info', () => {
    const result = buildGiaSystem();
    expect(result).toContain('<details>');
    expect(result).toContain('<summary>');
  });

  it('includes mermaid diagram info', () => {
    const result = buildGiaSystem();
    expect(result).toContain('mermaid');
  });

  it('includes katex math info', () => {
    const result = buildGiaSystem();
    expect(result).toContain('KaTeX');
  });

  it('includes truthfulness section', () => {
    const result = buildGiaSystem();
    expect(result).toContain('Never fabricate');
  });

  it('includes suggestion block format', () => {
    const result = buildGiaSystem();
    expect(result).toContain('```suggestions');
  });
});
