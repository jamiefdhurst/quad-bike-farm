import { describe, it, expect, beforeAll } from 'vitest';
import {
  DEFAULT_CAB_MIST_PARAMS as P, CAB_MIST_PARAM_RANGES, createCabMist, cabMistRates, updateCabMist, cabMistCover, wipeCabMistSector, wipePatch, wipeSwipe, drawLine, smileyStrokes, sideX,
  CabMistTalk, restGlass,
} from '../src/effects/cabMist.js';
import { CabMistView } from '../src/effects/cabMistView.js';
import { wiperGeometry } from '../src/vehicle/wiperModel.js';
import { buildAllModels } from './helpers/vehicleModels.js';

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const glass = () => createCabMist([rect(-0.7, -0.3, 0.7, 0.3)]);
let seed = 1;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const run = (m, seconds, s, dt = 0.1) => { for (let t = 0; t < seconds; t += dt) updateCabMist(m, dt, { slots: [0.2, 0.5, 0.8], people: 1, fog: 0, heater: 0, ...s }, rng); };
const cold = { people: 1, wet: 1, air: 3, warmth: 0, running: true };

describe('what fogs the glass and what clears it', () => {
  it('fogs with people aboard in cold wet air, more with more people and more wet', () => {
    expect(cabMistRates({ ...cold, people: 0 }).fog).toBe(0);
    expect(cabMistRates({ ...cold, air: 20 }).fog).toBe(0);
    expect(cabMistRates({ ...cold, people: 3 }).fog).toBeGreaterThan(cabMistRates(cold).fog * 2.9);
    expect(cabMistRates({ ...cold, wet: 0 }).fog).toBeGreaterThan(0);
    expect(cabMistRates({ ...cold, wet: 0 }).fog).toBeLessThan(cabMistRates(cold).fog);
  });

  it('blows warm only once the engine is warm and running', () => {
    expect(cabMistRates({ ...cold, warmth: 0.2 }).heater).toBe(0);
    expect(cabMistRates({ ...cold, warmth: 0.55 }).heater).toBeGreaterThan(0);
    expect(cabMistRates({ ...cold, warmth: 1 }).heater).toBe(1);
    expect(cabMistRates({ ...cold, warmth: 1, running: false }).heater).toBe(0);
  });

  it('fogs a clear screen over in about the time it says, thickest at the top and the edges', () => {
    const m = glass();
    run(m, P.fogSeconds, cabMistRates(cold, P));
    expect(cabMistCover(m)).toBeGreaterThan(0.9);
    const m2 = glass();
    run(m2, P.fogSeconds * 0.3, cabMistRates(cold, P));
    const at = (i, j) => m2.cells[j * m2.cols + i];
    const mid = at(m2.cols >> 1, m2.rows >> 1);
    expect(at(m2.cols >> 1, m2.rows - 2)).toBeGreaterThan(mid);
    expect(at(1, m2.rows >> 1)).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(0);
  });

  it('never fogs the cells off the glass', () => {
    const m = createCabMist([rect(-0.7, -0.3, -0.03, 0.3), rect(0.03, -0.3, 0.7, 0.3)]);
    run(m, 200, cabMistRates(cold, P));
    const centre = m.cells[(m.rows >> 1) * m.cols + (m.cols >> 1)];
    expect(centre).toBe(0);
    expect(m.onCount).toBeLessThan(m.cols * m.rows);
  });

  it('clears from the demister slots first, in a widening fan, and the rest last', () => {
    const m = glass();
    m.cells.fill(1);
    m.rest = 1;
    run(m, P.clearSeconds * 0.4, { heater: 1 });
    const at = (u, v) => m.cells[Math.floor(v * m.rows) * m.cols + Math.floor(u * m.cols)];
    expect(at(0.5, 0.1)).toBeLessThan(0.7); // above a slot, low
    expect(at(0.35, 0.1)).toBeGreaterThan(0.9); // between slots, low: outside the fan
    expect(at(0.5, 0.9)).toBeGreaterThan(at(0.5, 0.1)); // the top clears after the foot
    expect(m.rest).toBeGreaterThan(0.8); // the side windows and the back barely started
    run(m, P.clearSeconds * 3, { heater: 1 });
    expect(cabMistCover(m)).toBeLessThan(0.05);
    expect(m.rest).toBeGreaterThan(0);
    run(m, P.clearSeconds * 5, { heater: 1 });
    expect(m.rest).toBe(0);
  });

  it('dries out slowly with nobody in a cold cab', () => {
    const m = glass();
    m.cells.fill(1);
    run(m, 60, { people: 0 });
    expect(cabMistCover(m)).toBeLessThan(1);
    expect(cabMistCover(m)).toBeGreaterThan(0.7);
  });

  it('runs drops down a heavily fogged screen, leaving clear streaks', () => {
    const m = glass();
    m.cells.fill(1);
    let made = 0;
    for (let t = 0; t < 30; t += 0.1) {
      updateCabMist(m, 0.1, { fog: 0, heater: 0, slots: [], people: 1 }, rng);
      made = Math.max(made, m.streaks.length);
    }
    expect(made).toBeGreaterThan(0);
    expect(Math.min(...m.cells.filter((_, k) => m.on[k]))).toBeLessThan(0.5);
    const light = glass();
    light.cells.fill(0.2);
    updateCabMist(light, 5, { fog: 0, heater: 0, slots: [], people: 1 }, rng);
    expect(light.streaks.length).toBe(0);
  });
});

