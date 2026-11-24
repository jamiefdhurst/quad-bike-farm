import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import * as THREE from 'three';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { measureModel, proportionErrors, REAL_SIZES, PROPORTION_TOLERANCE } from '../src/vehicle/detail/realSizes.js';
import { SCENERY_NAMES } from '../src/vehicle/names.js';

// The neighbour's newer tractor with its front loader (#926): its parts are where the Looks like list says, the loader lifts and lowers with its rams still joined to
// their pins, and it is the size of the real one, within its triangle and draw-call budget.

let mod;
let model;
beforeEach(() => model && mod.setLoader(model, 0)); // each test starts with the bucket down, as it is parked
beforeAll(async () => {
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  mod = await import('../src/vehicle/loaderTractorModel.js');
  model = mod.buildLoaderTractorModel({ bodyColor: 0x23548f });
});

const named = (root, re) => {
  const found = [];
  root.traverse((o) => { if (re.test(o.name)) found.push(o); });
  return found;
};
const meshes = (root) => {
  const m = [];
  root.traverse((o) => { if (o.isMesh) m.push(o); });
  return m;
};
/** The lowest and highest world y of the bucket's own geometry. */
const bucketY = (root) => {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root.userData.loader.bucket, true);
  return [box.min.y, box.max.y];
};
const lowestBlade = (root) => {
  root.updateMatrixWorld(true);
  const blade = named(root.userData.loader.bucket, /^bucketBlade$/)[0] ?? named(root, /^bucketBlade$/)[0];
  return new THREE.Box3().setFromObject(blade, true).min.y;
};

