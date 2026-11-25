import { timed } from '../core/loadSteps.js';
import * as THREE from 'three';
import { swayMaterials } from '../effects/windSway.js';
import { stripFrame, gravelStrip } from './layout.js';
import { inPlace } from './jobFields.js';
import { enableShadows, instanceModel, modelBounds } from './assets.js';
import { tiledInstances } from './tiledInstances.js';
import { scatterStubble, stubbleShares } from './stubbleScatter.js';
import { buildBarnShed } from './barnBuild.js';
import { underRoof } from './barn.js';
import { buildGardenWall, buildHomeRails } from './farmsteadProps.js';
import { buildYardGates, buildYardFurniture, buildStackyardKit } from './yardKit.js';
import { buildYardLights } from './yardLights.js';
import { buildWeatherVane } from './weatherVane.js';
import { buildJumpRamp } from './jumpRamp.js';
import { buildHill } from './hillProps.js';
import { buildWoods } from './woodsProps.js';
import { buildQuarry, buildPitEntrance } from './quarryProps.js';
import { buildFieldLandmarks } from './landmarkProps.js';
import { buildOutbuildings } from './outbuildingProps.js';
import { buildNeighbourFarm } from './neighbourFarmProps.js';
import { buildNeighbourLand } from './neighbourLandProps.js';
import { buildBackLaneProps } from './backLaneProps.js';
import { buildMoorProps } from './moorProps.js';
import { buildUpperThornby } from './upperThornby.js';
import { buildVillage } from './villageProps.js';
import { buildBrookCulvert } from './brookProps.js';
import { buildFarmBridge } from './farmBridge.js';
import { Scatter } from './scatter.js';
import { layHedge } from './hedgeLay.js';
import { leafReach } from './hedgeSolid.js';
import { buildFarHedges, HedgeSwap, leafTint, FAR_HEDGE_TOP, FAR_HEDGE_WIDTH, FAR_HEDGE_END } from './hedgeFar.js';
import { Gate, DEFAULT_GATE_PARAMS } from './gates.js';
import { roadNetwork } from './roads.js';
import { junctionBreaks, layByOf } from './aRoadFittings.js';
import { buildARoadProps } from './aRoadProps.js';
import { buildLaneFittings } from './laneFittingsProps.js';
import { buildRoadMesh, roadTexture, grassStripTexture } from './roadMesh.js';
import { buildCattleGrid, buildReflectorPosts, buildDriveVerge } from './driveProps.js';
import { streamFor } from './propStreams.js';
import { farmTreeSpots, distantTreeSpots, YARD_HALF } from './treeSpots.js';

const UP = new THREE.Vector3(0, 1, 0);

function matrixAt(x, y, z, yaw, sx, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(UP, yaw),
    new THREE.Vector3(sx, sy, sz),
  );
}

export { streamFor }; // each builder's own random stream (propStreams.js), here for the tests that already read it from props.js

/**
 * Builds every static prop on the farm and its colliders. What is only drawn near you and isn't needed for the first view (the grass, the stubble,
 * the Moor's plants) goes on `later`: [{ name, build }], which the World builds behind the start screen (#1107).
 */
