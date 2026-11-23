import { describe, it, expect, beforeAll } from 'vitest';
import { buildAllGirls } from './helpers/girlModels.js';
import { buildTop, buildInset, logoThread, LOGO_THREADS, POLO } from '../src/npc/polo.js';
import { applySkinDir, vec } from '../src/npc/garmentMesh.js';

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
  // middle of either breast (measured from her front's middle, which her pose carries off her neck's line).
  const front = (data, verts) => {
    const neck = data.bones.Neck;
    const bands = new Map();
    for (const { rest: [x, y, z] } of verts) {
      const dx = Math.abs(x - data.middle(y));
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

  it('lays the skin in an open V with nothing turned inside out, however far it is undone', () => {
    // Each piece faces the way her skin under it does (#1134): lifted along the normal at each corner, thin pieces across her creases
    // turned over, 12 to 78 of them on Jess. Where cuts run a hair apart a sliver can stand on edge; it is under 0.1 mm across.
    for (const { id, data } of girls) {
      for (let open = 1; open <= POLO.buttons.length; open++) {
        const p = { ...POLO, open };
        const { vee } = buildTop(data, p);
        if (!vee) continue;
        const inset = buildInset(data, vee, p);
        for (const t of inset.tris) {
          const [a, b, c] = t.map((i) => inset.verts[i].rest);
          const n = vec.cross(vec.sub(b, a), vec.sub(c, a));
          const skin = t.map((i) => applySkinDir(inset.verts[i].skin, inset.verts[i].normal)).reduce((s, x) => vec.add(s, x), [0, 0, 0]);
          const facing = vec.dot(vec.norm(n), vec.norm(skin));
          expect(facing, `${id}, ${open} undone`).toBeGreaterThan(-0.5);
          if (facing < 0) {
            const longest = Math.max(...[[a, b], [b, c], [c, a]].map(([u, w]) => Math.hypot(...vec.sub(u, w))));
            expect(Math.hypot(...n) / longest, `${id}, ${open} undone: a piece facing away is a hairline`).toBeLessThan(0.0001);
          }
        }
        expect(inset.tris.length, `${id}, ${open} undone`).toBeGreaterThan(100);
      }
    }
  });

  it('runs its placket down the middle of her front, not straight down from her neck', () => {
    // She stands turned a little, so at her bust her middle is about 3 cm to her left of her neck (#1134).
    for (const { id, data, placket } of girls) {
      const neck = data.bones.Neck;
      const y = neck[1] - 0.14; // across her bust
      const row = placket.verts.filter((v) => Math.abs(v.rest[1] - y) < 0.004 && v.rest[2] > neck[2]);
      const xs = row.map((v) => v.rest[0]);
      const centre = (Math.min(...xs) + Math.max(...xs)) / 2;
      expect(Math.abs(data.middle(y) - neck[0]), id).toBeGreaterThan(0.015);
      expect(Math.abs(centre - data.middle(y)), id).toBeLessThan(0.006);
    }
  });
});
