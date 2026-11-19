// Upper Thornby (#686), the hamlet the footpath off Back Lane climbs to: seen from the lane as a far cluster of grey stone roofs on the hill to the west with a
// church tower, and never reached (the Moor's ladder stile turns you round, #713). Only a far version is built: boxes with gabled roofs in flat colours, one
// mesh, the way farVersion.js draws the village far away. `upperThornbyShapes` is the pure layout; `buildUpperThornby` the group.

import { buildFarVersion } from './farVersion.js';

const STONE = 0x8a8478; // gritstone walls
const SLATE = 0x4a4f55; // slate roofs
const LIGHT = 0xa39d8f; // limewashed
const TILE = 0x6b4a3c; // a clay-tiled roof or two

/**
 * The hamlet about `at` ([x, z], game metres): a church with a square tower at the east end, eleven houses and barns along a lane and round a green, each as
 * an offset from `at` with its size, and the field walls that run up the hill behind it. The ridge runs along x.
 */
export function upperThornbyShapes(at, groundAt) {
  const [ax, az] = at;
  const homes = [
    // dx, dz, halfX, halfZ, wallHeight, ridge, wall, roof
    [-30, -22, 6, 3.6, 4.6, 7, STONE, SLATE], [-14, -26, 5, 3.4, 4.4, 6.6, LIGHT, SLATE], [4, -24, 7, 3.8, 4.8, 7.4, STONE, SLATE],
    [-34, -6, 5, 3.2, 4.2, 6.4, STONE, TILE], [-18, 0, 4.5, 3, 3.8, 5.8, LIGHT, SLATE], [14, -4, 6, 3.6, 4.4, 6.8, STONE, SLATE],
    [-30, 16, 8, 4, 5.4, 8, STONE, SLATE], [-8, 20, 5.5, 3.4, 4.4, 6.6, LIGHT, TILE], [10, 18, 5, 3.6, 4.6, 7, STONE, SLATE],
    [26, 14, 6.5, 3.8, 4.4, 6.8, STONE, SLATE], [-52, 6, 7, 4.2, 3.6, 6, STONE, SLATE], // the last a long barn
  ];
  const buildings = homes.map(([dx, dz, halfX, halfZ, wallHeight, ridge, wall, roof]) => ({
    x: ax + dx, z: az + dz, y: lowest(groundAt, ax + dx, az + dz, halfX, halfZ), halfX, halfZ, wallHeight, ridge, wall, roof,
  }));
  // The church: a nave 22 m by 9 with a tower 5.5 m square and 17 m to its top at the west end, a low vestry on the north.
  const church = [ax + 40, az - 2];
  buildings.push(
    { x: church[0], z: church[1], y: lowest(groundAt, church[0], church[1], 11, 4.5), halfX: 11, halfZ: 4.5, wallHeight: 6.2, ridge: 9.4, wall: STONE, roof: SLATE },
    { x: church[0] - 13.5, z: church[1], y: lowest(groundAt, church[0] - 13.5, church[1], 2.8, 2.8), halfX: 2.8, halfZ: 2.8, wallHeight: 15, ridge: 17.2, wall: STONE, roof: SLATE },
    { x: church[0] + 2, z: church[1] - 6, y: lowest(groundAt, church[0] + 2, church[1] - 6, 3.2, 2), halfX: 3.2, halfZ: 2, wallHeight: 3.4, ridge: 5, wall: STONE, roof: SLATE },
  );
  const walls = [];
  for (let k = 0; k < 7; k++) walls.push({ x: ax - 20 + k * 11, z: az - 52 - k * 3, hx: 5.5, hz: 0.3, y: groundAt(ax - 20 + k * 11, az - 52 - k * 3), height: 1.3, color: STONE });
  for (let k = 0; k < 6; k++) walls.push({ x: ax - 60 + k * 2, z: az - 40 + k * 14, hx: 0.3, hz: 7, y: groundAt(ax - 60 + k * 2, az - 40 + k * 14), height: 1.3, color: STONE });
  // Chimney stacks at the gable ends of every house, standing on the ridge; pinnacles on the tower, buttresses down the church's south wall, its porch and
  // churchyard wall, and a few yews, as little boxes, so the far outline has what a hamlet's has.
  for (const b of buildings.slice(0, homes.length)) {
    for (const side of [-1, 1]) walls.push({ x: b.x + side * (b.halfX - 0.8), z: b.z, hx: 0.45, hz: 0.45, y: b.y + b.ridge - 1.4, height: 2.2, color: STONE });
  }
  const tower = buildings[homes.length + 1];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) walls.push({ x: tower.x + sx * (tower.halfX - 0.3), z: tower.z + sz * (tower.halfZ - 0.3), hx: 0.3, hz: 0.3, y: tower.y + tower.wallHeight, height: 1.6, color: STONE });
  const nave = buildings[homes.length];
  for (let k = 0; k < 4; k++) walls.push({ x: nave.x - 7 + k * 5, z: nave.z + nave.halfZ + 0.3, hx: 0.4, hz: 0.35, y: nave.y, height: 4.4, color: STONE });
  walls.push({ x: nave.x, z: nave.z + nave.halfZ + 1.4, hx: 1.6, hz: 1.4, y: nave.y, height: 3.3, color: STONE }); // the porch
  for (const [dx, dz, hx, hz] of [[0, 14, 26, 0.35], [0, -13, 26, 0.35], [-26, 0, 0.35, 13.5], [26, 0, 0.35, 13.5]]) walls.push({ x: nave.x + dx, z: nave.z + dz, hx, hz, y: groundAt(nave.x + dx, nave.z + dz), height: 1.1, color: STONE });
  for (const [dx, dz, r, h] of [[-10, 9, 1.4, 6], [8, 10, 1.2, 5], [14, -9, 1.3, 5.5], [-18, -9, 1.1, 4.6]]) {
    walls.push({ x: nave.x + dx, z: nave.z + dz, hx: r, hz: r, y: groundAt(nave.x + dx, nave.z + dz), height: h, color: 0x2f4a32 }); // a yew
  }
  return { buildings, walls };
}

/** The lowest ground under a footprint's corners and middle, so the house stands on its downhill side's ground and sinks into the uphill's. */
function lowest(groundAt, x, z, hx, hz) {
  return Math.min(groundAt(x, z), groundAt(x - hx, z - hz), groundAt(x + hx, z - hz), groundAt(x - hx, z + hz), groundAt(x + hx, z + hz));
}

/** Builds the hamlet's far version at the layout's `upperThornby`, in the scene. Null on a farm without it. */
export function buildUpperThornby({ scene, layout, heights }) {
  const at = layout.upperThornby?.at;
  if (!at) return null;
  const { buildings, walls } = upperThornbyShapes(at, (x, z) => heights.heightAt(x, z));
  // Two meshes: the buildings, and what stands about them (chimneys, pinnacles, walls, yews), as the village's far version keeps its fixtures apart.
  const group = buildFarVersion('upperThornby', { buildings });
  group.add(...buildFarVersion('upperThornbyWalls', { walls }).children);
  scene.add(group);
  return group;
}
