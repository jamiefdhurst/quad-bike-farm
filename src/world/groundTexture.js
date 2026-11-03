// Paints the farm's ground texture on a canvas: grass with blotchy variation, the neighbouring farmland beyond the hedges, the stubble
// fields and the tarmac road, the muddy track with ruts and puddles, and worn patches in the yard and gateways.

import { patchColor, patchBlend } from './patchwork.js';
import { createOutbuildings } from './outbuildings.js';

function rand(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function noiseCanvas(size, random, colorFn) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const [r, g, b, a] = colorFn(random());
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Tiling greyscale noise used as a close-up detail layer. */
export function createDetailCanvas(size = 256) {
  const random = rand(7);
  const coarse = noiseCanvas(32, random, (v) => {
    const g = 110 + v * 120;
    return [g, g, g, 255];
  });
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  // Draw the coarse layer tiled 3x3 so the smoothing wraps at the edges.
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) ctx.drawImage(coarse, i * size, j * size, size, size);
  }
  const fine = noiseCanvas(size, random, (v) => {
    const g = v * 255;
    return [g, g, g, 90];
  });
  ctx.drawImage(fine, 0, 0);
  return c;
}

/**
 * @param {object} opts
 * @param {number} opts.size        Canvas size in pixels.
 * @param {number} opts.worldSize   Metres covered by the canvas (centred on the origin).
 * @param {Track}  opts.track
 * @param {object} opts.layout
 * @param {object[]} opts.puddles   Puddle centres from the height model.
 */
