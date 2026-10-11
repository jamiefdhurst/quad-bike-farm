import { describe, it, expect } from 'vitest';
import { WAITING_IDLES, DEFAULT_WAITING_PARAMS as P, waitingChoices, nearestWithin, describeWaiting } from '../src/npc/waiting.js';
import { STANDING_IDLES, StandingIdles, idlePose, DEFAULT_IDLE_POSE_PARAMS } from '../src/npc/poseMoves.js';
import { CHARACTERS } from '../src/npc/characters.js';

const names = (list) => list.map((c) => c.name);
const quiet = { wheel: null, seat: null, chill: 0, sun: 0.3, clouding: 0, wet: false };

describe('Waiting that fits where she is', () => {
  it('has a pose for every way of waiting', () => {
    for (const name of Object.keys(WAITING_IDLES)) expect(STANDING_IDLES[name], name).toBeDefined();
  });

  it('with nothing about, offers her own habits and her phone', () => {
    expect(names(waitingChoices(['folded', 'clasped'], quiet))).toEqual(['folded', 'clasped', 'phone']);
  });

  it('adds kicking a tyre or wiping a seat only with one within reach, and makes them likelier than a habit', () => {
    const out = waitingChoices(['folded'], { ...quiet, wheel: { x: 1, z: 0 }, seat: { x: 0.5, z: 0 } });
    expect(names(out)).toEqual(expect.arrayContaining(['kickTyre', 'wipeSeat']));
    expect(out.find((c) => c.name === 'kickTyre').weight).toBeGreaterThan(1);
  });

  it('rubs her hands in the cold, shades her eyes in the sun (not in the rain), and looks up with a shower coming', () => {
    expect(names(waitingChoices([], { ...quiet, chill: P.waitCold + 0.1 }))).toContain('rubHands');
    expect(names(waitingChoices([], { ...quiet, chill: P.waitCold - 0.1 }))).not.toContain('rubHands');
    expect(names(waitingChoices([], { ...quiet, sun: 0.9 }))).toContain('shadeEyes');
    expect(names(waitingChoices([], { ...quiet, sun: 0.9, wet: true }))).not.toContain('shadeEyes');
    expect(names(waitingChoices([], { ...quiet, clouding: 0.3 }))).toContain('lookUp');
    expect(names(waitingChoices([], quiet))).not.toContain('lookUp');
  });

  it('weighs each by her taste for it, and leaves out one she has no taste for', () => {
    const jess = waitingChoices([], quiet, { phone: 2 });
    expect(jess[0].weight).toBeCloseTo(P.waitPhone * 2);
    expect(names(waitingChoices([], quiet, { phone: 0 }))).toEqual([]);
  });

  it('gives each girl her own tastes: Amy wipes the seat, Jess is on her phone and kicks the tyres', () => {
    const amy = CHARACTERS.find((c) => c.id === 'amy').waitTastes;
    const jess = CHARACTERS.find((c) => c.id === 'jess').waitTastes;
    expect(amy.wipeSeat).toBeGreaterThan(jess.wipeSeat);
    expect(jess.phone).toBeGreaterThan(amy.phone);
    expect(jess.kickTyre).toBeGreaterThan(amy.kickTyre);
  });

  it('finds the nearest thing within reach', () => {
    const pts = [{ x: 3, z: 0, id: 'far' }, { x: 1, z: 0, id: 'near' }, { x: 0, z: 1.1, id: 'close' }];
    expect(nearestWithin({ x: 0, z: 0 }, pts, 1.2).id).toBe('near');
    expect(nearestWithin({ x: 0, z: 0 }, pts, 0.5)).toBeNull();
  });

  it('says what she is doing', () => {
    expect(describeWaiting('phone', 1)).toBe('checking her phone');
    expect(describeWaiting(null, 0)).toBe('nothing in particular');
  });
});

describe('Weighted ways of standing about', () => {
  it('picks by weight', () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const counts = { folded: 0, phone: 0 };
    for (let i = 0; i < 400; i++) {
      const s = new StandingIdles([], { ...DEFAULT_IDLE_POSE_PARAMS, idlePoseGapMin: 0, idlePoseGapMax: 0 }, random);
      s.setChoices([{ name: 'folded', weight: 1 }, { name: 'phone', weight: 3 }]);
      s.update(0.1, true);
      counts[s.name]++;
    }
    expect(counts.phone / counts.folded).toBeGreaterThan(2);
    expect(counts.phone / counts.folded).toBeLessThan(4.5);
  });

  it('starts one at once when forced', () => {
    const s = new StandingIdles(['folded'], DEFAULT_IDLE_POSE_PARAMS);
    expect(s.force('kickTyre')).toBe(true);
    expect(s.name).toBe('kickTyre');
    expect(s.force('nonsense')).toBe(false);
  });

  it('moves the hands to and fro for wiping and rubbing', () => {
    const period = STANDING_IDLES.rubHands.move.period;
    const a = idlePose('rubHands', 0, 1);
    const b = idlePose('rubHands', period / 4, 1);
    expect(b.hands.left.at[1] - a.hands.left.at[1]).toBeCloseTo(STANDING_IDLES.rubHands.move.hands.left[1]);
    expect(STANDING_IDLES.rubHands.hold.hands.left.at[1]).toBe(a.hands.left.at[1]); // the library is left alone
  });
});
