import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { BANTAM_WHEELS } from '../src/vehicle/bantamBody.js';
import { buildAllModels } from './helpers/vehicleModels.js';

// Nothing on the old bike floats (#345): every visible part is within 6 mm of another part, and all of them join up into one
// machine. Each mesh's surface is sampled every few millimetres (in the model's frame, wheels where the game puts them, the bars straight);
// meshes whose samples come within `JOIN` of one another are one piece. The decals a millimetre off the tank and the headlamp's faked beam are left out.

const JOIN = 0.006;
const SAMPLE = 0.004;

function surfacePoints(mesh) {
  const g = mesh.geometry;
  const pos = g.attributes.position;
  const idx = g.index;
  const m = mesh.matrixWorld;
  const out = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const p = new THREE.Vector3();
  const tris = idx ? idx.count / 3 : pos.count / 3;
  for (let t = 0; t < tris; t++) {
    const [i, j, k] = idx ? [idx.getX(t * 3), idx.getX(t * 3 + 1), idx.getX(t * 3 + 2)] : [t * 3, t * 3 + 1, t * 3 + 2];
    a.fromBufferAttribute(pos, i).applyMatrix4(m);
    b.fromBufferAttribute(pos, j).applyMatrix4(m);
    c.fromBufferAttribute(pos, k).applyMatrix4(m);
    const n = Math.min(12, Math.max(1, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / SAMPLE)));
    for (let u = 0; u <= n; u++) {
      for (let v = 0; v <= n - u; v++) {
        p.set(0, 0, 0).addScaledVector(a, 1 - (u + v) / n).addScaledVector(b, u / n).addScaledVector(c, v / n);
        out.push(p.x, p.y, p.z);
      }
    }
  }
  return out;
}

describe('the old bike’s parts are joined up', () => {
  let parts;
  beforeAll(async () => {
    const bike = (await buildAllModels()).find((v) => v.id === 'plover').model;
    bike.getObjectByName('wheel_fl').position.set(0, BANTAM_WHEELS.radius, BANTAM_WHEELS.frontZ);
    bike.getObjectByName('wheel_rl').position.set(0, BANTAM_WHEELS.radius, BANTAM_WHEELS.rearZ);
    bike.updateMatrixWorld(true);
    parts = [];
    bike.traverse((o) => {
      if (!o.isMesh || !o.visible || /beam|halo|proxy|tankPanel|badge|numberPlate/i.test(o.name)) return;
      if (o.material?.transparent || o.material?.visible === false) return;
      const where = [];
      for (let q = o.parent; q && q.name !== 'quad'; q = q.parent) if (q.name) where.push(q.name);
      const box = new THREE.Box3().setFromObject(o);
      if (where[0] === 'spin' && box.max.y - box.min.y > 0.55) return; // the tyre: a hollow shell round the rim, which sits inside it rather than touching its surface
      parts.push({ name: `${o.name || '(unnamed)'} in ${where.join('/')} at ${box.min.toArray().map((v) => v.toFixed(2))}..${box.max.toArray().map((v) => v.toFixed(2))}`, pts: surfacePoints(o) });
    });
  });

  it('has every part touching another, in one piece', () => {
    // Union-find over a hash of the samples.
    const root = parts.map((_, i) => i);
    const find = (i) => (root[i] === i ? i : (root[i] = find(root[i])));
    const cells = new Map();
    const key = (x, y, z) => `${x},${y},${z}`;
    parts.forEach((part, pi) => {
      for (let i = 0; i < part.pts.length; i += 3) {
        const cx = Math.floor(part.pts[i] / JOIN);
        const cy = Math.floor(part.pts[i + 1] / JOIN);
        const cz = Math.floor(part.pts[i + 2] / JOIN);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          for (const [other, x, y, z] of cells.get(key(cx + dx, cy + dy, cz + dz)) ?? []) {
            if (other !== pi && Math.hypot(x - part.pts[i], y - part.pts[i + 1], z - part.pts[i + 2]) <= JOIN) root[find(other)] = find(pi);
          }
        }
        const own = cells.get(key(cx, cy, cz)) ?? [];
        own.push([pi, part.pts[i], part.pts[i + 1], part.pts[i + 2]]);
        cells.set(key(cx, cy, cz), own);
      }
    });
    const groups = new Map();
    parts.forEach((p, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), p.name]));
    const sizes = [...groups.values()].sort((a, b) => b.length - a.length);
    const loose = sizes.slice(1).map((g) => g.join(', '));
    expect(loose, `pieces not joined to the main one: ${loose.join(' | ')}`).toEqual([]);
  });
});
