import { describe, it, expect, vi } from 'vitest';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { LAYOUT } from '../src/world/layout.js';
import { headlessContext } from './helpers/worldModels.js';

describe("the barn's hayloft model", () => {
  it('has no two faces on one plane in its floor, rail, ladder or the end wall and hay door round it, which flicker as alpha fighting', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildBarnShed } = await import('../src/world/barnBuild.js');
    const { group, loft, floorY } = buildBarnShed(headlessContext());
    // The loft's box: from its open edge to the end wall, from its floor's underside to the hay door's top (the roof, its ties and its eave ends are the roof's, not the loft's).
    const top = floorY + LAYOUT.loft.hayDoor.top + 0.3;
    const mine = (f) => f.at[0] > loft.edgeX - 0.2 && f.at[0] < loft.maxX + 0.5 && f.at[1] > loft.top - 0.5 && f.at[1] < top && f.at[2] > loft.minZ && f.at[2] < loft.maxZ;
    const fights = coplanarOverlaps(group, { gap: 0.003, minArea: 2e-5, textured: true }).filter(mine);
    expect(fights.map((f) => `${'xyz'[f.axis]}${f.dir > 0 ? '+' : '-'} at ${f.at.map((v) => v.toFixed(2))} area ${f.area.toFixed(4)}`)).toEqual([]);
  });
});
