// The traffic in the running game: owns the lane's simulation (traffic.js), its view and sound, the two gates' prompts (E opens or shuts
// them), and what the girls make of it all. game.js builds it and calls update(); the debug panel and the console use the debug* methods.

import * as THREE from 'three';
import { createRandom } from '../core/random.js';
import { registerTuning } from '../core/tuning.js';
import { Traffic, DEFAULT_TRAFFIC_PARAMS, TRAFFIC_PARAM_RANGES, visitPlaces, LANE_KINDS, VISITOR_KINDS } from './traffic.js';
import { TrafficView } from './trafficView.js';
import { GATE_PARAM_RANGES } from './gates.js';
import { TrafficAudio } from '../audio/trafficAudio.js';

const CLOSE = 40; // m: a girl within this of something that happens may remark on it

export class TrafficHost {
  constructor(game) {
    this.g = game;
    const world = game.world;
    this.gates = world.props.gates;
    this.params = { ...DEFAULT_TRAFFIC_PARAMS };
    registerTuning('Traffic', this.params, TRAFFIC_PARAM_RANGES);
    registerTuning('Gates', world.props.gateParams, GATE_PARAM_RANGES);
    this.places = visitPlaces(world.layout);
    this.traffic = new Traffic({ places: this.places, params: this.params, random: createRandom(game.seed ^ 0x7a11c) });
    this.view = new TrafficView(game.scene, (x, z) => world.groundHeightAt(x, z), game.models.companion);
    this.audio = new TrafficAudio(game.audioHub);
    this.later = []; // [{ left, run }]: things the girls say a few seconds after
    this.lastEvent = 'nothing yet';
    this.addGatePrompts();
  }

  gate(id) {
    return this.gates.find((g) => g.id === id);
  }

  /** Everything that would be in the way of a gate shutting or a vehicle driving: you, the quads and the girls on foot. */
  blockers() {
    const g = this.g;
    const out = [];
    const p = g.player.position;
    out.push({ x: p.x, z: p.z });
    for (const u of g.units) out.push({ x: u.quad.position.x, z: u.quad.position.z });
    for (const c of g.companions) if (c.root.parent === g.scene) out.push({ x: c.root.position.x, z: c.root.position.z });
    return out;
  }

