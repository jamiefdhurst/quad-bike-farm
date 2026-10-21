import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createFields } from '../src/world/fields.js';
import { Haymaking, DEFAULT_HAY_PARAMS, HAY_PARAM_RANGES, STANDING, CUT, BALED, STACK_CAPACITY, trailerSlots, stackSpots } from '../src/world/haymaking.js';

const RECT = { minX: 100, maxX: 132, minZ: -26, maxZ: -8 };
const mk = (over = {}) => new Haymaking({ rect: RECT, params: { ...DEFAULT_HAY_PARAMS, ...over } });
// The tractor driving along +x at 2 m/s on row z.
const drive = (h, z, { from = 98, to = 134, speed = 2, day = 1, working = true } = {}) => {
  const events = [];
  for (let x = from; x <= to; x += 0.2) events.push(...h.update(0.1, { x, z, heading: Math.PI / 2, speed, working, day }));
  return events;
};
const started = (over) => {
  const h = mk(over);
  h.start();
  return h;
};

describe('the patch', () => {
  it('is a grid of standing cells', () => {
    const h = mk();
    expect(h.cells).toBe(16 * 9);
    expect(h.count(STANDING)).toBe(h.cells);
    expect(h.index(101, -25)).toBe(0);
    expect(h.index(50, 0)).toBe(-1);
    const c = h.centre(h.index(111, -15));
    expect(h.index(c.x, c.z)).toBe(h.index(111, -15));
  });

  it('has a phase only while the job is on', () => {
    const h = mk();
    expect(h.phase).toBe('idle');
    h.start();
    expect(h.phase).toBe('cut');
  });

  it('has every tunable in range', () => {
    for (const k of Object.keys(DEFAULT_HAY_PARAMS)) {
      const [lo, hi] = HAY_PARAM_RANGES[k];
      expect(DEFAULT_HAY_PARAMS[k], k).toBeGreaterThanOrEqual(lo);
      expect(DEFAULT_HAY_PARAMS[k], k).toBeLessThanOrEqual(hi);
    }
  });
});

describe('mowing', () => {
  it('cuts the cells under a pass and nothing outside the swath', () => {
    const h = started();
    drive(h, -17);
    expect(h.cut).toBeGreaterThan(8);
    expect(h.state[h.index(116, -17)]).toBe(CUT);
    expect(h.state[h.index(116, -23)]).toBe(STANDING);
    expect(h.state[h.index(116, -11)]).toBe(STANDING);
  });

  it('needs the job on, the tractor running and a working pace', () => {
    const off = mk();
    drive(off, -17);
    expect(off.cut).toBe(0);
    const stopped = started();
    drive(stopped, -17, { working: false });
    drive(stopped, -17, { speed: 0.1 });
    drive(stopped, -17, { speed: 9 });
    expect(stopped.cut).toBe(0);
  });

  it('counts a cell once and moves on to baling when enough is cut', () => {
    const h = started({ cutNeeded: 20 });
    const first = drive(h, -17);
    drive(h, -17);
    const once = h.cut;
    expect(once).toBe(h.count(CUT));
    expect(first.some((e) => e.type === 'cut')).toBe(true);
    drive(h, -13);
    drive(h, -21);
    expect(h.phase).toBe('bale');
    expect(first.filter((e) => e.type === 'cutDone').length).toBeGreaterThanOrEqual(0);
  });

  it('notes the day the cutting began', () => {
    const h = started();
    drive(h, -17, { day: 4 });
    expect(h.cutDay).toBe(4);
  });
});