describe('wiping and drawing', () => {
  it('wipes a patch clear in the middle with a smeared edge, and it fogs over again', () => {
    const m = glass();
    m.cells.fill(1);
    expect(wipePatch(m, 0, 0, 0.12)).toBeGreaterThan(20);
    const at = (x, y) => m.cells[Math.floor(((y - m.box[1]) / (m.box[3] - m.box[1])) * m.rows) * m.cols + Math.floor(((x - m.box[0]) / (m.box[2] - m.box[0])) * m.cols)];
    expect(at(0, 0)).toBe(0);
    expect(at(0.1, 0)).toBeGreaterThan(0);
    expect(at(0.1, 0)).toBeLessThan(0.8);
    expect(at(0.3, 0)).toBe(1);
    run(m, P.fogSeconds * 1.5, cabMistRates(cold, P));
    expect(at(0, 0)).toBeGreaterThan(0.9);
  });

  it('a sleeve across the glass clears a stroke from one point to another', () => {
    const m = glass();
    m.cells.fill(1);
    wipeSwipe(m, [-0.3, -0.1], [0.3, 0.1], 0.06);
    expect(cabMistCover(m)).toBeLessThan(0.95);
    expect(cabMistCover(m)).toBeGreaterThan(0.7);
  });

  it('a blade clears the sector it sweeps and no more', () => {
    const m = glass();
    m.cells.fill(1);
    const w = { px: 0, py: -0.28, rIn: 0.05, rOut: 0.5, park: 0, sweep: Math.PI * 0.8 };
    expect(wipeCabMistSector(m, w, 0, 0)).toBe(0);
    expect(wipeCabMistSector(m, w, 0, 0.5)).toBeGreaterThan(30);
    const fresh = glass();
    fresh.cells.fill(1);
    wipeCabMistSector(fresh, w, 0, 1);
    expect(cabMistCover(fresh)).toBeLessThan(cabMistCover(m));
  });

  it('a finger draws a thin clear line, and a smiley takes its strokes', () => {
    const m = glass();
    m.cells.fill(1);
    const n = drawLine(m, [[-0.2, 0], [0.2, 0]]);
    expect(n).toBeGreaterThan(10);
    expect(n).toBeLessThan(m.cols * 4);
    const s = glass();
    s.cells.fill(1);
    for (const stroke of smileyStrokes(0.2, 0, 0.2)) drawLine(s, stroke);
    expect(cabMistCover(s)).toBeLessThan(0.99);
    expect(sideX(m, -1)).toBeLessThan(0);
    expect(sideX(m, 1)).toBeGreaterThan(0);
  });
});