export function buildProps(ctx) {
  const c = { ...ctx, random: null, streamFor, later: [] };
  const run = (name, build) => {
    c.random = streamFor(name);
    return timed(`props · ${name}`, build);
  };
  c.scatter = new Scatter(); // the oaks and bushes every builder places, scattered once at the end (scatter.js, #837)
  c.anchors = []; // every trunk the green's winch can hook (items/winchAnchor.js): { x, y, z, r }
  c.fixedBox = (x, y, z, hx, hy, hz, rotY = 0) => {
    const q = new THREE.Quaternion().setFromAxisAngle(UP, rotY);
    return ctx.physics.createCollider(
      ctx.RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRotation(q),
    );
  };

  const barn = run('buildBarn', () => buildBarn(c));
  const hedgeSwap = run('buildHedges', () => buildHedges(c));
  c.gateParams = { ...DEFAULT_GATE_PARAMS }; // shared by the gates, tuned in the panel
  const gates = run('gates', () => [buildGate(c), buildQuarryGate(c), buildRoadGate(c), buildGridGate(c), buildBypassGate(c), buildMoorGate(c)].filter(Boolean));
  const pitEntrance = run('buildPitLaneGate', () => buildPitLaneGate(c)); // the pit's shut lane gate and its entrance (#685, #1002)
  run('buildCattleGrid', () => buildCattleGrid(c));
  run('buildReflectorPosts', () => buildReflectorPosts(c));
  run('buildDriveVerge', () => buildDriveVerge(c));
  run('buildPublicLane', () => buildPublicLane(c));
  run('buildBackLane', () => buildBackLane(c));
  run('buildPaddock', () => buildPaddock(c));
  run('buildGardenWall', () => buildGardenWall(c)); // the new farm's garden plot and Home Ground's rail (#682); today's farm has neither
  run('buildHomeRails', () => buildHomeRails(c));
  run('buildYardGates', () => buildYardGates(c)); // the yard's dressing on the new farm (#817): its steel gates, the barn wall's gear, the heaps and the stackyard's bales
  const yard = run('buildYardFurniture', () => buildYardFurniture(c));
  run('buildStackyardKit', () => buildStackyardKit(c));
  const yardLights = run('buildYardLights', () => buildYardLights(c)); // the floodlights on the barn's gable and on a pole behind the tanks, dimmed up after dark (#817)
  const vane = run('buildWeatherVane', () => buildWeatherVane(c)); // on the barn's ridge, turning into the wind (#169)
  const bale = run('buildBales', () => buildBales(c));
  run('buildOutbuildings', () => buildOutbuildings({ ...c, bale }));
  const neighbourFarm = run('buildNeighbourFarm', () => buildNeighbourFarm(c));
  run('buildUpperThornby', () => buildUpperThornby(c)); // the far hamlet on the hill to the west, seen from Back Lane (#686)
  const backLane = run('buildBackLaneProps', () => buildBackLaneProps(c)); // Back Lane's hedges and gates (#686)
  const moor = run('buildMoorProps', () => buildMoorProps(c)); // the Moor beyond it: ridge wall, stile, trig pillar, grids and plants (#713)
  const neighbourLand = run('buildNeighbourLand', () => buildNeighbourLand(c)); // her fields across the lane, at far-ground detail (#569)
  const aRoad = run('buildARoadProps', () => buildARoadProps(c)); // the A-road's hedges and the junctions' furniture (#687)
  run('buildLaneFittings', () => buildLaneFittings(c)); // the lane's cottages, gateways, bin and postbox (#687)
  const village = run('buildVillage', () => buildVillage({ ...c, laneTexture }));
  run('buildBrookCulvert', () => buildBrookCulvert(c));
  run('buildFarmBridge', () => buildFarmBridge(c)); // where the stone track south crosses the river's head (#689)
  if (neighbourFarm) gates.push(neighbourFarm.gate); // the yard's own gate opens and shuts like the farm's
  if (neighbourLand) gates.push(neighbourLand.gate); // and so does her north field gate
  const silage = bale.silage;
  run('buildTrees', () => buildTrees(c));
  run('buildDistantTrees', () => buildDistantTrees(c));
  c.later.push({ name: 'grass', build: () => run('buildGrass', () => buildGrass(c)) }, { name: 'stubble', build: () => run('buildStubble', () => buildStubble(c)) });
  const puddles = run('buildPuddles', () => buildPuddles(c));
  run('buildBogs', () => buildBogs(c));
  const hillProps = ctx.fields.hill ? run('buildHill', () => buildHill(c)) : null;
  if (ctx.fields.woods) run('buildWoods', () => buildWoods(c));
  if (ctx.fields.quarry) run('buildQuarry', () => buildQuarry(c));
  run('buildFieldLandmarks', () => buildFieldLandmarks(c)); // the new farm's landmark in each field (#815); today's farm has none
  const jumpRamp = ctx.layout.jumpRamp ? run('buildJumpRamp', () => buildJumpRamp(c)) : null;
  const treeSwap = run('scatter', () => c.scatter.build(c.scene)); // every builder's oaks and bushes, the far ones swapped in beyond treeFullDistance
  return { hedgeSwaps: [hedgeSwap, hillProps?.wallSwap, neighbourLand?.hedgeSwap, backLane?.hedgeSwap, moor?.hedgeSwap, aRoad?.hedgeSwap, pitEntrance?.userData.hedgeSwap].filter(Boolean), treeSwaps: [treeSwap].filter(Boolean), barn, yardLights, vane, jumpRamp, silage, puddles, yard, pitEntrance, gates, neighbourFarm, neighbourLand, village, gateParams: c.gateParams, moor, stream: hillProps?.stream ?? null, hut: hillProps?.hut ?? null, anchors: c.anchors, later: c.later };
}

function buildBarn(c) {
  return buildBarnShed(c);
}

function buildHedges({ scene, models, layout, heights, fields, fixedBox, random, scatter }) {
  const { hedgeThickness: T } = layout;
  const hedgeSize = modelBounds(models.hedge.scene).getSize(new THREE.Vector3());
  const bushSize = modelBounds(models.bush.scene).getSize(new THREE.Vector3());
  const blockReach = leafReach(models.hedge.scene, hedgeSize); // how far its leaves reach, so none hangs past the solid part (hedgeSolid.js, #829)
  const bushReach = leafReach(models.bush.scene, { x: bushSize.y, z: bushSize.y });
  const hedgeMatrices = [];
  const bushMatrices = [];
  const farPieces = []; // the far version's strips (hedgeFar.js), one for each block, from the same numbers

  // Overlapping, randomly turned blocks of varying height read as an irregular hedgerow rather than a row of cubes. Each hedge line
  // (fields.js) runs a metre past its ends so the corners close. The lane's hedges are taller than the rest.
  for (const h of fields.hedges) {
    const H = h.height ?? layout.hedgeHeight;
    const lay = layHedge(h, { T, H, heightAt: heights.heightAt, random, blockReach, bushReach });
    const blocks = []; // { s, x, z, top, width, gap } for the far version: gap where a stretch starts (a gateway before it)
    let prevS = null;
    for (const b of lay.blocks) {
      hedgeMatrices.push(matrixAt(b.x, b.y, b.z, b.spin, b.width / hedgeSize.x, (H / hedgeSize.y) * b.tall, b.width / hedgeSize.z));
      // A stretch starts where the last block was a gateway away (a bit more than a block's step).
      const gap = prevS === null || h.gaps.some((g) => prevS < g.at && b.s > g.at);
      blocks.push({ s: b.s, x: b.x, z: b.z, top: b.y + H * b.tall * FAR_HEDGE_TOP, width: b.width * FAR_HEDGE_WIDTH, gap });
      prevS = b.s;
    }
    for (const b of lay.bushes) bushMatrices.push(matrixAt(b.x, b.y, b.z, b.yaw, b.height / bushSize.y));
    const pointAt = lay.pointAt;

    // The far version: a strip for each block, from the middle between it and the last to the middle between it and the next, so a stretch of
    // hedge is one unbroken line with the blocks' heights, and closed with half a block's length at each end of a stretch.
    blocks.forEach((b, i) => {
      const prev = b.gap ? null : blocks[i - 1];
      const next = blocks[i + 1] && !blocks[i + 1].gap ? blocks[i + 1] : null;
      const from = prev ? (prev.s + b.s) / 2 : b.s - FAR_HEDGE_END;
      const to = next ? (next.s + b.s) / 2 : b.s + FAR_HEDGE_END;
      const mid = pointAt((from + to) / 2);
      const a = pointAt(from);
      const e = pointAt(to);
      farPieces.push({
        x: b.x, z: b.z, cx: mid.x, cz: mid.z, along: [h.dx, h.dz], length: to - from, width: b.width, top: b.top, gap: b.gap, kind: 'hedge',
        groundA: heights.heightAt(a.x, a.z), groundB: heights.heightAt(e.x, e.z),
      });
    });
    for (const k of lay.colliders) fixedBox(k.x, k.y, k.z, k.hx, k.hy, k.hz, k.turn);
  }
  // Hedges don't cast shadows: there are hundreds of instances and the shadow pass would double their cost.
  swayMaterials(models.hedge.scene, 'hedge', layout.hedgeHeight);
  const near = instanceModel(models.hedge.scene, hedgeMatrices, { castShadow: false });
  const far = buildFarHedges(farPieces, { tint: leafTint(models.hedge.scene) });
  scene.add(near, far);
  scatter.bushes(models, bushMatrices);
  return new HedgeSwap(near, far);
}

