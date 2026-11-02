import * as THREE from 'three';
import { eyeOf, isEye, lidAt, LID } from './eyelidShape.js';
import { PALETTE, bodyMesh } from './outfit.js';

// A girl's eyelids (docs/decisions/girls.md, "Blinking (#486)"). The model has no eye bones and no morph targets, and her eyes are
// painted from the palette's dark, so the lids are pieces we build: a skin-coloured curtain on each eye, hung from its top edge and lying
// on her face, parented to the Head bone and shaped by eyelidShape.js. `setLid(s)` lowers them: 0 open, 1 shut, past 1 squeezed.

const _v = new THREE.Vector3();
const dark = new THREE.Color().setRGB(PALETTE.dark[0] / 255, PALETTE.dark[1] / 255, PALETTE.dark[2] / 255, THREE.SRGBColorSpace);
const skin = new THREE.Color().setRGB(PALETTE.skin[0] / 255, PALETTE.skin[1] / 255, PALETTE.skin[2] / 255, THREE.SRGBColorSpace).multiplyScalar(0.94); // a shade under her face's, which the light catches less

/**
 * The shapes painted dark on her face (two eyes, two brows), each as { points: the [x, y, z] of its vertices in her Head bone's space,
 * verts: its vertex indices on her body }, found by what the texture paints there.
 */
export function paintedShapes(rig) {
  const body = bodyMesh(rig);
  const map = body?.material.userData.baseMap ?? body?.material.map;
  const img = map?.image;
  const head = rig.bones.Head;
  if (!img || !head) return [];
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const uv = body.geometry.attributes.uv;
  const isDark = (i) => {
    const x = Math.min(canvas.width - 1, Math.floor(uv.getX(i) * canvas.width));
    const y = Math.min(canvas.height - 1, Math.floor((map.flipY ? 1 - uv.getY(i) : uv.getY(i)) * canvas.height));
    const k = (y * canvas.width + x) * 4;
    return PALETTE.dark.every((c, j) => Math.abs(px[k + j] - c) < 3);
  };
  const { skinIndex, skinWeight } = body.geometry.attributes;
  const onHead = (i) => {
    let best = 0;
    for (let k = 1; k < 4; k++) if (skinWeight.getComponent(i, k) > skinWeight.getComponent(i, best)) best = k;
    return body.skeleton.bones[skinIndex.getComponent(i, best)] === head;
  };
  rig.root.updateMatrixWorld(true);
  body.skeleton.update();
  const inverse = head.matrixWorld.clone().invert();
  const at = (i) => body.localToWorld(body.getVertexPosition(i, _v.set(0, 0, 0))).applyMatrix4(inverse).toArray();
  // The dark triangles of her face, joined where they share a corner into the shapes they paint (two eyes, two brows).
  const index = body.geometry.index;
  const shapes = [];
  const owner = new Map();
  for (let t = 0; t < index.count; t += 3) {
    const tri = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
    if (!tri.every((i) => onHead(i) && isDark(i))) continue;
    const points = tri.map(at);
    const keys = points.map((p) => p.map((n) => Math.round(n * 1000)).join(','));
    const found = [...new Set(keys.map((k) => owner.get(k)).filter(Boolean))];
    const shape = found[0] ?? { points: [], verts: [] };
    if (!found.length) shapes.push(shape);
    for (const other of found.slice(1)) {
      shape.points.push(...other.points);
      shape.verts.push(...other.verts);
      shapes.splice(shapes.indexOf(other), 1);
      for (const [k, o] of owner) if (o === other) owner.set(k, shape);
    }
    shape.points.push(...points);
    shape.verts.push(...tri);
    for (const k of keys) owner.set(k, shape);
  }
  return shapes;
}

/** The painted eyes on her face, each as the [x, y, z] of its vertices in her Head bone's space. */
export function paintedEyes(rig) {
  return paintedShapes(rig).map((s) => s.points).filter(isEye);
}

/** Builds her lids and puts them on her Head bone. Returns { setLid(s), lid, parts } or null if her eyes weren't found. */
export function addEyelids(rig) {
  let eyes = [];
  rig.withRestPose(() => {
    eyes = paintedEyes(rig).map(eyeOf);
  });
  if (!eyes.length || eyes.some((e) => !e)) return null;
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
  const parts = eyes.map((eye) => {
    const first = lidAt(eye, 0);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(first.positions.flat(), 3));
    const colors = [];
    for (const l of first.lash) {
      const c = skin.clone().lerp(dark, l);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(first.index);
    // Lit as the face is round her eye: every vertex faces as the face does there, so the lid shades as the skin beside it, not as its own little dome.
    const n = new THREE.Vector3(-eye.plane.b, -eye.plane.c, 1).normalize();
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(first.positions.flatMap(() => n.toArray()), 3));
    // The lid when open is a sliver, so the sphere worked out from it would be a point: far detail (world/farDetail.js) would take it for a
    // speck too small to draw and never bring it back. Fixed to the whole of the eye instead.
    const z = eye.plane.a + eye.plane.b * eye.x + eye.plane.c * eye.y;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(eye.x, eye.y, z), Math.hypot(eye.hw, eye.hh) * 1.6);
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = 'eyelid';
    mesh.frustumCulled = false;
    mesh.receiveShadow = true; // in the shade her hair or the cab roof throws, as her face is
    mesh.visible = false;
    rig.bones.Head.add(mesh);
    return { eye, mesh };
  });
  const lids = {
    parts,
    lid: 0,
    /** Lowers both lids to `s`: 0 open (hidden), 1 shut, up to about 1.25 squeezed. */
    setLid(s) {
      if (Math.abs(s - lids.lid) < 0.002) return;
      lids.lid = s;
      for (const { eye, mesh } of parts) {
        mesh.visible = s > 0.01;
        if (!mesh.visible) continue;
        const attr = mesh.geometry.attributes.position;
        lidAt(eye, s).positions.forEach((p, i) => attr.setXYZ(i, p[0], p[1], p[2]));
        attr.needsUpdate = true;
      }
    },
  };
  return lids;
}

export { LID };
