import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { LAYOUT } from '../src/world/layout.js';
import { neighbourFarmShape, dealNeighbourVehicles, PARKED_SIZES } from '../src/world/neighbourFarm.js';
import { VEHICLE_NAMES } from '../src/world/farDetail.js';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { headlessContext } from './helpers/worldModels.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';

let buildVehicleBody;
let buildTipTrailerModel;
beforeAll(async () => {
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  ({ buildVehicleBody } = await import('../src/world/trafficView.js'));
  ({ buildTipTrailerModel } = await import('../src/vehicle/tipTrailerModel.js'));
});

const named = (root, name) => {
  const found = [];
  root.traverse((o) => { if (o.name === name) found.push(o); });
  return found;
};
/** The box of what is solid in a model: the headlight's beam and halo are see-through light, and not part of the vehicle. */
const solidBox = (root, keep = () => true) => {
  const box = new THREE.Box3();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || o.material.transparent || !keep(o)) return;
    box.union(new THREE.Box3().setFromObject(o, true));
  });
  return box;
};

describe('the neighbour\'s farm quad and tipping trailer (#925)', () => {
  const S = neighbourFarmShape(LAYOUT);
  const quad = S.parked.find((p) => p.kind === 'quad');
  const trailer = S.parked.find((p) => p.kind === 'tipTrailer');

  it('parks one of each in the yard, with the quad in a paint from the layout', () => {
    expect(quad).toBeTruthy();
    expect(trailer).toBeTruthy();
    expect(quad.colour).toBeGreaterThan(0);
    expect(PARKED_SIZES.quad).toMatchObject({ hl: expect.any(Number), hw: expect.any(Number), h: expect.any(Number) });
    expect(PARKED_SIZES.tipTrailer.cz).toBeGreaterThan(0);
  });

  it('puts the quad by the collecting yard\'s gap and the trailer by the barn\'s door', () => {
    expect(Math.hypot(quad.x - S.collecting.minX, quad.z - S.collecting.gap.z)).toBeLessThan(8);
    expect(Math.hypot(trailer.x - S.barn.door.x, trailer.z - S.barn.door.z)).toBeLessThan(8);
    expect(quad.z).toBeLessThan(S.collecting.gap.z - S.collecting.gap.width / 2); // north of the gap, on the fence, not across the way the herd comes in
  });

  it('has colliders that hold each model: its length and width inside the box, and the box no taller than the vehicle by much', () => {
    for (const p of [quad, trailer]) {
      const { object } = buildVehicleBody(p.kind, p.colour, null, null);
      const box = solidBox(object);
      const s = PARKED_SIZES[p.kind];
      const cz = s.cz ?? 0;
      expect(box.min.z, `${p.kind} back`).toBeGreaterThan(cz - s.hl - 0.12);
      expect(box.max.z, `${p.kind} front`).toBeLessThan(cz + s.hl + 0.12);
      expect(box.max.z - box.min.z, `${p.kind} length`).toBeGreaterThan(s.hl * 2 - 0.5);
      expect(Math.max(-box.min.x, box.max.x), `${p.kind} width`).toBeLessThan(s.hw + 0.1);
      expect(box.max.y - box.min.y, `${p.kind} height`).toBeLessThan(s.h + 0.35);
      expect(box.max.y - box.min.y, `${p.kind} height`).toBeGreaterThan(s.h - 0.45);
    }
  });

  it('builds them as the farm\'s own vehicles, named as FarDetail trims and merges them', () => {
    for (const kind of ['quad', 'tipTrailer']) {
      const { object } = buildVehicleBody(kind, 0x4c6a3c, null, null);
      expect(VEHICLE_NAMES).toContain(object.name);
    }
  });

  it('dresses the quad: a crate bungeed on, a blanket on the seat, mud in the footwells', () => {
    const { object } = buildVehicleBody('quad', 0x4c6a3c, null, null);
    expect(named(object, 'crate')).toHaveLength(1);
    expect(named(object, 'bungee').length).toBeGreaterThanOrEqual(4);
    expect(named(object, 'blanket')).toHaveLength(1);
    expect(named(object, 'footwellLeft')).toHaveLength(1);
    const mud = [];
    object.traverse((o) => { if (o.isMesh && o.geometry.type === 'SphereGeometry') mud.push(o); });
    expect(mud.length).toBeGreaterThanOrEqual(12);
    for (const m of mud) expect(Math.abs(m.position.x)).toBeGreaterThan(0.3); // on the footwells' plates (x about 0.445), not on the seat or the tank
    expect(named(object, 'frontPanel').length).toBeGreaterThan(0); // the front rack and rear rack come with the utility body: the crate sits on the rear one
  });

  it('dresses the trailer: straw, a tarp tied on, a side let down, the jockey wheel down, a rear lamp cracked and the drop sides\' hinges, and leaves the player\'s alone', () => {
    const { object } = buildVehicleBody('tipTrailer', 0x8a9092, null, null);
    expect(named(object, 'straw')).toHaveLength(1);
    expect(named(object, 'tarp')).toHaveLength(1);
    expect(named(object, 'dropSide')).toHaveLength(1); // one drop side let down, lying out flat
    expect(named(object, 'twine').length).toBeGreaterThanOrEqual(8);
    expect(named(object, 'lampCrack').length).toBeGreaterThanOrEqual(8);
    // The jockey wheel is merged into the model's meshes (staticMerge): it is the lowest thing under the drawbar, in line with it and forward of the tub.
    const lowestUnderDrawbar = (root) => {
      let low = Infinity;
      const v = new THREE.Vector3();
      root.updateMatrixWorld(true);
      root.traverse((o) => {
        if (!o.isMesh || o.material.transparent) return;
        const p = o.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
          if (v.z > 1.3 && v.z < 1.55 && Math.abs(v.x) < 0.1 && v.y < 0.4) low = Math.min(low, v.y);
        }
      });
      return low;
    };
    expect(lowestUnderDrawbar(object)).toBeLessThan(0.02); // its little wheel is on the ground
    expect(lowestUnderDrawbar(object)).toBeGreaterThan(-0.03);
    const plain = buildTipTrailerModel();
    expect(named(plain, 'straw')).toHaveLength(0);
    expect(named(plain, 'tarp')).toHaveLength(0);
    expect(named(plain, 'dropSide')).toHaveLength(0);
    expect(lowestUnderDrawbar(plain)).toBeGreaterThan(0.1); // the player's is wound up
  });

  it('keeps the farm\'s own paint materials per vehicle: the neighbour\'s rust is not on the player\'s trailer', () => {
    const mine = buildTipTrailerModel();
    const hers = buildVehicleBody('tipTrailer', 0, null, null).object;
    const mats = (o) => { const s = new Set(); o.traverse((m) => { if (m.isMesh) s.add(m.material); }); return s; };
    const rusted = [...mats(hers)].filter((m) => m.map && !mats(mine).has(m)); // hers has the tub's and inside's own, rusted
    expect(rusted.length).toBeGreaterThanOrEqual(2);
  });
});

