// The neighbour's land across the lane drawn (world/neighbourLand.js has its shape): her hedges, in the scene like the farm's own, as leafy blocks within
// `hedgeFullDistance` and plain far strips beyond (hedgeFar.js, swapped by distance like props.js's) with a collider a stretch, her north field gate in
// the lane's hedge, and her dairy cows in the two north fields (cattleModel.js). Far-ground detail: the grass and the dark hedge lines are in the
// ground (patchwork.js). The gate and the herd are the set piece named in farDetail.js, drawn out to `setPieceDistance` from its nearest edge.

import * as THREE from 'three';
import { neighbourLandShape } from './neighbourLand.js';
import { buildFarHedges, HedgeSwap, leafTint, FAR_HEDGE_TOP, FAR_HEDGE_WIDTH, FAR_HEDGE_END } from './hedgeFar.js';
import { matrixAt } from './hillProps.js';
import { buildHerd } from './cattleModel.js';
import { gateLeaf } from './neighbourFarmProps.js';
import { woodTexture } from './neighbourTextures.js';
import { enableShadows, instanceModel, modelBounds } from './assets.js';
import { Gate } from './gates.js';

/** The height range of the ground along a stretch, sampled every few metres: [lowest, highest]. */
function groundRange(s, groundAt) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let t = s.from; t <= s.to + 0.01; t += Math.max(1, Math.min(4, (s.to - s.from) / 8))) {
    const h = s.axis === 'x' ? groundAt(s.at, t) : groundAt(t, s.at);
    lo = Math.min(lo, h);
    hi = Math.max(hi, h);
  }
  return [lo, hi];
}

/**
 * Her north field gate in the lane's hedge (`land.gate`): a timber post each side and one five-bar leaf hung from the south post that swings in to the
 * field, shut and chained at the start. Opens like the others (E). Returns the `Gate`.
 */
function buildNorthFieldGate({ land, group, heights, fixedBox, gateParams, random }) {
  const g = land.gate;
  const y = heights.heightAt(g.x, g.z);
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(random, [128, 120, 108]), roughness: 0.95 });
  const post = new THREE.MeshStandardMaterial({ map: woodTexture(random), roughness: 0.9 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x24282a, metalness: 0.6, roughness: 0.5 });
  const half = g.width / 2;
  const hinge = g.z - half + 0.15;
  const latch = g.z + half - 0.15;
  for (const z of [g.z - half, g.z + half]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.9, 0.24), post);
    m.position.set(g.x, y + 0.7, z);
    group.add(m);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.3), iron); // a metal cap, so the post's end is not bare
    cap.position.set(g.x, y + 1.68, z);
    group.add(cap);
    fixedBox(g.x, y + 0.7, z, 0.12, 0.95, 0.12);
  }
  const pivot = new THREE.Group();
  pivot.position.set(g.x, y + 0.02, hinge);
  pivot.add(gateLeaf(wood, iron, latch - hinge - 0.04));
  group.add(pivot);
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12), iron); // round the closing stile and the latch post
  chain.position.set(g.x, y + 0.98, latch - 0.1);
  chain.rotation.y = Math.PI / 2;
  group.add(chain);
  return new Gate({
    id: 'northField',
    params: gateParams,
    x: g.x,
    z: g.z,
    open: false,
    pose: (a) => {
      pivot.rotation.y = a * (Math.PI / 2 - 0.08); // in to her field (east)
      chain.visible = a < 0.05;
    },
    solid: fixedBox(g.x, y + 0.9, g.z, 0.1, 0.9, half - 0.1),
  });
}

/** Builds her land: the far hedge strips and their colliders, the north field gate and the herd. `c` is the props context (props.js). Null on a farm without her land. */
export function buildNeighbourLand(c) {
  const { scene, layout, heights, fixedBox, models, random } = c;
  const land = neighbourLandShape(layout);
  if (!land) return null;
  const groundAt = (x, z) => heights.heightAt(x, z);
  const group = new THREE.Group();
  group.name = 'neighbourLand';

  // Leafy blocks along each stretch, overlapping and turned as props.js lays the farm's hedges, and a far strip for each from the same numbers.
  const hedgeSize = modelBounds(models.hedge.scene).getSize(new THREE.Vector3());
  const T = layout.hedgeThickness;
  const H = land.hedge.height;
  const matrices = [];
  const farPieces = [];
  for (const s of land.stretches) {
    const [dx, dz] = s.axis === 'x' ? [0, 1] : [1, 0];
    const pointAt = (t, across = 0) => (s.axis === 'x' ? { x: s.at + across, z: s.from + t } : { x: s.from + t, z: s.at + across });
    const length = s.to - s.from;
    const blocks = [];
    for (let t = -0.5; t <= length + 0.5; t += 1.1 + random() * 0.5) {
      const { x, z } = pointAt(t, (random() - 0.5) * 0.6);
      const y = groundAt(x, z) - 0.2;
      const width = T * (0.95 + random() * 0.4);
      const tall = 0.8 + random() * 0.45;
      matrices.push(matrixAt(x, y, z, random() * Math.PI * 2, width / hedgeSize.x, (H / hedgeSize.y) * tall, width / hedgeSize.z));
      blocks.push({ t, x, z, top: y + H * tall * FAR_HEDGE_TOP, width: width * FAR_HEDGE_WIDTH });
    }
    blocks.forEach((b, i) => {
      const from = i ? (blocks[i - 1].t + b.t) / 2 : b.t - FAR_HEDGE_END;
      const to = i < blocks.length - 1 ? (blocks[i + 1].t + b.t) / 2 : b.t + FAR_HEDGE_END;
      const mid = pointAt((from + to) / 2);
      const a = pointAt(from);
      const e = pointAt(to);
      farPieces.push({
        x: b.x, z: b.z, cx: mid.x, cz: mid.z, along: [dx, dz], length: to - from, width: b.width, top: b.top, gap: i === 0, kind: 'hedge',
        groundA: groundAt(a.x, a.z), groundB: groundAt(e.x, e.z),
      });
    });
    const [lo, hi] = groundRange(s, groundAt);
    fixedBox(s.x, (lo + hi) / 2 + 1.1, s.z, s.hx, (hi - lo) / 2 + 1.1, s.hz);
  }
  const near = instanceModel(models.hedge.scene, matrices, { castShadow: false }); // no shadows: hundreds of instances, as the farm's own hedges
  const far = buildFarHedges(farPieces, { tint: leafTint(models.hedge.scene), name: 'neighbourHedgesFar' });
  scene.add(near, far); // straight into the scene as the farm's own are: a set piece is hidden beyond `setPieceDistance`, which would take her far strips with it
  const hedgeSwap = new HedgeSwap(near, far);

  const gate = buildNorthFieldGate({ ...c, land, group, fixedBox, gateParams: c.gateParams });
  group.add(buildHerd(land.cows, groundAt, 'neighbourHerd'));
  enableShadows(group); // the gate and the herd only: the hedges are in the scene, not here, and cast none
  scene.add(group);
  return { group, gate, land, hedgeSwap };
}