describe('the loader tractor (#926)', () => {
  it('has the cab, lamps, wipers, beacon, mirrors, step, handle and plate the Looks like list names', () => {
    expect(named(model, /^cabRoof$/)).toHaveLength(1);
    expect(named(model, /^glass$/).length).toBeGreaterThanOrEqual(4); // the screen, the back and a side each
    expect(named(model, /^wiper$/)).toHaveLength(2);
    expect(named(model, /^beacon$/)).toHaveLength(1);
    expect(named(model, /^mirror_arm$/)).toHaveLength(2);
    expect(named(model, /^step$/).length).toBeGreaterThanOrEqual(2);
    expect(named(model, /^grabHandle$/)).toHaveLength(1);
    expect(named(model, /^headlamp(Nose|Roof)$/)).toHaveLength(4);
    expect(named(model, /^grille_/)).toHaveLength(1);
    expect(named(model, /^bonnet$/)).toHaveLength(1);
    expect(named(model, /^lamp_tail$/)).toHaveLength(2);
    expect(named(model, /^decal_badge$/)).toHaveLength(1);
    expect(named(model, /^decal_dealer$/)).toHaveLength(1); // the sticker on the back window
  });

  it('has big rear tyres and smaller front ones, each with a mudguard, and clay between the lugs', () => {
    const r = (name) => {
      const spin = model.getObjectByName(name).getObjectByName('spin');
      return new THREE.Box3().setFromObject(spin, true).getSize(new THREE.Vector3()).y / 2;
    };
    expect(r('wheel_rl')).toBeGreaterThan(r('wheel_fl') * 1.25);
    expect(named(model, /^wingRear/)).toHaveLength(2);
    expect(named(model, /^wingFront$/)).toHaveLength(2);
  });

  it('has the rear linkage, a drawbar, a PTO with its guard and a bundle of four hoses on couplers', () => {
    for (const n of ['drawbar', 'drawbarPin', 'ptoStub', 'ptoGuard', 'valveBlock']) expect(named(model, new RegExp(`^${n}$`)), n).toHaveLength(1);
    expect(named(model, /^coupler$/)).toHaveLength(4);
    expect(named(model, /^couplerCap$/)).toHaveLength(4);
  });

  it('has oil weeping on the engine side and a dent in the rear left wing', () => {
    expect(named(model, /^oilWeep$/).length).toBeGreaterThanOrEqual(10);
    // The dent pushes part of the left wing's sheet in toward the axle: it is lower than the same wing on the right.
    const sheet = (n) => named(model, new RegExp(`^wingRear${n}$`))[0].geometry.attributes.position;
    const innermost = (pos) => {
      let low = Infinity;
      for (let i = 0; i < pos.count; i++) {
        if (Math.abs(pos.getZ(i) + 0.6) < 0.1 && Math.abs(pos.getX(i)) < 0.01) low = Math.min(low, Math.hypot(pos.getY(i), pos.getZ(i))); // along the wing's middle line, not its rolled lip
      }
      return low;
    };
    expect(innermost(sheet('Left'))).toBeLessThan(innermost(sheet('Right')) - 0.02);
  });

  it('has a loader on two arms, a ram each for lifting and tilting, and a bucket with a bright lip and tyre scuffs', () => {
    const { arms, rams, bucket } = model.userData.loader;
    expect(arms).toHaveLength(2);
    expect(rams).toHaveLength(4);
    expect(named(bucket, /^bucketBlade$/)).toHaveLength(1);
    expect(named(bucket, /^tyreScuff$/).length).toBeGreaterThanOrEqual(5);
    expect(named(bucket, /^bladeBolts$/)).toHaveLength(1);
    expect(bucket.userData.keep).toBe(true);
    expect(bucket.children.some((c) => c.isMesh && c.material.color.getHex() === 0x24272a), 'its ribs are part of it, not merged into the body').toBe(true); // the back's ribs and brackets, merged inside the bucket
  });

  it('is parked with the bucket low: its lip just off the ground', () => {
    expect(model.userData.loader.height).toBe(0);
    const lip = lowestBlade(model);
    expect(lip).toBeGreaterThan(-0.03);
    expect(lip).toBeLessThan(0.07);
    expect(bucketY(model)[0]).toBeGreaterThan(-0.06);
  });

  it('lifts: the bucket rises with the height, stays level and the arms turn up', () => {
    const lows = [0, 0.5, 1].map((h) => {
      mod.setLoader(model, h);
      return lowestBlade(model);
    });
    expect(lows[1]).toBeGreaterThan(lows[0] + 0.5);
    expect(lows[2]).toBeGreaterThan(lows[1] + 0.5);
    expect(lows[2]).toBeGreaterThan(2.2);
    const { bucket } = model.userData.loader;
    expect(Math.abs(bucket.rotation.x)).toBeLessThan(0.15); // never tipped far from level
    mod.setLoader(model, 2); // clamped
    expect(model.userData.loader.height).toBe(1);
    mod.setLoader(model, 0);
  });

  it('keeps every ram joined to its two pins at every height, and its stroke in a real range', () => {
    const { rams } = model.userData.loader;
    const worldEnds = (ram) => {
      model.updateMatrixWorld(true);
      const rod = ram.userData.rod;
      rod.geometry.computeBoundingBox();
      const a = new THREE.Vector3(0, 0, 0).applyMatrix4(ram.matrixWorld);
      const len = rod.scale.z; // the rod's length: it reaches from the barrel's end to the far pin
      const b = new THREE.Vector3(0, 0, rod.position.z + len / 2 - 0.1).applyMatrix4(ram.matrixWorld);
      return { a, b, total: a.distanceTo(b) };
    };
    const lengths = new Map();
    for (const h of [0, 0.25, 0.5, 0.75, 1]) {
      mod.setLoader(model, h);
      for (const ram of rams) {
        const { total } = worldEnds(ram);
        if (process.env.RAMS) console.log(ram.name, h, total.toFixed(3));
        expect(total, `${ram.name} at ${h}`).toBeGreaterThan(0.4);
        expect(total, `${ram.name} at ${h}`).toBeLessThan(1.9);
        const l = lengths.get(ram.name) ?? [];
        l.push(total);
        lengths.set(ram.name, l);
      }
    }
    for (const [name, l] of lengths) expect(Math.max(...l) / Math.min(...l), name).toBeLessThan(2.1); // a ram doesn't more than double its length
    mod.setLoader(model, 0);
  });

  it('is the real size: in proportion over its wheelbase, within a metre of the real length, and its collider holds it', async () => {
    const errors = proportionErrors(measureModel(model, mod.LOADER_TRACTOR_LAYOUT), REAL_SIZES.dene);
    for (const [k, e] of Object.entries(errors)) expect(Math.abs(e), `${k} is ${(e * 100).toFixed(1)}% off`).toBeLessThan(PROPORTION_TOLERANCE);
    const { PARKED_SIZES } = await import('../src/world/neighbourFarm.js');
    const s = PARKED_SIZES.loaderTractor;
    model.updateMatrixWorld(true);
    const solid = new THREE.Box3();
    model.traverse((o) => { if (o.isMesh && !o.material.transparent) solid.union(new THREE.Box3().setFromObject(o, true)); });
    expect(solid.max.z).toBeLessThan(s.cz + s.hl + 0.1);
    expect(solid.min.z).toBeGreaterThan(s.cz - s.hl - 0.1);
    expect(Math.max(-solid.min.x, solid.max.x)).toBeLessThan(s.hw + 0.1);
  });

  it('is made up: a Calder Dene 100, with no real make in its name or its lettering', () => {
    expect(SCENERY_NAMES.dene).toEqual({ maker: 'Calder', model: 'Dene 100', say: 'loader tractor' });
  });

  it('stays under the triangle and draw-call budgets (80,000 and 150) once the yard has merged it', async () => {
    const { mergeParkedVehicle } = await import('../src/world/neighbourFarmProps.js');
    const copy = mod.buildLoaderTractorModel({ bodyColor: 0x23548f });
    let tris = 0;
    copy.traverse((o) => {
      if (!o.isMesh) return;
      tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    });
    expect(tris).toBeLessThan(80000);
    mergeParkedVehicle(copy);
    expect(meshes(copy).length).toBeLessThan(150);
  });

  it('has no two faces fighting on one plane', () => {
    mod.setLoader(model, 0);
    // Faces of 3 cm2 or more, as the Crag's and the Finch's tests do. The kit's mirror glass sits a millimetre off its housing's back on purpose (its material is pulled forward in depth), so it is left out.
    const found = coplanarOverlaps(model, { textured: true, skip: (o) => o.name === 'mirrorGlass' }).filter((f) => f.area > 3e-4);
    expect(found.map((f) => `${f.axis}${f.dir > 0 ? '+' : '-'} ${f.at.map((v) => v.toFixed(2)).join(',')} ${f.area?.toFixed?.(4)}`)).toEqual([]);
  });
});
