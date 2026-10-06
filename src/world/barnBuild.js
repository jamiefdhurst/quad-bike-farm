import * as THREE from 'three';
import { barnShape, wallBoxes } from './barn.js';
import { loftShape } from './loft.js';

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
    // None over the loft: you stand there with your head at their height. (Its edge beam does their job.)
    if (x > layout.loft.edgeX - 0.3) {
      addRafters(x);
      continue;
    }
    add(box(0.16, 0.22, sizeZ - wall * 2, timber), x, floorY + wallHeight - 0.15, shape.z);
    addRafters(x);
  }
  function addRafters(x) {
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
  // The bay for working on a quad, painted on the floor in front of the bench.
  const bay = layout.bay;
  // The floor is pulled towards the camera by a polygon offset of -2, so the paint needs a bigger one or the floor hides it from a distance.
  const paint = new THREE.MeshStandardMaterial({ color: 0xd9b82a, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  for (const [w, d, x, z] of [[bay.halfX * 2, 0.08, 0, -bay.halfZ], [bay.halfX * 2, 0.08, 0, bay.halfZ], [0.08, bay.halfZ * 2, -bay.halfX, 0], [0.08, bay.halfZ * 2, bay.halfX, 0]]) {
    add(box(w, 0.012, d, paint), bay.x + x, floorY + 0.016, bay.z + z, { cast: false });
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
  add(box(lw, 0.1, ld, plankMat), lx, lf.top - 0.05, lz);
  fixedBox(lx, lf.top - 0.06, lz, lw / 2, 0.06, ld / 2);
  for (let z = lf.minZ + 0.6; z < lf.maxZ; z += 1.2) add(box(lw, 0.18, 0.1, timber), lx, lf.top - 0.19, z, { cast: false });
  add(box(0.14, 0.26, ld, timber), lf.edgeX + 0.07, lf.top - 0.23, lz); // the beam under the open edge
  for (const z of [lf.minZ + 0.1, lz, lf.maxZ - 0.1]) add(box(0.14, l.floor - 0.1, 0.14, timber), lf.edgeX + 0.1, floorY + (l.floor - 0.1) / 2, z); // and its posts
  // Rail: two rails and posts in each span, each with a collider you can't climb over.
  for (const span of lf.railSpans) {
    const len = span.z1 - span.z0;
    if (len < 0.05) continue;
    const cz = (span.z0 + span.z1) / 2;
    add(box(0.07, 0.07, len, timber), lf.edgeX + 0.04, lf.top + l.rail, cz, { cast: false });
    add(box(0.05, 0.05, len, timber), lf.edgeX + 0.04, lf.top + l.rail * 0.5, cz, { cast: false });
    for (const z of [span.z0 + 0.05, span.z1 - 0.05]) add(box(0.07, l.rail, 0.07, timber), lf.edgeX + 0.04, lf.top + l.rail / 2, z, { cast: false });
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

  // Hay: a stack down each side of the walkable band (the north one is the one you hide in), each a base with loose heaps on top and a
  // tall collider, and the bale a girl sits on at the edge.
  const hayA = new THREE.MeshStandardMaterial({ color: 0xc9a54a, roughness: 1 });
  const hayB = new THREE.MeshStandardMaterial({ color: 0xb08d3a, roughness: 1 });
  const hy = l.hay;
  const stacks = [
    { x: hy.x, z: hy.z, hx: hy.halfX, hz: hy.halfZ },
    { x: hy.x, z: (lf.walkMaxZ + lf.maxZ) / 2, hx: hy.halfX, hz: (lf.maxZ - lf.walkMaxZ) / 2 },
  ];
  for (const st of stacks) {
    add(box(st.hx * 2 - 0.1, 0.8, st.hz * 2 - 0.1, hayB), st.x, lf.top + 0.4, st.z);
    for (let i = 0; i < 9; i++) {
      const w = 0.7 + random() * 0.6;
      const hgt = 0.3 + random() * 0.3;
      const x = st.x + (random() - 0.5) * (st.hx * 2 - w);
      const z = st.z + (random() - 0.5) * (st.hz * 2 - w);
      add(box(w, hgt, w * (0.8 + random() * 0.5), i % 2 ? hayA : hayB), x, lf.top + 0.8 + hgt / 2 - 0.05 + (i % 3) * 0.1, z).rotation.y = (random() - 0.5) * 0.6;
    }
    fixedBox(st.x, lf.top + 1.1, st.z, st.hx, 1.1, st.hz); // taller than the hay: the roof is too low to walk there
  }
  const seat = l.seat;
  add(box(1.2, 0.46, 0.55, hayA), seat.x - Math.sin(seat.yaw) * 0.1, lf.top + 0.23, seat.z).rotation.y = seat.yaw + Math.PI / 2;
  const hayProxy = new THREE.Mesh(new THREE.BoxGeometry(hy.halfX * 2 + 1.2, 1.6, hy.halfZ * 2 + 1.2), new THREE.MeshBasicMaterial({ visible: false }));
  hayProxy.position.set(hy.x, lf.top + 0.8, hy.z);
  group.add(hayProxy);
  // A loose scatter of straw on the planks.
  for (let i = 0; i < 22; i++) {
    const x = lf.minX + 0.4 + random() * (lw - 0.8);
    const z = lf.walkMinZ + random() * (lf.walkMaxZ - lf.walkMinZ);
    add(box(0.4 + random() * 0.4, 0.015, 0.05, hayB), x, lf.top + 0.01, z, { cast: false }).rotation.y = random() * 3;
  }

  // A bare bulb on a flex from the ridge, which comes on in the gloom.
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c9 }));
  const bulbY = floorY + wallHeight + 0.2;
  add(bulb, shape.x, bulbY, shape.z, { cast: false, receive: false });
  add(box(0.015, 0.9, 0.015, steel), shape.x, bulbY + 0.5, shape.z, { cast: false, receive: false });
  const light = new THREE.PointLight(0xffe2b0, 0, 12, 1.6);
  light.position.set(shape.x, bulbY - 0.15, shape.z);
  group.add(light);

  return { group, light, bulb, floorY, loft: { ...lf, ladderProxy, hayProxy } };
}
