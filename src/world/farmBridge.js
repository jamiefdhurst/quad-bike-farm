// The farm bridge (#689): where the stone track south crosses the head of the river, a small farm bridge over a lowland stream as every livestock farm has one.
// A sleeper deck on two stone abutments with a concrete bearing on each and a pair of steel beams under it, a timber kerb along each side and steel tube
// rails, painted once and rusting, with a plate that says what it will carry; the bank worn bare either end (painted into the ground, `worn` on the road) and mud and straw trodden onto the deck.
// Built along the track (the z axis, the track runs north to south here) over the stream's line, with a collider for the deck and for each rail.

import * as THREE from 'three';
import { stoneTexture, worldBox, canvasTexture } from './outbuildingProps.js';
import { woodTexture } from './neighbourTextures.js';
import { concreteTexture } from './villageTextures.js';
import { enableShadows } from './assets.js';
import { mergeInto } from './villageProps.js';

/** The bridge's real sizes in metres: a farm bridge takes a tractor and a trailer, so about 3.6 m across and 7 m long. */
export const FARM_BRIDGE_SIZE = {
  length: 7, width: 3.6, sleeper: [0.26, 0.16], // a railway sleeper, about 26 cm by 16 cm
  kerb: 0.2, railHeight: 1.05, post: 0.045, rail: 0.03, posts: 1.75, // m between the rails' posts
};

/** Steel tube rails, painted once and rusting: a faded green-grey paint, bare and rusty where it has worn through at the joints and along the tops. */
function paintedSteelTexture(random) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#5f736b';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(${random() < 0.5 ? '210,222,214' : '30,44,38'},${0.05 + random() * 0.1})`;
      ctx.fillRect(random() * w, 0, 1 + random() * 3, h);
    }
    for (let i = 0; i < 60; i++) {
      const x = random() * w;
      const y = random() * h;
      ctx.fillStyle = `rgba(${130 + random() * 40},${64 + random() * 24},28,${0.35 + random() * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 1 + random() * 5, 1 + random() * 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(120,60,26,0.5)';
    ctx.fillRect(0, h - 6, w, 6); // rust gathers at the bottom edge where the wet sits
  });
}

/** Mud and straw trodden onto a deck: dark smears with the odd stalk of straw across them, on a clear ground (cut out by alpha), thickest at the bottom edge, which is the bridge's end. */
function litterTexture(random) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const y = h - Math.pow(random(), 1.8) * h * 0.95;
      ctx.fillStyle = `rgba(${58 + random() * 20},${44 + random() * 14},${28 + random() * 10},${0.75 + random() * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(random() * w, y, 10 + random() * 36, 6 + random() * 14, random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 70; i++) {
      const x = random() * w;
      const y = h - Math.pow(random(), 1.4) * h;
      const a = random() * Math.PI;
      ctx.strokeStyle = `rgba(${196 + random() * 30},${170 + random() * 24},${100 + random() * 30},0.95)`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * (14 + random() * 22), y + Math.sin(a) * (14 + random() * 22));
      ctx.stroke();
    }
  });
}

/** A small enamel plate: white with a black border and the weight limit, bolted to a post. */
function plateTexture() {
  return canvasTexture(256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#e6e3d8';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#202020';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#202020';
    ctx.textAlign = 'center';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('WEAK BRIDGE', w / 2, 60);
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('3 TONNES', w / 2, 112);
    ctx.fillStyle = 'rgba(120,70,30,0.45)'; // rust bleeding from the bolts
    for (const x of [20, w - 20]) ctx.fillRect(x - 2, 20, 4, 60);
  });
}

/**
 * Builds the bridge at `layout.farmBridge` on the new farm and its colliders. `c` is the props context (props.js). It stands over the stream's line at
 * the bridge's x, with the deck level with the higher bank, so the track rides over it.
 */