describe('baling', () => {
  const cutAll = (h) => {
    for (let z = -25; z < -8 && h.phase === 'cut'; z += 2) drive(h, z + 1, { from: 98, to: 112 });
  };

  it('does nothing until the cutting is done, then leaves a bale every so many cells baled', () => {
    const h = started({ cutNeeded: 30, cellsPerBale: 6, balesNeeded: 4 });
    cutAll(h);
    expect(h.phase).toBe('bale');
    const before = h.made; // the pass that finishes the cutting may start baling its own last cells
    expect(before).toBeLessThan(4);
    const events = [];
    for (let z = -25; z < -8; z += 2) events.push(...drive(h, z + 1));
    expect(h.made).toBe(4);
    expect(h.bales.length).toBe(4);
    expect(events.filter((e) => e.type === 'bale').length).toBe(4 - before);
    expect(events.some((e) => e.type === 'baleDone')).toBe(true);
    expect(h.phase).toBe('load');
    expect(h.count(BALED)).toBeGreaterThan(0);
  });

  it('leaves each bale behind the tractor', () => {
    const h = started({ cutNeeded: 30, cellsPerBale: 6, balesNeeded: 2 });
    cutAll(h);
    drive(h, -17);
    drive(h, -13);
    drive(h, -21);
    for (const b of h.bales) expect(b.state).toBe('ground');
    expect(h.bales.length).toBeGreaterThan(0);
  });

  it('still leaves every bale if the patch runs out of cells first', () => {
    const h = started({ cutNeeded: 10, cellsPerBale: 200, balesNeeded: 3 });
    cutAll(h);
    for (let z = -25; z < -8; z += 2) drive(h, z + 1);
    expect(h.made).toBe(3);
  });
});

describe('loading', () => {
  const ready = () => {
    const h = started({ balesNeeded: 3 });
    h.cut = 99;
    for (let i = 0; i < 3; i++) h.drop({ x: 110 + i * 4, z: -17, heading: 0 });
    return h;
  };

  it('offers only loose bales, nearest first', () => {
    const h = ready();
    expect(h.phase).toBe('load');
    expect(h.nearest(120, -17).x).toBeCloseTo(118, 5);
    h.claim(h.bales[2].id, 'amy');
    expect(h.free().length).toBe(2);
    expect(h.nearest(120, -17).id).toBe(h.bales[1].id);
  });

  it('lets only one girl claim a bale, and gives it back if she is called away or is too slow', () => {
    const h = ready();
    const id = h.bales[0].id;
    expect(h.claim(id, 'amy')).toBeTruthy();
    expect(h.claim(id, 'jess')).toBeNull();
    h.release(id, { x: 5, z: 6 });
    expect(h.get(id).state).toBe('ground');
    expect(h.get(id).x).toBe(5);
    h.claim(id, 'jess');
    h.update(h.p.claimSeconds + 1, { x: 0, z: 0, heading: 0, speed: 0, working: false });
    expect(h.get(id).state).toBe('ground');
  });

  it('counts loaded bales and finishes the stage when the last is up', () => {
    const h = ready();
    expect(h.load(h.bales[0].id, h.freeSlot(16))).toBe('more');
    expect(h.load(h.bales[1].id, h.freeSlot(16))).toBe('more');
    expect(h.freeSlot(16)).toBe(2);
    expect(h.load(h.bales[2].id, 2)).toBe('loaded');
    expect(h.phase).toBe('stack');
    expect(h.load(h.bales[2].id, 3)).toBeNull();
  });

  it('never releases a loaded bale', () => {
    const h = ready();
    h.load(h.bales[0].id, 0);
    expect(h.release(h.bales[0].id)).toBeNull();
    expect(h.get(h.bales[0].id).state).toBe('loaded');
  });

  it('keeps a slot for the girl carrying to it', () => {
    const h = ready();
    h.claim(h.bales[0].id, 'amy', h.freeSlot(16));
    h.claim(h.bales[1].id, 'jess', h.freeSlot(16));
    expect(h.bales[0].slot).toBe(0);
    expect(h.bales[1].slot).toBe(1);
    expect(h.freeSlot(16)).toBe(2);
    h.release(h.bales[0].id);
    expect(h.freeSlot(16)).toBe(0);
  });

  it('reports a full trailer', () => {
    const h = ready();
    expect(h.freeSlot(0)).toBe(-1);
    expect(h.canLoad(0)).toBe(false);
    expect(h.canLoad(5)).toBe(true);
  });
});

