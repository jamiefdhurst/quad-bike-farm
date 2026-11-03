// Collects boxes, tubes and the like per material and builds one merged mesh each, so a whole machine is a few draw calls (the pit's props use
// it; the vehicles' detail kit is a different thing, in src/vehicle/detail).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { worldBox } from './outbuildingProps.js';

const UP = new THREE.Vector3(0, 1, 0);

/** A transform from a position and a turn about y (and a tilt about z, if wanted). */
export const placement = (x, y, z, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));

export class Parts {
  constructor() {
    this.byMaterial = new Map();
  }

  /** Adds `geo` (a fresh geometry) in `material`, placed by position and the Euler rotation (x, y, z) in radians. */
  add(material, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1)));
    if (!this.byMaterial.has(material)) this.byMaterial.set(material, []);
    this.byMaterial.get(material).push(geo);
    return this;
  }

  box(material, w, h, d, x, y, z, ry = 0, tile = 2, tileV = tile) {
    return this.add(material, worldBox(w, h, d, tile, tileV), x, y, z, 0, ry, 0);
  }

  /**
   * A box whose texture carries on across its neighbours: the long faces take their u from where the box stands (and v from its height, in
   * `tileV` metres a tile), so a ribbed wall cut into pieces round its windows keeps its ribs in line and its rust at the foot. `alongZ` is for a
   * wall whose length runs along z (an end wall), the long faces then being the +x and -x ones.
   */
  wall(material, w, h, d, x, y, z, tile = 1, tileV = tile, alongZ = false) {
    const geo = worldBox(w, h, d, tile, tileV);
    const uv = geo.getAttribute('uv');
    const dv = (y - h / 2) / tileV;
    if (alongZ) {
      for (let i = 0; i < 4; i++) uv.setXY(i, uv.getX(i) - (z + d / 2) / tile, uv.getY(i) + dv); // +x, u runs along -z
      for (let i = 4; i < 8; i++) uv.setXY(i, uv.getX(i) + (z - d / 2) / tile, uv.getY(i) + dv); // -x, u runs along +z
    } else {
      for (let i = 16; i < 20; i++) uv.setXY(i, uv.getX(i) + (x - w / 2) / tile, uv.getY(i) + dv); // +z, u runs along +x
      for (let i = 20; i < 24; i++) uv.setXY(i, uv.getX(i) - (x + w / 2) / tile, uv.getY(i) + dv); // -z, u runs along -x
    }
    return this.add(material, geo, x, y, z);
  }

  /** A beam from a to b (in the x-y plane, at depth z), `h` thick, `d` wide. */
  beam(material, ax, ay, bx, by, h, d, z = 0, tile = 2) {
    const len = Math.hypot(bx - ax, by - ay);
    return this.add(material, worldBox(len, h, d, tile), (ax + bx) / 2, (ay + by) / 2, z, 0, 0, Math.atan2(by - ay, bx - ax));
  }

  /** A cylinder with its axis along z (a wheel, a roller, a pin). */
  wheel(material, r, width, x, y, z, segments = 14) {
    return this.add(material, new THREE.CylinderGeometry(r, r, width, segments), x, y, z, Math.PI / 2, 0, 0);
  }

  /** A cylinder from point a to point b (arrays of x, y, z), radius r at a and r2 at b. */
  rod(material, a, b, r, r2 = r, segments = 8) {
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(r2, r, len, segments);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
    return this.add(material, geo, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  }

  /** A flat profile (points [x, y]) pushed out `depth` along z, centred on z = 0: a plate, a bucket's side, a counterweight. */
  extrude(material, points, depth, x = 0, y = 0, z = 0, ry = 0) {
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(points.map((p) => new THREE.Vector2(p[0], p[1]))), { depth, bevelEnabled: false, steps: 1 });
    geo.translate(0, 0, -depth / 2);
    return this.add(material, geo, x, y, z, 0, ry, 0);
  }

  /** Adds all of another set of parts, moved by `matrix`, so a door or a window built on its own hinge becomes part of the same few meshes. */
  merge(other, matrix) {
    for (const [material, geos] of other.byMaterial) {
      if (!this.byMaterial.has(material)) this.byMaterial.set(material, []);
      for (const g of geos) this.byMaterial.get(material).push(g.clone().applyMatrix4(matrix));
    }
    return this;
  }

  /** The parts as a group of meshes, one per material. */
  build({ castShadow = true } = {}) {
    const group = new THREE.Group();
    for (const [material, geos] of this.byMaterial) {
      const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g)); // an extrusion is not indexed and a box is, and a merge wants them alike
      const mesh = new THREE.Mesh(mergeGeometries(flat, false), material);
      mesh.name = material.name || '';
      mesh.castShadow = castShadow && !material.transparent; // glass and decals cast no shadow, which also saves a draw call in the sun's pass
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }
}
