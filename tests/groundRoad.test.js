import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createFields } from '../src/world/fields.js';
import { roadNetwork } from '../src/world/roads.js';
import { paintRoadOnGround } from '../src/world/groundTexture.js';

// The farm road painted as it was before the road network (#664), kept here to show the network's painting does the same.
function legacyPaintTarmac(ctx, toPx, s, layout, fields, random) {
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

const rng = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const recorder = () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, name) => (name === 'calls' ? calls : (...args) => calls.push([name, ...args.map((a) => (typeof a === 'number' ? Math.round(a * 1e6) / 1e6 : a))])),
    set: (_, name, value) => (calls.push(['set ' + String(name), value]), true),
  });
  return { ctx, calls };
};

describe('the farm road painted into the ground', () => {
  const fields = createFields(LAYOUT);
  const toPx = (x, z) => [(x + 210) * 4, (z + 210) * 4];
  const farm = roadNetwork(LAYOUT).road('farm');

  it('puts the same speckle and the same bites out of the edge where the road was painted before, in the same order', () => {
    const before = recorder();
    legacyPaintTarmac(before.ctx, toPx, 4, LAYOUT, fields, rng(5));
    const now = recorder();
    const random = rng(5);
    paintRoadOnGround(now.ctx, toPx, 4, farm, fields, random);
    const only = (calls, names) => calls.filter((c) => names.includes(c[0]));
    const a = only(now.calls, ['fillRect', 'ellipse']);
    const b = only(before.calls, ['fillRect', 'ellipse']);
    const i = a.findIndex((c, k) => JSON.stringify(c) !== JSON.stringify(b[k]));
    expect(i === -1 ? null : [i, a[i], b[i]]).toBeNull();
    expect(a.length).toBe(b.length);
    expect(only(before.calls, ['fillRect']).length).toBeGreaterThan(1000);
    expect(only(before.calls, ['ellipse']).length).toBeGreaterThan(20);
    // And it leaves the random stream where it was, so what is painted after it is the same too.
    const rest = rng(5);
    const legacyRandom = rng(5);
    legacyPaintTarmac(recorder().ctx, toPx, 4, LAYOUT, fields, legacyRandom);
    expect(random()).toBe(legacyRandom());
    expect(rest()).toBeTypeOf('number');
  });

  it('covers the road and the hardstanding, edge to edge, in the same colours', () => {
    const r = recorder();
    paintRoadOnGround(r.ctx, toPx, 4, farm, fields, rng(5));
    const fills = r.calls.filter((c) => c[0] === 'set fillStyle').map((c) => c[1]);
    expect(fills.slice(0, 2)).toEqual(['rgba(95,88,70,0.6)', '#4b4a47']);
    expect(r.calls.filter((c) => c[0] === 'arc').length).toBe(3 * farm.pads.length); // the hardstanding's rim, its tarmac and the clip
  });
});
