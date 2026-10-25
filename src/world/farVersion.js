// The cheap far version of a set piece (the village, the neighbour's farm): its buildings as plain boxes with gabled roofs in flat colours, all
// merged into one mesh with no shadows, windows, doors, fixtures or vehicles. FarDetail (farDetail.js) swaps it for the full piece by distance.
// This is the pattern for simplifying other things far away: build the far group with `buildFarVersion`, name it, and hang it on the full group's
// `userData.farVersion`. See docs/decisions/performance.md, "A far version of the village and the neighbour's farm (#400)".

import * as THREE from 'three';

const EAVE = 0.3; // m the roof overhangs the wall at the eaves and the gable
const SINK = 0.3; // m the walls go into the ground, so no gap shows where it isn't quite level

const rgb = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};

/**
 * Triangles for the shapes the far version is made of, as flat arrays: `positions` (x, y, z a vertex) and `colors` (r, g, b a vertex).
 * A building is `{ x, z, y, halfX, halfZ, wallHeight, ridge, wall, roof }` (y the floor's level, the ridge running along x, colours any
 * THREE.Color input); a wall is `{ x, z, hx, hz, y, height, color }`.
 */
export function farTriangles({ buildings = [], walls = [] }) {
  const positions = [];
  const colors = [];
  const tri = (a, b, c, col) => {
    positions.push(...a, ...b, ...c);
    colors.push(...col, ...col, ...col);
  };
  const quad = (a, b, c, d, col) => {
    tri(a, b, c, col);
    tri(a, c, d, col);
  };
  const box = (x0, x1, y0, y1, z0, z1, col) => {
    quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], col);
    quad([x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1], col);
    quad([x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], col);
    quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], col);
    quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], col);
  };
  for (const b of buildings) {
    const wall = rgb(b.wall);
    const roof = rgb(b.roof);
    const x0 = b.x - b.halfX;
    const x1 = b.x + b.halfX;
    const z0 = b.z - b.halfZ;
    const z1 = b.z + b.halfZ;
    const eave = b.y + b.wallHeight;
    const top = b.y + b.ridge;
    box(x0, x1, b.y - SINK, eave, z0, z1, wall);
    // The gable ends, in wall colour, up to the ridge.
    tri([x0, eave, z0], [x0, eave, z1], [x0, top, b.z], wall);
    tri([x1, eave, z1], [x1, eave, z0], [x1, top, b.z], wall);
    // The two slopes, overhanging a little and dropping a little below the eaves at the edge.
    const drop = (EAVE * (top - eave)) / b.halfZ;
    for (const side of [-1, 1]) {
      const ez = b.z + side * (b.halfZ + EAVE);
      quad([x0 - EAVE, eave - drop, ez], [x1 + EAVE, eave - drop, ez], [x1 + EAVE, top, b.z], [x0 - EAVE, top, b.z], roof);
    }
  }
  for (const w of walls) box(w.x - w.hx, w.x + w.hx, w.y - SINK, w.y + w.height, w.z - w.hz, w.z + w.hz, rgb(w.color));
  return { positions, colors };
}

/** A named group holding the far version: one mesh, flat vertex colours, lit like the rest, casting no shadow. */
export function buildFarVersion(name, shapes) {
  const { positions, colors } = farTriangles(shapes);
  const group = new THREE.Group();
  group.name = name;
  if (!positions.length) return group;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh.name = `${name}Mesh`;
  group.add(mesh);
  return group;
}

/**
 * Whether the full version is the one to draw at `distance` (m from the piece's nearest edge): within `full`, and having been the full one
 * already it holds `margin` m further out, so a walker on the line doesn't flicker between the two. A `full` of 0 always draws the full one.
 */
export function drawFull(distance, full, wasFull, margin) {
  if (!(full > 0)) return true;
  return distance < (wasFull ? full + margin : full);
}
