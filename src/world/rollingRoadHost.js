// The rolling road in the running game (farm/rollingRoad.js has the rules): the tuner turns up on her day as a visit of her own (traffic.js, a
// `stay` step), her Land Rover towing the trailer (rollingRoadModel.js), and sets up in front of the barn. You ride a quad onto the rollers, get off, look
// at the screen on its post and press E: it takes the money from the tin, straps the quad down, holds its engine at a sweeping throttle against the rollers
// (`quad.pto`, as the tractor's log splitter does) and writes down what the real engine model makes. The slip is handed over, the girls have their say, and
// the results go up on the barn wall. TrafficHost builds it and calls update(); the debug panel and the console use the debug* methods.

import * as THREE from 'three';
import { createRandom } from '../core/random.js';
import { registerTuning } from '../core/tuning.js';
import { Visit, VISITOR_KINDS } from './traffic.js';
import { rigSite, RIG, toWorld, onDeck } from './rollingRoadSite.js';
import { buildRollingRoadModel, poseRamp, spinRollers, setRunning } from './rollingRoadModel.js';
import { RoadSheet, RoadSlip, sheetAnchor } from './rollingRoadView.js';
import { barnShape } from './barn.js';
import { sayName, thePhrase } from '../vehicle/names.js';
import { DEFAULT_ROAD_PARAMS, ROAD_PARAM_RANGES, RollingRun, RoadLog, canRun, daysToRoadDay, isRoadDay, onRollers, roadOpen, whyNotRun } from '../farm/rollingRoad.js';

const RAMP_SECONDS = 2.5; // the ramp takes this long to come down or go up
const FIRST_DELAY = 20; // seconds into a game before she turns up on a road day that is already under way

export class RollingRoadHost {
  constructor(game, traffic) {
    this.g = game;
    this.t = traffic;
    this.params = { ...DEFAULT_ROAD_PARAMS };
    registerTuning('Rolling road', this.params, ROAD_PARAM_RANGES);
    this.log = new RoadLog(this.params);
    this.random = createRandom(game.seed ^ 0x2d0a);
    this.visit = null;
    this.state = 'away'; // away, coming, set, closing, leaving
    this.site = null; // rigSite() of where she stopped
    this.model = null;
    this.rampK = 0;
    this.colliders = [];
    this.run = null;
    this.unit = null; // the unit on the rollers in a run
    this.wasPark = false;
    this.rollerAngle = 0;
    this.fanAngle = 0;
    this.sendHome = false;
    this.paid = 0;
    this.cameToday = false; // she has already come on this load
    this.clock = 0;
    this.slip = new RoadSlip();
    const L = game.world.layout;
    this.sheet = new RoadSheet({ game, anchor: sheetAnchor(L, game.world.heightAt(barnShape(L).x, barnShape(L).z)) });
    // The screen on the post: look at it and press E.
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.3, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.set(0, -100, 0); // parked out of sight until she sets up
    game.scene.add(this.proxy);
    game.interaction.add({
      target: this.proxy,
      isAvailable: () => this.state === 'set' && !game.player.isRiding,
      prompt: () => this.prompt(),
      feedback: 'latch', // the strap's ratchet clicks; the rollers, fan and beacon show it, and the engine's own revs are heard
      interact: () => this.start(),
    });
  }

  // The day --------------------------------------------------------------

  /** Whether today is a rolling road day on this farm. */
  get isToday() {
    return isRoadDay(this.g.farm?.day ?? 1, this.g.farmSeed, this.params);
  }

  /** The names of the quads that can have a run, for the sheet. */
  nameOf(id) {
    return thePhrase(id);
  }

  specOf(id) {
    return this.g.units.find((u) => u.spec.id === id)?.spec ?? null;
  }

  refreshSheet() {
    this.sheet.refresh(this.log, (id) => this.nameOf(id), (id) => this.specOf(id));
  }

  /** What the farm remembers. */
  toJSON() {
    return this.log.toJSON();
  }

  restore(saved) {
    this.log.restore(saved);
    this.refreshSheet();
  }

