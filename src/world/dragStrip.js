import * as THREE from 'three';
import { stripPoint } from './layout.js';

// The drag strip (layout.dragStrip): a rough patch of gravel laid over the levelled ground, with ragged edges and ends that thin out into the grass,
// and only cones to mark the start and the finish. Only something to look at: nothing here has a collider, so the quad rides on the ground under it.

function gravelTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#9b958a';
  ctx.fillRect(0, 0, size, size);
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1400; i++) {
    const v = 110 + Math.floor(random() * 90);
    ctx.fillStyle = `rgba(${v},${v - 4},${v - 12},0.55)`;
    ctx.fillRect(random() * size, random() * size, 1 + random() * 2, 1 + random() * 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Builds the strip into the scene and returns its group. `heightAt(x, z)` is the ground. */
export function buildDragStrip(scene, heightAt, strip) {
  const group = new THREE.Group();
  group.name = 'dragStrip';
  const behind = 6;
  const total = behind + strip.length + strip.runOff;
  const cols = Math.round(strip.width / 1);
  const rows = Math.round(total / 1.5);
  let seed = 11;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // Ragged edges: each side wanders in and out along its length, and the ends thin out into the grass rather than stopping square.
  const wander = (n) => {
    const out = [];
    let v = 0;
    for (let i = 0; i <= n; i++) {
      v = v * 0.8 + (random() - 0.5) * 0.9;
      out.push(v);
    }
    return out;
  };
  const leftEdge = wander(rows);
  const rightEdge = wander(rows);
  const earth = new THREE.Color(0x6b5c3e);
  const gravel = new THREE.Color(0xffffff);

  // The surface: a grid of points laid on the ground, a hair above it.
  const positions = [];
  const uvs = [];
  const colours = [];
  for (let r = 0; r <= rows; r++) {
    const along = -behind + (total * r) / rows;
    // Within a few metres of either end it is patchy and narrow.
    const endFade = Math.min(1, Math.min(r, rows - r) / 4);
    const half = (strip.width / 2) * (0.55 + 0.45 * endFade);
    for (let c = 0; c <= cols; c++) {
      const t = c / cols * 2 - 1; // -1..1 across
      const edge = t < 0 ? leftEdge[r] : rightEdge[r];
      const across = t * (half + edge * 0.9) + (random() - 0.5) * 0.35;
      const p = stripPoint(strip, along + (random() - 0.5) * 0.5, across);
      // Edge and end vertices sink into the grass and go earthy, so it blends in.
      const edgeness = Math.min(1, Math.max(0, (Math.abs(t) - 0.55) / 0.45));
      const blend = Math.min(1, edgeness * 0.85 + (1 - endFade) * 0.7 + random() * 0.15);
      positions.push(p.x, heightAt(p.x, p.z) + 0.03 - blend * 0.05, p.z);
      uvs.push((c / cols) * (strip.width / 3), (r / rows) * (total / 3));
      const col = gravel.clone().lerp(earth, blend);
      colours.push(col.r, col.g, col.b);
    }
  }
  const index = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c;
      index.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const surface = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: gravelTexture(), vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
  surface.receiveShadow = true;
  group.add(surface);

  // Only cones mark it: a pair at the start and a pair at the finish, just outside the edges.
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xe8541a, roughness: 0.55 });
  for (const at of [0, strip.length]) {
    for (const side of [-1, 1]) {
      const p = stripPoint(strip, at, side * (strip.width / 2 + 0.4));
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.55, 14), coneMat);
      cone.position.set(p.x, heightAt(p.x, p.z) + 0.28, p.z);
      cone.castShadow = true;
      group.add(cone);
    }
  }

  scene.add(group);
  return group;
}
