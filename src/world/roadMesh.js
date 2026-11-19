// The one road mesh builder (#664): what every road laid over the ground is made of. A road is drawn from its points (world/roads.js): a strip of
// carriageway in the road's tarmac, its markings laid on it as decals, and a kerb or a worn verge edge. The lane, the village's street and its
// pavements all come through here, and so will Back Lane and the A-road.
//
// A road with `draw: 'ground'` (the farm road) is not a mesh: it is painted into the ground (world/groundTexture.js) so the mud, the rain, the
// frost and the snow that lie on the ground lie on it. It is still drawn from the same road data, and the same tarmac look.

import * as THREE from 'three';
import { dashes } from './roads.js';
import { canvasTexture } from './outbuildingProps.js';

/**
 * The tarmac as pixels, `size` square RGBA: speckle, a darker band down each wheel track, a pale gritty edge, and `patches` repairs (darker or paler
 * rectangles, a few cm of crack at their sides). Seeded, so a road looks the same every time. Pure, so it can be tested; roadTexture() puts it on a canvas.
 */
export function tarmacPixels({ size = 128, seed = 99, patches = 0, base = [0x43, 0x44, 0x46], bands = 0, crumble = 0 } = {}) {
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
  // Tar bands: thin dark seams across the road where cracks were sealed, one a little off square. Crumbling edges: the verge's green and grit creeping in
  // along each side in irregular bites up to `crumble` of the width. Both draw after the rest, so a road that has neither is the same pixels.
  for (let b = 0; b < bands; b++) {
    const y0 = Math.floor(rand() * size);
    const lean = (rand() - 0.5) * 0.12;
    for (let x = 0; x < size; x++) {
      const y = (y0 + Math.round(x * lean) + size) % size;
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) data[i + c] -= 22;
    }
  }
  if (crumble > 0) {
    for (let y = 0; y < size; y++) {
      for (const side of [0, 1]) {
        const bite = Math.floor(rand() * rand() * crumble * size);
        for (let k = 0; k < bite; k++) {
          const x = side ? size - 1 - k : k;
          const i = (y * size + x) * 4;
          data[i] = 0x4a + rand() * 14;
          data[i + 1] = 0x52 + rand() * 18;
          data[i + 2] = 0x38 + rand() * 10;
        }
      }
    }
  }
  return data;
}

/**
 * Gravel and mud washed out across a gateway onto the road, `size` square RGBA: grey and brown grit over churned mud, darker in ruts, its edges fading to
 * nothing in noise so it lies on the ground without a border. Seeded, pure.
 */
export function washPixels({ size = 64, seed = 21 } = {}) {
  const data = new Uint8ClampedArray(size * size * 4);
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const edge = Math.min(u, 1 - u, v, 1 - v) * 2; // 0 at the border, 1 in the middle
      const rut = Math.exp(-(((u - 0.3) / 0.07) ** 2)) + Math.exp(-(((u - 0.7) / 0.07) ** 2));
      const grit = rand();
      const i = (y * size + x) * 4;
      const mud = 0.55 + rut * 0.3 - grit * 0.15;
      data[i] = grit > 0.82 ? 150 : 92 * mud + 20;
      data[i + 1] = grit > 0.82 ? 146 : 76 * mud + 18;
      data[i + 2] = grit > 0.82 ? 138 : 58 * mud + 12;
      data[i + 3] = Math.max(0, Math.min(255, (edge * 3.2 - 0.35 - rand() * 0.55) * 255));
    }
  }
  return data;
}

/** The wash as a canvas: see washPixels (painted a pixel at a time, as it is small and made once for each gate). */
export function washTexture(opts = {}) {
  const size = opts.size ?? 64;
  return canvasTexture(size, size, (ctx) => {
    const px = washPixels({ ...opts, size });
    for (let i = 0; i < size * size; i++) {
      ctx.fillStyle = `rgba(${px[i * 4]},${px[i * 4 + 1]},${px[i * 4 + 2]},${px[i * 4 + 3] / 255})`;
      ctx.fillRect(i % size, Math.floor(i / size), 1, 1);
    }
  });
}

/** The grass strip down the middle of a little-used lane as pixels, `size` square RGBA: blades in two greens with the odd bare grit fleck. Seeded, pure. */
export function grassStripPixels({ size = 64, seed = 7 } = {}) {
  const data = new Uint8ClampedArray(size * size * 4);
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < size * size; i++) {
    const t = rand();
    const grit = rand() < 0.04;
    data[i * 4] = grit ? 0x70 : 0x3a + t * 26;
    data[i * 4 + 1] = grit ? 0x6a : 0x54 + t * 34;
    data[i * 4 + 2] = grit ? 0x5a : 0x26 + t * 16;
    data[i * 4 + 3] = 255;
  }
  return data;
}

