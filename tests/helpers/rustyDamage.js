import { vi, expect } from 'vitest';
import { createRandom } from '../../src/core/random.js';
import { planDamage, applyDamage } from '../../src/vehicle/rustyDamage.js';
import { fakeCanvas } from './vehicleModels.js';
import { boxEveryMesh } from './rays.js';

// The rusty quad's donors built in node, for the damage tests (tests/rustyDamage*.test.js). Laying the damage fires thousands of rays at the
// body, so the tests were one file of a minute that set how long `npm test` took; they are split by what they look at (#1183).

export const DONORS = ['farm300', 'bruin', 'hornet', 'rb300', 'adder'];

const STYLES = { farm300: 'utility', bruin: 'bruin', hornet: 'hornet', rb300: 'rb300', adder: 'racer' };

let buildQuadModel = null;
const loaded = {};

/** Stubs the canvas and loads the models' modules: call from a beforeAll. Returns { weatherModel, buildTarp }. */
export async function loadDonors() {
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  ({ buildQuadModel } = await import('../../src/vehicle/quadModel.js'));
  const { weatherModel, buildTarp } = await import('../../src/vehicle/rustyLook.js');
  Object.assign(loaded, { weatherModel, buildTarp });
  return loaded;
}

/** A donor's finished model, in brown, with `decay` (a damage plan) built into it, its geometry boxed for the rays. */
export function buildDonor(id, decay) {
  const model = buildQuadModel({ bodyColor: 0x6b4426, dashStyle: id, style: STYLES[id], decay });
  model.updateMatrixWorld(true);
  return boxEveryMesh(model);
}

// Landing the same however the vehicle stands (#597), for rustyDamageSteady*.test.js ------------------------------------------------------

/** The geometry of each decal, as the sum of its vertices' distances from the origin in the body's own frame: the same placing gives the same figures. */
export function signature(model) {
  const out = [];
  model.traverse((o) => {
    if (!o.userData.rustyDamage || !o.geometry) return;
    const p = o.geometry.attributes.position;
    let sum = 0;
    for (let i = 0; i < p.count; i++) sum += Math.hypot(p.getX(i), p.getY(i), p.getZ(i));
    out.push(`${o.name}:${p.count}:${sum.toFixed(3)}`);
  });
  return out.join(' ');
}

/** A donor with seed 7's damage laid on it, after `setUp` has stood it somewhere. */
export function dressed(id, setUp) {
  const plan = planDamage(createRandom(7), id);
  const model = buildDonor(id, plan);
  setUp?.(model);
  model.updateMatrixWorld(true);
  applyDamage(model, plan, null);
  return model;
}

const plainOnes = new Map(); // each donor dressed as it stands, made once for the cases in a file that compare with it
export function plainSignature(id) {
  if (!plainOnes.has(id)) plainOnes.set(id, signature(dressed(id)));
  return plainOnes.get(id);
}

/** The donor turned, tilted on its springs, with the bars steered and parts left out for being small, dressed as it is when it stands plain. */
export function landsTheSame(id) {
  const plain = plainSignature(id);
  expect(plain.length).toBeGreaterThan(0);
  const moved = dressed(id, (m) => {
    m.position.set(30, 0.4, -12);
    m.rotation.y = 2.1;
    const body = m.getObjectByName('bodyRoot');
    body.rotation.x = 0.04;
    body.rotation.z = -0.03;
    const bars = m.getObjectByName('handlebars');
    if (bars) bars.rotation.y = 0.15;
    m.traverse((o) => { if (o.isMesh && o.name.length % 3 === 0) o.layers.set(1); }); // FarDetail's leaving out of specks
  });
  expect(signature(moved)).toBe(plain);
}
