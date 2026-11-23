// Poured concrete painted for a tile `metres` square. Every tile has the mottling, small oil and diesel stains with halos, grit, hairline cracks between the joints
// and joints every 4 m, all from noise-edged polygons and strokes, never a circle or an oval. A 4 m tile (a village path) repeats every few metres and wraps, so
// it has only those. A 16 m tile (the neighbour's yard, in cells of four different ones) adds a patched square, a dragged smear, tread marks, blade scrapes
// and a swept patch, and is cut at its edge, which is a joint. The drain's damp and slime and the wear are in `paintSlabWear`, placed on the slab.

const TAU = Math.PI * 2;
const JOINT = 4; // m between joints

/** Radius factors for a ragged outline: `rough` 0..1 how far the edge wanders. */
export function raggedFactors(random, rough, n = 18) {
  return Array.from({ length: n }, () => 1 - rough + random() * rough * 1.4);
}

/** A ragged outline: `n` points round (x, y) at radius r times a noise factor, joined smoothly. The radius factors `k` come from `raggedFactors`, so every copy of one stain has one shape. */
export function raggedPath(ctx, k, x, y, rx, ry, rot) {
  const n = k.length;
  const pts = k.map((m, i) => {
    const a = (i / n) * TAU;
    const px = Math.cos(a) * rx * m;
    const py = Math.sin(a) * ry * m;
    return [x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot)];
  });
  ctx.beginPath();
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[n - 1], pts[0]);
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  ctx.closePath();
}

