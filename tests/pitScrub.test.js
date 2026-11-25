import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { headlessContext } from './helpers/worldModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { LAYOUT } from '../src/world/layout.js';
import { createFields } from '../src/world/fields.js';
import { createQuarry, quarryOf, quarryPlants, PIT_PLANTS } from '../src/world/quarry.js';
import { pitRide, rideDistance, scrubOk, pitCover, pitLip, pitTreeLine, relicScrub, byArea, fieldArea, bowlArea, lipNearness, PIT_SCRUB } from '../src/world/pitScrub.js';
import { pitWallColour, PIT_BEDS, PIT_WALL } from '../src/world/quarryTextures.js';
import { HARDSTANDING, framePoint } from '../src/world/pitGrowth.js';
import { polygonBounds } from '../src/world/polygons.js';

// The Old Pit's walls, field and rim worn and overgrown (#1004): what is dealt and where, the walls' colours, and the rebuilt small things.

const fields = createFields(LAYOUT);
const quarry = fields.quarry;
const HA = 10000;

/** The pit's field scaled `k` times about the pit's middle, with the same pit, roads and gates: for how the scrub goes with the field's size. */
function scaledQuarry(k) {
  const q = quarryOf(LAYOUT);
  const { x, z } = q.centre;
  const outline = q.outline.map(([px, pz]) => [x + (px - x) * k, z + (pz - z) * k]);
  const b = polygonBounds(outline);
  return createQuarry({ ...LAYOUT, quarry: { ...q, outline, minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ } });
}

describe('the scrub goes with the field\'s size, to its caps (#1004)', () => {
  const sizes = [0.75, 1, 1.4, 2.5].map((k) => {
    const q = scaledQuarry(k);
    return { k, q, area: fieldArea(q) / HA, plants: quarryPlants(q) };
  });

  it('deals as many bushes and flints as the field\'s area gives, more on a bigger field, and stops at the caps', () => {
    for (const { area, plants, k } of sizes) {
      expect(plants.bushes.length, `bushes at ${k}`).toBe(byArea(PIT_PLANTS.bushes, area));
      expect(plants.stones.length, `stones at ${k}`).toBe(byArea(PIT_PLANTS.stones, area));
    }
    expect(sizes[0].plants.bushes.length).toBeLessThan(sizes[1].plants.bushes.length);
    expect(sizes[1].plants.bushes.length).toBeLessThan(sizes[2].plants.bushes.length);
    expect(sizes[3].plants.bushes.length).toBe(PIT_PLANTS.bushes[1]);
    expect(sizes[0].plants.stones.length).toBeLessThan(sizes[1].plants.stones.length);
    expect(sizes[3].plants.stones.length).toBe(PIT_PLANTS.stones[1]);
  });

  it('caps the trees dealt, however big the field', () => {
    for (const { plants, area, k } of sizes) {
      expect(plants.trees.length, `trees at ${k}`).toBe(byArea(PIT_PLANTS.trees, area));
      expect(plants.trees.length).toBeLessThanOrEqual(PIT_PLANTS.trees[1]);
    }
    expect(sizes[0].plants.trees.length).toBeLessThan(PIT_PLANTS.trees[1]);
    expect(sizes[3].plants.trees.length).toBe(PIT_PLANTS.trees[1]);
  });

  it('deals the walls\' stones and big boulders by the bowl\'s area, to their caps', () => {
    const plants = quarryPlants(quarry);
    expect(plants.boulders.length).toBe(byArea(PIT_PLANTS.boulders, bowlArea(quarry) / HA));
    expect(plants.big.length).toBe(byArea(PIT_PLANTS.big, bowlArea(quarry) / HA));
    const wide = { ...quarry, pit: { ...quarry.pit, rx: quarry.pit.rx * 2, rz: quarry.pit.rz * 2 } }; // a bowl four times the area, the walls as they are
    expect(bowlArea(wide)).toBeCloseTo(bowlArea(quarry) * 4, 3);
    expect(quarryPlants(wide).boulders.length).toBe(PIT_PLANTS.boulders[1]);
  });

  it('puts the bushes thicker near the lip, and the birch thickest there', () => {
    const { bushes } = quarryPlants(quarry);
    const near = bushes.filter(([x, z]) => lipNearness(quarry, x, z) > 0.5);
    const area = fieldArea(quarry) - bowlArea(quarry);
    const lipArea = [...Array(360).keys()].reduce((t, i) => {
      const a = (i / 360) * Math.PI * 2;
      const r = quarry.rimAt(a);
      return t + ((Math.PI * 2) / 360) * (((r + 8.5) ** 2 - r ** 2) / 2); // the band within which the nearness is over a half
    }, 0);
    expect(near.length / lipArea).toBeGreaterThan(3 * ((bushes.length - near.length) / (area - lipArea)));
    const share = (list, kind) => list.filter((b) => b[3] === kind).length / list.length;
    expect(share(near, 'birch')).toBeGreaterThan(share(bushes.filter((b) => !near.includes(b)), 'birch'));
    for (const kind of ['hawthorn', 'gorse', 'bramble', 'birch']) expect(bushes.some((b) => b[3] === kind), kind).toBe(true);
  });
});

