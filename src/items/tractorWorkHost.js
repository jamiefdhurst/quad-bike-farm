// The tractor's work: the bale spike that carries the standing silage bales, and the log splitter that takes its place on the lift arms
// (items/baleSpike.js, items/logSplitter.js). Setting both up, their prompts and levers, what a split makes and where the logs are stacked.
// game.js builds this as `this.tractorWork`; what the rest of the code reads (`baleRig`, `spikeParams`, `siloRect`, `splitter`, `splitterParams`,
// `splitterFitted`, `logStack`, `stackView`, `woodPieces`, `heldWood`) stays on the game.

import * as THREE from 'three';
import { createRandom } from '../core/random.js';
import { registerTuning } from '../core/tuning.js';
import { towEffect, towLoad } from '../vehicle/towing.js';
import { TRACTOR_GROUND_OFFSET, SPLITTER, poseLogSplitter } from '../vehicle/tractorModel.js';
import { DEFAULT_SPLITTER_PARAMS, SPLITTER_PARAM_RANGES, LogSplitter, LogStack, splitterPowered } from './logSplitter.js';
import { WoodPiece, StackView } from './woodPieces.js';
import { DEFAULT_SPIKE_PARAMS, SPIKE_PARAM_RANGES, keepOutside } from './baleSpike.js';
import { BaleSpikeRig } from './baleSpikeRig.js';
import { underRoof } from '../world/barn.js';
import { dutchBarnShape } from '../world/outbuildings.js';

export class TractorWorkHost {
  constructor(game) {
    this.g = game;
    this.spikeHinted = false; // the bale spike's hint has been shown
    this.spikeWeighed = false; // the held bale was weighing on the tow last frame
    this.splitterPush = false; // E held at the beam this frame
    this.splitterPiece = null; // the round on the beam
    this.splitterHinted = false;
    this.logSplitHinted = false;
  }

  // The bale spike -----------------------------------------------------------------

  /** The tractor's bale spike (items/baleSpike.js): the standing silage bales can be lifted and carried; where they were left is kept. */
  setUpBaleSpike() {
    const g = this.g;
    g.spikeParams = { ...DEFAULT_SPIKE_PARAMS };
    g.baleRig = new BaleSpikeRig({
      physics: g.physics,
      RAPIER: g.RAPIER,
      silage: g.world.props.silage,
      groundAt: (x, z) => g.world.heightAt(x, z),
      tractor: g.tractorUnit?.quad ?? null,
      params: g.spikeParams,
    });
    g.baleRig.restore(keepOutside(g.farm.save?.bales, (x, z) => underRoof(g.world.layout, x, z))); // not one left where the barn now stands
    g.siloRect = dutchBarnShape(g.world.layout)?.open ?? null;
    registerTuning('Bale spike', g.spikeParams, SPIKE_PARAM_RANGES);
  }

  /**
   * The bale spike on the tractor (items/baleSpike.js): ] raises the arms and [ lowers them while you drive it (with the engine running);
   * a standing silage bale the point runs into is speared, and one lowered to the ground or on a stack is left when you drive on.
   */
  updateBaleSpike(dt, ridden, input) {
    const g = this.g;
    const u = g.tractorUnit;
    const driving = ridden === u && g.player.seat === 'rider' && !g.menu.isOpen;
    const q = u.quad;
    const trailerOn = g.trailer.hitched || (g.tipTrailer.hitched && g.tipTrailer.puller === q);
    const rig = g.baleRig;
    const before = rig.lift.lift;
    const events = rig.update(dt, {
      raise: driving && input.isDown('BracketRight'),
      lower: driving && input.isDown('BracketLeft'),
      powered: q.engine.isRunning,
      shown: !trailerOn && !g.splitterFitted, // the log splitter takes the spike's place on the lift arms
    });
    if (driving && !trailerOn && !g.splitterFitted && rig.lift.lift !== before && !this.spikeHinted) {
      this.spikeHinted = true;
      g.hud.toast('Bale spike: reverse the point into a standing silage bale, ] up and [ down', 3.5);
    }
    for (const e of events) {
      if (e.type === 'speared') {
        g.hud.toast('Bale on the spike: ] raise it to carry, lower it and drive on to leave it', 3);
        g.farmJobs.saySomethingAboutBale('baleSpiked');
      } else if (e.type === 'left') {
        g.farmJobs.baleSettled();
      }
    }
    const weight = rig.held ? g.spikeParams.towWeight : 0;
    if (weight || this.spikeWeighed) Object.assign(q.tow, towEffect(towLoad(0, weight, g.towParams), true, g.towParams));
    this.spikeWeighed = !!weight;
  }

  // The log splitter ---------------------------------------------------------------

