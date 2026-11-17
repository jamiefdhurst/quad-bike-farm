import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { createFields } from '../src/world/fields.js';
import { paintContext, paintStubble } from '../src/world/groundTexture.js';
import { polygonArea } from '../src/world/polygons.js';

// The ground texture paints each stubble field inside its polygon, not its box (#813).
const two = layoutNew(LAYOUT);
const fields = createFields(two);

/** A canvas that only remembers: the path being drawn, the clips in force, and every fill with the clip it was made under. */
function recorder() {
  const state = { path: [], clips: [], stack: [], fills: [] };
  const grad = { addColorStop() {} };
  const ctx = {
    save: () => state.stack.push(state.clips),
    restore: () => (state.clips = state.stack.pop()),
    beginPath: () => (state.path = []),
    moveTo: (x, y) => state.path.push([x, y]),
    lineTo: (x, y) => state.path.push([x, y]),
    closePath() {},
    rect: (x, y, w, h) => state.path.push([x, y], [x + w, y], [x + w, y + h], [x, y + h]),
    clip: () => (state.clips = [...state.clips, state.path]),
    fillRect: (x, y, w, h) => state.fills.push({ x, y, w, h, clips: state.clips }),
    createRadialGradient: () => grad,
    translate() {},
    scale() {},
    stroke() {},
  };
  return { ctx, state };
}

/** Paints every stubble field at 1 px a metre (the overview, so no row detail) over a window of all of them. */
function paintAll(f = fields) {
  const { ctx, state } = recorder();
  const win = { minX: -700, maxX: 900, minZ: -500, maxZ: 700 };
  paintStubble(paintContext(ctx, win, 1, { fine: false }), f);
  return { state, win };
}

describe('the ground texture inside a field\'s polygon', () => {
  it('clips every field\'s paint to its own corners', () => {
    const { state, win } = paintAll();
    const clipsOf = new Set(state.fills.map((f) => JSON.stringify(f.clips)));
    // One clip a field, and nothing painted outside one.
    expect(clipsOf.size).toBe(fields.stubbleFields.length);
    for (const f of state.fills) expect(f.clips.length).toBe(1);
    for (const key of fields.stubbleFields) {
      const want = fields.polygons[key].map(([x, z]) => [x - win.minX, z - win.minZ]);
      const clip = state.fills.map((f) => f.clips[0]).find((c) => JSON.stringify(c) === JSON.stringify(want));
      expect(clip, `${key} has a clip that is its polygon`).toBeDefined();
    }
  });
  it('paints no more than the field: its clip is its area, which is less than the box that is filled', () => {
    const { state, win } = paintAll();
    let slanted = 0;
    for (const key of fields.stubbleFields) {
      const want = JSON.stringify(fields.polygons[key].map(([x, z]) => [x - win.minX, z - win.minZ]));
      const fills = state.fills.filter((f) => JSON.stringify(f.clips[0]) === want);
      expect(fills.length, key).toBeGreaterThan(0);
      const box = fills[0];
      const clipArea = Math.abs(polygonArea(JSON.parse(want)));
      expect(clipArea).toBeCloseTo(Math.abs(polygonArea(fields.polygons[key])), 3);
      if (clipArea < box.w * box.h * 0.98) slanted++;
    }
    expect(slanted).toBeGreaterThanOrEqual(4);
  });
  it('still paints today\'s two rectangles as their boxes', () => {
    const f1 = createFields(LAYOUT);
    const { state, win } = paintAll(f1);
    for (const key of f1.stubbleFields) {
      const r = f1.areas[key];
      const clip = state.fills.map((f) => f.clips[0]).find((c) => c.length === 4 && Math.abs(c[0][0] - (r.minX - win.minX)) < 1e-6 && Math.abs(c[0][1] - (r.minZ - win.minZ)) < 1e-6);
      expect(clip, key).toBeDefined();
    }
  });
});