export function paintConcrete(ctx, px, metres, random) {
  const M = metres;
  const k = px / M;
  const area = M * M;
  // A small tile repeats every few metres, so it carries only what could be anywhere (mottling, small stains, grit, cracks) and wraps, so it joins itself.
  // A big tile is one bay of a slab whose neighbours take other tiles, so it keeps its marks inside and is cut at its edge, which is a joint.
  const repeats = M <= 8;
  const cells = Math.max(1, Math.floor(M / JOINT));
  const rnd = (a, b) => a + random() * (b - a);
  const count = (perSquareMetre) => Math.max(1, Math.round(perSquareMetre * area));
  ctx.save();
  ctx.scale(k, k);
  /** Runs `draw(dx, dy)` at the mark's place and, near an edge, at the wrapped place too, so the tile joins to itself. */
  const wrapped = (x, y, reach, draw) => {
    for (const dx of repeats ? [-M, 0, M] : [0]) for (const dy of repeats ? [-M, 0, M] : [0]) {
      const X = x + dx;
      const Y = y + dy;
      if (X > -reach && X < M + reach && Y > -reach && Y < M + reach) draw(X, Y);
    }
  };
  const stain = (x, y, rx, ry, rot, rgb, alpha, halo = 1.7, rough = 0.35) => {
    const k = raggedFactors(random, rough);
    const reach = Math.max(rx, ry) * halo * (1 + rough * 0.5);
    wrapped(x, y, reach, (X, Y) => {
      for (const [scale, a] of [[halo, alpha * 0.16], [(halo + 1) / 2, alpha * 0.24], [1, alpha]]) { // a pale ring of seepage, then the stain
        ctx.fillStyle = `rgba(${rgb},${a})`;
        raggedPath(ctx, k, X, Y, rx * scale, ry * scale, rot);
        ctx.fill();
      }
    });
  };
  const line = (pts, width, style) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const dx of repeats ? [-M, 0, M] : [0]) for (const dy of repeats ? [-M, 0, M] : [0]) {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy)));
      ctx.stroke();
    }
  };
  const wander = (x, y, heading, length, step, bend) => { // a path that drifts as it goes
    const pts = [[x, y]];
    for (let d = 0; d < length; d += step) {
      heading += rnd(-bend, bend);
      x += Math.cos(heading) * step;
      y += Math.sin(heading) * step;
      pts.push([x, y]);
    }
    return pts;
  };

  ctx.fillStyle = '#9d9b94';
  ctx.fillRect(0, 0, M, M);
  // Mottling: broad, faint, paler and darker pours.
  for (let i = 0; i < count(0.5); i++) stain(rnd(0, M), rnd(0, M), rnd(0.5, 2.2), rnd(0.4, 1.6), rnd(0, 3), random() < 0.5 ? '70,68,62' : '214,210,198', rnd(0.04, 0.09), 1.3, 0.6);

  if (!repeats) {
    // One square of newer, paler concrete, patched in.
    const pc = Math.floor(random() * cells);
    const pr = Math.floor(random() * cells);
    ctx.fillStyle = 'rgba(206,203,192,0.5)';
    ctx.fillRect(pc * JOINT + 0.06, pr * JOINT + 0.06, JOINT - 0.12, JOINT - 0.12);
    ctx.strokeStyle = 'rgba(45,43,40,0.5)';
    ctx.lineWidth = 0.03;
    ctx.strokeRect(pc * JOINT + 0.3, pr * JOINT + 0.4, JOINT - 0.7, JOINT - 0.9); // the saw-cut round the repair
    // The swept patch: short pale strokes all one way, as a broom leaves a dry-brushed floor.
    const sx = rnd(0, M);
    const sy = rnd(0, M);
    const sweep = rnd(0, 3);
    for (let i = 0; i < count(5); i++) {
      const a = rnd(0, TAU);
      const d = Math.sqrt(random()) * rnd(1.5, 2.6);
      const x = sx + Math.cos(a) * d;
      const y = sy + Math.sin(a) * d * 0.6;
      line([[x, y], [x + Math.cos(sweep) * rnd(0.3, 0.9), y + Math.sin(sweep) * rnd(0.3, 0.9)]], 0.02, `rgba(226,222,210,${rnd(0.1, 0.25)})`);
    }

  }
  // Oil and diesel where a vehicle stood: a ragged stain with its halo, a few drops that fell past it, and now and then one that was dragged.
  for (let i = 0; i < Math.max(3, count(0.2)); i++) {
    const x = rnd(0, M);
    const y = rnd(0, M);
    const diesel = random() < 0.35;
    const rgb = diesel ? '58,50,34' : '20,18,16';
    stain(x, y, rnd(0.15, 0.5), rnd(0.12, 0.34), rnd(0, 3), rgb, rnd(0.3, 0.5), 2, 0.5);
    for (let d = 0; d < 2 + random() * 5; d++) stain(x + rnd(-0.6, 0.6), y + rnd(-0.6, 0.6), rnd(0.02, 0.07), rnd(0.02, 0.06), rnd(0, 3), rgb, rnd(0.4, 0.6), 1.6, 0.6);
  }
  if (!repeats) {
    const smear = wander(rnd(0, M), rnd(0, M), rnd(0, TAU), rnd(2.5, 5) * (M / 16 + 0.3), 0.25, 0.22);
    line(smear, 0.22, 'rgba(24,21,18,0.12)');
    line(smear, 0.1, 'rgba(24,21,18,0.2)');
    line(smear.map(([x, y]) => [x + rnd(-0.03, 0.03), y + rnd(-0.03, 0.03)]), 0.03, 'rgba(14,12,10,0.25)');

    // Tyre marks: one tread block repeated along a gentle curve, in a pair of tracks.
    for (let t = 0; t < Math.max(1, count(0.012)); t++) {
      const x0 = rnd(0, M);
      const y0 = rnd(0, M);
      const heading = rnd(0, TAU);
      const path = wander(x0, y0, heading, rnd(3, 6) * (M / 16 + 0.3), 0.1, 0.05);
      for (const side of [-0.45, 0.45]) {
        path.forEach(([x, y], i) => {
          const next = path[i + 1] ?? path[i - 1];
          const a = Math.atan2(next[1] - y, next[0] - x);
          const bx = x + Math.cos(a + Math.PI / 2) * side;
          const by = y + Math.sin(a + Math.PI / 2) * side;
          if (i % 2) return; // blocks with a gap between them
          wrapped(bx, by, 0.3, (X, Y) => {
            ctx.save();
            ctx.translate(X, Y);
            ctx.rotate(a + 0.5); // the tread's chevron
            ctx.fillStyle = 'rgba(30,27,24,0.2)';
            ctx.fillRect(-0.11, -0.025, 0.22, 0.05);
            ctx.restore();
          });
        });
      }
    }
    // Scrape lines from a loader blade: a few long, thin, nearly parallel lines, pale where the surface was cut and dark in the groove.
    for (let g = 0; g < Math.max(1, count(0.01)); g++) {
      const x0 = rnd(0, M);
      const y0 = rnd(0, M);
      const heading = rnd(0, TAU);
      const base = wander(x0, y0, heading, rnd(1.2, 3.5), 0.3, 0.02);
      for (let l = 0; l < 4 + Math.floor(random() * 5); l++) { // the same pass of the blade, so the lines run side by side
        const off = l * rnd(0.05, 0.1);
        const pts = base.map(([x, y]) => [x + Math.cos(heading + 1.57) * off + rnd(-0.01, 0.01), y + Math.sin(heading + 1.57) * off + rnd(-0.01, 0.01)]);
        line(pts, 0.012, `rgba(30,28,24,${rnd(0.08, 0.18)})`);
        line(pts.map(([x, y]) => [x + 0.018, y + 0.018]), 0.01, 'rgba(225,221,208,0.2)');
      }
    }

  }

  // Hairline cracks, each running from one joint to the next across its square.
  for (let i = 0; i < Math.max(2, count(0.09)); i++) {
    const horizontal = random() < 0.5;
    const along = Math.floor(random() * cells) * JOINT;
    const across = Math.floor(random() * cells) * JOINT;
    const start = horizontal ? [across, along + rnd(0.5, JOINT - 0.5)] : [along + rnd(0.5, JOINT - 0.5), across];
    const pts = [start];
    for (let s = 1; s <= 10; s++) {
      const f = (s / 10) * JOINT;
      pts.push(horizontal ? [across + f, start[1] + rnd(-0.2, 0.2) * s * 0.3] : [start[0] + rnd(-0.2, 0.2) * s * 0.3, across + f]);
    }
    line(pts, 0.012, 'rgba(38,36,32,0.65)');
    if (random() < 0.5) { // a branch
      const [bx, by] = pts[4 + Math.floor(random() * 3)];
      line(wander(bx, by, rnd(0, TAU), 0.7, 0.12, 0.5), 0.008, 'rgba(38,36,32,0.5)');
    }
  }

  // Grit and pits, then the joints: a dark line with a pale lip, every 4 m.
  for (let i = 0; i < count(30); i++) {
    ctx.fillStyle = random() < 0.5 ? `rgba(60,58,54,${rnd(0.15, 0.35)})` : `rgba(220,216,204,${rnd(0.12, 0.28)})`;
    const sz = rnd(0.008, 0.025);
    ctx.fillRect(rnd(0, M), rnd(0, M), sz, sz);
  }
  for (let j = 0; j <= cells; j++) { // a lip of 0.012 m either side of each joint, so the one on the tile's edge is half here and half on the next tile
    const at = j * JOINT;
    const lo = Math.max(0, at - 0.012);
    const hi = Math.min(M, at + 0.012);
    ctx.fillStyle = 'rgba(48,46,42,0.75)';
    ctx.fillRect(lo, 0, hi - lo, M);
    ctx.fillRect(0, lo, M, hi - lo);
    if (at < M) {
      ctx.fillStyle = 'rgba(218,214,202,0.3)';
      ctx.fillRect(at + 0.014, 0, 0.012, M);
      ctx.fillRect(0, at + 0.014, M, 0.012);
    }
  }
  ctx.restore();
}

