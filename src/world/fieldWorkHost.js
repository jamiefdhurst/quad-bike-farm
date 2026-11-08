// The three field jobs and what goes with them, as the running game meets them: spraying the south stubble, harrowing the field inside the
// Home Loop and making hay in the north field (world/spraying.js, world/harrowing.js, world/haymaking.js). Setting each up, the sprayer's
// and harrows' drag and levers, the bales and the girls who carry them, the status lines and the debug panel's and console's buttons.
// game.js builds this as `this.fieldWork`; the jobs themselves (`spray`, `harrow`, `hay`, `hayLoading`, `grassTracks` and their views) stay
// on the game for the rest of the code to read.

import * as THREE from 'three';
import { createRandom } from '../core/random.js';
import { registerTuning } from '../core/tuning.js';
import { carryWeight } from '../npc/carrying.js';
import { towEffect, towLoad } from '../vehicle/towing.js';
import { FARM_JOBS } from './farmJobs.js';
import { Spraying, DEFAULT_SPRAY_PARAMS, SPRAY_PARAM_RANGES, SPRAY_PHASE_TEXT } from './spraying.js';
import { SprayView } from './sprayView.js';
import { Harrowing, DEFAULT_HARROW_PARAMS, HARROW_PARAM_RANGES, HARROW_PHASE_TEXT, dealMolehills } from './harrowing.js';
import { HarrowView } from './harrowView.js';
import { Haymaking, DEFAULT_HAY_PARAMS, HAY_PARAM_RANGES, trailerSlots } from './haymaking.js';
import { HayView } from './hayView.js';
import { GrassTracks, DEFAULT_TRACKS_PARAMS, TRACKS_PARAM_RANGES } from './grassTracks.js';
import { HayLoading, HAY_LOADING_PARAM_RANGES } from '../npc/hayLoading.js';

export class FieldWorkHost {
  constructor(game) {
    this.g = game;
    this.sprayPuller = null; // the Quad whose drive and brakes the sprayer is taking from
    this.harrowPuller = null; // the Quad whose drive and brakes the harrows are taking from
  }

  // Spraying the field --------------------------------------------------------------

  /** The field in the south wheat stubble, the sprayer's rules and how it looks (world/spraying.js, world/sprayView.js). */
  setUpSpraying() {
    const g = this.g;
    const rect = g.world.layout.sprayField;
    if (!rect) return;
    this.sprayParams = { ...DEFAULT_SPRAY_PARAMS };
    g.spray = new Spraying({ rect, params: this.sprayParams });
    g.spray.restore(g.farm.save?.spray, g.farm.day);
    g.sprayView = new SprayView({ scene: g.scene, spraying: g.spray, heightAt: (x, z) => g.world.heightAt(x, z) });
    this.sprayNoticeIn = 0; // seconds to the next time the girls notice the mist
    this.sprayStarted = false; // the girls have been told the job has begun
    this.sprayEmptied = false;
    registerTuning('Spraying', this.sprayParams, SPRAY_PARAM_RANGES);
    g.farmMap.spray = g.spray; // the map draws your lines
    g.farmMap.sprayWanted = () => g.jobBoard.has('spray') && !g.spray.done;
    // The hose fills the tank: hold E at the sprayer with the hose in your hand.
    g.interaction.add({
      target: g.sprayer.proxy,
      priority: -1,
      isAvailable: () => g.hose.held && !g.player.isRiding,
      prompt: () => ({ text: g.spray.tank >= 0.999 ? 'The sprayer is full   ·   G put the hose back' : `Hold E to fill the sprayer (${Math.round(g.spray.tank * 100)}%)   ·   G put the hose back` }),
      feedback: 'hold',
      interact: () => {},
      hold: (dt) => this.fillSprayer(dt),
    });
  }

