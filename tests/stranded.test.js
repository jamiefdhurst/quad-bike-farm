import { describe, it, expect } from 'vitest';
import { DEFAULT_STRANDED_PARAMS as P, STRANDED_RANGES, Stranded, rescueFavour } from '../src/npc/stranded.js';
import { StrandedWait } from '../src/npc/strandedWait.js';
import { SPOTS, nearestNamedSpot } from '../src/npc/spotNames.js';
import { Bog } from '../src/vehicle/bog.js';
import { AMY_STRANDED_LINES, JESS_STRANDED_LINES } from '../src/npc/strandedLines.js';
import { CHARACTERS } from '../src/npc/characters.js';

const run = (s, seconds, ctx, dt = 0.5) => {
  const out = [];
  for (let t = 0; t < seconds; t += dt) out.push(...s.update(dt, ctx));
  return out;
};

describe('Stranded', () => {
  it('shouts after a moment, often when you are near and rarely when you are far', () => {
    const near = new Stranded('bog', { x: 0, z: 0 });
    const far = new Stranded('bog', { x: 0, z: 0 });
    const n = run(near, 100, { youDist: 30, freed: false }).filter((e) => e.type === 'shout');
    const f = run(far, 100, { youDist: 300, freed: false }).filter((e) => e.type === 'shout');
    expect(n[0].n).toBe(0);
    expect(n.length).toBeGreaterThan(f.length * 2);
    expect(n.every((e) => e.near)).toBe(true);
    expect(f.every((e) => !e.near)).toBe(true);
  });

  it('is worth more the sooner you came, and nothing extra when you are slow', () => {
    expect(rescueFavour(0)).toBeCloseTo(P.rescueFavour + P.quickFavour);
    expect(rescueFavour(P.slowAfter / 2)).toBeCloseTo(P.rescueFavour + P.quickFavour / 2);
    expect(rescueFavour(P.slowAfter * 3)).toBe(P.rescueFavour);
  });

  it('is rescued with favour only if you came near', () => {
    const came = new Stranded('bog', { x: 0, z: 0 });
    run(came, 20, { youDist: 3, freed: false });
    const [r] = came.update(1, { youDist: 3, freed: true });
    expect(r).toMatchObject({ type: 'rescued', came: true, quick: true });
    expect(r.favour).toBeGreaterThan(P.rescueFavour);
    expect(came.done).toBe('rescued');

    const alone = new Stranded('tipped', { x: 0, z: 0 });
    run(alone, 20, { youDist: 100, freed: false });
    expect(alone.update(1, { youDist: 100, freed: true })[0].favour).toBe(0);
  });

  it('holds it against you when she is left too long, once, then gives up', () => {
    const s = new Stranded('bog', { x: 0, z: 0 });
    const events = run(s, P.giveUpAfter + 5, { youDist: 100, freed: false });
    expect(events.filter((e) => e.type === 'left')).toHaveLength(1);
    expect(events.find((e) => e.type === 'left').favour).toBe(P.leftFavour);
    const gave = events.find((e) => e.type === 'gaveUp');
    expect(gave.favour).toBe(P.giveUpFavour);
    expect(s.done).toBe('gaveUp');
    expect(s.update(1, { youDist: 100, freed: false })).toEqual([]);
  });

  it('does not hold it against you if you came and could not shift it', () => {
    const s = new Stranded('bog', { x: 0, z: 0 });
    const events = run(s, P.giveUpAfter + 5, { youDist: 2, freed: false });
    expect(events.some((e) => e.type === 'left')).toBe(false);
    expect(events.find((e) => e.type === 'gaveUp').favour).toBe(0);
  });

  it('has a range for every tunable', () => {
    for (const k of Object.keys(P)) expect(STRANDED_RANGES[k], k).toBeDefined();
  });
});

describe('spot names', () => {
  it('finds the nearest named spot', () => {
    expect(nearestNamedSpot(-29, 139).id).toBe('ford');
    expect(nearestNamedSpot(-52, 60).id).toBe('yard');
    expect(nearestNamedSpot(185, -10).id).toBe('dutchBarn');
  });
  it('gives every spot a distinct id', () => {
    expect(new Set(SPOTS.map((s) => s.id)).size).toBe(SPOTS.length);
  });
  it('has a callout line for every spot, bogged and tipped, for each girl, naming the place', () => {
    for (const lines of [AMY_STRANDED_LINES, JESS_STRANDED_LINES]) {
      for (const s of SPOTS) {
        for (const kind of ['bog', 'tip']) expect(lines[`callout_${kind}_${s.id}`].lines[0]).toContain(s.name);
      }
    }
    for (const c of CHARACTERS) expect(c.lines.callout_bog_ford.shout).toBe(true);
  });
  it('keeps the girls\' lines free of em dashes and of he/she/they for you', () => {
    for (const lines of [AMY_STRANDED_LINES, JESS_STRANDED_LINES]) {
      for (const e of Object.values(lines)) for (const l of e.lines) expect(l).not.toMatch(/—|\b(he|she|they)\b/i);
    }
  });
});

describe('a shove in a bog', () => {
  it('loosens a shallow one but not a deep one', () => {
    const shallow = new Bog();
    shallow.sink = 0.5;
    for (let i = 0; i < 30; i++) shallow.shove(0.1);
    expect(shallow.sink).toBeLessThan(0.3);
    const deep = new Bog();
    deep.sink = 0.8;
    for (let i = 0; i < 100; i++) deep.shove(0.1);
    expect(deep.sink).toBe(0.8);
  });
  it('a pretend bog holds until it is out, then lets go', () => {
    const b = new Bog();
    b.sink = 0.75;
    b.fake = true;
    b.update(1, { bog: 0 });
    expect(b.sink).toBeGreaterThan(0.7);
    b.sink = 0.1;
    b.update(1, { bog: 0 });
    expect(b.fake).toBe(false);
  });
});

describe('StrandedWait', () => {
  const quad = (extra = {}) => ({ towed: false, pushLeft: 0, bog: { sink: 0.7 }, ...extra });
  const make = (q, events = []) => {
    const model = new Stranded('bog', { x: 0, z: 0 });
    const you = { d: 50 };
    const w = new StrandedWait(q, { params: P, model, you: () => you.d, onEvent: (e) => events.push(e) });
    return { w, model, you, events };
  };

  it('waits with the brake off and the throttle shut, and works the throttle when hauled or shoved', () => {
    const q = quad();
    const { w } = make(q);
    w.update(0.1);
    expect(w.controls).toMatchObject({ throttle: 0, brake: 0 });
    q.towed = true;
    w.update(0.1);
    expect(w.controls.throttle).toBe(P.pushThrottle);
    q.towed = false;
    q.pushLeft = 1;
    w.update(0.1);
    expect(w.controls.throttle).toBe(P.pushThrottle);
  });

  it('is done and rescued once the quad is out of the mud', () => {
    const q = quad();
    const { w, you, events } = make(q);
    you.d = 3;
    w.update(1);
    q.bog.sink = 0.1;
    w.update(1);
    expect(w.done).toBe(true);
    expect(w.result).toBe('rescued');
    expect(events.some((e) => e.type === 'rescued' && e.came)).toBe(true);
  });

  it('gives up with nobody coming', () => {
    const { w } = make(quad());
    for (let t = 0; t < P.giveUpAfter + 5; t += 1) w.update(1);
    expect(w.result).toBe('gaveUp');
  });
});