function buildGate(c) {
  const { layout } = c;
  return buildFiveBarGate(c, { id: 'south', gate: layout.gate, z: layout.gate.z ?? layout.fieldHalf, dir: 1, gap: c.fields.gates.south });
}

/** The gate in the barley field's north hedge onto the gravel pit's field (layout.quarry.gate): swung back into the barley field and tied. */
function buildQuarryGate(c) {
  const { layout } = c;
  if (!layout.quarry) return null;
  if (layout.quarry.gates) {
    // The new farm's pit (#685): the farm gate in the pit's west fence, a field gate tied open into the field.
    const way = layout.quarry.gates.find((g) => g.open);
    return buildFiveBarGate(c, { id: 'quarry', gate: { x: way.x, width: way.width, open: true }, z: way.z, dir: -1, yaw: Math.atan2(way.inward[0], way.inward[1]), gap: c.fields.gates.quarry });
  }
  return buildFiveBarGate(c, { id: 'quarry', gate: layout.quarry.gate, z: layout.farm.minZ, dir: -1, gap: c.fields.gates.quarry });
}

/**
 * The pit's lane gate on the new farm (#685): the way the lorries came in, now shut and chained for good (Jamie, 15 November 2026). Solid and
 * never a `Gate`, so nothing opens it: the haul road ends in it, and you and the girls come in by the farm gate. Dressed with its entrance (#1002):
 * quarryProps.js `buildPitEntrance`, which keeps this gate's collider as it was. Returns the entrance's group, or null.
 */
function buildPitLaneGate(c) {
  return buildPitEntrance(c);
}

/**
 * A five-bar field gate at (gate.x, z) in a hedge along x. `dir` is the way it swings back into the grass field: 1 towards -z (the south hedge), -1 towards +z.
 * `yaw` turns the whole gate about its middle, for a fence along z (the pit's west side): then +z in the gate's own frame points along `yaw` into the field.
 */
function buildFiveBarGate({ scene, heights, fixedBox, gateParams }, { id, gate, z: F, dir, gap, yaw = 0 }) {
  const y = heights.heightAt(gate.x, F);
  const wood = new THREE.MeshStandardMaterial({ color: 0x8b7d66, roughness: 0.9 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6b5a45, roughness: 0.95 });
  const g = new THREE.Group();
  g.position.set(gate.x, y, F);
  g.rotation.y = yaw;
  const w = gate.width;

  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.9, 0.24), postMat);
    post.position.set((sx * w) / 2, 0.75, 0);
    g.add(post);
  }
  // Five-bar gate leaf, hung on the west post. Open (layout.gate.open), it's swung back into the field and tied to a stake.
  const leafW = w - 0.3;
  const leaf = new THREE.Group();
  leaf.position.set(-w / 2 + 0.15, 0, 0);
  const swing = dir * (Math.PI / 2 + 0.08); // swung right open
  leaf.rotation.y = gate.open ? swing : 0;
  const box = (bw, bh, bd, x, yy, rotZ = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), wood);
    m.position.set(x, yy, 0);
    m.rotation.z = rotZ;
    leaf.add(m);
  };
  for (let i = 0; i < 5; i++) box(leafW, 0.09, 0.05, leafW / 2, 0.22 + i * 0.235);
  box(0.12, 1.2, 0.07, 0.06, 0.68);
  box(0.12, 1.2, 0.07, leafW - 0.06, 0.68);
  box(0.09, 1.0, 0.05, leafW * 0.5, 0.68);
  const diag = Math.hypot(leafW - 0.2, 0.94);
  box(diag, 0.09, 0.05, leafW / 2, 0.68, Math.atan2(0.94, leafW - 0.2));
  g.add(leaf);
  const tie = new THREE.Group(); // the stake it's tied to, shown when it is swung right open
  g.add(tie);
  {
    // The stake it's tied to, by the closing end, and a loop of orange baler twine round the two.
    const end = new THREE.Vector3(leafW, 0, 0).applyAxisAngle(UP, swing).add(leaf.position);
    const stake = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 0.1), postMat);
    stake.position.set(end.x - 0.12, 0.5, end.z);
    tie.add(stake);
    const twine = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 5, 10), new THREE.MeshStandardMaterial({ color: 0xe0782a, roughness: 0.8 }));
    twine.position.set(end.x - 0.06, 0.92, end.z);
    twine.rotation.x = Math.PI / 2;
    tie.add(twine);
  }
  enableShadows(g);
  scene.add(g);
  // Shut, the whole gap is solid; swung open, only the leaf standing out into the field.
  const mid = new THREE.Vector3(leafW / 2, 0, 0).applyAxisAngle(UP, swing).add(leaf.position).applyAxisAngle(UP, yaw);
  return new Gate({
    id,
    params: gateParams,
    x: gate.x,
    z: F,
    open: !!gate.open,
    pose: (a) => {
      leaf.rotation.y = a * swing;
      tie.visible = a > 0.99;
    },
    solid: fixedBox(gate.x, y + 0.8, F, w / 2 + 0.2, 0.9, 0.2, yaw),
    swungSolid: fixedBox(gate.x + mid.x, y + 0.7, F + mid.z, leafW / 2, 0.7, 0.08, swing + yaw),
    gap,
  });
}

