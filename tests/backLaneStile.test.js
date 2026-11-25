import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { headlessContext } from './helpers/worldModels.js';
import { LAYOUT } from '../src/world/layout.js';
import { roadNetwork } from '../src/world/roads.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { laneGaps, laneGates, laneHedgeRuns, laneStile, sidePoint, hedgeOffset, STILE_HALF, STILE_OWN_HALF, STILE_SOLID_TOP } from '../src/world/laneHedges.js';
import { layLaneHedge } from '../src/world/hedgeLay.js';
import { CHASSIS_COLLIDER } from '../src/vehicle/quadPhysics.js';
import { MOTO_LAYOUT } from '../src/vehicle/miniMotoModel.js';

// Back Lane's stile in a real Rapier world, with the ground held level at it as hutEntry.test.js holds it at the hut, and a vehicle's bodywork box driven
// off the tarmac at it with a character controller (#1017): a stile is for walkers, so nothing on wheels gets over it or through its gap. On today's farm
// the stile stands on the Moor's open side (#713), with no hedge beside it, so the lane's own builder is built and the stile alone is shut, no wall
// beyond its posts; the same stile in a hedge (the road with no common) shuts the hedge's whole gap, laid with the hedge's own colliders.
const road = roadNetwork(LAYOUT).road('backLane');
const stile = laneGaps(road).find((g) => g.kind === 'stile');
const gate = laneGates(road)[0];
const hedgedRoad = { ...road, moor: undefined }; // no common, so the hedge runs right up to the stile both sides
const SPEED = 4; // m/s, a quad nosing into a gateway
const real = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints));
const at = sidePoint(road, stile.s, stile.side, hedgeOffset(road, stile.s, stile.side));
const ground = real.heightAt(at.x, at.z);
let world;
let hedged;

const boxAt = (w, k) =>
  w.createCollider(RAPIER.ColliderDesc.cuboid(k.hx, k.hy, k.hz).setTranslation(k.x, k.y, k.z).setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), k.turn ?? 0)));

function levelWorld() {
  const w = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  w.createCollider(RAPIER.ColliderDesc.cuboid(4000, 0.5, 4000).setTranslation(at.x, ground - 0.5, at.z));
  return w;
}

async function build() {
  await RAPIER.init();
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  const { buildBackLaneProps } = await import('../src/world/backLaneProps.js');
  world = levelWorld();
  const heights = Object.create(real);
  heights.heightAt = () => ground;
  const fixedBox = (x, y, z, hx, hy, hz, turn = 0) => boxAt(world, { x, y, z, hx, hy, hz, turn });
  buildBackLaneProps({ ...headlessContext(), layout: LAYOUT, heights, fixedBox, physics: world, RAPIER });
  vi.unstubAllGlobals();
  // The stile in a hedge: the hedge's colliders 20 m either side of it, as layLaneHedge lays them, and the stile's box.
  hedged = levelWorld();
  for (const run of laneHedgeRuns(hedgedRoad, laneGaps(hedgedRoad)).filter((r) => r.side === stile.side && r.to > stile.s - 20 && r.from < stile.s + 20)) {
    const lay = layLaneHedge(hedgedRoad, run, { T: LAYOUT.hedgeThickness, H: 2.5, heightAt: () => ground, random: () => 0.5, blockReach: 1 });
    for (const k of lay.colliders) if (Math.abs((k.s0 + k.s1) / 2 - stile.s) < 20) boxAt(hedged, k);
  }
  boxAt(hedged, laneStile(hedgedRoad, () => ground).box);
}

/**
 * Drives the box `chassis` ({ hx, hy, hz, clear: m of ground under it }) on `w` from the tarmac of `r` straight out across the hedge line at `s` on
 * `side`, for ten seconds. Returns how far out from the road's middle its centre ends, and the hedge line's distance there.
 */
function driveOut(w, r, s, side, chassis) {
  const start = sidePoint(r, s, side, r.halfWidth - chassis.hz);
  const out = { x: start.tz * side, z: -start.tx * side }; // straight out from the road on that side, as sidePoint has it
  const yaw = Math.atan2(out.x, out.z); // the box's length along the way it goes
  const body = w.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(start.x, ground + chassis.clear + chassis.hy, start.z)
      .setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)),
  );
  const collider = w.createCollider(RAPIER.ColliderDesc.cuboid(chassis.hx, chassis.hy, chassis.hz), body);
  const ctl = w.createCharacterController(0.03);
  ctl.setUp({ x: 0, y: 1, z: 0 });
  ctl.enableAutostep(0.3, 0.2, false); // a wheel's height of step it may climb, more than a quad's box would
  for (let i = 0; i < 600; i++) {
    ctl.computeColliderMovement(collider, { x: (out.x * SPEED) / 60, y: 0, z: (out.z * SPEED) / 60 });
    const m = ctl.computedMovement();
    const t = body.translation();
    body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    w.step();
  }
  const p = body.translation();
  const mid = sidePoint(r, s, side, 0);
  const reached = (p.x - mid.x) * out.x + (p.z - mid.z) * out.z;
  w.removeCharacterController(ctl);
  w.removeRigidBody(body);
  return { reached, line: hedgeOffset(r, s, side) };
}

