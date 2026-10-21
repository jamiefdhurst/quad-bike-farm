import { describe, it, expect } from 'vitest';
import { createRandom } from '../src/core/random.js';
import { leafCover, conkerSpots, leavesInAir, DEFAULT_AUTUMN_PARAMS as P, AUTUMN_TINTS } from '../src/world/autumn.js';
import { surfaceFeel, DEFAULT_SURFACE_PARAMS as S } from '../src/world/surfaces.js';
import { Conkers } from '../src/npc/conkers.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';
import { VOICE_LINES } from '../src/npc/voiceLines.js';
import { JESS_LINES } from '../src/npc/jessLines.js';
import { girlActions } from '../src/debug/girlActions.js';

const woods = { inWoods: (x, z, m = 0) => Math.abs(x) < 80 + m && z > -200 - m && z < -80 + m, treeOk: (x, z) => z < -90 };

describe('the autumn look', () => {
  it('turns every kind of tree a colour with more red than blue', () => {
    for (const [r, , b] of Object.values(AUTUMN_TINTS)) expect(r).toBeGreaterThan(b * 3);
  });
});

describe('the wood in autumn', () => {
  it('is deep in leaves inside the wood only', () => {
    expect(leafCover(woods, 0, -150)).toBe(1);
    expect(leafCover(woods, 0, -20)).toBe(0);
    expect(leafCover(null, 0, 0)).toBe(0);
  });

  it('puts conkers round the oaks and keeps them off the track', () => {
    const trees = [[0, -120, 1], [10, -140, 1]];
    const spots = conkerSpots(trees, woods, 7, createRandom(3));
    expect(spots.length).toBe(14);
    for (const [x, z] of spots) expect(Math.min(...trees.map(([tx, tz]) => Math.hypot(tx - x, tz - z)))).toBeLessThan(3);
    expect(conkerSpots(trees, { ...woods, treeOk: () => false }, 7, createRandom(3))).toEqual([]);
  });

  it('has most leaves in the air under the trees and few in the fields', () => {
    expect(leavesInAir(P, woods, 0, -150)).toBe(P.leafFall);
    expect(leavesInAir(P, woods, 0, -20)).toBe(Math.round(P.leafFall * P.leafFallOutside));
  });

  it('is slippery under wet leaves, a little under dry ones, and not at all outside', () => {
    const bare = surfaceFeel(S, 0, 0, 1, 0, 0);
    const wet = surfaceFeel(S, 0, 0, 1, 0, 1);
    const dry = surfaceFeel(S, 0, 0, 0, 0, 1);
    expect(wet.grip).toBeLessThan(dry.grip);
    expect(dry.grip).toBeLessThan(1);
    expect(wet.grip).toBeCloseTo(S.leafGrip, 5);
    expect(wet.roll).toBeGreaterThan(bare.roll);
    expect(surfaceFeel(S, 0, 0, 1, 0, 0)).toEqual(bare);
  });
});