/**
 * The big gate at the end of the farm road (layout.road.gate), in the farm's east hedge: a pair of galvanised steel field gates on heavy
 * timber posts, shut, meeting in the middle with a chain round them. Seven tubular rails each, closer together towards the bottom, with a
 * diagonal brace from the foot of the hinge end.
 */
function buildRoadGate({ layout, fields, ...c }) {
  const road = layout.road;
  if (!road?.gate || !layout.farm) return;
  return buildSteelGate({ ...c, id: 'road', x: layout.farm.maxX, z: road.z, w: road.gate.width, swing: -1, gap: fields.gates.road });
}

/**
 * The gate across the farm road just east of the cattle grid (layout.road.grid.gateOffset), hedge to hedge so there is no way round it:
 * the same steel gates as the big one, swung out east to lie along the verges, shut at the start of a game.
 */
function buildGridGate({ layout, ...c }) {
  const road = layout.road;
  if (road?.grid?.gateOffset == null) return;
  const w = 2 * (road.halfWidth + road.verge) - 0.9; // between the hedges, less their thickness and the posts
  return buildSteelGate({ ...c, layout, id: 'grid', x: layout.fieldHalf + road.grid.gateOffset, z: road.z, w, swing: 1, gap: null });
}

/**
 * The field gate beside the drive's cattle grid (layout.road.bypass), in the boundary on the lane: for stock and horses, which can't cross the grid, on its own
 * posts so it stands clear of the grid's wing, shut and chained. The same steel gates as the big one, swung back into the drive. Only the new farm has it.
 */
function buildBypassGate({ layout, fields, ...c }) {
  const b = layout.road?.bypass;
  if (!b) return;
  return buildSteelGate({ ...c, layout, id: 'bypass', x: b.x, z: b.z, w: b.width, swing: -1, gap: fields.gates.bypass });
}

/** The moor gate in Hill Pasture's wall onto Back Lane and the common (layout.moor.gate, #713): the same steel gates as the bypass, hung across the wall and swung out onto the lane. */
function buildMoorGate({ layout, fields, ...c }) {
  const m = layout.moor?.gate;
  if (!m) return;
  return buildSteelGate({ ...c, layout, id: 'moor', x: m.x, z: m.z, w: m.width, swing: -1, gap: fields.gates.moor, turn: m.yaw });
}

/**
 * Two steel leaves hung from timber posts across the road at (x, z), `w` m between the posts; `swing` -1 opens them west, 1 east.
 */
function buildSteelGate({ scene, heights, fixedBox, gateParams, id, x, z, w, swing, gap, turn = 0 }) {
  const y = heights.heightAt(x, z);
  const steel = new THREE.MeshStandardMaterial({ color: 0xa8adaf, metalness: 0.6, roughness: 0.45 });
  const timber = new THREE.MeshStandardMaterial({ color: 0x5e4c38, roughness: 0.95 });
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = Math.PI / 2 + turn; // the gate's length (its local x) along the hedge, or along `turn` (a yaw, 0 north to south) where the wall runs aslant

  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.1, 0.3), timber);
    post.position.set((sx * (w / 2 + 0.15)), 0.75, 0);
    g.add(post);
  }
  const tube = (len, r, x0, y0, x1, y1) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), steel);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
    m.rotation.z = Math.atan2(x0 - x1, y1 - y0);
    return m;
  };
  const leafW = w / 2 - 0.05;
  const leaves = [];
  const rails = [0.12, 0.26, 0.41, 0.57, 0.75, 0.95, 1.18];
  for (const side of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.position.set(side * (w / 2), 0, 0); // hung from its post
    const along = (d) => -side * d; // from the hinge towards the middle
    for (const ry of rails) {
      const r = ry === rails[rails.length - 1] ? 0.03 : 0.018; // a heavier top rail
      leaf.add(tube(leafW, r, along(0), ry, along(leafW), ry));
    }
    leaf.add(tube(1.12, 0.025, along(0.03), 0.1, along(0.03), 1.2)); // hinge stile
    leaf.add(tube(1.12, 0.022, along(leafW - 0.03), 0.1, along(leafW - 0.03), 1.2)); // closing stile
    leaf.add(tube(Math.hypot(leafW * 0.55, 1.05), 0.018, along(0.05), 0.14, along(leafW * 0.55), 1.17)); // brace
    // Hinges: two straps round the post.
    for (const hy of [0.26, 1.1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.08), steel);
      strap.position.set(along(-0.02), hy, 0);
      leaf.add(strap);
    }
    g.add(leaf);
    leaves.push({ leaf, side });
  }
  // The chain round the two closing stiles.
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 12), new THREE.MeshStandardMaterial({ color: 0x55504a, metalness: 0.5, roughness: 0.6 }));
  chain.position.set(0, 0.95, 0);
  chain.rotation.y = Math.PI / 2;
  g.add(chain);
  enableShadows(g);
  scene.add(g);
  const solid = fixedBox(x, y + 0.8, z, 0.2, 0.9, w / 2 + 0.3, turn);
  return new Gate({
    id,
    params: gateParams,
    x,
    z,
    open: false,
    pose: (a) => {
      for (const { leaf, side } of leaves) leaf.rotation.y = swing * side * a * (Math.PI / 2 - 0.05); // inwards for the big gate, out for the grid's
      chain.visible = a < 0.05;
    },
    solid,
    gap,
  });
}

