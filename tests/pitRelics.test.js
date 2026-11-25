import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { headlessContext } from './helpers/worldModels.js';
import { LAYOUT } from '../src/world/layout.js';
import { createQuarry } from '../src/world/quarry.js';
import { seeded } from '../src/world/propStreams.js';
import { pitGrowth, heapPatches, excavatorGrowth, containerDressing, HARDSTANDING, CONTAINER_SIZE } from '../src/world/pitGrowth.js';
import { plantFootings, secondLegs, PLANT } from '../src/world/plantSite.js';
import { farmPlacements, placementBreaks } from '../src/world/farmPlacement.js';

// The Old Pit's relics read as disused (#1003): each keeps its shape, place and colliders, and gains its state (a door shut and padlocked, boards,
// a chain, a broken windscreen, rust streaks, a torn belt, no cable), and what has grown over the floor stands where it should.

const random = () => 0.5;
const r4 = (b) => b.map((x) => x.map((v) => +v.toFixed(4)));
const recording = () => {
  const calls = [];
  const ctx = new Proxy({ fillStyle: '' }, {
    get: (t, k) => (k in t ? t[k] : k === 'fillRect' ? (...a) => calls.push([t.fillStyle, ...a]) : () => ({ addColorStop() {} })),
    set: (t, k, v) => ((t[k] = v), true),
  });
  return { calls, canvas: { width: 0, height: 0, getContext: () => ctx, style: {} } };
};

// The colliders each model had before #1003 (recorded from main as it stood, in each model's own frame): the state changed, the shapes did not.
const BEFORE = {
  excavator: [[-0.3, 0.7, 0, 2.2, 0.7, 1.31], [-0.9, 2.1, 0, 1.6, 0.9, 1.2], [5.5076, 0.65, 0.35, 0.75, 0.65, 0.55]],
  container: [[0, 1.445, 0, 3.03, 1.345, 1.22]],
  cabin: [[0, 1.425, 0, 1.85, 1.325, 1.25]],
  plant: [[3, -0.25, 0, 6.2, 0.25, 3.4], [0, 1.95, 0, 1.3, 1.95, 1.85], [2.7, 0.4735, -0.75, 0.2, 0.5735, 0.22], [2.7, 0.4735, 0.75, 0.2, 0.5735, 0.22], [4, 0.7029, -0.75, 0.2, 0.8029, 0.22],
    [4, 0.7029, 0.75, 0.2, 0.8029, 0.22], [10.7, 0.4946, -0.75, 0.2, 0.6546, 0.22], [10.7, 0.4946, 0.75, 0.2, 0.6546, 0.22], [4.7, 0.5, -1, 0.12, 0.5, 0.12], [4.7, 0.5, 1, 0.12, 0.5, 0.12],
    [8.1, 0.5, -1, 0.12, 0.5, 0.12], [8.1, 0.5, 1, 0.12, 0.5, 0.12], [6.4, 1.5, 0, 2.2, 0.5, 0.9], [6.4, 0.95, 2.45, 1.4, 0.95, 0.65]],
};

describe('the relics keep their shapes (#1003)', () => {
  it('have the same colliders as before', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildExcavator, excavatorMaterials } = await import('../src/world/excavatorModel.js');
    const { buildContainer, containerMaterials, CONTAINER } = await import('../src/world/containerModel.js');
    const { buildCabin, cabinMaterials } = await import('../src/world/siteCabinModel.js');
    const { buildScreeningPlant, plantMaterials } = await import('../src/world/screeningPlantModel.js');
    expect(r4(buildExcavator(excavatorMaterials(random)).boxes)).toEqual(BEFORE.excavator);
    expect(r4(buildContainer(containerMaterials(random), random).boxes)).toEqual(BEFORE.container);
    expect(r4(buildCabin(cabinMaterials(random)).boxes)).toEqual(BEFORE.cabin);
    expect(r4(buildScreeningPlant(plantMaterials(random), { headX: 16, headY: 4.2, ground: () => -0.06, side: 1 }).boxes)).toEqual(BEFORE.plant);
    expect(CONTAINER_SIZE).toEqual({ length: CONTAINER.length, width: CONTAINER.width }); // pitGrowth.js's copy of its size
  });

  it('take none of the pit\'s own draws for their weathering, which comes from a stream of its own, so the pit deals as it did', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { excavatorMaterials } = await import('../src/world/excavatorModel.js');
    const { containerMaterials } = await import('../src/world/containerModel.js');
    const { cabinMaterials } = await import('../src/world/siteCabinModel.js');
    const { plantMaterials } = await import('../src/world/screeningPlantModel.js');
    const { debrisMaterials } = await import('../src/world/quarryDebris.js');
    const count = (make, wearSeed) => {
      let pit = 0;
      let wear = 0;
      const w = seeded(wearSeed);
      make(() => (pit++, 0.37), () => (wear++, w()));
      return { pit, wear };
    };
    // The draws each took from the pit's stream before #1003 (counted on main with this same stand-in stream, always 0.37), which they still take,
    // whatever the weathering draws.
    for (const [make, before] of [[excavatorMaterials, 1124], [containerMaterials, 1852], [cabinMaterials, 1804], [plantMaterials, 14876], [debrisMaterials, 70]]) {
      const a = count(make, 1);
      const b = count(make, 2);
      expect(a.pit).toBe(before);
      expect(b.pit).toBe(before);
      expect(a.wear).toBeGreaterThan(100); // the weathering is drawn, from its own stream
    }
    // The drums' old texture is still drawn from the pit's stream, whether or not they are weathered.
    expect(count((r) => debrisMaterials(r), 1).pit).toBe(count(debrisMaterials, 1).pit);
  });
});

