import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { LAYOUT } from '../src/world/layout.js';
import { headlessContext } from './helpers/worldModels.js';
import { pitHoleRect, NO_HOLE } from '../src/workshop/pitHole.js';

const down = new THREE.Vector3(0, -1, 0);
const hitsAt = (root, x, y, z) => new THREE.Raycaster(new THREE.Vector3(x, y, z), down).intersectObject(root, true).map((h) => h.point.y);

describe('the inspection pit (#817)', () => {
  it('is a trench well below the floor, lined and floored, with steps down', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildPit, PIT_DEPTH } = await import('../src/workshop/shedModels.js');
    const { group } = buildPit({ halfX: 1.9, halfZ: 0.45 });
    group.updateMatrixWorld(true);
    expect(PIT_DEPTH).toBeGreaterThanOrEqual(1.2);
    // From the middle of the opening straight down: the first thing is the pit's floor, a metre and a bit below, and nothing is across the opening at floor level.
    const mid = hitsAt(group, 0.4, 2, 0);
    expect(mid[0]).toBeCloseTo(-PIT_DEPTH, 1);
    // From above a tread: a step, higher than the floor and lower than the ground; the top one is no more than a step down.
    const treads = [1.76, 1.48, 1.2, 0.92].map((x) => hitsAt(group, x, 2, 0.1).find((y) => y < 0 && y > -PIT_DEPTH + 0.05));
    expect(treads.every((y) => y !== undefined)).toBe(true);
    for (let i = 1; i < treads.length; i++) expect(treads[i]).toBeLessThan(treads[i - 1] - 0.2);
    expect(treads[0]).toBeGreaterThan(-0.4);
  });

  it('has no two faces on one plane, which flicker as alpha fighting', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildPit } = await import('../src/workshop/shedModels.js');
    const fights = coplanarOverlaps(buildPit().group, { gap: 0.003, minArea: 2e-5, textured: true });
    expect(fights.map((f) => `${f.a} ${'xyz'[f.axis]}${f.dir > 0 ? '+' : '-'} at ${f.at.map((v) => v.toFixed(3))} area ${f.area.toFixed(4)}`)).toEqual([]);
  });

  it('has a cover over the -x end only, so the rest of the opening shows the trench', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildPit } = await import('../src/workshop/shedModels.js');
    const { group } = buildPit({ halfX: 1.9, halfZ: 0.45 });
    group.updateMatrixWorld(true);
    expect(hitsAt(group, -1.3, 2, 0)[0]).toBeGreaterThan(0.02); // on the cover's slats
    expect(hitsAt(group, 1.0, 2, 0.2)[0]).toBeLessThan(0); // looking down into the open part
  });

  it("is cut through the barn's slab, with a plug of the same concrete that fills it while the pit isn't bought", async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildBarnShed } = await import('../src/world/barnBuild.js');
    const ctx = headlessContext();
    const { group, floorY, pitPlug } = buildBarnShed(ctx);
    const { x, z } = LAYOUT.barnLocal.shed.pit;
    group.updateMatrixWorld(true);
    pitPlug.updateMatrixWorld(true);
    const slabTop = floorY + 0.011;
    expect(hitsAt(group, x, floorY + 1, z + 1.5).some((y) => Math.abs(y - slabTop) < 1e-6)).toBe(true); // beside the pit the slab is there
    expect(hitsAt(group, x, floorY + 0.5, z).some((y) => y > floorY - 0.05)).toBe(false); // over the pit it is not
    expect(hitsAt(pitPlug, x, floorY + 0.5, z).some((y) => Math.abs(y - slabTop) < 1e-6)).toBe(true); // the plug is
  });

  it('is cut out of the drawn ground where it stands, on the world axes however the barn is turned', () => {
    const pit = { x: 10, z: 20, halfX: 1.9, halfZ: 0.45, yaw: 0 };
    expect(pitHoleRect(pit, 0)).toEqual([8.1, 19.55, 11.9, 20.45]);
    expect(pitHoleRect({ ...pit, yaw: -Math.PI / 2 }, 0).map((v) => +v.toFixed(2))).toEqual([9.55, 18.1, 10.45, 21.9]);
    expect(pitHoleRect({ ...pit, yaw: Math.PI / 2 }, 0).map((v) => +v.toFixed(2))).toEqual([9.55, 18.1, 10.45, 21.9]);
    expect(pitHoleRect({ ...pit, yaw: Math.PI }, 0).map((v) => +v.toFixed(2))).toEqual([8.1, 19.55, 11.9, 20.45]);
    expect(NO_HOLE[0]).toBeGreaterThan(1e5);
  });

  it('shows the hole when it stands and fills it when it is taken away (ShedView.cutPit)', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas(), body: { appendChild() {} } });
    const { ShedView } = await import('../src/workshop/shedView.js');
    const plug = { visible: true };
    const pitHole = new THREE.Vector4();
    const pit = { x: 5, z: 6, halfX: 1.9, halfZ: 0.45, yaw: 0 };
    const self = { game: { world: { props: { barn: { pitPlug: plug } }, terrain: { pitHole }, layout: { shed: { pit } } } } };
    ShedView.prototype.cutPit.call(self, true);
    expect(plug.visible).toBe(false);
    expect(pitHole.x).toBeLessThan(5 - 1.9);
    expect(pitHole.w).toBeGreaterThan(6.45);
    ShedView.prototype.cutPit.call(self, false);
    expect(plug.visible).toBe(true);
    expect(pitHole.x).toBeGreaterThan(1e5);
  });
});
