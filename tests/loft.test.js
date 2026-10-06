import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { DEFAULT_LOFT_PARAMS, loftShape, overLoft, onLoft, Climb, pathAt, Hiding, StrawDrop } from '../src/world/loft.js';

const P = DEFAULT_LOFT_PARAMS;

describe('loft shape', () => {
  const s = loftShape(LAYOUT, 10);
  it('puts the planks at the layout height and the ladder in the rail gap', () => {
    expect(s.top).toBeCloseTo(13.5);
    expect(s.ladderTop.y).toBeCloseTo(13.5);
    const [a, b] = s.railSpans;
    expect(a.z1).toBeLessThan(LAYOUT.loft.ladder.z);
    expect(b.z0).toBeGreaterThan(LAYOUT.loft.ladder.z);
  });
  it('keeps the ladder foot clear of the planks and the top over them', () => {
    expect(overLoft(LAYOUT, s.ladderFoot.x, s.ladderFoot.z)).toBe(false);
    expect(overLoft(LAYOUT, s.ladderTop.x, s.ladderTop.z)).toBe(true);
  });
  it('is above the doorway and its header, so quads drive in underneath', () => {
    expect(LAYOUT.loft.floor).toBeGreaterThanOrEqual(LAYOUT.barn.door.height + 0.3);
    expect(overLoft(LAYOUT, LAYOUT.barn.x + LAYOUT.barn.halfX - 1, LAYOUT.barn.z)).toBe(true);
  });
  it('keeps the ladder foot clear of the bay and the bench', () => {
    const bay = LAYOUT.bay;
    const f = s.ladderFoot;
    expect(Math.abs(f.x - bay.x) > bay.halfX + 0.4 || Math.abs(f.z - bay.z) > bay.halfZ + 0.4).toBe(true);
    expect(Math.abs(f.z - LAYOUT.bench.z)).toBeGreaterThan(1.5);
  });
  it('has the ladder and the seat in the walkable band, where the roof is high enough', () => {
    expect(s.ladderTop.z).toBeGreaterThan(s.walkMinZ);
    expect(s.ladderTop.z).toBeLessThan(s.walkMaxZ);
    expect(LAYOUT.loft.seat.z).toBeGreaterThan(s.walkMinZ);
    expect(LAYOUT.loft.seat.z).toBeLessThan(s.walkMaxZ);
    // Standing eye height (1.62 m) and a margin under the roof's underside at the edge of the band.
    const b = LAYOUT.barn;
    const roofAt = (dz) => b.wallHeight + (b.ridge - b.wallHeight) * (1 - Math.abs(dz) / b.halfZ);
    expect(roofAt(LAYOUT.loft.band)).toBeGreaterThan(LAYOUT.loft.floor + 1.62 + 0.3);
  });
  it('puts the hay door at head height above the planks', () => {
    const h = LAYOUT.loft.hayDoor;
    expect(h.sill - LAYOUT.loft.floor).toBeGreaterThan(0.3);
    expect(h.top - LAYOUT.loft.floor).toBeGreaterThan(1.62);
  });
  it('lets a girl sit and the hay sit on the planks', () => {
    expect(overLoft(LAYOUT, LAYOUT.loft.seat.x, LAYOUT.loft.seat.z)).toBe(true);
    expect(overLoft(LAYOUT, LAYOUT.loft.hideSpot.x, LAYOUT.loft.hideSpot.z)).toBe(true);
  });
  it('knows whether you are up or below', () => {
    expect(onLoft(LAYOUT, -60.5, 13.5, 60, 10)).toBe(true);
    expect(onLoft(LAYOUT, -60.5, 10, 60, 10)).toBe(false);
    expect(onLoft(LAYOUT, -66, 13.5, 60, 10)).toBe(false);
  });
});

describe('Climb', () => {
  it('goes from one end to the other and says when it is done', () => {
    const c = new Climb({ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 3 }, 2);
    const mid = c.update(1);
    expect(mid.y).toBeCloseTo(1);
    expect(mid.done).toBe(false);
    const end = c.update(1.5);
    expect(end).toMatchObject({ x: 1, y: 2, z: 3, done: true });
  });
});

describe('pathAt', () => {
  const pts = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }, { x: 2, y: 2, z: 0 }];
  it('runs along the points by length and flags the climbing part', () => {
    expect(pathAt(pts, 0)).toMatchObject({ y: 0, climbing: true });
    expect(pathAt(pts, 0.5)).toMatchObject({ x: 0, y: 2 });
    expect(pathAt(pts, 0.75)).toMatchObject({ x: 1, y: 2, climbing: false });
    expect(pathAt(pts, 1)).toMatchObject({ x: 2, y: 2 });
  });
});

describe('Hiding', () => {
  it('does nothing unless you are hidden', () => {
    expect(new Hiding({ ...P }).update(1000)).toBe(null);
  });
  it('calls for you, then finds you', () => {
    const h = new Hiding({ ...P });
    h.hide();
    const out = [];
    for (let t = 0; t < 200 && h.active; t++) {
      const e = h.update(1);
      if (e) out.push(e);
    }
    expect(out[0]).toBe('call');
    expect(out.at(-1)).toBe('found');
    expect(out.filter((e) => e === 'call').length).toBeGreaterThanOrEqual(2);
    expect(h.active).toBe(false);
  });
  it('finds you sooner with a girl in the loft', () => {
    const h = new Hiding({ ...P });
    h.hide();
    let t = 0;
    while (h.update(1, { girlInLoft: true }) !== 'found') t++;
    expect(t).toBeLessThan(P.findWithGirl + 1);
  });
});

describe('StrawDrop', () => {
  const jess = { x: 0, z: 0 };
  const near = { x: 1, z: 0, below: true };
  const run = (d, ctx, seconds) => {
    let n = 0;
    for (let i = 0; i < seconds; i++) if (d.update(1, ctx)) n++;
    return n;
  };
  it('needs Jess up there and you stood below near her', () => {
    expect(run(new StrawDrop({ ...P }, () => 0), { jessUp: false, you: near, jess }, 60)).toBe(0);
    expect(run(new StrawDrop({ ...P }, () => 0), { jessUp: true, you: { ...near, below: false }, jess }, 60)).toBe(0);
    expect(run(new StrawDrop({ ...P }, () => 0), { jessUp: true, you: { x: 9, z: 0, below: true }, jess }, 60)).toBe(0);
  });
  it('waits for you to linger, then drops once and cools off', () => {
    const d = new StrawDrop({ ...P }, () => 0);
    expect(run(d, { jessUp: true, you: near, jess }, 1)).toBe(0);
    expect(run(d, { jessUp: true, you: near, jess }, 10)).toBe(1);
    expect(run(d, { jessUp: true, you: near, jess }, P.strawCooldown - 15)).toBe(0);
  });
  it('is chancy', () => {
    expect(run(new StrawDrop({ ...P }, () => 0.99), { jessUp: true, you: near, jess }, 100)).toBe(0);
  });
});