  fillSprayer(dt) {
    const g = this.g;
    const sp = g.spray;
    if (!g.hose.held || g.player.position.distanceTo(g.sprayer.model.position) > sp.p.fillReach + 1) return false;
    if (sp.tank >= 0.999) return false;
    if (sp.fill(dt) === 'full') g.hud.toast('The sprayer is full', 2);
    this.sprayEmptied = false;
    return true;
  }

  /** What the status line says to someone pulling the sprayer. */
  sprayStatus() {
    const g = this.g;
    const sp = g.spray;
    const level = `${Math.round(sp.tank * 100)}% in the tank`;
    if (!sp.out) return `Sprayer hitched, ${level}\nT to fold the boom ${sp.boomWant ? 'in' : 'out'}, J to unhitch`;
    return `${SPRAY_PHASE_TEXT[sp.phase]}\nBoom out, ${level}, ${Math.round(sp.coverage * 100)}% of the field sprayed\nT to fold it in`;
  }

  /** One of the girls near the sprayer says something about the spraying (npc/sprayLines.js). */
  saySomethingAboutSpray(key) {
    const g = this.g;
    const at = g.sprayer.model.position;
    const c = g.companions
      .filter((g) => g.availability().canRemark && g.root.position.distanceTo(at) < 40)
      .sort((a, b) => a.root.position.distanceTo(at) - b.root.position.distanceTo(at))[0];
    c?.voice.say(key);
  }

  updateSprayer(dt, ridden, input) {
    const g = this.g;
    const t = g.sprayer;
    const sp = g.spray;
    t.update(dt, { boom: sp.boom, tank: sp.tank });
    g.noteFolded(t, ridden);
    // What it takes from the quad in front of it: a full tank drags.
    if (this.sprayPuller && this.sprayPuller !== t.puller) Object.assign(this.sprayPuller.tow, { driveFactor: 1, brakeFactor: 1 });
    this.sprayPuller = t.puller;
    if (t.puller) Object.assign(t.puller.tow, towEffect(towLoad(0, sp.tank * t.p.towWeight, g.towParams), !!t.puller.tractor || !!t.puller.landRover, g.towParams));
    // T folds the boom out or in, from the seat of whatever pulls it or standing by it.
    const riding = !!ridden && t.hitched && ridden.quad === t.puller;
    const near = riding || (!g.player.isRiding && g.player.position.distanceTo(t.model.position) < 3);
    if (near && input.wasPressed('KeyT') && !g.handsFull && !(ridden && !riding) && !(riding && ridden.quad.isTipped)) {
      g.hud.toast(sp.toggleBoom() ? 'Boom folding out' : 'Boom folding in', 2);
    }
    const events = sp.update(dt, { x: t.motion.x, z: t.motion.z, yaw: t.motion.yaw, speed: Math.abs(t.signedSpeed), hitched: t.hitched, day: g.farm.day });
    for (const e of events) {
      if (e.type === 'sprayed') {
        g.sprayView.repaint(e.cells);
        if (!this.sprayStarted) {
          this.sprayStarted = true;
          this.saySomethingAboutSpray('sprayStart');
        }
      } else if (e.type === 'empty') {
        g.hud.toast('The tank is empty: fill it from the hose', 4);
        if (!this.sprayEmptied) this.saySomethingAboutSpray('sprayEmpty');
        this.sprayEmptied = true;
      } else if (e.type === 'done') this.sprayDone();
    }
    // The mist drifts: a girl close by turns her face away (a notice, so reactions.js decides).
    this.sprayNoticeIn -= dt;
    if (sp.spraying && this.sprayNoticeIn <= 0) {
      this.sprayNoticeIn = 8;
      g.notice('spray', t.model.position, { key: 'sprayer', strength: 0.6 });
    }
    g.sprayView.setLight(1 - (g.daylight?.darkness ?? 0)); // the mist has its own colour, so it dims with the day
    g.sprayView.update(dt, { model: t.model, on: sp.spraying });
  }