  // Prompt and start ------------------------------------------------------

  /** The unit sat on the rollers now: a quad that is over them, still and square on. */
  onTheRollers() {
    if (!this.site) return null;
    for (const u of this.g.units) {
      if (!canRun(u.spec)) continue;
      const q = u.quad;
      const r = onRollers({ x: q.position.x, z: q.position.z, yaw: q.yaw, speed: q.speed }, this.site.cradle);
      if (r.in && r.still && r.square) return u;
    }
    return null;
  }

  why(unit = this.onTheRollers(), purse = this.g.market.purse) {
    const q = unit?.quad;
    if (unit && q.manual && q.drivetrain.gear !== 0 && q.engine.isRunning) return 'Put it in neutral first';
    return whyNotRun({ spec: unit?.spec, onCradle: !!unit, running: !!q?.engine.isRunning, purse, busy: !!this.run?.active }, this.params);
  }

  prompt() {
    const why = this.why();
    if (why) return { info: why };
    return { action: `Run ${thePhrase(this.onTheRollers().spec.id)} on the rolling road for £${this.params.price}` };
  }

  /** Pays for a run and starts it on the quad on the rollers. True if it began. */
  start({ free = false } = {}) {
    const unit = this.onTheRollers();
    if (this.why(unit, free ? Infinity : this.g.market.purse)) return false;
    if (!free && !this.g.market.spend(this.params.price)) return false;
    this.unit = unit;
    this.paid = free ? 0 : this.params.price;
    const q = unit.quad;
    this.wasPark = q.parkBrake;
    q.parkBrake = true; // strapped down and chocked: the throttle only revs it against the rollers
    this.run = new RollingRun({ spec: unit.spec, params: this.params });
    this.slip.hide();
    setRunning(this.model, true);
    return true;
  }

  stopRun(refund) {
    const q = this.unit?.quad;
    if (q) {
      q.pto.throttle = 0;
      q.pto.load = 0;
      q.parkBrake = this.wasPark;
    }
    if (refund && this.paid) this.g.market.purse += this.paid;
    this.run = null;
    this.unit = null;
    if (this.model) setRunning(this.model, false);
  }

  // Each frame -------------------------------------------------------------

  update(dt, ctx) {
    const g = this.g;
    this.clock += dt;
    this.slip.update(dt);
    const hour = g.daylight?.hour ?? 12;
    if (this.state === 'away' && !this.cameToday && this.clock > FIRST_DELAY && this.isToday && roadOpen(hour, this.params)) this.call();
    if (this.visit) {
      this.checkLeaving(hour, g.daylight?.darkness ?? 0);
      const events = this.visit.update(dt, { ...ctx, stayOver: this.state === 'leaving' });
      for (const e of events) this.onEvent(e);
    }
    this.animate(dt);
    this.updateRun(dt);
  }

  /** The Land Rover is on its way in (the schedule, or the console). */
  call() {
    if (this.visit) return false;
    this.cameToday = true;
    this.sendHome = false;
    const spec = VISITOR_KINDS.tuner;
    const from = this.random() < 0.5 ? 1 : -1;
    const to = this.random() < 0.5 ? 1 : -1;
    this.visit = new Visit({ kind: 'tuner', places: this.t.places, from, to, leaveOpen: false, params: this.t.params, colour: spec.colour, reg: spec.regs[0] });
    this.state = 'coming';
    this.ensureModel();
    this.t.lastEvent = 'the tuner is coming with the rolling road';
    return true;
  }

  /** Starts packing up once it is late (or she is sent home) and nothing is on the rollers or running: the ramp comes up first. */
  checkLeaving(hour, darkness) {
    if (this.state !== 'set') return;
    const late = this.sendHome || hour >= this.params.leaveHour || darkness > 0.6;
    if (late && !this.run?.active && !this.anythingOnDeck()) this.state = 'closing';
  }

  anythingOnDeck() {
    if (!this.site) return false;
    const margin = 0.3;
    for (const u of this.g.units) {
      const p = u.quad.position;
      if (onDeck(this.site, p.x, p.z, margin)) return true;
    }
    const p = this.g.player.position;
    return onDeck(this.site, p.x, p.z, margin);
  }

