// The batteries, the booster pack, the bench charger and the generator in the running game: lifting a battery out, carrying it, putting it
// on the charger or back in its vehicle, and the diesel set that powers the charger and the barn bulb (items/battery.js, items/boosterPack.js,
// workshop/charger.js, items/generator.js). game.js builds this, keeps the things it makes (batteries, charger, boosterPack, generator) on
// itself for the other features to read, and calls updateCharger() and updateGenerator() inside the frame guard.

import * as THREE from 'three';
import { registerTuning } from '../core/tuning.js';
import { BatteryItem, hasBattery } from './battery.js';
import { BoosterPack, BOOSTER_ID, DEFAULT_BOOSTER_PARAMS, BOOSTER_PARAM_RANGES, boostStep, packOvernight } from './boosterPack.js';
import { Charger, CHARGER_PARAM_RANGES } from '../workshop/charger.js';
import { buildChargerModel, CHARGER_SLOT } from '../workshop/chargerModel.js';
import { GeneratorAudio } from '../audio/generatorAudio.js';
import { Generator, GENERATOR_PARAM_RANGES } from './generator.js';
import { buildGeneratorModel, GENERATOR_SIZE, GENERATOR_EXHAUST } from './generatorModel.js';
import { ExhaustSmoke, DEFAULT_SMOKE_PARAMS } from '../effects/exhaustSmoke.js';

export class PowerHost {
  constructor(game) {
    this.g = game;
  }

  /** The bench charger and the batteries: every vehicle with a starter has a battery that can come out (items/battery.js). */
  setUpBatteries() {
    const L = this.g.world.layout;
    this.g.batteries = new Map(); // by vehicle id, made when the battery first comes out
    this.g.charger = new Charger();
    this.boosterParams = { ...DEFAULT_BOOSTER_PARAMS };
    registerTuning('Booster pack', this.boosterParams, BOOSTER_PARAM_RANGES);
    this.setUpBoosterPack();
    registerTuning('Battery charger', this.g.charger.params, CHARGER_PARAM_RANGES);
    const built = buildChargerModel();
    this.chargerModel = built;
    const top = this.g.world.heightAt(L.benchCharger.x, L.benchCharger.z) + L.bench.height;
    built.group.position.set(L.benchCharger.x, top, L.benchCharger.z);
    this.g.scene.add(built.group);
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.set(CHARGER_SLOT.x / 2, 0.12, 0.02);
    built.group.add(proxy);
    this.g.interaction.add({
      target: proxy,
      priority: 1, // it sits on the bench, whose box would otherwise be hit first
      isAvailable: () => !!this.heldBattery() || (!!this.chargedBattery() && !this.g.handsFull),
      prompt: () => {
        const held = this.heldBattery();
        if (held) return this.g.charger.busy ? { text: 'The charger already has a battery on   ·   G put it down' } : `Put the ${held.name} on the charger${this.g.generator.powered ? '' : ' (it needs the generator running)'}`;
        return `Pick up the ${this.chargedBattery().name}`;
      },
      feedback: () => (this.heldBattery() ? 'putDown' : 'pickUp'),
      interact: () => {
        const held = this.heldBattery();
        if (held && !this.g.charger.busy) this.putOnCharger(held);
        else if (!held && !this.g.handsFull) this.pickUpBattery(this.chargedBattery());
      },
    });
  }

  /** The next morning: a battery that was on the charger is on it still and has had all night; any other loose one is left on the floor by the bench. */
  restoreBatteries(saved = {}) {
    const L = this.g.world.layout;
    let n = 0;
    for (const unit of this.g.units) {
      if (!unit.engine.batteryOut) continue;
      const b = this.batteryOf(unit);
      if (saved[unit.id]?.where === 'charger' && !this.g.charger.busy) {
        this.putOnCharger(b);
        unit.engine.battery = 1;
        this.g.charger.full = true;
      } else {
        b.putDown(new THREE.Vector3(L.bench.x - 1.4 + n * 0.4, 0, L.bench.z + 0.85), 0.3 * n);
        n++;
      }
    }
  }

