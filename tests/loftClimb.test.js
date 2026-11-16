import { describe, it, expect, vi, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { headlessContext } from './helpers/worldModels.js';
import { PLAYER_CAPSULE } from '../src/player/player.js';
import { climbPoints, pathAt, overLoft } from '../src/world/loft.js';
import { LAYOUT } from '../src/world/layout.js';

// The barn's colliders (the floor planks, rail, walls, hay) in a real Rapier world, and the player's capsule moved along the ladder climb as
// game.js moves you (`moveTo` along `climbPoints`, nothing pushes you out): at no point may the capsule be inside a collider, or you climb
// through the floor. Feet are lifted 2 cm so standing on the planks, which is touching, does not count.
let world;
let barn;

beforeAll(async () => {
  await RAPIER.init();
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  const { buildBarnShed } = await import('../src/world/barnBuild.js');
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const fixedBox = (x, y, z, hx, hy, hz) => world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z));
  barn = buildBarnShed({ ...headlessContext(), fixedBox });
  world.step();
});

const shape = () => new RAPIER.Capsule(PLAYER_CAPSULE.halfHeight, PLAYER_CAPSULE.radius);

/** The positions along the climb where the capsule overlaps a collider: [{ x, y, z }]. */
function clips(points) {
  const hits = [];
  for (let i = 0; i <= 300; i++) {
    const p = pathAt(points, i / 300);
    const hit = world.intersectionWithShape({ x: p.x, y: p.y + 0.02 + PLAYER_CAPSULE.feetToCentre, z: p.z }, { x: 0, y: 0, z: 0, w: 1 }, shape());
    if (hit) hits.push({ x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) });
  }
  return hits;
}

describe('climbing the barn ladder', () => {
  it('goes up from the foot to the planks without the capsule passing through the floor, rail or walls', () => {
    const lf = barn.loft;
    const from = { x: lf.ladderFoot.x - 0.4, y: lf.ladderFoot.y, z: lf.ladderFoot.z };
    const points = climbPoints(lf, from, true);
    expect(clips(points)).toEqual([]);
    const end = points[points.length - 1];
    expect(end.y).toBeCloseTo(lf.top);
    expect(overLoft(LAYOUT, end.x, end.z, 0.2)).toBe(true);
  });

  it('comes down again the same way, from far along the planks to the foot', () => {
    const lf = barn.loft;
    const from = { x: lf.ladderTop.x + 1.2, y: lf.top, z: lf.ladderTop.z };
    const points = climbPoints(lf, from, false);
    expect(clips(points)).toEqual([]);
    const end = points[points.length - 1];
    expect(end.y).toBeCloseTo(lf.ladderFoot.y);
    expect(overLoft(LAYOUT, end.x, end.z)).toBe(false);
  });

  it('would have gone through the floor on the old straight line from the foot to the top, so the test can fail', () => {
    const lf = barn.loft;
    const foot = { x: lf.ladderFoot.x - 0.1, y: lf.ladderFoot.y, z: lf.ladderFoot.z };
    expect(clips([foot, { x: lf.ladderTop.x, y: lf.top, z: lf.ladderTop.z }]).length).toBeGreaterThan(0);
  });
});
