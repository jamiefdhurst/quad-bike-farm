// The one road mesh builder (#664): what every road laid over the ground is made of. A road is drawn from its points (world/roads.js): a strip of
// carriageway in the road's tarmac, its markings laid on it as decals, and a kerb or a worn verge edge. The lane, the village's street and its
// pavements all come through here, and so will Back Lane and the A-road.
//
// A road with `draw: 'ground'` (the farm road) is not a mesh: it is painted into the ground (world/groundTexture.js) so the mud, the rain, the
// frost and the snow that lie on the ground lie on it. It is still drawn from the same road data, and the same tarmac look.

import * as THREE from 'three';
import { dashes } from './roads.js';

/**
 * The tarmac as pixels, `size` square RGBA: speckle, a darker band down each wheel track, a pale gritty edge, and `patches` repairs (darker or paler
 * rectangles, a few cm of crack at their sides). Seeded, so a road looks the same every time. Pure, so it can be tested; roadTexture() puts it on a canvas.
 */
export function tarmacPixels({ size = 128, seed = 99, patches = 0, base = [0x43, 0x44, 0x46] } = {}) {
  const data = new Uint8ClampedArray(size * size * 4);
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = (rand() - 0.5) * 26;
      const u = x / size;
      const track = Math.exp(-(((u - 0.27) / 0.09) ** 2)) + Math.exp(-(((u - 0.73) / 0.09) ** 2)); // the wheel tracks, worn darker
      const edge = Math.max(0, 1 - Math.min(u, 1 - u) / 0.06) * 14; // the edges, paler and gritty
      const k = n - track * 9 + edge;
      const i = (y * size + x) * 4;
      data[i] = base[0] + k;
      data[i + 1] = base[1] + k;
      data[i + 2] = base[2] + k;
      data[i + 3] = 255;
    }
  }
  // Repairs: a rectangle across the middle of the road laid a shade off the surface round it, with a dark seam round its edge.
  for (let p = 0; p < patches; p++) {
    const w = Math.floor(size * (0.3 + rand() * 0.35));
    const h = Math.floor(size * (0.08 + rand() * 0.18));
    const x0 = Math.floor(size * 0.12 + rand() * (size * 0.76 - w));
    const y0 = Math.floor(rand() * (size - h));
    const shade = (rand() < 0.5 ? -1 : 1) * (7 + rand() * 7);
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const seam = x === x0 || x === x0 + w - 1 || y === y0 || y === y0 + h - 1;
        const i = (y * size + x) * 4;
        for (let c = 0; c < 3; c++) data[i + c] += seam ? -16 : shade;
      }
    }
  }
  return data;
}

/** The tarmac as a canvas (the textures of the lane and the village street): see tarmacPixels. */
export function roadTexture(opts = {}) {
  const size = opts.size ?? 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  img.data.set(tarmacPixels({ ...opts, size }));
  g.putImageData(img, 0, 0);
  return c;
}

export { dashes };

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * A point on a run of samples `s` along (in samples, about metres): where it is and which way it runs. `samples` are { x, z, tx, tz }.
 */
export function pointOn(samples, s) {
  const i = Math.max(0, Math.min(samples.length - 2, Math.floor(s)));
  const f = s - i;
  const a = samples[i];
  const b = samples[i + 1];
  return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, tx: a.tx + (b.tx - a.tx) * f, tz: a.tz + (b.tz - a.tz) * f };
}

/**
 * A strip along a run of `samples` ({ x, z, tx, tz }) from offset `a` to `b` across (positive is the right of the way it runs, looking along it
 * with z towards you), lying `lift` m over the ground (`heights.heightAt`), `cols` points across. The meshes come back (the caller adds them).
 *   from, to   the sample range it covers; `skip(p, i)` drops samples (a gap for a car park's mouth)
 *   flare      widen it by `flare.width` at the start, easing out over `flare.length` samples (a bellmouth)
 *   uv         texture repeats across
 *   clampX     stop at this x (a strip meeting another road stops at its edge); `lead` are samples laid out before the first so the slanting end squashes flat
 */