describe('Jess throwing a conker', () => {
  const ctxOf = (o = {}) => ({
    autumn: true,
    you: { x: 0, y: 1.6, z: -100 },
    girls: [{ id: 'jess', free: true, x: 6, z: -100, inWoods: true, throwing: false }, { id: 'amy', free: true, x: 7, z: -100, inWoods: true, throwing: false }],
    ...o,
  });
  const make = () => new Conkers({ ...P }, createRandom(9));

  it('offers it to Jess alone, in the wood, in range, on an autumn day', () => {
    const c = make();
    c.clock = 1000;
    expect(c.offers(ctxOf()).map((o) => o.girl)).toEqual(['jess']);
    expect(c.offers(ctxOf({ autumn: false }))).toEqual([]);
    expect(c.offers(ctxOf({ girls: [{ id: 'jess', free: true, x: 40, z: -100, inWoods: true }] }))).toEqual([]);
    expect(c.offers(ctxOf({ girls: [{ id: 'jess', free: true, x: 1, z: -100, inWoods: true }] }))).toEqual([]);
    expect(c.offers(ctxOf({ girls: [{ id: 'jess', free: true, x: 6, z: -100, inWoods: false }] }))).toEqual([]);
    expect(c.offers(ctxOf({ girls: [{ id: 'jess', free: false, x: 6, z: -100, inWoods: true }] }))).toEqual([]);
  });

  it('waits out the cooldown between throws', () => {
    const c = make();
    c.clock = 1000;
    c.take({ girl: 'jess' }, ctxOf());
    c.windup = null;
    expect(c.offers(ctxOf())).toEqual([]);
    c.clock += P.throwCooldown;
    expect(c.offers(ctxOf())).toHaveLength(1);
  });

  const fly = (c, ctx, hit) => {
    const events = [];
    for (let i = 0; i < 400 && c.active; i++) events.push(...c.update(1 / 30, { ...ctx, girls: ctx.girls.map((g) => ({ ...g, throwing: g.id === 'jess' })) }));
    return events;
  };

  it('winds up, releases and lands at the aim point, and says whether it hit', () => {
    const c = make();
    c.clock = 1000;
    const ctx = ctxOf();
    const start = c.take({ girl: 'jess' }, ctx);
    expect(start).toMatchObject({ type: 'windup', girl: 'jess', seconds: P.throwWindup });
    const events = fly(c, ctx);
    expect(events.map((e) => e.type)).toEqual(['release', 'land']);
    const land = events[1];
    const near = Math.hypot(land.at.x - ctx.you.x, land.at.z - ctx.you.z);
    expect(near).toBeLessThanOrEqual(P.throwSpread + 1e-6);
    expect(land.hit).toBe(near < P.throwHitRadius);
  });

  it('flies in an arc that arrives where it was aimed', () => {
    const c = make();
    c.clock = 1000;
    const ctx = ctxOf();
    c.take({ girl: 'jess' }, ctx);
    const girls = ctx.girls.map((g) => ({ ...g, throwing: g.id === 'jess' }));
    let release;
    while (!release) release = c.update(0.05, { ...ctx, girls, hand: { x: 6, y: 1.3, z: -100 } }).find((e) => e.type === 'release');
    c.update(0.001, { ...ctx, girls });
    const f = c.flight;
    f.t = f.total * 0.999;
    const at = c.position();
    expect(Math.hypot(at.x - f.target.x, at.z - f.target.z)).toBeLessThan(0.05);
    expect(Math.abs(at.y - f.target.y)).toBeLessThan(0.05);
  });

  it('misses if you have moved off by the time it lands', () => {
    const c = make();
    c.clock = 1000;
    const ctx = ctxOf();
    c.take({ girl: 'jess' }, ctx);
    const girls = ctx.girls.map((g) => ({ ...g, throwing: g.id === 'jess' }));
    const events = [];
    for (let i = 0; i < 400 && c.active; i++) events.push(...c.update(1 / 30, { ...ctx, you: { ...ctx.you, x: ctx.you.x + 5 }, girls }));
    expect(events.find((e) => e.type === 'land').hit).toBe(false);
  });

  it('drops the throw if she is taken off it', () => {
    const c = make();
    c.clock = 1000;
    const ctx = ctxOf();
    c.take({ girl: 'jess' }, ctx);
    expect(c.update(0.1, ctx).map((e) => e.type)).toEqual(['abandon']);
    expect(c.active).toBe(false);
  });

  it('has Amy remark once on the conkers and once on the slippery leaves', () => {
    const c = make();
    const ctx = ctxOf({ amyCanRemark: true, youInWoods: true, youRiding: true, wet: 0.6 });
    expect(c.update(0.1, ctx).filter((e) => e.type === 'remark').map((e) => e.kind)).toEqual(['slippery']);
    expect(c.update(0.1, ctx).filter((e) => e.type === 'remark').map((e) => e.kind)).toEqual(['conkers']);
    expect(c.update(0.1, ctx)).toEqual([]);
    expect(make().update(0.1, { ...ctx, amyCanRemark: false })).toEqual([]);
    expect(make().update(0.1, { ...ctx, autumn: false })).toEqual([]);
  });

  it('is a chooser offer, has its lines, and has a debug action for Jess only', () => {
    expect(OFFER_KINDS.conker.satisfies).toBeTruthy();
    for (const k of ['conkerAmy', 'conkerWood', 'conkerSlippery']) expect(VOICE_LINES[k].lines.length).toBeGreaterThan(0);
    for (const k of ['conkerGo', 'conkerHit', 'conkerMiss']) expect(JESS_LINES[k].length).toBeGreaterThan(0);
    const actions = girlActions({ companions: [{ character: { id: 'jess' } }, { character: { id: 'amy' } }], hud: { toast() {} } });
    expect(actions.forGirl('jess').some((a) => a.verb === 'conker')).toBe(true);
    expect(actions.forGirl('amy').some((a) => a.verb === 'conker')).toBe(false);
  });
});
