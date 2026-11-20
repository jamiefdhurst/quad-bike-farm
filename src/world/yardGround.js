// The farmstead yard's concrete as it is painted into the ground (#817): bays with tarred expansion joints, patches and cracks, a central drain and its gully,
// the worn tyre paths, mud tracked in from the gateways, the scraped muck line at the foot of the barn's wall, standing puddles in the low spots and the
// stackyard's hardcore. Everything is a function of the cell or the item, never of the order painted in, so a window painted twice is the same.
// `c` is the paint context of `groundTexture.js` (`toPx`, `inWin`, `over`), `hash` its `hash01`.

const BAY = 6; // m between the tarred joints, as the yard was laid in bays
const CELL = 2; // m of mottling

/** Where the yard's wear lies, in game metres from the layout (`layout.farmstead.yard`), or null on a layout with no yard to paint. */
export const yardMarks = (layout) => layout.farmstead?.yard ?? null;

/** The standing puddles' places and sizes: where the slab dips, by the drain and in the gateways' tracks (the same list the gloss discs are laid on). */
export const puddleSpots = (layout) => yardMarks(layout)?.puddles ?? [];

const rect = (c, ctx, r) => {
  const [a, b] = c.toPx(r.minX, r.minZ);
  const [d, e] = c.toPx(r.maxX, r.maxZ);
  return [a, b, d - a, e - b];
};

function stroke(c, ctx, s, pts, style, widthM) {
  ctx.strokeStyle = style;
  ctx.lineWidth = Math.max(1, widthM * s);
  ctx.beginPath();
  pts.forEach(([x, z], i) => {
    const [px, pz] = c.toPx(x, z);
    if (i) ctx.lineTo(px, pz);
    else ctx.moveTo(px, pz);
  });
  ctx.stroke();
}

function blob(c, ctx, s, x, z, rx, rz, color) {
  if (!c.inWin(x, z, Math.max(rx, rz))) return;
  const [px, pz] = c.toPx(x, z);
  const g = ctx.createRadialGradient(px, pz, 0, px, pz, Math.max(rx, rz) * s);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.translate(px, pz);
  ctx.scale(1, rz / rx);
  ctx.translate(-px, -pz);
  ctx.fillStyle = g;
  const r = Math.max(rx, rz) * s;
  ctx.fillRect(px - r, pz - r, r * 2, r * 2);
  ctx.restore();
}

