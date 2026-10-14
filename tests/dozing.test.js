import { describe, it, expect } from 'vitest';
import { DEFAULT_DOZE_PARAMS as P, wakesHer, wakesOf, dozeStay, dozePose } from '../src/npc/dozing.js';
import { Needs } from '../src/npc/needs.js';
import { Places, DEFAULT_PLACE_PARAMS } from '../src/npc/places.js';
import { OFFER_KINDS, choose } from '../src/npc/chooser.js';
import { DEFAULT_COMPANION_PARAMS as C } from '../src/npc/companionParams.js';
import { CHARACTERS } from '../src/npc/characters.js';
import { VOICE_LINES } from '../src/npc/voiceLines.js';
import { JESS_LINES } from '../src/npc/jessLines.js';

const still = { chill: 0, wet: false, warmed: false, alone: false, together: false, thrill: 0, active: false, sitting: false, idle: false, purposeRate: 0 };
const run = (n, seconds, ctx) => {
  for (let t = 0; t < seconds; t += 0.5) n.update(0.5, { ...still, ...ctx }, C);
  return n;
};

describe('sleepiness', () => {
  it('builds all the time, faster on the go, and only dozing cures it', () => {
    const idle = run(new Needs(), 300, {}).sleep;
    expect(idle).toBeGreaterThan(0.2);
    expect(run(new Needs(), 300, { active: true }).sleep).toBeGreaterThan(idle);
    expect(run(new Needs(), 300, { sitting: true }).sleep).toBeGreaterThan(idle * 0.9);
    expect(run(new Needs({ sleep: 0.9 }), 60, { dozing: true, sitting: true }).sleep).toBeLessThan(0.5);
  });

  it('Jess gets sleepy sooner than Amy', () => {
    const rate = (id) => ({ ...C, ...CHARACTERS.find((c) => c.id === id).params }).needSleepRise;
    expect(rate('jess')).toBeGreaterThan(rate('amy'));
  });
});

describe('dozing offer', () => {
  const bale = { id: 'bale1', kind: 'bale', x: 10, z: 0, yaw: 0, seat: 1.3 };
  const ctx = (over = {}, girl = {}) => ({ rain: 0, dark: 0, fine: true, sun: 0.8, spots: [bale], girls: [{ id: 'jess', x: 0, z: 0, state: 'idle', spot: null, dozeWeight: 1, ...girl }], ...over });
  const places = () => new Places({ ...DEFAULT_PLACE_PARAMS }, () => 0.5);

  it('is made on a bright fine afternoon to a girl stood about, to a free bale', () => {
    const o = places().offers(ctx());
    expect(o).toHaveLength(1);
    expect(o[0]).toMatchObject({ key: 'doze', girl: 'jess', spot: bale });
    expect(places().take(o[0])).toMatchObject({ do: 'doze', girl: 'jess', spot: bale });
  });

  it('is not made when it is dull, dark, wet, or she is busy', () => {
    expect(places().offers(ctx({ sun: 0.1 }))).toEqual([]);
    expect(places().offers(ctx({ dark: 0.9 }))).toEqual([]);
    expect(places().offers(ctx({ fine: false }))).toEqual([]);
    expect(places().offers(ctx({}, { state: 'busy' }))).toEqual([]);
    expect(places().offers(ctx({ spots: [{ ...bale, kind: 'fence' }] }))).toEqual([]);
  });

  it('meets sleep, so she takes it when sleepy and not when rested', () => {
    expect(Object.keys(OFFER_KINDS.doze.satisfies)).toContain('sleep');
    const offer = [{ key: 'doze', weight: 1 }];
    const none = () => 0.5;
    expect(choose(new Needs({ sleep: 0.9 }), offer, { ...C, chooseWhim: 0 }, none).pick).toBeTruthy();
    expect(choose(new Needs({ sleep: 0.1 }), offer, { ...C, chooseWhim: 0 }, none).pick).toBeNull();
  });
});

describe('waking', () => {
  it('a rev or a horn beside her wakes her, a far-off one does not', () => {
    expect(wakesHer({ kind: 'rev', strength: 1 }, 5)).toBe(true);
    expect(wakesHer({ kind: 'rev', strength: 1 }, 30)).toBe(false);
    expect(wakesHer({ kind: 'horn' }, 30)).toBe(true);
    expect(wakesHer({ kind: 'pheasant' }, 1)).toBe(false);
    expect(wakesHer({ kind: 'thunder', strength: 0.3 }, 10)).toBe(false);
  });

  it('she is lighter asleep-ish: nodding off wakes to something further away', () => {
    expect(wakesHer({ kind: 'rev', strength: 1 }, 18, false)).toBe(true);
    expect(wakesHer({ kind: 'rev', strength: 1 }, 18, true)).toBe(false);
  });

  it('wakes by herself when rested, when her time is up, or when the sun goes in', () => {
    expect(wakesOf({ sleep: 0.5, stayLeft: 60, sunny: true }, P)).toBeNull();
    expect(wakesOf({ sleep: 0.02, stayLeft: 60, sunny: true }, P)).toBe('rested');
    expect(wakesOf({ sleep: 0.5, stayLeft: 0, sunny: true }, P)).toBe('time');
    expect(wakesOf({ sleep: 0.5, stayLeft: 60, sunny: false }, P)).toBe('sun');
  });

  it('her stay is within the range', () => {
    expect(dozeStay(P, () => 0)).toBe(P.dozeStayMin);
    expect(dozeStay(P, () => 1)).toBe(P.dozeStayMax);
  });
});

describe('the head', () => {
  it('hangs lower asleep than nodding, and not at all when she is awake', () => {
    expect(dozePose(30, 0, P.dozeDropSeconds).headDown).toBe(0);
    const asleep = dozePose(30, 1, P.dozeDropSeconds).headDown;
    expect(asleep).toBeGreaterThan(0.5);
    for (let t = 0; t < P.dozeDropSeconds; t += 0.25) expect(dozePose(t, 1, P.dozeDropSeconds).headDown).toBeLessThan(asleep);
  });
});

describe('what she says', () => {
  it('both girls have a line for each part of it', () => {
    for (const k of ['dozeGo', 'dozeOff', 'dozeWake', 'dozeWakeGentle', 'dozeStartled']) {
      expect(VOICE_LINES[k], k).toBeTruthy();
      expect(JESS_LINES[k], k).toBeTruthy();
    }
  });
});
