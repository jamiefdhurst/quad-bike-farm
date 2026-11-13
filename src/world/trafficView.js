// Draws the lane's traffic and the visitors (world/traffic.js): the farm's own vehicle models, built once per paint and reused, set on the
// ground at the speed and heading the simulation says, with their wheels turning and their lights on after dark. A passing driver is a
// dark shape behind the glass; a visitor's driver is a real girl-model (the same rig as Amy and Jess) in the seat, then out and walking.
// Nothing here is solid: the vehicles are scenery that brake for you.

import * as THREE from 'three';
import { buildCabModel, TOR_LAYOUT, CRAG_LAYOUT, CAB_GROUND_OFFSET, CAB_SEATS } from '../vehicle/cabModel.js';
import { buildTractorModel, TRACTOR_LAYOUT, TRACTOR_GROUND_OFFSET } from '../vehicle/tractorModel.js';
import { buildUtvModel, UTV_LAYOUT, UTV_GROUND_OFFSET, UTV_SEATS } from '../vehicle/utvModel.js';
import { buildMiniMotoModel, MOTO_LAYOUT, MOTO_GROUND_OFFSET } from '../vehicle/miniMotoModel.js';
import { TZ_WHEELS } from '../vehicle/tz65Body.js';
import { LANE_KINDS, VISITOR_KINDS } from './traffic.js';
import { KIDS_BIKES, KIDS_TOPS, KIDS_PARAM_RANGES } from './kids.js';
import { CharacterRig } from '../npc/characterRig.js';
import { applyOutfit, withShirt, withJumper, OUTFITS } from '../npc/outfit.js';

const MODELS = {
  crag: { build: (c, reg) => buildCabModel({ bodyColor: c, dashStyle: 'crag', variant: 'crag', reg }), layout: CRAG_LAYOUT, offset: CAB_GROUND_OFFSET, seat: CAB_SEATS.driver },
  tor: { build: (c, reg) => buildCabModel({ bodyColor: c, dashStyle: 'tor', variant: 'tor', reg }), layout: TOR_LAYOUT, offset: CAB_GROUND_OFFSET, seat: CAB_SEATS.driver },
  tractor: { build: (c) => buildTractorModel({ bodyColor: c, dashStyle: 'tractor' }), layout: TRACTOR_LAYOUT, offset: TRACTOR_GROUND_OFFSET, seat: { x: 0, y: 1.35, z: -0.55 } },
  // The neighbours' kids' mini moto (kids.js): the TZ 65 stood upright on its two wheels, the rider sat on its anchor.
  moto: { build: (c) => buildMiniMotoModel({ bodyColor: c }), layout: { wheels: MOTO_LAYOUT.wheels.map((w) => ({ ...w, radius: TZ_WHEELS.radius })) }, offset: MOTO_GROUND_OFFSET, seat: { x: 0, y: 0.78, z: -0.2 } },
  utv: { build: (c) => buildUtvModel({ bodyColor: c, dashStyle: 'utv' }), layout: UTV_LAYOUT, offset: UTV_GROUND_OFFSET, seat: UTV_SEATS.driver ?? { x: -0.4, y: 0.9, z: -0.1 } },
};

const KID_HEIGHT = 1.3; // m: a ten-year-old

const SKIN = new THREE.MeshStandardMaterial({ color: 0x2b2926, roughness: 1 });
const BOX = new THREE.MeshStandardMaterial({ color: 0xb08d5c, roughness: 0.9 });
const TAPE = new THREE.MeshStandardMaterial({ color: 0xc9b894, roughness: 0.9 });

/** A seated figure's shape for a driver too far off or too quick to see: a torso and a head. */
function silhouette() {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.3), SKIN);
  torso.position.y = 0.3;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), SKIN);
  head.position.y = 0.72;
  g.add(torso, head);
  return g;
}

/**
 * One of the farm's own vehicle models (`model`: crag, tor, tractor or utv) in a paint, with its tyres set on the ground and the body
 * sunk by its springs, as quad.js does. Also used for the vehicles parked in the neighbour's yard (neighbourFarmProps.js).
 */
