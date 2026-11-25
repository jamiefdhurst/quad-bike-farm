import { describe, it, expect } from 'vitest';
import { figureOffset } from '../src/npc/figure.js';

// Roughly where the shipped model's left bust apex sits, in body-frame units.
const APEX = { x: 0.11, y: 0.725, z: 0.35 };
const FULL = { bust: 1, waist: 1, hips: 1 };

function grid(fn) {
  for (let x = -0.5; x <= 0.5; x += 0.05) {
    for (let y = -0.6; y <= 1.3; y += 0.05) {
      for (let z = -0.3; z <= 0.5; z += 0.05) fn(x, y, z);
    }
  }
}

describe('figure', () => {
  it('leaves the body alone at zero', () => {
    grid((x, y, z) => expect(figureOffset(x, y, z, APEX, { bust: 0, waist: 0, hips: 0 })).toEqual([0, 0, 0]));
  });

  it('is symmetric left to right', () => {
    grid((x, y, z) => {
      const [lx, ly, lz] = figureOffset(x, y, z, APEX, FULL);
      const [rx, ry, rz] = figureOffset(-x, y, z, APEX, FULL);
      expect(rx).toBeCloseTo(-lx, 9);
      expect(ry).toBeCloseTo(ly, 9);
      expect(rz).toBeCloseTo(lz, 9);
    });
  });

  it('does not touch the head or the legs below the hips', () => {
    for (const y of [1.1, 1.3, -0.5, -1.5]) {
      expect(figureOffset(0.1, y, 0.1, APEX, FULL)).toEqual([0, 0, 0]);
    }
  });

  it('pushes the bust forward, pulls the waist in and widens the hips', () => {
    expect(figureOffset(APEX.x, APEX.y, APEX.z, APEX, FULL)[2]).toBeGreaterThan(0.05);
    expect(figureOffset(0.28, 0.37, 0.05, APEX, FULL)[0]).toBeLessThan(0);
    expect(figureOffset(0.35, -0.15, 0.05, APEX, FULL)[0]).toBeGreaterThan(0);
  });

  it('has no jumps, so the mesh never tears', () => {
    // A tiny move never shifts the offset by more than a few times as much.
    const step = 0.0005;
    grid((x, y, z) => {
      const a = figureOffset(x, y, z, APEX, FULL);
      for (const [ex, ey, ez] of [
        [step, 0, 0],
        [0, step, 0],
        [0, 0, step],
      ]) {
        const b = figureOffset(x + ex, y + ey, z + ez, APEX, FULL);
        for (let k = 0; k < 3; k++) expect(Math.abs(b[k] - a[k])).toBeLessThan(step * 4);
      }
    });
  });
});

describe('a bigger bust', () => {
  it('covers more of her, wider and deeper, as well as standing out further', () => {
    const at = (bust, x, y, z) => figureOffset(x, y, z, APEX, { bust, waist: 0, hips: 0 });
    // Out at her side, past where a smaller one reaches, a bigger one still moves her.
    const side = [APEX.x + 0.2, APEX.y, 0.2];
    expect(at(1, ...side)).toEqual([0, 0, 0]);
    expect(Math.hypot(...at(1.5, ...side))).toBeGreaterThan(0.001);
    // At the apex it stands out further than in proportion to the amount.
    expect(at(1.5, APEX.x, APEX.y, APEX.z)[2]).toBeGreaterThan(1.5 * at(1, APEX.x, APEX.y, APEX.z)[2]);
  });

  it('is fuller underneath than above, and a bigger one reaches further down', () => {
    const at = (bust, y) => figureOffset(APEX.x, y, APEX.z, APEX, { bust, waist: 0, hips: 0 })[2];
    // The same distance below the apex as above, it stands out further.
    expect(at(1, APEX.y - 0.1)).toBeGreaterThan(at(1, APEX.y + 0.1));
    // Low down, a bigger bust still stands out more than in proportion (its height grows with it).
    const low = APEX.y - 0.17;
    expect(at(1.4, low)).toBeGreaterThan(1.4 * at(1, low));
  });
});

describe('her seat', () => {
  it('turns a flat plate with a shelf under it into round cheeks, and leaves her front alone', async () => {
    const { roundSeat } = await import('../src/npc/figure.js');
    // A block bottom: flat at -0.3 from y 0 down to -0.25, then straight in to -0.1 below it, at a few points across her.
    const pts = [];
    for (const x of [0, 0.13, 0.25]) for (let y = 0.15; y >= -0.45; y -= 0.025) pts.push({ x, y, z: y > -0.26 && y < 0.05 ? -0.3 : -0.1 });
    pts.push({ x: 0.1, y: -0.1, z: 0.3 }); // her front
    const out = roundSeat(pts);
    const at = (x, y) => out[pts.findIndex((q) => q.x === x && Math.abs(q.y - y) < 1e-9)];
    // The plate's bottom edge (the shelf) comes in, so the step under it is smaller and it curves under.
    expect(at(0, -0.25)).toBeGreaterThan(-0.3 + 0.03);
    // Up the plate she stays as full (never further out than she was at her fullest), and just above it she's rounded out.
    expect(at(0.13, -0.1)).toBeLessThan(-0.29);
    expect(at(0.13, 0.075)).toBeLessThan(-0.15);
    // Below the shelf her thighs are left alone.
    expect(at(0.13, -0.4)).toBe(-0.1);
    expect(out[out.length - 1]).toBe(0.3);
  });
});