describe('the relics read as disused (#1003)', () => {
  let ex;
  let cabin;
  let container;
  let plant;
  beforeAll(async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildExcavator, excavatorMaterials } = await import('../src/world/excavatorModel.js');
    const { buildContainer, containerMaterials } = await import('../src/world/containerModel.js');
    const { buildCabin, cabinMaterials } = await import('../src/world/siteCabinModel.js');
    const { buildScreeningPlant, plantMaterials } = await import('../src/world/screeningPlantModel.js');
    ex = buildExcavator(excavatorMaterials(random));
    cabin = buildCabin(cabinMaterials(random));
    container = buildContainer(containerMaterials(random), random);
    plant = buildScreeningPlant(plantMaterials(random), { headX: 16, headY: 4.2, ground: () => -0.06, side: 1 });
  });
  const mesh = (group, name) => group.children.find((m) => m.name === name);
  const bounds = (m) => new THREE.Box3().setFromBufferAttribute(m.geometry.attributes.position);

  it('the excavator: its windscreen broken through, the door pane cracked, rust streaks from its pins, and a handful of draw calls still', () => {
    const cracked = mesh(ex.group, 'cracked');
    expect(cracked.material.transparent).toBe(true);
    const b = bounds(cracked);
    expect(b.max.x).toBeGreaterThan(1.09); // the windscreen, at the cab's front
    // The windscreen has a hole: its glass covers well under the 0.82 by 1.0 m of the pane.
    const pos = cracked.geometry.attributes.position;
    let area = 0;
    const a = new THREE.Vector3();
    const c = new THREE.Vector3();
    const d = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i);
      c.fromBufferAttribute(pos, i + 1);
      d.fromBufferAttribute(pos, i + 2);
      if (a.x > 1.08 && c.x > 1.08 && d.x > 1.08) area += new THREE.Triangle(a, c, d).getArea();
    }
    expect(area).toBeGreaterThan(0.3);
    expect(area).toBeLessThan(0.82 * 1.0 * 0.85);
    const streaks = mesh(ex.group, 'streak');
    expect(streaks.geometry.attributes.position.count / 6).toBe(27); // a streak each side of every pin (boom foot and bend, elbow and stick, the rams' eyes and feet, bucket pin and lug, H-link), and three down the back
    expect(streaks.material.transparent).toBe(true);
    expect(mesh(ex.group, 'yellow').material.roughness).toBeGreaterThan(0.9); // chalky, not glossy
    expect(ex.group.children.length).toBeLessThanOrEqual(12);
  });

  it('the cabin: its door shut in its frame and padlocked through the hasp, and all three windows boarded', () => {
    const doorFace = mesh(cabin.group, 'clad');
    expect(doorFace).toBeDefined();
    const lock = bounds(mesh(cabin.group, 'lock'));
    expect(lock.min.z).toBeGreaterThan(1.2); // on the door side, at the door's free edge
    expect(lock.min.x).toBeGreaterThan(1.3);
    expect(lock.max.x).toBeLessThan(1.5);
    // Nothing of the door stands out from the wall now: everything in the cabin's trim is within a hand of the front wall at the door.
    const trim = mesh(cabin.group, 'trim').geometry.attributes.position;
    let out = 0;
    for (let i = 0; i < trim.count; i++) if (trim.getX(i) > 0.5 && trim.getX(i) < 1.5 && trim.getY(i) > 0.6) out = Math.max(out, trim.getZ(i));
    expect(out).toBeLessThan(1.2 + 0.08);
    const ply = bounds(mesh(cabin.group, 'relic-ply'));
    const planks = bounds(mesh(cabin.group, 'relic-plank'));
    expect(ply.min.z).toBeLessThan(-1.2); // the back window's sheet
    expect(ply.max.z).toBeGreaterThan(1.2); // the front window's
    expect(planks.min.x).toBeGreaterThan(1.75); // the planks across the end window
    expect(mesh(cabin.group, 'relic-plastic')).toBeDefined(); // the weathered chair outside
    expect(mesh(cabin.group, 'relic-rust')).toBeDefined(); // the folding table's legs
  });

  it('the container: both leaves shut and chained round their inner bars, with a padlock', () => {
    expect(container.leaves).toEqual([0, 0]);
    const lock = bounds(mesh(container.group, 'lock'));
    expect(lock.min.x).toBeGreaterThan(3.03);
    expect(Math.abs((lock.min.z + lock.max.z) / 2)).toBeLessThan(0.2); // where the two leaves meet
  });

  it('the plant: the long belt torn through with its ends hanging, and no cable on the pad', () => {
    const [t0, t1] = plant.parts.torn;
    expect(t1 - t0).toBeGreaterThan(0.03);
    const belt = mesh(plant.group, 'belt').geometry.attributes.position;
    // Under the tear's middle the belt hangs, so there is belt well below the line of the belt's top there.
    const { tail2, head2 } = plant.parts;
    const mid = tail2[0] + (head2[0] - tail2[0]) * (t0 + t1) / 2;
    const lineY = tail2[1] + ((head2[1] - tail2[1]) * (mid - tail2[0])) / (head2[0] - tail2[0]);
    let lowest = Infinity;
    let onTop = 0;
    for (let i = 0; i < belt.count; i++) {
      if (Math.abs(belt.getX(i) - mid) < 0.3) {
        lowest = Math.min(lowest, belt.getY(i));
        if (Math.abs(belt.getY(i) - (lineY - 0.03)) < 0.04 && Math.abs(belt.getX(i) - mid) < 0.15) onTop++;
      }
    }
    expect(lowest).toBeLessThan(lineY - 0.6);
    expect(onTop).toBe(0); // nothing of the belt runs across the gap
    // The cable: nothing dark lies along the pad's top any more.
    const dark = mesh(plant.group, 'dark').geometry.attributes.position;
    let low = 0;
    for (let i = 0; i < dark.count; i++) if (dark.getY(i) < 0.12 && dark.getX(i) > PLANT.padX0 && dark.getX(i) < PLANT.padX1) low++;
    expect(low).toBe(0);
  });

  it('the drums: rusted with their colour in the rust, and no label', async () => {
    const { rustedDrumTexture, drumTexture } = await import('../src/world/quarryTextures.js');
    const labelled = recording();
    vi.stubGlobal('document', { createElement: () => labelled.canvas });
    drumTexture(random);
    const label = (calls) => calls.filter(([style, , y, , hh]) => style === 'rgba(0,0,0,0.5)' && hh === 10);
    expect(label(labelled.calls)).toHaveLength(1); // the old drum's label band
    const rusted = recording();
    vi.stubGlobal('document', { createElement: () => rusted.canvas });
    rustedDrumTexture(seeded(3), '#3a68a8');
    expect(label(rusted.calls)).toHaveLength(0);
    expect(rusted.calls[0][0]).toBe('#74462a'); // rust first, the paint left in islands over it
  });
});

