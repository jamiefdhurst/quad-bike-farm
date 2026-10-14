import { describe, it, expect, beforeAll } from 'vitest';
import { buildAllGirls, measureGirl } from './helpers/girlModels.js';

// The girls' shape (TODO 86), checked without a screenshot: how many meshes and triangles each has dressed, and how big she is.
// A change that shrinks a girl, leaves a garment out or doubles one fails here. Recorded in the model's rest pose, with the
// polo's neckline uncut (the test has no texture pixels to cut it from), so the triangle count is a little above the game's.
// To change on purpose, update the numbers below and say why in DECISIONS.md.

const WAS = {
  amy: { meshes: 7, tris: 2720, size: [0.499, 1.613, 0.358] },
  jess: { meshes: 7, tris: 2720, size: [0.481, 1.553, 0.385] },
};
const SIZE_TOLERANCE = 0.03; // of each side
const TRIS_TOLERANCE = 0.05;

let girls;
beforeAll(async () => {
  girls = await buildAllGirls();
});

describe('the girls’ models', () => {
  it('every girl has her shape written down', () => {
    expect(girls.map((g) => g.id).sort()).toEqual(Object.keys(WAS).sort());
  });

  it('keeps each girl’s meshes, triangles and size where they were', () => {
    for (const { id, rig } of girls) {
      const now = measureGirl(rig);
      const was = WAS[id];
      expect(now.meshes, `${id} meshes`).toBe(was.meshes);
      expect(Math.abs(now.tris - was.tris) / was.tris, `${id} triangles ${now.tris} against ${was.tris}`).toBeLessThanOrEqual(TRIS_TOLERANCE);
      now.size.forEach((n, i) => expect(Math.abs(n - was.size[i]) / was.size[i], `${id} size ${now.size} against ${was.size}`).toBeLessThanOrEqual(SIZE_TOLERANCE));
    }
  });

  it('stands about as tall as her params say, and Amy is the taller', () => {
    for (const { id, rig, height } of girls) expect(Math.abs(measureGirl(rig).size[1] - height) / height, id).toBeLessThanOrEqual(0.04);
    const h = Object.fromEntries(girls.map((g) => [g.id, measureGirl(g.rig).size[1]]));
    expect(h.amy).toBeGreaterThan(h.jess);
  });
});
