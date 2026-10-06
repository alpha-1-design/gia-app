import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useGiaStore, type Skill } from '../../../store/useGiaStore';
import { skillTools } from '../skills';

const securitySkill: Skill = {
  id: 'skill-security',
  name: 'Security Auditor',
  description: 'Audit code and systems for security vulnerabilities.',
  systemPrompt: 'You are a security expert.',
  tools: ['filesystem_read'],
  category: 'dev',
};

const originalSkills = useGiaStore.getState().skills;
const originalActiveSkillId = useGiaStore.getState().activeSkillId;
const loadSkill = skillTools.find((tool) => tool.id === 'skill_load');

describe('skill_load tool', () => {
  beforeEach(() => {
    useGiaStore.setState({ skills: [securitySkill], activeSkillId: null });
  });

  afterEach(() => {
    useGiaStore.setState({ skills: originalSkills, activeSkillId: originalActiveSkillId });
  });

  it('returns the full current built-in playbook without changing the active skill', async () => {
    expect(loadSkill).toBeDefined();
    const result = await loadSkill!.execute({ skillId: 'skill-security' });

    expect(result.success).toBe(true);
    expect(result.content).toContain('Authorized defensive security workflow');
    expect(result.content).toContain('state affected component, preconditions, impact, severity, and confidence');
    expect(useGiaStore.getState().activeSkillId).toBeNull();
  });

  it('rejects skills that are not installed', async () => {
    expect(loadSkill).toBeDefined();
    const result = await loadSkill!.execute({ skillId: 'not-installed' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not installed');
  });

  it('rejects custom skills that contain only a one-line role prompt', async () => {
    const createSkill = skillTools.find((tool) => tool.id === 'skill_create');
    expect(createSkill).toBeDefined();
    const result = await createSkill!.execute({
      name: 'Security',
      description: 'Audit code',
      category: 'security',
      systemPrompt: 'You are a security expert.',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('at least 300 characters');
  });
});