  /** Enough of the field is sprayed: tick the job off the board (if it is on today) and the girls remark. */
  sprayDone() {
    const g = this.g;
    if (!g.farmJobs.tickOff('spray', 'Field sprayed. Ticked off the board on the barn door; fold the boom in', 4)) g.hud.toast('Field sprayed', 3);
    this.saySomethingAboutSpray('sprayDone');
  }

  /** The debug panel: set the sprayer to a point in the job. `what`: out, in, empty, fill, half, done, clear. */
  debugSpray(what) {
    const g = this.g;
    const sp = g.spray;
    if (!sp) return;
    if (!g.jobBoard.has('spray') && (what === 'done' || what === 'half')) g.jobBoard.add('spray', FARM_JOBS.spray);
    if (what === 'out') sp.setBoom(true);
    else if (what === 'in') sp.setBoom(false);
    else if (what === 'empty') sp.tank = 0;
    else if (what === 'fill') sp.tank = 1;
    else if (what === 'clear') {
      sp.clear();
      this.sprayStarted = this.sprayEmptied = false;
    } else if (what === 'half') {
      for (let i = 0; i < sp.cells / 2; i++) {
        sp.dose[i] = 1;
        sp.state[i] = 1;
      }
      sp.started = true;
      sp.since ??= g.farm.day;
    } else if (what === 'done') {
      sp.sprayAll(g.farm.day);
      this.sprayDone();
    }
    g.sprayView.refresh();
  }

  // Harrowing the field ---------------------------------------------------------------

  /** The field inside the Home Loop, the chain harrows' rules and how it looks (world/harrowing.js, world/harrowView.js). */
  setUpHarrowing() {
    const g = this.g;
    const rect = g.world.layout.harrowField;
    if (!rect) return;
    this.harrowParams = { ...DEFAULT_HARROW_PARAMS };
    g.harrow = new Harrowing({ rect, params: this.harrowParams });
    g.harrow.restore(g.farm.save?.harrow, g.farm.day);
    // The molehills are part of the farm's character: dealt from its own seed, so the same farm has the same ones.
    const hills = dealMolehills(rect, this.harrowParams.moleHills, createRandom((g.farmSeed ^ 0x401e) >>> 0));
    g.harrowView = new HarrowView({ scene: g.scene, harrowing: g.harrow, heightAt: (x, z) => g.world.heightAt(x, z), molehills: hills });
    this.harrowStarted = false; // the girls have been told the job has begun
    registerTuning('Harrowing', this.harrowParams, HARROW_PARAM_RANGES);
    g.farmMap.harrow = g.harrow; // the map draws your lines
    g.farmMap.harrowWanted = () => g.jobBoard.has('harrow') && !g.harrow.done;
  }

  /** What the status line says to someone pulling the harrows. */
  harrowStatus() {
    const g = this.g;
    const h = g.harrow;
    if (!h.isDown) return `Harrows hitched, tines ${h.downWant ? 'lowering' : 'up'}\nT to lower the tines, J to unhitch`;
    return `${HARROW_PHASE_TEXT[h.phase]}\nTines down, ${Math.round(h.coverage * 100)}% of the field harrowed\nT to lift them`;
  }

  /** One of the girls near the harrows says something about the harrowing (npc/harrowLines.js). */
  saySomethingAboutHarrowing(key) {
    const g = this.g;
    const at = g.harrows.model.position;
    const c = g.companions
      .filter((g) => g.availability().canRemark && g.root.position.distanceTo(at) < 40)
      .sort((a, b) => a.root.position.distanceTo(at) - b.root.position.distanceTo(at))[0];
    c?.voice.say(key);
  }

