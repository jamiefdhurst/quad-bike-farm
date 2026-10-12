// Draws the lane's traffic and the visitors (world/traffic.js): the farm's own vehicle models, built once per paint and reused, set on the
// ground at the speed and heading the simulation says, with their wheels turning and their lights on after dark. A passing driver is a
// dark shape behind the glass; a visitor's driver is a real girl-model (the same rig as Amy and Jess) in the seat, then out and walking.
// Nothing here is solid: the vehicles are scenery that brake for you.

import * as THREE from 'three';
import { buildLandRoverModel, LANDY_LAYOUT, LANDY_GROUND_OFFSET, LANDY_SEATS } from '../vehicle/landRoverModel.js';
import { buildTractorModel, TRACTOR_LAYOUT, TRACTOR_GROUND_OFFSET } from '../vehicle/tractorModel.js';
import { buildUtvModel, UTV_LAYOUT, UTV_GROUND_OFFSET, UTV_SEATS } from '../vehicle/utvModel.js';
import { CharacterRig } from '../npc/characterRig.js';
import { applyOutfit, withShirt, withJumper, OUTFITS } from '../npc/outfit.js';

const MODELS = {
  defender: { build: (c) => buildLandRoverModel({ bodyColor: c, dashStyle: 'defender', variant: 'defender' }), layout: LANDY_LAYOUT, offset: LANDY_GROUND_OFFSET, seat: LANDY_SEATS.driver },
  series: { build: (c) => buildLandRoverModel({ bodyColor: c, dashStyle: 'series', variant: 'series' }), layout: LANDY_LAYOUT, offset: LANDY_GROUND_OFFSET, seat: LANDY_SEATS.driver },
  tractor: { build: (c) => buildTractorModel({ bodyColor: c, dashStyle: 'tractor' }), layout: TRACTOR_LAYOUT, offset: TRACTOR_GROUND_OFFSET, seat: { x: 0, y: 1.35, z: -0.55 } },
  utv: { build: (c) => buildUtvModel({ bodyColor: c, dashStyle: 'utv' }), layout: UTV_LAYOUT, offset: UTV_GROUND_OFFSET, seat: UTV_SEATS.driver ?? { x: -0.4, y: 0.9, z: -0.1 } },
};

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

export class TrafficView {
  /** `groundAt(x, z)`: the drawn ground. `gltf`: the girls' model, for the visitors. */
  constructor(scene, groundAt, gltf) {
    this.scene = scene;
    this.groundAt = groundAt;
    this.gltf = gltf;
    this.pool = new Map(); // `${model}:${colour}` -> idle bodies
    this.shown = new Map(); // simulation vehicle -> body
    this.parcels = [];
    this.rigs = {}; // visitor kind -> { rig, sitHips }
    this.t = 0;
  }

  /** A vehicle body for this model and paint, from the pool if there is one idle. */
  take(model, colour, driver) {
    const key = `${model}:${colour}`;
    const idle = this.pool.get(key)?.pop();
    if (idle) {
      idle.object.visible = true;
      return idle;
    }
    const spec = MODELS[model];
    const object = spec.build(colour);
    const wheels = spec.layout.wheels.map((w) => {
      const o = object.getObjectByName(w.name);
      o.position.set(w.x, w.radius + spec.offset + (spec.layout.spawnSag ?? 0), w.z); // the tyre on the ground, the body sunk by its springs
      return { object: o, spin: o.getObjectByName('spin'), radius: w.radius, front: !!w.front };
    });
    const bodyRoot = object.getObjectByName('bodyRoot');
    if (bodyRoot) bodyRoot.position.y = spec.offset; // the body hangs from the chassis origin, as in quad.js
    const seat = new THREE.Group();
    seat.position.set(spec.seat.x, spec.seat.y - 0.02, spec.seat.z);
    (bodyRoot ?? object).add(seat);
    if (driver) seat.add(silhouette());
    this.scene.add(object);
    return { key, model, object, spec, wheels, seat, spun: 0, lit: -1, last: null };
  }

  release(body) {
    body.object.visible = false;
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
    const y = (front + back) / 2;
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
    const rig = new CharacterRig(this.gltf, kind === 'post' ? 1.66 : 1.72);
    const outfit = kind === 'post' ? withShirt(OUTFITS.original, '#b8282a') : withJumper(OUTFITS.original, '#5b6b3c');
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

  /** A parcel left at the barn door. Only the latest stays. */
  addParcel(x, z, yaw) {
    for (const p of this.parcels) this.scene.remove(p);
    this.parcels = [];
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

  /** Each frame: `traffic` is the simulation. */
  update(dt, traffic, darkness) {
    this.t += dt;
    const live = new Set(traffic.vehicles);
    for (const [v, body] of this.shown) {
      if (v.steps ? v !== traffic.visit : !live.has(v)) {
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
    const visit = traffic.visit;
    if (visit) {
      let body = this.shown.get(visit);
      if (!body) {
        body = this.take(visit.model, visit.colour, false);
        this.shown.set(visit, body);
      }
      this.place(body, visit.drive, darkness, dt);
      this.placeDriver(visit, body);
    }
    for (const r of Object.values(this.rigs)) if (r.rig.root.visible) r.rig.update(dt);
  }
}