  /** The next morning: the pack has lost a little sitting about; if it was on the charger it is on it still, and full. */
  restoreBoosterPack(saved) {
    if (!saved) return;
    const pack = this.g.boosterPack;
    pack.engine.battery = packOvernight(saved.charge ?? 1, this.boosterParams);
    if (saved.where === 'charger' && !this.g.charger.busy) {
      this.putOnCharger(pack);
      pack.engine.battery = 1;
      this.g.charger.full = true;
    }
  }

  /** Where a unit's battery is, in words (the debug panel). */
  batteryWhere(unit) {
    const b = this.g.batteries.get(unit.id);
    return !b?.out ? 'in the vehicle' : b.held ? 'in your hands' : b.where === 'charger' ? 'on the bench charger' : 'loose, out of the vehicle';
  }

  describeBoosterPack() {
    const p = this.g.boosterPack;
    return `${Math.round(p.engine.battery * 100)}%, ${p.held ? 'in your hands' : p.where === 'charger' ? 'on the charger' : 'loose'}`;
  }

  /** The panel's and the console's pack setting: its charge, 0 to 1. */
  debugBoosterCharge(v) {
    this.g.boosterPack.engine.battery = Math.max(0, Math.min(1, v));
  }

  describeCharger() {
    const b = this.chargedBattery();
    return b ? `${b.name} at ${Math.round(b.engine.battery * 100)}%${this.g.charger.full ? ', full' : ''}` : 'empty';
  }

  debugBatteryOut(unit) {
    if (!hasBattery(unit)) return this.g.hud.toast('It has no battery to take out');
    const b = this.batteryOf(unit);
    if (b.out) return;
    const q = unit.quad.position;
    b.putDown({ x: q.x + 1.6, z: q.z }, 0.4);
  }


  debugBatteryIn(unit) {
    if (this.g.batteries.get(unit.id)?.out) this.batteryIn(unit);
  }

  debugChargerClear() {
    const b = this.chargedBattery();
    if (b) this.pickUpBattery(b);
  }

  /** The debug panel's and the console's generator buttons call the real game methods. */
  describeGenerator() {
    return `${this.g.generator.describe()}; the barn bulb is ${this.g.generator.powered ? 'on' : 'off'}${this.g.charger.busy ? ', the charger is drawing on it' : ''}`;
  }

  debugGeneratorPull() {
    const r = this.pullGenerator('debug');
    this.g.hud.toast(r === null ? (this.g.generator.running ? 'It is already running' : 'A pull is in hand') : r === 'caught' ? 'The generator catches' : r === 'dry' ? 'Empty tank' : 'It coughs');
  }

  debugGeneratorFuel(litres) {
    if (this.g.generator.running) this.switchGeneratorOff();
    this.g.generator.fuel = Math.max(0, Math.min(this.g.generator.params.tank, litres));
  }

  /** The battery on the charger, or null. */
  chargedBattery() {
    return this.g.charger.busy ? this.g.batteries.get(this.g.charger.unitId) ?? null : null;
  }

  /** The battery in your hands, or null. */
  heldBattery() {
    for (const b of this.g.batteries?.values() ?? []) if (b.held) return b;
    return null;
  }

  /** The unit's battery item, made on first use. */
  batteryOf(unit) {
    let b = this.g.batteries.get(unit.id);
    if (!b) {
      b = new BatteryItem({ scene: this.g.scene, world: this.g.world, unit });
      this.g.batteries.set(unit.id, b);
      this.g.interaction.add({
        target: b.proxy,
        isAvailable: () => b.out && !b.held && !this.g.handsFull,
        prompt: () => `Pick up the ${b.name}`,
        feedback: 'pickUp',
        interact: () => this.pickUpBattery(b),
      });
    }
    return b;
  }

  pickUpBattery(b) {
    if (this.g.charger.holds(b.unitId)) {
      this.g.charger.take();
      this.chargerModel.set({});
    }
    b.pickUp(this.g.camera);
  }

