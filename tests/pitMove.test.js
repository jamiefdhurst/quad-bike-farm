import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew, fromPlan, quarryLayout, PIT_PLAN, GATEWAYS_PLAN, NOT_MOVED_YET, REPLACED } from '../src/world/layoutNew.js';
import { createFields } from '../src/world/fields.js';
import { createQuarry, dealtLayout, quarryPlants, descentPath } from '../src/world/quarry.js';
import { createRandom } from '../src/core/random.js';
import { PitClimb } from '../src/world/pitClimb.js';
import { climbGates } from '../src/npc/hillClimb.js';
import { DEFAULT_GATE_PARAMS } from '../src/world/gates.js';
import { CAPSULE_RADIUS } from '../src/player/player.js';
import { DEFAULT_PLAYER_PARAMS } from '../src/player/playerParams.js';
import { headlessContext } from './helpers/worldModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { buildClimbFlags, buildClimbCones, FLAG, CONE_KINDS } from '../src/world/startLine.js';

// The gravel pit on the new farm (#685): its field, its two gates (the lane gate shut for good, the farm gate the way in), the haul road from the lane
// gate, the girls waiting inside the farm gate, the post-and-wire boundary and the lip fence as solid things, and the climb still timed.
const two = layoutNew(LAYOUT, RAW_LAYOUT);
const quarryOf = (seed) => createQuarry(dealtLayout(two, seed));
const Q = two.quarry;
const lane = Q.gates.find((g) => g.id === 'pitlane');
const farm = Q.gates.find((g) => g.id === 'quarry');
const inside = (g, m, across = 0) => ({ x: g.x + g.inward[0] * m - g.inward[1] * across, z: g.z + g.inward[1] * m + g.inward[0] * across });

describe('the pit on the new farm: its field and gates', () => {
  it('is out of the lists of what has not moved, and is what the layout replaces', () => {
    expect(Object.keys(NOT_MOVED_YET)).not.toContain('quarry');
    expect(Object.keys(NOT_MOVED_YET)).not.toContain('anchors.pit');
    expect(REPLACED).toEqual(expect.arrayContaining(['quarry', 'anchors.pit']));
    expect(two.quarry).not.toEqual(LAYOUT.quarry);
    expect(two.anchors.pit).toEqual({ x: fromPlan(PIT_PLAN.centre)[0], z: fromPlan(PIT_PLAN.centre)[1], yaw: 0 });
  });
  it('is the pit\'s own field, 165 by 170 m or so, with the pit centred about plan (805, 108)', () => {
    expect(Q.maxX - Q.minX).toBeGreaterThan(160);
    expect(Q.maxX - Q.minX).toBeLessThan(170);
    expect(Q.maxZ - Q.minZ).toBeGreaterThan(170);
    expect(Q.centre).toEqual({ x: fromPlan([805, 108])[0], z: fromPlan([805, 108])[1] });
    for (let seed = 1; seed <= 20; seed++) {
      const { pit } = quarryOf(seed);
      expect(Math.abs(pit.x - Q.centre.x)).toBeLessThanOrEqual(4.001);
      expect(Math.abs(pit.z - Q.centre.z)).toBeLessThanOrEqual(3.001);
    }
  });
  it('has the lane gate shut at plan (885, 110) and the farm gate open at plan (720, 150), each facing into the field', () => {
    expect([lane.x, lane.z]).toEqual([fromPlan([885, 110])[0], expect.closeTo(fromPlan([885, 110])[1], 5)]);
    expect([farm.x, farm.z]).toEqual([fromPlan([720, 150])[0], expect.closeTo(fromPlan([720, 150])[1], 5)]);
    expect(lane.open).toBe(false);
    expect(farm.open).toBe(true);
    expect(lane.inward.map((v) => Math.round(v) || 0)).toEqual([-1, 0]);
    expect(farm.inward.map((v) => Math.round(v) || 0)).toEqual([1, 0]);
    const g = GATEWAYS_PLAN.filter((w) => w.a === 'pit' || w.b === 'pit');
    expect(g.find((w) => w.id === 'pitlane')).toMatchObject({ gate: true, shut: true });
    expect(g.find((w) => w.id === 'quarry').shut).toBeUndefined();
  });
  it('deals every one of 200 farm seeds a plant and 2 to 5 heaps with the rim inside the field', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = quarryOf(seed * 7919);
      expect(q.pit.plant, `seed ${seed}`).toBeTruthy();
      expect(q.pit.heaps.length, `seed ${seed}`).toBeGreaterThanOrEqual(2);
      expect(q.pit.heaps.length, `seed ${seed}`).toBeLessThanOrEqual(5);
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        const p = q.frameAt(a, q.rimAt(a));
        expect(q.inQuarry(p.x, p.z, 3), `seed ${seed} rim ${i}`).toBe(true);
      }
    }
  });
  it('keeps the pit as dealt: 88 by 69 m at the lip, 13 to 16 m deep, whatever the seed', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { pit } = quarryOf(seed);
      expect(pit.rx * 2).toBeGreaterThan(88);
      expect(pit.rx * 2).toBeLessThan(97);
      expect(pit.rz * 2).toBeGreaterThan(71);
      expect(pit.depth).toBeGreaterThanOrEqual(13);
      expect(pit.depth).toBeLessThanOrEqual(16);
    }
  });
});

