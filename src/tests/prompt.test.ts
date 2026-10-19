import { describe, expect, it } from 'vitest';
import { buildStyledPrompt, PROMPT_VERSION } from '@/lib/ai/prompt';
import { STYLE_IDS } from '@/lib/ai/styles';

describe('prompt builder', () => {
  it('creates a distinct prompt for each style', () => {
    const prompts = STYLE_IDS.map(
      (styleId) => buildStyledPrompt(styleId, 'balanced').prompt,
    );
    expect(new Set(prompts).size).toBe(3);
    expect(prompts[0]).toContain('水彩');
    expect(prompts[1]).toContain('彩色铅笔');
    expect(prompts[2]).toContain('钢笔');
  });

  it('does not hardcode a subject category', () => {
    const prompt = buildStyledPrompt('watercolor', 'balanced').prompt;
    for (const forbidden of ['旅行', '美食', '宠物', '人物摄影', '风景照']) {
      expect(prompt).not.toContain(forbidden);
    }
  });

  it('changes the fidelity instruction', () => {
    const faithful = buildStyledPrompt('pen-sketch', 'faithful').prompt;
    const artistic = buildStyledPrompt('pen-sketch', 'artistic').prompt;
    expect(faithful).toContain('保真优先');
    expect(artistic).toContain('艺术表达优先');
    expect(faithful).not.toBe(artistic);
  });

  it('adds a sketchbook whitespace composition without hardcoding a subject', () => {
    const full = buildStyledPrompt('watercolor', 'balanced', 'full').prompt;
    const sketchbook = buildStyledPrompt(
      'watercolor',
      'balanced',
      'sketchbook',
    ).prompt;

    expect(full).toContain('满版构图');
    expect(full).not.toContain('手账留白构图');
    expect(sketchbook).toContain('手账留白构图');
    expect(sketchbook).toContain('宽阔、未上色的干净纸边');
    expect(sketchbook).toContain('主体及其最必要的少量环境约占画面一半');
    expect(sketchbook).toContain('不要自动添加日期、地点');
    expect(sketchbook).not.toBe(full);
    for (const forbidden of ['建筑', '汽车', '旅行', '美食', '宠物']) {
      expect(sketchbook).not.toContain(forbidden);
    }
  });

  it('records the prompt and style versions', () => {
    const result = buildStyledPrompt('colored-pencil', 'balanced');
    expect(result.promptVersion).toBe(PROMPT_VERSION);
    expect(result.styleVersion).toMatch(/^\d{4}-\d{2}-\d{2}\.v\d+$/);
  });
});