const QUAD = { ...CHASSIS_COLLIDER, clear: 0.25 }; // the red quad's bodywork box, its belly a quad's ground clearance up
const MOTO = { ...MOTO_LAYOUT.chassis, clear: 0.15 }; // the mini moto's, the narrowest thing on wheels on the farm

beforeAll(build);

describe("Back Lane's stile, where it stands on the Moor's open side", () => {
  it('has no hedge beside it, so its box is its own posts and rail', () => {
    expect(laneStile(road).hedged).toBe(false);
    expect(laneStile(road).box.hx).toBe(STILE_OWN_HALF);
  });

  it("lets a quad through one of the lane's field gates (the drive below gets through where nothing stands)", () => {
    const { reached, line } = driveOut(world, road, gate.s, gate.side, QUAD);
    expect(reached).toBeGreaterThan(line + 3);
  });

  it('stops a quad driven at it, at its middle and to either side (#1017)', () => {
    for (const along of [-0.5, 0, 0.5]) {
      const { reached, line } = driveOut(world, road, stile.s + along, stile.side, QUAD);
      expect(reached, `${along} m along`).toBeLessThan(line);
    }
  });

  it('stops the mini moto, narrower than anything else on wheels, anywhere across it (#1017)', () => {
    for (let along = -0.75; along <= 0.75 + 1e-9; along += 0.15) {
      const { reached, line } = driveOut(world, road, stile.s + along, stile.side, MOTO);
      expect(reached, `${along.toFixed(2)} m along`).toBeLessThan(line);
    }
  });

  it('is no wall beyond its posts: a quad goes by 1.5 m to either side, onto the common', () => {
    for (const along of [-1.5, 1.5]) { // a box the gap's width would stop it; not 3 m back, where the fingerpost stands by the tarmac
      const { reached, line } = driveOut(world, road, stile.s + along, stile.side, QUAD);
      expect(reached, `${along} m along`).toBeGreaterThan(line + 3);
    }
  });
});

describe("Back Lane's stile in a hedge", () => {
  it("shuts the hedge's whole gap", () => {
    const st = laneStile(hedgedRoad);
    expect(st.hedged).toBe(true);
    expect(st.box.hx).toBe(STILE_HALF);
  });

  it('stops the quad, and lets nothing by beside the posts from one end of the gap to the other (#1017)', () => {
    for (const along of [-0.5, 0, 0.5]) {
      const { reached, line } = driveOut(hedged, hedgedRoad, stile.s + along, stile.side, QUAD);
      expect(reached, `the quad, ${along} m along`).toBeLessThan(line);
    }
    // A 10 cm probe, far thinner than anything on wheels: the mini moto doesn't fit the 0.37 m between the posts and the hedge's end on this bend,
    // but the probe does, so it finds a box no wider than the stile itself (0.75 to 1.1 m along went 41 m on with one).
    const PROBE = { hx: 0.05, hy: 0.2, hz: 0.3, clear: 0.1 };
    for (let along = -1.05; along <= 1.05 + 1e-9; along += 0.1) {
      const { reached, line } = driveOut(hedged, hedgedRoad, stile.s + along, stile.side, PROBE);
      expect(reached, `the probe, ${along.toFixed(2)} m along`).toBeLessThan(line);
    }
  });
});

describe("Back Lane's stile on the farm's own ground", () => {
  it('is solid from under the ground to over its posts, wherever the ground falls under it', () => {
    const st = laneStile(road, (x, z) => real.heightAt(x, z));
    expect(st.s).toBeCloseTo(stile.s, 6);
    for (const a of [-st.box.hx, 0, st.box.hx]) {
      const p = sidePoint(road, st.s + a, st.side, hedgeOffset(road, st.s, st.side));
      const h = real.heightAt(p.x, p.z);
      expect(st.box.y - st.box.hy).toBeLessThan(h);
      expect(st.box.y + st.box.hy).toBeGreaterThanOrEqual(h + STILE_SOLID_TOP - 0.05);
    }
  });

  it("is on the farm's list of placed things, solid and its gap's own, breaking no rule", async () => {
    const { farmPlacements, placementBreaks } = await import('../src/world/farmPlacement.js');
    const listed = farmPlacements(LAYOUT).filter((t) => t.name === "Back Lane's stile");
    expect(listed.length).toBe(1);
    expect(listed[0].solid).toBe(true);
    expect(placementBreaks(listed[0], LAYOUT)).toEqual([]);
  });
});