  updateHarrows(dt, ridden, input) {
    const g = this.g;
    const t = g.harrows;
    const h = g.harrow;
    t.update(dt, { down: h.down });
    g.noteFolded(t, ridden);
    // What it takes from the vehicle in front of it: a mat on the ground drags.
    if (this.harrowPuller && this.harrowPuller !== t.puller) Object.assign(this.harrowPuller.tow, { driveFactor: 1, brakeFactor: 1 });
    this.harrowPuller = t.puller;
    if (t.puller) Object.assign(t.puller.tow, towEffect(towLoad(0, h.down * h.p.towWeight, g.towParams), !!t.puller.tractor || !!t.puller.landRover, g.towParams));
    // T lowers the tines or lifts them, from the seat of whatever pulls it or standing by it.
    const riding = !!ridden && t.hitched && ridden.quad === t.puller;
    const near = riding || (!g.player.isRiding && g.player.position.distanceTo(t.model.position) < 3);
    if (near && input.wasPressed('KeyT') && !g.handsFull && !(ridden && !riding) && !(riding && ridden.quad.isTipped)) {
      g.hud.toast(h.toggleTines() ? 'Tines lowering' : 'Tines lifting', 2);
    }
    const events = h.update(dt, { x: t.motion.x, z: t.motion.z, yaw: t.motion.yaw, speed: Math.abs(t.signedSpeed), hitched: t.hitched, day: g.farm.day });
    for (const e of events) {
      if (e.type === 'combed') {
        g.harrowView.repaint(e.cells);
        if (!this.harrowStarted) {
          this.harrowStarted = true;
          this.saySomethingAboutHarrowing('harrowStart');
        }
      } else if (e.type === 'done') this.harrowDone();
    }
  }

  /** Enough of the field is harrowed: tick the job off the board (if it is on today) and the girls remark. */
  harrowDone() {
    const g = this.g;
    if (!g.farmJobs.tickOff('harrow', 'Field harrowed. Ticked off the board on the barn door; lift the tines', 4)) g.hud.toast('Field harrowed', 3);
    this.saySomethingAboutHarrowing('harrowDone');
  }

  /** The debug panel: set the harrows to a point in the job. `what`: down, up, half, done, clear. */
  debugHarrow(what) {
    const g = this.g;
    const h = g.harrow;
    if (!h) return;
    if (!g.jobBoard.has('harrow') && (what === 'done' || what === 'half')) g.jobBoard.add('harrow', FARM_JOBS.harrow);
    if (what === 'down') h.setDown(true);
    else if (what === 'up') h.setDown(false);
    else if (what === 'clear') {
      h.clear();
      this.harrowStarted = false;
    } else if (what === 'half') {
      for (let i = 0; i < h.cells / 2; i++) {
        if (h.state[i] === 0) h.combed++;
        h.state[i] = 1;
      }
      h.since ??= g.farm.day;
    } else if (what === 'done') {
      h.combAll(g.farm.day);
      this.harrowDone();
    }
    g.harrowView.refresh();
  }

  // Making hay -----------------------------------------------------------------------

  /** The hay patch in the north field, its bales and the girls who carry them (world/haymaking.js, npc/hayLoading.js). */
  setUpHay() {
    const g = this.g;
    const rect = g.world.layout.hayMeadow;
    if (!rect) return;
    this.hayParams = { ...DEFAULT_HAY_PARAMS };
    g.hay = new Haymaking({ rect, params: this.hayParams });
    g.hay.restore(g.farm.save?.hay, g.farm.day);
    this.trackParams = { ...DEFAULT_TRACKS_PARAMS };
    g.grassTracks = new GrassTracks({ rect, params: this.trackParams });
    g.world.grassTracks = g.grassTracks;
    g.hayView = new HayView({ scene: g.scene, hay: g.hay, heightAt: (x, z) => g.world.heightAt(x, z), tracks: g.grassTracks, patch: g.world.terrain.hayPatch, drawDistance: g.world.drawDistance, random: createRandom(g.farmSeed ^ 0x4a17) });
    this.hayCapacity = 16;
    this.haySlots = trailerSlots(this.hayCapacity);
    g.hayLoading = new HayLoading();
    this.hayStack();
    if (g.jobBoard.has('hay')) g.hay.start();
    g.hayView.refresh();
    this.hayPhase = g.hay.phase;
    registerTuning('Haymaking', this.hayParams, HAY_PARAM_RANGES);
    registerTuning('Grass tracks', this.trackParams, TRACKS_PARAM_RANGES);
    registerTuning('Loading the hay', g.hayLoading.p, HAY_LOADING_PARAM_RANGES);
    g.interaction.add({
      target: g.hayView.loose,
      isAvailable: () => g.hay.phase === 'load' && !g.handsFull && !g.player.isRiding,
      prompt: () => this.hayBalePrompt(),
      feedback: 'pickUp',
      interact: () => this.heaveBale(),
    });
  }