/** The pit's two gates on the new farm, for the tests that walk at them (the game builds them in `buildProps`). */
export { buildQuarryGate as pitFarmGate, buildPitLaneGate as pitLaneGate };

export const LANE_TARMAC_LIFT = 0.07; // m the lane's tarmac is laid above the ground, so things standing on it are lifted by this

/**
 * The public lane (layout.publicLane) outside the farm's east hedge: its road (world/roads.js) laid over the ground by the one road mesh builder
 * (world/roadMesh.js), a worn dashed line down its middle. The only solid things are the invisible walls that shut it in: the ground under it is the terrain's.
 */
function buildPublicLane({ scene, layout, heights, fixedBox }) {
  const lane = layout.publicLane;
  if (!lane) return;
  // Invisible walls shut the lane in on today's farm: along its near edge, you can walk through the gate onto the verge, but not out into the road; along
  // the stretch that is open to ride (layout.publicLane.open, world/neighbourFarm.js) they leave the big gate and the neighbour's wall,
  // and shut its far side and both ends. The new farm has none (#568, #687): its roads end at the A-road's junctions and the lane's southern line, where
  // you are turned round (world/turnRound.js).
  const net = roadNetwork(layout);
  const road = net.road('lane');
  const tarmac = new THREE.CanvasTexture(laneTexture());
  tarmac.wrapS = tarmac.wrapT = THREE.RepeatWrapping;
  tarmac.colorSpace = THREE.SRGBColorSpace;
  // One point a metre, as fine as the terrain's own grid, or its bumps show through.
  const points = net.pointsAlong('lane', { step: 1 });
  buildRoadMesh({ scene, road, points, heights, texture: tarmac });
  // The A-road and the village street's end, on the new farm (#687): the same builder, the A-road in its own newer tarmac and with its edge lines
  // broken where a side road opens onto it.
  const a = net.road('aRoad');
  if (a) {
    const texture = new THREE.CanvasTexture(roadTexture({ seed: 421, ...a.texture }));
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    buildRoadMesh({ scene, road: { ...a, edgeBreaks: junctionBreaks(net, a), layBys: [layByOf(a, layout.aRoadFittings?.layBy)].filter(Boolean) }, points: net.pointsAlong('aRoad', { step: 1 }), heights, texture });
  }
  const stub = net.road('streetEnd');
  if (stub) buildRoadMesh({ scene, road: stub, points: net.pointsAlong('streetEnd', { step: 1 }), heights, texture: tarmac });
}

/** Back Lane (#686): the single-track loop, in its own worn tarmac with tar-banded cracks and crumbling edges, and the grass down its middle. */
function buildBackLane({ scene, layout, heights }) {
  const net = roadNetwork(layout);
  const road = net.road('backLane');
  if (!road) return;
  const tarmac = new THREE.CanvasTexture(roadTexture({ seed: 311, ...road.texture }));
  tarmac.wrapS = tarmac.wrapT = THREE.RepeatWrapping;
  tarmac.colorSpace = THREE.SRGBColorSpace;
  const grass = new THREE.CanvasTexture(grassStripTexture());
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.colorSpace = THREE.SRGBColorSpace;
  buildRoadMesh({ scene, road: { ...road, strip: { ...road.strip, texture: grass } }, points: net.pointsAlong('backLane', { step: 1 }), heights, texture: tarmac });
}

/** Worn grey tarmac: speckle, a darker band down each wheel track and a pale, crumbling edge (world/roadMesh.js). */
export function laneTexture() {
  return roadTexture();
}

/** Whether (x, z) is on the concrete yard `slab` (a rectangle), if the farm has one. */
const onSlab = (slab, x, z) => !!slab && x > slab.minX && x < slab.maxX && z > slab.minZ && z < slab.maxZ;

