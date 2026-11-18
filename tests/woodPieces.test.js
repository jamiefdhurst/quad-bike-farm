import { describe, it, expect, vi } from 'vitest';
import { fakeCanvas } from './helpers/vehicleModels.js';

// The rounds' bark (#985): the pale bark is lighter than the dark, in the painted materials and in the flat fallback.
describe('a round\'s bark', () => {
  it('has a pale kind that is lighter than the dark kind', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildRound } = await import('../src/items/woodPieces.js');
    const dark = buildRound(() => 0.1).children[0].material;
    const pale = buildRound(() => 0.9).children[0].material;
    expect(dark).not.toBe(pale);
    const l = (m) => m.color.r + m.color.g + m.color.b;
    expect(l(pale)).toBeGreaterThan(l(dark));
    expect(pale.map).toBe(dark.map);
  });
});