  /** The bales in the Dutch barn's bay, as many as the farm has stacked there. */
  hayStack() {
    const g = this.g;
    const open = g.siloRect;
    if (!open) return;
    g.hayView.setStack(open, g.hay.stacked, g.world.heightAt((open.minX + open.maxX) / 2, (open.minZ + open.maxZ) / 2));
  }

  /** The tractor mowing and baling as it drives over the patch, the stages moving on, and the trailer unloading at the barn. */
  updateHay(dt) {
    const g = this.g;
    const hay = g.hay;
    g.hayLoading.update(dt);
    g.hayView.update(dt, Math.hypot(g.wind.x, g.wind.z));
    const q = g.tractorUnit?.quad;
    const events = q ? hay.update(dt, { x: q.position.x, z: q.position.z, heading: q.yaw, speed: q.speed, working: q.engine.isRunning, day: g.farm.day }) : [];
    for (const e of events) {
      if (e.type === 'cut' || e.type === 'baled') g.hayView.repaint(e.cells);
      else if (e.type === 'bale') g.hayView.addLoose(e.bale);
    }
    if (hay.phase === 'stack' && g.siloRect) {
      const m = g.trailer.model.position;
      const done = hay.deliver(g.siloRect, { x: m.x, z: m.z, speed: Math.abs(g.trailer.signedSpeed) });
      if (done) {
        g.hayView.remove(done.ids);
        this.hayStack();
      }
    }
    if (hay.phase !== this.hayPhase) this.hayStageChanged(hay.phase);
  }

  /** Says the next thing to do when a stage is over, and ticks the job off at the end. */
  hayStageChanged(phase) {
    const g = this.g;
    this.hayPhase = phase;
    if (phase === 'bale') {
      g.hud.toast('The patch is mown. Drive over the cut hay and the baler leaves bales behind you', 4);
      this.saySomethingAboutHay('hayCut');
    } else if (phase === 'load') {
      g.hud.toast('Bales made. Bring the trailer to them: the girls will carry them up, or press E to heave one on', 5);
      this.saySomethingAboutHay('hayBaled');
    } else if (phase === 'stack') {
      g.hud.toast('The trailer is loaded. Take it into the Dutch barn and stop', 4);
      this.saySomethingAboutHay('hayLoaded');
    } else if (phase === 'done') {
      g.achievements.note('hayMade');
      g.farmJobs.tickOff('hay', 'Hay stacked. Ticked off the board on the barn door');
      this.saySomethingAboutHay('hayDone');
    }
  }

  /** One of the girls near the trailer says something about the hay (npc/hayLines.js). */
  saySomethingAboutHay(key) {
    const g = this.g;
    const at = g.trailer.model.position;
    const c = g.companions
      .filter((g) => g.availability().canRemark && g.root.position.distanceTo(at) < 40)
      .sort((a, b) => a.root.position.distanceTo(at) - b.root.position.distanceTo(at))[0];
    c?.voice.say(key);
  }