function buildPaddock({ scene, models, layout, heights, fixedBox }) {
  if (!layout.paddock) return; // the new farm has none: its fences are Home Ground's rails
  const { x: px, z: pz, half } = layout.paddock;
  const fenceLen = modelBounds(models.fence.scene).getSize(new THREE.Vector3()).x;
  const segLen = half;
  const sx = segLen / fenceLen;
  const runs = [];
  // Two segments per side, leaving the side facing the yard half open.
  for (const i of [-0.5, 0.5]) {
    runs.push({ x: px + i * segLen, z: pz - half, yaw: 0 });
    runs.push({ x: px + i * segLen, z: pz + half, yaw: 0 });
    runs.push({ x: px - half, z: pz + i * segLen, yaw: Math.PI / 2 });
  }
  runs.push({ x: px + half, z: pz - 0.5 * segLen, yaw: Math.PI / 2 });
  for (const r of runs) {
    const f = models.fence.scene.clone();
    const y = heights.heightAt(r.x, r.z) - 0.05;
    f.position.set(r.x, y, r.z);
    f.rotation.y = r.yaw;
    f.scale.set(sx, 1, 1);
    enableShadows(f);
    scene.add(f);
    fixedBox(r.x, y + 0.55, r.z, segLen / 2, 0.55, 0.1, r.yaw);
  }
}

// Round bales ---------------------------------------------------------------

function strawCanvas(random, ends) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c9a94f';
  ctx.fillRect(0, 0, 256, 256);
  if (!ends) {
    // Baler twine: loops round the middle of the bale in a few turns, a darker line with a lighter edge.
    for (const y of [64, 78, 178, 192]) {
      ctx.fillStyle = 'rgba(70,45,15,0.55)';
      ctx.fillRect(0, y, 256, 3);
      ctx.fillStyle = 'rgba(250,225,150,0.35)';
      ctx.fillRect(0, y + 3, 256, 1);
    }
  }
  if (ends) {
    for (let r = 4; r < 128; r += 3 + random() * 3) {
      ctx.strokeStyle = random() < 0.5 ? 'rgba(120,90,30,0.45)' : 'rgba(240,215,130,0.4)';
      ctx.lineWidth = 1 + random() * 1.5;
      ctx.beginPath();
      ctx.arc(128, 128, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 1400; i++) {
    const x = random() * 256;
    const y = random() * 256;
    const len = 6 + random() * 18;
    const a = ends ? random() * Math.PI : (random() - 0.5) * 0.3;
    ctx.strokeStyle = random() < 0.5 ? 'rgba(130,95,35,0.35)' : 'rgba(245,220,140,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Silage wrap: bands of film overlapping round the bale, a little lighter where one layer lies over the next. */
function wrapCanvas(random) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#16181a';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    ctx.fillStyle = `rgba(255,255,255,${0.04 + random() * 0.05})`;
    ctx.fillRect(0, y, 256, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, y + 4, 256, 2);
  }
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    const x = random() * 256;
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (random() - 0.5) * 30, 256);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A round bale body: a cylinder with a rounded rim and a slight belly, so it stops looking like a tin. Axis along y, three material groups. */
export function roundBaleGeometry(R, W) {
  const geo = new THREE.CylinderGeometry(R, R, W, 32, 14);
  const pos = geo.attributes.position;
  const half = W / 2;
  const rim = 0.2; // how much of each end is rounded off
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ay = Math.abs(y);
    let k = 1 + 0.025 * (1 - (y / half) ** 2); // belly
    if (ay > half - rim) {
      const t = (ay - (half - rim)) / rim;
      k *= 1 - 0.12 * t * t; // the end ring is 12% narrower, eased in over the rim
    }
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildBales({ scene, layout, heights, track, physics, RAPIER, random }) {
  const R = 0.75;
  const W = 1.2;
  const geo = roundBaleGeometry(R, W);
  const strawSide = new THREE.MeshStandardMaterial({ map: strawCanvas(random, false), roughness: 1 });
  const strawEnd = new THREE.MeshStandardMaterial({ map: strawCanvas(random, true), roughness: 1 });
  const straw = [strawSide, strawEnd, strawEnd];
  const wrapSide = new THREE.MeshStandardMaterial({ color: 0xffffff, map: wrapCanvas(random), roughness: 0.32, metalness: 0.0 });
  const wrapEnd = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.4 });
  const wrap = [wrapSide, wrapEnd, wrapEnd];

  const place = (x, z, { wrapped = false, upright = false, stackLevel = 0, yaw = 0 }) => {
    const mesh = new THREE.Mesh(geo, wrapped ? wrap : straw);
    const ground = heights.heightAt(x, z);
    const y = upright ? ground + W / 2 + stackLevel * W - 0.03 : ground + R - 0.06;
    mesh.position.set(x, y, z);
    const q = new THREE.Quaternion();
    if (!upright) q.setFromEuler(new THREE.Euler(0, yaw, Math.PI / 2, 'YXZ'));
    else q.setFromAxisAngle(UP, yaw);
    mesh.quaternion.copy(q);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    const collider = physics.createCollider(
      RAPIER.ColliderDesc.cylinder(W / 2, R).setTranslation(x, y, z).setRotation(q).setFriction(0.8),
    );
    return { mesh, collider, x, y, z, yaw };
  };

  // The wrapped silage stands on its end, so the tractor's spike can lift it (items/baleSpike.js): the game moves these meshes and their colliders.
  const silage = [];
  const placeSilage = (x, z, opts) => silage.push({ id: `silage${silage.length}`, ...place(x, z, { wrapped: true, upright: true, ...opts }) });

  // Wrapped silage stacked two high beside the barn (layout.silage).
  const sx = layout.silage?.x ?? layout.barn.x - 3;
  const sz = layout.silage?.z ?? layout.barn.z + 9;
  for (let i = 0; i < 4; i++) placeSilage(sx + i * 1.55, sz);
  for (let i = 0; i < 3; i++) placeSilage(sx + 0.78 + i * 1.55, sz, { stackLevel: 1 });
  for (let i = 0; i < 3; i++) placeSilage(sx + i * 1.55 + 0.3, sz + 1.6);

  // Straw bales in the barn, to sit on out of the rain.
  for (const [x, z, yaw] of layout.barnBaleSpots ?? []) place(x, z, { yaw });

  // Straw bales out in the field, away from the track.
  for (const [x, z, yaw] of layout.strawBaleSpots) {
    if (track.distanceTo(x, z, 10) < layout.trackHalfWidth + 3) continue;
    place(x, z, { yaw });
  }
  return { geo, straw, silage }; // for the Dutch barn's stack (outbuildingProps.js), and the silage the spike moves (game.js)
}