  /** Lifts a unit's battery out into your hands (the bench job). */
  batteryOut(unit) {
    if (!hasBattery(unit)) return false;
    this.pickUpBattery(this.batteryOf(unit));
    return true;
  }

  /** Fits the battery you hold into its vehicle (the bench job, or E at the vehicle). */
  batteryIn(unit) {
    const b = this.g.batteries.get(unit.id);
    if (!b?.out) return false;
    if (this.g.charger.holds(unit.id)) this.g.charger.take();
    b.fit();
    return true;
  }

  /** The booster pack lies on the workbench with a full charge; it is in the `batteries` map so carrying and the charger treat it as one (items/boosterPack.js). */
  setUpBoosterPack() {
    const L = this.g.world.layout;
    const pack = new BoosterPack({ scene: this.g.scene, world: this.g.world });
    this.g.batteries.set(BOOSTER_ID, pack);
    this.g.boosterPack = pack;
    pack.putDown(new THREE.Vector3(L.benchPack.x, 0, L.benchPack.z), L.benchPack.yaw, this.g.world.heightAt(L.benchPack.x, L.benchPack.z) + L.bench.height);
    this.g.interaction.add({
      target: pack.proxy,
      priority: 1, // it sits on the bench, whose box would otherwise be hit first
      isAvailable: () => !this.g.handsFull && pack.where === 'loose',
      prompt: () => 'Pick up the booster pack',
      feedback: 'pickUp',
      interact: () => this.pickUpBattery(pack),
    });
  }

  /** Holding E at a vehicle with the booster pack in your hands: pushes charge into its battery, up to starting. True while it flows. */
  boostWithPack(unit, dt) {
    const how = boostStep(this.g.boosterPack.engine, unit.engine, dt, this.boosterParams);
    this.g.eHeld = (this.g.eHeld ?? 0) + dt;
    if (how === 'boosting') {
      this.g.hud.setStatus(`Boosting the ${unit.label}: battery ${Math.round(unit.engine.battery * 100)}%, pack ${Math.round(this.g.boosterPack.engine.battery * 100)}%`);
    } else if (this.g.eHeld < 0.6) {
      const why = { out: `The ${unit.label} has no battery in it`, running: `The ${unit.label} is running: switch it off first`, enough: `The ${unit.label} has enough to start on`, flat: 'The booster pack is flat: put it on the charger' };
      this.g.hud.toast(why[how], 2.5);
    }
    return how === 'boosting';
  }

  batteryPrompt(unit) {
    const b = this.heldBattery();
    if (b.unitId === BOOSTER_ID) {
      if (unit.engine.batteryOut) return { text: `The ${unit.label} has no battery in it   ·   G put the pack down` };
      return { action: `Boost the ${unit.label} from the pack (${Math.round(b.engine.battery * 100)}%)`, hold: true, keys: [['G', 'Put the pack down']] };
    }
    if (b.unitId !== unit.id) return { text: `That is the ${b.name}, not the ${unit.label}'s   ·   G put it down` };
    if (unit.engine.isRunning || unit.engine.state === 'cranking') return { text: `Switch the ${unit.label} off first   ·   G put the battery down` };
    return `Fit the battery in the ${unit.label}   ·   G put it down`;
  }

  fitHeldBattery(unit) {
    const b = this.heldBattery();
    if (b.unitId !== unit.id || unit.engine.isRunning || unit.engine.state === 'cranking') return;
    this.batteryIn(unit);
    this.g.hud.toast(unit.engine.battery >= 0.9 ? `The ${unit.label} battery is back in, fully charged` : `The ${unit.label} battery is back in, though it is not fully charged`);
  }

  putBatteryDown() {
    const b = this.heldBattery();
    const p = this.g.player.position;
    const yaw = this.g.player.yaw;
    b.putDown(new THREE.Vector3(p.x - Math.sin(yaw) * 0.7, 0, p.z - Math.cos(yaw) * 0.7), yaw);
  }

