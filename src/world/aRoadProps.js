// The A-road drawn beyond its tarmac, and the junctions where the lane and the village street give way to it (#687, layout 2 only): hedges down both sides with
// a collider along them (the neighbour's own hedge stands along the west side where her land is), hedgerow trees, the verge's plants, cat's eyes down the middle,
// and at each junction a give-way sign, a fingerpost, a grit bin or heap and the national speed limit disc across the road, plus the bus bay with its bus stop flag.
// Where each stands is aRoadFittings.js; the road itself is drawn by props.js with the one road mesh builder.

import * as THREE from 'three';
import { roadNetwork } from './roads.js';
import { laneHedgeRuns, laneTrees, sidePoint, hedgeOffset } from './laneHedges.js';
import { sAlong } from './laneSigns.js';
import { layHedges } from './backLaneProps.js';
import { buildVerge } from './laneVerge.js';
import { HedgeSwap } from './hedgeFar.js';
import { matrixAt } from './hillProps.js';
import { instanceModel } from './assets.js';
import { tiledInstances } from './tiledInstances.js';
import { junctionSites, junctionFittings, junctionBreaks, catsEyes, layByOf } from './aRoadFittings.js';
import * as signs from './roadSigns.js';
import * as furniture from './roadFurniture.js';

export const A_ROAD_HEDGE_HEIGHT = 2.0; // m: a trimmed roadside hedge, lower than a single-track lane's
const SIGN_FOOT = 0.04; // m: a post stands this far into the ground, so nothing shows a gap on a slope

/** The A-road's hedge gaps: both sides open at each junction's mouth, the west side open along her land (she has her own hedge there), the bus bay's east side. */
export function aRoadGaps(net, a, layout) {
  const gaps = junctionBreaks(net, a).map((b) => ({ s: b.s, half: b.half + 3 }));
  const land = layout.neighbourLand;
  if (land) {
    const zs = land.fields.map((f) => [f.minZ, f.maxZ]).flat();
    const s0 = sAlong(a, a.samples[0].x, Math.min(...zs) - 1);
    const s1 = sAlong(a, a.samples[0].x, Math.max(...zs) + 1);
    gaps.push({ s: (s0 + s1) / 2, half: (s1 - s0) / 2 + 2, side: -1 });
  }
  const by = layByOf(a, layout.aRoadFittings?.layBy);
  if (by) gaps.push({ s: by.s, half: by.length / 2 + 3, side: by.side });
  return gaps;
}

/** Builds the A-road's hedges, trees and verge, and its junctions' and bus bay's furniture. `c` is the props context (props.js). Null on a farm without an A-road. */
export function buildARoadProps(c) {
  const { scene, layout, heights, fixedBox, models, random, physics, RAPIER, anchors } = c;
  const net = roadNetwork(layout);
  const a = net.road('aRoad');
  if (!a) return null;
  const group = new THREE.Group();
  group.name = 'junctions';
  const gaps = aRoadGaps(net, a, layout);
  const { near, far } = layHedges(c, a, laneHedgeRuns(a, gaps), 'aRoadHedgesFar', A_ROAD_HEDGE_HEIGHT);

  // Hedgerow trees, oaks and ash alternately, in the hedge line with a trunk collider each (the winch can hook them).
  const mats = [[], []];
  for (const t of laneTrees(a, random, gaps)) {
    const p = sidePoint(a, t.s, t.side, hedgeOffset(a, t.s, t.side));
    const y = heights.heightAt(p.x, p.z);
    mats[random() < 0.5 ? 0 : 1].push(matrixAt(p.x, y - 0.15, p.z, random() * Math.PI * 2, t.scale));
    physics.createCollider(RAPIER.ColliderDesc.cylinder(2.5 * t.scale, 0.32 * t.scale).setTranslation(p.x, y + 2.5 * t.scale, p.z));
    anchors?.push({ x: p.x, y, z: p.z, r: 0.32 * t.scale });
  }
  scene.add(instanceModel(models.treeA.scene, mats[0]), instanceModel(models.treeB.scene, mats[1]));
  buildVerge(c, a, (s, side) => gaps.some((g) => Math.abs(s - g.s) < g.half + 1 && (g.side === undefined || g.side === side)));

  // Cat's eyes: a twin-lens stud in the middle of the road every `eyes` m, flush with the tarmac, in tiles so the far ones are culled.
  const body = new THREE.BoxGeometry(0.16, 0.025, 0.2);
  const lens = new THREE.MeshStandardMaterial({ color: 0xf2f2e8, roughness: 0.25, metalness: 0.5 });
  const lift = (a.lift ?? 0.07) + 0.02 + (a.camber ?? 0);
  const eyes = catsEyes(a, a.eyes ?? 18, junctionBreaks(net, a)).map((e) => matrixAt(e.x, heights.heightAt(e.x, e.z) + lift, e.z, e.yaw, 1));
  const stud = tiledInstances(body, lens, eyes, { name: 'catsEyes', receiveShadow: false });
  scene.add(stud);

  // The junctions' furniture.
  const proto = {
    giveWay: () => signs.buildGiveWaySign(),
    nationalLimit: () => signs.buildNationalLimitSign(),
    gritBin: () => furniture.buildGritBin(),
    gritHeap: () => furniture.buildGritHeap(),
  };
  for (const f of junctionFittings(junctionSites(net, layout.junctions ?? []))) {
    const obj = f.kind === 'fingerpost'
      ? signs.buildFingerpostArms(random, [{ lines: f.lines, yaw: 0 }])
      : proto[f.kind]();
    obj.position.set(f.x, heights.heightAt(f.x, f.z) - SIGN_FOOT, f.z);
    obj.rotation.y = f.yaw;
    group.add(obj);
    const high = f.kind === 'gritBin' ? 0.35 : f.kind === 'gritHeap' ? 0 : 1.1;
    if (high > 0) fixedBox(f.x, heights.heightAt(f.x, f.z) + high, f.z, f.kind === 'gritBin' ? 0.5 : 0.07, high, f.kind === 'gritBin' ? 0.32 : 0.07, f.kind === 'gritBin' ? f.yaw : 0);
  }
  // The bus bay's bus stop flag, at its south end.
  const by = layByOf(a, layout.aRoadFittings?.layBy);
  if (by) {
    const flag = furniture.buildBusStopFlag();
    flag.position.set(by.flag.x, heights.heightAt(by.flag.x, by.flag.z) - SIGN_FOOT, by.flag.z);
    flag.rotation.y = by.flag.yaw;
    group.add(flag);
    fixedBox(by.flag.x, heights.heightAt(by.flag.x, by.flag.z) + 1.5, by.flag.z, 0.1, 1.5, 0.1);
  }
  scene.add(group);
  return { group, hedgeSwap: new HedgeSwap(near, far), road: a };
}