  ensureModel() {
    if (this.model) return;
    this.model = buildRollingRoadModel();
    this.model.position.set(0, -100, 0); // out of sight until the first frame of the tow places it
    this.g.scene.add(this.model); // whether it is drawn is far detail's call by distance (world/farDetail.js SET_PIECE_NAMES), so `visible` is never touched here
  }

  onEvent(e) {
    if (e.type === 'arrived') {
      this.t.lastEvent = 'the tuner has arrived';
      this.setUp();
      this.t.remark('roadComing', e, 0.95);
    } else if (e.type === 'setUp') {
      this.t.lastEvent = 'the rolling road is set up';
    } else if (e.type === 'packUp') {
      this.state = 'leaving';
    } else if (e.type === 'done') {
      this.tearDown();
      this.visit = null;
      this.state = 'away';
      this.t.lastEvent = 'the tuner has gone';
    } else if (e.type === 'gate') {
      this.t.lastEvent = `the tuner ${e.open ? 'opened' : 'shut'} a gate`;
    }
  }

  /** The Land Rover has stopped: the trailer stays where it is, the ramp comes down and the deck becomes solid. */
  setUp() {
    const d = this.visit.drive;
    this.site = rigSite({ x: d.x, z: d.z, yaw: d.yaw });
    this.state = 'set';
    const t = this.site.trailer;
    this.baseY = this.g.world.groundHeightAt(t.x, t.z);
    this.footY = this.g.world.groundHeightAt(this.site.rampFoot.x, this.site.rampFoot.z);
    this.model.position.set(t.x, this.baseY, t.z);
    this.model.rotation.set(0, t.yaw, 0);
    this.proxy.position.set(this.site.post.x, this.baseY + 0.9, this.site.post.z);
    this.proxy.updateMatrixWorld(true);
    this.buildColliders();
  }

  tearDown() {
    this.dropColliders();
    this.stopRun(true);
    this.proxy.position.set(0, -100, 0);
    if (this.model) {
      this.g.scene.remove(this.model);
      this.model.traverse((o) => o.geometry?.dispose());
      this.model = null; // built afresh for the next visit
    }
    this.site = null;
    this.rampK = 0;
  }

  buildColliders() {
    this.dropColliders();
    const { physics, RAPIER } = this.g;
    const s = this.site;
    const base = this.baseY;
    const top = base + RIG.deckHeight;
    const hull = (pts) => {
      const desc = RAPIER.ColliderDesc.convexHull(new Float32Array(pts.flatMap((p) => [p.x, p.y, p.z])));
      return desc ? physics.createCollider(desc.setFriction(1)) : null;
    };
    const deck = [];
    for (const c of s.corners) deck.push({ x: c.x, y: top, z: c.z }, { x: c.x, y: base - 0.2, z: c.z });
    // The ramp: from the deck's rear edge to the ground at its foot, as long as the model's lowered ramp reaches.
    const drop = top - this.footY;
    const span = Math.sqrt(Math.max(0.01, RIG.rampLength ** 2 - drop ** 2));
    const rampPts = [];
    for (const sx of [-1, 1]) {
      const a = toWorld(s.trailer, sx * RIG.rampHalfWide, -RIG.deckHalf);
      const b = toWorld(s.trailer, sx * RIG.rampHalfWide, -RIG.deckHalf - span);
      rampPts.push({ x: a.x, y: top, z: a.z }, { x: a.x, y: base - 0.2, z: a.z }, { x: b.x, y: this.footY + 0.01, z: b.z }, { x: b.x, y: this.footY - 0.25, z: b.z });
    }
    this.colliders = [hull(deck), hull(rampPts)].filter(Boolean);
    this.rampDrop = drop;
  }

  dropColliders() {
    for (const c of this.colliders) this.g.physics.removeCollider(c, true);
    this.colliders = [];
  }