export function createGroundCanvas({ size, worldSize, track, layout, fields, puddles, bogs = [], autumn = false }) {
  const random = rand(42);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const s = size / worldSize;
  const toPx = (x, z) => [(x + worldSize / 2) * s, (z + worldSize / 2) * s];

  // Grass base and blotches.
  ctx.fillStyle = '#5f7d3b';
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  const blotch = noiseCanvas(48, random, (v) => {
    const t = v;
    return [70 + t * 50, 100 + t * 45, 40 + t * 20, 120];
  });
  ctx.drawImage(blotch, 0, 0, size, size);
  const mid = noiseCanvas(256, random, (v) => [60 + v * 60, 90 + v * 60, 35 + v * 25, 70]);
  ctx.drawImage(mid, 0, 0, size, size);
  const fine = noiseCanvas(1024, random, (v) => (v > 0.5 ? [140, 160, 80, 40] : [30, 50, 20, 50]));
  ctx.drawImage(fine, 0, 0, size, size);

  if (fields) {
    paintPatchwork(ctx, size, worldSize, fields);
    paintStubble(ctx, toPx, s, fields, random);
    paintTarmac(ctx, toPx, s, layout, fields, random);
    if (fields.hill) paintHill(ctx, toPx, s, fields, random);
    if (fields.woods) paintWoods(ctx, toPx, s, fields, random, autumn);
    if (fields.quarry) paintQuarry(ctx, toPx, s, fields.quarry, rand(51));
  }

  // Worn yard and gateway.
  const wear = (x, z, r, color) => {
    const [px, pz] = toPx(x, z);
    const g = ctx.createRadialGradient(px, pz, 0, px, pz, r * s);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - r * s, pz - r * s, r * 2 * s, r * 2 * s);
  };
  const { yard, gate, fieldHalf } = layout;
  wear(yard.x, yard.z, yard.radius * 0.8, 'rgba(105,92,66,0.85)');
  wear(yard.x - 4, yard.z + 2, yard.radius * 0.45, 'rgba(92,80,58,0.7)');
  wear(gate.x, fieldHalf - 3, 7, 'rgba(90,72,48,0.8)');
  if (layout.road) wear(fieldHalf - 4, layout.road.z, 6, 'rgba(90,72,48,0.6)'); // the quads cut the corner onto the road
  paintOutbuildings(ctx, toPx, s, layout, rand(77), wear); // its own draws, leaving the rest of the ground as it was

  // Track.
  const pts = track.points;
  const strokeLoop = (offset, widthM, style, alpha = 1, blur = 0) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = style;
    ctx.lineWidth = widthM * s;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (blur) ctx.filter = `blur(${blur}px)`;
    ctx.beginPath();
    for (let i = 0; i <= pts.length; i++) {
      const a = pts[i % pts.length];
      const b = pts[(i + 1) % pts.length];
      const tx = b[0] - a[0];
      const tz = b[1] - a[1];
      const tl = Math.hypot(tx, tz) || 1;
      const [px, pz] = toPx(a[0] - (tz / tl) * offset, a[1] + (tx / tl) * offset);
      if (i === 0) ctx.moveTo(px, pz);
      else ctx.lineTo(px, pz);
    }
    ctx.stroke();
    ctx.restore();
  };
  const hw = layout.trackHalfWidth;
  strokeLoop(0, hw * 2 + 2.4, '#6e6440', 0.55, 6);
  strokeLoop(0, hw * 2 + 0.6, '#5b4a31', 0.9, 3);
  strokeLoop(0, hw * 2 - 0.4, '#54422b', 1, 1);
  strokeLoop(0, 1.0, '#4d3c27', 0.6, 2);
  // Grass strip between the ruts.
  strokeLoop(0, 0.35, '#5d6436', 0.35, 1);
  for (const off of [-0.7, 0.7]) {
    strokeLoop(off, 0.45, '#3b2c1c', 0.85, 1);
    strokeLoop(off, 0.15, '#2f2316', 0.7, 0);
  }

  // Mottling on the mud so it isn't a flat colour.
  for (let i = 0; i < 6000; i++) {
    const p = track.sample(random());
    const lat = (random() * 2 - 1) * hw;
    const [px, pz] = toPx(p.x - p.tz * lat, p.z + p.tx * lat);
    const r = (0.1 + random() * 0.35) * s;
    const dark = random() < 0.55;
    ctx.fillStyle = dark ? 'rgba(40,30,18,0.35)' : 'rgba(120,100,70,0.25)';
    ctx.beginPath();
    ctx.ellipse(px, pz, r * (1 + random()), r, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bogs: a churned, dark, wet patch with a ragged edge.
  for (const b of bogs) {
    const [px, pz] = toPx(b.x, b.z);
    const r = b.radius * 1.15 * s;
    const g = ctx.createRadialGradient(px, pz, 0, px, pz, r);
    g.addColorStop(0, 'rgba(30,22,13,0.97)');
    g.addColorStop(0.55, 'rgba(38,28,16,0.9)');
    g.addColorStop(0.8, 'rgba(52,40,24,0.55)');
    g.addColorStop(1, 'rgba(52,40,24,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - r, pz - r, r * 2, r * 2);
    for (let i = 0; i < 60; i++) {
      const a = random() * Math.PI * 2;
      const d = Math.sqrt(random()) * r * 0.8;
      ctx.fillStyle = random() < 0.5 ? 'rgba(20,14,8,0.5)' : 'rgba(70,55,35,0.35)';
      ctx.beginPath();
      ctx.ellipse(px + Math.cos(a) * d, pz + Math.sin(a) * d, (0.15 + random() * 0.4) * s, (0.08 + random() * 0.2) * s, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Puddle surrounds, darker and wetter.
  for (const p of puddles) {
    const [px, pz] = toPx(p.x, p.z);
    const r = layout.puddleRadius * 1.3 * s;
    const g = ctx.createRadialGradient(px, pz, 0, px, pz, r);
    g.addColorStop(0, 'rgba(38,28,18,0.95)');
    g.addColorStop(0.7, 'rgba(48,36,22,0.7)');
    g.addColorStop(1, 'rgba(48,36,22,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - r, pz - r, r * 2, r * 2);
  }

  return c;
}

/**
 * The hill through the south gate (world/hill.js): the pasture's rough, coarser and yellower than the grass field, browner under the
 * bracken; leaf litter in the wood; the lane's two worn wheel tracks with grass up the middle, muddy down to the ford; and the stream's bed,
 * dark silt along it and pale gravel where the ford is.
 */
function paintHill(ctx, toPx, s, fields, random) {
  const hill = fields.hill;
  const p = hill.pasture;
  const cell = (x, z, w, h, color) => {
    const [px, pz] = toPx(x, z);
    ctx.fillStyle = color;
    ctx.fillRect(px, pz, w * s, h * s);
  };
  for (let x = p.minX; x < p.maxX; x += 1) {
    for (let z = p.minZ; z < p.maxZ; z += 1) {
      const v = random();
      cell(x, z, 1, 1, `rgba(${130 + v * 40},${128 + v * 30},${60 + v * 20},0.22)`);
      const b = hill.brackenAt(x + 0.5, z + 0.5);
      if (b > 0) cell(x, z, 1, 1, `rgba(${88 + v * 30},${80 + v * 20},${42},${0.45 * b})`);
      if (hill.gorseAt(x + 0.5, z + 0.5) > 0.3) cell(x, z, 1, 1, 'rgba(50,62,30,0.35)');
    }
  }
  // Tussocks: little dark and light clumps.
  for (let i = 0; i < 9000; i++) {
    const x = p.minX + random() * (p.maxX - p.minX);
    const z = p.minZ + random() * (p.maxZ - p.minZ);
    const [px, pz] = toPx(x, z);
    ctx.fillStyle = random() < 0.5 ? 'rgba(45,60,25,0.35)' : 'rgba(170,165,95,0.3)';
    ctx.beginPath();
    ctx.ellipse(px, pz, (0.2 + random() * 0.3) * s, (0.15 + random() * 0.2) * s, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // The wood's floor, its edge ragged.
  const wood = hill.inWood;
  for (let x = p.minX; x < p.maxX; x += 0.5) {
    for (let z = p.minZ; z < p.maxZ; z += 0.5) {
      if (!wood(x, z, -2 + random() * 4)) continue;
      const v = random();
      cell(x, z, 0.5, 0.5, `rgba(${70 + v * 30},${52 + v * 20},${30 + v * 12},0.7)`);
    }
  }

  // The lane: two wheel tracks the length of it, worn bare, with the grass between; mud towards the ford.
  const lane = hill.lane;
  const end = hill.farEdge(lane.x) + 3;
  for (let z = hill.top - 2; z < end; z += 0.25) {
    for (const off of [-0.75, 0.75]) {
      const muddy = Math.min(1, Math.max(0, (z - (hill.streamZ(lane.x) - 12)) / 8));
      const [px, pz] = toPx(lane.x + off + (random() - 0.5) * 0.1, z);
      ctx.fillStyle = muddy > 0.2 ? `rgba(60,45,28,${0.75 + 0.2 * muddy})` : 'rgba(110,92,62,0.8)';
      ctx.beginPath();
      ctx.ellipse(px, pz, (0.32 + random() * 0.1) * s, 0.2 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (hill.west) paintPaddocks(ctx, toPx, s, hill, random);

  // The stream's bed: silt along it, the ford's gravel pale and stony.
  for (let x = p.minX - 3; x < p.maxX + 3; x += 0.5) {
    const sz = hill.streamZ(x);
    const half = hill.halfAt(x);
    for (let z = sz - half - 1; z < sz + half + 1; z += 0.5) {
      const r = Math.abs(z - sz) / (half + 1);
      const ford = Math.abs(x - lane.x) < lane.halfWidth + 2.5;
      const v = random();
      const color = ford ? `rgba(${120 + v * 40},${110 + v * 35},${90 + v * 30},${0.9 - r * 0.4})` : `rgba(${50 + v * 20},${42 + v * 15},${30 + v * 10},${0.95 - r * 0.5})`;
      cell(x, z, 0.5, 0.5, color);
    }
  }
  // Stones in the ford.
  for (let i = 0; i < 500; i++) {
    const x = lane.x + (random() - 0.5) * (lane.halfWidth * 2 + 5);
    const z = hill.streamZ(x) + (random() - 0.5) * hill.halfAt(x) * 2.2;
    const [px, pz] = toPx(x, z);
    ctx.fillStyle = random() < 0.5 ? 'rgba(165,155,135,0.8)' : 'rgba(85,78,65,0.7)';
    ctx.beginPath();
    ctx.ellipse(px, pz, (0.05 + random() * 0.1) * s, (0.04 + random() * 0.08) * s, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * The two fields beside the lane: rough grazing like the pasture's but greener, the wet meadow's sedgy patches and the pond's silt, and the mud
 * of the track in to the water and round the gateways (hill.mudAt).
 */
function paintPaddocks(ctx, toPx, s, hill, random) {
  const cell = (x, z, w, h, color) => {
    const [px, pz] = toPx(x, z);
    ctx.fillStyle = color;
    ctx.fillRect(px, pz, w * s, h * s);
  };
  for (const r of [hill.west, hill.east]) {
    for (let x = r.minX; x < r.maxX; x += 1) {
      for (let z = r.minZ; z < r.maxZ; z += 1) {
        const v = random();
        cell(x, z, 1, 1, `rgba(${110 + v * 30},${124 + v * 30},${56 + v * 20},0.2)`);
        // Mud in soft daubs, so the edge of a track or a shore is not a row of squares.
        for (let k = 0; k < 2; k++) {
          const mx = x + random();
          const mz = z + random();
          const m = hill.mudAt(mx, mz);
          if (m < 0.1) continue;
          const [px, pz] = toPx(mx, mz);
          ctx.fillStyle = `rgba(${62 + v * 14},${46 + v * 10},${30 + v * 8},${Math.min(0.85, m * 0.9)})`;
          ctx.beginPath();
          ctx.ellipse(px, pz, (0.5 + random() * 0.4) * s, (0.5 + random() * 0.4) * s, random() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    for (let i = 0; i < 3000; i++) {
      const x = r.minX + random() * (r.maxX - r.minX);
      const z = r.minZ + random() * (r.maxZ - r.minZ);
      const [px, pz] = toPx(x, z);
      ctx.fillStyle = random() < 0.5 ? 'rgba(45,62,28,0.32)' : 'rgba(165,160,95,0.28)';
      ctx.beginPath();
      ctx.ellipse(px, pz, (0.2 + random() * 0.3) * s, (0.15 + random() * 0.2) * s, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Rushes in dark patches round the pond, the silt of its bed under the water.
  const pond = hill.pond;
  for (let x = pond.x - pond.rx * 1.4; x < pond.x + pond.rx * 1.4; x += 0.5) {
    for (let z = pond.z - pond.rz * 1.4; z < pond.z + pond.rz * 1.4; z += 0.5) {
      const r = Math.hypot((x - pond.x) / pond.rx, (z - pond.z) / pond.rz);
      const v = random();
      if (r < 0.75) cell(x, z, 0.5, 0.5, `rgba(${46 + v * 18},${40 + v * 14},${30 + v * 8},0.95)`);
      else if (r < 1.3 && v < 0.5) cell(x, z, 0.5, 0.5, `rgba(${52 + v * 20},${70 + v * 20},${34},${0.5 * (1.3 - r)})`);
    }
  }
}

/**
 * The wood through the north gate (world/woods.js): a floor of leaf litter, darker and browner than the grass field, patched with moss and
 * bare earth; the Hollow Run and its lead-in worn into a narrow dark track with two ruts and a grass strip between; the pond's silt and rushes.
 */
function paintWoods(ctx, toPx, s, fields, random, autumn = false) {
  const woods = fields.woods;
  const r = woods.rect;
  const half = woods.halfWidth;
  const cell = (x, z, w, h, color) => {
    const [px, pz] = toPx(x, z);
    ctx.fillStyle = color;
    ctx.fillRect(px, pz, w * s, h * s);
  };
  for (let x = r.minX; x < r.maxX; x += 0.5) {
    for (let z = r.minZ; z < r.maxZ; z += 0.5) {
      const v = random();
      const moss = 0.5 + 0.5 * Math.sin(x * 0.19 + z * 0.13) * Math.sin(z * 0.17 - x * 0.11);
      if (moss > 0.62 && v < 0.6) cell(x, z, 0.5, 0.5, `rgba(${52 + v * 20},${72 + v * 22},${34 + v * 10},0.6)`);
      else cell(x, z, 0.5, 0.5, `rgba(${72 + v * 34},${58 + v * 24},${36 + v * 14},0.6)`);
    }
  }
  // Fallen leaves in drifts, and bare patches where the roots are.
  // In autumn there are three times as many, in oranges, golds and reds (autumn.js).
  const AUTUMN_LEAVES = ['rgba(196,98,26,0.5)', 'rgba(214,140,36,0.5)', 'rgba(150,48,22,0.45)', 'rgba(200,170,60,0.45)'];
  for (let i = 0; i < (autumn ? 21000 : 7000); i++) {
    const [px, pz] = toPx(r.minX + random() * (r.maxX - r.minX), r.minZ + random() * (r.maxZ - r.minZ));
    if (autumn) ctx.fillStyle = random() < 0.85 ? AUTUMN_LEAVES[Math.floor(random() * AUTUMN_LEAVES.length)] : 'rgba(40,32,20,0.35)';
    else ctx.fillStyle = random() < 0.6 ? 'rgba(150,104,48,0.3)' : 'rgba(40,32,20,0.35)';
    ctx.beginPath();
    ctx.ellipse(px, pz, (0.2 + random() * 0.5) * s, (0.12 + random() * 0.25) * s, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // The track: the circuit (closed) and the lead-in from the gate (open), each stroked in layers like the main track but narrower and darker.
  const lines = [{ pts: woods.track.points, closed: true }, { pts: woods.leadIn, closed: false }];
  const stroke = (line, offset, widthM, style, alpha, blur) => {
    const list = line.pts;
    const count = line.closed ? list.length : list.length - 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = style;
    ctx.lineWidth = widthM * s;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (blur) ctx.filter = `blur(${blur}px)`;
    ctx.beginPath();
    for (let i = 0; i <= count; i++) {
      const a = list[i % list.length];
      const b = list[(i + 1) % list.length];
      const c = list[(i - 1 + list.length) % list.length];
      // Offset along the normal of the way on (the previous segment at the very end of an open line).
      const from = i < count || line.closed ? a : c;
      const to = i < count || line.closed ? b : a;
      const tx = to[0] - from[0];
      const tz = to[1] - from[1];
      const tl = Math.hypot(tx, tz) || 1;
      const [px, pz] = toPx(a[0] - (tz / tl) * offset, a[1] + (tx / tl) * offset);
      if (i === 0) ctx.moveTo(px, pz);
      else ctx.lineTo(px, pz);
    }
    ctx.stroke();
    ctx.restore();
  };
  // The Fern Trail (painted first, so the Hollow Run's wider bed lies over it where they cross): a single-track path of packed pale earth worn through the litter, a ribbon of bare ground with a faint dark edge and a
  // dusting of leaves on it, no ruts. Painted roots cross it where the real ones lie.
  const tr = woods.trail;
  if (tr) {
    const th = woods.trailHalf;
    const line = { pts: woods.trailTrack.points, closed: true };
    stroke(line, 0, th * 2 + 1.3, '#3d3020', 0.4, 5);
    stroke(line, 0, th * 2 + 0.3, '#6b5738', 0.95, 2);
    stroke(line, 0, th * 2 - 0.5, '#7d6844', 0.9, 2);
    stroke(line, 0, 0.5, '#8a7650', 0.55, 1);
    stroke(line, 0, 0.35, '#4c5a2c', 0.18, 1);
    for (const dip of tr.dips) {
      // The dips are darker, damp earth.
      for (let k = -dip.len / 2; k < dip.len / 2; k += 0.25) {
        const p = woods.trailAt(dip.at + k);
        const [px, pz] = toPx(p.x, p.z);
        ctx.fillStyle = 'rgba(44,34,22,0.14)';
        ctx.beginPath();
        ctx.ellipse(px, pz, (th + 0.2) * s, 0.8 * s, Math.atan2(p.tx, -p.tz), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (let i = 0; i < 1800; i++) {
      const p = woods.trailAt(random() * woods.trailTrack.totalLength);
      const lat = (random() * 2 - 1) * th;
      const [px, pz] = toPx(p.x - p.tz * lat, p.z + p.tx * lat);
      const rr = (0.05 + random() * 0.16) * s;
      ctx.fillStyle = random() < 0.5 ? 'rgba(60,46,28,0.3)' : autumn ? 'rgba(190,110,30,0.4)' : 'rgba(150,104,48,0.3)';
      ctx.beginPath();
      ctx.ellipse(px, pz, rr * (1 + random()), rr, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // Roots: the ones with bodies, and a few more only painted, running off the path into the litter.
    const rootLine = (x, z, yaw, len, wide) => {
      const [x0, z0] = toPx(x - Math.cos(yaw) * len / 2, z + Math.sin(yaw) * len / 2);
      const [x1, z1] = toPx(x + Math.cos(yaw) * len / 2, z - Math.sin(yaw) * len / 2);
      for (const [width, style] of [[wide * 1.6, 'rgba(24,16,8,0.45)'], [wide, 'rgba(92,70,46,0.9)'], [wide * 0.35, 'rgba(140,114,82,0.6)']]) {
        ctx.strokeStyle = style;
        ctx.lineWidth = width * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0, z0);
        ctx.lineTo(x1, z1);
        ctx.stroke();
      }
    };
    for (const root of tr.roots) rootLine(root.x, root.z, root.yaw, root.len, root.r * 2);
    for (let i = 0; i < 70; i++) {
      const p = woods.trailAt(random() * woods.trailTrack.totalLength);
      const yaw = Math.atan2(-p.tx, -p.tz) + (random() - 0.5) * 1.2;
      const lat = (random() * 2 - 1) * (th + 0.8);
      rootLine(p.x - p.tz * lat, p.z + p.tx * lat, yaw, 0.7 + random() * 1.3, 0.05 + random() * 0.05);
    }
  }
  for (const line of lines) {
    stroke(line, 0, half * 2 + 2, '#4a3d28', 0.5, 6);
    stroke(line, 0, half * 2 + 0.4, '#3f3222', 0.92, 3);
    stroke(line, 0, half * 2 - 0.4, '#392c1c', 1, 1);
    stroke(line, 0, 0.5, '#4c5a2c', 0.4, 1);
    for (const off of [-0.55, 0.55]) {
      stroke(line, off, 0.38, '#251b10', 0.85, 1);
      stroke(line, off, 0.12, '#1c140b', 0.7, 0);
    }
  }
  // Mottling on the mud, and roots across the track here and there.
  for (let i = 0; i < 3500; i++) {
    const p = woods.track.sample(random());
    const lat = (random() * 2 - 1) * half;
    const [px, pz] = toPx(p.x - p.tz * lat, p.z + p.tx * lat);
    const rr = (0.08 + random() * 0.3) * s;
    ctx.fillStyle = random() < 0.55 ? 'rgba(25,18,10,0.35)' : 'rgba(110,86,56,0.25)';
    ctx.beginPath();
    ctx.ellipse(px, pz, rr * (1 + random()), rr, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // The pond: silt on the bed, rushes round it.
  const pond = woods.pond;
  if (pond) {
    for (let x = pond.x - pond.rx * 1.4; x < pond.x + pond.rx * 1.4; x += 0.5) {
      for (let z = pond.z - pond.rz * 1.4; z < pond.z + pond.rz * 1.4; z += 0.5) {
        const rr = Math.hypot((x - pond.x) / pond.rx, (z - pond.z) / pond.rz);
        const v = random();
        if (rr < 0.75) cell(x, z, 0.5, 0.5, `rgba(${40 + v * 16},${36 + v * 12},${28 + v * 8},0.95)`);
        else if (rr < 1.3 && v < 0.5) cell(x, z, 0.5, 0.5, `rgba(${50 + v * 20},${68 + v * 20},${34},${0.5 * (1.3 - rr)})`);
      }
    }
  }
}

/**
 * The gravel pit (world/quarry.js): a rough, scrubby field round it; the walls in bands of buff, orange, grey and pale sand (a band is a depth,
 * so they run level round the bowl with a wobble, as strata do), loose scree at the toe and where the chutes are; a floor of packed grey-brown
 * with the haul road worn bare and pale with two ruts; the heaps, grey gravel or buff sand; the pond's silt and the damp round its shore.
 */
function paintQuarry(ctx, toPx, s, quarry, random) {
  const r = quarry.rect;
  const pit = quarry.pit;
  const cell = (x, z, w, h, color) => {
    const [px, pz] = toPx(x, z);
    ctx.fillStyle = color;
    ctx.fillRect(px, pz, w * s, h * s);
  };
  // The field: dry rough grass gone to dock and bare patches, browner than the farm's.
  for (let x = r.minX; x < r.maxX; x += 1) {
    for (let z = r.minZ; z < r.maxZ; z += 1) {
      const v = random();
      const dry = 0.5 + 0.5 * Math.sin(x * 0.13 + z * 0.09) * Math.sin(z * 0.11 - x * 0.07 + 1);
      if (dry > 0.45) cell(x, z, 1, 1, `rgba(${118 + v * 40},${112 + v * 34},${66 + v * 20},${0.25 + 0.3 * dry})`);
    }
  }
  const STRATA = [[201, 184, 138], [186, 140, 84], [158, 152, 138], [216, 207, 178], [174, 150, 104]];
  const step = 0.18; // about two pixels at the ground texture's ten a metre, so the grit is finer than the texel and no block shows
  // Cells a little bigger than their spacing and knocked off the grid, so the ground reads as grit and not as squares.
  const grit = (x, z, color) => cell(x + (random() - 0.5) * step, z + (random() - 0.5) * step, step * 1.7, step * 1.7, color);
  for (let x = pit.x - quarry.reachMax - 3; x < pit.x + quarry.reachMax + 3; x += step) {
    for (let z = pit.z - quarry.reachMax - 3; z < pit.z + quarry.reachMax + 3; z += step) {
      const { a, s: dist } = quarry.polar(x, z);
      const rim = quarry.rimAt(a);
      if (dist > rim + 2.5) continue;
      const v = random();
      const cut = quarry.bowlCut(x, z);
      const u = (rim - dist) / quarry.runAt(a);
      let c;
      let alpha = 0.98;
      if (u >= 1) {
        // The floor: packed, with stones.
        const g = 120 + v * 28;
        c = [g + 12, g + 4, g - 14];
      } else if (u <= 0) {
        // The lip: raw ground showing through the grass.
        c = [176 + v * 20, 160 + v * 18, 112 + v * 14];
        alpha = 0.9 * (1 - Math.min(1, -u * (quarry.runAt(a) / 2.5)));
      } else {
        const band = Math.floor(cut * 0.85 + 0.9 * Math.sin(a * 5 + cut * 0.4) + 0.5 * Math.sin(a * 13 + 2) + v * 0.35);
        const base = STRATA[((band % STRATA.length) + STRATA.length) % STRATA.length];
        const scree = smoothScree(u);
        const m = 0.86 + v * 0.22;
        c = [base[0] * m * (1 - 0.2 * scree) + 30 * scree, base[1] * m * (1 - 0.2 * scree) + 26 * scree, base[2] * m * (1 - 0.2 * scree) + 20 * scree];
      }
      grit(x, z, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`);
    }
  }
  // Stones speckled over the walls and floor, flints and grey.
  for (let i = 0; i < 26000; i++) {
    const a = random() * Math.PI * 2;
    const dist = Math.sqrt(random()) * (quarry.rimAt(a) + 1);
    const p = quarry.frameAt(a, dist);
    const [px, pz] = toPx(p.x, p.z);
    ctx.fillStyle = random() < 0.4 ? 'rgba(236,230,214,0.5)' : random() < 0.5 ? 'rgba(88,84,78,0.5)' : 'rgba(150,120,80,0.45)';
    ctx.beginPath();
    ctx.ellipse(px, pz, (0.05 + random() * 0.14) * s, (0.04 + random() * 0.1) * s, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // The heaps.
  for (const h of pit.heaps) {
    const sand = h.kind === 'sand';
    for (let x = h.x - h.r; x < h.x + h.r; x += step) {
      for (let z = h.z - h.r; z < h.z + h.r; z += step) {
        const d = Math.hypot(x - h.x, z - h.z) / h.r;
        if (d > 1) continue;
        const v = random();
        const m = 0.85 + v * 0.3 + 0.12 * (1 - d);
        grit(x, z, sand ? `rgba(${(214 * m) | 0},${(190 * m) | 0},${(134 * m) | 0},0.95)` : `rgba(${(138 * m) | 0},${(135 * m) | 0},${(130 * m) | 0},0.95)`);
      }
    }
  }
  // The haul road: bare pale gravel, with two darker ruts and a fringe of dust.
  const roads = [quarry.roadPoints, quarry.rampPoints];
  const road = roads.flat();
  const stroke = (offset, widthM, style, alpha, blur = 0) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = style;
    ctx.lineWidth = widthM * s;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (blur) ctx.filter = `blur(${blur}px)`;
    for (const pts of roads) {
      ctx.beginPath();
      pts.forEach((pt, i) => {
        const b = pts[Math.min(i + 1, pts.length - 1)];
        const a = pts[Math.max(i - 1, 0)];
        const tl = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        const [px, pz] = toPx(pt.x - ((b.z - a.z) / tl) * offset, pt.z + ((b.x - a.x) / tl) * offset);
        if (i) ctx.lineTo(px, pz);
        else ctx.moveTo(px, pz);
      });
      ctx.stroke();
    }
    ctx.restore();
  };
  const w = quarry.roadHalf * 2;
  stroke(0, w + 1.6, '#b9aa86', 0.55, 5);
  stroke(0, w, '#c8bb98', 0.92, 2);
  for (const off of [-0.8, 0.8]) stroke(off, 0.5, '#8d8064', 0.7, 1);
  stroke(0, 0.3, '#a89c7e', 0.5, 1);
  // Gravel and dust flecks along the haul road.
  for (let i = 0; i < 9000; i++) {
    const pt = road[Math.floor(random() * road.length)];
    const [px, pz] = toPx(pt.x + (random() - 0.5) * w * 1.1, pt.z + (random() - 0.5) * w * 1.1);
    ctx.fillStyle = random() < 0.5 ? 'rgba(238,232,214,0.6)' : 'rgba(96,86,68,0.5)';
    ctx.beginPath();
    ctx.ellipse(px, pz, (0.04 + random() * 0.09) * s, (0.03 + random() * 0.07) * s, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // The gateway, worn.
  const [gx, gz] = toPx(quarry.gate.x, r.maxZ - 2);
  const gr = ctx.createRadialGradient(gx, gz, 0, gx, gz, 6 * s);
  gr.addColorStop(0, 'rgba(110,92,62,0.85)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(gx - 6 * s, gz - 6 * s, 12 * s, 12 * s);
  // The pond: silt on the bed, a damp dark fringe on the shore.
  const pond = pit.pond;
  for (let x = pond.x - pond.rx * 1.5; x < pond.x + pond.rx * 1.5; x += step) {
    for (let z = pond.z - pond.rz * 1.5; z < pond.z + pond.rz * 1.5; z += step) {
      const rr = Math.hypot((x - pond.x) / pond.rx, (z - pond.z) / pond.rz);
      const v = random();
      if (rr < 0.8) grit(x, z, `rgba(${86 + v * 18},${78 + v * 14},${58 + v * 10},0.97)`);
      else if (rr < 1.4) grit(x, z, `rgba(${70 + v * 20},${64 + v * 14},${44 + v * 10},${(0.7 * (1.4 - rr)) / 0.6})`);
    }
  }
}

/** 0..1 how much scree there is `u` of the way down a bank: none at the top, loose stone over the lower part. */
function smoothScree(u) {
  const t = Math.min(1, Math.max(0, (u - 0.45) / 0.5));
  return t * t * (3 - 2 * t);
}

/** The neighbouring farmland beyond the farm's hedges, at 2 m a pixel, fading in from the grass a few metres out (as the outer ring does). */
function paintPatchwork(ctx, size, worldSize, fields) {
  const n = Math.ceil(worldSize / 2);
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const pctx = c.getContext('2d');
  const img = pctx.createImageData(n, n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -worldSize / 2 + (i + 0.5) * (worldSize / n);
      const z = -worldSize / 2 + (j + 0.5) * (worldSize / n);
      const blend = patchBlend(fields.outside(x, z));
      const o = (j * n + i) * 4;
      if (blend <= 0) continue;
      const col = patchColor(x, z, 1);
      img.data[o] = col[0] * 255;
      img.data[o + 1] = col[1] * 255;
      img.data[o + 2] = col[2] * 255;
      img.data[o + 3] = blend * 215; // the grass's own blotches still show through a little
    }
  }
  pctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c, 0, 0, size, size);
}

/**
 * The stubble fields, each as layout.stubbleFields has it: its straw colour with darker drill rows every half metre the way it was drilled,
 * the odd bare or weedy patch, and the tramlines (the sprayer's wheel lines, two dark stripes 1.8 m apart) every British arable field has.
 * The north field's hollow is damper: darker, with more green coming through.
 */
function paintStubble(ctx, toPx, s, fields, random) {
  for (const key of ['north', 'south']) {
    const r = fields.areas[key];
    if (!r) continue;
    const f = fields.stubbleField(key) ?? { rows: 'x', tramlines: 24, ground: '#b3a06a' };
    const [x0, z0] = toPx(r.minX, r.minZ);
    const [x1, z1] = toPx(r.maxX, r.maxZ);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, z0, x1 - x0, z1 - z0);
    ctx.clip();
    ctx.fillStyle = f.ground;
    ctx.fillRect(x0, z0, x1 - x0, z1 - z0);
    // Blotches: a little greener where it's weedy, browner where the combine left it thin.
    for (let i = 0; i < 450; i++) {
      const x = r.minX + random() * (r.maxX - r.minX);
      const z = r.minZ + random() * (r.maxZ - r.minZ);
      const [px, pz] = toPx(x, z);
      const rad = (1.5 + random() * 5) * s;
      const g = ctx.createRadialGradient(px, pz, 0, px, pz, rad);
      const tint = random() < 0.35 ? '120,130,70' : random() < 0.5 ? '150,125,80' : '205,190,140';
      g.addColorStop(0, `rgba(${tint},0.35)`);
      g.addColorStop(1, `rgba(${tint},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(px - rad, pz - rad, rad * 2, rad * 2);
    }
    // The hollow: damp ground, darker, with weeds coming through.
    if (f.hollow) {
      const [hx, hz] = toPx(f.hollow.x, f.hollow.z);
      ctx.save();
      ctx.translate(hx, hz);
      ctx.scale(f.hollow.rx * s, f.hollow.rz * s);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, 'rgba(92,96,58,0.6)');
      g.addColorStop(0.55, 'rgba(110,108,68,0.35)');
      g.addColorStop(1, 'rgba(110,108,68,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
    // Drill rows, and tramlines from 12 m in from the field's edge, both running the way it was drilled.
    const alongX = f.rows !== 'z';
    const line = (at) => {
      ctx.beginPath();
      if (alongX) {
        const [, pz] = toPx(0, at);
        ctx.moveTo(x0, pz);
        ctx.lineTo(x1, pz);
      } else {
        const [px] = toPx(at, 0);
        ctx.moveTo(px, z0);
        ctx.lineTo(px, z1);
      }
      ctx.stroke();
    };
    const [lo, hi] = alongX ? [r.minZ, r.maxZ] : [r.minX, r.maxX];
    ctx.strokeStyle = 'rgba(110,95,55,0.35)';
    ctx.lineWidth = Math.max(1, 0.12 * s);
    for (let a = lo + 0.25; a < hi; a += 0.5) line(a);
    ctx.strokeStyle = 'rgba(105,90,58,0.75)';
    ctx.lineWidth = 0.45 * s;
    for (let a = lo + 12; a < hi - 6; a += f.tramlines) for (const off of [-0.9, 0.9]) line(a + off);
    ctx.restore();
  }
}

/**
 * The ground at the buildings out east (outbuildings.js): the Dutch barn's floor bare and trodden, littered with straw, worn out onto the
 * hardstanding; the field shed's earth floor and its doorway; a dark stain round the muck heap; and the ground poached round the trough.
 */
function paintOutbuildings(ctx, toPx, s, layout, random, wear) {
  const ob = createOutbuildings(layout);
  const floor = (r, color) => {
    const [x0, z0] = toPx(r.minX, r.minZ);
    const [x1, z1] = toPx(r.maxX, r.maxZ);
    ctx.fillStyle = color;
    ctx.fillRect(x0, z0, x1 - x0, z1 - z0);
  };
  if (ob.barn) {
    const r = ob.barn.outer;
    floor({ minX: r.minX - 0.3, maxX: r.maxX + 0.3, minZ: r.minZ - 0.3, maxZ: r.maxZ + 0.3 }, 'rgba(112,100,78,0.75)');
    floor(r, 'rgba(98,86,66,0.8)');
    const a = ob.apron;
    floor(a, 'rgba(108,94,70,0.55)');
    for (let i = 0; i < 30; i++) wear(a.minX + 1 + random() * (a.maxX - a.minX - 2), a.minZ + random() * (a.maxZ - a.minZ), 1.5 + random() * 2, 'rgba(100,86,62,0.5)');
    for (let i = 0; i < 450; i++) {
      const x = r.minX + random() * (r.maxX - r.minX);
      const z = r.minZ + random() * (r.maxZ - r.minZ + 1.5);
      const [px, pz] = toPx(x, z);
      const a = random() * Math.PI;
      const len = (0.1 + random() * 0.25) * s;
      ctx.strokeStyle = `rgba(${190 + random() * 30},${160 + random() * 30},${90 + random() * 30},${0.2 + random() * 0.3})`;
      ctx.lineWidth = Math.max(1, 0.02 * s);
      ctx.beginPath();
      ctx.moveTo(px, pz);
      ctx.lineTo(px + Math.cos(a) * len, pz + Math.sin(a) * len);
      ctx.stroke();
    }
  }
  if (ob.shed) {
    floor(ob.shed.inner, 'rgba(78,66,50,0.9)');
    wear((ob.shed.door.minX + ob.shed.door.maxX) / 2, ob.shed.door.z + 1.2, 2.8, 'rgba(88,74,52,0.9)');
  }
  const m = layout.muckHeap;
  if (m) {
    const [hx, hz] = toPx(m.x, m.z);
    ctx.save();
    ctx.translate(hx, hz);
    ctx.scale((m.halfX + 1.6) * s, (m.halfZ + 1.6) * s);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(60,46,30,0.95)');
    g.addColorStop(0.7, 'rgba(70,56,36,0.7)');
    g.addColorStop(1, 'rgba(70,56,36,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
  const t = layout.trough;
  if (t) {
    // On the field side, where the cattle stand to drink (the hedge is behind it).
    wear(t.x, t.z - 1, 3.2, 'rgba(84,66,44,0.9)');
    wear(t.x + 0.6, t.z - 1.3, 1.8, 'rgba(66,50,32,0.8)');
  }
}

/** The farm road and its hardstanding: dark grey tarmac, speckled, a little lighter where the wheels run, with crumbling edges. */
function paintTarmac(ctx, toPx, s, layout, fields, random) {
  const road = layout.road;
  if (!road) return;
  const shape = (grow) => {
    ctx.beginPath();
    const [ax, az] = toPx(road.fromX - grow, road.z - road.halfWidth - grow);
    const [bx, bz] = toPx(road.toX + grow, road.z + road.halfWidth + grow);
    ctx.rect(ax, az, bx - ax, bz - az);
    if (road.pad) {
      const [px, pz] = toPx(road.pad.x, road.z);
      ctx.moveTo(px + (road.pad.radius + grow) * s, pz);
      ctx.arc(px, pz, (road.pad.radius + grow) * s, 0, Math.PI * 2);
    }
  };
  // A worn, gritty margin where the edge has broken up into the verge.
  ctx.fillStyle = 'rgba(95,88,70,0.6)';
  shape(0.25);
  ctx.fill();
  ctx.fillStyle = '#4b4a47';
  shape(0);
  ctx.fill();
  ctx.save();
  shape(0);
  ctx.clip();
  // Speckle: the stone in the tarmac.
  const minX = road.fromX;
  const maxX = Math.max(road.toX, road.pad ? road.pad.x + road.pad.radius : road.toX);
  const reach = road.pad ? road.pad.radius : road.halfWidth;
  const area = (maxX - minX) * reach * 2;
  for (let i = 0; i < area * 6; i++) {
    const x = minX + random() * (maxX - minX);
    const z = road.z + (random() * 2 - 1) * reach;
    if (fields.tarmacAt(x, z) < 0.5) continue;
    const [px, pz] = toPx(x, z);
    ctx.fillStyle = random() < 0.5 ? 'rgba(120,118,112,0.5)' : 'rgba(35,35,34,0.5)';
    ctx.fillRect(px, pz, Math.max(1, 0.08 * s), Math.max(1, 0.08 * s));
  }
  // Polished a little lighter where the wheels run, about 1.6 m apart.
  ctx.strokeStyle = 'rgba(120,118,110,0.18)';
  ctx.lineWidth = 0.5 * s;
  for (const off of [-0.8, 0.8]) {
    const [ax, az] = toPx(road.fromX, road.z + off);
    const [bx] = toPx(road.toX, road.z + off);
    ctx.beginPath();
    ctx.moveTo(ax, az);
    ctx.lineTo(bx, az);
    ctx.stroke();
  }
  ctx.restore();
  // Bites out of the edge.
  for (let x = road.fromX; x < road.toX; x += 1.5 + random() * 4) {
    for (const side of [-1, 1]) {
      if (random() < 0.5) continue;
      if (fields.tarmacAt(x, road.z + side * (road.halfWidth + 0.4)) > 0.5) continue; // across the hardstanding, there's no edge
      const [px, pz] = toPx(x, road.z + side * (road.halfWidth + 0.05));
      ctx.fillStyle = 'rgba(95,88,70,0.8)';
      ctx.beginPath();
      ctx.ellipse(px, pz, (0.2 + random() * 0.5) * s, (0.08 + random() * 0.15) * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
