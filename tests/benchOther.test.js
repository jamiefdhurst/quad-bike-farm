import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Bench } from '../src/workshop/bench.js';
import { DEFAULT_BENCH_PARAMS } from '../src/workshop/benchJobs.js';
import { LAYOUT } from '../src/world/layout.js';

// The bench's choice of vehicle, with a stand-in game (game.js is never built in tests): what it opens on, and the row that swaps to the other one.
const unit = (id, p, extra = {}) => ({
  id,
  label: id,
  name: id,
  engine: { isRunning: false, state: 'off' },
  quad: { position: new THREE.Vector3(p.x, 0, p.z), driver: null, rider: null },
  ...extra,
});
const find = (id, p) => unit(id, p, { barnFind: { ready: false } });

function setup({ parked = [], big = [], rusty = find('rusty', LAYOUT.rusty), plover = find('plover', LAYOUT.plover) } = {}) {
  const game = {
    world: { layout: LAYOUT, heightAt: () => 0 },
    scene: { add: () => {} },
    girlUnits: parked,
    units: [...parked, ...big, rusty, plover].filter(Boolean),
    rustyUnit: rusty,
    ploverUnit: plover,
    player: { position: new THREE.Vector3(LAYOUT.bench.x, 0, LAYOUT.bench.z + 1), moveEnabled: true },
    girlBench: { pendingFor: () => null },
  };
  // Not `new Bench(game)`, which builds its panel in the DOM: the menu's drawing and its jobs are not what is under test, only its last row.
  const bench = Object.assign(Object.create(Bench.prototype), { game, params: { ...DEFAULT_BENCH_PARAMS }, unit: null, job: null, page: 0, row: 0, render: () => {}, kindsFor: () => [], servicePlanFor: () => [] });
  return { bench, game };
}
const at = (bay) => ({ x: bay.x, z: bay.z });

describe('the bench with the barn finds standing', () => {
  it('opens on a vehicle in the big bay, not on the rusty quad or the old bike', () => {
    const tor = unit('tor', at(LAYOUT.bay2));
    const { bench } = setup({ big: [tor] });
    expect(bench.unitAtBench()).toBe(tor);
  });

  it('opens on the nearest find when nothing is parked', () => {
    const { bench } = setup();
    expect(['rusty', 'plover']).toContain(bench.unitAtBench().id);
  });

  it('offers the other one as the last row, and the row swaps to it and back', () => {
    const tor = unit('tor', at(LAYOUT.bay2));
    const { bench } = setup({ big: [tor], plover: null });
    bench.show(tor);
    const rows = bench.rowsFor(tor);
    expect(rows[rows.length - 1]).toEqual({ other: true });
    bench.pressRow(rows[rows.length - 1]);
    expect(bench.unit.id).toBe('rusty');
    const back = bench.rowsFor(bench.unit);
    expect(back[back.length - 1]).toEqual({ other: true });
    bench.pressRow(back[back.length - 1]);
    expect(bench.unit).toBe(tor);
  });

  it('has no such row with only one thing to work on, or when the other is running', () => {
    const tor = unit('tor', at(LAYOUT.bay2));
    const { bench } = setup({ big: [tor], rusty: null, plover: null });
    expect(bench.rowsFor(tor).some((r) => r.other)).toBe(false);
    const running = setup({ big: [tor], plover: null });
    running.game.rustyUnit.engine.isRunning = true;
    expect(running.bench.rowsFor(tor).some((r) => r.other)).toBe(false);
  });
});