  /** What the girls need to know to go and carry a bale (npc/hayLoading.js). */
  hayLoadContext() {
    const g = this.g;
    const hay = g.hay;
    const t = g.trailer;
    const m = t.model.position;
    const near = hay.nearest(m.x, m.z, hay.p.trailerReach);
    return {
      ready: hay.canLoad(hay.freeSlot(this.hayCapacity) >= 0 ? 1 : 0) && !!near,
      at: near,
      girls: g.companions.map((c) => ({
        id: c.character.id,
        x: c.root.position.x,
        z: c.root.position.z,
        free: c.availability().free,
        weight: c.params.hayLoadWeight ?? 0,
      })),
    };
  }

  /** She takes the bale nearest her, carries it to the trailer's side and throws it up, a miss now and then (Jess's a lot more often than Amy's). */
  handleHayLoad(e) {
    const g = this.g;
    if (!e) return;
    const c = g.companions.find((o) => o.character.id === e.girl);
    const hay = g.hay;
    const loading = g.hayLoading;
    const done = () => {
      c.release('hay');
      loading.finished(e.girl, c.params.hayCooldown);
    };
    const at = c.root.position;
    const bale = hay.nearest(at.x, at.z);
    const slotIndex = hay.freeSlot(this.hayCapacity);
    if (!bale || slotIndex < 0 || !hay.canLoad(1)) return loading.finished(e.girl, 0);
    hay.claim(bale.id, e.girl, slotIndex);
    c.hold('hay', 'carrying a bale to the trailer');
    const away = () => {
      hay.release(bale.id);
      done();
    };
    const d = Math.hypot(at.x - bale.x, at.z - bale.z) || 1;
    const spot = { x: bale.x + ((at.x - bale.x) / d) * 0.9, z: bale.z + ((at.z - bale.z) / d) * 0.9 };
    const reached = () => {
      const mesh = g.hayView.meshOf(bale.id);
      const started = mesh && c.startCarry('squareBale', mesh, carryWeight('squareBale'), {
        onLowered: (pos) => {
          hay.release(bale.id, pos); // she was called away: it is left where she stood
          g.hayView.putDown(hay.get(bale.id));
          done();
        },
        onRaised: () => this.hayCarryUp(c, bale, slotIndex, done),
      });
      if (!started) away();
    };
    if (!c.sneakTo(spot, reached, 2)) away();
  }

  /** She has the bale in her hands: to the trailer's side, opposite its slot, and up it goes. */
  hayCarryUp(c, bale, slotIndex, done) {
    const g = this.g;
    const slot = this.haySlots[slotIndex];
    const side = slot.x >= 0 ? 1 : -1;
    const stand = g.trailer.body.localToWorld(new THREE.Vector3(side * 1.85, 0, slot.z));
    const arrive = () => {
      const slotAt = g.trailer.body.localToWorld(new THREE.Vector3(slot.x, slot.y, slot.z));
      if (Math.hypot(c.root.position.x - slotAt.x, c.root.position.z - slotAt.z) > 4) return c.dropCarry(); // the trailer has been driven off
      this.hayThrow(c, bale, slotIndex, done);
    };
    if (!c.carryTo({ x: stand.x, z: stand.z }, arrive)) c.dropCarry();
  }

  /** The bale leaves her hands: up onto the trailer, or short of it. */
  hayThrow(c, bale, slotIndex, done) {
    const g = this.g;
    const hay = g.hay;
    const hand = c.root.localToWorld(new THREE.Vector3(-0.5, 1.05, 0.3));
    c.endCarry();
    if (Math.random() < c.params.hayMissChance) {
      const short = c.root.localToWorld(new THREE.Vector3(0, 0, 0.9));
      hay.release(bale.id, { x: short.x, z: short.z });
      g.hayView.putDown(hay.get(bale.id));
      c.voice.say('hayMiss', { urgent: true, force: true });
      return done();
    }
    g.hayView.throwOnto(bale, g.trailer.body, this.haySlots[slotIndex], this.hayParams.throwSeconds, hand, () => {
      hay.load(bale.id, slotIndex);
      c.voice.say('hayThrown', { urgent: true, chance: 0.5 });
    });
    done();
  }

