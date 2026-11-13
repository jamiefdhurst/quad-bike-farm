import { describe, it, expect } from 'vitest';
import { CarbDrip, DEFAULT_DRIP_PARAMS as P } from '../src/vehicle/carbDrip.js';
import { AMY_DRIP_LINES, JESS_DRIP_LINES } from '../src/npc/dripLines.js';
import { VOICE_LINES } from '../src/npc/voiceLines.js';

const always = () => 0;
const never = () => 0.999;
const parked = { parked: true, tapOpen: true, litres: 5 };

const make = (random, ids = ['farm300']) => new CarbDrip(ids, random, { ...P, proneShare: 1 });

describe('dripping carb', () => {
  it('always makes at least one quad prone, even with a share of none', () => {
    const d = new CarbDrip(['a', 'b', 'c'], () => 0.5, { ...P, proneShare: 0 });
    expect(['a', 'b', 'c'].filter((id) => d.prone(id))).toHaveLength(1);
  });

  it('a prone quad parked with the tap on sticks, drips, loses petrol and grows a patch', () => {
    const d = make(always);
    const res = d.update('farm300', 1, parked);
    expect(res.stuck).toBe(true);
    const next = d.update('farm300', 10, parked);
    expect(next.lost).toBeCloseTo(P.dripLitres * 10);
    expect(d.puddle('farm300')).toBeGreaterThan(0);
    expect(d.dripping('farm300')).toBe(true);
  });

  it('a quad that is not prone never sticks', () => {
    const d = new CarbDrip(['a', 'b'], (() => { let i = 0; return () => [0.9, 0.1, 0.0][i++ % 3]; })(), { ...P, proneShare: 0.5 });
    const free = ['a', 'b'].find((id) => !d.prone(id));
    expect(free).toBeDefined();
    expect(d.update(free, 100, parked).stuck).toBe(false);
  });

  it('the tap off stops the drip, and the patch dries', () => {
    const d = make(always);
    d.update('farm300', 1, parked);
    d.update('farm300', 60, parked);
    const grown = d.puddle('farm300');
    const res = d.update('farm300', 10, { ...parked, tapOpen: false });
    expect(res.lost).toBe(0);
    expect(d.puddle('farm300')).toBeLessThan(grown);
  });

  it('does not stick with the tap off, an empty tank or while running', () => {
    const d = make(always);
    expect(d.update('farm300', 10, { ...parked, tapOpen: false }).stuck).toBe(false);
    expect(d.update('farm300', 10, { ...parked, litres: 0 }).stuck).toBe(false);
    expect(d.update('farm300', 10, { ...parked, parked: false }).stuck).toBe(false);
  });

  it('running it shakes the float free', () => {
    const d = make(always);
    d.update('farm300', 1, parked);
    d.update('farm300', 5, { ...parked, parked: false });
    expect(d.update('farm300', 5, { ...parked, tapOpen: true, litres: 5 }).lost).toBeGreaterThan(0); // sticks again straight away with a rigged random
    const calm = make(never);
    expect(calm.update('farm300', 100, parked).lost).toBe(0);
  });

  it('never loses more than is in the tank', () => {
    const d = make(always);
    d.update('farm300', 1, parked);
    expect(d.update('farm300', 1000, { ...parked, litres: 0.001 }).lost).toBeLessThanOrEqual(0.001);
  });

  it('the patch is smelt and floods the next start once it has grown', () => {
    const d = make(always);
    d.update('farm300', 1, parked);
    expect(d.smells('farm300')).toBe(false);
    d.update('farm300', 60, parked);
    expect(d.smells('farm300')).toBe(true);
    expect(d.floodFouling('farm300')).toBeCloseTo(d.puddle('farm300') * P.floodFoul);
  });

  it('both girls have a recorded line for it', () => {
    expect(AMY_DRIP_LINES.dripSmell.lines.length).toBeGreaterThan(0);
    expect(JESS_DRIP_LINES.dripSmell.length).toBeGreaterThan(0);
    expect(VOICE_LINES.dripSmell).toBeDefined();
  });
});