export function buildVehicleBody(model, colour, reg = null) {
  const spec = MODELS[model];
  const object = spec.build(colour, reg);
  const wheels = spec.layout.wheels.map((w) => {
    const o = object.getObjectByName(w.name);
    o.position.set(w.x, w.radius + spec.offset + (spec.layout.spawnSag ?? 0), w.z); // the tyre on the ground, the body sunk by its springs
    return { object: o, spin: o.getObjectByName('spin'), radius: w.radius, front: !!w.front };
  });
  const bodyRoot = object.getObjectByName('bodyRoot');
  if (bodyRoot) bodyRoot.position.y = spec.offset; // the body hangs from the chassis origin, as in quad.js
  return { object, spec, wheels, bodyRoot };
}

const bodyKey = (model, colour, reg) => `${model}:${colour}:${reg ?? ''}`;

/**
 * Every body the lane, the visitors and the kids can ask for, likeliest first: { model, colour, reg, driver }. Building one takes about 70 ms,
 * so `TrafficView.stockUp` makes them behind the start screen instead of in the frame a vehicle turns in. A test checks nothing traffic deals is missing.
 */
export function wantedBodies() {
  const out = [];
  const lane = Object.values(LANE_KINDS).sort((a, b) => b.weight - a.weight);
  for (const k of lane) for (const colour of k.colours) out.push({ model: k.model, colour, reg: null, driver: true });
  for (const k of Object.values(VISITOR_KINDS)) {
    const paints = k.colours ?? [k.colour];
    paints.forEach((colour, i) => out.push({ model: k.model, colour, reg: k.regs[i % k.regs.length], driver: false }));
  }
  for (const colour of KIDS_BIKES) out.push({ model: 'moto', colour, reg: null, driver: false });
  return out;
}

export class TrafficView {
  /** `groundAt(x, z)`: the drawn ground. `gltf`: the girls' model, for the visitors. */
  constructor(scene, groundAt, gltf, prepare = null, liftAt = () => 0) {
    this.scene = scene;
    this.groundAt = groundAt;
    this.liftAt = liftAt; // how far a surface laid on the ground (the lane's tarmac) is above it at x, z
    this.gltf = gltf;
    this.prepare = prepare; // (object) => the object's shaders asked for, so the first sight of it does not build them
    this.stocked = new Set(); // keys already built ahead
    this.pool = new Map(); // `${model}:${colour}` -> idle bodies
    this.shown = new Map(); // simulation vehicle -> body
    this.parcels = [];
    this.kidRigs = []; // rider index -> { rig, sitHips, top }: the kids, on the girls' rig scaled down
    this.kidBikes = new Map(); // rider -> body
    this.rigs = {}; // visitor kind -> { rig, sitHips }
    this.t = 0;
  }

  /** A vehicle body for this model and paint, from the pool if there is one idle. */
  take(model, colour, driver, reg = null) {
    const idle = this.pool.get(bodyKey(model, colour, reg))?.pop();
    if (idle) {
      this.stocked.delete(idle.key); // a spare is built for the next of its kind, in case two are out at once
      idle.object.visible = true;
      this.scene.add(idle.object);
      return idle;
    }
    return this.make(model, colour, driver, reg);
  }

  /** A new body, in the scene and in use. */
  make(model, colour, driver, reg = null) {
    const key = bodyKey(model, colour, reg);
    const { object, spec, wheels, bodyRoot } = buildVehicleBody(model, colour, reg);
    const seat = new THREE.Group();
    seat.position.set(spec.seat.x, spec.seat.y - 0.02, spec.seat.z);
    (bodyRoot ?? object).add(seat);
    if (driver) seat.add(silhouette());
    this.scene.add(object);
    return { key, model, object, spec, wheels, seat, spun: 0, lit: -1, last: null };
  }