// Trees ---------------------------------------------------------------------

function buildTrees({ models, layout, heights, physics, RAPIER, random, anchors, scatter }) {
  const mats = [[], []];
  for (const { x, z, v, s, yaw } of farmTreeSpots(layout, random)) { // where they stand (treeSpots.js)
    mats[v].push(matrixAt(x, heights.heightAt(x, z) - 0.15, z, yaw, s));
    physics.createCollider(
      RAPIER.ColliderDesc.cylinder(2.5 * s, 0.32 * s).setTranslation(x, heights.heightAt(x, z) + 2.5 * s, z),
    );
    anchors.push({ x, y: heights.heightAt(x, z), z, r: 0.32 * s });
  }
  // Trees and hedges lean and rock in the wind (effects/windSway.js; the metres are at the top in an ordinary wind, wind.js).
  swayMaterials(models.treeA.scene, 'tree', 8);
  swayMaterials(models.treeB.scene, 'tree', 8);
  scatter.oaks(models, mats);
}

/** Cheap low-poly tree clumps along the distant hedgerows for depth on the horizon. */
function buildDistantTrees({ scene, layout, heights, fields, random }) {
  const trunks = [];
  const crowns = [];
  for (const { x, z, s, crown } of distantTreeSpots(layout, fields, roadNetwork(layout), random)) { // where they stand (treeSpots.js)
    const y = heights.heightAt(x, z);
    trunks.push(matrixAt(x, y, z, 0, s));
    crowns.push(matrixAt(x, y + 5 * s, z, ...crown));
  }
  const trunkMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.25, 0.4, 5, 5).translate(0, 2.5, 0),
    new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 1 }),
    trunks.length,
  );
  const crownMesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }),
    crowns.length,
  );
  const col = new THREE.Color();
  trunks.forEach((m, i) => trunkMesh.setMatrixAt(i, m));
  crowns.forEach((m, i) => {
    crownMesh.setMatrixAt(i, m);
    col.setHSL(0.24 + random() * 0.06, 0.35 + random() * 0.15, 0.2 + random() * 0.08);
    crownMesh.setColorAt(i, col);
  });
  scene.add(trunkMesh, crownMesh);
}

/** Whether (x, z) is in the hay meadow or the ragged margin of it (world/hayMask.js), where no other ground cover grows. */
export function inHayMeadow(layout, x, z) {
  const m = layout.hayMeadow;
  return !!m && inPlace(m, x, z, 4);
}

/** Instanced grass tufts across the field, kept off the track, the yard and the hay meadow. */
function buildGrass({ scene, layout, heights, random, drawDistance, fields }) {
  const blades = 7;
  const pos = [];
  const colors = [];
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + random();
    const r = random() * 0.08;
    const bx = Math.cos(a) * r;
    const bz = Math.sin(a) * r;
    const lean = 0.05 + random() * 0.08;
    const w = 0.012;
    const h = 0.1 + random() * 0.12;
    const px = -Math.sin(a) * w;
    const pz = Math.cos(a) * w;
    pos.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, bx + Math.cos(a) * lean, h, bz + Math.sin(a) * lean);
    colors.push(0.26, 0.36, 0.15, 0.26, 0.36, 0.15, 0.46, 0.56, 0.26);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  // Point normals up so the blades light like the ground under them.
  const normals = geo.getAttribute('normal');
  for (let i = 0; i < normals.count; i++) normals.setXYZ(i, 0, 1, 0);

  const count = 90000;
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const matrices = [];
  const tints = [];
  const F = YARD_HALF - 1.5;
  const { yard } = layout;
  const strip = gravelStrip(layout);
  let tries = 0;
  while (matrices.length < count && tries++ < count * 3) {
    const x = (random() * 2 - 1) * F;
    const z = (random() * 2 - 1) * F;
    if (heights.mudAt(x, z) > 0.02) continue;
    if (Math.hypot(x - yard.x, z - yard.z) < yard.radius * 0.75) continue;
    if (onSlab(layout.farmstead?.slab, x, z)) continue; // the new farm's yard is concrete: nothing grows through it
    if (underRoof(layout, x, z)) continue; // none growing up through the barn floor, in either span
    if (inHayMeadow(layout, x, z)) continue; // the meadow has its own long grass, and cut hay has none standing in it
    if (fields?.stoneAt?.(x, z) > 0.2 || fields?.grassTrackAt?.(x, z) > 0.5) continue; // none on the farm's stone tracks, nor in the wheel lines of the grass one (#689)
    if (strip) {
      // None growing through the gravel of the drag strip.
      const f = stripFrame(strip, x, z);
      if (f.along > -3 && f.along < strip.length + strip.runOff + 3 && Math.abs(f.across) < strip.width / 2 + 2) continue;
    }
    const s = 0.6 + random() * 0.8;
    matrices.push(matrixAt(x, heights.heightAt(x, z) - 0.02, z, random() * 6.28, s, s * (0.7 + random() * 0.6), s));
    tints.push(new THREE.Color().setHSL(0.2 + random() * 0.05, 0.3 + random() * 0.15, 0.55 + random() * 0.2));
  }
  scene.add(drawDistance.add(tiledInstances(geo, material, matrices, { colors: tints, name: 'grass' }), 'coverDistance'));
}