describe('the ride and what the scrub keeps off (#1004)', () => {
  const ride = pitRide(quarry);
  const plants = quarryPlants(quarry);
  const cover = pitCover(quarry);
  const all = [...plants.bushes.map(([x, z]) => ({ x, z })), ...plants.trees.map(([x, z]) => ({ x, z })), ...cover.tussocks, ...cover.thistles];

  it('runs a ride round the pit beyond the lip, inside the field, and out to the farm gate', () => {
    for (const [x, z] of ride.loop) {
      expect(quarry.inQuarry(x, z, 6)).toBe(true);
      const { a, s } = quarry.polar(x, z);
      expect(s - quarry.rimAt(a)).toBeGreaterThan(6);
    }
    expect(Math.hypot(ride.spur[0][0] - quarry.way.x, ride.spur[0][1] - quarry.way.z)).toBeLessThan(2);
  });

  it('keeps the ride, the haul roads, the climb\'s way over the lip, the gates and the held places clear', () => {
    const [c0, , c2] = quarry.climb.points;
    for (const p of all) {
      expect(rideDistance(ride, p.x, p.z)).toBeGreaterThan(ride.half);
      expect(quarry.roadNear(p.x, p.z).d).toBeGreaterThan(quarry.roadHalf + 2);
      expect(quarry.inPit(p.x, p.z)).toBe(false);
      for (const g of quarry.gates) expect(Math.hypot(p.x - g.x, p.z - g.z)).toBeGreaterThanOrEqual(9);
      for (const [hx, hz] of quarry.held) expect(Math.hypot(p.x - hx, p.z - hz)).toBeGreaterThan(3);
    }
    // Past the climb's finish, along its line, the way out to the ride is open.
    for (let t = 1; t <= 1.3; t += 0.05) expect(scrubOk(quarry, c0[0] + (c2[0] - c0[0]) * t, c0[1] + (c2[1] - c0[1]) * t)).toBe(false);
  });

  it('grows rough grass and thistles over the rough, by its area', () => {
    const area = fieldArea(quarry);
    expect(cover.tussocks.length).toBe(byArea(PIT_SCRUB.tussocks, area));
    expect(cover.thistles.length).toBe(byArea(PIT_SCRUB.thistles, area));
  });
});

