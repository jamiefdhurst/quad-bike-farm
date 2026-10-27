// What is left out far away: whole set pieces beyond a distance from their nearest edge, the barn's loose props beyond a short one, and for
// each vehicle its small parts (bolts, cables, decals, brake bits) and then its shadow. Close up nothing changes. See docs/decisions/performance.md,
// "Draw less far away (#365)", and any small mesh whose size on the screen has shrunk to a speck ("Parts too small to see (#451)"). The distances
// are in the graphics params (src/core/graphics.js).

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
export const SET_PIECE_NAMES = ['village', 'neighbourFarm', 'brushwood', 'logs', 'trailMarkers', 'coneCourse', 'climbCones', 'riverside', 'lineUpSleepers', 'quarrySite'];

const SMALL = 0.15; // m: a part with a bounding sphere smaller than this is a small part
const MARGIN = 5; // m: a vehicle crossing a distance has to come this far back before it changes again, so it doesn't flicker on the line
const FULL_MARGIN = 10; // m: the full version of a set piece holds this far past `fullDistance` once drawn, so the swap doesn't flicker on the line
const EVERY = 0.25; // s between looks at the scene
const SPECK_MARGIN = 1.25; // a part left out for its size comes back at this multiple of the size it went at, so it doesn't flicker on the line
const PARTS_MAX = 1.5; // m: a mesh with a bigger bounding sphere than this is never a speck (it would be under 1 point only past 1 km)
const REFIND = 20; // ticks between searches of a scene child for its small parts (a part fitted or taken off since)
/** Left-out parts are moved to this layer, which the camera does not draw (nor the sun's shadow pass): nothing else in the game uses layers or
 * is told about it, so a part it toggles with `visible` (a bowl, a tarp, a halo) is not fought over. */
export const SPECK_LAYER = 1;

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

/**
 * A hidden piece's matrices are not worked out every frame: the village and the neighbour's farm alone are over 2,000 objects, each composed and
 * multiplied by the renderer whether drawn or not (about 0.5 ms a frame, #442). They catch up in the frame the piece is shown. Anything that asks
 * for a hidden object's world position (`getWorldPosition`, `Box3.setFromObject`) updates its own chain, so only a direct read of a `matrixWorld`
 * under a hidden piece is out of date.
 */
export function skipMatricesWhileHidden(o) {
  const update = o.updateMatrixWorld;
  o.updateMatrixWorld = function (force) {
    if (this.visible) update.call(this, force);
  };
}

/** Screen points to a radian of the view, from the vertical field of view in degrees and the window's height in points. */
export function pixelsPerRadian(fov, height) {
  return height / 2 / Math.tan((fov * Math.PI) / 360);
}

/** How many screen points a sphere of `radius` metres spans (as a radius) at `distance`, with `pixelsPerRadian` points to a radian of the view. */
export function pointsAcross(radius, distance, pixelsPerRadian) {
  return distance > 0 ? (radius / distance) * pixelsPerRadian : Infinity;
}

/** Whether a part is a speck: under `threshold` points, and once it is it stays one until it is `SPECK_MARGIN` bigger. 0 switches it off. */
export function isSpeck(points, threshold, was = false) {
  return threshold > 0 && points < (was ? threshold * SPECK_MARGIN : threshold);
}