  /**
   * The log splitter that takes the bale spike's place on the tractor (items/logSplitter.js): rounds lying in piles at the wood's gate, the
   * splitter's beam, the logs it makes and the stack they go in. The stack and whether the splitter is fitted are kept; the rounds are dealt fresh each load.
   */
  setUpLogSplitter() {
    const g = this.g;
    g.logStack = null;
    const yard = g.world.layout.logYard;
    if (!yard || !g.tractorUnit) return;
    const p = (g.splitterParams = { ...DEFAULT_SPLITTER_PARAMS });
    registerTuning('Log splitter', p, SPLITTER_PARAM_RANGES);
    g.splitter = new LogSplitter(p);
    g.logStack = new LogStack(p);
    g.logStack.restore(g.farm.save?.logs, g.farm.day);
    g.splitterFitted = !!g.farm.save?.logs?.fitted;
    this.splitterPush = false;
    const random = createRandom(g.seed ^ 0x10c5);
    const world = g.world;
    g.rounds = [];
    yard.piles.forEach(([x, z, yaw], pile) => {
      for (let i = 0; i < p.roundsPerPile; i++) {
        const r = new WoodPiece({ scene: g.scene, world, kind: 'round', gnarled: random() < p.gnarlChance, random, x: x + (i % 3) * 0.38 - 0.38, z: z + Math.floor(i / 3) * 0.38, yaw: random() * 6 });
        r.putDown(r.home, r.home.yaw);
        g.rounds.push(r);
      }
    });
    g.logPieces = Array.from({ length: Math.max(1, g.rounds.length) * 4 }, () => new WoodPiece({ scene: g.scene, world, kind: 'log' }));
    g.woodPieces = [...g.rounds, ...g.logPieces];
    g.stackView = new StackView({ scene: g.scene, heightAt: (x, z) => world.heightAt(x, z), site: yard.stack, capacity: SPLITTER_PARAM_RANGES.capacity[1] });
    g.stackView.set(g.logStack.count);
    const q = g.tractorUnit.quad;
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    // The beam: look at it to load, push and (empty) swap back. The mast: look at it to fit the splitter. Both ride on the tractor.
    this.splitterProxy = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 1.7), hidden);
    this.splitterProxy.position.set(0, 1.1, -2.45);
    q.model.add(this.splitterProxy);
    this.fitProxy = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.5), hidden);
    this.fitProxy.position.set(0, 1.25, -1.85);
    q.model.add(this.fitProxy);
    poseLogSplitter(q.model, 0, g.splitterFitted);
    const onFoot = () => !g.player.isRiding;
    for (const w of g.woodPieces) {
      g.interaction.add({
        target: w.proxy,
        isAvailable: () => w.onGround && !g.handsFull && onFoot(),
        prompt: () => (w.kind === 'round' ? 'Pick up the round' : 'Pick up the log'),
        feedback: 'pickUp',
        interact: () => w.pickUp(g.camera),
      });
    }
    g.interaction.add({
      target: g.stackView.proxy,
      isAvailable: () => g.heldWood?.kind === 'log' && !g.logStack.full,
      prompt: () => `Stack the log (${g.logStack.count + 1} of ${p.capacity})`,
      feedback: 'putDown',
      interact: () => this.stackLog(),
    });
    g.interaction.add({
      target: this.splitterProxy,
      priority: 1, // it stands over the mast's box
      isAvailable: () => this.splitterShown() && onFoot() && (!g.handsFull || g.heldWood?.kind === 'round'),
      prompt: () => this.splitterPrompt(),
      feedback: () => (g.heldWood ? 'putDown' : 'latch'),
      interact: () => this.splitterInteract(),
      hold: () => this.splitterHold(),
    });
    g.interaction.add({
      target: this.fitProxy,
      isAvailable: () => !g.splitterFitted && !g.handsFull && onFoot() && !g.baleRig.held && !this.splitterTrailerOn(),
      prompt: () => 'Take the bale spike off and fit the log splitter',
      feedback: 'latch',
      interact: () => this.fitSplitter(true),
    });
  }

  splitterTrailerOn() {
    const g = this.g;
    const q = g.tractorUnit.quad;
    return g.trailer.hitched || (g.tipTrailer.hitched && g.tipTrailer.puller === q);
  }

  /** The splitter is on the tractor and in view (a trailer on the drawbar hides it). */
  splitterShown() {
    const g = this.g;
    return !!g.tractorUnit && g.splitterFitted && !this.splitterTrailerOn();
  }

  /** Whether the tractor is running and held, so the hydraulics will work. */
  splitterPowered() {
    const g = this.g;
    const q = g.tractorUnit.quad;
    return splitterPowered({ running: q.engine.isRunning, parkBrake: q.parkBrake, gear: q.drivetrain.gear, speed: q.forwardSpeed });
  }

  splitterPrompt() {
    const g = this.g;
    const sp = g.splitter;
    if (g.heldWood) return sp.canLoad() ? 'Put the round on the splitter' : { text: 'The splitter already has a round on it' };
    if (sp.loaded) return this.splitterPowered() ? 'Hold E to push the ram through the round' : { text: 'Start the tractor and put its brake on, then hold E to split' };
    return sp.canLoad() ? 'Take the log splitter off and fit the bale spike' : { text: 'Let the ram come back' };
  }

  splitterInteract() {
    const g = this.g;
    const sp = g.splitter;
    const held = g.heldWood;
    if (held) {
      if (!sp.canLoad()) return;
      sp.putOn(held.gnarled);
      held.putOnBeam(g.tractorUnit.quad.model.getObjectByName('logSplitter'));
      this.splitterPiece = held;
      if (!this.splitterHinted) {
        this.splitterHinted = true;
        g.hud.toast(this.splitterPowered() ? 'Hold E to push the ram through' : 'Start the tractor and put its brake on, then hold E to split', 3.5);
      }
    } else if (!sp.loaded && sp.canLoad()) this.fitSplitter(false);
  }

  /** Holding E at the beam with a round on it: the ram goes out (updateLogSplitter moves it). */
  splitterHold() {
    const g = this.g;
    if (g.heldWood || !g.splitter.loaded || !this.splitterPowered()) return false;
    this.splitterPush = true;
    return false; // true would make the pouring sound (the muck fork's does)
  }

  /** Swaps the bale spike for the splitter (or back) on the lift arms. */
  fitSplitter(on) {
    const g = this.g;
    g.splitterFitted = on;
    poseLogSplitter(g.tractorUnit.quad.model, g.splitter.ram, on && !this.splitterTrailerOn());
    g.hud.toast(on ? 'Log splitter fitted in place of the bale spike. Rounds are piled by the wood\'s gate' : 'Bale spike back on', 3);
  }

  /** Every frame: the ram, the engine's governor and load, and what comes of a split. */
  updateLogSplitter(dt) {
    const g = this.g;
    const q = g.tractorUnit.quad;
    const shown = this.splitterShown();
    const powered = shown && this.splitterPowered() && !g.player.isRiding;
    const push = this.splitterPush && powered;
    this.splitterPush = false;
    for (const e of g.splitter.update(dt, { push, powered })) {
      if (e.type === 'split') this.roundSplit(e);
    }
    const working = powered && (push || g.splitter.moving || g.splitter.load > 0);
    q.pto.throttle = working ? g.splitterParams.pumpThrottle : 0;
    q.pto.load = working ? g.splitter.load : 0;
    poseLogSplitter(q.model, g.splitter.ram, shown);
  }

  /** The round gave way: it is gone from the beam and its logs lie either side of the tractor's back. */
  roundSplit(e) {
    const g = this.g;
    const q = g.tractorUnit.quad;
    const round = this.splitterPiece;
    round?.hide();
    this.splitterPiece = null;
    const at = q.localToWorld(0, SPLITTER.roundY + TRACTOR_GROUND_OFFSET, SPLITTER.roundZ);
    g.splitAudio.crack(at, e.gnarled);
    const n = g.splitterParams.logsPerRound;
    for (let i = 0; i < n; i++) {
      const log = g.logPieces.find((l) => l.state === 'hidden');
      if (!log) break;
      const side = i % 2 ? 1 : -1;
      const w = q.localToWorld(side * (0.55 + Math.floor(i / 2) * 0.3), 0, SPLITTER.roundZ + (Math.random() - 0.5) * 0.3);
      log.putDown({ x: w.x, z: w.z }, Math.atan2(w.x - at.x, w.z - at.z) + Math.PI / 2 + (Math.random() - 0.5) * 0.4);
    }
    if (!this.logSplitHinted) {
      this.logSplitHinted = true;
      g.hud.toast('Split. Carry the logs to the stack by the hedge', 3.5);
    }
  }

  stackLog() {
    const g = this.g;
    const log = g.heldWood;
    if (!log || log.kind !== 'log' || g.logStack.add() < 0) return;
    log.hide();
    g.stackView.set(g.logStack.count);
    g.hud.toast(`${g.logStack.count} of ${g.splitterParams.capacity} on the stack`, 1.6);
    if (g.jobBoard.has('logs') && !g.jobBoard.finished.has('logs') && g.logStack.jobComplete) g.farmJobs.finishLogs();
  }

  putWoodDown() {
    const g = this.g;
    const w = g.heldWood;
    if (!w) return;
    const p = g.player.position;
    const yaw = g.player.yaw;
    w.putDown({ x: p.x - Math.sin(yaw) * 0.8, z: p.z - Math.cos(yaw) * 0.8 }, yaw + Math.PI / 2);
  }

  /** Empties the stack and deals the rounds back into their piles (the debug panel). */
  debugResetLogs() {
    const g = this.g;
    if (!g.logStack) return;
    g.splitter.reset();
    this.splitterPiece = null;
    g.logStack.count = 0;
    g.stackView.set(0);
    for (const w of g.woodPieces) w.reset();
  }
}
