import { describe, it, expect } from 'vitest';
import { walkPace, Intent } from '../src/npc/intent.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';
import { PACES } from '../src/npc/intent.js';
import { DEFAULT_COMPANION_PARAMS as P } from '../src/npc/companionParams.js';

const calm = { wet: false, tired: 0, excited: 0 };

describe('her pace', () => {
  it('hurries, goes briskly, dawdles or walks as the choice says', () => {
    expect(walkPace('hurry', calm, P)).toEqual({ mul: P.paceHurry, jog: 'yes' });
    expect(walkPace('brisk', calm, P)).toEqual({ mul: P.paceBrisk, jog: 'auto' });
    expect(walkPace('dawdle', calm, P)).toEqual({ mul: P.paceDawdle, jog: 'no' });
    expect(walkPace(null, calm, P)).toEqual({ mul: 1, jog: 'auto' });
  });

  it('hurries anywhere in the rain, unless she is dawdling', () => {
    expect(walkPace(null, { ...calm, wet: true }, P)).toEqual({ mul: P.paceHurry, jog: 'yes' });
    expect(walkPace('dawdle', { ...calm, wet: true }, P).jog).toBe('no');
  });

  it('is slower tired and quicker keyed up', () => {
    expect(walkPace(null, { ...calm, tired: 1 }, P).mul).toBeCloseTo(P.paceTired);
    expect(walkPace(null, { ...calm, excited: 1 }, P).mul).toBeCloseTo(P.paceExcited);
  });

  it('every pace a choice names is one there is', () => {
    for (const [key, kind] of Object.entries(OFFER_KINDS)) if (kind.pace) expect(PACES, key).toContain(kind.pace);
  });
});

describe('being stopped on her way', () => {
  it('only counts while she is still on her way to it', () => {
    const i = new Intent();
    i.chose('rest', 'walking:rest');
    i.update(1, 'walking:rest');
    expect(i.interrupt(P)).toBe('rest');
    const j = new Intent();
    j.chose('rest', 'walking:rest');
    j.update(1, 'resting:'); // she got there
    expect(j.interrupt(P)).toBe(null);
  });

  it('keeps it on her mind a while, keener on it, and knows when she gets back to it', () => {
    const i = new Intent();
    i.chose('tea', 'walking:carry');
    i.interrupt(P);
    expect(i.boost('tea', P)).toBe(P.resumeBoost);
    expect(i.boost('wander', P)).toBe(1);
    expect(i.chose('tea', 'walking:carry')).toBe(true);
    expect(i.boost('tea', P)).toBe(1);
  });

  it('forgets it after a while', () => {
    const i = new Intent();
    i.chose('tea', 'walking:carry');
    i.interrupt(P);
    i.update(P.resumeFor + 1, 'idle:');
    expect(i.boost('tea', P)).toBe(1);
    expect(i.chose('tea', 'walking:carry')).toBe(false);
  });

  it('describes what she is set on', () => {
    const i = new Intent();
    expect(i.describe()).toBe('nothing she can be stopped from');
    i.chose('tea', 'walking:carry');
    expect(i.describe()).toBe('on her way to tea');
    i.interrupt(P);
    expect(i.describe((k) => `make ${k}`)).toBe(`nothing she can be stopped from; still keen to make tea (${P.resumeFor} s)`);
  });
});