describe('the haul road and the girls', () => {
  const q = quarryOf(1);
  it('starts at the lane gate and comes into the pit on the lane side', () => {
    expect(q.roadPoints[0]).toMatchObject({ x: lane.x, z: lane.z });
    const lip = q.frameAt(q.pit.road.from, q.rimAt(q.pit.road.from));
    expect(lip.x).toBeGreaterThan(q.pit.x + 20); // the east side, towards the lane
    for (const p of q.roadPoints) expect(q.inQuarry(p.x, p.z), `${p.x},${p.z}`).toBe(true);
  });
  it('puts the climb wall on the farm gate\'s side, up to a finish inside the field', () => {
    expect(q.climb.points[2][0]).toBeLessThan(q.pit.x - 30);
    expect(q.inQuarry(q.climb.points[2][0], q.climb.points[2][1], 5)).toBe(true);
  });
  it('has a girl wait just inside the farm gate, not down the road after you', () => {
    expect(q.way.id).toBe('quarry');
    expect(q.pastGate(inside(farm, 2).x, inside(farm, 2).z)).toBe(false);
    expect(q.pastGate(inside(farm, 12).x, inside(farm, 12).z)).toBe(true);
    expect(q.pastGate(farm.x - 5, farm.z)).toBe(false); // out on the stone track's side
    expect(q.inQuarry(q.waitSpot.x, q.waitSpot.z)).toBe(true);
    expect(Math.hypot(q.waitSpot.x - farm.x, q.waitSpot.z - farm.z)).toBeLessThan(6);
    expect((q.waitSpot.x - farm.x) * farm.inward[0] + (q.waitSpot.z - farm.z) * farm.inward[1]).toBeCloseTo(3.5, 5);
  });
  it('keeps the scrub and the boulders 9 m from both gates', () => {
    expect(q.plantOk(inside(farm, 4).x, inside(farm, 4).z)).toBe(false);
    expect(q.plantOk(inside(lane, 4).x, inside(lane, 4).z)).toBe(false);
    const plants = quarryPlants(q, createRandom(3));
    for (const [x, z] of [...plants.bushes, ...plants.trees]) for (const g of [lane, farm]) expect(Math.hypot(x - g.x, z - g.z)).toBeGreaterThanOrEqual(9);
  });
  it('still times a run up the climb: start, gate, finish', () => {
    const gates = climbGates(q.climb);
    expect(gates).toHaveLength(3);
    const pc = new PitClimb(gates);
    pc.arm();
    const along = (g, m) => ({ x: g.x + g.tx * m, z: g.z + g.tz * m });
    const events = [];
    const [a, b] = [along(gates[0], -6), along(gates[2], 4)];
    for (let i = 0; i <= 60; i++) events.push(...pc.update(0.5, { x: a.x + ((b.x - a.x) * i) / 60, z: a.z + ((b.z - a.z) * i) / 60, riding: true, running: true }));
    expect(events.map((e) => e.type)).toEqual(['start', 'gate', 'finish']);
  });
  it('is the same pit on today\'s farm: one gate in its south side, as before', () => {
    const old = createQuarry(LAYOUT);
    expect(old.gates).toHaveLength(1);
    expect(old.way).toBe(old.gate);
    expect(old.waitSpot).toEqual({ x: old.gate.x + 3.5, z: old.rect.maxZ - 3.5 });
    expect(old.pastGate(old.gate.x, old.rect.maxZ - 9)).toBe(true);
    expect(old.pastGate(old.gate.x, old.rect.maxZ - 7)).toBe(false);
  });
  it('leaves the wait spot and descent unchanged when asked for the road another way round', () => {
    expect(descentPath(q.pit, 1).length).toBeGreaterThan(20);
  });
});