describe('two breasts, not one', () => {
  it('stands her middle out less than either apex, so there is a dip between them', () => {
    // The model is nearly as far forward down her middle as at the apexes; pushed out alike, the two read as one shape (#1134).
    for (const bust of [1, 1.4]) {
      const forward = (x, z) => z + figureOffset(x, APEX.y, z, APEX, { bust, waist: 0, hips: 0 })[2];
      const apex = forward(APEX.x, APEX.z);
      const middle = forward(0, APEX.z - 0.015);
      expect(apex - middle).toBeGreaterThan(0.06 * bust);
    }
  });

  it('moves her middle only in depth, so the two sides never cross', () => {
    for (const z of [0.2, 0.3, 0.35]) {
      const [dx, dy] = figureOffset(0, APEX.y, z, APEX, { bust: 1.4, waist: 0, hips: 0 });
      expect(dx).toBe(0);
      expect(Math.abs(dy)).toBeLessThan(0.05);
    }
  });
});

describe('the drawn bust (#1143)', () => {
  it('turns no triangle on her chest into her, on either girl', async () => {
    const { buildAllGirls } = await import('./helpers/girlModels.js');
    const { bodyMesh } = await import('../src/npc/outfit.js');
    const { bodyFrame } = await import('../src/npc/figure.js');
    const { bodyFacingIn } = await import('../src/npc/facing.js');
    for (const { id, rig } of await buildAllGirls()) {
      const body = bodyMesh(rig);
      const g = body.geometry;
      const idx = g.index.array;
      const pos = g.attributes.position.array;
      const flat = new Float32Array(idx.length * 3);
      for (let k = 0; k < idx.length; k++) for (let j = 0; j < 3; j++) flat[k * 3 + j] = pos[idx[k] * 3 + j];
      expect(bodyFacingIn(bodyFrame(body).toBody(flat)), id).toEqual([]);
    }
  }, 60000);

  it('catches a fold: a piece turned over between its neighbours', async () => {
    const { bodyFacingIn } = await import('../src/npc/facing.js');
    // A strip of her front facing forward, with one piece in its middle turned over (wound the other way) between its neighbours.
    const sheet = [];
    const quad = (x, flip) => {
      const a = [x, 0.6, 0.3], b = [x + 0.05, 0.6, 0.3], c = [x + 0.05, 0.65, 0.3], d = [x, 0.65, 0.3];
      sheet.push(...(flip ? [a, c, b] : [a, b, c]).flat(), ...[a, c, d].flat());
    };
    quad(-0.1, false);
    quad(-0.05, false);
    quad(0, false);
    expect(bodyFacingIn(Float32Array.from(sheet))).toEqual([]);
    sheet.length = 0;
    quad(-0.1, false);
    quad(-0.05, true);
    quad(0, false);
    expect(bodyFacingIn(Float32Array.from(sheet)).length).toBeGreaterThan(0);
  });
});

describe('the written target (bustShape.js)', () => {
  it("hangs: its fullest point below the middle of its height, at about mid upper arm", async () => {
    const { bustPoint, bustOutline } = await import('../src/npc/bustShape.js');
    for (const size of [1, 1.4]) {
      const o = bustOutline(size);
      let full = null;
      let top = -Infinity;
      let low = Infinity;
      for (let v = -1; v <= 1.0001; v += 0.01) {
        const q = bustPoint(0, v, size, undefined, o);
        top = Math.max(top, q.y);
        low = Math.min(low, q.y);
        if (!full || q.h > full.h) full = q;
      }
      expect(full.y, `size ${size}`).toBeLessThan((top + low) / 2);
      expect(full.y, `size ${size}`).toBeGreaterThan(0.58);
      expect(full.y, `size ${size}`).toBeLessThan(0.72);
    }
  });

  it('carries straight on from her chest at the top of its upper slope, so it joins her without an angle', async () => {
    const { bustPoint, chestWall } = await import('../src/npc/bustShape.js');
    for (const size of [1, 1.4]) {
      for (const u of [-0.5, 0, 0.5]) {
        // Her chest just above it slopes forward as her own upper chest does (0.4 to 0.5 forward per unit down at her middle, less
        // towards her sides, where it falls back into the hollow in front of her shoulder), and the bust leaves it at close to that
        // slope over the first couple of per cent of its height, steepening from there.
        const a = bustPoint(u, 0.99, size), b = bustPoint(u, 0.97, size);
        const above = (chestWall(a.xBase, a.yBase + 0.01) - chestWall(a.xBase, a.yBase + 0.03)) / 0.02;
        const leaving = (b.z - a.z) / (a.y - b.y);
        if (u === 0) expect(above, `size ${size}: her chest above, down the middle of her breast`).toBeGreaterThan(0.35);
        expect(Math.abs(leaving - above), `size ${size}, u ${u}`).toBeLessThan(0.3);
      }
    }
  });

  it('is round at its tip, the same every way round', async () => {
    const { bustPoint } = await import('../src/npc/bustShape.js');
    const r = 0.05;
    const hs = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => bustPoint(r * Math.cos((k * Math.PI) / 4), r * Math.sin((k * Math.PI) / 4), 1).h);
    expect(Math.max(...hs) - Math.min(...hs)).toBeLessThan(0.002);
  });

  it("makes Jess's bigger every way and wider from the front", async () => {
    const { bustOutline, bustPoint } = await import('../src/npc/bustShape.js');
    const amy = bustOutline(1), jess = bustOutline(1.4);
    expect(jess.project).toBeGreaterThan(amy.project);
    expect(jess.cx + jess.outer + jess.spill * jess.project).toBeGreaterThan(amy.cx + amy.outer + amy.spill * amy.project);
    expect(jess.down).toBeGreaterThan(amy.down);
    // Seen from the front, her outer side reaches further out.
    const out = (size) => Math.max(...[0.2, 0.4, 0.6, 0.8].map((u) => bustPoint(u, -0.2, size).x));
    expect(out(1.4)).toBeGreaterThan(out(1) + 0.01);
  });
});
