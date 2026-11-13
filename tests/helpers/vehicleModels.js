import { vi } from 'vitest';
import { QUAD_SPECS, EXTRA_SPECS, PLOVER_SPEC, HARTLEY_SPEC, YAK_SPEC, TOR_SPEC, CRAG_SPEC, FINCH_SPEC, GRIFFIN_SPEC, VAUCLAIR_SPEC } from '../../src/vehicle/quadSpecs.js';

// Every vehicle's model built in node, the way quadUnit.js builds it, for the tests that look at the models as a whole (budgets,
// fixed points, proportions). The dashes, plates and decals draw on canvases, so a canvas that accepts every call stands in.

export function fakeCanvas() {
  const ctx = new Proxy({ canvas: null }, { get: (t, k) => (k in t ? t[k] : k === 'measureText' ? (s) => ({ width: String(s).length * 10 }) : () => ({ addColorStop() {}, width: 10 })), set: (t, k, v) => ((t[k] = v), true) });
  return { width: 0, height: 0, getContext: () => ctx, style: {} };
}

export const ALL_SPECS = [...QUAD_SPECS, ...EXTRA_SPECS, PLOVER_SPEC, HARTLEY_SPEC, YAK_SPEC, TOR_SPEC, CRAG_SPEC, FINCH_SPEC, GRIFFIN_SPEC, VAUCLAIR_SPEC];

/** [{ id, spec, model, layout }] for every vehicle, built fresh. Call from a beforeAll. */
export async function buildAllModels() {
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  const { buildQuadModel } = await import('../../src/vehicle/quadModel.js');
  const { buildMiniMotoModel } = await import('../../src/vehicle/miniMotoModel.js');
  const { buildPloverModel, PLOVER_LAYOUT } = await import('../../src/vehicle/ploverModel.js');
  const { buildAgModel, AG_LAYOUT } = await import('../../src/vehicle/shepherdModel.js');
  const { buildAtcModel } = await import('../../src/vehicle/t185Model.js');
  const { buildMowerModel, MOWER_LAYOUT } = await import('../../src/vehicle/mowerModel.js');
  const { buildTractorModel } = await import('../../src/vehicle/tractorModel.js');
  const { buildUtvModel } = await import('../../src/vehicle/utvModel.js');
  const { buildCabModel } = await import('../../src/vehicle/cabModel.js');
  const { buildCarModel, carLayout } = await import('../../src/vehicle/carModel.js');
  const { QUAD_LAYOUT } = await import('../../src/vehicle/quadPhysics.js');
  const { MOTO_LAYOUT } = await import('../../src/vehicle/miniMotoModel.js');
  const { T185_LAYOUT } = await import('../../src/vehicle/t185Model.js');
  const { TRACTOR_LAYOUT } = await import('../../src/vehicle/tractorModel.js');
  const { UTV_LAYOUT } = await import('../../src/vehicle/utvModel.js');
  const { TOR_LAYOUT, CRAG_LAYOUT } = await import('../../src/vehicle/cabModel.js');
  return ALL_SPECS.map((spec) => {
    const o = { bodyColor: spec.bodyColor, dashStyle: spec.dashStyle };
    let model;
    let layout = QUAD_LAYOUT;
    if (spec.miniMoto) [model, layout] = [buildMiniMotoModel(o), MOTO_LAYOUT];
    else if (spec.farmBike) [model, layout] = [buildAgModel(o), AG_LAYOUT];
    else if (spec.mower) [model, layout] = [buildMowerModel(o), MOWER_LAYOUT];
    else if (spec.classicBike) [model, layout] = [buildPloverModel(o), PLOVER_LAYOUT];
    else if (spec.threeWheeler) [model, layout] = [buildAtcModel({ ...o, chokeStyle: spec.chokeStyle }), T185_LAYOUT];
    else if (spec.tractor) [model, layout] = [buildTractorModel(o), TRACTOR_LAYOUT];
    else if (spec.utv) [model, layout] = [buildUtvModel(o), UTV_LAYOUT];
    else if (spec.landRover) [model, layout] = [buildCabModel({ ...o, variant: spec.crag ? 'crag' : 'tor' }), spec.crag ? CRAG_LAYOUT : TOR_LAYOUT];
    else if (spec.car) [model, layout] = [buildCarModel({ ...o, kind: spec.car }), carLayout(spec.car)];
    else model = buildQuadModel({ ...o, style: spec.style, solo: spec.solo, plateNumber: spec.plateNumber, chokeStyle: spec.chokeStyle, tapStyle: spec.tapStyle, driveSwitch: spec.driveSwitch ? { lock: !!spec.diffLock } : null });
    model.updateMatrixWorld(true);
    return { id: spec.id, spec, model, layout };
  });
}

/** Triangles drawn for a model: every mesh, once (instanced meshes times their count). */
export function triangles(model) {
  let t = 0;
  model.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    t += ((g.index ? g.index.count : g.attributes.position.count) / 3) * (o.isInstancedMesh ? o.count : 1);
  });
  return Math.round(t);
}