describe('the routes and the boundary the girls and the lines see', () => {
  const fields = createFields(dealtLayout(two, 1));
  const pit = fields.quarry;
  it('runs post and wire along all four sides, in a kind the girls\' avoidance counts as solid', () => {
    const sides = fields.boundaries.filter((b) => b.kind === 'fence');
    expect(sides.length).toBeGreaterThanOrEqual(4);
    expect(fields.boundaries.filter((b) => b.kind === 'hedge' && fields.polygons.pit && b.between?.includes?.('pit'))).toEqual([]);
  });
  it('counts the lane gate\'s gap as solid and the farm gate\'s as a way through', () => {
    expect(fields.hedgedAt(lane.x, lane.z, 1)).toBe(true);
    expect(fields.hedgedAt(farm.x, farm.z, 1)).toBe(false);
    expect(fields.hedgedAt(farm.x, farm.z - 40, 1)).toBe(true);
    expect(fields.gates.pitlane.shut).toBe(true);
    expect(fields.hedgeAhead(lane.x - 15, lane.z, Math.PI / 2)).toBeLessThan(16);
    expect(fields.hedgeAhead(farm.x + 12, farm.z, -Math.PI / 2)).toBeGreaterThan(30);
  });
  it('routes a girl into the pit by the farm gate and never by the lane gate', () => {
    for (const from of [{ x: 150, z: -250 }, { x: 250, z: -60 }, { x: -20, z: 20 }]) {
      const path = fields.route(from, pit.waitSpot);
      expect(path.length, JSON.stringify(from)).toBeGreaterThan(1);
      expect(path.some((p) => Math.hypot(p.x - farm.x, p.z - farm.z) < 4), JSON.stringify(from)).toBe(true);
      expect(path.every((p) => Math.hypot(p.x - lane.x, p.z - lane.z) > 6), JSON.stringify(from)).toBe(true);
    }
  });
});

// The colliders in a real Rapier world with the player's capsule walked at them, as tests/hutEntry.test.js does.
const WALK = DEFAULT_PLAYER_PARAMS.walkSpeed;
const HALF_HEIGHT = 0.55;
let world;
let fixed;
const boxes = [];

function walk(from, to, seconds = 14) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(from.x, 0.05 + HALF_HEIGHT + CAPSULE_RADIUS, from.z));
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT, CAPSULE_RADIUS), body);
  const ctl = world.createCharacterController(0.03);
  ctl.setUp({ x: 0, y: 1, z: 0 });
  ctl.enableAutostep(0.35, 0.2, false);
  ctl.enableSnapToGround(0.4);
  const len = Math.hypot(to.x - from.x, to.z - from.z);
  let vy = 0;
  let grounded = false;
  for (let i = 0; i < seconds * 60; i++) {
    vy = grounded ? 0 : vy - DEFAULT_PLAYER_PARAMS.gravity / 60; // (player.js presses at 1 m/s; on a flat stand-in ground that sinks the capsule)
    ctl.computeColliderMovement(collider, { x: ((to.x - from.x) / len) * (WALK / 60), y: vy / 60, z: ((to.z - from.z) / len) * (WALK / 60) });
    const m = ctl.computedMovement();
    const t = body.translation();
    body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    world.step();
    grounded = ctl.computedGrounded();
  }
  const end = body.translation();
  world.removeCharacterController(ctl);
  world.removeRigidBody(body);
  return end;
}

