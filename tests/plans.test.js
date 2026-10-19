import { describe, it, expect } from 'vitest';
import { PLAN_KINDS, PLAN_PHRASES, planKey, pickThen } from '../src/npc/plans.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';
import { Intent } from '../src/npc/intent.js';
import { AMY_MIND_LINES, JESS_MIND_LINES } from '../src/npc/mindLines.js';
import { DEFAULT_COMPANION_PARAMS as P } from '../src/npc/companionParams.js';

const needs = { warmth: 0.5, company: 0.5, excitement: 0.8, rest: 0.5, sleep: 0, purpose: 0.8 };
const offer = (key, weight = 1) => ({ key, weight, take: () => {} });
const sure = { ...P, planChance: 1, chooseWhim: 0 };

describe('making a plan', () => {
  it('only plans things that are plannable, with offers that exist', () => {
    for (const k of PLAN_KINDS) expect(OFFER_KINDS[k], k).toBeTruthy();
    expect(Object.keys(PLAN_PHRASES)).toEqual(PLAN_KINDS);
  });

  it('strings on a second thing from what she could do now, never the same one', () => {
    const then = pickThen('tea', [offer('tea'), offer('drive'), offer('mount')], needs, sure);
    expect(then.key).toBe('drive'); // mount is not plannable, tea is the first
  });

  it('does not plan after something unplannable, with nothing to plan, or when the dice say no', () => {
    expect(pickThen('jumps', [offer('drive')], needs, sure)).toBe(null);
    expect(pickThen('tea', [offer('tea')], needs, sure)).toBe(null);
    expect(pickThen('tea', [offer('drive')], needs, { ...sure, planChance: 0.2 }, () => 0.5)).toBe(null);
  });

  it('plans nothing when what is left does not much appeal', () => {
    expect(pickThen('tea', [offer('drive')], { ...needs, excitement: 0, purpose: 0 }, sure)).toBe(null);
  });
});

describe('carrying a plan out', () => {
  it('waits for the second part to be on offer, takes it, then forgets it', () => {
    const i = new Intent();
    i.chose('tea', 'walking:carry');
    i.makePlan('tea', 'drive', P);
    expect(i.nextStep([offer('rest')])).toBe(null);
    const d = offer('drive');
    expect(i.nextStep([offer('rest'), d])).toBe(d);
    i.chose('drive', 'walking:quad');
    expect(i.plan).toBe(null);
  });

  it('is dropped when she is asked for something else, or after a while', () => {
    const i = new Intent();
    i.makePlan('tea', 'drive', P);
    i.interrupt(P);
    expect(i.plan).toBe(null);
    i.makePlan('tea', 'drive', P);
    i.update(P.planFor + 1, 'idle:');
    expect(i.plan).toBe(null);
  });

  it('is said in the debug description', () => {
    const i = new Intent();
    i.makePlan('tea', 'drive', P);
    expect(i.describe((k) => `do ${k}`)).toContain('plans to do drive after');
  });
});

describe('saying it', () => {
  it('has a line for every pair, in both voices, with no em dashes', () => {
    for (const a of PLAN_KINDS) {
      for (const b of PLAN_KINDS) {
        if (a === b) continue;
        const amy = AMY_MIND_LINES[planKey(a, b)];
        const jess = JESS_MIND_LINES[planKey(a, b)];
        expect(amy.lines.length, `${a} ${b}`).toBeGreaterThan(0);
        expect(jess.length).toBeGreaterThan(0);
        for (const t of [...amy.lines, ...jess]) expect(t).not.toMatch(/—/);
      }
    }
  });
});
