import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { layoutNew, fromPlan, NEIGHBOUR_PLAN, NOT_MOVED_YET, REPLACED, describeLayout } from '../src/world/layoutNew.js';
import { neighbourFarmShape, createNeighbourFarm, neighbourGate, nearNeighbourYard } from '../src/world/neighbourFarm.js';
import { createRoads } from '../src/world/roads.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { createOutbuildings } from '../src/world/outbuildings.js';
import { Track } from '../src/world/track.js';
import { visitPlaces, planVisit } from '../src/world/traffic.js';
import { buildingBlocks } from '../src/npc/sight.js';
import { farNeighbourFarm, mergeParkedVehicle } from '../src/world/neighbourFarmProps.js';
import * as THREE from 'three';
import { vi } from 'vitest';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { headlessContext } from './helpers/worldModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';

const two = layoutNew(LAYOUT);
const S = neighbourFarmShape(two);
const lane = two.publicLane;
const net = createRoads(two.roads);
const inBox = (b, x, z) => Math.abs(x - b.x) < b.hx && Math.abs(z - b.z) < b.hz;
const inRect = (r, x, z) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ;
const overlap = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

describe('the neighbour\'s yard across the lane (#569)', () => {
  it('is the plan\'s yard, 95 by 85 m, east of the lane, with her anchor in its middle', () => {
    const [minX, minZ] = fromPlan([950, 250]);
    const [maxX, maxZ] = fromPlan([1045, 335]);
    expect(S.yard).toMatchObject({ minX, minZ, maxX, maxZ });
    expect(S.yard.minX).toBeGreaterThan(lane.x + lane.halfWidth + 30); // a track's length from the tarmac, on the lane's east side
    expect(two.anchors.neighbour).toEqual({ x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, yaw: 0 });
  });

  it('has her gateway in the west wall at plan z 292, level with no crossroads against our drive at 345', () => {
    const [, gz] = fromPlan([950, 292]);
    expect(S.gateway).toMatchObject({ side: 'west', z: gz, half: 4 });
    expect(S.gateway.x).toBeCloseTo(S.yard.minX + S.yard.wall / 2, 6);
    expect(Math.abs(gz - two.road.z)).toBeGreaterThan(40); // our drive's mouth on the lane is at plan z 345
    for (let z = S.gateway.minZ + 0.1; z < S.gateway.maxZ; z += 0.5) expect(S.walls.some((w) => inBox(w, S.gateway.x, z))).toBe(false);
    expect(S.walls.some((w) => inBox(w, S.gateway.x, S.gateway.minZ - 0.5))).toBe(true);
    expect(S.walls.some((w) => inBox(w, S.gateway.x, S.gateway.maxZ + 0.5))).toBe(true);
    expect(S.walls.some((w) => inBox(w, S.yard.maxX - 0.25, gz))).toBe(true); // the east wall is whole
  });

  it('has the house at the south with its door facing in, the barn at the north-west with its big door facing the yard, and her at her door', () => {
    const cz = (S.yard.minZ + S.yard.maxZ) / 2;
    const cx = (S.yard.minX + S.yard.maxX) / 2;
    expect(S.house.z).toBeGreaterThan(cz + 15);
    expect(S.house.door.z).toBeLessThan(S.house.outer.minZ + 0.01); // in the north wall, facing the yard
    expect(S.barn.z).toBeLessThan(cz - 15);
    expect(S.barn.x).toBeLessThan(cx - 15);
    expect(S.barn.door.x).toBeCloseTo(S.barn.outer.maxX, 6); // in the east wall, facing the yard
    expect(S.barn.door.z - S.barn.door.halfWidth).toBeGreaterThan(S.barn.outer.minZ);
    expect(S.barn.door.z + S.barn.door.halfWidth).toBeLessThan(S.barn.outer.maxZ);
    expect(S.stand.z).toBeLessThan(S.house.outer.minZ);
    expect(S.stand.yaw).toBeCloseTo(Math.PI, 6);
    expect(inRect(S.house.roof, S.stand.x, S.stand.z)).toBe(false);
  });

  it('has the barn on the plan\'s footprint, plan (958 to 984, 258 to 275)', () => {
    const [x0, z0] = fromPlan([958, 258]);
    const [x1, z1] = fromPlan([984, 275]);
    expect(S.barn.outer).toMatchObject({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
  });

  it('keeps everything inside the wall and apart, with her three vehicles clear of the way in', () => {
    const things = [S.house.roof, S.barn.roof, ...S.parked.map((p) => p.outer)];
    for (const r of things) {
      expect(r.minX).toBeGreaterThan(S.yard.minX + S.yard.wall);
      expect(r.maxX).toBeLessThan(S.yard.maxX - S.yard.wall);
      expect(r.minZ).toBeGreaterThan(S.yard.minZ + S.yard.wall);
      expect(r.maxZ).toBeLessThan(S.yard.maxZ - S.yard.wall);
    }
    for (let i = 0; i < things.length; i++) for (let j = i + 1; j < things.length; j++) expect(overlap(things[i], things[j]), `${i} and ${j}`).toBe(false);
    // The way in: a corridor the gateway's width across the yard to its far wall, with nothing parked in it.
    const way = { minX: S.gateway.x, maxX: S.yard.maxX, minZ: S.gateway.minZ, maxZ: S.gateway.maxZ };
    for (const p of S.parked) expect(overlap(p.outer, way), p.kind).toBe(false);
    expect(S.parked.map((p) => p.kind)).toEqual(['tor', 'utv', 'tractor']);
    expect(S.parked[0]).toMatchObject({ colour: 0x5d6d4a, reg: 'K412 PBW' }); // the Tor she drives away, as traffic.js has it
  });

  it('is a track away from the lane, a short one: plan (905, 292) to her gate, tarmac, joined to the lane\'s side', () => {
    const track = net.road('neighbour');
    const [x0, z0] = fromPlan([905, 292]);
    expect(track.points[0]).toEqual([x0, z0]);
    expect(track.points[1][0]).toBeCloseTo(S.yard.minX, 6);
    expect(track.junction).toEqual({ end: 'start', onto: 'lane' });
    expect(track.length).toBeGreaterThan(40);
    expect(track.length).toBeLessThan(50);
    expect(net.tarmacAt((x0 + S.gateway.x) / 2, z0)).toBeGreaterThan(0.9);
    expect(net.tarmacAt((x0 + S.gateway.x) / 2, z0 + 8)).toBeLessThan(0.1);
  });

  it('lets you ride from the lane along her track through the gateway to the barn door, the house and her door, and the wall holds everywhere else', () => {
    const cell = 0.2; // finer than the wall is thick
    const key = (x, z) => `${Math.round(x / cell)},${Math.round(z / cell)}`;
    const barnWall = (x, z) => {
      const o = S.barn.outer;
      const inner = { minX: o.minX + 0.16, maxX: o.maxX - 0.16, minZ: o.minZ + 0.16, maxZ: o.maxZ - 0.16 };
      return inRect(o, x, z) && !inRect(inner, x, z) && !(x > o.maxX - 0.4 && Math.abs(z - S.barn.door.z) < S.barn.door.halfWidth);
    };
    const gate = { x: S.gateway.x, z: S.gateway.z, hx: 0.3, hz: S.gateway.half + 0.3 }; // a shut gate across the gateway
    const flood = (shut) => {
      const blocked = (x, z) => S.walls.some((w) => inBox(w, x, z)) || (shut && inBox(gate, x, z)) || inRect(S.house.outer, x, z) || barnWall(x, z) || S.parked.some((p) => inRect(p.outer, x, z));
      const start = fromPlan([910, 292]);
      const seen = new Set([key(...start)]);
      const todo = [start];
      const [x0, z0] = fromPlan([905, 245]);
      const [x1, z1] = fromPlan([1050, 340]);
      while (todo.length) {
        const [x, z] = todo.pop();
        for (const [dx, dz] of [[cell, 0], [-cell, 0], [0, cell], [0, -cell]]) {
          const nx = x + dx;
          const nz = z + dz;
          if (nx < x0 || nx > x1 || nz < z0 || nz > z1) continue;
          if (blocked(nx, nz) || seen.has(key(nx, nz))) continue;
          seen.add(key(nx, nz));
          todo.push([nx, nz]);
        }
      }
      return (x, z) => seen.has(key(x, z));
    };
    const open = flood(false);
    expect(open(S.gateway.x - 3, S.gateway.z)).toBe(true);
    expect(open(S.gateway.x + 3, S.gateway.z)).toBe(true);
    expect(open(S.barn.outer.maxX + 2, S.barn.door.z)).toBe(true);
    expect(open(S.barn.x, S.barn.z)).toBe(true); // through the big door, inside
    expect(open(S.stand.x, S.stand.z)).toBe(true);
    expect(open(S.yard.maxX - 3, S.gateway.z)).toBe(true); // right across to the far wall
    // With her gate shut the wall keeps you out everywhere: the gateway is the only way in.
    const shut = flood(true);
    for (const [x, z] of [[S.gateway.x + 3, S.gateway.z], [S.stand.x, S.stand.z], [S.barn.x, S.barn.z], [S.yard.maxX - 3, S.gateway.z], [S.yard.minX + 3, S.yard.maxZ - 3]]) expect(shut(x, z), `${x}, ${z}`).toBe(false);
    expect(shut(S.gateway.x - 3, S.gateway.z)).toBe(true);
    // The lane is open on both sides of her track's mouth: no invisible walls.
    expect(two.publicLane.open.minZ).toBeLessThan(S.gateway.z);
    expect(two.publicLane.open.maxZ).toBeGreaterThan(S.gateway.z);
  });

  it('is counted as built by the world\'s outbuildings and shelters under its roofs', () => {
    const ob = createOutbuildings(two);
    expect(ob.builtAt(S.house.x, S.house.z)).toBe(true);
    expect(ob.builtAt(S.barn.x, S.barn.z)).toBe(true);
    expect(ob.covered(S.house.x, S.house.z)).toBe(true);
    expect(ob.covered(S.stand.x, S.stand.z)).toBe(false);
    expect(ob.builtAt(...fromPlan([940, 292]))).toBe(false); // outside her wall
  });

  it('keeps the distant trees away from her yard', () => {
    expect(nearNeighbourYard(two, S.yard.minX - 20, S.gateway.z, 45)).toBe(true);
    expect(nearNeighbourYard(two, S.yard.maxX + 200, S.gateway.z, 45)).toBe(false);
  });

  it('puts you just inside the gate for `tp neighbour` on either farm', () => {
    const g = neighbourGate(two);
    expect(g).toEqual({ x: S.gateway.x + 3, z: S.gateway.z });
    const old = neighbourFarmShape(LAYOUT);
    expect(neighbourGate(LAYOUT)).toEqual({ x: old.gateway.x - 3, z: old.gateway.z });
    expect(neighbourGate({})).toBeNull();
  });

  it('is off the not-moved list, and her anchor and yard are what the new farm replaces', () => {
    expect(Object.keys(NOT_MOVED_YET).filter((k) => /neighbour/i.test(k))).toEqual([]);
    expect(REPLACED).toEqual(expect.arrayContaining(['anchors.neighbour', 'neighbourFarm']));
    expect(describeLayout(2)).toMatch(/places still at today's numbers/);
  });

  it('is still today\'s on layout 1: the east wall\'s gateway, across no track', () => {
    const old = neighbourFarmShape(LAYOUT);
    expect(old.gateway.side).toBe('east');
    expect(old.gateway.x).toBeCloseTo(old.yard.maxX - old.yard.wall / 2, 6);
  });

  it('plans the visitors\' routes on the lane as before: they come and go along the lane past her track', () => {
    const places = visitPlaces(two);
    for (const [from, to] of [[1, 1], [-1, -1], [1, -1]]) {
      const steps = planVisit({ places, from, to, does: 'chat', leaveOpen: false, farmSpeed: 4 });
      expect(steps.length).toBeGreaterThan(3);
      for (const st of steps) if (st.x !== undefined) expect(S.walls.some((w) => inBox(w, st.x, st.z)), `step at ${st.x}, ${st.z}`).toBe(false);
    }
  });
});

describe('the ground under her yard', () => {
  const heights = createTerrainHeight(two, new Track(two.trackPoints)).heightAt;
  const centre = [(S.yard.minX + S.yard.maxX) / 2, (S.yard.minZ + S.yard.maxZ) / 2];
  const level = heights(...centre);

  it('is one level inside the wall, so the buildings and the slab stand on it', () => {
    for (const [x, z] of [[S.yard.minX + 2, S.yard.minZ + 2], [S.yard.maxX - 2, S.yard.maxZ - 2], [S.yard.maxX - 2, S.yard.minZ + 2], [S.gateway.x + 3, S.gateway.z]]) {
      expect(heights(x, z), `${x}, ${z}`).toBeCloseTo(level, 1);
    }
  });

  it('is levelled to the lie at plan x 946, just before her gate, not to the flat valley floor at her far wall', () => {
    const nf = createNeighbourFarm(two);
    expect(nf.floorAt(S.yard.minX + 5, S.gateway.z, () => 7).level).toBe(7);
    expect(nf.shape.floor.at).toEqual({ x: fromPlan([946, 292.5])[0], z: fromPlan([946, 292.5])[1] });
    expect(nf.floorAt(S.yard.minX - 5, S.gateway.z, () => 0).k).toBeGreaterThan(0); // eases out over 16 m, not 4
    expect(nf.floorAt(S.yard.minX - 17, S.gateway.z, () => 0)).toBeNull();
  });

  it('keeps her track to a gradient a tractor takes: no more than 15% anywhere from the lane to her gate', () => {
    const [x0, z0] = fromPlan([905, 292]);
    let worst = 0;
    for (let x = x0; x < S.gateway.x + 3; x += 2) worst = Math.max(worst, Math.abs(heights(x + 2, z0) - heights(x, z0)) / 2);
    expect(worst).toBeLessThan(0.15);
  });

  it('banks no steeper than 25 degrees outside her wall on any side, except the gateway\'s ramp', () => {
    const check = (x, z, dx, dz) => Math.abs(heights(x + dx, z + dz) - heights(x, z)) / Math.hypot(dx, dz);
    let worst = 0;
    for (let t = 0; t <= 1; t += 0.05) {
      for (const [x, z, dx, dz] of [
        [S.yard.minX - 16, S.yard.minZ + t * (S.yard.maxZ - S.yard.minZ), 1, 0],
        [S.yard.maxX + 1, S.yard.minZ + t * (S.yard.maxZ - S.yard.minZ), 1, 0],
        [S.yard.minX + t * (S.yard.maxX - S.yard.minX), S.yard.minZ - 16, 0, 1],
        [S.yard.minX + t * (S.yard.maxX - S.yard.minX), S.yard.maxZ + 1, 0, 1],
      ]) {
        for (let k = 0; k < 16; k++) worst = Math.max(worst, check(x + dx * k, z + dz * k, dx, dz));
      }
    }
    expect(worst).toBeLessThan(Math.tan((25 * Math.PI) / 180));
  });
});

describe('her yard seen from afar and from behind its buildings', () => {
  it('has a far version over the yard on its new ground: the house, the barn, the dairy and the wall, as one mesh', () => {
    const far = farNeighbourFarm(S, 3);
    far.updateMatrixWorld(true);
    expect(far.children).toHaveLength(1);
    const box = new THREE.Box3().setFromObject(far);
    expect(box.min.x).toBeCloseTo(S.yard.minX, 0);
    expect(box.max.x).toBeCloseTo(S.yard.maxX, 0);
    expect(box.min.z).toBeCloseTo(S.yard.minZ, 0);
    expect(box.max.z).toBeCloseTo(S.yard.maxZ, 0);
    // The house, the barn, the parlour and the tank room (16 triangles each) and the five walls and the slurry store (10 each).
    expect(far.children[0].geometry.getAttribute('position').count / 3).toBe(4 * 16 + (S.walls.length + 1) * 10);
  });

  it('hides you from a girl behind her barn or her house (#654), and not across the open yard', () => {
    const buildings = [S.house.outer, S.barn.outer];
    const eye = (x, z) => ({ x, z });
    expect(buildingBlocks(buildings, eye(S.barn.outer.minX - 5, S.barn.z), eye(S.barn.outer.maxX + 20, S.barn.z - 1))).toBe(true);
    expect(buildingBlocks(buildings, eye(S.house.x, S.house.outer.maxZ + 5), eye(S.house.x, S.house.outer.minZ - 8))).toBe(true);
    expect(buildingBlocks(buildings, eye(S.gateway.x + 2, S.gateway.z), eye(S.yard.maxX - 3, S.gateway.z))).toBe(false);
  });

  it('is where the girls and you are counted as in her yard (arriving, her greeting), by the wall', () => {
    const nf = createNeighbourFarm(two);
    expect(nf.inYard(S.stand.x, S.stand.z)).toBe(true);
    expect(nf.inYard(S.gateway.x - 3, S.gateway.z)).toBe(false);
    expect(nf.inYard(S.gateway.x + 3, S.gateway.z)).toBe(true);
  });
});

describe('her parked vehicles drawn as a few meshes', () => {
  it('are merged to one mesh a material, with every triangle and the same shape, and still hide as one', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildVehicleBody } = await import('../src/world/trafficView.js');
    for (const kind of ['tor', 'utv', 'tractor']) {
      const { object } = buildVehicleBody(kind, 0x5d6d4a, null);
      object.position.set(5, 1, -3);
      object.rotation.y = 0.7;
      object.updateMatrixWorld(true);
      const count = () => {
        let meshes = 0;
        let triangles = 0;
        object.traverse((o) => {
          if (!o.isMesh) return;
          meshes++;
          const g = o.geometry;
          triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
        });
        return { meshes, triangles };
      };
      const before = count();
      const box0 = new THREE.Box3().setFromObject(object, true);
      const made = mergeParkedVehicle(object);
      const after = count();
      object.updateMatrixWorld(true);
      const box1 = new THREE.Box3().setFromObject(object, true);
      expect(after.meshes, kind).toBe(made);
      expect(after.meshes, kind).toBeLessThan(before.meshes / 3);
      expect(after.triangles, kind).toBe(before.triangles);
      for (const k of ['x', 'y', 'z']) {
        expect(box1.min[k], `${kind} min ${k}`).toBeCloseTo(box0.min[k], 3);
        expect(box1.max[k], `${kind} max ${k}`).toBeCloseTo(box0.max[k], 3);
      }
      expect(object.children.length).toBeGreaterThan(0);
    }
  });
});

describe('her yard built on the new farm', () => {
  it('has no faces fighting on one plane in its walls, gateposts and gate (the house and the barn are lifted by #910 and #963, which do the same for theirs)', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildNeighbourFarm } = await import('../src/world/neighbourFarmProps.js');
    const c = headlessContext();
    const heights = createTerrainHeight(two, new Track(two.trackPoints));
    const built = buildNeighbourFarm({ ...c, layout: two, heights, gateParams: { swingSeconds: 1, blockBelow: 0.5, clearRadius: 3 } });
    built.group.updateMatrixWorld(true);
    expect(built.group.name).toBe('neighbourFarm');
    expect(built.gate.x).toBeCloseTo(S.gateway.x, 6);
    const y = S.yard;
    const onWall = ([x, , z]) => x < y.minX + 1 || x > y.maxX - 1 || z < y.minZ + 1 || z > y.maxZ - 1; // along the wall's line, the gateposts and the gate
    const fights = coplanarOverlaps(built.group, { gap: 0.003, minArea: 2e-5, textured: true }).filter((f) => onWall(f.at));
    expect(fights.map((f) => `${f.axis}${f.dir > 0 ? '+' : '-'} at ${f.at.map((v) => v.toFixed(2)).join(',')} area ${f.area.toFixed(3)}`)).toEqual([]);
  });
});

