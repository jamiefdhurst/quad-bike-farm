// The MOT at Hollis Motors in the running game (farm/mot.js has the rules): park a Tor or Crag square in the painted bay, get out and press E on the
// clipboard by the east door. The garage takes the money from the tin and goes over it for a while; when the time is up it reads the vehicle's own
// faults and wear, hands over the sheet, and the result goes in the farm's MOT log and Amy's logbook. VillageHost builds it and calls update();
// the debug panel and the console use the debug* methods.

import * as THREE from 'three';
import { registerTuning } from '../core/tuning.js';
import { thePhrase } from '../vehicle/names.js';
import { MOT_PARAMS, MOT_PARAM_RANGES, MotLog, canMot, inBay, inspect, readCondition, sheetLines, whyNotTest, ITEM_NAMES } from '../farm/mot.js';
import { MotSheet } from './motView.js';
import { pounds } from './villageShop.js';

export class MotHost {
  constructor(game, props) {
    this.g = game;
    this.props = props;
    this.params = MOT_PARAMS;
    registerTuning('MOT', this.params, MOT_PARAM_RANGES);
    this.log = new MotLog(this.params);
    this.sheet = new MotSheet();
    this.run = null; // { unit, left, paid }
    this.bay = props.motBay;
    game.interaction.add({
      target: props.motProxy.mesh,
      isAvailable: () => !game.player.isRiding,
      prompt: () => this.prompt(),
      feedback: 'paper', // the clipboard comes off its nail; the sheet and the girls' remark show the rest
      interact: () => this.start(),
    });
  }

  /** The Tor or Crag sat in the bay now: parked and square in it. */
  inTheBay() {
    for (const u of this.g.units) {
      if (!canMot(u.spec)) continue;
      const q = u.quad;
      if (Math.abs(q.speed) < 0.6 && inBay({ x: q.position.x, z: q.position.z, yaw: q.yaw }, this.bay, this.params)) return u;
    }
    return null;
  }

  why(unit = this.inTheBay(), purse = this.g.market.purse) {
    return whyNotTest({ spec: unit?.spec, onBay: !!unit, purse, busy: !!this.run, running: !!unit?.engine.isRunning }, this.params);
  }

  prompt() {
    if (this.run) return { info: `The garage is going over ${thePhrase(this.run.unit.spec.id)} (${Math.ceil(this.run.left)} s)` };
    const why = this.why();
    if (why) return { info: why };
    return { action: `Have ${thePhrase(this.inTheBay().spec.id)} MOT tested for ${pounds(this.params.price)}` };
  }

  /** Pays and starts the test on the Tor or Crag in the bay. True if it began. */
  start({ free = false } = {}) {
    const unit = this.inTheBay();
    if (this.why(unit, free ? Infinity : this.g.market.purse)) return false;
    if (!free && !this.g.market.spend(this.params.price)) return false;
    this.run = { unit, left: this.params.testSeconds, paid: free ? 0 : this.params.price };
    this.sheet.hide();
    if (!free) this.g.villageHost.chink();
    return true;
  }

  /** The vehicle left the bay or the engine was started: the garage gives the money back. */
  abort(refund = true) {
    if (!this.run) return;
    if (refund && this.run.paid) this.g.market.purse += this.run.paid;
    this.run = null;
  }

  /** Reads the vehicle, writes the sheet and tells the farm. Returns the sheet. */
  finish(unit) {
    const g = this.g;
    const day = g.farm?.day ?? 1;
    const sheet = inspect(readCondition(unit), this.params);
    this.log.record(unit.spec.id, day, sheet);
    this.sheet.show(sheetLines(thePhrase(unit.spec.id), sheet, day, this.params), sheet.passed);
    g.notebook?.note(unit, { kind: 'mot', passed: sheet.passed, fails: sheet.fails.map((f) => ITEM_NAMES[f].toLowerCase()) }, { saw: true });
    this.remark(sheet.passed ? 'motPass' : 'motFail');
    g.saveFarm?.();
    return sheet;
  }

  /** The nearer girl has her say, if she is stood about. */
  remark(key) {
    const g = this.g;
    const at = this.props.motProxy.mesh.getWorldPosition(new THREE.Vector3());
    let best = null;
    let bd = 25;
    for (const c of g.companions) {
      const d = Math.hypot(c.root.position.x - at.x, c.root.position.z - at.z);
      if (d < bd && c.availability().canRemark) {
        best = c;
        bd = d;
      }
    }
    best?.voice.say(key, { chance: 1 });
  }

  /** Where you stand to read the clipboard: before it on the forecourt. */
  stand() {
    const at = this.props.motProxy.mesh.getWorldPosition(new THREE.Vector3());
    return { x: at.x, z: at.z - 1.4 };
  }

  /** Whether the latest test of this model failed (the girls mind it). */
  failed(specId) {
    return this.log.failed(specId);
  }

  update(dt) {
    this.sheet.update(dt);
    if (!this.run) return;
    const u = this.run.unit;
    if (u.engine.isRunning || this.inTheBay() !== u) return this.abort();
    this.run.left -= dt;
    if (this.run.left > 0) return;
    this.run = null;
    this.finish(u);
  }

  toJSON() {
    return this.log.toJSON();
  }

  restore(saved) {
    this.log.restore(saved);
  }

  /** The debug panel and the console: the sheet for the vehicle now, without paying or waiting. Returns the sheet, or null if none is in the bay. */
  debugTest(unit = this.inTheBay()) {
    if (!unit || !canMot(unit.spec)) return null;
    this.run = null;
    return this.finish(unit);
  }

  /** Forgets every test and certificate (the debug panel and the console). */
  debugForget() {
    this.log = new MotLog(this.params);
    this.sheet.hide();
    this.abort();
  }

  describe() {
    return [...new Set(this.g.units.filter((u) => canMot(u.spec)).map((u) => u.spec.id))]
      .map((id) => `${thePhrase(id)}: ${this.log.describe(id, this.g.farm?.day ?? 1)}`)
      .join('; ') || 'no Tor or Crag on this farm';
  }
}
