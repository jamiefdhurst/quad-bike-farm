import * as THREE from 'three';
import { enableShadows } from './assets.js';

/**
 * The jump in the field (layout.jumpRamp): a plank wedge rising to a square lip, with a convex-hull collider of the same shape so the
 * wheels ride up it. Its foot sits at the ground height there, and the slope's top is a little above whatever the ground does beside it.
 */
export function buildJumpRamp({ scene, physics, RAPIER, layout, heights }) {
  const r = layout.jumpRamp;
  const y0 = heights.heightAt(r.x, r.z);
  const buried = 0.6; // how far the wedge goes below the foot, so no gap shows under it on a slope
  const sin = Math.sin(r.yaw);
  const cos = Math.cos(r.yaw);
  // Local frame: x across (right of the way it points), z along it, y up from the foot.
  const world = (lx, ly, lz) => new THREE.Vector3(r.x + lx * cos + lz * sin, y0 + ly, r.z - lx * sin + lz * cos);
  const hw = r.width / 2;

  const corners = [
    [-hw, 0.02, 0], [hw, 0.02, 0], [-hw, r.height, r.length], [hw, r.height, r.length],
    [-hw, -buried, 0], [hw, -buried, 0], [-hw, -buried, r.length], [hw, -buried, r.length],
  ].map(([x, y, z]) => world(x, y, z));
  const points = new Float32Array(corners.flatMap((v) => [v.x, v.y, v.z]));
  const desc = RAPIER.ColliderDesc.convexHull(points);
  const collider = desc ? physics.createCollider(desc.setFriction(1)) : null;

  // The shape to look at: side profile extruded across the width.
  const profile = new THREE.Shape();
  profile.moveTo(0, -buried);
  profile.lineTo(r.length, -buried);
  profile.lineTo(r.length, r.height);
  profile.lineTo(0, 0.02);
  const geo = new THREE.ExtrudeGeometry(profile, { depth: r.width, bevelEnabled: false });
  geo.translate(0, 0, -hw); // profile x is along the ramp, y up, extrusion across it
  const wood = new THREE.MeshStandardMaterial({ color: 0x8c6b45, roughness: 0.9 });
  const group = new THREE.Group();
  const body = new THREE.Mesh(geo, wood);
  group.add(body);
  // Plank joins across the slope, and a strip of lighter wood along the lip.
  const slope = Math.hypot(r.length, r.height);
  const pitch = Math.atan2(r.height, r.length);
  // Decking: boards laid across the slope (each its own colour, with a gap showing the dark body between them), a side cheek board
  // down each edge, and a steel angle on the lip with bolt heads.
  const boardMats = [0x8c6b45, 0x7f6140, 0x987549, 0x86673f].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a2b1b, roughness: 1 });
  body.material = dark;
  const boards = 8;
  const boardLen = (slope - 0.2) / boards;
  const nx = -Math.sin(pitch); // the slope's normal in the profile plane
  const ny = Math.cos(pitch);
  for (let i = 0; i < boards; i++) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(boardLen - 0.015, 0.045, r.width - 0.12), boardMats[i % boardMats.length]);
    const t = 0.02 + (i + 0.5) * boardLen;
    const lift = 0.02;
    board.position.set(Math.cos(pitch) * t + nx * lift, Math.sin(pitch) * t + ny * lift + 0.02, 0);
    board.rotation.z = pitch;
    group.add(board);
  }
  const cheekMat = new THREE.MeshStandardMaterial({ color: 0x6e5438, roughness: 0.9 });
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(slope, 0.1, 0.06), cheekMat);
    cheek.position.set(Math.cos(pitch) * slope / 2 + nx * 0.03, Math.sin(pitch) * slope / 2 + ny * 0.03 + 0.03, side * (hw - 0.03));
    cheek.rotation.z = pitch;
    group.add(cheek);
  }
  const steel = new THREE.MeshStandardMaterial({ color: 0x5b5f62, roughness: 0.5, metalness: 0.7 });
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, r.width + 0.02), steel);
  lip.position.set(r.length - 0.04, r.height - 0.01, 0);
  lip.rotation.z = pitch;
  group.add(lip);
  const bolts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.015, 0.015, 0.012, 6), steel, 6);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 6; i++) {
    m4.compose(new THREE.Vector3(r.length - 0.04, r.height + 0.02, -hw + 0.25 + (i / 5) * (r.width - 0.5)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, pitch)), new THREE.Vector3(1, 1, 1));
    bolts.setMatrixAt(i, m4);
  }
  group.add(bolts);
  enableShadows(group);
  // The group's x is along the ramp: turn it so that is the way the ramp points.
  group.rotation.y = r.yaw - Math.PI / 2;
  group.position.set(r.x, y0, r.z);
  scene.add(group);
  return { group, collider, y0 };
}