  putOnCharger(b) {
    const g = this.chargerModel.group;
    const at = g.localToWorld(new THREE.Vector3(CHARGER_SLOT.x, 0.006, CHARGER_SLOT.z));
    b.setOnCharger(at, g.rotation.y);
    this.g.charger.put(b.unitId, b.engine);
  }

  /** The charger working: the needle and lamps follow the battery on it. */
  updateCharger(dt) {
    const b = this.chargedBattery();
    // It runs off the generator: with that off, the lamps are dark and nothing charges.
    const live = this.g.generator.powered;
    if (this.g.charger.update(live ? dt : 0, b?.engine) === 'full') this.g.hud.toast(`The charger light has gone green: the ${b.name} is full`);
    this.chargerModel.set({ level: live ? b?.engine.battery ?? 0 : 0, charging: !!b && live, full: this.g.charger.full });
  }

  // The generator ----------------------------------------------------------------

  /** The diesel set outside the barn door (items/generator.js): it powers the barn bulb and the bench charger, and is off every morning. */
  setUpGenerator() {
    const L = this.g.world.layout.generator;
    this.g.generator = new Generator();
    registerTuning('Generator', this.g.generator.params, GENERATOR_PARAM_RANGES);
    this.generatorAudio = new GeneratorAudio(this.g.audioHub);
    const built = buildGeneratorModel();
    this.generatorModel = built;
    const y = this.g.world.heightAt(L.x, L.z);
    built.group.position.set(L.x, y, L.z);
    built.group.rotation.y = L.yaw;
    this.g.scene.add(built.group);
    this.g.generatorAt = { x: L.x, y: y + 0.4, z: L.z };
    // A thin grey-blue puff from the stack while it runs: a few a second, thicker for the first seconds after it catches and with the charger on.
    this.g.generatorSmoke = new ExhaustSmoke(this.g.scene, (x, z) => this.g.world.heightAt(x, z), { ...DEFAULT_SMOKE_PARAMS, startSize: 0.07, endSize: 1.1, lifeMin: 1.4, lifeMax: 3, buoyancy: 0.5, opacity: 1.7, tint: '#d8e0ea' });
    built.group.updateMatrixWorld(true);
    this.generatorSmokeTop = built.group.localToWorld(new THREE.Vector3(GENERATOR_EXHAUST.x, GENERATOR_EXHAUST.y, GENERATOR_EXHAUST.z));
    this.generatorSmokeBudget = 0;
    this.generatorNoVel = { x: 0, y: 0, z: 0 };
    this.generatorClock = 0;
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(GENERATOR_SIZE.x, GENERATOR_SIZE.y, GENERATOR_SIZE.z), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.y = GENERATOR_SIZE.y / 2;
    built.group.add(proxy);
    // A set that cannot be walked through.
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), L.yaw);
    this.g.physics.createCollider(
      this.g.RAPIER.ColliderDesc.cuboid(GENERATOR_SIZE.x / 2, GENERATOR_SIZE.y / 2, GENERATOR_SIZE.z / 2).setTranslation(L.x, y + GENERATOR_SIZE.y / 2, L.z).setRotation(q),
    );
    this.g.interaction.add({
      target: proxy,
      isAvailable: () => !this.g.handsFull || !!this.g.can.held,
      prompt: () => this.generatorPrompt(),
      feedback: 'own',
      interact: () => {
        if (this.g.can.held) return;
        if (this.g.generator.running) this.switchGeneratorOff();
        else this.pullGenerator();
      },
      hold: (dt) => this.pourIntoGenerator(dt),
    });
  }

  generatorPrompt() {
    const g = this.g.generator;
    const fuel = `${g.fuel.toFixed(1)} / ${g.params.tank} L`;
    if (this.g.can.held) {
      if (g.running) return { text: `The generator is running: switch it off before you refuel it (${fuel})` };
      if (this.g.can.diesel < 0.5 || this.g.can.litres < 0.01) return { text: `The generator takes red diesel: this can has ${this.g.can.litres < 0.01 ? 'nothing in it' : 'petrol in it'}` };
      if (g.space < 0.01) return { text: `The generator's tank is full (${fuel})` };
      return { text: `Hold E to fill the generator with diesel (${fuel})` };
    }
    if (g.running) return `Switch the generator off (${fuel})`;
    return g.fuel <= 0 ? 'Pull the cord (the tank looks empty)' : `Pull the cord to start the generator (${fuel})`;
  }

  /** Holding E with a can: red diesel into the generator's tank, while it is off. */
  pourIntoGenerator(dt) {
    const g = this.g.generator;
    if (!this.g.can.held || g.running || this.g.can.diesel < 0.5 || g.space < 0.01) return false;
    const poured = g.add(this.g.can.take(Math.min(g.params.pourRate * dt, g.space)), this.g.can.diesel);
    return poured > 0;
  }

  /** A pull of the cord, by you or a girl. Returns what came of it ('caught', 'coughed', 'dry' or null if one was in hand). */
  pullGenerator(by = 'you') {
    const g = this.g.generator;
    const result = g.pull();
    const at = this.g.generatorAt;
    if (result === 'caught') {
      this.generatorAudio.catch(at);
      this.g.notice('engineStart', at, { key: 'generator', strength: 1 });
      this.g.hud.toast('The generator catches');
    } else if (result === 'coughed' || result === 'dry') {
      this.generatorAudio.crank(at, result === 'dry');
      if (by === 'you') this.g.hud.toast(result === 'dry' ? 'Nothing happens: the tank is empty' : 'It coughs and dies. Pull again');
    }
    return result;
  }

  switchGeneratorOff() {
    if (!this.g.generator.stop()) return;
    this.generatorAudio.stop(this.g.generatorAt);
    this.g.hud.toast('The generator is off');
  }

  /** The set running: fuel burning (more with the charger on), its sound and shake, and the dial on its panel. */
  updateGenerator(dt) {
    const g = this.g.generator;
    this.generatorClock += dt;
    if (g.update(dt, this.g.charger.busy ? 1 : 0) === 'stalled') {
      this.generatorAudio.stop(this.g.generatorAt, true);
      this.g.notice('stall', this.g.generatorAt, { key: 'generator', strength: 1 });
      this.g.hud.toast('The generator has run out of diesel');
      const near = this.g.companions.filter((c) => c.availability().canRemark && c.root.position.distanceTo(this.g.camera.position) < 30);
      near[0]?.voice.say('generatorOut', { chance: 0.9 });
    }
    if (g.running) {
      this.generatorAudio.ensureLoop(this.g.generatorAt);
      this.generatorAudio.update(this.g.generatorAt, this.g.world.indoor(this.g.camera.position.x, this.g.camera.position.z));
    }
    // The smoke: puffs from the stack leaning downwind, the first few seconds after it catches the thickest.
    const sm = this.g.generatorSmoke;
    sm.params.windX = this.g.wind.x;
    sm.params.windZ = this.g.wind.z;
    const choke = g.running ? Math.max(0, 1 - g.ranFor / 4) : 0;
    this.generatorSmokeBudget = Math.min(this.generatorSmokeBudget + (g.running ? 3 + 5 * choke + 3 * (this.g.charger.busy ? 1 : 0) : 0) * dt, 3);
    sm.tipPos.copy(this.generatorSmokeTop);
    sm.tipDir.set(0, 1, 0.1);
    while (this.generatorSmokeBudget >= 1) {
      this.generatorSmokeBudget -= 1;
      sm.spawn(0.2 + 0.25 * choke + (g.fuel < g.params.sputterAt ? 0.2 : 0), 0.55 - 0.3 * choke, 0.7 + Math.random() * 0.5, this.generatorNoVel, 0);
    }
    sm.simulate(dt);
    this.generatorModel.set({ level: g.level, running: g.running, pull: g.pulling > 0 ? Math.sin((1 - g.pulling / g.params.pullSeconds) * Math.PI) : 0, time: this.generatorClock });
  }
}
