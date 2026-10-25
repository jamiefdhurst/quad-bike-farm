// What is left out far away: whole set pieces beyond a distance from their nearest edge, the barn's loose props beyond a short one, and for
// each vehicle its small parts (bolts, cables, decals, brake bits) and then its shadow. Close up nothing changes. See docs/decisions/performance.md,
// "Draw less far away (#365)". The distances are in the graphics params (src/core/graphics.js).

import * as THREE from 'three';
import { distanceToTile } from './tiles.js';
import { drawFull } from './farVersion.js';

/** Scene children that are vehicles (and trailers, the sprayer): they lose small parts and then their shadow with distance. */
export const VEHICLE_NAMES = ['quad', 'trailer', 'tipTrailer', 'sprayer'];
/** The barn's fixtures, drawn only within `barnPropsDistance`: the pegboard-and-rack clutter inside it that cannot be seen from outside. Never
 * anything standing outside the barn (the fuel tanks and the generator are in the yard and along the annex wall, and vanished at 15 m: #402);
 * tests/farDetail.test.js checks each one with a place in the layout is inside the barn. */
export const BARN_PROP_NAMES = ['tyreRack', 'sparesRack', 'batteryCharger', 'helmetHooks', 'jumperRack', 'axle-stand', 'trolley-jack'];
/**
 * Whole set pieces, drawn only within `setPieceDistance` of their nearest edge. The village and the neighbour's farm have a cheap far version
 * (`userData.farVersion`, world/farVersion.js) instead: always drawn, and swapped for the full one within `fullDistance`.
 */
export const SET_PIECE_NAMES = ['village', 'neighbourFarm', 'brushwood', 'logs', 'coneCourse', 'climbCones'];

const SMALL = 0.15; // m: a part with a bounding sphere smaller than this is a small part
const MARGIN = 5; // m: a vehicle crossing a distance has to come this far back before it changes again, so it doesn't flicker on the line
const FULL_MARGIN = 10; // m: the full version of a set piece holds this far past `fullDistance` once drawn, so the swap doesn't flicker on the line
const EVERY = 0.25; // s between looks at the scene

/** 0 near, 1 beyond the detail distance, 2 beyond the shadow distance; `was` gives the margin. A distance of 0 switches that level off. */
export function detailLevel(distance, params, was = 0) {
  const past = (d, level) => d > 0 && distance > (was >= level ? d - MARGIN : d);
  return past(params.shadowDistance, 2) ? 2 : past(params.vehicleDetailDistance, 1) ? 1 : 0;
}

/** Whether a part is small enough to leave out far away: not a light's lens or anything that glows, which show from a long way off. */
export function isSmallPart(mesh) {
  if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.name === 'lens' || mesh.userData.keepFar) return false;
  const geo = mesh.geometry;
  if (!geo) return false;
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  if (!(geo.boundingSphere.radius < SMALL)) return false;
  for (const m of [].concat(mesh.material)) if (m?.emissive && m.emissive.getHex() !== 0 && m.emissiveIntensity > 0) return false;
  return true;
}

export class FarDetail {
  constructor(scene, params) {
    this.scene = scene;
    this.params = params;
    this.clock = 0;
    this.vehicles = new WeakMap(); // object -> { level, small: [meshes hidden], shadows: [meshes that stopped casting] }
    this.hidden = new WeakSet(); // set pieces and props we have hidden (so we only show what we hid)
    this.boxes = new WeakMap();
    this.full = new WeakMap(); // set piece -> whether its full version is the one drawn
  }

  /** Looks at the scene from `position` every quarter second (always when `now`). */
  update(position, dt, now = false) {
    this.clock -= dt;
    if (!now && this.clock > 0) return;
    this.clock = EVERY;
    for (const o of this.scene.children) {
      if (VEHICLE_NAMES.includes(o.name)) this.vehicle(o, position);
      else if (BARN_PROP_NAMES.includes(o.name)) this.within(o, position, this.params.barnPropsDistance);
      else if (SET_PIECE_NAMES.includes(o.name) && o.userData.farVersion) this.swap(o, position);
      else if (SET_PIECE_NAMES.includes(o.name)) this.within(o, position, this.params.setPieceDistance);
    }
  }

  /** The ground bounds of an object's meshes, found once (set pieces and fixtures do not move). */
  box(o) {
    let b = this.boxes.get(o);
    if (!b) {
      o.updateWorldMatrix(true, true);
      const box = new THREE.Box3();
      o.traverse((m) => {
        if (!m.isMesh || !m.geometry) return;
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld));
      });
      b = box.isEmpty() ? { minX: o.position.x, maxX: o.position.x, minZ: o.position.z, maxZ: o.position.z } : { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z };
      this.boxes.set(o, b);
    }
    return b;
  }

  /** Draws the full `o` within `fullDistance` of its nearest edge and its far version beyond (with a margin, so it doesn't flicker); 0 is always full. */
  swap(o, position) {
    const full = drawFull(distanceToTile(this.box(o), position.x, position.z), this.params.fullDistance, this.full.get(o) ?? o.visible, FULL_MARGIN);
    this.full.set(o, full);
    o.visible = full;
    o.userData.farVersion.visible = !full;
  }

  /** Draws `o` only within `distance` metres of its nearest edge; 0 draws it always. */
  within(o, position, distance) {
    const far = distance > 0 && distanceToTile(this.box(o), position.x, position.z) > distance;
    if (far && o.visible) {
      o.visible = false;
      this.hidden.add(o);
    } else if (!far && !o.visible && this.hidden.has(o)) {
      o.visible = true;
      this.hidden.delete(o);
    }
  }

  /** A bolt's shadow cannot be told from the shadow of what it is bolted to, at any distance, so small parts never cast one. */
  dropSmallShadows(o) {
    o.traverse((m) => {
      if (m.isMesh && m.castShadow && isSmallPart(m)) m.castShadow = false;
    });
  }

  vehicle(o, position) {
    let s = this.vehicles.get(o);
    if (!s) {
      this.vehicles.set(o, (s = { level: 0, small: [], shadows: [] }));
      this.dropSmallShadows(o);
    }
    const level = detailLevel(Math.hypot(o.position.x - position.x, o.position.z - position.z), this.params, s.level);
    if (level === s.level) return;
    if (level >= 1 && !s.small.length) {
      o.traverse((m) => {
        if (m.visible && isSmallPart(m)) {
          m.visible = false;
          s.small.push(m);
        }
      });
    } else if (level < 1) {
      for (const m of s.small) if (!m.visible) m.visible = true;
      s.small.length = 0;
      this.dropSmallShadows(o); // parts fitted since
    }
    if (level >= 2 && !s.shadows.length) {
      o.traverse((m) => {
        if (m.isMesh && m.castShadow) {
          m.castShadow = false;
          s.shadows.push(m);
        }
      });
    } else if (level < 2) {
      for (const m of s.shadows) m.castShadow = true;
      s.shadows.length = 0;
    }
    s.level = level;
  }
}