describe('what the neighbour\'s dressing adds does not fight with what it lies on (#925)', () => {
  const faces = (root) => coplanarOverlaps(root, { textured: true }).map((f) => `${f.axis}${f.dir > 0 ? '+' : '-'} ${f.at.map((v) => v.toFixed(2)).join(',')}`);

  it('puts no coplanar overlap on the quad that the plain Farm 300 body does not have', async () => {
    const { buildQuadModel } = await import('../src/vehicle/quadModel.js');
    const plain = faces(buildQuadModel({ bodyColor: 0x4c6a3c, dashStyle: 'farm300', style: 'utility' }));
    const { buildFarmQuad } = await import('../src/world/neighbourVehicles.js');
    const hers = faces(buildFarmQuad(0x4c6a3c));
    expect(hers.filter((f) => !plain.includes(f))).toEqual([]);
  });

  it('puts none on the trailer that the player\'s does not have', async () => {
    const plain = faces(buildTipTrailerModel());
    const { DEFAULT_TRAILER_LOOK } = await import('../src/world/neighbourVehicles.js');
    const hers = faces(buildTipTrailerModel({ farm: DEFAULT_TRAILER_LOOK })); // with its let-down side
    expect(hers.filter((f) => !plain.includes(f))).toEqual([]);
  });
});