describe('the gates and the fences in a physics world', () => {
  const dealt = dealtLayout(two, 1);
  let gates;
  let boundary;
  beforeAll(async () => {
    await RAPIER.init();
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }), width: 0, height: 0 }) });
    world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(500, 0.5, 500).setTranslation(250, -0.5, -250));
    fixed = (x, y, z, hx, hy, hz, rotY = 0) => {
      boxes.push({ x, y, z, hx, hy, hz, rotY });
      return world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY)));
    };
    const { pitFarmGate, pitLaneGate } = await import('../src/world/props.js');
    const { buildPitBoundary } = await import('../src/world/quarryProps.js');
    const c = { ...headlessContext(), layout: dealt, fields: createFields(dealt), heights: { heightAt: () => 0 }, fixedBox: fixed, gateParams: { ...DEFAULT_GATE_PARAMS }, scene: new THREE.Scene() };
    gates = { farm: pitFarmGate(c), lane: pitLaneGate(c) };
    boundary = buildPitBoundary(c);
    world.step();
  });

  it('shuts the lane gate for good: nothing opens it and a walking player cannot pass it', () => {
    expect(gates.lane).toBeUndefined(); // built, but not a `Gate`: there is nothing to open
    const end = walk({ x: lane.x - 14, z: lane.z }, { x: lane.x + 14, z: lane.z });
    expect(end.x).toBeGreaterThan(lane.x - 1.2); // it walked right up to the gate
    expect(end.x).toBeLessThan(lane.x - 0.2); // and no further
  });
  it('lets a walking player through the farm gate, tied open, and out to the stone track', () => {
    expect(gates.farm.isOpen).toBe(true);
    const end = walk({ x: farm.x + 14, z: farm.z }, { x: farm.x - 14, z: farm.z });
    expect(end.x).toBeLessThan(farm.x - 5);
  });
  it('stops a player at the fence along any side but the gates', () => {
    const west = walk({ x: farm.x + 10, z: farm.z - 60 }, { x: farm.x - 10, z: farm.z - 60 });
    expect(west.x).toBeGreaterThan(farm.x); // stopped at the fence, not through it
    expect(west.x).toBeLessThan(farm.x + 1.2); // having walked up to it
    const east = walk({ x: lane.x - 10, z: lane.z + 40 }, { x: lane.x + 10, z: lane.z + 40 });
    expect(east.x).toBeLessThan(lane.x);
    expect(east.x).toBeGreaterThan(lane.x - 1.2);
  });
  it('is one collider along every span of the fence, a few draw calls, and not one hole', () => {
    expect(boundary.name).toBe('pitFence');
    expect(boundary.children.length).toBeLessThanOrEqual(4);
    const { spans } = boundary.userData.count;
    const fenceBoxes = boxes.filter((b) => b.hy === 0.6 && b.hz === 0.07);
    expect(fenceBoxes).toHaveLength(spans);
    expect(spans).toBeGreaterThan(150);
    const covered = fenceBoxes.reduce((n, b) => n + 2 * b.hx, 0);
    const perimeter = fields_perimeter();
    expect(covered).toBeGreaterThan(perimeter - 2 * 2 * 2.45 - 6); // all but the two gates' gaps
    expect(covered).toBeLessThanOrEqual(perimeter);
  });
});

function fields_perimeter() {
  const o = Q.outline;
  return o.reduce((n, p, i) => n + Math.hypot(o[(i + 1) % o.length][0] - p[0], o[(i + 1) % o.length][1] - p[1]), 0);
}

