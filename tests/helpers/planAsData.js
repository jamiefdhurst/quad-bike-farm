import { fieldPlan } from '../../src/world/fieldPlan.js';
import { createHill } from '../../src/world/hill.js';
import { createWoods } from '../../src/world/woods.js';
import { createQuarry } from '../../src/world/quarry.js';
import { createBrook } from '../../src/world/brook.js';

/**
 * Today's plan (built by fieldPlan.js from the layout's numbers) written out as plain data, the way a layout writes its fields: `fields`,
 * `boundaries` and `gateways`, no functions and no shared objects. A way across with no line of its own (the lane's sides, the end of the road)
 * becomes a short `none` boundary through it.
 */
export function planAsData(layout) {
  const plan = fieldPlan(layout, { hill: createHill(layout), woods: createWoods(layout), quarry: createQuarry(layout), brook: createBrook(layout) });
  const fields = plan.fields.map((f) => ({ name: f.name, kind: f.kind, points: f.points.map((p) => [...p]) }));
  const boundaries = plan.boundaries.map((b) => {
    const { x1, z1, x2, z2, length, dx, dz, alongX, kind, gaps, ...extra } = b;
    return { points: [[x1, z1], [x2, z2]], kind, gaps: gaps.map((g) => ({ ...g })), ...extra };
  });
  const gateways = plan.gateways.map((w) => {
    const { edge, at: along, outA, outB } = w.via;
    let index = plan.boundaries.findIndex((b) => b.x1 === edge.x1 && b.z1 === edge.z1 && b.x2 === edge.x2 && b.z2 === edge.z2);
    if (index < 0) {
      boundaries.push({ points: [[edge.x1, edge.z1], [edge.x2, edge.z2]], kind: 'none', gaps: [] });
      index = boundaries.length - 1;
    }
    const { at: _at, ...gate } = w.gap ?? {};
    return { a: w.a, b: w.b, boundary: index, at: along, outA, outB, ...(w.gap ? { ...gate, at: w.gap.at } : {}) };
  });
  return { fields, boundaries, gateways, gates: plan.gates };
}