/**
 * Paints into a canvas over a slab at `perMetre` pixels a metre, in the slab's own metres (the marks' decal is this size and clamped, so it is
 * placed, not tiled): a polished, smooth path along `path` (the way from the gate to the door, where tyres and boots have worn the surface to a
 * sheen) and a rough, exposed-aggregate edge round the rim where the surface has weathered away.
 */
export function paintSlabWear(ctx, perMetre, width, depth, path, random, low = [width * 0.1, depth * 0.9]) {
  ctx.save();
  ctx.scale(perMetre, perMetre);
  const rnd = (a, b) => a + random() * (b - a);
  const stain = (x, y, rx, ry, rgb, alpha, rough) => {
    const k = raggedFactors(random, rough);
    for (const [scale, a] of [[1.6, alpha * 0.2], [1.3, alpha * 0.3], [1, alpha]]) {
      ctx.fillStyle = `rgba(${rgb},${a})`;
      raggedPath(ctx, k, x, y, rx * scale, ry * scale, rnd(0, 3));
      ctx.fill();
    }
  };
  // The drain's corner: darker lines where the water runs down the slab to it, damp patches and a green-black stain of slime.
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const from = [low[0] + rnd(2.5, 11), low[1] - rnd(1, 9)];
    ctx.strokeStyle = 'rgba(52,56,52,0.2)';
    ctx.lineWidth = rnd(0.05, 0.12);
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    for (let t = 1; t <= 8; t++) ctx.lineTo(from[0] + ((low[0] - from[0]) * t) / 8 + rnd(-0.15, 0.15), from[1] + ((low[1] - from[1]) * t) / 8 + rnd(-0.15, 0.15));
    ctx.stroke();
  }
  for (let i = 0; i < 6; i++) stain(low[0] + rnd(0, 5), low[1] - rnd(0, 4), rnd(0.4, 1), rnd(0.3, 0.7), '60,64,60', 0.2, 0.5);
  stain(low[0], low[1], 0.8, 0.55, '34,48,30', 0.55, 0.55);
  stain(low[0] + 0.25, low[1] + 0.1, 0.35, 0.25, '20,30,18', 0.5, 0.6);
  // The wear path: a broad, soft pale band with a few darker, smoother streaks within it.
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const [w, a, rgb] of [[3.4, 0.07, '224,221,210'], [2.4, 0.08, '224,221,210'], [1.5, 0.09, '230,227,216']]) {
    ctx.strokeStyle = `rgba(${rgb},${a})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
  for (let s = 0; s < 6; s++) {
    ctx.strokeStyle = `rgba(150,148,142,${rnd(0.06, 0.12)})`;
    ctx.lineWidth = rnd(0.04, 0.1);
    ctx.beginPath();
    const off = rnd(-0.9, 0.9);
    path.forEach(([x, y], i) => (i ? ctx.lineTo(x + off, y + off * 0.3) : ctx.moveTo(x + off, y + off * 0.3)));
    ctx.stroke();
  }
  // The rim: a band about 30 cm wide of coarse stones and pits, thinning to the inside.
  const speck = (x, y, near) => {
    const sz = rnd(0.06, 0.13) * (1.3 - near * 0.7); // 14 px a metre: a stone is a pixel or two
    ctx.fillStyle = random() < 0.45 ? `rgba(214,208,194,${rnd(0.35, 0.7)})` : random() < 0.5 ? `rgba(120,114,104,${rnd(0.4, 0.7)})` : `rgba(58,54,48,${rnd(0.3, 0.6)})`;
    ctx.fillRect(x, y, sz, sz * rnd(0.7, 1.3));
  };
  for (let i = 0; i < Math.round((width + depth) * 2 * 0.34 * 60); i++) {
    const along = random() * (width + depth) * 2;
    const inset = Math.pow(random(), 1.8) * 0.34; // most of it at the very edge
    let x;
    let y;
    if (along < width) [x, y] = [along, inset];
    else if (along < width + depth) [x, y] = [width - inset, along - width];
    else if (along < 2 * width + depth) [x, y] = [2 * width + depth - along, depth - inset];
    else [x, y] = [inset, 2 * (width + depth) - along];
    speck(x, y, inset / 0.34);
  }
  ctx.restore();
}