  /** An E prompt on each gate: open it, or shut it. */
  addGatePrompts() {
    const g = this.g;
    for (const gate of this.gates) {
      const wide = gate.id === 'road' ? { x: 1.4, z: 7.8 } : { x: 4.8, z: 1.4 };
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(wide.x, 2.2, wide.z), new THREE.MeshBasicMaterial({ visible: false }));
      proxy.position.set(gate.x, g.world.groundHeightAt(gate.x, gate.z) + 1.1, gate.z);
      g.scene.add(proxy);
      g.interaction.add({
        target: proxy,
        isAvailable: () => !g.player.isRiding,
        prompt: () => (gate.isOpen ? 'Shut the gate' : 'Open the gate'),
        interact: () => this.toggle(gate, true),
      });
    }
  }

  /** You (or the debug panel) swing a gate. Shutting is refused with something in the way. */
  toggle(gate, byYou = false) {
    const r = gate.set(!gate.isOpen, this.blockers());
    if (!r.ok) {
      this.g.hud.toast('Something is in the way of the gate', 2);
      return false;
    }
    if (byYou && !gate.isOpen) this.afterYouShut(gate);
    return true;
  }

  /** If a visitor left the big gate open and you shut it, one of the girls is pleased. */
  afterYouShut(gate) {
    if (gate.id === 'road' && this.leftOpenBy) {
      this.leftOpenBy = false;
      this.later.push({ left: 2, run: () => this.remark('gateShutting', gate, 0.6) });
    }
  }

  /** The nearest girl who is free to say something says `key`, if she is within earshot of `at`. */
  remark(key, at, chance = 0.8) {
    const g = this.g;
    let best = null;
    let bd = CLOSE;
    for (const c of g.companions) {
      const d = Math.hypot(c.root.position.x - at.x, c.root.position.z - at.z);
      if (d < bd && c.availability().canRemark) {
        best = c;
        bd = d;
      }
    }
    best?.voice.say(key, { chance });
  }

  update(dt) {
    const g = this.g;
    for (const gate of this.gates) gate.update(dt);
    const dark = g.daylight?.darkness ?? 0;
    const road = this.gate('road');
    const blockers = this.blockers();
    const ctx = {
      darkness: dark,
      blockers,
      swingSeconds: road.state.p.swingSeconds,
      gate: { get isOpen() { return road.isOpen; }, set: (open) => road.set(open, blockers).ok },
    };
    for (const e of this.traffic.update(dt, ctx)) this.onEvent(e);
    this.view.update(dt, this.traffic, dark);
    for (let i = this.later.length - 1; i >= 0; i--) {
      this.later[i].left -= dt;
      if (this.later[i].left <= 0) this.later.splice(i, 1)[0].run();
    }
    this.sound(dt);
  }

  sound(dt) {
    const g = this.g;
    const items = [];
    const add = (id, kind, d, y) => items.push({ id, kind, x: d.x, y, z: d.z, vx: Math.sin(d.yaw) * d.speed, vz: Math.cos(d.yaw) * d.speed, speed: d.speed });
    for (const v of this.traffic.vehicles) add(v.id, v.kind, v.drive, g.world.groundHeightAt(v.drive.x, v.drive.z) + 0.6);
    const visit = this.traffic.visit;
    if (visit) add('visit', visit.kind, visit.drive, g.world.groundHeightAt(visit.drive.x, visit.drive.z) + 0.6);
    const cam = g.camera.position;
    this.audio.update(items, { x: cam.x, y: cam.y, z: cam.z, vx: 0, vz: 0 });
  }

  onEvent(e) {
    const g = this.g;
    const places = this.places;
    const at = (x, z) => ({ x, y: g.world.groundHeightAt(x, z) + 1, z });
    if (e.type === 'pass') {
      const d = e.vehicle.drive;
      this.lastEvent = `a ${e.vehicle.kind} went by`;
      g.notice('traffic', at(d.x, d.z), { key: 'lane', strength: 0.5 });
    } else if (e.type === 'visit') {
      this.lastEvent = `${e.visit.kind} is coming`;
    } else if (e.type === 'arrived') {
      const v = this.traffic.visit;
      this.lastEvent = `${v?.kind} arrived at the barn`;
      g.notice('traffic', at(e.x, e.z), { key: 'visitor', strength: 1 });
      this.remark(v?.kind === 'post' ? 'postVan' : 'neighbourCalls', e, 0.9);
    } else if (e.type === 'parcel') {
      this.view.addParcel(places.stop.x - 6.5, places.door.z - 1.7, 0.4);
      this.lastEvent = 'the post left a parcel at the barn';
      this.later.push({ left: 7, run: () => this.remark('parcelLeft', e, 0.7) });
    } else if (e.type === 'chat') {
      this.lastEvent = 'a neighbour is stood about at the barn';
      g.notice('traffic', at(e.x, e.z), { key: 'visitor', strength: 1 });
    } else if (e.type === 'leftOpen') {
      this.leftOpenBy = true;
      this.lastEvent = 'the visitor left the big gate open';
      this.later.push({ left: 4, run: () => this.remark('gateLeftOpen', this.gate('road'), 0.8) });
    } else if (e.type === 'honk') {
      const p = g.player.position;
      if (Math.hypot(p.x - e.x, p.z - e.z) < 25) g.hud.toast('Someone is waiting to get past', 2);
    } else if (e.type === 'visitEnded') {
      this.lastEvent = 'the visitor has gone';
    }
  }

  // Debug panel and console --------------------------------------------------

  debugPass(kind) {
    this.traffic.spawnPass(kind);
    return true;
  }

  debugVisit(kind, leaveOpen) {
    const v = this.traffic.startVisit(kind, leaveOpen);
    if (v) this.lastEvent = `${v.kind} is coming`;
    return !!v;
  }

  describe() {
    const t = this.traffic;
    const v = t.visit;
    const lane = t.vehicles.map((x) => x.kind).join(', ') || 'empty';
    const step = v?.current ? v.current.type : '';
    return `lane ${lane}; ${v ? `${v.kind} visit (${step})` : 'no visitor'}; last: ${this.lastEvent}`;
  }
}

export { LANE_KINDS, VISITOR_KINDS };