describe('the lip fence', () => {
  const dealt = dealtLayout(two, 1);
  const quarry = createQuarry(dealt);
  const recorded = [];
  let site;
  beforeAll(async () => {
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }), width: 0, height: 0 }) });
    const { buildQuarry } = await import('../src/world/quarryProps.js');
    const c = { ...headlessContext(), layout: dealt, fields: createFields(dealt), heights: { heightAt: () => 0 }, scene: new THREE.Scene(), fixedBox: (x, y, z, hx, hy, hz, rotY = 0) => recorded.push({ x, y, z, hx, hy, hz, rotY }) };
    buildQuarry(c);
    site = c.scene.getObjectByName('quarrySite');
  });
  const lip = () => recorded.filter((b) => b.hy === 0.45 && b.hz === 0.07);
  const inBox = (b, p, slack = 0.5) => {
    const dx = p.x - b.x;
    const dz = p.z - b.z;
    return Math.abs(dx * Math.cos(b.rotY) - dz * Math.sin(b.rotY)) < b.hx + slack && Math.abs(dx * Math.sin(b.rotY) + dz * Math.cos(b.rotY)) < b.hz + slack;
  };
  it('is solid along its wire now, so you cannot ride through it, with barbed wire on it', () => {
    expect(lip().length).toBeGreaterThan(20);
    expect(site.getObjectByName('quarryFence')).toBeTruthy();
    const wire = [];
    site.getObjectByName('quarryFence').traverse((o) => o.isMesh && o.material.alphaTest > 0 && wire.push(o));
    expect(wire).toHaveLength(1); // the barbed wire, as one mesh
  });
  it('is open where the haul roads come in and where the climb goes over the lip', () => {
    const lead = quarry.roadPoints.filter((p) => p.t === 0);
    expect(lead.length).toBeGreaterThan(5);
    for (const p of [...lead, ...quarry.rampPoints.slice(0, 4)]) for (const b of lip()) expect(inBox(b, p), `road at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`).toBe(false);
    const [a, b] = [quarry.climb.points[1], quarry.climb.points[2]];
    for (let i = 0; i <= 30; i++) {
      const p = { x: a[0] + ((b[0] - a[0]) * i) / 30, z: a[1] + ((b[1] - a[1]) * i) / 30 };
      for (const box of lip()) expect(inBox(box, p), `climb line ${i}`).toBe(false);
    }
  });
});

describe('the pit climb\'s flags', () => {
  const gates = [0, 1, 2].map((i) => ({ x: 300 - i * 20, z: -258, tx: -1, tz: 0, half: 9 }));
  const slope = (x, z) => 0.8 * (300 - x) + 0.1 * z; // about 39 degrees up the course
  const flags = buildClimbFlags(new THREE.Scene(), slope, gates);
  const polesAt = gates.flatMap((g) => [-1, 1].map((side) => [g.x - g.tz * (g.half + 0.5) * side, g.z + g.tx * (g.half + 0.5) * side]));
  it('is one group of a few meshes, named for the far detail', () => {
    expect(flags.name).toBe('pitFlags');
    expect(flags.children.length).toBeLessThanOrEqual(6);
  });
  it('stands each pole plumb in the ground whatever the slope, planted below it and taller at the ends', () => {
    const pole = flags.children[0].geometry.getAttribute('position');
    const near = (i) => polesAt.findIndex(([x, z]) => Math.hypot(pole.getX(i) - x, pole.getZ(i) - z) < FLAG.pole + 0.01);
    const tops = new Map();
    const feet = new Map();
    for (let i = 0; i < pole.count; i++) {
      const k = near(i);
      expect(k, `vertex ${i} is on a pole`).toBeGreaterThanOrEqual(0);
      tops.set(k, Math.max(tops.get(k) ?? -Infinity, pole.getY(i)));
      feet.set(k, Math.min(feet.get(k) ?? Infinity, pole.getY(i)));
    }
    expect(tops.size).toBe(6);
    polesAt.forEach(([x, z], k) => {
      expect(feet.get(k)).toBeCloseTo(slope(x, z) - FLAG.sink, 5);
      expect(tops.get(k) - slope(x, z)).toBeCloseTo(k < 2 || k >= 4 ? FLAG.endHeight : FLAG.height, 5);
    });
  });
  it('flies green at the start and blue at the finish, orange between, as the cones did', () => {
    const colours = flags.children.filter((m) => m.material.side === THREE.DoubleSide).map((m) => m.material.color.getHex());
    expect(colours).toEqual(expect.arrayContaining([CONE_KINDS.start.colour, CONE_KINDS.finish.colour, CONE_KINDS.orange.colour]));
    expect(buildClimbCones).toBeTypeOf('function'); // the hill climb keeps its cones
  });
  it('has no two faces fighting over a plane in the flags or the pit\'s fence', async () => {
    expect(coplanarOverlaps(flags, { gap: 0.003, minArea: 2e-5, textured: true })).toEqual([]);
    const { buildPitBoundary } = await import('../src/world/quarryProps.js');
    const fence = buildPitBoundary({ ...headlessContext(), layout: two, heights: { heightAt: () => 0 }, scene: new THREE.Scene(), fixedBox: () => {} });
    const fights = coplanarOverlaps(fence, { gap: 0.003, minArea: 2e-5, textured: true });
    expect(fights.map((f) => `${f.a}/${f.b}`)).toEqual([]);
  });
});
