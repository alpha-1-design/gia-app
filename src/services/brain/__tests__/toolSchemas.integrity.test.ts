import { describe, expect, it } from 'vitest';
import { registerAllTools } from '../../tools/index';
import { getAllToolSchemas, buildOpenAITools, buildAnthropicTools, buildGeminiTools, validateToolArgs } from '../toolSchemas';

describe('tool schema integrity', () => {
  it('registry + hardcoded schemas merge into a safe shape', () => {
    registerAllTools();
    const schemas = getAllToolSchemas();
    expect(Object.keys(schemas).length).toBeGreaterThan(100);

    for (const [id, schema] of Object.entries(schemas)) {
      expect(Array.isArray(schema.required), `${id} required is an array`).toBe(true);
      expect(typeof schema.description, `${id} has a description`).toBe('string');
      expect(schema.description.length, `${id} description is non-empty`).toBeGreaterThan(0);
      expect(schema.properties, `${id} properties is an object`).toBeTypeOf('object');
    }
  });

  it('builds native schemas for every provider without throwing', () => {
    registerAllTools();
    const openAI = buildOpenAITools();
    const anthropic = buildAnthropicTools();
    const gemini = buildGeminiTools();

    expect(openAI.length).toBeGreaterThan(100);
    expect(anthropic.length).toBe(openAI.length);
    expect(gemini.length).toBe(openAI.length);

    for (const tool of openAI) {
      const fn = tool.function as { name: string; description: string; parameters: { properties: unknown } };
      expect(fn.name).toBeTruthy();
      expect(fn.description.length).toBeGreaterThan(0);
      expect(fn.parameters.properties).toBeTypeOf('object');
    }
  });

  it('never throws on missing required args', () => {
    registerAllTools();
    for (const id of Object.keys(getAllToolSchemas())) {
      expect(() => validateToolArgs(id, {})).not.toThrow();
    }
  });
});