  animate(dt) {
    const m = this.model;
    if (!m || !this.visit) return;
    const body = this.t.view.shown.get(this.visit);
    if (this.state === 'coming' || this.state === 'leaving') {
      if (this.state === 'leaving') this.rampK = Math.max(0, this.rampK - dt / RAMP_SECONDS);
      if (body) this.followTow(this.visit.drive);
    } else if (this.state === 'set') {
      this.rampK = Math.min(1, this.rampK + dt / RAMP_SECONDS);
    } else if (this.state === 'closing') {
      this.rampK = Math.max(0, this.rampK - dt / RAMP_SECONDS);
      if (this.rampK <= 0) {
        this.dropColliders(); // the ramp is up: nothing to ride onto
        this.state = 'leaving';
        this.proxy.position.set(0, -100, 0);
      }
    }
    const drop = this.state === 'coming' || this.state === 'leaving' ? RIG.deckHeight : this.rampDrop ?? RIG.deckHeight;
    poseRamp(m, this.rampK, drop);
    const spinning = this.run?.active && this.run.phase !== 'done';
    const rpm = this.unit?.quad.engine.rpm ?? 0;
    this.rollerAngle += spinning ? Math.min(25, (rpm / 60) * Math.PI * 2 * 0.12) * dt : 0;
    this.fanAngle += spinning ? dt * 40 : 0;
    spinRollers(m, this.rollerAngle, this.fanAngle);
    this.screen();
  }

  /** The trailer behind the Land Rover as it drives: the same heading, a hitch's length back, on the ground there. */
  followTow(d) {
    const m = this.model;
    const x = d.x - Math.sin(d.yaw) * RIG.hitch;
    const z = d.z - Math.cos(d.yaw) * RIG.hitch;
    const front = this.g.world.groundHeightAt(x + Math.sin(d.yaw) * 2, z + Math.cos(d.yaw) * 2);
    const back = this.g.world.groundHeightAt(x - Math.sin(d.yaw) * 2, z - Math.cos(d.yaw) * 2);
    m.position.set(x, (front + back) / 2, z);
    m.rotation.set(-Math.atan2(front - back, 4), d.yaw, 0, 'YXZ');
  }

  /** What the screen on the post says. */
  screen() {
    const s = this.model.userData.screen;
    const price = `£${this.params.price} a run`;
    const run = this.run;
    if (run?.active) {
      const q = this.unit.quad;
      const label = run.phase === 'settle' ? 'HOLDING' : run.phase === 'sweep' ? 'SWEEPING' : 'COOLING';
      const bhp = run.points.length ? run.points[run.points.length - 1].bhp : 0;
      s.show([{ text: 'ROLLING ROAD', size: 22, bold: true }, { text: label, size: 20 }, { text: `${Math.round(q.engine.rpm).toString().padStart(5)} rpm`, size: 24 }, { text: `${bhp.toFixed(1).padStart(5)} bhp`, size: 24 }], run.progress);
      return;
    }
    const last = this.unit ? null : this.lastShown;
    if (last && this.slip.isShown) {
      s.show([{ text: 'LAST RUN', size: 20, bold: true }, { text: `${last.bhp.toFixed(1)} bhp`, size: 30 }, { text: `at ${last.rpm} rpm`, size: 18 }, { text: `stock ${last.stock}`, size: 18, colour: last.verdict === 'down' ? '#e0675a' : '#9ad08a' }]);
      return;
    }
    const on = this.onTheRollers();
    s.show([{ text: 'ROLLING ROAD', size: 22, bold: true }, { text: price, size: 20 }, { text: on ? 'READY: press E' : 'Ride a quad on', size: 18, colour: on ? '#9ad08a' : '#f2b134' }, { text: 'Engine running,', size: 15 }, { text: 'out of gear.', size: 15 }]);
  }