/** The grass strip as a canvas: see grassStripPixels. */
export function grassStripTexture(opts = {}) {
  const size = opts.size ?? 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  img.data.set(grassStripPixels({ ...opts, size }));
  g.putImageData(img, 0, 0);
  return c;
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

/** How much a crowned road is raised `o` m from its middle (a parabola: `height` at the middle, nothing at `half`). */
export const crownAt = (crown, o) => (Math.abs(o) >= crown.half ? 0 : crown.height * (1 - (o / crown.half) ** 2));
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

 *   crown      { height, half }: the road's camber, raised `height` m in the middle and falling to nothing `half` m out each side
 *   clampX     stop at this x (a strip meeting another road stops at its edge); `lead` are samples laid out before the first so the slanting end squashes flat
 */
export function roadStrip({ samples, heights }, a, b, lift, material, { from = 0, to = Infinity, skip = null, flare = null, uv = 1, cols = 5, clampX = Infinity, lead = [], crown = null } = {}) {
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
        pos.push(x, heights.heightAt(x, z) + lift + (crown ? crownAt(crown, o) : 0), z);
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
export function paintMarks({ samples, heights }, marks, material, lift, crown = null) {
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
        pos.push(x, heights.heightAt(x, z) + lift + (crown ? crownAt(crown, o) : 0), z);
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
  const lift = road.lift ?? 0.07;
  const crown = road.camber ? { height: road.camber, half: road.halfWidth } : null;
  const body = new THREE.MeshStandardMaterial({ map: texture, color: 0xffffff, roughness: 0.92, ...POLY });
  const bell = road.bellmouth ?? null;
  const junctionEnds = road.junctions ?? [];
  const bellEnd = bell ? (junctionEnds[0]?.end ?? 'start') : null;
  // The carriageway. A road with a bellmouth is laid from its junction end with the mouth flared; the end that is the junction is the start of `run`
  // (or, for a road that ends on another, its reverse), so the one strip builder serves both.
  if (bell && bellEnd === 'end') meshes.push(...roadStrip({ samples: reversed(run), heights }, -road.halfWidth, road.halfWidth, lift, body, { flare: bell, crown }));
  else meshes.push(...roadStrip(ctx, -road.halfWidth, road.halfWidth, lift, body, { flare: bell, crown }));
  if (road.markings.centre === 'dashed') {
    const [on, off] = road.dash ?? [3, 6];
    const line = new THREE.MeshStandardMaterial({ color: 0xcfcfc4, roughness: 0.9, ...POLY });
    const marks = paintMarks(ctx, dashes({ on, off, from: bell ? bell.length : 0, to: run[run.length - 1].s ?? run.length, width: road.lineWidth ?? 0.14 }), line, lift + 0.02, crown);
    if (marks) meshes.push(marks);
  }
  if (road.markings.edge) {
    const line = new THREE.MeshStandardMaterial({ color: 0xcfcfc4, roughness: 0.9, ...POLY });
    // The edge lines stop for a side road's mouth: `edgeBreaks` are the junctions' s and half-widths, and a road's own bellmouth.
    const breaks = road.edgeBreaks ?? [];
    const skip = (p, i) => breaks.some((b) => Math.abs((p.s ?? i) - b.s) < b.half) || (bell && junctionEnds.some((j) => (j.end === 'start' ? i < bell.length : i > run.length - 1 - bell.length)));
    for (const side of [-1, 1]) meshes.push(...roadStrip(ctx, side * (road.halfWidth - 0.3), side * (road.halfWidth - 0.2), lift + 0.02, line, { cols: 2, crown, skip }));
  }
  // A strip of grass down the middle where the lane is least used (`strip: { half, rects }`: the rectangles, [minX, minZ, maxX, maxZ], it grows in).
  if (road.strip && road.strip.texture) {
    const grass = new THREE.MeshStandardMaterial({ map: road.strip.texture, color: 0xffffff, roughness: 1, ...POLY });
    const inside = (p) => road.strip.rects.some(([x0, z0, x1, z1]) => p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1);
    meshes.push(...roadStrip(ctx, -road.strip.half, road.strip.half, lift + 0.015, grass, { skip: (p) => !inside(p) }));
  }
  // Passing places: each widens the carriageway on its side by `bay` m for `length` m (the road's `bays`, roads.js), in the same tarmac, a hair above the road's
  // own strip so the two meet without a seam, and with a gritty edge where it meets the verge.
  // A bus bay (`layBys`, the A-road's) is the same widening, `width` m deep.
  for (const b of [...(road.bays ?? []), ...(road.layBys ?? []).map((l) => ({ ...l, bay: l.width }))]) {
    const from = Math.floor(b.s - b.length / 2);
    const to = Math.ceil(b.s + b.length / 2);
    const [a, z] = b.side > 0 ? [-(road.halfWidth + b.bay), -road.halfWidth + 0.1] : [road.halfWidth - 0.1, road.halfWidth + b.bay]; // roadStrip's offsets run the other way round from a side's
    meshes.push(...roadStrip(ctx, a, z, lift + 0.004, body, { from, to, cols: 3 }));
  }
  // Give-way lines (`markings.giveWay`: true for both ends, 'start' or 'end' for one): a double row of dashes across the road, `markings.giveWayAt` m (3 if none) in from the end, which a road joining a wider road sets to clear its edge, for
  // traffic leaving onto another road, and a white triangle painted in the way in (`giveWayMarks`).
  if (road.markings.giveWay) {
    const line = new THREE.MeshStandardMaterial({ color: 0xcfcfc4, roughness: 0.9, ...POLY });
    const lines = paintMarks(ctx, giveWayMarks(road, run), line, lift + 0.02);
    if (lines) meshes.push(lines);
  }
  if (bell) meshes.push(...bellmouthKerbs({ samples: bellEnd === 'end' ? reversed(run) : run, heights }, road, lift, bellEnd === 'end'));
  for (const m of meshes) scene.add(m);
  return meshes;
}

/** `samples` the other way round (as a road that ends on another is read from its junction): the order and the way each points. */
export function reversed(samples) {
  const end = samples[samples.length - 1].s ?? samples.length - 1;
  return samples.map((p) => ({ ...p, tx: -p.tx, tz: -p.tz, s: end - (p.s ?? 0) })).reverse();
}

/**
 * The marks of a road's give-way lines, `{ s, len, a, b }` each (paintMarks): two rows of dashes across at 3 m from the end that is its junction, and the
 * painted triangle, its wide edge at the line's back and its point towards the driver, 5 m long, in the way in (the left of the way you come in by).
 * `markings.giveWay` is true (the two ends), 'start' or 'end'.
 */
export function giveWayMarks(road, run) {
  const gw = road.markings.giveWay;
  const gap = road.markings.giveWayAt ?? 3;
  const total = run[run.length - 1].s ?? run.length;
  const ends = gw === true ? ['start', 'end'] : [gw];
  const marks = [];
  for (const end of ends) {
    const dir = end === 'start' ? 1 : -1; // along the road, away from the junction
    const at = (d) => (end === 'start' ? d : total - d); // s of a point `d` m from the junction end
    for (const off of [0, 0.45]) {
      for (let a = -road.halfWidth + 0.2; a < road.halfWidth - 0.4; a += 0.6) marks.push({ s: at(gap + off), len: 0.3, a, b: a + 0.35 });
    }
    // The way in keeps left as it comes to the junction: that is the +offset side of a road whose junction is its start, the -offset side where it is its end.
    const lane = end === 'start' ? 1 : -1;
    if (road.markings.triangle !== false && road.halfWidth >= 2) {
      const mid = lane * road.halfWidth * 0.5;
      for (let d = 0; d < 5; d += 0.35) {
        const w = 0.9 * (1 - d / 5); // half the width, narrowing to the point
        marks.push({ s: at(gap + 3.5 + d + 0.175), len: 0.35, a: mid - w, b: mid + w });
      }
    }
  }
  return marks;
}

/** Low kerbs along the flared edges of a bellmouth: a pale concrete block on each side, its top 11 cm over the road, following the flare. */
export function bellmouthKerbs({ samples, heights }, road, lift, reverse) {
  void reverse;
  const bell = road.bellmouth;
  const mat = new THREE.MeshStandardMaterial({ color: 0xb4b2aa, roughness: 0.95 });
  const out = [];
  for (const side of [-1, 1]) {
    const pos = [];
    const idx = [];
    const last = Math.min(samples.length - 1, Math.ceil(bell.length));
    for (let i = 0; i <= last; i++) {
      const p = samples[i];
      const widen = bell.width * (1 - smooth(clamp01(i / bell.length)));
      for (const o of [road.halfWidth + widen, road.halfWidth + widen + 0.16]) {
        const x = p.x - p.tz * side * o;
        const z = p.z + p.tx * side * o;
        const g = heights.heightAt(x, z);
        pos.push(x, g + lift, z, x, g + lift + 0.11, z); // foot then top, at this offset
      }
      if (i > 0) {
        const k = i * 4;
        const q = (i - 1) * 4;
        // road-side face, top, outer face
        idx.push(q, q + 1, k, q + 1, k + 1, k, q + 1, q + 3, k + 1, q + 3, k + 3, k + 1, q + 3, q + 2, k + 3, q + 2, k + 2, k + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.material.side = THREE.DoubleSide;
    m.receiveShadow = true;
    m.userData.keep = true;
    m.frustumCulled = false;
    out.push(m);
  }
  return out;
}
