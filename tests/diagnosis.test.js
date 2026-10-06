import { describe, it, expect } from 'vitest';
import { engineCondition, guessCondition, CONDITIONS } from '../src/npc/diagnosis.js';
import { DEFAULT_COMPANION_PARAMS } from '../src/npc/companionParams.js';
import { DIAGNOSIS_BANTER, AMY_DIAGNOSIS_LINES, JESS_DIAGNOSIS_LINES } from '../src/npc/diagnosisLines.js';
import { CHARACTERS } from '../src/npc/characters.js';
import { BANTER } from '../src/npc/banterLines.js';

const p = DEFAULT_COMPANION_PARAMS;
const healthy = { temperature: 0.9, rich: 0, fouling: 0, wear: 0 };

function seeded(seed = 3) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

describe('diagnosing by ear', () => {
  it('hears a healthy warm engine as fine', () => {
    expect(engineCondition(healthy, p)).toBe('fine');
  });

  it('hears each real condition', () => {
    expect(engineCondition({ ...healthy, temperature: 0.1 }, p)).toBe('cold');
    expect(engineCondition({ ...healthy, rich: 0.6 }, p)).toBe('rich');
    expect(engineCondition({ ...healthy, fouling: 0.8 }, p)).toBe('fouled');
    expect(engineCondition({ ...healthy, wear: 0.7 }, p)).toBe('worn');
  });

  it('picks the worst when there are two', () => {
    expect(engineCondition({ ...healthy, temperature: 0.3, wear: 0.9 }, p)).toBe('worn');
  });

  it('is right as often as the girl is good', () => {
    const rate = (accuracy) => {
      const random = seeded();
      let right = 0;
      for (let i = 0; i < 2000; i++) if (guessCondition('rich', accuracy, random) === 'rich') right++;
      return right / 2000;
    };
    expect(rate(0.9)).toBeGreaterThan(0.85);
    expect(rate(0.5)).toBeGreaterThan(0.44);
    expect(rate(0.5)).toBeLessThan(0.56);
    expect(rate(1)).toBe(1);
  });

  it('is wrong with something she could actually say', () => {
    const random = seeded(9);
    for (let i = 0; i < 200; i++) expect([...CONDITIONS, 'fine']).toContain(guessCondition('worn', 0, random));
  });

  it('has Amy more accurate than Jess', () => {
    const jess = CHARACTERS.find((c) => c.id === 'jess');
    expect(jess.params.diagnoseAccuracy).toBeLessThan(p.diagnoseAccuracy);
  });

  it('has a line for every guess, and an argument for every way Jess can be wrong', () => {
    for (const kind of [...CONDITIONS, 'fine']) {
      const situation = 'diagnose' + kind[0].toUpperCase() + kind.slice(1);
      expect(AMY_DIAGNOSIS_LINES[situation].lines.length).toBeGreaterThan(0);
      expect(JESS_DIAGNOSIS_LINES[situation].length).toBeGreaterThan(0);
    }
    expect(DIAGNOSIS_BANTER.length).toBe(5 * 4);
    expect(BANTER).toEqual(expect.arrayContaining(DIAGNOSIS_BANTER));
    for (const e of DIAGNOSIS_BANTER) expect(e.roles.guess).not.toBe(e.roles.truth);
  });
});