describe('the girls and a misted screen', () => {
  const step = (talk, seconds, s) => { const out = []; for (let t = 0; t < seconds; t += 0.5) out.push(...talk.update(0.5, s, rng)); return out; };

  it('one girl says so after it has been bad a while with someone driving, then wipes or draws, once per spell', () => {
    const talk = new CabMistTalk();
    const s = { cover: 0.7, driving: true, girls: ['amy', 'jess'] };
    expect(step(talk, P.sayAfter - 1, s)).toEqual([]);
    const said = step(talk, 2, s);
    expect(said.filter((e) => e.type === 'say').length).toBe(1);
    const then = step(talk, P.actAfter + 1, s);
    expect(then.filter((e) => e.type === 'act').length).toBe(1);
    expect(step(talk, 60, s)).toEqual([]);
    step(talk, 2, { ...s, cover: 0.05 });
    expect(step(talk, P.sayAfter + 1, s).filter((e) => e.type === 'say').length).toBe(1);
  });

  it('says nothing with nobody driving, with the screen only a little fogged, or with no girl aboard', () => {
    expect(step(new CabMistTalk(), 30, { cover: 0.9, driving: false, girls: ['amy'] })).toEqual([]);
    expect(step(new CabMistTalk(), 30, { cover: 0.3, driving: true, girls: ['amy'] })).toEqual([]);
    expect(step(new CabMistTalk(), 30, { cover: 0.9, driving: true, girls: [] })).toEqual([]);
  });

  it('does not wipe if the screen has cleared by then', () => {
    const talk = new CabMistTalk();
    const s = { cover: 0.7, driving: true, girls: ['jess'] };
    step(talk, P.sayAfter + 0.5, s);
    expect(step(talk, P.actAfter + 1, { ...s, cover: P.actMin - 0.05 }).filter((e) => e.type === 'act')).toEqual([]);
  });
});

describe('the other glass', () => {
  it('turns whiter and less see-through with the fog', () => {
    expect(restGlass(0, 0.3)).toEqual({ opacity: 0.3, mix: 0 });
    expect(restGlass(1, 0.3).opacity).toBeGreaterThan(0.6);
    expect(restGlass(0.5, 0.3).opacity).toBeGreaterThan(0.3);
  });

  it('every param has a range holding its default', () => {
    for (const k of Object.keys(P)) {
      const [lo, hi] = CAB_MIST_PARAM_RANGES[k];
      expect(P[k], k).toBeGreaterThanOrEqual(lo);
      expect(P[k], k).toBeLessThanOrEqual(hi);
    }
  });
});

describe('the five cabs', () => {
  let built;
  beforeAll(async () => { built = await buildAllModels(); });

  it('each has its screen mist plane on the rain glass, its side and back glass of their own, and its wipers as the grid sees them', () => {
    const cabs = built.filter(({ model }) => model.userData.cabin);
    expect(cabs.map((b) => b.spec.id).sort()).toEqual(expect.arrayContaining(['corsa', 'fiesta', 'p309']));
    expect(cabs.length).toBeGreaterThanOrEqual(5);
    for (const { spec, model } of cabs) {
      const grid = createCabMist(model.getObjectByName('rainGlass').userData.panes);
      const before = new Set();
      model.traverse((o) => { if (o.isMesh && o.material?.userData?.glass) before.add(o.material); });
      const view = new CabMistView(model, grid);
      expect(view.screen.parent, spec.id).toBe(model.getObjectByName('rainGlass'));
      expect(view.rest.length, `${spec.id}: side and back glass`).toBeGreaterThanOrEqual(2);
      for (const r of view.rest) expect(before.has(r.material), `${spec.id} has its own copy`).toBe(false);
      grid.cells.fill(1);
      grid.rest = 1;
      view.update();
      expect(view.screen.visible, spec.id).toBe(true);
      expect(view.data[3], spec.id).toBeGreaterThanOrEqual(0);
      for (const r of view.rest) expect(r.material.opacity, spec.id).toBeGreaterThan(r.opacity);
      expect(wiperGeometry(model).length, spec.id).toBeGreaterThan(0);
    }
  });
});

describe('the console mists and clears a cab', () => {
  it('calls the game\'s mist and clear, and says when the vehicle has no cab', async () => {
    const { createHost, VEHICLE_VERBS } = await import('../src/console/gameHost.js');
    const calls = [];
    const g = { units: [{ id: 'fiesta' }, { id: 'red' }], companions: [], world: { layout: {} }, debugCabMist: (u, what) => (calls.push([u.id, what]), u.id === 'fiesta') };
    const host = createHost(g);
    expect(VEHICLE_VERBS.map((v) => v.name)).toEqual(expect.arrayContaining(['mist', 'demist']));
    expect(host.vehicleVerb('fiesta', 'mist')).toBe('fiesta: mist');
    expect(host.vehicleVerb('fiesta', 'demist')).toBe('fiesta: demist');
    expect(host.vehicleVerb('red', 'mist')).toBe('red has no cab to mist');
    expect(calls).toEqual([['fiesta', 'mist'], ['fiesta', 'clear'], ['red', 'mist']]);
  });
});