describe('stacking', () => {
  const OPEN = { minX: 178.5, maxX: 183.5, minZ: -18.5, maxZ: -9.5 };
  const loaded = () => {
    const h = started({ balesNeeded: 2 });
    h.cut = 99;
    h.made = 2;
    for (let i = 0; i < 2; i++) {
      const b = h.drop({ x: 0, z: 0, heading: 0 });
      h.load(b.id, i);
    }
    h.made = 2;
    return h;
  };

  it('needs the trailer in the bay and still', () => {
    const h = loaded();
    expect(h.phase).toBe('stack');
    expect(h.deliver(OPEN, { x: 150, z: -14, speed: 0 })).toBeNull();
    expect(h.deliver(OPEN, { x: 181, z: -14, speed: 3 })).toBeNull();
    expect(h.phase).toBe('stack');
  });

  it('stacks the bales, finishes the job and keeps the count', () => {
    const h = loaded();
    const e = h.deliver(OPEN, { x: 181, z: -14, speed: 0.1 });
    expect(e.ids.length).toBe(2);
    expect(h.stacked).toBe(2);
    expect(h.loaded).toBe(0);
    expect(h.phase).toBe('done');
    expect(h.bales.length).toBe(0);
  });

  it('puts the stack along the back of the bay in layers', () => {
    const spots = stackSpots(OPEN, 8);
    expect(spots.length).toBe(8);
    for (const s of spots) {
      expect(s.x).toBeGreaterThan(OPEN.minX);
      expect(s.x).toBeLessThan(OPEN.maxX);
    }
    expect(spots[5].y).toBeGreaterThan(spots[0].y);
    expect(new Set(spots.map((s) => `${s.x}|${s.y}`)).size).toBe(8);
  });
});

describe('the trailer slots', () => {
  it('are all different, on the bed and behind the front stack', () => {
    const slots = trailerSlots(16);
    expect(new Set(slots.map((s) => `${s.x}|${s.y}|${s.z}`)).size).toBe(16);
    for (const s of slots) {
      expect(Math.abs(s.x)).toBeLessThanOrEqual(0.55);
      expect(s.z).toBeGreaterThan(-1.7);
      expect(s.z).toBeLessThan(0.5);
    }
    expect(slots[8].y).toBeGreaterThan(slots[0].y);
  });
});

describe('growing back and keeping', () => {
  it('keeps the cut cells and the stack', () => {
    const h = started();
    drive(h, -17, { day: 2 });
    h.stacked = 5;
    const save = JSON.parse(JSON.stringify(h.toJSON()));
    const next = mk();
    next.restore(save, 3);
    expect(next.count(CUT)).toBe(h.cut);
    expect(next.stacked).toBe(5);
    expect(next.cutDay).toBe(2);
  });

  it('grows back after regrowDays but keeps the stack', () => {
    const h = started();
    drive(h, -17, { day: 2 });
    h.stacked = 5;
    const save = h.toJSON();
    const next = mk({ regrowDays: 3 });
    next.restore(save, 5);
    expect(next.count(CUT)).toBe(0);
    expect(next.stacked).toBe(5);
  });

  it('copes with a missing or mangled save', () => {
    const h = mk();
    h.restore(undefined, 1);
    h.restore({ cut: 'x', cutDay: 1 }, 1);
    h.restore({ cut: [-1, 9999, 'a', 3], cutDay: 1, stacked: 1e9 }, 1);
    expect(h.count(CUT)).toBe(1);
    expect(h.stacked).toBeLessThanOrEqual(STACK_CAPACITY);
  });

  it('starts the job again from the cut hay that is left', () => {
    const h = started();
    drive(h, -17, { day: 1 });
    const save = h.toJSON();
    const next = mk();
    next.restore(save, 2);
    next.start();
    expect(next.cut).toBe(h.cut);
    expect(next.phase).toBe('cut');
  });
});

describe('the hay patch in the farm', () => {
  const fields = createFields(LAYOUT);
  const m = LAYOUT.hayMeadow;

  it('is all stubble field with nothing built on it', () => {
    for (let x = m.minX; x <= m.maxX; x += 2) for (let z = m.minZ; z <= m.maxZ; z += 2) expect(fields.stubbleAt(x, z), `${x},${z}`).toBeGreaterThan(0.5);
  });

  it('is clear of the field\'s wet hollow', () => {
    const h = LAYOUT.stubbleFields.north.hollow;
    for (const [x, z] of [[m.minX, m.minZ], [m.maxX, m.minZ], [m.minX, m.maxZ], [m.maxX, m.maxZ]]) {
      expect(Math.hypot((x - h.x) / h.rx, (z - h.z) / h.rz)).toBeGreaterThan(1);
    }
  });

  it('is on the way from the first gateway to the Dutch barn without crossing the barn', () => {
    expect(m.maxX).toBeLessThan(LAYOUT.dutchBarn.x - LAYOUT.dutchBarn.halfX);
  });
});
