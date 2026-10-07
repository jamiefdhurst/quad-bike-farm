import { describe, it, expect } from 'vitest';
import { Horns, DEFAULT_HORN_PARAMS as P, hornVoice } from '../src/npc/horns.js';
import { AMY_HORN_LINES, JESS_HORN_LINES } from '../src/npc/hornLines.js';
import { VOICE_LINES as AMY_LINES } from '../src/npc/voiceLines.js';
import { JESS_LINES } from '../src/npc/jessLines.js';
import { QUAD_SPECS, TRACTOR_SPEC } from '../src/vehicle/quadSpecs.js';

const always = () => 0; // dice always say yes, and pick the first of anything
const make = (params = {}, random = always) => new Horns({ ...P, ...params }, random);
const girl = (id, o = {}) => ({ id, x: 10, z: 0, yaw: 0, speed: 0, canHonk: true, driving: false, ...o });
const ctx = (o = {}) => ({ you: { x: 0, z: 0, honking: false }, girls: [girl('jess')], ...o });
const press = (h, c = ctx()) => h.update(0.05, { ...c, you: { ...c.you, honking: true } });
const release = (h, c = ctx()) => h.update(0.05, { ...c, you: { ...c.you, honking: false } });
const run = (h, c, seconds) => {
  const events = [];
  for (let t = 0; t < seconds; t += 0.05) events.push(...h.update(0.05, c));
  return events;
};

describe('answering a beep', () => {
  it('has Jess answer and beep back after a moment', () => {
    const h = make();
    const events = press(h);
    expect(events.find((e) => e.type === 'answer')?.girl).toBe('jess');
    expect(h.beeping('jess')).toBe(false); // not yet
    run(h, ctx(), 0.6);
    expect(h.beeping('jess')).toBe(true);
    run(h, ctx(), 3);
    expect(h.busy('jess')).toBe(false);
  });

  it('answers once per press, not every frame you hold it', () => {
    const h = make();
    const c = ctx({ you: { x: 0, z: 0, honking: true } });
    const answers = run(h, c, 2).filter((e) => e.type === 'answer');
    expect(answers).toHaveLength(1);
  });

  it('ignores a beep from too far away, or from a girl who is not on a quad', () => {
    expect(press(make(), ctx({ girls: [girl('jess', { x: P.hearRange + 5 })] })).some((e) => e.type === 'answer')).toBe(false);
    expect(press(make(), ctx({ girls: [girl('jess', { canHonk: false })] })).some((e) => e.type === 'answer')).toBe(false);
  });

  it('lets Amy decline now and then, but never Jess', () => {
    const never = () => 0.99;
    expect(press(make({}, never), ctx({ girls: [girl('amy')] })).some((e) => e.type === 'answer')).toBe(false);
    expect(press(make({}, never), ctx({ girls: [girl('jess')] })).some((e) => e.type === 'answer')).toBe(true);
  });

  it('waits out the cooldown before answering again', () => {
    const h = make();
    press(h);
    release(h);
    run(h, ctx(), 2);
    expect(press(h).some((e) => e.type === 'answer')).toBe(false);
  });
});

describe('Jess creeping up on Amy', () => {
  // Amy driving north (yaw 0 is +z), Jess driving 5 m behind her.
  const behind = (o = {}) => ctx({ you: { x: 100, z: 100, honking: false }, girls: [girl('amy', { x: 0, z: 0, speed: 5, driving: true }), girl('jess', { x: 0, z: -5, driving: true, ...o })] });

  it('blasts the horn and makes Amy jump, once the game is under way', () => {
    const h = make({ prankFirstDelay: 0 });
    const events = run(h, behind(), 2);
    expect(events.some((e) => e.type === 'creep')).toBe(true);
    expect(events.find((e) => e.type === 'jump')?.girl).toBe('amy');
  });

  it('does nothing when Jess is beside Amy, in front of her, too far, or Amy is stopped', () => {
    for (const c of [behind({ x: 5, z: 0 }), behind({ z: 5 }), behind({ z: -P.creepRange - 5 }), behind({ z: -0.5 })]) {
      expect(run(make({ prankFirstDelay: 0 }), c, 3).some((e) => e.type === 'creep')).toBe(false);
    }
    const stopped = behind();
    stopped.girls[0].speed = 0;
    expect(run(make({ prankFirstDelay: 0 }), stopped, 3).some((e) => e.type === 'creep')).toBe(false);
  });

  it('waits for the first delay and then the cooldown', () => {
    const h = make({ prankFirstDelay: 10, prankCooldown: 100 });
    expect(run(h, behind(), 5).some((e) => e.type === 'creep')).toBe(false);
    expect(run(h, behind(), 10).filter((e) => e.type === 'creep')).toHaveLength(1);
    expect(run(h, behind(), 30).some((e) => e.type === 'creep')).toBe(false);
  });

  it('sounds Jess\'s horn during the blast', () => {
    const h = make({ prankFirstDelay: 0 });
    run(h, behind(), 0.1);
    expect(h.beeping('jess')).toBe(true);
  });
});

describe('horn voices', () => {
  it('gives the tractor a lower, louder horn than any quad', () => {
    const tractor = hornVoice(TRACTOR_SPEC);
    for (const spec of QUAD_SPECS) {
      const quad = hornVoice(spec);
      expect(tractor.freqs[0]).toBeLessThan(quad.freqs[0]);
      expect(tractor.level).toBeGreaterThan(quad.level);
    }
  });

  it('is steady for a quad, and differs between them', () => {
    expect(hornVoice(QUAD_SPECS[0])).toEqual(hornVoice(QUAD_SPECS[0]));
    expect(new Set(QUAD_SPECS.map((s) => hornVoice(s).freqs[0])).size).toBeGreaterThan(1);
  });
});

describe('what they say', () => {
  it('has every line in the voice files, and never calls you he, she or they', () => {
    for (const key of Object.keys(AMY_HORN_LINES)) expect(AMY_LINES[key]).toBe(AMY_HORN_LINES[key]);
    for (const key of Object.keys(JESS_HORN_LINES)) expect(JESS_LINES[key]).toBe(JESS_HORN_LINES[key]);
    const all = [...Object.values(AMY_HORN_LINES).flatMap((l) => l.lines), ...Object.values(JESS_HORN_LINES).flat()];
    for (const l of all) expect(l).not.toMatch(/\b(he|she|they)\b|—/i);
  });
});