describe('the lip and the foot (#1004)', () => {
  const { roots, scree } = pitLip(quarry);

  it('hangs roots from the topsoil just under the lip, facing into the pit, and none where the road comes in or the climb goes over', () => {
    expect(roots.length).toBeGreaterThan(60);
    for (const r of roots) {
      const { a, s } = quarry.polar(r.x, r.z);
      expect(quarry.rimAt(a) - s).toBeGreaterThan(0.2);
      expect(quarry.rimAt(a) - s).toBeLessThan(0.7);
      const p = quarry.frameAt(a, quarry.rimAt(a) + 2.4);
      expect(quarry.fenceOpen(a, p.x, p.z)).toBe(false);
      const toMiddle = Math.atan2(quarry.pit.x - r.x, quarry.pit.z - r.z);
      expect(Math.abs(Math.atan2(Math.sin(r.yaw - toMiddle), Math.cos(r.yaw - toMiddle)))).toBeLessThan(0.25);
    }
  });

  it('lays a skirt of scree along the walls\' foot, off the roads, the water, the heaps and the climb\'s start', () => {
    expect(scree.length).toBeGreaterThan(100);
    const start = quarry.climb.points[0];
    for (const p of scree) {
      const { a, s } = quarry.polar(p.x, p.z);
      expect(Math.abs(s - quarry.floorEdge(a))).toBeLessThan(4);
      expect(quarry.waterAt(p.x, p.z)).toBe(0);
      expect(quarry.roadNear(p.x, p.z).d).toBeGreaterThan(quarry.roadHalf + 0.8);
      expect(quarry.pit.heaps.every((m) => Math.hypot(m.x - p.x, m.z - p.z) >= m.r)).toBe(true);
      expect(Math.hypot(p.x - start[0], p.z - start[1])).toBeGreaterThanOrEqual(6);
    }
  });
});

