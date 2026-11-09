import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { LAYOUT } from '../src/world/layout.js';
import { createFields } from '../src/world/fields.js';
import { planAsData } from './helpers/planAsData.js';

// tests/fixtures/rectFields.json is what the fields answered when every field was a rectangle (#662), over the farm, the lane, the hill and the
// wood on a 2 m grid, written once from that code. Making them polygons changed nothing a player could see, and this is what says so.
const golden = JSON.parse(readFileSync(new URL('./fixtures/rectFields.json', import.meta.url), 'utf8'));
const { grid } = golden;

function sample(visit) {
  let row = 0;
  let i = 0;
  for (let z = grid.z0; z <= grid.z1; z += grid.step, row++) {
    let col = 0;
    for (let x = grid.x0; x <= grid.x1; x += grid.step, col++) visit(x, z, row, col, i++);
  }
}

// Both ways of supplying them: built from the layout's numbers, and written out as `fields`, `boundaries` and `gateways` in the layout.
const data = planAsData(LAYOUT);
const ways = {
  'built from the layout': createFields(LAYOUT),
  'written out as data': createFields({ ...LAYOUT, fields: data.fields, boundaries: data.boundaries, gateways: data.gateways }),
};

describe.each(Object.entries(ways))('the fields as polygons answer as the rectangles did, %s', (_way, f) => {
  it('names the same field at every point of a 2 m grid', () => {
    const wrong = [];
    sample((x, z, row, col) => {
      const was = golden.NAMES[golden.areas[row].charCodeAt(col) - 97];
      if (f.areaOf(x, z) !== was) wrong.push(`${x},${z}: ${f.areaOf(x, z)} not ${was}`);
    });
    expect(wrong.slice(0, 5)).toEqual([]);
  });

  it('is the same distance from a hedge, to the centimetre', () => {
    const wrong = [];
    sample((x, z, row, col, i) => {
      if (Math.abs(f.hedgeDistance(x, z) - golden.hedge[i] / 100) > 0.01) wrong.push(`${x},${z}: ${f.hedgeDistance(x, z)} not ${golden.hedge[i] / 100}`);
    });
    expect(wrong.slice(0, 5)).toEqual([]);
  });

  it('is in the farm where it was, and 6 m in', () => {
    const wrong = [];
    sample((x, z, row, col, i) => {
      if (f.inFarm(x, z, 0) !== !!golden.farm[i * 2] || f.inFarm(x, z, 6) !== !!golden.farm[i * 2 + 1]) wrong.push(`${x},${z}`);
    });
    expect(wrong.slice(0, 5)).toEqual([]);
  });

  it('finds the same way through the gateways from a spread of places to five spots', () => {
    const wrong = [];
    let n = 0;
    for (let z = -200; z <= 220; z += 20) {
      for (let x = -80; x <= 250; x += 20) {
        golden.targets.forEach((t, k) => {
          const was = golden.routes[n][k];
          const now = f.route({ x, z }, t);
          const same = now.length === was.length && now.every((p, j) => Math.abs(p.x * 100 - was[j][0]) < 1 && Math.abs(p.z * 100 - was[j][1]) < 1);
          if (!same) wrong.push(`${x},${z} to ${t.x},${t.z}`);
        });
        n++;
      }
    }
    expect(wrong.slice(0, 5)).toEqual([]);
  });

  it('sees the same distance to the hedge ahead', () => {
    for (const [x, z, yaw, was] of golden.ahead) {
      const now = f.hedgeAhead(x, z, yaw);
      if (was === null) expect(now).toBe(Infinity);
      else expect(Math.abs(now * 100 - was)).toBeLessThan(1);
    }
  });
});
