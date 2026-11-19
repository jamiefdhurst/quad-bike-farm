// Back Lane drawn beyond its tarmac (#686, layout 2 only): the tall hedge down each side with a collider along it, in leafy blocks near and plain strips far
// (hedgeFar.js, as the farm's and the neighbour's), and a field gate in the inner hedge across from each of the farm's gateways. The road itself is drawn by
// props.js with the one road mesh builder; where the hedges stand and where they break is laneHedges.js. Passing places push the hedge back.

import * as THREE from 'three';
import { roadNetwork } from './roads.js';
import { laneHedgeRuns, hedgeOffset, sidePoint, sideOf } from './laneHedges.js';
import { laneSigns, sAlong, footpathSide } from './laneSigns.js';
import * as kit from './roadSigns.js';
import { buildFarHedges, HedgeSwap, leafTint, FAR_HEDGE_TOP, FAR_HEDGE_WIDTH, FAR_HEDGE_END } from './hedgeFar.js';
import { matrixAt } from './hillProps.js';
import { gateLeaf } from './neighbourFarmProps.js';
import { woodTexture } from './neighbourTextures.js';
import { instanceModel, modelBounds } from './assets.js';

export const LANE_HEDGE_HEIGHT = 2.5; // m: a tall hedge on a single-track lane, taller than the farm's
export const GATE_HALF = 2.2; // m either side of a gate's middle that the hedge leaves open: the leaf's length and a post each side
export const STILE_HALF = 1.1; // m either side of the stile that the hedge is open
const CHUNK = 6; // m a hedge collider is at longest

/** How far along the road (m) the point (x, z) is nearest: a walk of the samples, run once for each of a few gates. */
function nearestS(road, x, z) {
  let best = Infinity;
  let at = 0;
  for (const p of road.samples) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < best) [best, at] = [d, p.s];
  }
  return at;
}

/** Where the lane's gates are and which side they are on: [{ id, s, side }], from the road's `gates` (the farm's gateway each stands across from). */
export function laneGates(road) {
  return (road.gates ?? []).map((g) => {
    const s = nearestS(road, g.farm[0], g.farm[1]);
    return { id: g.id, s, side: sideOf(road, s, g.farm[0], g.farm[1]) };
  });
}

/** The hedge's gaps: the gates now, a stile and its footpath when #686's footpath is placed. */
export function laneGaps(road) {
  const gaps = laneGates(road).map((g) => ({ s: g.s, half: GATE_HALF, side: g.side }));
  if (road.footpath) gaps.push({ s: sAlong(road, road.footpath.at[0], road.footpath.at[1]), half: STILE_HALF, side: footpathSide(road) });
  return gaps;
}

function buildGate(road, g, c, group) {
  const { heights, fixedBox, random } = c;
  const off = hedgeOffset(road, g.s, g.side);
  const mid = sidePoint(road, g.s, g.side, off);
  const y = heights.heightAt(mid.x, mid.z);
  const yaw = Math.atan2(mid.tx, mid.tz); // the leaf lies along +z: turn it to lie along the road
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(random, [128, 120, 108]), roughness: 0.95 });
  const post = new THREE.MeshStandardMaterial({ map: woodTexture(random), roughness: 0.9 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x24282a, metalness: 0.6, roughness: 0.5 });
  const along = (d) => ({ x: mid.x + mid.tx * d, z: mid.z + mid.tz * d });
  for (const d of [-GATE_HALF + 0.1, GATE_HALF - 0.1]) {
    const q = along(d);
    const py = heights.heightAt(q.x, q.z);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.9, 0.24), post);
    m.position.set(q.x, py + 0.7, q.z);
    m.rotation.y = yaw;
    group.add(m);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.3), iron);
    cap.position.set(q.x, py + 1.68, q.z);
    cap.rotation.y = yaw;
    group.add(cap);
    fixedBox(q.x, py + 0.7, q.z, 0.12, 0.95, 0.12, yaw);
  }
  // Hung from the hinge post and swung open back along the hedge, as a gate left open for the tractor.
  const hinge = along(-GATE_HALF + 0.25);
  const pivot = new THREE.Group();
  pivot.position.set(hinge.x - mid.tz * g.side * 0.0, heights.heightAt(hinge.x, hinge.z) + 0.02, hinge.z);
  pivot.rotation.y = yaw;
  const leaf = gateLeaf(wood, iron, 2 * GATE_HALF - 0.5);
  const swing = new THREE.Group();
  swing.add(leaf);
  swing.rotation.y = -g.side * 1.35;
  pivot.add(swing);
  group.add(pivot);
}

/** What each kind of sign is made with: a builder, and how high it stands off the verge's ground. */
const SIGN_MAKERS = {
  singleTrack: () => kit.buildSingleTrackSign(),
  nationalLimit: () => kit.buildNationalLimitSign(),
  passingPlace: () => kit.buildPassingPlaceSign(),
  bends: () => kit.buildBendsSign(),
  chevron: () => kit.buildChevronBoard(),
  ford: () => kit.buildFordSign(),
};