describe('her trailer as the yard builds it (#1149)', () => {
  it('has the let-down side resting above the wheel and its mudguard, and the guards the same rusted steel as the tub', async () => {
    const THREE_ = THREE;
    const { DEFAULT_TRAILER_LOOK } = await import('../src/world/neighbourVehicles.js');
    const model = buildTipTrailerModel({ farm: DEFAULT_TRAILER_LOOK });
    model.updateMatrixWorld(true);
    const side = named(model, 'dropSide')[0];
    const box = new THREE_.Box3().setFromObject(side, true);
    // The wheel's top is 0.60 and the guard's arc 0.67 over x 0.56 to 0.78 (at z 0): the side's lowest face over that stretch must clear both.
    const ray = new THREE_.Raycaster(new THREE_.Vector3(-0.7, 3, 0), new THREE_.Vector3(0, -1, 0));
    const hits = ray.intersectObject(model, true).filter((h) => !h.object.material.transparent);
    const sideTop = hits.find((h) => { let o = h.object; while (o) { if (o === side) return true; o = o.parent; } return false; });
    const guard = hits.find((h) => h.object.material.map && h.object.geometry.type === 'CylinderGeometry');
    expect(box.max.x - box.min.x).toBeGreaterThan(0.3);
    expect(sideTop, 'the ray meets the side').toBeTruthy();
    expect(sideTop.point.y, 'the side is above the guard').toBeGreaterThan(0.67);
    expect(guard, 'a guard with the rusted texture, not a plain white one').toBeTruthy();
  });

  it('has a collider centred on the trailer\'s middle, and its model inside it', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildNeighbourFarm } = await import('../src/world/neighbourFarmProps.js');
    const c = headlessContext();
    const heights = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints));
    const boxes = [];
    const built = buildNeighbourFarm({ ...c, layout: LAYOUT, heights, fixedBox: (...a) => (boxes.push(a), { setEnabled() {} }), gateParams: { swingSeconds: 1, blockBelow: 0.5, clearRadius: 3 } });
    built.group.updateMatrixWorld(true);
    for (const kind of ['quad', 'tipTrailer']) {
      const v = built.vehicles.find((p) => p.kind === kind);
      const [x, , z, hx, , hz, yaw] = boxes.find((b) => Math.abs(b[0] - v.x) < 1e-9 && Math.abs(b[2] - v.z) < 1e-9 && b[3] === PARKED_SIZES[kind].hw) ?? [];
      expect([x, z], `${kind} collider centre`).toEqual([v.x, v.z]);
      expect([hx, hz, yaw]).toEqual([PARKED_SIZES[kind].hw, PARKED_SIZES[kind].hl, v.yaw]);
      // Its drawn model, in the collider's own frame (x across, z along), is inside it.
      const sin = Math.sin(v.yaw);
      const cos = Math.cos(v.yaw);
      const p = new THREE.Vector3();
      let worst = 0;
      v.object.traverse((o) => {
        if (!o.isMesh || o.material.transparent) return;
        const a = o.geometry.attributes.position;
        for (let i = 0; i < a.count; i += 3) {
          p.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld);
          const dx = p.x - v.x;
          const dz = p.z - v.z;
          worst = Math.max(worst, Math.abs(dx * cos - dz * sin) - hx, Math.abs(dx * sin + dz * cos) - hz);
        }
      });
      expect(worst, `${kind}: how far its model pokes out of the collider`).toBeLessThan(0.12);
    }
  });
});

describe('what the farm seed deals her quad and trailer (#925)', () => {
  const looks = (seed) => dealNeighbourVehicles(LAYOUT, seed).neighbourFarm.parked.filter((p) => p.look).map((p) => [p.kind, p.look]);

  it('gives each a look, the same for one farm seed every time and not the same for every farm', () => {
    expect(looks(41).map(([k]) => k)).toEqual(['quad', 'tipTrailer']);
    expect(looks(41)).toEqual(looks(41));
    const seen = new Set();
    for (let seed = 1; seed <= 12; seed++) seen.add(JSON.stringify(looks(seed)));
    expect(seen.size).toBeGreaterThan(8);
  });

  it('keeps every dealt number in range and the other vehicles and the layout as they were', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const dealt = dealNeighbourVehicles(LAYOUT, seed);
      const [[, q], [, t]] = looks(seed);
      expect(q.fade).toBeGreaterThanOrEqual(0.3);
      expect(q.fade).toBeLessThanOrEqual(1);
      expect([0, 1, 2, 3]).toContain(q.blanket);
      expect(t.rust).toBeGreaterThanOrEqual(0.35);
      expect(t.rust).toBeLessThanOrEqual(0.9);
      expect(t.straw).toBeLessThanOrEqual(0.85);
      expect(dealt.neighbourFarm.parked.filter((p) => !p.look)).toEqual(LAYOUT.neighbourFarm.parked.filter((p) => p.kind !== 'quad' && p.kind !== 'tipTrailer'));
    }
    const bare = { neighbourFarm: { parked: [{ kind: 'tor' }] } };
    expect(dealNeighbourVehicles(bare, 3)).toBe(bare);
  });
});