export function buildFarmBridge(c) {
  const { scene, heights, fixedBox, random, layout } = c;
  const spec = layout.farmBridge;
  if (!spec) return null;
  const S = FARM_BRIDGE_SIZE;
  const brook = heights.brook;
  const x0 = spec.x;
  const z0 = brook ? brook.zAt(x0) : spec.z;
  const half = S.length / 2;
  const wide = S.width / 2;
  const bank = Math.max(heights.heightAt(x0, z0 - half - 1), heights.heightAt(x0, z0 + half + 1));
  const deck = bank + 0.06; // the top of the deck, a hand's width over the ground at either end
  const bed = heights.heightAt(x0, z0) - 0.1;
  const group = new THREE.Group();
  group.name = 'farmBridge';
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(random), roughness: 0.95 });
  const concrete = new THREE.MeshStandardMaterial({ map: concreteTexture(random), roughness: 0.9 });
  const timber = new THREE.MeshStandardMaterial({ map: woodTexture(random, [92, 74, 54]), roughness: 0.92 });
  const steel = new THREE.MeshStandardMaterial({ map: paintedSteelTexture(random), roughness: 0.7, metalness: 0.3 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x4a4540, roughness: 0.8, metalness: 0.4 });
    const plate = new THREE.MeshStandardMaterial({ map: plateTexture(), roughness: 0.5 });
  const litterMat = new THREE.MeshStandardMaterial({ map: litterTexture(random), roughness: 1, alphaTest: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
  const put = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };

  // The abutments: a stone wall at each end, sunk below the bed, with a concrete bearing along the top for the beams to sit on and a wing wall each side
  // holding the bank back.
  const wall = 0.9;
  for (const e of [-1, 1]) {
    const z = z0 + e * (half - wall / 2 + 0.1);
    const top = deck - 0.22;
    const h = top - (bed - 0.5);
    put(worldBox(S.width + 0.5, h, wall, 2), stone, x0, bed - 0.5 + h / 2, z);
    put(worldBox(S.width + 0.2, 0.14, wall + 0.12, 1), concrete, x0, top + 0.07, z);
    for (const s of [-1, 1]) {
      const hw = Math.max(0.5, bank + 0.3 - (bed - 0.5));
      put(worldBox(0.5, hw, 1.8, 2), stone, x0 + s * (wide + 0.5), bed - 0.5 + hw / 2, z + e * 0.9);
      put(worldBox(0.62, 0.08, 1.92, 1), concrete, x0 + s * (wide + 0.5), bank + 0.34, z + e * 0.9);
    }
  }
  // Two steel beams under the deck: a web with a flange each side, resting on the bearings.
  for (const s of [-1, 1]) {
    const x = x0 + s * (wide - 0.9);
    const y = deck - 0.16 - 0.1;
    put(new THREE.BoxGeometry(0.01, 0.2, S.length + 0.3), steel, x, y, z0);
    for (const f of [-1, 1]) put(new THREE.BoxGeometry(0.14, 0.014, S.length + 0.26), steel, x, y + f * 0.1, z0); // a little shorter than the web, so their ends are not one plane
  }
  // The deck: sleepers laid across the beams side by side, none quite level with the next, a coach screw in each end.
  const [sw, sh] = S.sleeper;
  const n = Math.floor(S.length / sw);
  for (let i = 0; i < n; i++) {
    const z = z0 - half + sw / 2 + i * sw + (S.length - n * sw) / 2;
    const rise = (random() - 0.5) * 0.012;
    put(worldBox(S.width - 0.06, sh, sw - 0.012, 1), timber, x0, deck - sh / 2 + rise, z); // a little short of the kerb's outer face, which stands over its ends
    for (const s of [-1, 1]) put(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 6), iron, x0 + s * (wide - 0.12), deck + rise + 0.003, z);
  }
  // A timber kerb along each edge, bolted down, and the steel tube rails above it.
  const k = S.kerb;
  const rails = [];
  for (const s of [-1, 1]) {
    const x = x0 + s * (wide - k / 2);
    put(worldBox(k, k + 0.03, S.length + 0.2, 1), timber, x, deck + k / 2 - 0.015, z0); // sunk a finger into the sleepers it holds down
    const px = x0 + s * (wide - k - S.post - 0.01);
    const count = Math.round(S.length / S.posts);
    const posts = Array.from({ length: count + 1 }, (_, i) => z0 - half + 0.2 + (i * (S.length - 0.4)) / count);
    for (const z of posts) {
      put(new THREE.CylinderGeometry(S.post, S.post, S.railHeight, 8), steel, px, deck + S.railHeight / 2, z);
      put(new THREE.BoxGeometry(0.16, 0.012, 0.16), steel, px, deck + 0.006, z); // the base plate
      for (const dz of [-1, 1]) for (const dx of [-1, 1]) put(new THREE.CylinderGeometry(0.01, 0.01, 0.012, 6), iron, px + dx * 0.055, deck + 0.014, z + dz * 0.055);
      put(new THREE.SphereGeometry(S.post * 1.05, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), steel, px, deck + S.railHeight, z); // the cap
    }
    for (const rh of [S.railHeight - 0.05, S.railHeight * 0.55, 0.22]) {
      const rail = put(new THREE.CylinderGeometry(S.rail, S.rail, S.length - 0.2, 8), steel, px, deck + rh, z0);
      rail.rotation.x = Math.PI / 2;
    }
    rails.push({ x: px, hx: S.post * 1.5 });
    if (s === 1) {
      const pl = put(new THREE.PlaneGeometry(0.45, 0.28), plate, px - 0.09, deck + 0.82, posts[1]);
      pl.rotation.y = -Math.PI / 2;
      put(new THREE.BoxGeometry(0.02, 0.3, 0.47), iron, px - 0.058, deck + 0.82, posts[1]); // the plate's frame, a lip behind
    }
  }
  // What a farm bridge carries on it: mud trodden on from both ends and straw dropped from the trailers, one cut-out sheet laid over the sleepers at each end.
  for (const e of [-1, 1]) {
    const litter = put(new THREE.PlaneGeometry(S.width - 0.7, 2.6), litterMat, x0, deck + 0.012, z0 + e * (half - 1.5));
    litter.rotation.x = -Math.PI / 2;
    litter.rotation.z = e > 0 ? 0 : Math.PI;
  }
  // Solid: the deck for a wheel to ride on, a rail down each side so nothing goes off it.
  fixedBox(x0, deck - 0.1, z0, wide, 0.1, half);
  for (const r of rails) fixedBox(r.x, deck + S.railHeight / 2, z0, r.hx, S.railHeight / 2, half);
  scene.add(group);
  mergeInto(group); // a mesh a material, not hundreds
  enableShadows(group);
  return group;
}
