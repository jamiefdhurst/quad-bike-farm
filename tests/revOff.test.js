import { describe, it, expect } from 'vitest';
import { RevOff, DEFAULT_REVOFF_PARAMS as P } from '../src/npc/revOff.js';
import { AMY_REVOFF_LINES, JESS_REVOFF_LINES } from '../src/npc/revOffLines.js';
import { VOICE_LINES as AMY_LINES } from '../src/npc/voiceLines.js';
import { JESS_LINES } from '../src/npc/jessLines.js';

const always = () => 0; // dice always say yes, and pick the first of anything
const make = (params = {}, random = always) => new RevOff({ ...P, ...params }, random);
const girl = (id, o = {}) => ({ id, canBlip: true, x: 5, z: 0, ...o });
const you = (o = {}) => ({ riding: true, running: true, speed: 0, throttle: 0, x: 0, z: 0, ...o });
const ctx = (o = {}) => ({ you: you(), girls: [girl('jess')], ...o });

// Blips once (a step at 1, a step back at 0) and returns the events from the rise.
function blip(r, c = ctx()) {
  const events = r.update(0.05, { ...c, you: { ...c.you, throttle: 1 } });
  r.update(0.05, { ...c, you: { ...c.you, throttle: 0 } });
  return events;
}
// Runs on for some seconds, returning the events and the throttle samples for a girl.
function runOn(r, c, seconds, id = 'jess') {
  const events = [];
  const held = [];
  for (let t = 0; t < seconds; t += 0.05) {
    events.push(...r.update(0.05, c));
    held.push(r.throttleFor(id));
  }
  return { events, held };
}

describe('rev-offs', () => {
  it('Jess always answers a blip, after a short pause, by opening her own throttle', () => {
    const r = make();
    const events = blip(r);
    expect(events.find((e) => e.type === 'answer')?.girl).toBe('jess');
    expect(r.throttleFor('jess')).toBe(0); // not yet
    const { held, events: later } = runOn(r, ctx(), 3);
    expect(held).toContain(1);
    expect(held.at(-1)).toBe(0);
    expect(later.some((e) => e.type === 'done' && e.girl === 'jess')).toBe(true);
  });

  it('ignores a throttle that is held, or a blip from a moving quad, or one out of earshot', () => {
    const held = make();
    held.update(0.05, ctx({ you: you({ throttle: 1 }) }));
    expect(held.update(0.05, ctx({ you: you({ throttle: 1 }) }))).toEqual([]);
    expect(blip(make(), ctx({ you: you({ speed: 6 }) }))).toEqual([]);
    expect(blip(make(), ctx({ girls: [girl('jess', { x: 80 })] }))).toEqual([]);
    expect(blip(make(), ctx({ you: you({ running: false }) }))).toEqual([]);
    expect(blip(make(), ctx({ girls: [girl('jess', { canBlip: false })] }))).toEqual([]);
  });

  it('answers more and longer each round while you keep going', () => {
    const r = make({ complainChance: 0 });
    const c = ctx();
    const answers = [];
    for (let i = 0; i < 4; i++) {
      answers.push(blip(r, c).find((e) => e.type === 'answer'));
      runOn(r, c, 3);
    }
    expect(answers.map((a) => a.round)).toEqual([1, 2, 3, 4]);
    expect(answers[3].blips).toBeGreaterThan(answers[0].blips);
    expect(answers[3].hold).toBeGreaterThan(answers[0].hold);
  });

  it('starts again at round one after a quiet spell', () => {
    const r = make({ complainChance: 0 });
    const c = ctx();
    blip(r, c);
    blip(r, c);
    runOn(r, c, P.roundWindow + 5);
    expect(blip(r, c).find((e) => e.type === 'answer').round).toBe(1);
  });

  it('Amy answers only some of the time, and gives up after her round', () => {
    const c = ctx({ girls: [girl('amy')] });
    expect(blip(make({}, () => 0.9), c)).toEqual([]);
    const r = make();
    expect(blip(r, c).find((e) => e.type === 'answer').girl).toBe('amy');
    runOn(r, c, 0.5, 'amy');
    expect(blip(r, c).find((e) => e.type === 'answer')).toBeUndefined();
  });

  it('Amy tells you both off when it has gone too far, if she is about and not the one revving', () => {
    const r = make({ complainRound: 2 });
    const c = ctx({ girls: [girl('jess'), girl('amy', { canBlip: false, x: 20 })] });
    blip(r, c);
    runOn(r, c, 3);
    const events = blip(r, c);
    expect(events.find((e) => e.type === 'complain')).toMatchObject({ by: 'amy', girl: 'jess' });
    expect(events.find((e) => e.type === 'complain')).toBeDefined();
  });

  it('the engine complains instead when Amy is nowhere near, and then it starts over', () => {
    const r = make({ complainRound: 2 });
    const c = ctx({ girls: [girl('jess'), girl('amy', { canBlip: false, x: 500 })] });
    blip(r, c);
    runOn(r, c, 3);
    expect(blip(r, c).find((e) => e.type === 'complain')?.by).toBe('engine');
    runOn(r, c, 3);
    expect(blip(r, c).find((e) => e.type === 'answer').round).toBe(1);
  });

  it('complains at most once a minute', () => {
    const r = make({ complainRound: 1 });
    const c = ctx();
    expect(blip(r, c).some((e) => e.type === 'complain')).toBe(true);
    runOn(r, c, 3);
    expect(blip(r, c).some((e) => e.type === 'complain')).toBe(false);
  });

  it('a cold or worn engine stalls when it complains; a warm sound one does not', () => {
    const r = make();
    expect(r.stalls({ temperature: 0.2, wear: 0 })).toBe(true);
    expect(r.stalls({ temperature: 0.9, wear: 0.8 })).toBe(true);
    expect(r.stalls({ temperature: 0.9, wear: 0.1 })).toBe(false);
  });

  it('stops answering if she gets off mid-answer', () => {
    const r = make();
    blip(r);
    const events = r.update(0.5, ctx({ girls: [girl('jess', { canBlip: false })] }));
    expect(events.some((e) => e.type === 'done')).toBe(true);
    expect(r.throttleFor('jess')).toBe(0);
  });

  it('has lines for everything the game asks for', () => {
    for (const k of Object.keys(AMY_REVOFF_LINES)) expect(AMY_LINES[k]?.lines.length).toBeGreaterThan(0);
    for (const k of Object.keys(JESS_REVOFF_LINES)) expect(JESS_LINES[k]?.length ?? JESS_LINES[k]?.lines?.length).toBeGreaterThan(0);
    for (const k of ['revAnswer', 'revAnswerMore', 'revStall']) expect(JESS_REVOFF_LINES[k]).toBeDefined();
    for (const k of ['revAnswer', 'revAnswerMore', 'revComplain', 'revStall']) expect(AMY_REVOFF_LINES[k]).toBeDefined();
  });
});
