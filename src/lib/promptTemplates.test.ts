/* Phase 92c-fix Item 2 — prompt templates: the single source of truth
   for every AI prompt string (Phase 97 imports these). */

import { describe, expect, it } from 'vitest';
import {
  GBC_DAY_PROMPT,
  INTAKE_PROMPT,
  PROGRAM_FORMAT_TEMPLATE,
  TDEE_PROMPT,
} from '@/lib/promptTemplates';

describe('promptTemplates', () => {
  it('all four exports are non-empty strings', () => {
    for (const [name, value] of Object.entries({
      PROGRAM_FORMAT_TEMPLATE,
      GBC_DAY_PROMPT,
      TDEE_PROMPT,
      INTAKE_PROMPT,
    })) {
      expect(typeof value, name).toBe('string');
      expect(value.length, name).toBeGreaterThan(100);
    }
  });

  it('PROGRAM_FORMAT_TEMPLATE header row matches the Phase 93 parser columns exactly', () => {
    const header = PROGRAM_FORMAT_TEMPLATE.split('\n').find((l) => l.startsWith('| Day'));
    expect(header).toBeDefined();
    const cols = header!.split('|').map((c) => c.trim()).filter(Boolean);
    expect(cols).toEqual(['Day', 'Order', 'Exercise', 'Sets', 'Reps', 'Tempo', 'Rest']);
  });

  it('PROGRAM_FORMAT_TEMPLATE carries the metadata lines and example rows', () => {
    expect(PROGRAM_FORMAT_TEMPLATE).toContain('**Program Name:** [Insert Program Name]');
    expect(PROGRAM_FORMAT_TEMPLATE).toContain('**Weeks:** 4');
    expect(PROGRAM_FORMAT_TEMPLATE).toContain('| [Day#] | A1 |');
    expect(PROGRAM_FORMAT_TEMPLATE).toContain('| [Day#] | D2 |');
  });

  it('TDEE_PROMPT contains the exact output structure lines', () => {
    for (const marker of [
      '**BMR:** [number] kcal',
      '**TDEE:** [number] kcal',
      '**Fat loss target:** [number] kcal (protein [g] / carbs [g] / fats [g])',
      '**Maintenance:** [number] kcal (protein [g] / carbs [g] / fats [g])',
      '**Muscle gain target:** [number] kcal (protein [g] / carbs [g] / fats [g])',
    ]) {
      expect(TDEE_PROMPT).toContain(marker);
    }
    expect(TDEE_PROMPT).toContain('Katch-McArdle');
    expect(TDEE_PROMPT).toContain('Mifflin-St Jeor');
  });

  it('INTAKE_PROMPT contains all 10 section markers', () => {
    for (let i = 1; i <= 10; i++) {
      expect(INTAKE_PROMPT).toContain(`Section ${i} —`);
    }
    expect(INTAKE_PROMPT).toContain('summarize my profile back to me');
  });

  it('GBC_DAY_PROMPT names GBC and the A1/D2 superset structure', () => {
    expect(GBC_DAY_PROMPT).toContain('GBC (German Body Composition)');
    expect(GBC_DAY_PROMPT).toContain('A1/A2, B1/B2, C1/C2, D1/D2');
  });
});