  /**
   * Builds the next thing nobody has built yet, and says whether there was one: the vehicle bodies into the pool, then the visitors' rigs and
   * the kids' (a rig is cloned and dressed on first use). One a call: each takes 10 to 30 ms.
   */
  stockUp() {
    const w = wantedBodies().find((b) => !this.stocked.has(bodyKey(b.model, b.colour, b.reg)));
    if (w) {
      this.stocked.add(bodyKey(w.model, w.colour, w.reg));
      const body = this.make(w.model, w.colour, w.driver, w.reg);
      this.prepare?.(body.object);
      this.release(body);
      return true;
    }
    if (!this.gltf) return false;
    const kind = Object.keys(VISITOR_KINDS).find((k) => !this.rigs[k]);
    if (kind) return !!this.rigFor(kind);
    const slot = Array.from({ length: KIDS_PARAM_RANGES.kidsMax[1] }, (_, i) => i).find((i) => !this.kidRigs[i]);
    if (slot === undefined) return false;
    return !!this.kidRig(slot, KIDS_TOPS[slot % KIDS_TOPS.length]);
  }

  release(body) {
    body.object.visible = false;
    this.scene.remove(body.object); // an idle body is kept out of the scene, so the dozens waiting cost no matrix updates a frame
    if (!this.pool.has(body.key)) this.pool.set(body.key, []);
    this.pool.get(body.key).push(body);
  }

  /** Puts the body where the simulation's vehicle is. */
  place(body, d, darkness, dt) {
    const g = this.groundAt;
    const fx = Math.sin(d.yaw);
    const fz = Math.cos(d.yaw);
    const front = g(d.x + fx * 1.4, d.z + fz * 1.4);
    const back = g(d.x - fx * 1.4, d.z - fz * 1.4);
    const y = (front + back) / 2 + this.liftAt(d.x, d.z);
    body.object.position.set(d.x, y - body.spec.offset - (body.spec.layout.spawnSag ?? 0), d.z);
    body.object.rotation.set(-Math.atan2(front - back, 2.8), d.yaw, 0, 'YXZ');
    body.spun += d.speed * dt;
    for (const w of body.wheels) if (w.spin) w.spin.rotation.x = body.spun / (w.radius || 0.4);
    const lit = darkness > 0.35 ? 1 : 0;
    if (lit !== body.lit) {
      body.lit = lit;
      const u = body.object.userData;
      if (u.beamMaterial) u.beamMaterial.opacity = lit * 0.2;
      if (u.haloMaterial) u.haloMaterial.opacity = lit * 0.7;
      if (u.lensMaterial) {
        u.lensMaterial.emissive?.setHex(lit ? 0xfff2cc : 0x000000);
        u.lensMaterial.emissiveIntensity = lit ? 1.4 : 0;
      }
      if (u.tailMaterial) u.tailMaterial.emissive?.setHex(lit ? 0x8a0a06 : 0x000000);
    }
  }

  /** A visitor's rig, made the first time she comes. */
  rigFor(kind) {
    if (this.rigs[kind] || !this.gltf) return this.rigs[kind] ?? null;
    const rig = new CharacterRig(this.gltf, kind === 'post' ? 1.66 : kind === 'tuner' ? 1.68 : 1.72);
    const outfit = kind === 'post' ? withShirt(OUTFITS.original, '#b8282a') : kind === 'tuner' ? withJumper(OUTFITS.original, '#2b3d52') : withJumper(OUTFITS.original, '#5b6b3c');
    applyOutfit(rig, outfit);
    const sitHips = rig.measureHips('SitIdle', 0);
    rig.play('Idle', { fade: 0 });
    rig.root.visible = false;
    this.scene.add(rig.root);
    this.rigs[kind] = { rig, sitHips, mode: null };
    return this.rigs[kind];
  }

  /** The visit's driver: sat in the seat, or walking about on the ground. */
  placeDriver(visit, body) {
    const r = this.rigFor(visit.kind);
    if (!r || !body) return;
    const d = visit.driver;
    const { rig } = r;
    rig.root.visible = true;
    if (d.mode === 'seat') {
      if (r.mode !== 'seat') {
        body.seat.add(rig.root);
        rig.root.position.set(-r.sitHips.x, -r.sitHips.y + 0.04, -r.sitHips.z);
        rig.root.rotation.set(0, 0, 0);
        rig.play('SitIdle', { fade: 0.1 });
        r.mode = 'seat';
      }
    } else {
      if (r.mode !== 'foot') {
        this.scene.add(rig.root);
        r.mode = 'foot';
        r.anim = null;
      }
      rig.root.position.set(d.x, this.groundAt(d.x, d.z), d.z);
      rig.root.rotation.set(0, d.heading, 0);
      const anim = d.walking ? 'Walking' : 'Idle';
      if (r.anim !== anim) {
        rig.play(anim, { fade: 0.25 });
        r.anim = anim;
      }
    }
  }