describe('the tree line (#1004)', () => {
  const line = pitTreeLine(quarry, LAYOUT.boundaries, fields.kinds);
  const sides = LAYOUT.boundaries.filter((b) => b.between?.includes('pit'));
  const nearest = (t) => sides.map((b) => ({ b, d: Math.min(...b.points.slice(1).map((q, i) => {
    const p = b.points[i];
    const dx = q[0] - p[0];
    const dz = q[1] - p[1];
    const k = Math.max(0, Math.min(1, ((t.x - p[0]) * dx + (t.z - p[1]) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(t.x - (p[0] + dx * k), t.z - (p[1] + dz * k));
  })) })).sort((u, v) => u.d - v.d)[0];

  it('stands only along the sides that face arable, inside the fence, hawthorn with a few ash and oak standards', () => {
    expect(line.filter((t) => t.kind === 'hawthorn').length).toBeGreaterThan(60);
    const standards = line.filter((t) => t.kind !== 'hawthorn');
    expect(standards.some((t) => t.kind === 'ash')).toBe(true);
    expect(standards.some((t) => t.kind === 'oak')).toBe(true);
    expect(standards.length).toBeLessThan(12);
    for (const t of line) {
      const { b, d } = nearest(t);
      const other = b.between.find((k) => k !== 'pit');
      expect(fields.kinds[other], `${t.kind} at ${t.x}, ${t.z}`).toBe('arable');
      expect(d).toBeGreaterThan(1.5);
      expect(d).toBeLessThan(6);
      expect(quarry.inQuarry(t.x, t.z)).toBe(true);
    }
  });

  it('leaves the farm gate open', () => {
    for (const t of line) expect(Math.hypot(t.x - quarry.way.x, t.z - quarry.way.z)).toBeGreaterThanOrEqual(9);
  });
});

describe('the scrub round the relics (#1004)', () => {
  it('rings the container\'s hardstanding and the dead trees\' feet, and none on the hardstanding', () => {
    const container = { at: { x: 0, z: 0 }, turn: 0.4 };
    const trees = [{ x: 20, z: 0 }];
    const out = relicScrub({ container, trees, pallet: { x: -20, z: 0, r: 0.75 } });
    const toFrame = (p) => ({ u: Math.cos(0.4) * p.x - Math.sin(0.4) * p.z, v: Math.sin(0.4) * p.x + Math.cos(0.4) * p.z });
    const round = out.filter((p) => Math.hypot(p.x, p.z) < 10);
    expect(round.length).toBeGreaterThan(25);
    for (const p of round) {
      const { u, v } = toFrame(p);
      const inside = u > HARDSTANDING.x0 && u < HARDSTANDING.x1 && Math.abs(v) < HARDSTANDING.halfW;
      expect(inside).toBe(false);
    }
    const byTree = out.filter((p) => Math.hypot(p.x - 20, p.z) < 3);
    expect(byTree.length).toBeGreaterThan(6);
    for (const p of byTree) expect(Math.hypot(p.x - 20, p.z)).toBeGreaterThan(0.5);
    expect(out.filter((p) => Math.hypot(p.x + 20, p.z) < 1.4).length).toBeGreaterThan(4);
    expect(framePoint(container.at, container.turn, 1, 0).x).toBeCloseTo(Math.cos(0.4), 5);
  });
});

describe('the walls\' colours (#1004)', () => {
  const at = (depth, u = 0.4, a = 1, x = 300, z = -260) => pitWallColour(x, z, depth, u, a, 0.5);
  const lum = (c) => c[0] + c[1] + c[2];

  it('goes by the depth, which is height in the world, not by how far down the bank: the same bed at any point of the slope', () => {
    for (const d of [2, 3.3, 5, 8.7]) expect(at(d, 0.3).map(Math.round)).toEqual(at(d, 0.5).map(Math.round));
    // A bed, then the next a bed's thickness below: they differ, faintly.
    const k = PIT_WALL.bed;
    const diff = Math.max(...[0, 1, 2].map((i) => Math.abs(at(4.1)[i] - at(4.1 + k)[i])));
    expect(diff).toBeGreaterThan(1);
    expect(diff).toBeLessThan(30);
  });

  it('has faint bands: its beds far closer in tone than the old saturated ones', () => {
    const OLD = [[201, 184, 138], [186, 140, 84], [158, 152, 138], [216, 207, 178], [174, 150, 104]];
    const spread = (list) => Math.max(...list.map(lum)) - Math.min(...list.map(lum));
    const sat = (c) => Math.max(...c) - Math.min(...c);
    expect(spread(PIT_BEDS)).toBeLessThan(spread(OLD) / 2);
    expect(Math.max(...PIT_BEDS.map(sat))).toBeLessThan(Math.max(...OLD.map(sat)) * 0.6);
  });

  it('is stained with iron in patches round the walls, not everywhere', () => {
    // Iron reddens a bed: its red over its blue well past what the beds' own colours have.
    const plain = Math.max(...PIT_BEDS.map((c) => c[0] - c[2]));
    const rusty = [];
    for (let d = 1; d < 12; d += 0.5) {
      for (let i = 0; i < 180; i++) {
        const c = at(d, 0.4, (i / 180) * Math.PI * 2);
        rusty.push(c[0] - c[2] > plain + 10);
      }
    }
    const share = rusty.filter(Boolean).length / rusty.length;
    expect(share).toBeGreaterThan(0.05);
    expect(share).toBeLessThan(0.45);
  });

  it('is dark at the lip where the topsoil is, and paler and greyer in the scree over the foot', () => {
    expect(lum(at(0.05, 0.01))).toBeLessThan(lum(at(3)) * 0.65);
    const scree = at(9, 0.92);
    const mid = at(9, 0.35);
    expect(Math.max(...scree) - Math.min(...scree)).toBeLessThan(Math.max(...mid) - Math.min(...mid));
  });
});

describe('the rebuilt small things (#1004)', () => {
  beforeAll(() => vi.stubGlobal('document', { createElement: () => fakeCanvas() }));
  const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;

  it('a tyre: lighter, textured, with its liner inside so you see into it and not through it', async () => {
    const { tyreGeometry, debrisMaterials, TYRE } = await import('../src/world/quarryDebris.js');
    const geo = tyreGeometry();
    expect(tris(geo)).toBeLessThan(1000); // it was 1,900
    expect(geo.attributes.uv).toBeDefined();
    expect(debrisMaterials(() => 0.5).tyre.map).toBeTruthy();
    const p = geo.attributes.position;
    let liner = false;
    for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i)) < 0.01 && Math.hypot(p.getX(i), p.getZ(i)) < TYRE.radius - 0.008 && Math.hypot(p.getX(i), p.getZ(i)) > 0.25) liner = true;
    expect(liner).toBe(true);
  });

  it('a pallet: its deck boards across its bearers and resting on them, nothing floating, nothing fighting', async () => {
    const { addPallet, PALLET } = await import('../src/world/quarryDebris.js');
    const { Parts } = await import('../src/world/parts.js');
    const wood = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    const parts = new Parts();
    addPallet(parts, wood, () => 0.9, null);
    const group = parts.build();
    const box = new THREE.Box3().setFromObject(group);
    expect(box.max.x - box.min.x).toBeCloseTo(PALLET.length, 1);
    expect(box.max.z - box.min.z).toBeCloseTo(PALLET.width, 1);
    // The deck's undersides are at the bearers' tops (to 3 mm), and the boards run across the bearers.
    const geos = parts.byMaterial.get(wood);
    const boxes = geos.map((g) => new THREE.Box3().setFromBufferAttribute(g.attributes.position));
    const bearers = boxes.filter((b) => b.max.x - b.min.x > 1 && b.max.z - b.min.z < 0.2);
    const deck = boxes.filter((b) => b.min.y > PALLET.board.t + 0.01 && b.max.z - b.min.z > 0.6);
    expect(bearers).toHaveLength(3);
    expect(deck.length).toBeGreaterThanOrEqual(PALLET.top - 1);
    const top = Math.max(...bearers.map((b) => b.max.y));
    for (const d of deck.filter((b) => b.max.y - b.min.y < PALLET.board.t + 0.002)) expect(Math.abs(d.min.y - top)).toBeLessThan(0.003);
    expect(coplanarOverlaps(group, { gap: 0.003, minArea: 2e-5, textured: true })).toEqual([]);
  });

  it('a dead tree: forked limbs with snapped stubs, a flared foot and a fallen limb, bark-textured', async () => {
    const { deadTreeGeometry } = await import('../src/world/landmarkProps.js');
    const { seeded } = await import('../src/world/propStreams.js');
    const geo = deadTreeGeometry(seeded(5), { height: 5.5, lean: 0.1 });
    expect(geo.attributes.uv).toBeDefined();
    const box = new THREE.Box3().setFromBufferAttribute(geo.attributes.position);
    expect(box.max.y).toBeGreaterThan(4);
    expect(box.max.y).toBeLessThan(9);
    expect(tris(geo)).toBeGreaterThan(600); // tens of limbs, where it was a cylinder and two stubs (66 triangles)
  });

  it('a gorse bush: textured spiny shoots round a dark heart, in flower here and there, a metre or so high', async () => {
    const { gorseBushGeometry, GORSE_TRIANGLES } = await import('../src/world/woodPlants.js');
    const { seeded } = await import('../src/world/propStreams.js');
    const geo = gorseBushGeometry(seeded(3));
    expect(tris(geo)).toBeLessThanOrEqual(GORSE_TRIANGLES);
    const box = new THREE.Box3().setFromBufferAttribute(geo.attributes.position);
    expect(box.max.y).toBeGreaterThan(0.8);
    expect(box.max.y).toBeLessThan(1.6);
    const uv = geo.attributes.uv;
    let flowered = 0;
    for (let i = 0; i < uv.count; i++) if (uv.getX(i) < 0.5 && uv.getY(i) > 0.5) flowered++;
    expect(flowered).toBeGreaterThan(0);
  });

  it('a hawthorn and an ash standard at real sizes', async () => {
    const { hawthornModel, ashStandardModel } = await import('../src/world/landmarkProps.js');
    const { seeded } = await import('../src/world/propStreams.js');
    const { farSprayTree } = await import('../src/world/treeFar.js');
    const cards = new THREE.MeshLambertMaterial({ alphaTest: 0.5 });
    const model = hawthornModel(seeded(2), cards, { height: 5 });
    const haw = new THREE.Box3().setFromObject(model);
    expect(haw.max.y).toBeGreaterThan(3.5);
    expect(haw.max.y).toBeLessThan(6.5);
    // One mesh near and one far, the far a good deal lighter, so a tile of them is one draw at any distance.
    const far = farSprayTree(model);
    expect(model.children).toHaveLength(1);
    expect(far.children).toHaveLength(1);
    expect(tris(far.children[0].geometry)).toBeLessThan(tris(model.children[0].geometry) * 0.5);
    const ash = new THREE.Box3().setFromObject(ashStandardModel(seeded(2), new THREE.Texture(), cards));
    expect(ash.max.y).toBeGreaterThan(10);
    expect(ash.max.y).toBeLessThan(19);
  });

  it('the stones: textured and lit, in a tint over the texture, not pale', async () => {
    const { rockGeometry, pitStoneMaterial } = await import('../src/world/quarryProps.js');
    const { seeded } = await import('../src/world/propStreams.js');
    const m = pitStoneMaterial(seeded(1));
    expect(m.isMeshStandardMaterial).toBe(true);
    expect(m.map).toBeTruthy();
    const geo = rockGeometry(seeded(4), 2);
    expect(geo.attributes.uv).toBeDefined();
    expect(geo.index).toBeTruthy();
  });
});

