import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { TractorWorkHost } from '../src/items/tractorWorkHost.js';
import { LogSplitter, DEFAULT_SPLITTER_PARAMS } from '../src/items/logSplitter.js';
import { SPLITTER } from '../src/vehicle/tractorModel.js';

// A stand-in game: a tractor with a brake and a gear, a splitter with a round on its beam, a stack to add logs to and a hud to toast on.
function standIn({ fitted = true, loaded = false, canLoad = true, running = true, parkBrake = true, stackFull = false } = {}) {
  const toasts = [];
  const log = [];
  const game = {
    tractorUnit: { quad: { engine: { isRunning: running }, parkBrake, drivetrain: { gear: 0 }, forwardSpeed: 0 } },
    trailer: { hitched: false },
    tipTrailer: { hitched: false },
    hud: { toast: (text) => toasts.push(text) },
    splitterFitted: fitted,
    splitterParams: { capacity: 120 },
    splitter: { loaded, canLoad: () => canLoad },
    heldWood: null,
    logStack: { count: 3, full: stackFull, add: () => (log.push('add'), 4) },
    stackView: { set: (n) => log.push(`view ${n}`) },
    jobBoard: { has: () => false },
  };
  return { game, toasts, log, host: new TractorWorkHost(game) };
}

describe('TractorWorkHost', () => {
  it('tells you what the splitter wants of the tractor before it will split', () => {
    const idle = standIn({ loaded: true, running: false });
    expect(idle.host.splitterPrompt()).toEqual({ text: 'Start the tractor and put its brake on, then hold E to split' });
    const ready = standIn({ loaded: true });
    expect(ready.host.splitterPrompt()).toBe('Hold E to push the ram through the round');
    expect(standIn({ canLoad: false }).host.splitterPrompt()).toEqual({ text: 'Let the ram come back' });
    expect(standIn().host.splitterPrompt()).toBe('Take the log splitter off and fit the bale spike');
  });

  it('hides the splitter while a trailer is on the drawbar, and only pushes when the tractor is held and running', () => {
    const { game, host } = standIn();
    expect(host.splitterShown()).toBe(true);
    game.trailer.hitched = true;
    expect(host.splitterShown()).toBe(false);
    expect(standIn({ parkBrake: false }).host.splitterPowered()).toBe(true); // in neutral and stopped
    const moving = standIn({ parkBrake: false });
    moving.game.tractorUnit.quad.drivetrain.gear = 2;
    expect(moving.host.splitterPowered()).toBe(false);
  });

  it('only takes a push when a round is on the beam and the tractor is powered', () => {
    const empty = standIn();
    expect(empty.host.splitterHold()).toBe(false);
    expect(empty.host.splitterPush).toBe(false);
    const ready = standIn({ loaded: true });
    expect(ready.host.splitterHold()).toBe(false);
    expect(ready.host.splitterPush).toBe(true);
  });

  it('stacks a carried log and refuses anything else', () => {
    const none = standIn();
    none.host.stackLog();
    expect(none.log).toEqual([]);
    const { game, host, log, toasts } = standIn();
    game.heldWood = { kind: 'log', hide: () => log.push('hide') };
    host.stackLog();
    expect(log).toEqual(['add', 'hide', 'view 3']);
    expect(toasts).toEqual(['3 of 120 on the stack']);
    const round = standIn();
    round.game.heldWood = { kind: 'round', hide: () => round.log.push('hide') };
    round.host.stackLog();
    expect(round.log).toEqual([]);
  });

  it('plays the ram\'s sound from the splitter each frame, silent while the tractor is not held and running', () => {
    const heard = [];
    const make = (running) => {
      const { game, host } = standIn({ running });
      game.tractorUnit.quad.pto = {};
      game.tractorUnit.quad.model = new THREE.Group();
      game.tractorUnit.quad.localToWorld = (x, y, z) => ({ x, y, z });
      game.player = { isRiding: false };
      game.splitterParams.pumpThrottle = 0.4;
      game.splitter = new LogSplitter({ ...DEFAULT_SPLITTER_PARAMS });
      game.splitter.putOn(false);
      game.splitAudio = { ram: (dt, state, at) => heard.push({ ...state, at: at() }) };
      return { game, host };
    };
    const on = make(true);
    on.host.splitterPush = true;
    on.host.updateLogSplitter(0.1);
    expect(heard.at(-1)).toMatchObject({ powered: true, dir: 1, pressing: false, gnarled: false, at: { x: 0, z: SPLITTER.roundZ } });
    const off = make(false);
    off.host.splitterPush = true;
    off.host.updateLogSplitter(0.1);
    expect(heard.at(-1)).toMatchObject({ powered: false, dir: 0 });
  });

  it('loads a round from the piles onto the beam for the splitter scene, and says where to stand beside it', () => {
    const { game, host } = standIn();
    game.splitter = new LogSplitter({ ...DEFAULT_SPLITTER_PARAMS });
    const beam = new THREE.Group();
    const model = new THREE.Group();
    model.add(Object.assign(beam, { name: 'logSplitter' }));
    game.tractorUnit.quad.model = model;
    const put = [];
    game.rounds = [{ onGround: false }, { onGround: true, gnarled: true, putOnBeam: (m) => put.push(m) }];
    expect(host.debugLoadRound()).toBe(true);
    expect(game.splitter.loaded).toBe(true);
    expect(game.splitter.round.gnarled).toBe(true);
    expect(put).toEqual([beam]);
    expect(host.splitterPiece).toBe(game.rounds[1]);
    expect(host.debugLoadRound()).toBe(true); // already on: nothing more is taken
    expect(put).toHaveLength(1);
    const none = standIn();
    none.game.splitter = new LogSplitter({ ...DEFAULT_SPLITTER_PARAMS });
    none.game.rounds = [];
    expect(none.host.debugLoadRound()).toBe(false);

    game.tractorUnit.quad.localToWorld = (x, y, z) => ({ x: 10 + x, y, z: 20 + z }); // facing +z, unturned
    const side = host.beamSide(2);
    expect(side).toMatchObject({ x: 12, z: 20 + SPLITTER.roundZ });
    expect(side.heading).toBeCloseTo(270); // looking back across at the beam
  });
});
