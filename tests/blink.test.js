import { describe, it, expect } from 'vitest';
import { Blink, DEFAULT_BLINK_PARAMS } from '../src/npc/blink.js';

const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const run = (b, seconds, opts, dt = 0.01) => {
  const lids = [];
  for (let t = 0; t < seconds; t += dt) lids.push(b.update(dt, opts));
  return lids;
};
/** The seconds each blink started at, from a run of lids sampled every dt. */
const starts = (lids, dt = 0.01) => lids.flatMap((l, i) => (l > 0 && (i === 0 || lids[i - 1] === 0) ? [i * dt] : []));

describe('Blink', () => {
  it('blinks every 2 to 6 seconds', () => {
    const b = new Blink({ ...DEFAULT_BLINK_PARAMS, blinkDouble: 0 }, { random: seeded(3) });
    const at = starts(run(b, 120));
    expect(at.length).toBeGreaterThan(120 / 6 - 2);
    expect(at.length).toBeLessThan(120 / 2 + 1);
    const gaps = at.slice(1).map((t, i) => t - at[i]);
    expect(Math.min(...gaps)).toBeGreaterThan(1.9);
    expect(Math.max(...gaps)).toBeLessThan(6.3);
  });

  it('takes about 0.15 s a blink, shutting quicker than it opens', () => {
    const b = new Blink({ ...DEFAULT_BLINK_PARAMS }, { random: seeded(5) });
    b.blink();
    const lids = run(b, 0.5);
    const shutAt = lids.findIndex((l) => l >= 0.999) * 0.01;
    const done = lids.findIndex((l, i) => i > 3 && l === 0) * 0.01;
    expect(shutAt).toBeLessThan(0.09);
    expect(done).toBeGreaterThan(0.14);
    expect(done).toBeLessThan(0.19);
    expect(shutAt).toBeLessThan(done - shutAt);
  });

  it('sometimes blinks twice running, never three times from one', () => {
    const b = new Blink({ ...DEFAULT_BLINK_PARAMS, blinkDouble: 1 }, { random: seeded(7) });
    const at = starts(run(b, 60));
    const gaps = at.slice(1).map((t, i) => t - at[i]);
    // Alternately a short gap (the double) and a long one.
    gaps.forEach((g, i) => (i % 2 === 0 ? expect(g).toBeLessThan(0.5) : expect(g).toBeGreaterThan(1.9)));
  });

  it('blinks slower for a girl who blinks slow, and steadier for a steady one', () => {
    const quick = new Blink({ ...DEFAULT_BLINK_PARAMS }, { random: seeded(2) });
    const slow = new Blink({ ...DEFAULT_BLINK_PARAMS }, { slow: 1.3, random: seeded(2) });
    quick.blink();
    slow.blink();
    const open = (b) => run(b, 0.6).findIndex((l, i) => i > 3 && l === 0);
    expect(open(slow)).toBeGreaterThan(open(quick));
    const spread = (steady) => {
      const b = new Blink({ ...DEFAULT_BLINK_PARAMS, blinkDouble: 0 }, { steady, random: seeded(9) });
      const gaps = Array.from({ length: 200 }, () => b.gap());
      return Math.max(...gaps) - Math.min(...gaps);
    };
    expect(spread(1)).toBeLessThan(spread(0));
  });

  it('stays shut asleep, with no blinks, and opens when she wakes', () => {
    const b = new Blink({ ...DEFAULT_BLINK_PARAMS }, { random: seeded(4) });
    const asleep = run(b, 20, { asleep: true });
    expect(asleep.at(-1)).toBe(1);
    expect(Math.min(...asleep.slice(100))).toBe(1);
    run(b, 1, {});
    expect(b.lid).toBeLessThan(1);
  });

  it('squeezes shut past a blink when she laughs or flinches, then lets go', () => {
    const b = new Blink({ ...DEFAULT_BLINK_PARAMS }, { random: seeded(6) });
    run(b, 1, { squeeze: 1 });
    expect(b.lid).toBeCloseTo(DEFAULT_BLINK_PARAMS.squeezeLid, 2);
    run(b, 1, {});
    expect(b.lid).toBeLessThan(1);
  });

  it('holds the eyes shut when told to, and blinks faster at a higher rate', () => {
    const b = new Blink({ ...DEFAULT_BLINK_PARAMS }, { random: seeded(8) });
    b.hold = true;
    expect(run(b, 2).at(-1)).toBe(1);
    const fast = new Blink({ ...DEFAULT_BLINK_PARAMS, blinkDouble: 0 }, { random: seeded(8) });
    const base = new Blink({ ...DEFAULT_BLINK_PARAMS, blinkDouble: 0 }, { random: seeded(8) });
    fast.rate = 4;
    expect(starts(run(fast, 60)).length).toBeGreaterThan(starts(run(base, 60)).length * 2);
  });
});

describe('her eyes in play (Companion.updateEyes)', () => {
  it('shut while she is asleep or dozing, squeezed when she flinches or laughs, otherwise blinking', async () => {
    const { Companion } = await import('../src/npc/companion.js');
    const make = (over = {}) => {
      const lids = [];
      const c = {
        laughLeft: 0,
        reaction: null,
        nap: { asleep: false },
        isDozing: false,
        blink: new Blink({ ...DEFAULT_BLINK_PARAMS, blinkGapMin: 99, blinkGapMax: 99 }, { random: seeded(1) }),
        eyelids: { setLid: (s) => lids.push(s) },
        ...over,
      };
      return { c, lids, step: (dt = 0.5) => Companion.prototype.updateEyes.call(c, dt) };
    };
    const awake = make();
    awake.step();
    expect(awake.lids.at(-1)).toBe(0);
    const napping = make({ nap: { asleep: true } });
    napping.step(1);
    expect(napping.lids.at(-1)).toBe(1);
    const dozing = make({ isDozing: true });
    dozing.step(1);
    expect(dozing.lids.at(-1)).toBe(1);
    const laughing = make({ laughLeft: 2 });
    laughing.step(0.5);
    expect(laughing.lids.at(-1)).toBeGreaterThan(1);
    expect(laughing.c.laughLeft).toBeCloseTo(1.5);
    const flinching = make({ reaction: { type: 'flinch', t: 0.3 } });
    flinching.step(0.5);
    expect(flinching.lids.at(-1)).toBeGreaterThan(0.5);
    const gasping = make({ reaction: { type: 'gasp', t: 0.5 } });
    gasping.step(0.5);
    expect(gasping.lids.at(-1)).toBe(0);
  });
});

describe('the debug blink action', () => {
  it('makes her blink now and says so', async () => {
    const { girlActions } = await import('../src/debug/girlActions.js');
    const toasts = [];
    const amy = { character: { id: 'amy' }, name: 'Amy', blink: new Blink({ ...DEFAULT_BLINK_PARAMS }, { random: seeded(1) }) };
    const g = { companions: [amy], hud: { toast: (t) => toasts.push(t) }, girlUnits: [], units: [] };
    const act = girlActions(g).find('amy', 'blink');
    expect(act.label).toContain('blinks');
    act.run('amy');
    expect(amy.blink.blinking).toBe(true);
    expect(toasts).toEqual(['Amy blinks']);
  });
});