/** Whether a mesh can be left out for being small: not a skin, an instanced batch, a light's lens or a glow, which show from a long way off. */
function speckCandidate(mesh) {
  if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh || mesh.name === 'lens' || mesh.userData.keepFar || !mesh.geometry) return false;
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
    this.seen = new WeakSet(); // scene children already searched for small things
    this.small = []; // { mesh, off }: small shadow casters outside the vehicles, switched by their distance from you
    this.viewHeight = 0; // points: the window's height, unless set (the frame budget is counted as in a window of the same height wherever it runs)
    this.pixelsPerRadian = 0; // set from the camera and the window (World.update); 0 until then, which leaves nothing out
    this.specks = new WeakMap(); // scene child -> { parts: [{ mesh, off }], age }: its small meshes, left out while too small on the screen to see
    this.inside = new WeakMap(); // set piece -> the vehicles standing in it
    this.centre = new THREE.Vector3();
  }

  /** Looks at the scene from `position` every quarter second (always when `now`). */
  update(position, dt, now = false) {
    this.clock -= dt;
    if (!now && this.clock > 0) return;
    this.clock = EVERY;
    for (const o of this.scene.children) {
      if (VEHICLE_NAMES.includes(o.name)) this.vehicle(o, position);
      else if (BARN_PROP_NAMES.includes(o.name)) this.within(o, position, this.params.barnPropsDistance);
      else if (SET_PIECE_NAMES.includes(o.name) && o.userData.farVersion) {
        this.swap(o, position);
        if (o.visible) for (const v of this.vehiclesIn(o)) this.vehicle(v, position); // the vehicles standing in it are trimmed like those in the farm (#399)
      }
      else if (SET_PIECE_NAMES.includes(o.name)) this.within(o, position, this.params.setPieceDistance);
      else this.findSmall(o);
    }
    this.smallShadows(position);
    this.leaveOutSpecks(position);
  }

  /** The vehicles standing in a set piece (the village's parked quads), found once: they are not scene children, so the loop above does not reach them. */
  vehiclesIn(o) {
    let list = this.inside.get(o);
    if (!list) {
      list = [];
      o.traverse((m) => { if (m !== o && VEHICLE_NAMES.includes(m.name)) list.push(m); });
      this.inside.set(o, list);
    }
    return list;
  }

  /** Every small mesh that would span under `partPixels` points is moved to a layer nobody draws, and back as it grows. Not the set pieces (which
   * swap by distance and whose hidden matrices are not kept) and not the barn's props. */
  leaveOutSpecks(position) {
    const threshold = this.params.partPixels;
    const scale = this.pixelsPerRadian;
    const y = position.y ?? 0;
    for (const o of this.scene.children) {
      // A set piece with a far version is drawn, and so has current matrices, whenever its full version is (the village is static, so its small parts are
      // judged from where they stand).
      const drawnPiece = o.userData.farVersion && o.visible;
      if (o.isCamera || (SET_PIECE_NAMES.includes(o.name) && !drawnPiece) || BARN_PROP_NAMES.includes(o.name)) continue;
      let e = this.specks.get(o);
      if (!e || ++e.age > REFIND) e = this.findSpecks(o, e);
      for (const p of e.parts) {
        const m = p.mesh;
        let points = Infinity;
        if (threshold > 0 && scale > 0) {
          const geo = m.geometry; // swapped or changed since it was found: its sphere is worked out again
          if (!geo.boundingSphere) geo.computeBoundingSphere();
          const s = geo.boundingSphere;
          if (!s) continue;
          const c = this.centre.copy(s.center).applyMatrix4(m.matrixWorld);
          points = pointsAcross(s.radius * m.matrixWorld.getMaxScaleOnAxis(), Math.hypot(c.x - position.x, c.y - y, c.z - position.z), scale);
        }
        const off = isSpeck(points, threshold, p.off);
        if (off !== p.off) {
          m.layers.set(off ? SPECK_LAYER : 0);
          p.off = off;
        }
      }
    }
  }

  /** The small meshes of a scene child (kept as they were, so one that is out stays out until it is big enough), found again now and then. */
  findSpecks(o, was) {
    const e = { parts: [], age: 0 };
    const had = new Map((was?.parts ?? []).map((p) => [p.mesh, p]));
    o.traverse((m) => {
      if (!speckCandidate(m)) return;
      const geo = m.geometry;
      if (!geo.boundingSphere) geo.computeBoundingSphere();
      const prior = had.get(m);
      if (prior) {
        e.parts.push(prior);
        had.delete(m);
      } else if (geo.boundingSphere && geo.boundingSphere.radius * m.matrixWorld.getMaxScaleOnAxis() < PARTS_MAX) e.parts.push({ mesh: m, off: false });
    });
    for (const p of had.values()) if (p.off) p.mesh.layers.set(0); // taken off the vehicle: it is as it was if it goes back on
    this.specks.set(o, e);
    return e;
  }

  /** Notes the small shadow casters in a scene child the first time it is seen (mugs, bottles, tools, bolts on fixtures, the bench's clutter). */
  findSmall(o) {
    if (this.seen.has(o)) return;
    this.seen.add(o);
    o.traverse((m) => {
      if (m.isMesh && !m.isInstancedMesh && m.castShadow && isSmallPart(m)) this.small.push({ mesh: m, off: false });
    });
  }

  /** A small thing casts no shadow beyond `smallShadowDistance`: it cannot be told from the shadow of what it sits on. Close up nothing changes. */
  smallShadows(position) {
    const d = this.params.smallShadowDistance;
    const e = this.small;
    let n = 0;
    for (const s of e) {
      const m = s.mesh;
      let root = m;
      while (root.parent) root = root.parent;
      if (!root.isScene) {
        if (s.off) m.castShadow = true; // taken out of the scene: forget it, and leave it as it was if it is put back
        continue;
      }
      e[n++] = s;
      const x = m.matrixWorld.elements[12] - position.x;
      const z = m.matrixWorld.elements[14] - position.z;
      const far = d > 0 && Math.hypot(x, z) > (s.off ? d - MARGIN : d);
      if (far && !s.off && m.castShadow) {
        m.castShadow = false;
        s.off = true;
      } else if (!far && s.off) {
        m.castShadow = true;
        s.off = false;
      }
    }
    e.length = n;
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
      skipMatricesWhileHidden(o);
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
    const e = o.matrixWorld.elements; // world, since a vehicle in the village stands inside its group
    const level = detailLevel(Math.hypot(e[12] - position.x, e[14] - position.z), this.params, s.level);
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
