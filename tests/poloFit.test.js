import { describe, it, expect, beforeAll } from 'vitest';
import { buildAllGirls } from './helpers/girlModels.js';
import { buildTop, logoThread, LOGO_THREADS, POLO } from '../src/npc/polo.js';

// The polo on each girl (#572): its placket ending a little past her bust, and the logo stitched in a colour that stands out.

const hex = (h) => [0, 2, 4].map((k) => parseInt(h.slice(1 + k, 3 + k), 16) / 255);

describe("the polo's logo", () => {
  it('is embroidered in a coloured thread that stands out from the shirt', () => {
    expect(logoThread(hex('#d9661f'))).toBe('#22335e'); // navy on orange
    expect(logoThread(hex('#a3161f'))).toBe('#d1a93a'); // gold on red
    expect(logoThread(hex('#26365e'))).toBe('#d1a93a'); // gold on navy
    for (const shirt of ['#c9a227', '#3a5690', '#2e4a3a', '#ffffff', '#202020']) {
      const thread = logoThread(hex(shirt));
      expect(LOGO_THREADS).toContain(thread);
      expect(thread).not.toBe(shirt);
    }
  });
});

describe('the polo on each girl', () => {
  // Built straight on her body as the game builds it, every triangle counted as cloth (the stand-in texture here has no paint).
  let girls;
  beforeAll(async () => {
    const { bodyData, bodyMesh } = await import('../src/npc/outfit.js');
    girls = (await buildAllGirls()).map(({ id, rig }) => {
      const data = { ...bodyData(rig, bodyMesh(rig)), paint: () => 'skin' };
      return { id, data, ...buildTop(data, POLO) };
    });
  }, 60000);

  // Her front, as she stands: the furthest forward each set of points reaches in 1 cm bands below her neck bone, across the
  // middle of either breast.
  const front = (data, verts) => {
    const neck = data.bones.Neck;
    const bands = new Map();
    for (const { rest: [x, y, z] } of verts) {
      const dx = Math.abs(x - neck[0]);
      if (dx < 0.03 || dx > 0.09 || z < neck[2]) continue;
      const k = Math.round((neck[1] - y) * 100);
      bands.set(k, Math.max(bands.get(k) ?? -Infinity, z));
    }
    return bands;
  };
  const fullest = (bands) => [...bands.entries()].filter(([k]) => k >= 8 && k <= 20).reduce((a, b) => (b[1] > a[1] ? b : a));

  it('ends its placket a little past her bust', () => {
    for (const { id, data, placket } of girls) {
      const skin = front(data, data.verts);
      // The bottom of her bust: the lowest band under its fullest point where her body still stands well forward of her chest.
      const chest = Math.min(...[...skin.entries()].filter(([k]) => k >= 24 && k <= 30).map(([, z]) => z));
      const [tipBand, tip] = fullest(skin);
      const bust = Math.max(...[...skin.entries()].filter(([k, z]) => k >= tipBand && k <= 28 && z > (tip + chest) / 2).map(([k]) => k));
      const below = (data.bones.Neck[1] - Math.min(...placket.verts.map((v) => v.rest[1]))) * 100;
      expect(below, id).toBeGreaterThan(bust);
      expect(below, id).toBeLessThan(bust + 5);
    }
  });
});
