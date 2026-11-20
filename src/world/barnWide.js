// The new barn's shell (#818): one building with its one pair of doors in the long south wall, drawn in the barn's own frame (barnBuild.js hands over the
// helpers it draws with). The doors' wall is an eaves wall: the roof's ridge runs along it, 26 m of tin on steel portal frames, with the board gables at the
// two ends. Walls are cut from one board texture each, so the boards run on across the doors' opening instead of starting again over it.

import * as THREE from 'three';
import { localWallBoxes } from './barn.js';
import { concreteTexture, tinTexture } from './barnTextures.js';
import { buildWideTrim } from './barnTrim.js';

/** The roof's numbers from the shape: the slope's angle, the eaves' height and distance out from the middle (the overhang included) and the slope's length. */
export function roofOf(shape, overhang = 0.35) {
  const rise = shape.ridge - shape.wallHeight;
  const half = (shape.outer.maxX - shape.outer.minX) / 2;
  const slope = Math.atan2(rise, half);
  const eaveX = half + overhang;
  const eaveY = shape.wallHeight - overhang * Math.tan(slope);
  return { rise, half, slope, eaveX, eaveY, overhang, slopeLen: Math.hypot(eaveX, shape.ridge - eaveY) };
}

/**
 * Draws walls, roof, frames, doors and trim into `group`, with the walls' colliders. `c` is what barnBuild.js has: the `shape` and `layout`, `floorY`, `random`,
 * the `group` and its `add` and `box` helpers, `fixedBox`, the `boards` texture maker and the `white`, `timber` and `steel` materials.
 * Returns the roof's numbers and where the lamps hang.
 */
