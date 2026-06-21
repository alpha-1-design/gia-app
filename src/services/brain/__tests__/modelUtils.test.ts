import { describe, it, expect } from 'vitest';

// isVisionCapable is a pure function that doesn't depend on any store.
// selectBestModel depends on useProviderStore.getState() which requires
// complex vitest mocking. We test isVisionCapable thoroughly here and
// test selectBestModel via integration in useChatGeneration/hooks tests.

const { isVisionCapable } = await import('../modelUtils');

describe('isVisionCapable', () => {
  describe('OpenAI', () => {
    it('identifies GPT-4o as vision capable', () => expect(isVisionCapable('gpt-4o', 'openai')).toBe(true));
    it('identifies GPT-4o Mini as vision capable', () => expect(isVisionCapable('gpt-4o-mini', 'openai')).toBe(true));
    it('identifies GPT-4.1 as vision capable', () => expect(isVisionCapable('gpt-4.1', 'openai')).toBe(true));
    it('identifies o1 models as vision capable', () => expect(isVisionCapable('o1', 'openai')).toBe(true));
    it('identifies o3 models as vision capable', () => expect(isVisionCapable('o3-mini', 'openai')).toBe(true));
    it('identifies GPT-3.5 as NOT vision capable', () => expect(isVisionCapable('gpt-3.5-turbo', 'openai')).toBe(false));
  });

  describe('Anthropic', () => {
    it('identifies Claude models as vision capable', () => expect(isVisionCapable('claude-sonnet-4-20250514', 'anthropic')).toBe(true));
    it('identifies claude-3-haiku as vision capable', () => expect(isVisionCapable('claude-3-haiku', 'anthropic')).toBe(true));
  });

  describe('Gemini', () => {
    it('all Gemini models are vision capable', () => {
      expect(isVisionCapable('gemini-2.0-flash', 'gemini')).toBe(true);
      expect(isVisionCapable('gemini-1.5-pro', 'gemini')).toBe(true);
    });
  });

  describe('Groq', () => {
    it('identifies Llama Vision models as capable', () => {
      expect(isVisionCapable('llama-3.2-11b-vision', 'groq')).toBe(true);
      expect(isVisionCapable('llama-4', 'groq')).toBe(true);
    });
    it('non-vision Groq models are not capable', () => expect(isVisionCapable('mixtral-8x7b', 'groq')).toBe(false));
  });

  describe('HuggingFace', () => {
    it('vision keywords trigger capability', () => {
      expect(isVisionCapable('llava-hf', 'huggingface')).toBe(true);
      expect(isVisionCapable('pixtral', 'huggingface')).toBe(true);
    });
  });

  describe('generic pattern matching', () => {
    it('matches common vision patterns', () => {
      expect(isVisionCapable('qwen-vl', 'custom')).toBe(true);
      expect(isVisionCapable('deepseek-vl', 'deepseek')).toBe(true);
      expect(isVisionCapable('phi-3-vision', 'custom')).toBe(true);
    });
    it('non-vision models return false', () => {
      expect(isVisionCapable('llama-3.1-8b', 'custom')).toBe(false);
      expect(isVisionCapable('deepseek-chat', 'opencode')).toBe(false);
    });
  });
});