/**
 * Cut straw stalks standing in the stubble fields, in the drill rows (half a metre apart, the way each field was drilled), inside each field's
 * own outline, off the tarmac and clear of the hedges: each field's own crop (layout.stubbleFields), the barley shorter, greyer and thicker
 * than the wheat. `layout.stubbleClumps` clumps are shared out by the fields' areas: today's two fields (1.8 ha) get 60,000 and the new farm's
 * six (25.5 ha) 150,000, a sixth as thick, which is what the load and the memory stand (#813).
 */
function buildStubble({ scene, layout, fields, heights, random, drawDistance }) {
  const areas = fields.stubbleFields ?? ['north', 'south'].filter((k) => fields.areas[k]);
  if (!areas.length) return;
  const fieldsList = areas.map((k) => ({ polygon: fields.polygons[k], f: fields.stubbleField(k) ?? {} }));
  const shares = stubbleShares(fieldsList.map(({ polygon, f }) => ({ polygon, density: f.density })), layout.stubbleClumps ?? 60000);
  for (let n = 0; n < fieldsList.length; n++) {
    const { polygon, f } = fieldsList[n];
    const [lowH, highH] = f.stalkHeight ?? [0.08, 0.16];
    const [tip, base] = f.stalk ?? [[0.8, 0.66, 0.38], [0.5, 0.4, 0.22]];
    const stalks = 6;
    const pos = [];
    const colors = [];
    for (let i = 0; i < stalks; i++) {
      // Along the row, a hand's width of stalks, cut square and leaning a little.
      const bx = (random() - 0.5) * 0.14;
      const bz = (random() - 0.5) * 0.03;
      const w = 0.006;
      const h = lowH + random() * (highH - lowH);
      const lx = (random() - 0.5) * 0.04;
      const lz = (random() - 0.5) * 0.04;
      const a = [bx - w, 0, bz];
      const b = [bx + w, 0, bz];
      const c = [bx + lx + w, h, bz + lz];
      const d = [bx + lx - w, h, bz + lz];
      // Each face twice, once each way round, drawn front side only: lit the same from either side (a double-sided material would flip the
      // up-pointing normal on the back and draw it dark).
      for (const tri of [[a, b, c], [a, c, d], [a, c, b], [a, d, c]]) {
        for (const v of tri) {
          pos.push(...v);
          colors.push(...(v[1] > 0 ? tip : base));
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const normals = geo.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) normals.setXYZ(i, 0, 1, 0);

    const matrices = [];
    const tints = [];
    const alongX = f.rows !== 'z';
    scatterStubble({
      polygon,
      alongX,
      count: shares[n],
      random,
      accept: (x, z) => fields.stubbleAt(x, z) >= 0.99 && fields.hedgeDistance(x, z) >= 1.5,
      make(x, z) {
        const sc = 0.8 + random() * 0.5;
        const yaw = (alongX ? 0 : Math.PI / 2) + (random() - 0.5) * 0.3;
        matrices.push(matrixAt(x, heights.heightAt(x, z) - 0.01, z, yaw, sc, sc * (0.7 + random() * 0.6), sc));
        tints.push(new THREE.Color().setHSL(0.11 + random() * 0.03, (f.crop === 'barley' ? 0.25 : 0.45) + random() * 0.15, 0.5 + random() * 0.12));
      },
    });
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    scene.add(drawDistance.add(tiledInstances(geo, material, matrices, { colors: tints, name: `stubble-${areas[n]}` }), 'coverDistance'));
  }
}

/** A bog's surface: wet, shiny, nearly black mud with a ragged edge, sitting in its dip. */
function buildBogs({ scene, heights }) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x2e2416, roughness: 0.22, metalness: 0.05, transparent: true, opacity: 0.85, depthWrite: false });
  for (const b of heights.bogs ?? []) {
    const n = 36;
    const shape = new THREE.Shape();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = b.radius * (0.62 + 0.1 * Math.sin(a * 3 + b.x) + 0.06 * Math.sin(a * 7 + b.z));
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const geo = new THREE.ShapeGeometry(shape, 1).rotateX(-Math.PI / 2);
    // Drape it over the ground so it follows the dip.
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, heights.heightAt(b.x + pos.getX(i), b.z + pos.getZ(i)) + 0.03);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(b.x, 0, b.z);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}

function buildPuddles({ scene, layout, heights }) {
  const meshes = [];
  for (const p of heights.puddles) {
    // Each has its own material: the ice on one is cracked or gone while the next is sound.
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a4236, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.88 });
    const bottom = heights.heightAt(p.x, p.z);
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(layout.puddleRadius * 0.8, 28).rotateX(-Math.PI / 2), mat);
    mesh.position.set(p.x, bottom + layout.puddleDepth * 0.6, p.z);
    mesh.scale.set(1, 1, 0.75);
    mesh.rotation.y = Math.atan2(p.tx, p.tz);
    mesh.receiveShadow = true;
    scene.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}
