import * as THREE from 'three';
import { barnShape, wallBoxes } from './barn.js';

// Draws the barn (the shape and numbers are in barn.js): board walls, a tin gable roof on timber ties, the big
// sliding doors pushed back open on the yard side, a concrete floor and the workbench along the north wall.
// All procedural, so there are no model files for it.

function canvasTexture(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(...repeat);
  tex.anisotropy = 4;
  return tex;
}

/** Vertical boards, with a few darker gaps and the odd grain line. */
function boardTexture(random, base) {
  return (repeat) =>
    canvasTexture(
      256,
      64,
      (ctx, w, h) => {
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 32) {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(x, 0, 2, h);
          ctx.fillStyle = `rgba(${random() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + random() * 0.06})`;
          ctx.fillRect(x + 2, 0, 30, h);
        }
        for (let i = 0; i < 90; i++) {
          ctx.strokeStyle = 'rgba(0,0,0,0.09)';
          const x = random() * w;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + (random() - 0.5) * 3, h);
          ctx.stroke();
        }
      },
      repeat,
    );
}

/** Corrugated tin: light and dark ribs across the sheet, a little rust. */
function tinTexture(random, repeat) {
  return canvasTexture(
    128,
    128,
    (ctx, w, h) => {
      for (let x = 0; x < w; x += 16) {
        const g = ctx.createLinearGradient(x, 0, x + 16, 0);
        g.addColorStop(0, '#6e7478');
        g.addColorStop(0.5, '#a9aeb1');
        g.addColorStop(1, '#6e7478');
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, 16, h);
      }
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(120,70,40,${0.05 + random() * 0.1})`;
        ctx.fillRect(random() * w, random() * h, 2 + random() * 6, 6 + random() * 30);
      }
    },
    repeat,
  );
}

function concreteTexture(random, repeat) {
  return canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#8b8a85';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        const v = 100 + random() * 60;
        ctx.fillStyle = `rgba(${v},${v - 2},${v - 6},${0.18 + random() * 0.25})`;
        ctx.fillRect(random() * w, random() * h, 1 + random() * 3, 1 + random() * 3);
      }
      // A few oil stains and an expansion joint.
      for (let i = 0; i < 5; i++) {
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 8 + random() * 20);
        g.addColorStop(0, 'rgba(40,36,30,0.45)');
        g.addColorStop(1, 'rgba(40,36,30,0)');
        ctx.save();
        ctx.translate(random() * w, random() * h);
        ctx.fillStyle = g;
        ctx.fillRect(-30, -30, 60, 60);
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(30,30,30,0.5)';
      ctx.fillRect(0, h / 2 - 1, w, 2);
    },
    repeat,
  );
}

/** Builds the barn and its colliders. Returns { group, light, bulb } (light is the bulb's glow, dimmed to nothing by day). */
export function buildBarnShed({ scene, layout, heights, fixedBox, random }) {
  const shape = barnShape(layout);
  const { outer, inner, wall, wallHeight, ridge, door } = shape;
  const floorY = heights.heightAt(shape.x, shape.z);
  const group = new THREE.Group();
  group.name = 'barn';
  scene.add(group);

  const sizeX = outer.maxX - outer.minX;
  const sizeZ = outer.maxZ - outer.minZ;

  const boards = boardTexture(random, '#7d2a22');
  const white = new THREE.MeshStandardMaterial({ color: 0xe9e6dd, roughness: 0.8 });
  const timber = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x55595c, roughness: 0.5, metalness: 0.7 });
  const add = (mesh, x, y, z, { cast = true, receive = true } = {}) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    group.add(mesh);
    return mesh;
  };
  const box = (sx, sy, sz, mat) => new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);

  // Floor: a slab just proud of the flattened ground.
  const floorMat = new THREE.MeshStandardMaterial({ map: concreteTexture(random, [4, 4]), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 });
  add(box(sizeX - 0.02, 0.03, sizeZ - 0.02, floorMat), shape.x, floorY - 0.004, shape.z, { cast: false });

  // Walls with colliders. The east wall's two halves leave the doorway between them.
  const wallMat = (len, hgt) => {
    const m = new THREE.MeshStandardMaterial({ map: boards([len / 2.4, hgt / 2.4]), roughness: 0.85 });
    return m;
  };
  for (const w of wallBoxes(layout)) {
    const len = Math.max(w.hx, w.hz) * 2;
    add(box(w.hx * 2, wallHeight, w.hz * 2, wallMat(len, wallHeight)), w.x, floorY + wallHeight / 2, w.z);
    fixedBox(w.x, floorY + wallHeight / 2, w.z, w.hx, wallHeight / 2, w.hz);
  }
  // White corner posts and the door frame.
  for (const [cx, cz] of [
    [outer.minX, outer.minZ],
    [outer.minX, outer.maxZ],
    [outer.maxX, outer.minZ],
    [outer.maxX, outer.maxZ],
  ]) add(box(0.34, wallHeight + 0.05, 0.34, white), cx, floorY + wallHeight / 2, cz);
  // Offsets are deliberately off from the wall's own edges so no two faces share a plane.
  for (const side of [-1, 1]) {
    const z = side < 0 ? door.minZ - 0.08 : door.maxZ + 0.08;
    add(box(wall + 0.2, door.height + 0.06, 0.24, white), door.x - wall / 2, floorY + (door.height + 0.06) / 2, z);
  }
  // The beam over the doorway, and the end wall above it up to the eaves.
  add(box(wall + 0.22, 0.3, door.maxZ - door.minZ + 0.56, white), door.x - wall / 2, floorY + door.height + 0.15, shape.z);
  const above = wallHeight - door.height - 0.28;
  add(box(wall, above, door.maxZ - door.minZ, wallMat(door.maxZ - door.minZ, above)), door.x - wall / 2, floorY + door.height + 0.28 + above / 2, shape.z);

  // Gable ends: a board triangle on top of each end wall.
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-sizeZ / 2, 0);
  gableShape.lineTo(sizeZ / 2, 0);
  gableShape.lineTo(0, ridge - wallHeight);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: wall, bevelEnabled: false });
  const gableMat = new THREE.MeshStandardMaterial({ map: boards([sizeZ / 4, 1]), roughness: 0.85, side: THREE.DoubleSide });
  for (const x of [outer.minX + wall, outer.maxX]) {
    const g = add(new THREE.Mesh(gableGeo, gableMat), x, floorY + wallHeight, shape.z);
    g.rotation.y = -Math.PI / 2;
  }

  // Roof: two tin slopes with an overhang, and a ridge cap.
  const overhang = 0.35;
  const rise = ridge - wallHeight;
  const slope = Math.atan2(rise, sizeZ / 2);
  const eaveZ = sizeZ / 2 + overhang;
  const eaveY = wallHeight - overhang * Math.tan(slope);
  const slopeLen = Math.hypot(eaveZ, ridge - eaveY);
  const tin = new THREE.MeshStandardMaterial({ map: tinTexture(random, [(sizeX + 0.8) / 2, slopeLen / 2]), roughness: 0.55, metalness: 0.5 });
  for (const side of [-1, 1]) {
    const panel = box(sizeX + 0.8, 0.07, slopeLen, tin);
    panel.rotation.x = side * slope;
    add(panel, shape.x, floorY + (eaveY + ridge) / 2 + 0.04, shape.z + (side * eaveZ) / 2);
  }
  add(box(sizeX + 0.8, 0.1, 0.35, steel), shape.x, floorY + ridge + 0.07, shape.z);

  // Timber inside: a tie beam across the barn every few metres, a collar and a ridge beam.
  for (let x = outer.minX + 1.4; x < outer.maxX - 0.8; x += 2.6) {
    add(box(0.16, 0.22, sizeZ - wall * 2, timber), x, floorY + wallHeight - 0.15, shape.z);
    for (const side of [-1, 1]) {
      const rafter = box(0.12, 0.16, Math.hypot(sizeZ / 2, rise), timber);
      rafter.rotation.x = side * slope;
      add(rafter, x, floorY + wallHeight + rise / 2 - 0.05, shape.z + (side * sizeZ) / 4);
    }
  }
  add(box(sizeX - wall * 2, 0.18, 0.18, timber), shape.x, floorY + ridge - 0.12, shape.z);

  // The big doors, slid right back on their rail along the outside of the wall.
  const panelW = (door.maxZ - door.minZ) / 2 + 0.3;
  for (const side of [-1, 1]) {
    const z = side < 0 ? door.minZ - panelW / 2 + 0.1 : door.maxZ + panelW / 2 - 0.1;
    const leaf = new THREE.Group();
    leaf.add(box(0.06, door.height - 0.1, panelW, new THREE.MeshStandardMaterial({ map: boards([panelW / 2.4, door.height / 2.4]), roughness: 0.85 })));
    // White battens stacked proud of the boards, each layer at least 2 cm clear of the last (the camera's near/far range
    // is too wide for faces closer than that to hold their order): boards, then frame bars, then each brace.
    for (const s of [-1, 1]) {
      const brace = box(0.07, 0.14, Math.hypot(panelW, door.height - 0.4), white);
      brace.rotation.x = s * Math.atan2(door.height - 0.4, panelW);
      brace.position.x = s < 0 ? 0.055 : 0.075;
      leaf.add(brace);
    }
    for (const [dy, dz] of [[0, 0], [1, 0], [-1, 0]]) {
      const frame = box(0.07, 0.14, panelW + 0.06, white); // longer than the boards, so their end faces are not in the same plane
      frame.position.set(0.025, dy * (door.height / 2 - 0.15), dz);
      leaf.add(frame);
    }
    // The thin battens would make a jagged, flickering shadow on themselves and the boards, so they take part in none: only the boards do.
    leaf.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = o.material !== white;
    });
    // Hung 0.25 m out, clear of the door frame and corner posts (they reach 0.17), or the overlapping faces flicker.
    leaf.position.set(door.x + 0.25, floorY + door.height / 2 + 0.05, z);
    group.add(leaf);
  }
  add(box(0.06, 0.1, sizeZ - 0.6, steel), door.x + 0.22, floorY + door.height + 0.12, shape.z, { cast: false });

  // The workbench along the north wall: a thick top, four legs and a shelf, with a vice at one end.
  const b = layout.bench;
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.85 });
  const benchTop = floorY + b.height;
  add(box(b.length, 0.06, b.depth, benchMat), b.x, benchTop - 0.03, b.z);
  add(box(b.length - 0.1, 0.04, b.depth - 0.08, timber), b.x, floorY + 0.3, b.z);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(box(0.07, b.height - 0.06, 0.07, timber), b.x + sx * (b.length / 2 - 0.08), floorY + (b.height - 0.06) / 2, b.z + sz * (b.depth / 2 - 0.08));
  add(box(0.14, 0.12, 0.2, steel), b.x + b.length / 2 - 0.3, benchTop + 0.06, b.z + b.depth / 2 - 0.12);
  // Pegboard above it with a few tools hung up.
  add(box(b.length, 0.9, 0.03, new THREE.MeshStandardMaterial({ color: 0x9c8a66, roughness: 0.9 })), b.x, benchTop + 1.1, inner.minZ + 0.03, { cast: false });
  for (let i = 0; i < 7; i++) {
    const tool = box(0.03, 0.2 + random() * 0.25, 0.03, i % 2 ? steel : new THREE.MeshStandardMaterial({ color: 0xb3201a, roughness: 0.6 }));
    add(tool, b.x - b.length / 2 + 0.3 + i * ((b.length - 0.6) / 6), benchTop + 1.2 + random() * 0.15, inner.minZ + 0.08, { cast: false });
  }
  fixedBox(b.x, floorY + b.height / 2, b.z, b.length / 2, b.height / 2, b.depth / 2);

  // A bare bulb on a flex from the ridge, which comes on in the gloom.
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c9 }));
  const bulbY = floorY + wallHeight + 0.2;
  add(bulb, shape.x, bulbY, shape.z, { cast: false, receive: false });
  add(box(0.015, 0.9, 0.015, steel), shape.x, bulbY + 0.5, shape.z, { cast: false, receive: false });
  const light = new THREE.PointLight(0xffe2b0, 0, 12, 1.6);
  light.position.set(shape.x, bulbY - 0.15, shape.z);
  group.add(light);

  return { group, light, bulb, floorY };
}
