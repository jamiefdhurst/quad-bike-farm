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
  const dark = new THREE.MeshStandardMaterial({ color: 0x4d3a26, roughness: 1 });
  for (let i = 1; i < 7; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, r.width + 0.01), dark);
    const t = (i / 7) * slope;
    slat.position.set(Math.cos(pitch) * t, Math.sin(pitch) * t + 0.025, 0);
    slat.rotation.z = pitch;
    group.add(slat);
  }
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, r.width + 0.02), new THREE.MeshStandardMaterial({ color: 0xb98c52, roughness: 0.8 }));
  lip.position.set(r.length - 0.05, r.height - 0.03, 0);
  lip.rotation.z = pitch;
  group.add(lip);
  enableShadows(group);
  // The group's x is along the ramp: turn it so that is the way the ramp points.
  group.rotation.y = r.yaw - Math.PI / 2;
  group.position.set(r.x, y0, r.z);
  scene.add(group);
  return { group, collider, y0 };
}
