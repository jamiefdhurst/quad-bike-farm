import { describe, it, expect, vi } from 'vitest';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';

describe('the shed catalogue model', () => {
  it('has no two faces on one plane, which flicker as alpha fighting (the printed cover is textured and sits off the card on purpose, so the check leaves it out)', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildCatalogue } = await import('../src/workshop/shedModels.js');
    const fights = coplanarOverlaps(buildCatalogue().group, { gap: 0.003, minArea: 2e-5 });
    expect(fights.map((f) => `${f.a} ${'xyz'[f.axis]}${f.dir > 0 ? '+' : '-'} at ${f.at.map((v) => v.toFixed(3))} area ${f.area.toFixed(4)}`)).toEqual([]);
  });

  it('has the printed cover standing clear of the card by at least a millimetre', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildCatalogue } = await import('../src/workshop/shedModels.js');
    const book = buildCatalogue().group.children[0];
    const printed = book.children.find((m) => m.geometry.type === 'PlaneGeometry');
    const frontCard = book.children.find((m) => m.geometry.type === 'BoxGeometry' && m.geometry.parameters.width === 0.215 && m.position.z > 0);
    expect(printed.position.z - (frontCard.position.z + frontCard.geometry.parameters.depth / 2)).toBeGreaterThanOrEqual(0.001);
  });
});