  hideDriver(kind) {
    const r = this.rigs[kind];
    if (!r) return;
    r.rig.root.visible = false;
    this.scene.add(r.rig.root);
    r.mode = null;
  }

  /** A kid's rig (the girls' model at about 1.3 m, in a jumper), made the first time that rider is needed. */
  kidRig(i, top) {
    if (!this.gltf) return null;
    let k = this.kidRigs[i];
    if (!k) {
      const rig = new CharacterRig(this.gltf, KID_HEIGHT);
      rig.play('Idle', { fade: 0 });
      rig.root.visible = false;
      this.scene.add(rig.root);
      k = this.kidRigs[i] = { rig, sitHips: null, top: null };
    }
    if (k.top !== top) {
      applyOutfit(k.rig, withJumper(OUTFITS.original, top));
      k.sitHips = k.rig.measureHips('SitIdle', 0);
      k.top = top;
    }
    return k;
  }

  /** The kids' bikes and riders for this frame: sat on the mini motos, set on the ground, wheels turning. */
  placeKids(group, darkness, dt) {
    const live = new Set(group?.riders ?? []);
    for (const [r, body] of this.kidBikes) {
      if (live.has(r)) continue;
      this.release(body);
      this.kidBikes.delete(r);
      const k = this.kidRigs[r.id];
      if (k) {
        k.rig.root.visible = false;
        this.scene.add(k.rig.root); // off the pooled bike, so the next rider on it is not sat on by this one
      }
    }
    for (const r of live) {
      let body = this.kidBikes.get(r);
      const k = this.kidRig(r.id, r.top);
      if (!body) {
        body = this.take('moto', r.bike, false);
        this.kidBikes.set(r, body);
        if (k) {
          body.seat.add(k.rig.root);
          k.rig.root.position.set(-k.sitHips.x, -k.sitHips.y + 0.04, -k.sitHips.z);
          k.rig.root.rotation.set(0, 0, 0);
          k.rig.root.visible = true;
          k.rig.play('SitIdle', { fade: 0 });
        }
      }
      this.place(body, r.drive, darkness, dt);
      if (k?.rig.root.visible) k.rig.update(dt);
    }
  }

  /** Takes the parcel at the barn door away (opened). */
  clearParcel() {
    for (const p of this.parcels) this.scene.remove(p);
    this.parcels = [];
  }

  /** A parcel left at the barn door. Only the latest stays. */
  addParcel(x, z, yaw) {
    this.clearParcel();
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.34), BOX);
    box.position.y = 0.15;
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.31, 0.35), TAPE);
    tape.position.y = 0.15;
    g.add(box, tape);
    g.position.set(x, this.groundAt(x, z), z);
    g.rotation.y = yaw;
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    this.scene.add(g);
    this.parcels.push(g);
  }

  /** Each frame: `traffic` is the simulation; `extras` are visits of their own that the traffic does not deal (the rolling road's tuner). */
  update(dt, traffic, darkness, kids = null, extras = []) {
    this.t += dt;
    this.placeKids(kids?.group, darkness, dt);
    const live = new Set(traffic.vehicles);
    const visits = [traffic.visit, ...extras].filter(Boolean);
    for (const [v, body] of this.shown) {
      if (v.steps ? !visits.includes(v) : !live.has(v)) {
        if (v.steps) this.hideDriver(v.kind);
        this.release(body);
        this.shown.delete(v);
      }
    }
    for (const v of traffic.vehicles) {
      let body = this.shown.get(v);
      if (!body) {
        body = this.take(v.model, v.colour, true);
        this.shown.set(v, body);
      }
      this.place(body, v.drive, darkness, dt);
    }
    for (const visit of visits) {
      let body = this.shown.get(visit);
      if (!body) {
        body = this.take(visit.model, visit.colour, false, visit.reg);
        this.shown.set(visit, body);
      }
      this.place(body, visit.drive, darkness, dt);
      this.placeDriver(visit, body);
    }
    for (const r of Object.values(this.rigs)) if (r.rig.root.visible) r.rig.update(dt);
  }
}