export function roadStrip({ samples, heights }, a, b, lift, material, { from = 0, to = Infinity, skip = null, flare = null, uv = 1, cols = 5, clampX = Infinity, lead = [] } = {}) {
  const at = (i) => (i < 0 ? lead[lead.length + i] : samples[i]);
  const runs = [];
  let run = null;
  [...lead, ...samples].forEach((p, n) => {
    const i = n - lead.length;
    const ok = (i >= from && i <= to && !(skip && skip(p, i))) || i < 0;
    if (ok) (run ??= []).push(i);
    else if (run) {
      runs.push(run);
      run = null;
    }
  });
  if (run) runs.push(run);
  const meshes = [];
  for (const r of runs) {
    if (r.length < 2) continue;
    const pos = [];
    const uvs = [];
    const idx = [];
    r.forEach((i, k) => {
      const p = at(i);
      const nx = -p.tz;
      const nz = p.tx;
      const widen = flare ? flare.width * (1 - smooth(clamp01(i / flare.length))) : 0;
      for (let c = 0; c < cols; c++) {
        const t = c / (cols - 1);
        const o = a + (b - a) * t + (flare ? (t - 0.5) * 2 * widen : 0);
        const x = Math.min(clampX, p.x + nx * o);
        const z = p.z + nz * o;
        pos.push(x, heights.heightAt(x, z) + lift, z);
        uvs.push(t * uv, i / 4);
      }
      if (k > 0) {
        for (let c = 0; c < cols - 1; c++) {
          const i0 = (k - 1) * cols + c;
          const i1 = k * cols + c;
          idx.push(i0, i0 + 1, i1, i0 + 1, i1 + 1, i1);
        }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true;
    m.userData.keep = true; // it follows the ground: merging would only bake what it is
    m.frustumCulled = false;
    meshes.push(m);
  }
  return meshes;
}

/**
 * Paint on a road, laid on the ground like the road itself and merged into one mesh: each mark is { s, len, a, b }, `len` m along the road about
 * sample position `s` and from offset `a` to `b` across. Null for no marks.
 */
export function paintMarks({ samples, heights }, marks, material, lift) {
  if (!marks.length) return null;
  const pos = [];
  const idx = [];
  for (const m of marks) {
    const base = pos.length / 3;
    for (const along of [m.s - m.len / 2, m.s + m.len / 2]) {
      const p = pointOn(samples, along);
      for (const o of [m.a, m.b]) {
        const x = p.x - p.tz * o;
        const z = p.z + p.tx * o;
        pos.push(x, heights.heightAt(x, z) + lift, z);
      }
    }
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, material);
  mesh.receiveShadow = true;
  mesh.userData.keep = true;
  mesh.frustumCulled = false;
  return mesh;
}

/** A vertical face along a run of samples at offset `off`, from `y0` to `y1` over the ground: a kerb. `from`, `skip` as for roadStrip. */
export function kerbFace({ samples, heights }, off, y0, y1, material, { from = 0, skip = null } = {}) {
  const pos = [];
  const idx = [];
  let n = 0;
  samples.forEach((p, i) => {
    if (i < from || (skip && skip(p, i))) {
      n = 0;
      return;
    }
    const x = p.x + -p.tz * off;
    const z = p.z + p.tx * off;
    const g = heights.heightAt(x, z);
    pos.push(x, g + y0, z, x, g + y1, z);
    if (n > 0) {
      const a = pos.length / 3 - 4;
      idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3, a + 2, a + 1, a, a + 3, a + 1, a + 2);
    }
    n++;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.userData.keep = true;
  m.frustumCulled = false;
  return m;
}

const POLY = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };

/**
 * A road with `draw: 'mesh'` from the network (world/roads.js) laid over the ground: its carriageway in the tarmac texture, `lift` m up, and its
 * centre line as dashes (`markings.centre: 'dashed'`, `dash: [on, off]`) and edge lines (`markings.edge`). A road with a kerb has its pavements and kerb built by its own set piece
 * (the village), through roadStrip and kerbFace above. Adds the meshes to `scene` and returns them.
 */
export function buildRoadMesh({ scene, road, points, heights, texture }) {
  const run = points ?? road.samples;
  const ctx = { samples: run, heights };
  const meshes = [];
  const body = new THREE.MeshStandardMaterial({ map: texture, color: 0xffffff, roughness: 0.92, ...POLY });
  meshes.push(...roadStrip(ctx, -road.halfWidth, road.halfWidth, road.lift ?? 0.07, body));
  if (road.markings.centre === 'dashed') {
    const [on, off] = road.dash ?? [3, 6];
    const line = new THREE.MeshStandardMaterial({ color: 0xcfcfc4, roughness: 0.9, ...POLY });
    const marks = paintMarks(ctx, dashes({ on, off, to: run[run.length - 1].s ?? run.length, width: road.lineWidth ?? 0.14 }), line, (road.lift ?? 0.07) + 0.02);
    if (marks) meshes.push(marks);
  }
  if (road.markings.edge) {
    const line = new THREE.MeshStandardMaterial({ color: 0xcfcfc4, roughness: 0.9, ...POLY });
    for (const side of [-1, 1]) meshes.push(...roadStrip(ctx, side * (road.halfWidth - 0.3), side * (road.halfWidth - 0.2), (road.lift ?? 0.07) + 0.02, line, { cols: 2 }));
  }
  for (const m of meshes) scene.add(m);
  return meshes;
}
