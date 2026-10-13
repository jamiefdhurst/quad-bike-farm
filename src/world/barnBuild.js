import * as THREE from 'three';
import { barnShape, wallBoxes, dividerPosts } from './barn.js';
import { buildJack, buildAxleStand } from '../workshop/jackModel.js';
import { loftShape } from './loft.js';
import { squareBaleGeometry, squareBaleMaterials, strawClumpGeometry } from './squareBale.js';

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
  const sizeZ = outer.maxZ - outer.minZ; // one span's width: the roof, gables and ties are drawn once for each span
  const annex = shape.annex;
  const spanZs = annex ? [shape.z, annex.z] : [shape.z]; // the middle of each span
  const all = shape.outerAll;
  const allZ = (all.minZ + all.maxZ) / 2;
  const sizeAllZ = all.maxZ - all.minZ;

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
  const floorMat = new THREE.MeshStandardMaterial({ map: concreteTexture(random, [4, 4 * (sizeAllZ / sizeZ)]), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 });
  add(box(sizeX - 0.02, 0.03, sizeAllZ - 0.02, floorMat), shape.x, floorY - 0.004, allZ, { cast: false });

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
    [all.minX, all.minZ],
    [all.minX, all.maxZ],
    [all.maxX, all.minZ],
    [all.maxX, all.maxZ],
  ]) add(box(0.34, wallHeight + 0.05, 0.34, white), cx, floorY + wallHeight / 2, cz);
  if (annex) {
    // Where the two spans meet: a white post on the east and west walls, and the valley between the roofs on a beam across the barn
    // that the posts inside carry (they have colliders), with a steel gutter along it.
    for (const cx of [all.minX, all.maxX]) add(box(0.34, wallHeight - 0.12, 0.34, white), cx, floorY + (wallHeight - 0.12) / 2, outer.maxZ);
    add(box(sizeX - wall * 2, 0.28, 0.2, timber), shape.x, floorY + wallHeight - 0.14, outer.maxZ);
    add(box(sizeX + 0.8, 0.08, 0.3, steel), shape.x, floorY + wallHeight + 0.02, outer.maxZ, { cast: false });
    for (const p of dividerPosts(layout)) {
      add(box(0.2, wallHeight - 0.28, 0.2, timber), p.x, floorY + (wallHeight - 0.28) / 2, p.z);
      fixedBox(p.x, floorY + wallHeight / 2, p.z, p.r, wallHeight / 2, p.r);
    }
  }
  // Offsets are deliberately off from the wall's own edges so no two faces share a plane.
  for (const side of [-1, 1]) {
    const z = side < 0 ? door.minZ - 0.08 : door.maxZ + 0.08;
    add(box(wall + 0.2, door.height + 0.06, 0.24, white), door.x - wall / 2, floorY + (door.height + 0.06) / 2, z);
  }
  // The beam over the doorway, and the end wall above it up to the eaves.
  add(box(wall + 0.22, 0.3, door.maxZ - door.minZ + 0.56, white), door.x - wall / 2, floorY + door.height + 0.15, shape.z);
  // The hay door is a gap in it (and in the gable above, below), so the loft looks out over the yard.
  const above = wallHeight - door.height - 0.28;
  const hd = layout.loft.hayDoor;
  const sideLen = (door.maxZ - door.minZ) / 2 - hd.halfWidth;
  const sillY = hd.sill - door.height - 0.28; // how far up the header the opening starts
  for (const side of [-1, 1]) {
    const z = shape.z + side * (hd.halfWidth + sideLen / 2);
    add(box(wall, above, sideLen, wallMat(sideLen, above)), door.x - wall / 2, floorY + door.height + 0.28 + above / 2, z);
  }
  add(box(wall, sillY, hd.halfWidth * 2, wallMat(hd.halfWidth * 2, sillY)), door.x - wall / 2, floorY + door.height + 0.28 + sillY / 2, shape.z);

  // Nothing walks out of the hay door or over the doorway: a solid barrier across the whole end wall above the big doors, up to the opening's top.
  fixedBox(door.x - wall / 2, floorY + (door.height + hd.top) / 2, shape.z, wall / 2, (hd.top - door.height) / 2, (door.maxZ - door.minZ) / 2);

  // Gable ends: a board triangle on top of each end wall.
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-sizeZ / 2, 0);
  gableShape.lineTo(sizeZ / 2, 0);
  gableShape.lineTo(0, ridge - wallHeight);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: wall, bevelEnabled: false });
  const gableMat = new THREE.MeshStandardMaterial({ map: boards([sizeZ / 4, 1]), roughness: 0.85, side: THREE.DoubleSide });
  // The east one has a notch cut up from its foot for the hay door.
  const notchShape = new THREE.Shape();
  const notchTop = hd.top - wallHeight; // the hay door's top, above the eaves line
  notchShape.moveTo(-sizeZ / 2, 0);
  notchShape.lineTo(-hd.halfWidth, 0);
  notchShape.lineTo(-hd.halfWidth, notchTop);
  notchShape.lineTo(hd.halfWidth, notchTop);
  notchShape.lineTo(hd.halfWidth, 0);
  notchShape.lineTo(sizeZ / 2, 0);
  notchShape.lineTo(0, ridge - wallHeight);
  notchShape.closePath();
  const notchGeo = new THREE.ExtrudeGeometry(notchShape, { depth: wall, bevelEnabled: false });
  for (const x of [outer.minX + wall, outer.maxX]) {
    const g = add(new THREE.Mesh(x === outer.maxX ? notchGeo : gableGeo, gableMat), x, floorY + wallHeight, shape.z);
    g.rotation.y = -Math.PI / 2;
  }
  if (annex) {
    for (const x of [outer.minX + wall, outer.maxX]) {
      const g = add(new THREE.Mesh(gableGeo, gableMat), x, floorY + wallHeight, annex.z);
      g.rotation.y = -Math.PI / 2;
    }
  }
  // A white frame round the hay door and a hoist beam sticking out above it. Each piece stands 0.02 m proud of the opening's edges
  // (sill top, reveals and lintel underside), or its faces share a plane with the wall's and flicker, as the barn doors' did.
  const doorTop = floorY + hd.top;
  const sillTop = floorY + hd.sill;
  const proud = 0.02;
  const fx = door.x - wall / 2;
  add(box(wall + 0.14, 0.1, hd.halfWidth * 2 + 0.3, white), fx, sillTop + proud - 0.05, shape.z); // top at sillTop + proud
  const postH = doorTop - sillTop + 0.13; // up into the lintel
  for (const side of [-1, 1]) add(box(wall + 0.14, postH, 0.1 + proud, white), fx, sillTop - 0.08 + postH / 2, shape.z + side * (hd.halfWidth + 0.05 - proud / 2));
  add(box(wall + 0.14, 0.1, hd.halfWidth * 2 + 0.3, white), fx, doorTop - proud + 0.05, shape.z); // underside at doorTop - proud
  add(box(0.9, 0.12, 0.12, timber), door.x + 0.35, doorTop + 0.2, shape.z);
  // The hay door's shutter, hooked back against the outside of the wall so you can see out. A wind out of the door lifts it off and it
  // swings about on its hinge (`angle` radians away from the wall, world/wind.js Shutter) and bangs back. Boards with two battens.
  const shutterW = hd.halfWidth * 2 - 0.1;
  const shutterH = hd.top - hd.sill - 0.08;
  const shutter = new THREE.Group();
  shutter.position.set(door.x + 0.115, floorY + (hd.sill + hd.top) / 2, shape.z - hd.halfWidth - 0.1);
  const boardsMat = new THREE.MeshStandardMaterial({ map: boards([1.5, 1]), roughness: 0.9, color: 0xb9b0a4 });
  for (const [sx, sy, sz, mat, dx, dy] of [[0.035, shutterH, shutterW, boardsMat, 0, 0], [0.03, 0.1, shutterW, timber, 0.03, shutterH * 0.3], [0.03, 0.1, shutterW, timber, 0.03, -shutterH * 0.3]]) {
    const part = box(sx, sy, sz, mat);
    part.position.set(dx, dy, -shutterW / 2);
    part.castShadow = true;
    shutter.add(part);
  }
  group.add(shutter);

  // The second span's door: the same white frame and header, and plain boards over it up to the eaves.
  if (annex) {
    const ad = annex.door;
    for (const side of [-1, 1]) add(box(wall + 0.2, ad.height + 0.06, 0.24, white), ad.x - wall / 2, floorY + (ad.height + 0.06) / 2, side < 0 ? ad.minZ - 0.08 : ad.maxZ + 0.08);
    add(box(wall + 0.22, 0.3, ad.maxZ - ad.minZ + 0.56, white), ad.x - wall / 2, floorY + ad.height + 0.15, annex.z);
    const aboveA = wallHeight - ad.height - 0.28;
    add(box(wall, aboveA, ad.maxZ - ad.minZ, wallMat(ad.maxZ - ad.minZ, aboveA)), ad.x - wall / 2, floorY + ad.height + 0.28 + aboveA / 2, annex.z);
    fixedBox(ad.x - wall / 2, floorY + (ad.height + wallHeight) / 2, annex.z, wall / 2, (wallHeight - ad.height) / 2, (ad.maxZ - ad.minZ) / 2);
  }

  // Roof: two tin slopes with an overhang, and a ridge cap.
  const overhang = 0.35;
  const rise = ridge - wallHeight;
  const slope = Math.atan2(rise, sizeZ / 2);
  const eaveZ = sizeZ / 2 + overhang;
  const eaveY = wallHeight - overhang * Math.tan(slope);
  const slopeLen = Math.hypot(eaveZ, ridge - eaveY);
  const tin = new THREE.MeshStandardMaterial({ map: tinTexture(random, [(sizeX + 0.8) / 2, slopeLen / 2]), roughness: 0.55, metalness: 0.5 });
  for (const [n, zc] of spanZs.entries()) {
    for (const side of [-1, 1]) {
      // The side facing the other span ends at the wall line, with no overhang, so the two roofs meet cleanly in a valley.
      const valley = annex && side === (n === 0 ? 1 : -1);
      const eZ = valley ? sizeZ / 2 : eaveZ;
      const eY = valley ? wallHeight : eaveY;
      const len = Math.hypot(eZ, ridge - eY);
      const panel = box(sizeX + 0.8, 0.07, len, tin);
      panel.rotation.x = side * Math.atan2(ridge - eY, eZ);
      add(panel, shape.x, floorY + (eY + ridge) / 2 + 0.04, zc + (side * eZ) / 2);
    }
    add(box(sizeX + 0.8, 0.1, 0.35, steel), shape.x, floorY + ridge + 0.07, zc);
  }

  // Timber inside: a tie beam across the barn every few metres, a collar and a ridge beam.
  for (let x = outer.minX + 1.4; x < outer.maxX - 0.8; x += 2.6) {
    // None over the loft: you stand there with your head at their height. (Its edge beam does their job.)
    if (x > layout.loft.edgeX - 0.3) {
      addRafters(x);
      continue;
    }
    add(box(0.16, 0.22, sizeZ - wall * 2, timber), x, floorY + wallHeight - 0.15, shape.z);
    addRafters(x);
  }
  // The second span has a tie beam at every position (there is no loft over it) and rafters of its own.
  if (annex) {
    for (let x = outer.minX + 1.4; x < outer.maxX - 0.8; x += 2.6) {
      add(box(0.16, 0.22, sizeZ - wall * 2, timber), x, floorY + wallHeight - 0.15, annex.z);
      addRafters(x, annex.z);
    }
    add(box(sizeX - wall * 2, 0.18, 0.18, timber), shape.x, floorY + ridge - 0.12, annex.z);
  }
  function addRafters(x, zc = shape.z) {
    for (const side of [-1, 1]) {
      const rafter = box(0.12, 0.16, Math.hypot(sizeZ / 2, rise), timber);
      rafter.rotation.x = side * slope;
      add(rafter, x, floorY + wallHeight + rise / 2 - 0.05, zc + (side * sizeZ) / 4);
    }
  }
  add(box(sizeX - wall * 2, 0.18, 0.18, timber), shape.x, floorY + ridge - 0.12, shape.z);

  // The big doors, slid right back on their rail along the outside of the wall.
  for (const dr of annex ? [door, annex.door] : [door]) {
  const panelW = (dr.maxZ - dr.minZ) / 2 + 0.3;
  for (const side of [-1, 1]) {
    const z = side < 0 ? dr.minZ - panelW / 2 + 0.1 : dr.maxZ + panelW / 2 - 0.1;
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
  }
  add(box(0.06, 0.1, sizeAllZ - 0.6, steel), door.x + 0.22, floorY + door.height + 0.12, allZ, { cast: false });

  // The workbench along the north wall: a thick top, four legs and a shelf, with a vice at one end.
  const b = layout.bench;
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.85 });
  const benchTop = floorY + b.height;
  // The top is separate planks with a hairline between them, on a frame of rails; legs have a cross brace and the shelf is slatted.
  const plankMats = [0x7a5a3a, 0x72532f, 0x82623f].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  const planks = 5;
  const plankD = b.depth / planks;
  for (let i = 0; i < planks; i++) {
    add(box(b.length + 0.06, 0.055, plankD - 0.006, plankMats[i % 3]), b.x, benchTop - 0.0275, b.z - b.depth / 2 + plankD * (i + 0.5));
  }
  const legX = b.length / 2 - 0.08;
  const legZ = b.depth / 2 - 0.08;
  add(box(b.length - 0.1, 0.1, 0.04, timber), b.x, benchTop - 0.1, b.z + legZ); // front and back aprons
  add(box(b.length - 0.1, 0.1, 0.04, timber), b.x, benchTop - 0.1, b.z - legZ);
  for (const sx of [-1, 1]) {
    add(box(0.04, 0.1, b.depth - 0.12, timber), b.x + sx * legX, benchTop - 0.1, b.z); // end rails
    for (const sz of [-1, 1]) add(box(0.08, b.height - 0.06, 0.08, timber), b.x + sx * legX, floorY + (b.height - 0.06) / 2, b.z + sz * legZ);
    // Diagonal brace between the legs at each end.
    const brace = box(0.035, 0.6, 0.035, timber);
    brace.rotation.x = Math.atan2(b.depth - 0.2, 0.45);
    add(brace, b.x + sx * legX, floorY + 0.5, b.z);
  }
  for (let i = 0; i < 4; i++) add(box(b.length - 0.1, 0.03, (b.depth - 0.1) / 4 - 0.01, timber), b.x, floorY + 0.3, b.z - (b.depth - 0.1) / 2 + ((b.depth - 0.1) / 4) * (i + 0.5));
  // Vice at the right-hand end, bolted to the front edge: a cast iron body with a fixed jaw, a moving jaw on a slide bar, a screw
  // running out of the back and a T handle with ball ends, the jaws open a hand's width.
  const vx = b.x + b.length / 2 - 0.3;
  const vz = b.z + b.depth / 2 - 0.1;
  const vice = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x2f4a5c, roughness: 0.55, metalness: 0.55 });
  const jawFace = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.6, metalness: 0.8 });
  const part = (geo, mat, x, y, z, rot) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rot) m.rotation.set(...rot);
    m.castShadow = m.receiveShadow = true;
    vice.add(m);
    return m;
  };
  part(new THREE.BoxGeometry(0.16, 0.025, 0.2), iron, 0, 0.0125, 0); // base plate with four bolt heads
  for (const [bx, bz] of [[-0.06, -0.08], [0.06, -0.08], [-0.06, 0.08], [0.06, 0.08]]) part(new THREE.CylinderGeometry(0.01, 0.01, 0.008, 6), steel, bx, 0.029, bz);
  part(new THREE.BoxGeometry(0.12, 0.09, 0.16), iron, -0.02, 0.07, 0); // the body and fixed jaw
  part(new THREE.BoxGeometry(0.03, 0.05, 0.14), iron, -0.095, 0.115, 0); // fixed jaw standing proud of the body
  part(new THREE.BoxGeometry(0.006, 0.04, 0.12), jawFace, -0.078, 0.115, 0);
  part(new THREE.BoxGeometry(0.03, 0.05, 0.14), iron, -0.02 + 0.2 * 0.5 - 0.02, 0.115, 0); // moving jaw, a hand's width off the fixed one
  part(new THREE.BoxGeometry(0.006, 0.04, 0.12), jawFace, -0.02 + 0.2 * 0.5 - 0.037, 0.115, 0);
  part(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), steel, 0.03, 0.095, 0, [0, 0, Math.PI / 2]); // slide bar
  part(new THREE.CylinderGeometry(0.009, 0.009, 0.12, 8), steel, 0.15, 0.115, 0, [0, 0, Math.PI / 2]); // the screw, out the back
  part(new THREE.CylinderGeometry(0.006, 0.006, 0.26, 6), steel, 0.2, 0.115, 0, [Math.PI / 2, 0, 0]); // T handle across it
  for (const sz of [-1, 1]) part(new THREE.SphereGeometry(0.014, 8, 6), steel, 0.2, 0.115, sz * 0.13);
  vice.position.set(vx, benchTop, vz);
  group.add(vice);
  // Things on the top: an oil can, two jars of screws and a dark rag.
  const redPaint = new THREE.MeshStandardMaterial({ color: 0xb3201a, roughness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfd6d0, roughness: 0.15, transparent: true, opacity: 0.55 });
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 12), redPaint);
  add(can, b.x - b.length / 2 + 0.35, benchTop + 0.07, b.z - 0.1);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, 0.09, 6), steel);
  spout.rotation.z = -0.9;
  add(spout, b.x - b.length / 2 + 0.4, benchTop + 0.18, b.z - 0.1, { cast: false });
  for (let i = 0; i < 2; i++) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.11, 12), glass), b.x + i * 0.16, benchTop + 0.055, b.z - 0.2, { cast: false });
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.015, 12), steel), b.x + i * 0.16, benchTop + 0.118, b.z - 0.2, { cast: false });
  }
  const rag = box(0.22, 0.015, 0.16, new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 1 }));
  rag.rotation.y = 0.4;
  add(rag, b.x + b.length / 2 - 1.1, benchTop + 0.008, b.z + 0.05, { cast: false });
  // Pegboard above it with a few tools hung up.
  add(box(b.length, 0.9, 0.03, new THREE.MeshStandardMaterial({ color: 0x9c8a66, roughness: 0.9 })), b.x, benchTop + 1.1, inner.minZ + 0.03, { cast: false });
  // A grid of holes across the pegboard, as dark dots.
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x3b3224 });
  const holes = new THREE.InstancedMesh(new THREE.CircleGeometry(0.008, 6), holeMat, Math.floor(b.length / 0.1) * 8);
  const m4 = new THREE.Matrix4();
  let hi = 0;
  for (let ix = 0; ix < Math.floor(b.length / 0.1); ix++) {
    for (let iy = 0; iy < 8; iy++) holes.setMatrixAt(hi++, m4.makeTranslation(b.x - b.length / 2 + 0.05 + ix * 0.1, benchTop + 0.7 + iy * 0.1, inner.minZ + 0.047));
  }
  group.add(holes);
  for (let i = 0; i < 7; i++) {
    const tool = box(0.03, 0.2 + random() * 0.25, 0.03, i % 2 ? steel : new THREE.MeshStandardMaterial({ color: 0xb3201a, roughness: 0.6 }));
    add(tool, b.x - b.length / 2 + 0.3 + i * ((b.length - 0.6) / 6), benchTop + 1.2 + random() * 0.15, inner.minZ + 0.08, { cast: false });
  }
  fixedBox(b.x, floorY + b.height / 2, b.z, b.length / 2, b.height / 2, b.depth / 2);
  // The bay for working on a quad, painted on the floor in front of the bench.
  const bay = layout.bay;
  // The floor is pulled towards the camera by a polygon offset of -2, so the paint needs a bigger one or the floor hides it from a distance.
  const paint = new THREE.MeshStandardMaterial({ color: 0xd9b82a, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  for (const [w, d, x, z] of [[bay.halfX * 2, 0.08, 0, -bay.halfZ], [bay.halfX * 2, 0.08, 0, bay.halfZ], [0.08, bay.halfZ * 2, -bay.halfX, 0], [0.08, bay.halfZ * 2, bay.halfX, 0]]) {
    add(box(w, 0.012, d, paint), bay.x + x, floorY + 0.016, bay.z + z, { cast: false });
  }
  if (layout.bay2) {
    // The big bay in the second span, painted the same, with a trolley jack and a pair of axle stands waiting beside it.
    const b2 = layout.bay2;
    for (const [w, d, x, z] of [[b2.halfX * 2, 0.08, 0, -b2.halfZ], [b2.halfX * 2, 0.08, 0, b2.halfZ], [0.08, b2.halfZ * 2, -b2.halfX, 0], [0.08, b2.halfZ * 2, b2.halfX, 0]]) {
      add(box(w, 0.012, d, paint), b2.x + x, floorY + 0.016, b2.z + z, { cast: false });
    }
    const jack = buildJack();
    jack.position.set(layout.jack.x, floorY, layout.jack.z);
    jack.rotation.y = layout.jack.yaw;
    group.add(jack);
    for (const st of layout.axleStands) {
      const stand = buildAxleStand();
      stand.position.set(st.x, floorY, st.z);
      stand.rotation.y = st.yaw;
      group.add(stand);
    }
  }

  // The hayloft over the front of the barn: planks on joists from the end wall back to an open edge with a rail and a gap at the ladder,
  // and hay stacked down both sides where the roof comes too low to walk (they have colliders, so you stay in the middle).
  const l = layout.loft;
  const lf = loftShape(layout, floorY);
  const plankMat = new THREE.MeshStandardMaterial({ map: boards([4, 1.5]), roughness: 0.9, color: 0xc9b08a });
  const lx = (lf.minX + lf.maxX) / 2;
  const lz = (lf.minZ + lf.maxZ) / 2;
  const lw = lf.maxX - lf.minX;
  const ld = lf.maxZ - lf.minZ;
  // Planks, joists and beam run 5 cm into the walls, or their ends share a plane with the wall faces and flicker.
  const lwIn = lw + 0.05;
  const ldIn = ld + 0.1;
  add(box(lwIn, 0.1, ldIn, plankMat), lx + 0.025, lf.top - 0.05, lz);
  fixedBox(lx, lf.top - 0.06, lz, lw / 2, 0.06, ld / 2);
  for (let z = lf.minZ + 0.6; z < lf.maxZ; z += 1.2) add(box(lwIn, 0.18, 0.1, timber), lx + 0.025, lf.top - 0.19, z, { cast: false });
  add(box(0.14, 0.26, ldIn, timber), lf.edgeX + 0.07, lf.top - 0.23, lz); // the beam under the open edge
  for (const z of [lf.minZ + 0.1, lz, lf.maxZ - 0.1]) add(box(0.14, l.floor - 0.1, 0.14, timber), lf.edgeX + 0.1, floorY + (l.floor - 0.1) / 2, z); // and its posts
  // Rail: two rails and posts in each span, each with a collider you can't climb over.
  for (const span of lf.railSpans) {
    const len = span.z1 - span.z0;
    if (len < 0.05) continue;
    const cz = (span.z0 + span.z1) / 2;
    // The drawn rail stops short of the eaves, where the roof comes down below its top (it showed through the tin, now the valley can be seen from above);
    // the collider keeps the whole span.
    const v0 = Math.max(span.z0, shape.z - 3.7);
    const v1 = Math.min(span.z1, shape.z + 3.7);
    if (v1 - v0 > 0.05) {
      add(box(0.07, 0.07, v1 - v0, timber), lf.edgeX + 0.04, lf.top + l.rail, (v0 + v1) / 2, { cast: false });
      add(box(0.05, 0.05, v1 - v0, timber), lf.edgeX + 0.04, lf.top + l.rail * 0.5, (v0 + v1) / 2, { cast: false });
      for (const z of [v0 + 0.05, v1 - 0.05]) add(box(0.07, l.rail, 0.07, timber), lf.edgeX + 0.04, lf.top + l.rail / 2, z, { cast: false });
    }
    fixedBox(lf.edgeX + 0.04, lf.top + l.rail / 2, cz, 0.05, l.rail / 2, len / 2);
  }
  // The ladder: leans from the foot on the barn floor to just over the edge at the gap in the rail.
  const lad = new THREE.Group();
  const top = lf.ladderTop;
  const foot = lf.ladderFoot;
  const ladRise = top.y + 0.7 - foot.y;
  const run = lf.edgeX + 0.1 - foot.x;
  const len = Math.hypot(ladRise, run);
  lad.position.set(foot.x, foot.y, foot.z);
  lad.rotation.z = Math.atan2(-run, ladRise); // leans its top over towards the loft (+x)
  const half = l.ladder.width / 2;
  for (const side of [-1, 1]) {
    const rail = box(0.06, len, 0.06, timber);
    rail.position.set(0, len / 2, side * half);
    lad.add(rail);
  }
  for (let d = 0.3; d < len - 0.1; d += 0.3) {
    const rung = box(0.05, 0.05, l.ladder.width, timber);
    rung.position.set(0, d, 0);
    lad.add(rung);
  }
  lad.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  group.add(lad);
  // Something to look at to climb it: a box round the whole ladder.
  const ladderProxy = new THREE.Mesh(new THREE.BoxGeometry(1.1, lf.top - foot.y + 0.6, 0.9), new THREE.MeshBasicMaterial({ visible: false }));
  ladderProxy.position.set((foot.x + lf.edgeX) / 2, foot.y + (lf.top - foot.y + 0.6) / 2, foot.z);
  group.add(ladderProxy);

  // Hay: a stack of square bales down each side of the walkable band (the north one is the one you hide in), stepping down towards the
  // eaves so none reaches the roof, with a tall collider each, loose straw on top, and the bale a girl sits on at the edge.
  const strawMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }); // tinted per clump
  const hy = l.hay;
  const stacks = [
    { x: hy.x, z: hy.z, hx: hy.halfX, hz: hy.halfZ },
    { x: hy.x, z: (lf.walkMaxZ + lf.maxZ) / 2, hx: hy.halfX, hz: (lf.maxZ - lf.walkMaxZ) / 2 },
  ];
  const BALE = { w: 0.9, h: 0.36, d: 0.46 };
  const baleMats = squareBaleMaterials(random);
  const baleGeo = squareBaleGeometry(BALE.w, BALE.h, BALE.d);
  const roofAt = (z) => floorY + wallHeight + (ridge - wallHeight) * (1 - Math.abs(z - shape.z) / (sizeZ / 2)); // the roof's underside-ish, above the barn floor
  const spots = [];
  const nook = { x: l.hideSpot.x, z: l.hideSpot.z, hx: 0.75, hz: 0.5 }; // left hollow so you can hide in it
  for (const st of stacks) {
    const cols = Math.floor((st.hz * 2) / BALE.d);
    const z0 = st.z - (cols * BALE.d) / 2;
    const rows = Math.floor((st.hx * 2) / BALE.w);
    const x0 = st.x - (rows * BALE.w) / 2;
    for (let c = 0; c < cols; c++) {
      const zc = z0 + (c + 0.5) * BALE.d;
      // The column's height is whatever fits under the roof at its edge nearer the eaves, with a hand's width to spare.
      const edge = zc + Math.sign(zc - shape.z) * BALE.d / 2;
      const layers = Math.max(0, Math.min(4, Math.floor((roofAt(edge) - lf.top - 0.25) / BALE.h)));
      for (let k = 0; k < layers; k++) {
        for (let r = 0; r < rows; r++) {
          // Alternate layers are shifted half a bale, as they are laid, trimming the ends to fit.
          const shift = k % 2 ? BALE.w / 2 : 0;
          const xc = x0 + (r + 0.5) * BALE.w + shift;
          if (xc + BALE.w / 2 > st.x + st.hx + 0.01) continue;
          if (k < 2 && Math.abs(xc - nook.x) < nook.hx + BALE.w / 2 - 0.15 && Math.abs(zc - nook.z) < nook.hz + BALE.d / 2 - 0.1) continue;
          spots.push({ x: xc, y: lf.top + (k + 0.5) * BALE.h, z: zc, k, turn: (random() - 0.5) * 0.04 });
        }
      }
    }
    fixedBox(st.x, lf.top + 1.1, st.z, st.hx, 1.1, st.hz); // taller than the hay: the roof is too low to walk there
  }
  const hayBales = new THREE.InstancedMesh(baleGeo, baleMats, spots.length);
  const tint = new THREE.Color();
  spots.forEach((sp, i) => {
    m4.compose(new THREE.Vector3(sp.x, sp.y, sp.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sp.turn), new THREE.Vector3(1, 1, 1));
    hayBales.setMatrixAt(i, m4);
    hayBales.setColorAt(i, tint.setHSL(0.12, 0.2, 0.82 + random() * 0.18));
  });
  hayBales.castShadow = hayBales.receiveShadow = true;
  group.add(hayBales);
  // A bale to sit on at the edge, where the girl sits.
  const seat = l.seat;
  const seatBale = new THREE.Mesh(baleGeo, baleMats);
  seatBale.position.set(seat.x - Math.sin(seat.yaw) * 0.1, lf.top + BALE.h / 2, seat.z);
  seatBale.rotation.y = seat.yaw + Math.PI / 2;
  seatBale.castShadow = seatBale.receiveShadow = true;
  group.add(seatBale);
  const hayProxy = new THREE.Mesh(new THREE.BoxGeometry(hy.halfX * 2 + 1.2, 1.6, hy.halfZ * 2 + 1.2), new THREE.MeshBasicMaterial({ visible: false }));
  hayProxy.position.set(hy.x, lf.top + 0.8, hy.z);
  group.add(hayProxy);
  // Loose straw on the planks, in clumps: thick against the stacks and the edge of the bales, thinner across the walkway. Plus a few on top of the stacks.
  const clumpGeo = strawClumpGeometry(random, 7);
  const clumps = [];
  for (let i = 0; i < 90; i++) {
    const x = lf.minX + 0.3 + random() * (lw - 0.5);
    const nearStack = random() < 0.6;
    const side = random() < 0.5 ? lf.walkMinZ : lf.walkMaxZ;
    const z = nearStack ? side + (side === lf.walkMinZ ? -1 : 1) * random() * 0.5 : lf.walkMinZ + random() * (lf.walkMaxZ - lf.walkMinZ);
    clumps.push([x, lf.top + 0.006, z]);
  }
  for (const sp of spots) if (sp.k >= 1 && random() < 0.25) clumps.push([sp.x + (random() - 0.5) * 0.5, sp.y + BALE.h / 2 + 0.006, sp.z + (random() - 0.5) * 0.2]);
  const straw = new THREE.InstancedMesh(clumpGeo, strawMat, clumps.length);
  clumps.forEach(([x, y, z], i) => {
    m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * Math.PI * 2), new THREE.Vector3(1, 1, 1));
    straw.setMatrixAt(i, m4);
    straw.setColorAt(i, tint.setHSL(0.12, 0.6, 0.38 + random() * 0.16));
  });
  straw.receiveShadow = true;
  group.add(straw);

  // A bare bulb on a flex from the ridge, which comes on in the gloom.
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c9 }));
  const bulbY = floorY + wallHeight + 0.2;
  add(bulb, shape.x, bulbY, shape.z, { cast: false, receive: false });
  add(box(0.015, 0.9, 0.015, steel), shape.x, bulbY + 0.5, shape.z, { cast: false, receive: false });
  const light = new THREE.PointLight(0xffe2b0, 0, 12, 1.6);
  light.position.set(shape.x, bulbY - 0.15, shape.z);
  group.add(light);
  // And a second over the big bay in the second span, on the same switch.
  let bulb2 = null;
  let light2 = null;
  if (annex) {
    bulb2 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c9 }));
    add(bulb2, layout.bay2.x, bulbY, annex.z, { cast: false, receive: false });
    add(box(0.015, 0.9, 0.015, steel), layout.bay2.x, bulbY + 0.5, annex.z, { cast: false, receive: false });
    light2 = new THREE.PointLight(0xffe2b0, 0, 12, 1.6);
    light2.position.set(layout.bay2.x, bulbY - 0.15, annex.z);
    group.add(light2);
  }

  return { group, light, bulb, light2, bulb2, floorY, shutter, hayDoor: { x: door.x, y: floorY + hd.sill, z: shape.z }, loft: { ...lf, ladderProxy, hayProxy } };
}