describe('the pit in the scene (#1004)', () => {
  // The pit's stream's boxes after the big boulders (the fence, the container, the cabin, the plant, the excavator, the tyres, the drums, the dead
  // trees, the signs, the boundary), recorded on main before #1004: the relics stand where they did, though the plants now deal from their own stream.
  const RELIC_BOXES = { count: 279, sum: 21332.53 };

  it('stands every relic, the fence and the boundary where they stood', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildQuarry } = await import('../src/world/quarryProps.js');
    const c = { ...headlessContext(), drawDistance: { add: (o) => o } };
    const boxes = [];
    c.fixedBox = (...a) => boxes.push(a.map((v) => +v.toFixed(4)));
    buildQuarry(c);
    const sub = boxes.slice(quarryPlants(c.fields.quarry).big.length);
    const sum = sub.reduce((t, b, i) => t + b.reduce((u, v, k) => u + v * (1 + ((i * 7 + k) % 13)), 0), 0);
    expect(sub.length).toBe(RELIC_BOXES.count);
    expect(sum).toBeCloseTo(RELIC_BOXES.sum, 1);
  });

  it('draws its scrub, cover, lip, stones and dead trees in the set piece, lit, and hands the tree line and the oaks to the farm\'s scatter', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildQuarry } = await import('../src/world/quarryProps.js');
    // The farm's oak, a lit stand-in (the headless one is unlit, and the field's oaks are drawn in the set piece now).
    const models = new Proxy({}, { get: () => ({ scene: new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshStandardMaterial()) }) });
    const c = { ...headlessContext(), models, drawDistance: { add: (o) => o } };
    buildQuarry(c);
    const site = c.scene.getObjectByName('quarrySite');
    for (const n of ['pitScrub', 'pitCover', 'pitLip', 'pit-gorse', 'pit-bramble', 'pit-tussock', 'pit-thistle', 'pit-roots', 'pit-scree', 'deadTrees', 'pallet', 'quarryStones', 'quarryBoulders']) {
      expect(site.getObjectByName(n), n).toBeDefined();
    }
    let unlit = 0;
    site.traverse((o) => {
      if (o.isMesh && !(o.material.isMeshStandardMaterial || o.material.isMeshLambertMaterial)) unlit++;
    });
    expect(unlit).toBe(0);
    const bark = [];
    site.getObjectByName('deadTrees').traverse((o) => o.isMesh && bark.push(o.material));
    expect(bark.length).toBe(1);
    expect(bark[0].map).toBeTruthy();
    const scattered = c.scatter.sets.map((s) => s.model.name);
    expect(scattered).toEqual(expect.arrayContaining(['hawthorn', 'ash'])); // the tree line, seen from across the arable
    expect(c.scatter.sets.reduce((n, s) => n + s.matrices.length, 0)).toBeGreaterThan(60);
    // The field's hawthorns and birch stay in the set piece, swapped near and far tile by tile as the scattered trees are.
    expect(site.userData.treeSwap.tiles.size).toBeGreaterThan(2);
    for (const t of site.userData.treeSwap.tiles.values()) expect(t.near.length).toBe(t.far.length);
  });
});
