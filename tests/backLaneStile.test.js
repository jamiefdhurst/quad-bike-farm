import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { headlessContext } from './helpers/worldModels.js';
import { LAYOUT } from '../src/world/layout.js';
import { roadNetwork } from '../src/world/roads.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { laneGaps, laneGates, sidePoint, hedgeOffset } from '../src/world/laneHedges.js';
import { CHASSIS_COLLIDER } from '../src/vehicle/quadPhysics.js';
import { MOTO_LAYOUT } from '../src/vehicle/miniMotoModel.js';

// Back Lane's colliders in a real Rapier world, built by the lane's own builder with the ground held level at the stile as hutEntry.test.js holds it at
// the hut, and a vehicle's bodywork box driven off the tarmac at the stile with a character controller (#1017): the stile in the hedge is for walkers,
// so nothing on wheels may get through its gap into the field. The same drive through one of the lane's field gates gets through, so the test can tell.
const road = roadNetwork(LAYOUT).road('backLane');
const stile = laneGaps(road).find((g) => g.kind === 'stile');
const gate = laneGates(road)[0];
const SPEED = 4; // m/s, a quad nosing into a gateway
let world;
let ground;

async function build() {
  await RAPIER.init();
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  const { buildBackLaneProps } = await import('../src/world/backLaneProps.js');
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const real = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints));
  const at = sidePoint(road, stile.s, stile.side, hedgeOffset(road, stile.s, stile.side));
  ground = real.heightAt(at.x, at.z);
  const heights = Object.create(real);
  heights.heightAt = () => ground;
  world.createCollider(RAPIER.ColliderDesc.cuboid(4000, 0.5, 4000).setTranslation(at.x, ground - 0.5, at.z));
  const fixedBox = (x, y, z, hx, hy, hz, rotY = 0) =>
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY)));
  buildBackLaneProps({ ...headlessContext(), layout: LAYOUT, heights, fixedBox, physics: world, RAPIER });
  vi.unstubAllGlobals();
}

/**
 * Drives the box `chassis` ({ hx, hy, hz }, `clear` m of ground under it) from the tarmac straight out across the hedge line at `gap`, `along` m from its
 * middle, for ten seconds. Returns how far out from the road's middle its centre ends, and the hedge line's distance there.
 */
function driveOut(gap, along, chassis, clear) {
  const s = gap.s + along;
  const start = sidePoint(road, s, gap.side, road.halfWidth - chassis.hz);
  const out = { x: start.tz * gap.side, z: -start.tx * gap.side }; // straight out from the road on the gap's side, as sidePoint has it
  const yaw = Math.atan2(out.x, out.z); // the box's length along the way it goes
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(start.x, ground + clear + chassis.hy, start.z)
      .setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)),
  );
  const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(chassis.hx, chassis.hy, chassis.hz), body);
  const ctl = world.createCharacterController(0.03);
  ctl.setUp({ x: 0, y: 1, z: 0 });
  ctl.enableAutostep(0.3, 0.2, false); // a wheel's height of step it may climb, more than a quad's box would
  for (let i = 0; i < 600; i++) {
    ctl.computeColliderMovement(collider, { x: (out.x * SPEED) / 60, y: 0, z: (out.z * SPEED) / 60 });
    const m = ctl.computedMovement();
    const t = body.translation();
    body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    world.step();
  }
  const p = body.translation();
  const mid = sidePoint(road, s, gap.side, 0);
  const reached = (p.x - mid.x) * out.x + (p.z - mid.z) * out.z;
  world.removeCharacterController(ctl);
  world.removeRigidBody(body);
  return { reached, line: hedgeOffset(road, s, gap.side) };
}

const QUAD = { ...CHASSIS_COLLIDER, clear: 0.25 }; // the red quad's bodywork box, its belly a quad's ground clearance up
const MOTO = { ...MOTO_LAYOUT.chassis, clear: 0.15 }; // the mini moto's, the narrowest thing on wheels on the farm

describe("Back Lane's stile", () => {
  beforeAll(build);

  it('is on the lane, in the hedge on the footpath\'s side', () => {
    expect(stile).toBeTruthy();
    expect(gate).toBeTruthy();
  });

  it('lets a quad through one of the lane\'s field gates (the drive below can get through a gap)', () => {
    const { reached, line } = driveOut({ s: gate.s, side: gate.side }, 0, QUAD, QUAD.clear);
    expect(reached).toBeGreaterThan(line + 3);
  });

  it('stops a quad driven at it, in the middle of its gap and to either side (#1017)', () => {
    for (const along of [-0.5, 0, 0.5]) {
      const { reached, line } = driveOut(stile, along, QUAD, QUAD.clear);
      expect(reached, `${along} m along the gap`).toBeLessThan(line);
    }
  });

  it('is shut from one end of its gap to the other: the mini moto, narrower than anything else on wheels, gets through nowhere (#1017)', () => {
    for (let along = -0.9; along <= 0.9 + 1e-9; along += 0.15) {
      const { reached, line } = driveOut(stile, along, MOTO, MOTO.clear);
      expect(reached, `${along.toFixed(2)} m along the gap`).toBeLessThan(line);
    }
  });
});

describe("Back Lane's stile on the farm's own ground", () => {
  it('is solid from under the ground to the top of its posts across the whole gap, wherever the ground falls under it', async () => {
    const { laneStile, STILE_HALF, STILE_SOLID_TOP } = await import('../src/world/laneHedges.js');
    const real = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints));
    const st = laneStile(road, (x, z) => real.heightAt(x, z));
    expect(st.s).toBeCloseTo(stile.s, 6);
    expect(st.box.hx).toBe(STILE_HALF); // the gap's own half-width: nothing open at its ends
    for (const a of [-STILE_HALF, 0, STILE_HALF]) {
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
