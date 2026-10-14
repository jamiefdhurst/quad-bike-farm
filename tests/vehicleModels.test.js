import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import * as THREE from 'three';
import { buildAllModels, triangles } from './helpers/vehicleModels.js';
import { budgetFor, TRIANGLE_BUDGETS } from '../src/vehicle/detail/budgets.js';
import { REAL_SIZES, IN_PROPORTION, PROPORTION_TOLERANCE, measureModel, proportionErrors } from '../src/vehicle/detail/realSizes.js';
import { buildTrailerModel } from '../src/vehicle/trailerModel.js';
import { buildTipTrailerModel } from '../src/vehicle/tipTrailerModel.js';

// The vehicle models as a whole (TODO 87): each within its triangle budget, the points people and things hang from where they were,
// and the vehicles a detail item has finished kept in proportion with the real ones.
//
// Fixed points: the seats, grips, footrests, dash, cameras and attach points, in each model's own frame, are kept in
// tests/fixedPoints.json. A detail item must not move them by accident (the girls' poses and the dashes are fitted to them). To
// move one on purpose, check the girls on it, then run `UPDATE_FIXED_POINTS=1 npx vitest run tests/vehicleModels.test.js` and
// commit the changed file with a line in DECISIONS.md saying why.

const FIXED = /^(seat|seatMid|seatLeft|seatRear(Left|Mid|Right)|seatBack_(driver|left)|bedSeat|pillionSeat|pillionGrip(Left|Right)|footwell(Left|Right)|peg(Left|Right)|handlebars|grip(Left|Right)|dash|riderHands|riderAnchor|pillionAnchor|rackAnchor|mugAnchor|camera(Anchor|Mid|Left|Rear(Left|Mid|Right))|pillionCameraAnchor|towHitch|winchHook|winchFairlead)$/;
const FILE = new URL('./fixedPoints.json', import.meta.url);

function fixedPoints(model) {
  const out = {};
  const seen = new Map();
  const p = new THREE.Vector3();
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    if (!FIXED.test(o.name)) return;
    const n = seen.get(o.name) ?? 0;
    seen.set(o.name, n + 1);
    o.getWorldPosition(p);
    out[n ? `${o.name}#${n}` : o.name] = [p.x, p.y, p.z].map((v) => Math.round(v * 1000) / 1000);
  });
  return out;
}

let vehicles;
beforeAll(async () => {
  vehicles = await buildAllModels();
});

describe('vehicle models', () => {
  it('each stays within its triangle budget', () => {
    for (const { id, spec, model } of vehicles) expect(triangles(model), id).toBeLessThanOrEqual(budgetFor(spec));
    expect(triangles(buildTrailerModel()), 'trailer').toBeLessThanOrEqual(TRIANGLE_BUDGETS.trailer);
    expect(triangles(buildTipTrailerModel()), 'tipping trailer').toBeLessThanOrEqual(TRIANGLE_BUDGETS.trailer);
  });

  it('keeps the seats, grips, footrests, dash and attach points where they were', () => {
    const now = Object.fromEntries(vehicles.map(({ id, model }) => [id, fixedPoints(model)]));
    if (process.env.UPDATE_FIXED_POINTS) {
      const vehicle = ([id, pts]) => `  "${id}": {\n${Object.entries(pts).map(([n, at]) => `    "${n}": ${JSON.stringify(at)}`).join(',\n')}\n  }`;
      fs.writeFileSync(FILE, `{\n${Object.entries(now).map(vehicle).join(',\n')}\n}\n`);
    }
    const was = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    for (const [id, points] of Object.entries(was)) {
      expect(now[id], id).toBeTruthy();
      for (const [name, at] of Object.entries(points)) {
        expect(now[id][name], `${id} ${name} is gone`).toBeTruthy();
        const d = Math.hypot(...at.map((v, i) => v - now[id][name][i]));
        expect(d, `${id} ${name} moved ${(d * 1000).toFixed(0)} mm`).toBeLessThanOrEqual(0.002);
      }
    }
  });

  it('every vehicle has its real counterpart’s sizes written down', () => {
    for (const { id } of vehicles) expect(REAL_SIZES[id], id).toBeTruthy();
  });

  it('the vehicles a detail item has finished are in proportion with the real ones', () => {
    for (const { id, model, layout } of vehicles.filter((v) => IN_PROPORTION.includes(v.id))) {
      const errors = proportionErrors(measureModel(model, layout), REAL_SIZES[id]);
      for (const [k, e] of Object.entries(errors)) expect(Math.abs(e), `${id} ${k} is ${(e * 100).toFixed(0)}% out`).toBeLessThanOrEqual(PROPORTION_TOLERANCE);
    }
  });
});
