import * as THREE from 'three';
import { browOf, browAt, mouthAt, heightField, frontmostZ, FACE } from './faceShape.js';
import { paintedShapes } from './eyelids.js';
import { isEye } from './eyelidShape.js';
import { PALETTE, bodyMesh } from './outfit.js';

// A girl's brows and mouth (docs/decisions/girls.md, "Brows and a mouth (#128)"). The model has no face to move: her brows are painted
// and she has no mouth. So the painted brows are hidden (their corners pointed at her skin in the texture) and strips in her hair's
// colour laid where they were, and a mouth is laid on her face below her nose, all on her Head bone and shaped by faceShape.js.
// `setFace(ch)` poses them to faceExpression.js's channels.

const _v = new THREE.Vector3();
const srgb = (rgb) => new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
const SKIN = srgb(PALETTE.skin);
const LIP = SKIN.clone().multiply(new THREE.Color(0.84, 0.7, 0.7)); // a shade under her skin, warmer: not painted on red
const TEETH = srgb([226, 218, 200]).multiplyScalar(0.9); // pale, and in the shade of her lip
const INSIDE = srgb([70, 34, 34]);
const MOUTH_COLOURS = { lip: LIP, teeth: TEETH, inside: INSIDE };

/** Her face's skin and paint as triangles in her Head bone's space (not her hair, which hangs in front of her brow), with what the painting needs. */
function faceTriangles(rig) {
  const body = bodyMesh(rig);
  const map = body?.material.userData.baseMap ?? body?.material.map;
  const img = map?.image;
  const head = rig.bones.Head;
  if (!img || !head) return null;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const uv = body.geometry.attributes.uv;
  const paint = (i) => {
    const x = Math.min(canvas.width - 1, Math.floor(uv.getX(i) * canvas.width));
    const y = Math.min(canvas.height - 1, Math.floor((map.flipY ? 1 - uv.getY(i) : uv.getY(i)) * canvas.height));
    const k = (y * canvas.width + x) * 4;
    const is = (c) => c.every((v, j) => Math.abs(px[k + j] - v) < 3);
    return is(PALETTE.skin) ? 'skin' : is(PALETTE.dark) ? 'dark' : 'other';
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
  const index = body.geometry.index;
  const tris = [];
  let skinUV = null;
  for (let t = 0; t < index.count; t += 3) {
    const tri = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
    if (!tri.every(onHead)) continue;
    const paints = tri.map(paint);
    if (paints.some((p) => p === 'other')) continue;
    tris.push(tri.map(at));
    // The middle of a triangle painted all skin: a corner can sit on the edge of the colour, and the texture's filtering bleeds there.
    if (!skinUV && paints.every((p) => p === 'skin')) skinUV = [0, 1].map((k) => tri.reduce((s, i) => s + uv.getComponent(i, k), 0) / 3);
  }
  return { body, tris, skinUV };
}

/** A mesh for a strip whose vertex count never changes, coloured per vertex, on her Head bone. */
function stripMesh(rig, name, shape, colours, material, centre, radius) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(shape.positions.flat(), 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colours.flatMap((c) => [c.r, c.g, c.b]), 3));
  geo.setIndex(shape.index);
  geo.computeVertexNormals();
  // Fixed to the whole of where it can move, so far detail (world/farDetail.js) never takes a closed mouth for a speck.
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(...centre), radius);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.receiveShadow = true; // in her hair's shade, as her face is
  rig.bones.Head.add(mesh);
  return mesh;
}

function place(mesh, positions) {
  const attr = mesh.geometry.attributes.position;
  positions.forEach((p, i) => attr.setXYZ(i, p[0], p[1], p[2]));
  attr.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

/**
 * Builds her brows and mouth and puts them on her Head bone. `hair` is her hair's colour (a CSS colour or palette [r, g, b]). Returns
 * { setFace(ch), brows, mouth } or null if her face wasn't found.
 */
export function addFace(rig, { hair = PALETTE.hair } = {}) {
  let found = null;
  let shapes = [];
  rig.withRestPose(() => {
    found = faceTriangles(rig);
    shapes = paintedShapes(rig);
  });
  if (!found || !found.tris.length) return null;
  const brows = shapes.filter((s) => !isEye(s.points)).map((s) => ({ ...s, brow: browOf(s.points) })).filter((s) => s.brow);
  const eyes = shapes.filter((s) => isEye(s.points));
  if (brows.length !== 2 || eyes.length !== 2) return null;
  // Her face's height, sampled once on a grid over where the brows and the mouth go: finer than her face's facets, or a strip laid
  // between two samples cuts in under a ridge.
  const ys = brows.flatMap((b) => b.points.map((p) => p[1]));
  const xs = brows.flatMap((b) => b.points.map((p) => p[0]));
  const [xLo, xHi] = [Math.min(...xs) - 0.03, Math.max(...xs) + 0.03];
  const sample = (x, y) => frontmostZ(found.tris, x, y);
  const browSurface = heightField(sample, xLo, xHi, Math.min(...ys) - 0.05, Math.max(...ys) + 0.05, 96, 40);
  const mid = eyes.reduce((s, e) => s + e.points.reduce((a, p) => a + p[0], 0) / e.points.length, 0) / 2;
  const mouthSurface = heightField(sample, mid - 0.14, mid + 0.14, FACE.mouthY - 0.08, FACE.mouthY + 0.05, 56, 32);

  // The painted brows go: their corners point at her skin in the texture, so the strips are her only brows.
  const uv = found.body.geometry.attributes.uv;
  if (found.skinUV) {
    for (const b of brows) for (const i of b.verts) uv.setXY(i, found.skinUV[0], found.skinUV[1]);
    uv.needsUpdate = true;
  }

  const browColour = (Array.isArray(hair) ? srgb(hair) : new THREE.Color(hair)).multiplyScalar(0.8); // a shade under her hair, as brows are
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
  const browParts = brows.map(({ brow }) => {
    const shape = browAt(brow, {}, browSurface);
    const centre = [(brow.inner + brow.outer) / 2, brow.line((brow.inner + brow.outer) / 2), browSurface((brow.inner + brow.outer) / 2, brow.line(brow.inner))];
    const mesh = stripMesh(rig, 'brow', shape, shape.positions.map(() => browColour), material, centre, Math.abs(brow.outer - brow.inner) + FACE.browLift);
    return { brow, mesh };
  });
  const first = mouthAt({}, mouthSurface, mid);
  const mouth = stripMesh(rig, 'mouth', first, first.part.map((p) => MOUTH_COLOURS[p]), material, [mid, FACE.mouthY, mouthSurface(mid, FACE.mouthY)], FACE.mouthHalf + FACE.mouthWide + FACE.mouthOpen);

  let last = '';
  const face = {
    brows: browParts,
    mouth,
    /** Lays the brows and mouth to faceExpression.js's channels. */
    setFace(ch) {
      const key = ['lift', 'knit', 'curve', 'wide', 'open', 'teeth'].map((c) => Math.round((ch[c] ?? 0) * 200)).join(',');
      if (key === last) return;
      last = key;
      for (const { brow, mesh } of browParts) place(mesh, browAt(brow, ch, browSurface).positions);
      place(mouth, mouthAt(ch, mouthSurface, mid).positions);
    },
  };
  return face;
}