describe('her barn\'s big door is framed (#569)', () => {
  it('has a steel jamb each side, a header, a ramp over the threshold and the top rail for the sliding leaves, so the opening is not a bare gap', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildNeighbourFarm } = await import('../src/world/neighbourFarmProps.js');
    const c = headlessContext();
    const heights = createTerrainHeight(two, new Track(two.trackPoints));
    const built = buildNeighbourFarm({ ...c, layout: two, heights, gateParams: { swingSeconds: 1, blockBelow: 0.5, clearRadius: 3 } });
    built.group.updateMatrixWorld(true);
    let frame = null;
    built.group.traverse((o) => {
      if (o.isMesh && o.material?.name === 'barnDoorFrame') frame = o;
    });
    expect(frame, 'a mesh in the frame\'s steel').toBeTruthy();
    const box = new THREE.Box3().setFromObject(frame, true);
    const door = S.barn.door;
    expect(box.min.z).toBeLessThan(door.z - door.halfWidth - 0.2); // a jamb beyond the opening on the north
    expect(box.max.z).toBeGreaterThan(door.z + door.halfWidth + 0.2); // and the south
    expect(box.max.x).toBeGreaterThan(S.barn.outer.maxX + 0.15); // standing proud of the wall
    expect(box.max.y - heights.heightAt(door.x, door.z)).toBeGreaterThan(door.height + 0.7); // the header and the rail above the opening
    expect(box.min.z).toBeLessThan(door.z - door.halfWidth - 5); // the rail runs back along the wall for the leaves to slide on
  });
});