/** Puts every sign, the gauge, the fingerpost and the stile where laneSigns.js says, into `group`. */
function buildFurniture(road, c, group) {
  const { heights, fixedBox, random } = c;
  const proto = {};
  const place = (obj, s, side, offset, yaw) => {
    const p = sidePoint(road, s, side, offset);
    obj.position.set(p.x, heights.heightAt(p.x, p.z), p.z);
    obj.rotation.y = yaw;
    group.add(obj);
    return p;
  };
  for (const sg of laneSigns(road)) {
    if (sg.kind === 'fingerpost') continue; // placed with the stile below
    const off = hedgeOffset(road, sg.s, sg.side) - 0.9;
    const t = pointAtTangent(road, sg.s);
    // A sign faces the traffic that reads it: back along the way they come, or across the road for a chevron or the gauge.
    const toward = sg.facing === 0 ? { x: -t.tz * sg.side, z: t.tx * sg.side } : { x: -t.tx * sg.facing, z: -t.tz * sg.facing };
    const yaw = Math.atan2(toward.x, toward.z);
    const make = sg.kind === 'gauge' ? () => kit.buildDepthGauge(random) : SIGN_MAKERS[sg.kind];
    const obj = (proto[sg.kind] ??= make()).clone();
    const p = place(obj, sg.s, sg.side, sg.kind === 'gauge' ? road.halfWidth + 0.9 : off, yaw);
    fixedBox(p.x, heights.heightAt(p.x, p.z) + 1, p.z, 0.07, 1.1, 0.07);
  }
  if (road.footpath) {
    const s = sAlong(road, road.footpath.at[0], road.footpath.at[1]);
    const side = footpathSide(road);
    const t = pointAtTangent(road, s);
    const dir = { x: road.footpath.to[0] - road.footpath.at[0], z: road.footpath.to[1] - road.footpath.at[1] };
    const post = place(kit.buildFingerpost(random), s - 3, side, road.halfWidth + 0.8, Math.atan2(-dir.z, dir.x));
    fixedBox(post.x, heights.heightAt(post.x, post.z) + 1, post.z, 0.1, 1.1, 0.1);
    const stile = place(kit.buildStile(random), s, side, hedgeOffset(road, s, side), Math.atan2(-t.tz, t.tx));
    void stile;
  }
}

function pointAtTangent(road, s) {
  const p = sidePoint(road, s, 1, 0);
  return { tx: p.tx, tz: p.tz };
}

/** Builds the lane's hedges, their colliders and its gates. `c` is the props context (props.js). Null on a farm with no Back Lane. */
export function buildBackLaneProps(c) {
  const { scene, layout, heights, fixedBox, models, random } = c;
  const road = roadNetwork(layout).road('backLane');
  if (!road) return null;
  const group = new THREE.Group();
  group.name = 'backLane';
  const hedgeSize = modelBounds(models.hedge.scene).getSize(new THREE.Vector3());
  const T = layout.hedgeThickness;
  const H = LANE_HEDGE_HEIGHT;
  const matrices = [];
  const farPieces = [];
  for (const run of laneHedgeRuns(road, laneGaps(road))) {
    const at = (s, across = 0) => sidePoint(road, s, run.side, hedgeOffset(road, s, run.side) + across);
    const blocks = [];
    for (let s = run.from; s <= run.to; s += 1.1 + random() * 0.5) {
      const { x, z } = at(s, (random() - 0.5) * 0.6);
      const y = heights.heightAt(x, z) - 0.2;
      const width = T * (0.95 + random() * 0.4);
      const tall = 0.8 + random() * 0.45;
      matrices.push(matrixAt(x, y, z, random() * Math.PI * 2, width / hedgeSize.x, (H / hedgeSize.y) * tall, width / hedgeSize.z));
      blocks.push({ s, x, z, top: y + H * tall * FAR_HEDGE_TOP, width: width * FAR_HEDGE_WIDTH });
    }
    blocks.forEach((b, i) => {
      const from = i ? (blocks[i - 1].s + b.s) / 2 : b.s - FAR_HEDGE_END;
      const to = i < blocks.length - 1 ? (blocks[i + 1].s + b.s) / 2 : b.s + FAR_HEDGE_END;
      const a = at(from);
      const e = at(to);
      const len = Math.hypot(e.x - a.x, e.z - a.z) || 1;
      farPieces.push({
        x: b.x, z: b.z, cx: (a.x + e.x) / 2, cz: (a.z + e.z) / 2, along: [(e.x - a.x) / len, (e.z - a.z) / len], length: len, width: b.width, top: b.top,
        gap: i === 0, kind: 'hedge', groundA: heights.heightAt(a.x, a.z), groundB: heights.heightAt(e.x, e.z),
      });
    });
    // Colliders: straight boxes of at most CHUNK m along the curve, each as high as the ground under it climbs.
    for (let s = run.from; s < run.to; s += CHUNK) {
      const e = Math.min(run.to, s + CHUNK);
      const a = at(s);
      const b = at(e);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 0.5) continue;
      const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      const lo = Math.min(heights.heightAt(a.x, a.z), heights.heightAt(mid.x, mid.z), heights.heightAt(b.x, b.z));
      const hi = Math.max(heights.heightAt(a.x, a.z), heights.heightAt(mid.x, mid.z), heights.heightAt(b.x, b.z));
      fixedBox(mid.x, (lo + hi) / 2 + H / 2 - 0.3, mid.z, len / 2 + 0.2, (hi - lo) / 2 + H / 2, T / 2, Math.atan2(-(b.z - a.z), b.x - a.x));
    }
  }
  const near = instanceModel(models.hedge.scene, matrices, { castShadow: false });
  const far = buildFarHedges(farPieces, { tint: leafTint(models.hedge.scene), name: 'backLaneHedgesFar' });
  scene.add(near, far);
  for (const g of laneGates(road)) buildGate(road, g, c, group);
  buildFurniture(road, c, group);
  scene.add(group);
  return { group, hedgeSwap: new HedgeSwap(near, far), road };
}
