import { describe, it, expect, vi } from 'vitest';
import { MowHost } from '../src/world/mowHost.js';
import { MowGrid, DEFAULT_MOW_PARAMS as P } from '../src/world/mowing.js';
import { JobBoard, FARM_JOBS } from '../src/world/farmJobs.js';

// The mower as the player meets it: T on the seat, the refusal with the engine off, the lever's click, what the blade does to the engine and
// the stripes, the seat switch, the grit, and the board ticked off. A stand-in game, since game.js is never built in tests.
const lawn = { id: 'yard', rect: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 } };

function setup({ running = true, onBoard = true, surface = { grass: 1 } } = {}) {
  const toasts = [];
  const cues = [];
  const said = [];
  const quad = { get bladeOn() { return !!this.blade?.engaged; }, yaw: 0, position: { x: 0, z: -15 }, forwardSpeed: 0, isTipped: false, pto: { load: 0 }, bladeDrive: 1, engine: { isRunning: running } };
  quad.engine.isRunning = running;
  const unit = { spec: { mower: true }, quad };
  const board = new JobBoard({ ids: ['mow'], random: () => 0, params: { jobsPerDay: onBoard ? 1 : 0 }, jobs: FARM_JOBS });
  const grid = new MowGrid([lawn], { ...P });
  const game = {
    units: [unit],
    jobBoard: board,
    farm: { day: 4 },
    hud: { toast: (t) => toasts.push(t) },
    audioHub: { useCue: (c) => cues.push(c) },
    handsFull: false,
    farmJobs: { say: (key) => said.push(key) },
  };
  const view = { update: vi.fn(), refresh: vi.fn() };
  const host = new MowHost(game, { grid, params: { ...P }, surfaceAt: () => surface, view });
  const press = (code) => ({ wasPressed: (k) => k === code });
  const idle = { wasPressed: () => false };
  const step = (n = 1, ridden = unit, input = idle) => {
    for (let i = 0; i < n; i++) host.update(0.1, ridden, input);
  };
  return { host, game, unit, quad, grid, toasts, cues, said, press, idle, step, board };
}

describe('the blade lever', () => {
  it('goes forward on T with a click, and back again', () => {
    const { host, unit, quad, cues, press, step } = setup();
    step(1, unit, press('KeyT'));
    expect(quad.bladeOn).toBe(true);
    expect(cues).toEqual(['latch']);
    step(1, unit, press('KeyT'));
    expect(quad.bladeOn).toBe(false);
    expect(host.bladeOf(unit).engaged).toBe(false);
  });

  it('refuses with the engine off and says why, with no click', () => {
    const { unit, quad, toasts, cues, press, step } = setup({ running: false });
    step(1, unit, press('KeyT'));
    expect(quad.bladeOn).toBe(false);
    expect(toasts).toEqual(['The blade only turns with the engine running']);
    expect(cues).toEqual([]);
  });

  it('is not worked from the ground, with your hands full, or on a tipped mower', () => {
    const { game, unit, quad, press, step } = setup();
    step(1, null, press('KeyT'));
    expect(quad.bladeOn).toBe(false);
    game.handsFull = true;
    step(1, unit, press('KeyT'));
    expect(quad.bladeOn).toBe(false);
    game.handsFull = false;
    quad.isTipped = true;
    step(1, unit, press('KeyT'));
    expect(quad.bladeOn).toBe(false);
  });

  it('drops when you leave the seat (the seat switch) and when the engine stops', () => {
    const { host, unit, quad, press, step } = setup();
    step(1, unit, press('KeyT'));
    expect(quad.bladeOn).toBe(true);
    step(1, null);
    expect(quad.bladeOn).toBe(false);
    step(1, unit, press('KeyT'));
    quad.engine.isRunning = false;
    step(1);
    expect(host.bladeOf(unit).engaged).toBe(false);
  });
});

describe('mowing', () => {
  it('loads the engine and slows the drive while the blade turns, and asks nothing with it off', () => {
    const { unit, quad, press, step } = setup();
    step(1);
    expect(quad.pto.load).toBe(0);
    expect(quad.bladeDrive).toBe(1);
    step(1, unit, press('KeyT'));
    quad.forwardSpeed = 2;
    for (let i = 0; i < 20; i++) {
      quad.position.z += 0.2; // out in fresh grass the whole way
      step(1);
    }
    expect(quad.pto.load).toBeGreaterThan(0.4);
    expect(quad.bladeDrive).toBeLessThan(0.85);
  });

  it('cuts stripes only with the blade engaged and the mower moving forward', () => {
    const { unit, quad, grid, press, step } = setup();
    quad.forwardSpeed = 2;
    step(20);
    expect(grid.share(4)).toBe(0); // lever back: nothing
    step(1, unit, press('KeyT'));
    quad.forwardSpeed = -2;
    step(20);
    expect(grid.share(4)).toBe(0); // in reverse: nothing
    quad.forwardSpeed = 2;
    for (let i = 0; i < 20; i++) {
      quad.position.z += 0.2;
      step(1);
    }
    expect(grid.share(4)).toBeGreaterThan(0);
  });

  it('ticks the job off the board once enough is cut, and the girls say so, once', () => {
    const { host, unit, grid, board, toasts, said, press, step } = setup();
    step(1, unit, press('KeyT'));
    grid.cutAll(4);
    grid.lawns[0].dir.fill(0); // the stripes' directions are not what is being tried
    host.unit.quad.forwardSpeed = 2;
    step(30);
    expect(board.finished.has('mow')).toBe(true);
    expect(toasts.filter((t) => /Lawns mown/.test(t))).toHaveLength(1);
    expect(said.filter((k) => k === 'mowDone')).toHaveLength(1);
  });

  it('does not tick a job that is not on the board', () => {
    const { unit, grid, toasts, press, step } = setup({ onBoard: false });
    step(1, unit, press('KeyT'));
    grid.cutAll(4);
    grid.lawns[0].dir.fill(0);
    unit.quad.forwardSpeed = 2;
    step(30);
    expect(toasts.filter((t) => /Lawns mown/.test(t))).toHaveLength(0);
  });

  it('throws grit on gravel with a clink, dulls the blade, and one girl remarks, not again for a while', () => {
    const { host, unit, quad, grid, cues, said, press, step } = setup({ surface: { grass: 0 } });
    step(1, unit, press('KeyT'));
    quad.forwardSpeed = 2;
    step(60);
    expect(cues.filter((c) => c === 'tap').length).toBeGreaterThan(5);
    expect(said.filter((k) => k === 'mowGrit')).toHaveLength(1);
    expect(host.bladeOf(unit).dull).toBeGreaterThan(0.1);
    expect(grid.share(4)).toBe(0); // and cuts nothing
  });

  it('debug: cuts, grows back and finishes the job', () => {
    const { host, grid, board, view = host.view } = setup();
    host.cutAll();
    expect(grid.done(4)).toBe(true);
    expect(view.refresh).toHaveBeenCalled();
    host.growBack();
    expect(grid.share(4)).toBe(0);
    host.finishNow();
    expect(board.finished.has('mow')).toBe(true);
  });
});
