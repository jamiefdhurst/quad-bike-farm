import { describe, it, expect } from 'vitest';
import { Attention, candidates, hearingFactor, turnBetween, headingTo, NOTICE_KINDS, DEFAULT_NOTICE_PARAMS } from '../src/npc/attention.js';
import { DEFAULT_COMPANION_PARAMS } from '../src/npc/companionParams.js';

const P = DEFAULT_COMPANION_PARAMS;
const dt = 1 / 30;
// She stands at the origin facing +z.
const base = (o = {}) => ({ self: { x: 0, y: 1.5, z: 0 }, facing: 0, people: [], vehicles: [], focus: null, intent: null, noGaze: true, ...o });
const you = (o = {}) => ({ key: 'you', x: 0, y: 1.6, z: 3, ...o });
const run = (a, seconds, view) => {
  let pick = null;
  for (let t = 0; t < seconds - 1e-9; t += dt) pick = a.update(dt, typeof view === 'function' ? view(t) : view);
  return pick;
};
const keysOver = (a, seconds, view) => {
  const seen = [];
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    const k = a.update(dt, view)?.key ?? null;
    if (seen[seen.length - 1] !== k) seen.push(k);
  }
  return seen;
};

describe('headings', () => {
  it('measures turns the short way round', () => {
    expect(turnBetween(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    expect(turnBetween(3, -3)).toBeCloseTo(2 * Math.PI - 6);
    expect(headingTo(0, 0, 0, 5)).toBeCloseTo(0);
    expect(headingTo(0, 0, 5, 0)).toBeCloseTo(Math.PI / 2);
  });
});

describe('what catches her eye', () => {
  it('looks at you when you are near and in front of her', () => {
    expect(run(new Attention(P), 0.5, base({ people: [you()] })).key).toBe('you');
  });

  it('looks at you more the more she likes you', () => {
    const cool = candidates(base({ people: [you({ warmth: 0 })] }), [], P)[0].score;
    const warm = candidates(base({ people: [you({ warmth: 1 })] }), [], P)[0].score;
    expect(warm).toBeGreaterThan(cool);
  });

  it('does not see someone stood behind her, but hears someone talking there', () => {
    const behind = { x: 0, y: 1.6, z: -3 };
    const quiet = candidates(base({ people: [{ key: 'jess', ...behind }] }), [], P)[0];
    expect(quiet.score).toBeLessThan(P.attentionMin);
    const talking = candidates(base({ people: [{ key: 'jess', ...behind, speaking: true }] }), [], P)[0];
    expect(talking.score).toBeGreaterThan(P.attentionMin * 4);
  });

  it('turns to whoever is talking', () => {
    const view = base({ people: [you(), { key: 'jess', x: 3, y: 1.6, z: 2, speaking: true }] });
    expect(run(new Attention(P), 1, view).key).toBe('jess');
  });

  it('looks at you, not away, while you talk to her, however long', () => {
    const view = base({ people: [you({ talkingToMe: true })], vehicles: [{ key: 'red', x: 4, y: 0.8, z: 6, speed: 8 }] });
    expect(keysOver(new Attention(P), 30, view)).toEqual(['you']);
  });

  it('ignores people and vehicles out of range, and parked vehicles', () => {
    const far = base({ people: [you({ z: P.attentionRange + 5 })], vehicles: [{ key: 'red', x: 0, y: 0.8, z: 4, speed: 0 }] });
    expect(candidates(far, [], P)).toEqual([]);
  });

  it('follows a quad going past', () => {
    expect(run(new Attention(P), 0.5, base({ vehicles: [{ key: 'red', x: 2, y: 0.8, z: 8, speed: 8 }] })).key).toBe('vehicle:red');
  });
});

describe('noticing things happen', () => {
  it('turns at once to a backfire behind her, even mid-look at something else', () => {
    const a = new Attention(P);
    run(a, 0.3, base({ people: [you()] }));
    a.notice({ kind: 'backfire', key: 'red', x: 0, y: 0.8, z: -10 });
    expect(a.update(dt, base({ people: [you()] })).key).toBe('backfire:red');
  });

  it('loses interest in a notice once it has had its time', () => {
    const a = new Attention(P);
    a.notice({ kind: 'engineStart', key: 'blue', x: 3, y: 0.8, z: 6 });
    expect(run(a, 0.5, base()).key).toBe('engineStart:blue');
    expect(run(a, NOTICE_KINDS.engineStart.seconds, base())).toBe(null);
  });

  it('cares about engines as much as her engine interest says', () => {
    const n = [{ kind: 'stall', key: 'stall:red', x: 0, y: 0.8, z: 5, age: 0, strength: 1 }];
    const keen = candidates(base(), n, { ...P, attentionEngines: 2 })[0].score;
    const not = candidates(base(), n, { ...P, attentionEngines: 0.5 })[0].score;
    expect(keen).toBeCloseTo(not * 4);
  });

  it('only notices within a kind of thing\'s range', () => {
    const n = (z) => [{ kind: 'rev', key: 'rev:red', x: 0, y: 0.8, z, age: 0, strength: 1 }];
    expect(candidates(base(), n(NOTICE_KINDS.rev.range + 1), P)).toEqual([]);
    expect(candidates(base(), n(10), P)).toHaveLength(1);
  });

  it('merges a repeat from the same thing rather than piling them up', () => {
    const a = new Attention(P);
    a.notice({ kind: 'rev', key: 'red', x: 0, y: 0.8, z: 5 });
    a.notice({ kind: 'rev', key: 'red', x: 0, y: 0.8, z: 5 });
    expect(a.notices).toHaveLength(1);
  });

  it('ignores kinds nobody has defined', () => {
    const a = new Attention(P);
    a.notice({ kind: 'nonsense', x: 0, y: 0, z: 1 });
    expect(a.notices).toHaveLength(0);
  });

  it('has a salience for every kind', () => {
    for (const kind of Object.keys(NOTICE_KINDS)) expect(DEFAULT_NOTICE_PARAMS[kind]).toBeGreaterThan(0);
  });
});

describe('holding and tiring', () => {
  it('holds a look rather than flicking to something only a little better', () => {
    const a = new Attention(P);
    const view = (better) => base({ people: [you(), { key: 'jess', x: -2, y: 1.6, z: 3 }], focus: better ? { x: 1, y: 1, z: 2, weight: P.attentionYou / P.attentionFocus * 1.05 } : null });
    run(a, 0.2, view(false));
    expect(a.update(dt, view(true)).key).toBe('you');
  });

  it('glances between you and looking about instead of staring', () => {
    const a = new Attention(P, DEFAULT_NOTICE_PARAMS, () => 0.5);
    const seen = keysOver(a, 40, base({ people: [you()], noGaze: false }));
    expect(seen.filter((k) => k === 'you').length).toBeGreaterThan(2);
    expect(seen).toContain('about');
  });

  it('turns to face something held over her shoulder, but not what she is busy with', () => {
    const a = new Attention(P);
    const side = base({ people: [{ key: 'jess', x: 4, y: 1.6, z: -1, speaking: true }] });
    expect(run(a, 0.5, side).turnTo).toBe(null);
    expect(run(a, P.attentionBodyAfter, side).turnTo).toBeCloseTo(headingTo(0, 0, 4, -1));
    const busy = new Attention(P);
    expect(run(busy, 5, base({ focus: { x: 4, y: 1, z: -1, weight: 1 } })).turnTo).toBe(null);
  });

  it('looks where she is going over everything but a fright', () => {
    const a = new Attention(P);
    const view = base({ people: [you({ talkingToMe: false })], vehicles: [{ key: 'red', x: 2, y: 0.8, z: 6, speed: 8 }], intent: { x: -5, y: 0, z: 2 } });
    expect(run(a, 0.5, view).key).toBe('intent');
  });
});

describe('what she can hear', () => {
  const N = DEFAULT_NOTICE_PARAMS;
  it('hears everything in full on a dry day, outside, with no engine near', () => {
    expect(hearingFactor({ rain: 0, indoors: false, engines: [80] })).toBe(1);
  });

  it('is dulled by rain, the barn and an engine beside her, all together more than any one', () => {
    const rain = hearingFactor({ rain: 1 });
    const barn = hearingFactor({ indoors: true });
    const engine = hearingFactor({ engines: [0] });
    expect(rain).toBeCloseTo(1 - N.hearRain);
    expect(barn).toBeCloseTo(1 - N.hearBarn);
    expect(engine).toBeCloseTo(1 - N.hearEngine);
    expect(hearingFactor({ rain: 1, indoors: true, engines: [0] })).toBeLessThan(Math.min(rain, barn, engine));
  });

  it('never loses all of it, and an engine fades with distance', () => {
    expect(hearingFactor({ rain: 1, indoors: true, engines: [0] }, { ...N, hearRain: 1, hearBarn: 1 })).toBe(N.hearFloor);
    expect(hearingFactor({ engines: [6] })).toBeGreaterThan(hearingFactor({ engines: [1] }));
  });

  it('misses a far-off sound in a downpour but not a near one, and still sees what is not heard', () => {
    const at = (z, kind) => [{ kind, key: 'a', x: 0, y: 1.5, z, strength: 1, age: 0 }];
    const far = (hearing) => candidates(base({ hearing }), at(60, 'bang'), P, N).length;
    expect(far(1)).toBe(1);
    expect(far(0.3)).toBe(0);
    expect(candidates(base({ hearing: 0.3 }), at(5, 'bang'), P, N)).toHaveLength(1);
    const lurch = (hearing) => candidates(base({ hearing }), at(10, 'lurch'), P, N)[0].score;
    expect(lurch(0.3)).toBe(lurch(1));
  });
});
