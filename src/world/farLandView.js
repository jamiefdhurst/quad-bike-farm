// The far landscape's meshes (#708, farLand.js): the ring of ground with its painted texture, the road and the river running on, and the far farms.
// Three draw calls for the ground and its roads and river, one for the farms and the trees along the river.

import * as THREE from 'three';
import { FAR_PARAMS, farRects, outsideBy, createFarHeight, farRingData, farFieldPlan, farClusters, smoothPath, densify, ribbon, bankTrees, FAR_ROADS, FAR_RIVER, ROAD_GREY, WATER } from './farLand.js';
import { buildFarVersion } from './farVersion.js';

const css = ([r, g, b]) => `rgb(${Math.round(255 * r ** (1 / 2.2))},${Math.round(255 * g ** (1 / 2.2))},${Math.round(255 * b ** (1 / 2.2))})`;

/** Paints the plan (farFieldPlan) onto a canvas covering `outer`: fields, the hedges between them and the trees along them. */
export function paintFarGround(canvas, plan, outer, fill) {
  const ctx = canvas.getContext('2d');
  const sx = canvas.width / (outer.maxX - outer.minX);
  const sz = canvas.height / (outer.maxZ - outer.minZ);
  const px = (x) => (x - outer.minX) * sx;
  const pz = (z) => (z - outer.minZ) * sz;
  ctx.fillStyle = css(fill);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const f of plan.fields) {
    ctx.fillStyle = css(f.color);
    ctx.beginPath();
    f.corners.forEach(([x, z], k) => (k ? ctx.lineTo(px(x), pz(z)) : ctx.moveTo(px(x), pz(z))));
    ctx.closePath();
    ctx.fill();
    // A field is not one tone: a lighter and a darker patch in it.
    const [x0, z0] = f.corners[0];
    const [x2, z2] = f.corners[2];
    ctx.fillStyle = `rgba(255,255,230,${f.wood ? 0.04 : 0.07})`;
    ctx.fillRect(px(x0 + (x2 - x0) * 0.15), pz(z0 + (z2 - z0) * 0.2), (x2 - x0) * 0.4 * sx, (z2 - z0) * 0.35 * sz);
    ctx.fillStyle = 'rgba(20,30,10,0.07)';
    ctx.fillRect(px(x0 + (x2 - x0) * 0.5), pz(z0 + (z2 - z0) * 0.5), (x2 - x0) * 0.4 * sx, (z2 - z0) * 0.4 * sz);
  }
  // Hedge lines wider than they are, so they still read from a long way off (the mipmaps soften them with distance).
  ctx.lineCap = 'round';
  for (const wall of [false, true]) {
    ctx.strokeStyle = wall ? 'rgba(170,166,150,0.55)' : 'rgba(26,38,18,0.85)';
    ctx.lineWidth = Math.max(1.4, (wall ? 3 : 6) * sx);
    ctx.beginPath();
    for (const h of plan.hedges) {
      if (h.wall !== wall) continue;
      ctx.moveTo(px(h.a[0]), pz(h.a[1]));
      ctx.lineTo(px(h.b[0]), pz(h.b[1]));
    }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(30,50,24,0.85)';
  ctx.beginPath();
  for (const [x, z, r] of plan.trees) {
    ctx.moveTo(px(x) + r * sx, pz(z));
    ctx.arc(px(x), pz(z), Math.max(1, r * sx), 0, 6.283);
  }
  ctx.fill();
}

const NEAR = 900; // m from the skirt the finer-painted part of the ring reaches
const solid = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...extra });

const geometryOf = ({ positions, index }, uvs = null) => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (uvs) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
};

/**
 * The far landscape for the new farm, a group to add to the scene: the ring of ground out to `reach` m from the skirt's edge (terrain.js's outer
 * ring, `layout.outerMargin` m beyond the ground), its roads and river, and its farms. `heights.heightAt` is the ground's own, which the ring meets.
 */
export function createFarLand({ layout, bounds, heights, renderer }) {
  const { inner, outer } = farRects(bounds, layout.outerMargin);
  const heightAt = createFarHeight({ landform: layout.landform, groundAt: heights.heightAt, inner });
  const group = new THREE.Group();
  group.name = 'farLand';

  // The ground in two meshes that meet along a shared edge, each with a painted texture of its own: the near one (out to `NEAR` m from the skirt) at about
  // 2.4 m a texel, the far one over the whole at about 4.5, so what is near is not made of blocks.
  const plan = farFieldPlan({ outer, inner, heightAt, land: layout.neighbourLand });
  const reach = NEAR + FAR_PARAMS.maxStep;
  const nearRect = { minX: inner.minX - reach, maxX: inner.maxX + reach, minZ: inner.minZ - reach, maxZ: inner.maxZ + reach };
  const part = (name, rect, select) => {
    const data = farRingData({ inner, outer, heightAt, uvRect: rect, select });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = FAR_PARAMS.texture;
    paintFarGround(canvas, plan, rect, [0.37, 0.49, 0.23]);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;
    const mesh = new THREE.Mesh(geometryOf(data, data.uvs), new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }));
    mesh.name = name;
    mesh.userData.size = canvas.width;
    group.add(mesh);
  };
  part('farGroundNear', nearRect, (x, z) => outsideBy(inner, x, z) < NEAR);
  part('farGroundFar', outer, (x, z) => outsideBy(inner, x, z) >= NEAR);

  // The road on south and the A-road either way, and the river with its trees, laid just over the ground.
  // 40 m between points, and 8 m where the skirt's own 4 m cells are, so a ribbon does not dip into a bump in them.
  const path = (points) => densify(smoothPath(points, 40), 8, (x, z) => outsideBy(inner, x, z) < 60);
  const flat = (path, half, color, lift, offset) => {
    const m = new THREE.Mesh(geometryOf(ribbon(path, half, heightAt, lift)), solid(color, { polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset }));
    m.receiveShadow = false;
    return m;
  };
  for (const r of FAR_ROADS) {
    const m = flat(path(r.points), r.halfWidth, new THREE.Color(...ROAD_GREY), 0.4, -2);
    m.name = `far-${r.id}`;
    group.add(m);
  }
  const riverPath = path(FAR_RIVER.points);
  const river = flat(riverPath, FAR_RIVER.halfWidth, new THREE.Color(...WATER), 0.35, -3);
  river.name = 'far-river';
  group.add(river);

  // Farms, the trees along the river, as far-only shapes in one mesh (farVersion.js).
  const roadPaths = FAR_ROADS.map((r) => path(r.points));
  const nearPath = (x, z, r) => [...roadPaths, riverPath].some((p) => p.some(([px, pz]) => Math.hypot(px - x, pz - z) < r));
  const farms = farClusters({ inner, outer, heightAt, keepClear: (x, z) => nearPath(x, z, 140) });
  const trees = bankTrees(riverPath).map(([x, z, half, height]) => ({ x, z, hx: half, hz: half, y: heightAt(x, z), height, color: 0x3b5a36 }));
  const shapes = { buildings: farms.shapes.buildings, walls: [...farms.shapes.walls, ...trees] };
  const built = buildFarVersion('farFarms', shapes);
  built.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = false;
  });
  group.add(built);
  group.userData.farms = farms.sites;
  group.userData.heightAt = heightAt;
  group.userData.rects = { inner, outer };
  return group;
}