  hayBalePrompt() {
    const g = this.g;
    const m = g.trailer.model.position;
    const p = g.player.position;
    if (Math.hypot(p.x - m.x, p.z - m.z) > this.hayParams.playerReach) return { text: 'Hay bale   ·   bring the trailer closer to heave it on' };
    if (g.hay.freeSlot(this.hayCapacity) < 0) return { text: 'The trailer is full' };
    return 'Heave the bale onto the trailer';
  }

  /** E at a bale beside the trailer: you throw it up yourself. */
  heaveBale() {
    const g = this.g;
    const hay = g.hay;
    const p = g.player.position;
    const m = g.trailer.model.position;
    if (Math.hypot(p.x - m.x, p.z - m.z) > this.hayParams.playerReach) return;
    const slotIndex = hay.freeSlot(this.hayCapacity);
    const bale = hay.nearest(p.x, p.z, 4);
    if (slotIndex < 0 || !bale) return;
    hay.claim(bale.id, 'you', slotIndex);
    const from = new THREE.Vector3(p.x, p.y - 0.4, p.z);
    g.hayView.throwOnto(bale, g.trailer.body, this.haySlots[slotIndex], this.hayParams.throwSeconds, from, () => hay.load(bale.id, slotIndex));
  }

  /** The debug panel: the cut hay grows back at once (as it does after regrowDays), the stack stays. */
  debugHayRegrow() {
    const g = this.g;
    const hay = g.hay;
    hay.state.fill(0);
    hay.cutDay = null;
    hay.cut = 0;
    hay.baledCells = 0;
    g.hayView.refresh();
  }

  /** The debug panel: every line pressed in the long grass lifts at once. */
  debugHayTracksClear() {
    const g = this.g;
    g.grassTracks?.clear();
  }

  /** The debug panel: the barn's hay stack is taken away. */
  debugHayEmptyStack() {
    const g = this.g;
    g.hay.stacked = 0;
    this.hayStack();
  }

  /** The debug panel: jump the job to a stage (cut, bale, load, stack, done) with what it needs in place. */
  debugHayStage(stage) {
    const g = this.g;
    const hay = g.hay;
    if (!hay) return;
    if (!g.jobBoard.has('hay')) g.jobBoard.add('hay', FARM_JOBS.hay);
    if (!hay.active) hay.start();
    const order = ['cut', 'bale', 'load', 'stack', 'done'];
    const at = order.indexOf(stage);
    hay.state.fill(0);
    hay.bales.length = 0;
    g.hayView.reset();
    hay.cut = hay.made = hay.loaded = hay.delivered = 0;
    if (at >= 1) {
      hay.cut = hay.p.cutNeeded;
      for (let i = 0; i < hay.p.cutNeeded; i++) hay.state[i] = 1;
      g.hayView.refresh();
    }
    if (at >= 2) {
      for (let i = hay.made; i < hay.p.balesNeeded; i++) g.hayView.addLoose(hay.drop({ x: hay.rect.minX + 6 + i * 3, z: (hay.rect.minZ + hay.rect.maxZ) / 2, heading: 0 }));
    }
    if (at >= 3) {
      for (const b of hay.bales) {
        hay.load(b.id, hay.freeSlot(this.hayCapacity));
        g.hayView.seat(b, g.trailer.body, this.haySlots[b.slot]);
      }
    }
    if (at >= 4) {
      const done = hay.deliver({ minX: -1e9, maxX: 1e9, minZ: -1e9, maxZ: 1e9 }, { x: 0, z: 0, speed: 0 });
      if (done) g.hayView.remove(done.ids);
      this.hayStack();
    }
    this.hayStageChanged(hay.phase);
  }
}