export function buildWideShell(c) {
  const { shape, layout, floorY, random, group, add, box, fixedBox, boards, white, timber, steel } = c;
  const { outer, wall, wallHeight, ridge, door } = shape;
  const sizeX = outer.maxX - outer.minX; // the depth, the roof's span
  const sizeZ = outer.maxZ - outer.minZ; // the doors' wall's length, the roof's length
  const roof = roofOf(shape);
  const boardMat = (side = THREE.FrontSide) => new THREE.MeshStandardMaterial({ map: boards([1 / 2.4, 1 / 2.4]), roughness: 0.85, side });
  const dw = (door.maxZ - door.minZ) / 2;

  // Walls as one extruded outline each, so the boards run on across the whole face (the extrusion's UVs are its own metres). The shape is drawn as (u along the wall, v up).
  const wallMesh = (points, depth, material = boardMat()) => {
    const s = new THREE.Shape();
    points.forEach(([u, v], i) => (i ? s.lineTo(u, v) : s.moveTo(u, v)));
    s.closePath();
    return new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }), material);
  };
  const hz = sizeZ / 2 - wall; // the back and doors' walls run between the side walls
  // The doors' wall, with the doorway cut from its foot.
  const front = add(wallMesh([[-hz, 0], [-dw, 0], [-dw, door.height], [dw, door.height], [dw, 0], [hz, 0], [hz, wallHeight], [-hz, wallHeight]], wall), outer.maxX, floorY, shape.z);
  front.rotation.y = -Math.PI / 2;
  const back = add(wallMesh([[-hz, 0], [hz, 0], [hz, wallHeight], [-hz, wallHeight]], wall), outer.minX + wall, floorY, shape.z);
  back.rotation.y = -Math.PI / 2;
  // The side walls, each with its gable up to the ridge.
  for (const side of [-1, 1]) {
    const gable = wallMesh([[-sizeX / 2, 0], [sizeX / 2, 0], [sizeX / 2, wallHeight], [0, ridge], [-sizeX / 2, wallHeight]], wall);
    add(gable, shape.x, floorY, side < 0 ? outer.minZ : outer.maxZ - wall);
  }
  for (const w of localWallBoxes(layout)) fixedBox(w.x, floorY + wallHeight / 2, w.z, w.hx, wallHeight / 2, w.hz);

  // A concrete plinth round the foot of the boards, standing 3 cm proud, and white corner posts.
  const plinthMat = new THREE.MeshStandardMaterial({ map: concreteTexture(random, [sizeZ / 3, 1]), roughness: 0.95 });
  const plinthH = 0.35;
  for (const side of [-1, 1]) {
    const len = (sizeZ - 0.4) / 2 - dw;
    add(box(0.06, plinthH + 0.03, len, plinthMat), outer.maxX + 0.01, floorY + plinthH / 2 - 0.015, shape.z + side * (dw + len / 2 + 0.05), { cast: false }); // either side of the doorway
  }
  add(box(0.06, plinthH + 0.03, sizeZ - 0.4, plinthMat), outer.minX - 0.01, floorY + plinthH / 2 - 0.015, shape.z, { cast: false }); // (sunk 3 cm, so its foot is not in the walls' plane)
  for (const side of [-1, 1]) add(box(sizeX - 0.4, plinthH + 0.03, 0.06, plinthMat), shape.x, floorY + plinthH / 2 - 0.015, side < 0 ? outer.minZ - 0.01 : outer.maxZ + 0.01, { cast: false });
  for (const [cx, cz] of [[outer.minX, outer.minZ], [outer.minX, outer.maxZ], [outer.maxX, outer.minZ], [outer.maxX, outer.maxZ]]) add(box(0.34, wallHeight + 0.05, 0.34, white), cx, floorY + wallHeight / 2, cz);

  // The doorway: a white frame at each side and a header over it, with the end wall above it up to the eaves.
  for (const side of [-1, 1]) {
    add(box(wall + 0.2, door.height + 0.1, 0.24, white), door.x - wall / 2, floorY + (door.height + 0.1) / 2 - 0.05, shape.z + side * (dw + 0.08)); // sunk 5 cm into the floor
  }
  add(box(wall + 0.22, 0.32, dw * 2 + 0.56, white), door.x - wall / 2, floorY + door.height + 0.12, shape.z); // 4 cm lower than the wall's own lintel
  // A hood over the doors on timber brackets, and the steel rail the leaves hang from along the outside of the wall.
  const hood = box(0.7, 0.05, dw * 2 + 3.4, timber);
  hood.rotation.z = 0.3;
  add(hood, door.x + 0.38, floorY + door.height + 0.75, shape.z, { cast: false });
  for (let i = -3; i <= 3; i++) add(box(0.05, 0.5, 0.06, timber), door.x + 0.12, floorY + door.height + 0.52, shape.z + i * ((dw * 2 + 3) / 6), { cast: false });
  add(box(0.06, 0.1, dw * 2 + 3.2, steel), door.x + 0.22, floorY + door.height + 0.12, shape.z, { cast: false });

  // The big doors, slid right back on the rail along the outside of the wall, one leaf each side.
  const panelW = dw + 0.3;
  const leafMat = new THREE.MeshStandardMaterial({ map: boards([panelW / 2.4, door.height / 2.4]), roughness: 0.85 });
  for (const side of [-1, 1]) {
    const z = shape.z + side * (dw + panelW / 2 - 0.1);
    const leaf = new THREE.Group();
    leaf.add(box(0.06, door.height - 0.1, panelW, leafMat));
    // White battens stacked proud of the boards, each layer at least 2 cm clear of the last: boards, then frame bars, then each brace.
    for (const s of [-1, 1]) {
      const brace = box(0.07, 0.14, Math.hypot(panelW, door.height - 0.4), white);
      brace.rotation.x = s * Math.atan2(door.height - 0.4, panelW);
      brace.position.x = s < 0 ? 0.055 : 0.075;
      leaf.add(brace);
    }
    for (const dy of [0, 1, -1]) {
      const bar = box(0.07, 0.14, panelW + 0.06, white);
      bar.position.set(0.025, dy * (door.height / 2 - 0.15), 0);
      leaf.add(bar);
    }
    // The hangers: two wheeled brackets from the leaf's top bar up to the rail.
    for (const dz of [-1, 1]) {
      const hanger = box(0.05, 0.2, 0.05, steel);
      hanger.position.set(-0.1, door.height / 2 + 0.02, dz * panelW * 0.35);
      leaf.add(hanger);
    }
    leaf.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = o.material !== white && o.material !== steel;
    });
    leaf.position.set(door.x + 0.25, floorY + door.height / 2 + 0.05, z);
    group.add(leaf);
  }

  // Portal frames: a steel column against each side of the barn and a pair of rafters up to the ridge, every 3.25 m along it, with a tie rod across and a purlin line along each slope.
  const frameZs = [];
  for (let z = outer.minZ + 3.25; z < outer.maxZ - 1; z += 3.25) frameZs.push(z);
  const inX = outer.maxX - wall;
  const rafterLen = Math.hypot(roof.half, roof.rise);
  for (const z of frameZs) {
    for (const sx of [-1, 1]) {
      add(box(0.26, wallHeight - 0.1, 0.16, steel), shape.x + sx * (inX - 0.14), floorY + (wallHeight - 0.1) / 2, z, { cast: false });
      const rafter = box(rafterLen, 0.22, sx < 0 ? 0.12 : 0.14, steel); // (a different thickness each side, so their faces at the ridge are not in one plane)
      rafter.rotation.z = -sx * roof.slope;
      add(rafter, shape.x + sx * (roof.half / 2), floorY + wallHeight + roof.rise / 2 - 0.1, z, { cast: false });
      add(box(0.3, 0.3, 0.14, steel), shape.x + sx * (inX - 0.2), floorY + wallHeight - 0.35, z, { cast: false }); // the haunch where they meet
    }
    add(box(sizeX - wall * 2 - 0.3, 0.03, 0.03, steel), shape.x, floorY + wallHeight - 0.5, z, { cast: false }); // the tie rod
  }
  for (const sx of [-1, 1]) {
    for (const t of [0.35, 0.68]) {
      const x = shape.x + sx * roof.half * (1 - t);
      add(box(0.1, 0.14, sizeZ - wall * 2, timber), x, floorY + wallHeight + roof.rise * t - 0.02, shape.z, { cast: false });
    }
    add(box(0.14, 0.16, sizeZ - wall * 2, timber), shape.x + sx * (inX - 0.04), floorY + wallHeight - 0.08, shape.z, { cast: false }); // the wall plate
  }
  add(box(0.18, 0.2, sizeZ - wall * 2, timber), shape.x, floorY + ridge - 0.14, shape.z, { cast: false });

  // The roof: two tin slopes with an overhang, and a ridge cap. The sheets run eave to ridge, so the ribs run across the panel's length.
  const tinMap = tinTexture(random, [(sizeZ + 0.8) / 2, roof.slopeLen / 2]);
  const tin = new THREE.MeshStandardMaterial({ map: tinMap, roughness: 0.55, metalness: 0.5 });
  for (const side of [-1, 1]) {
    const panel = box(sizeZ + 0.8, 0.07, roof.slopeLen, tin);
    panel.rotation.set(0, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
    const holder = new THREE.Group();
    holder.add(panel);
    holder.rotation.z = -side * roof.slope;
    holder.position.set(shape.x + side * roof.eaveX / 2, floorY + (roof.eaveY + ridge) / 2 + 0.04, shape.z);
    holder.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    group.add(holder);
  }
  add(box(0.35, 0.1, sizeZ + 0.8, steel), shape.x, floorY + ridge + 0.07, shape.z, { cast: false });
  // A row of roof lights in the north slope (the one away from the doors, so the yard sees only tin), translucent sheets between the ribs.
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xd9e4d8, roughness: 0.4, transparent: true, opacity: 0.8 });
  for (let i = -2; i <= 2; i++) {
    const pane = box(1.7, 0.03, 1.1, lightMat);
    pane.rotation.set(0, Math.PI / 2, 0);
    const holder = new THREE.Group();
    holder.add(pane);
    holder.rotation.z = roof.slope;
    holder.position.set(shape.x - roof.eaveX * 0.45, floorY + ridge - (ridge - roof.eaveY) * 0.45 + 0.1, shape.z + i * 4.2);
    group.add(holder);
  }

  group.add(buildWideTrim({ shape, floorY, roof, random }));
  return { roof, frameZs };
}