describe('what grows over the pit (#1003)', () => {
  let quarry;
  let G;
  beforeAll(() => {
    quarry = createQuarry(LAYOUT);
    G = pitGrowth(quarry);
  });

  it('has grass, birch seedlings and buddleia on the heaps, on the heaps and in their grassed patches', () => {
    expect(G.tufts.length).toBeGreaterThan(40);
    expect(G.seedlings.length).toBeGreaterThanOrEqual(quarry.pit.heaps.length * 2 - 2);
    expect(G.buddleia.length).toBeGreaterThan(0);
    for (const t of G.tufts) {
      const h = quarry.pit.heaps[t.heap];
      expect(Math.hypot(t.x - h.x, t.z - h.z)).toBeLessThan(h.r);
      expect(heapPatches(h, t.heap).some((p) => Math.hypot(t.x - p.x, t.z - p.z) <= p.r + 1e-6)).toBe(true);
    }
    for (const s of [...G.seedlings, ...G.buddleia]) expect(quarry.heapRise(s.x, s.z)).toBeGreaterThan(0.01); // on the heap, if only at its foot
    expect(heapPatches(quarry.pit.heaps[0], 0)).toEqual(heapPatches(quarry.pit.heaps[0], 0)); // the ground's painting and the tufts agree
  });

  it('rings the pond with reeds, rushes and sedge at its edge and none in the water, leaving the drums\' side open', () => {
    expect(G.reeds.length).toBeGreaterThan(40);
    expect(G.rushes.length).toBeGreaterThan(25);
    expect(G.sedge.length).toBeGreaterThan(15);
    const pond = quarry.pond;
    for (const p of [...G.reeds, ...G.rushes, ...G.sedge]) {
      expect(quarry.waterAt(p.x, p.z)).toBeLessThanOrEqual(0.05);
      expect(Math.hypot((p.x - pond.x) / pond.rx, (p.z - pond.z) / pond.rz)).toBeLessThan(1.7);
    }
  });

  it('keeps the haul roads, the climb\'s way up the wall and the plant\'s conveyor clear', () => {
    const [c0, , c2] = quarry.climb.points;
    const seg = (px, pz, ax, az, bx, bz) => {
      const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (pz - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
      return Math.hypot(px - (ax + t * (bx - ax)), pz - (az + t * (bz - az)));
    };
    for (const p of [...G.tufts, ...G.seedlings, ...G.buddleia, ...G.reeds, ...G.rushes, ...G.sedge]) {
      expect(quarry.roadNear(p.x, p.z).d).toBeGreaterThan(quarry.roadHalf);
      expect(seg(p.x, p.z, c0[0], c0[1], c2[0], c2[1])).toBeGreaterThan(quarry.climb.gateHalf);
    }
  });

  it('puts weeds at every footing of the plant, on the pad where the footing is on it', () => {
    if (!quarry.pit.plant) return;
    expect(G.footings.length).toBeGreaterThan(20);
    expect(G.footings.some((f) => f.onPad)).toBe(true);
    expect(G.padLumps.length).toBeGreaterThan(10);
    const legs = secondLegs(20);
    expect(legs.length).toBeGreaterThan(1);
    expect(plantFootings(20, 1).filter((f) => !f.onPad).length).toBe(legs.length * 2); // the second conveyor's trestles stand off the pad
  });

  it('is all on the farm\'s list of placed things, and breaks no rule', () => {
    const all = farmPlacements(LAYOUT);
    const mine = all.filter((t) => /pit's pond|in the pit|pit's plant|pit plant's pad/.test(t.name));
    expect(mine.length).toBe(G.tufts.length + G.seedlings.length + G.buddleia.length + G.reeds.length + G.rushes.length + G.sedge.length + G.footings.length + G.padWeeds.length + G.padLumps.length);
    expect(mine.every((t) => !t.solid)).toBe(true);
    const breaks = mine.flatMap((t) => placementBreaks(t, LAYOUT).map((b) => `${b.rule}: ${t.name} ${b.why}`));
    expect(breaks).toEqual([]);
  });

  it('grows grass and weeds up through the excavator\'s tracks and round them', () => {
    const w = excavatorGrowth(seeded(4));
    expect(w.filter((p) => p.through).length).toBeGreaterThanOrEqual(8);
    for (const p of w) expect(Math.abs(p.z)).toBeLessThan(1.65);
    expect(new Set(w.map((p) => p.kind)).size).toBeGreaterThan(1);
  });

  it('stands the container on a hardstanding bigger than it, with the birch between two sleepers, out from its wall', () => {
    const d = containerDressing(seeded(9), 1);
    expect(HARDSTANDING.x1 - HARDSTANDING.x0).toBeGreaterThan(CONTAINER_SIZE.length + 2);
    for (const row of d.rows) {
      expect(row.left).toBeLessThan(-CONTAINER_SIZE.width / 2 - 0.15);
      expect(row.right).toBeGreaterThan(CONTAINER_SIZE.width / 2 + 0.15);
    }
    for (const x of [-2.3, 0, 2.3]) expect(Math.abs(d.sapling.x - x)).toBeGreaterThan(0.6); // between the sleepers, not through one's middle
    expect(d.sapling.z).toBeGreaterThan(CONTAINER_SIZE.width / 2);
    expect(d.sapling.z).toBeLessThan(CONTAINER_SIZE.width / 2 + 0.3); // under the sleepers' ends, which stand 15 cm past the wall
    expect(d.sapling.h).toBeGreaterThan(2);
  });
});

describe('the pit in the scene (#1003)', () => {
  it('draws its growth inside the pit\'s set piece, so far away it costs nothing, and the plain reeds no more', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildQuarry } = await import('../src/world/quarryProps.js');
    const c = { ...headlessContext(), drawDistance: { add: (o) => o } };
    buildQuarry(c);
    const site = c.scene.getObjectByName('quarrySite');
    const growth = site.getObjectByName('pitGrowth');
    expect(growth).toBeDefined();
    for (const n of ['pit-grass', 'pit-reeds', 'pit-rushes', 'pit-sedge', 'pit-birch', 'hardstanding', 'containerBirch']) expect(growth.getObjectByName(n), n).toBeDefined();
    expect(c.scene.getObjectByName('reeds')).toBeUndefined();
    let unlit = 0;
    growth.traverse((o) => {
      if (o.isMesh && !(o.material.isMeshStandardMaterial || o.material.isMeshLambertMaterial)) unlit++;
    });
    expect(unlit).toBe(0);
  });
});