/** Old yard concrete: pale grey bays mottled by cell, tarred joints with a pale lip, a few patched bays and hairline cracks, the central drain with its gully. */
export function paintYardConcrete(c, ctx, s, layout, hash) {
  const r = layout.farmstead.slab;
  const marks = yardMarks(layout);
  const mid = [(r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2];
  if (!c.inWin(mid[0], mid[1], Math.max(r.maxX - r.minX, r.maxZ - r.minZ) / 2 + 1)) return;
  ctx.fillStyle = '#8d8b85';
  ctx.fillRect(...rect(c, ctx, r));
  for (let x = r.minX; x < r.maxX; x += CELL) {
    for (let z = r.minZ; z < r.maxZ; z += CELL) {
      if (!c.inWin(x, z, CELL)) continue;
      const h = hash(64, Math.floor(x / CELL), Math.floor(z / CELL));
      const [qx, qz] = c.toPx(x, z);
      ctx.fillStyle = h < 0.5 ? `rgba(255,255,255,${0.03 + h * 0.08})` : h > 0.93 ? `rgba(40,34,26,${0.06 + (h - 0.93) * 1.5})` : `rgba(0,0,0,${0.02 + (h - 0.5) * 0.1})`;
      ctx.fillRect(qx, qz, CELL * s, CELL * s);
    }
  }
  // Patched bays: a bay cut out and relaid in newer, paler concrete, with its own joint round it.
  for (let x = Math.floor(r.minX / BAY) * BAY; x < r.maxX; x += BAY) {
    for (let z = Math.floor(r.minZ / BAY) * BAY; z < r.maxZ; z += BAY) {
      if (!c.inWin(x + BAY / 2, z + BAY / 2, BAY)) continue;
      const h = hash(71, x / BAY, z / BAY);
      if (h > 0.12) continue;
      const w = BAY * (0.4 + h * 3);
      const px = x + hash(72, x / BAY, z / BAY) * (BAY - w);
      const pz = z + hash(73, x / BAY, z / BAY) * (BAY - w);
      const [qx, qz] = c.toPx(px, pz);
      ctx.fillStyle = 'rgba(205,203,196,0.45)';
      ctx.fillRect(qx, qz, w * s, w * s);
      ctx.strokeStyle = 'rgba(40,38,35,0.55)';
      ctx.lineWidth = Math.max(1, 0.04 * s);
      ctx.strokeRect(qx, qz, w * s, w * s);
    }
  }
  // Tarred expansion joints: a dark core with a faint pale lip either side where the tar has squeezed out and dried.
  const joints = [];
  for (let x = Math.ceil(r.minX / BAY) * BAY; x < r.maxX; x += BAY) joints.push([[x, r.minZ], [x, r.maxZ]]);
  for (let z = Math.ceil(r.minZ / BAY) * BAY; z < r.maxZ; z += BAY) joints.push([[r.minX, z], [r.maxX, z]]);
  for (const [a, b] of joints) {
    stroke(c, ctx, s, [a, b], 'rgba(190,188,180,0.35)', 0.16);
    stroke(c, ctx, s, [a, b], 'rgba(28,26,24,0.62)', 0.045);
  }
  // Hairline cracks: short jagged runs from a joint, a few to a bay, by cell.
  for (let x = Math.floor(r.minX / BAY) * BAY; x < r.maxX; x += BAY) {
    for (let z = Math.floor(r.minZ / BAY) * BAY; z < r.maxZ; z += BAY) {
      if (!c.inWin(x + BAY / 2, z + BAY / 2, BAY)) continue;
      for (let k = 0; k < 3; k++) {
        const h = hash(74 + k, x / BAY, z / BAY);
        if (h > 0.45) continue;
        let px = x + hash(77, x / BAY + k, z / BAY) * BAY;
        let pz = z + hash(78, x / BAY, z / BAY + k) * BAY;
        const pts = [[px, pz]];
        const a = hash(79, x / BAY + k, z / BAY + k) * Math.PI * 2;
        for (let i = 1; i < 6; i++) pts.push([(px += Math.cos(a + (hash(80 + i, x / BAY, z / BAY + k) - 0.5)) * 0.7), (pz += Math.sin(a + (hash(80 + i, x / BAY + k, z / BAY) - 0.5)) * 0.7)]);
        stroke(c, ctx, s, pts, 'rgba(34,32,30,0.6)', 0.025);
      }
    }
  }
  if (!marks) return;
  // The central drain: a shallow channel along the yard's middle falling to the gully by the barn, its grate a darker square.
  if (marks.drain) {
    const d = marks.drain;
    stroke(c, ctx, s, [[d.x, d.z0], [d.x, d.z1]], 'rgba(60,58,54,0.8)', 0.42);
    stroke(c, ctx, s, [[d.x, d.z0], [d.x, d.z1]], 'rgba(22,21,20,0.85)', 0.16);
    blob(c, ctx, s, d.x, d.z1, 1.2, 1.2, 'rgba(18,17,16,0.55)');
  }
}

/** The tyre paths the vehicles take (polished darker, with an oily middle), and the mud tracked in from each way in. */
export function paintYardWear(c, ctx, s, layout) {
  const marks = yardMarks(layout);
  if (!marks) return;
  for (const p of marks.paths ?? []) {
    stroke(c, ctx, s, p.points, 'rgba(46,43,38,0.22)', p.width);
    for (const side of [-1, 1]) { // the two wheel lines, polished darker still
      const pts = p.points.map(([x, z], i) => {
        const [x0, z0] = p.points[Math.max(0, i - 1)];
        const [x1, z1] = p.points[Math.min(p.points.length - 1, i + 1)];
        const len = Math.hypot(x1 - x0, z1 - z0) || 1;
        return [x - ((z1 - z0) / len) * side * p.width * 0.28, z + ((x1 - x0) / len) * side * p.width * 0.28];
      });
      stroke(c, ctx, s, pts, 'rgba(20,18,16,0.2)', p.width * 0.22);
    }
  }
  for (const m of marks.mud ?? []) {
    blob(c, ctx, s, m.x, m.z, m.radius, m.radius * 0.7, 'rgba(78,60,38,0.7)');
    blob(c, ctx, s, m.x + m.dx * m.radius * 0.5, m.z + m.dz * m.radius * 0.5, m.radius * 0.7, m.radius * 0.5, 'rgba(70,54,34,0.5)');
  }
  // The scraped muck line: a dark band of what the scraper left, 0.5 m out from the foot of each wall, broken and heavier at the corners.
  for (const w of marks.muckLines ?? []) {
    const n = Math.ceil(Math.hypot(w.x1 - w.x0, w.z1 - w.z0) / 1.5);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = w.x0 + (w.x1 - w.x0) * t;
      const z = w.z0 + (w.z1 - w.z0) * t;
      if (!c.inWin(x, z, 1.5)) continue;
      const h = hash01local(i, w.x0 + w.z0);
      blob(c, ctx, s, x, z, 1 + h, 0.35 + h * 0.25, `rgba(52,40,26,${0.28 + h * 0.22})`);
    }
  }
  // Standing puddles: a dark damp patch with a paler rim where the water has dried back.
  for (const p of puddleSpots(layout)) {
    blob(c, ctx, s, p.x, p.z, p.rx * 1.35, p.rz * 1.35, 'rgba(60,56,50,0.5)');
    blob(c, ctx, s, p.x, p.z, p.rx, p.rz, 'rgba(36,38,40,0.85)');
  }
}

/** The stackyard's floor: crushed stone laid as hardcore, grey-brown, flecked pale, trodden to bare earth where the tractor turns. */
export function paintHardcore(c, ctx, s, layout, hash) {
  const r = layout.farmstead.stackyard;
  const mid = [(r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2];
  if (!c.inWin(mid[0], mid[1], Math.max(r.maxX - r.minX, r.maxZ - r.minZ) / 2 + 1)) return;
  ctx.fillStyle = '#7d7568';
  ctx.fillRect(...rect(c, ctx, r));
  const cell = 0.4; // crushed stone is grainy: fine cells, each a stone or a shadow between stones
  for (let x = r.minX; x < r.maxX; x += cell) {
    for (let z = r.minZ; z < r.maxZ; z += cell) {
      if (!c.inWin(x, z, 1)) continue;
      const h = hash(85, Math.floor(x / cell), Math.floor(z / cell));
      const [qx, qz] = c.toPx(x, z);
      ctx.fillStyle = h < 0.3 ? `rgba(215,208,190,${0.05 + h * 0.2})` : h > 0.8 ? `rgba(55,46,34,${0.06 + (h - 0.8) * 0.6})` : `rgba(0,0,0,${h * 0.05})`;
      ctx.fillRect(qx, qz, cell * s, cell * s);
    }
  }
  for (const t of layout.farmstead.yard?.stackyardTrack ?? []) blob(c, ctx, s, t.x, t.z, t.radius, t.radius * 0.8, 'rgba(70,56,38,0.6)');
}

const hash01local = (i, salt) => {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
};
