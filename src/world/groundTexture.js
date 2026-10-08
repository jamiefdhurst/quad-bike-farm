// Paints the farm's ground texture on a canvas: grass with blotchy variation, the neighbouring farmland beyond the hedges, the stubble
// fields and the tarmac road, the muddy track with ruts and puddles, and worn patches in the yard and gateways.

import { patchColor, patchBlend } from './patchwork.js';
import { outsideRect } from './fields.js';

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
export function createGroundCanvas({ size, worldSize, track, layout, fields, puddles, bogs = [] }) {
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
      const blend = patchBlend(outsideRect(fields.farm, x, z));
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
    for (let i = 0; i < 900; i++) {
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
  const maxX = road.pad ? road.pad.x + road.pad.radius : road.toX;
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
      const [px, pz] = toPx(x, road.z + side * (road.halfWidth + 0.05));
      ctx.fillStyle = 'rgba(95,88,70,0.8)';
      ctx.beginPath();
      ctx.ellipse(px, pz, (0.2 + random() * 0.5) * s, (0.08 + random() * 0.15) * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