  updateRun(dt) {
    const run = this.run;
    if (!run) return;
    const unit = this.unit;
    const q = unit.quad;
    const inPlace = this.onTheRollersFor(unit);
    if (!inPlace) {
      this.stopRun(true);
      this.g.hud.toast('The run stopped: the quad left the rollers. Your money is back in the tin', 3);
      return;
    }
    const events = run.update(dt, { rpm: q.engine.rpm, power: q.engine.power, running: q.engine.isRunning });
    q.pto.throttle = run.throttle;
    q.pto.load = run.load;
    for (const e of events) {
      if (e.type === 'stalled') {
        this.stopRun(true);
        this.g.hud.toast('It cut out on the rollers. Your money is back in the tin', 3);
        this.speakFor('roadBroke', unit);
      } else if (e.type === 'done') this.finish(unit, e.result);
    }
  }

  /** Whether this particular unit is still where it was strapped down (looser than sitting down to a fresh one). */
  onTheRollersFor(unit) {
    const q = unit.quad;
    return onRollers({ x: q.position.x, z: q.position.z, yaw: q.yaw, speed: 0 }, this.site.cradle).in;
  }

  finish(unit, result) {
    const prev = this.log.last(unit.spec.id);
    const others = this.log.ids().filter((id) => id !== unit.spec.id);
    const strongest = others.every((id) => this.log.last(id).bhp < result.bhp);
    this.log.add(unit.spec.id, this.g.farm?.day ?? 1, result);
    this.stopRun(false);
    this.lastShown = result;
    this.slip.show(thePhrase(unit.spec.id), result, prev);
    this.refreshSheet();
    this.t.lastEvent = `${sayName(unit.spec.id)}: ${result.bhp} bhp (stock ${result.stock})`;
    const key = result.verdict === 'up' ? 'roadUp' : result.verdict === 'down' ? 'roadDown' : 'roadStock';
    this.t.later.push({ left: 1.5, run: () => this.speakFor(key, unit) });
    if (result.verdict === 'up') this.t.later.push({ left: 2, run: () => this.cheer() });
    if (strongest && others.length) {
      this.t.later.push({ left: 6, run: () => this.argue() });
    }
  }

  /** The nearest girl who is free says `key`, if she is near the rolling road. */
  speakFor(key, unit) {
    const at = this.site ? this.site.cradle : unit.quad.position;
    this.t.remark(key, at, 0.9);
  }

  /** A girl near enough cheers the figure. */
  cheer() {
    const at = this.site?.cradle;
    if (!at) return;
    let best = null;
    let bd = 25;
    for (const c of this.g.companions) {
      const d = Math.hypot(c.root.position.x - at.x, c.root.position.z - at.z);
      if (d < bd && c.availability().canRemark) {
        best = c;
        bd = d;
      }
    }
    best?.react?.('cheer', { from: at, strength: 1 });
  }

  /** The strongest quad on the sheet is the one just run: one girl brags, the other answers. */
  argue() {
    const at = this.site?.cradle ?? this.g.player.position;
    const near = [...this.g.companions]
      .map((c) => ({ c, d: Math.hypot(c.root.position.x - at.x, c.root.position.z - at.z) }))
      .filter((x) => x.d < 40 && x.c.availability().canRemark)
      .sort((a, b) => a.d - b.d);
    if (!near.length) return;
    near[0].c.voice.say('roadBrag', { chance: 1 });
    const other = near[1]?.c;
    if (other) this.t.later.push({ left: 4, run: () => other.availability().canRemark && other.voice.say('roadReply', { chance: 1 }) });
  }

  // Debug panel and console ------------------------------------------------

  debugCall() {
    return this.call();
  }

  debugSendHome() {
    if (this.state === 'set') {
      this.sendHome = true;
      return true;
    }
    return false;
  }

  debugRun() {
    return this.start({ free: true });
  }

  debugClearSheet() {
    this.log.restore(null);
    this.refreshSheet();
  }

  describe() {
    const next = daysToRoadDay(this.g.farm?.day ?? 1, this.g.farmSeed, this.params);
    const day = next === 0 ? 'today is a rolling road day' : next == null ? 'no rolling road days' : `next rolling road day in ${next} day${next === 1 ? '' : 's'}`;
    const runs = this.log.ids().length;
    return `${day}; ${this.state}${this.run?.active ? ` (${this.run.phase})` : ''}; ${runs} quad${runs === 1 ? '' : 's'} on the sheet`;
  }
}
