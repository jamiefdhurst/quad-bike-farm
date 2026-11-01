import { describe, it, expect } from 'vitest';
import {
  applySkin,
  unskin,
  blendWeights,
  weld,
  subdivide,
  cut,
  openEdges,
  edgeLoops,
  rayHit,
  inTriangle,
  smoothNormals,
  smoothSkinning,
} from '../src/npc/garmentMesh.js';
import { buildTop, buildInset, topFields, dealPoloOpen, POLO, JUMPER } from '../src/npc/polo.js';
import { CHARACTERS } from '../src/npc/characters.js';
import { createRandom } from '../src/core/random.js';
import { buildShorts, SHORTS } from '../src/npc/shorts.js';
import { buildCollar, COLLAR } from '../src/npc/collar.js';

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
// A quarter turn about y with a drop, as her bind pose is to the way she stands.
const TURN = [0, 0, -1, 0.1, 0, 1, 0, -0.02, 1, 0, 0, 0.3];

const vert = (bind, normal = [0, 0, 1], skin = IDENTITY, weights = [[0, 1]]) => ({ bind, rest: applySkin(skin, bind), normal, weights, skin });

/** A flat grid in the xy plane, `n` by `n` squares of side 1/n, as a welded mesh. */
function grid(n) {
  const verts = [];
  const tris = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) verts.push(vert([i / n, j / n, 0], [0, 0, 1], IDENTITY, [[i % 3, 0.6], [5, 0.4]]));
  const at = (i, j) => j * (n + 1) + i;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) tris.push([at(i, j), at(i + 1, j), at(i, j + 1)], [at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]);
  }
  return { verts, tris };
}

describe('garment skin maps', () => {
  it('carries a point to where she stands and back', () => {
    const p = [0.3, 1.1, -0.2];
    const back = unskin(TURN, applySkin(TURN, p));
    back.forEach((c, k) => expect(c).toBeCloseTo(p[k], 9));
  });

  it('blends skin weights into at most four that sum to one', () => {
    const w = blendWeights([[1, 0.5], [2, 0.3], [3, 0.2]], [[4, 0.6], [5, 0.25], [6, 0.15]], 0.5);
    expect(w.length).toBe(4);
    expect(w.reduce((s, [, x]) => s + x, 0)).toBeCloseTo(1, 9);
    expect(w[0][0]).toBe(4);
  });
});

describe('weld and subdivide', () => {
  it('welds the corners a flat-shaded body keeps apart', () => {
    // Two triangles sharing an edge, each with its own copies of the shared corners.
    const verts = [vert([0, 0, 0]), vert([1, 0, 0]), vert([0, 1, 0]), vert([1, 0, 0], [1, 0, 0]), vert([1, 1, 0]), vert([0, 1, 0], [1, 0, 0])];
    const m = weld(verts, [0, 1, 2, 3, 4, 5], () => true);
    expect(m.verts.length).toBe(4);
    const shared = m.verts.find((v) => v.bind[0] === 1 && v.bind[1] === 0);
    expect(shared.normal[0]).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it('splits each triangle in four and rounds the new points out over curved normals', () => {
    const flat = subdivide(grid(1), 0.75);
    expect(flat.tris.length).toBe(8);
    for (const v of flat.verts) expect(v.bind[2]).toBeCloseTo(0, 9);
    // Normals leaning apart, as over a shoulder: the point between bulges out towards them.
    const a = vert([0, 0, 0], [-0.6, 0, 0.8]);
    const b = vert([1, 0, 0], [0.6, 0, 0.8]);
    const c = vert([0.5, 1, 0], [0, 0.6, 0.8]);
    const round = subdivide({ verts: [a, b, c], tris: [[0, 1, 2]] }, 1);
    const mid = round.verts.find((v) => Math.abs(v.bind[0] - 0.5) < 1e-6 && Math.abs(v.bind[1]) < 1e-6);
    expect(mid.bind[2]).toBeGreaterThan(0.05);
  });
});

describe('cutting along a line', () => {
  const field = (v) => v.bind[0] + 0.35 * v.bind[1] - 0.61; // a slanted line through the grid's triangles

  it('keeps only the inside, with the edge exactly on the line and no cracks', () => {
    const m = cut(grid(5), field, 'line');
    for (const v of m.verts.filter((_, i) => m.tris.some((t) => t.includes(i)))) expect(field(v)).toBeLessThan(1e-9);
    const onLine = m.verts.filter((v) => v.edge === 'line');
    expect(onLine.length).toBeGreaterThan(5);
    for (const v of onLine) expect(field(v)).toBeCloseTo(0, 9);
    // Open edges are the grid's own border and the cut, which together make one loop.
    expect(edgeLoops(m).length).toBe(1);
    for (const v of onLine) expect(v.weights.reduce((s, [, w]) => s + w, 0)).toBeCloseTo(1, 9);
  });

  it('with keep both, draws the line in and gives the far side its own copies of the points on it', () => {
    const before = grid(5);
    const m = cut(before, field, 'band', { keep: 'both' });
    expect(m.tris.length).toBeGreaterThan(before.tris.length);
    expect(m.sides.length).toBe(m.tris.length);
    const copies = m.verts.filter((v) => v.outside);
    expect(copies.length).toBe(m.verts.filter((v) => v.edge === 'band' && !v.outside).length);
    m.tris.forEach((t, k) => {
      if (m.sides[k] === 'out') for (const i of t) expect(m.verts[i].edge !== 'band' || m.verts[i].outside).toBe(true);
    });
    // The copies shade as one surface with the originals.
    const normals = smoothNormals(m);
    normals.forEach((n) => expect(n[2]).toBeCloseTo(1, 6));
  });

  it('finds where a ray meets the mesh', () => {
    const m = grid(4);
    const hit = rayHit(m, [0.3, 0.6, 1], [0, 0, -1]);
    expect(hit.t).toBeCloseTo(1, 9);
    const v = inTriangle(m, hit.tri, hit.bary);
    expect(v.bind[0]).toBeCloseTo(0.3, 9);
    expect(v.bind[1]).toBeCloseTo(0.6, 9);
    expect(rayHit(m, [2, 2, 1], [0, 0, -1])).toBe(null);
    expect(openEdges(m).length).toBe(16);
  });
});

/**
 * A stand-in body: an upright cylinder for her torso (bone 0, Spine2) from the hips to above her neck, and nothing else, stored
 * turned a quarter round as her real body is (`TURN`), so a mistake between the stored and standing frames shows.
 */
function cylinderBody() {
  const bones = {
    Neck: [0, 1.2, 0],
    Spine: [0, 0.88, 0],
    Hips: [0, 0.8, 0],
    LeftArm: [0.4, 1.17, 0],
    LeftForeArm: [0.42, 0.97, 0],
    LeftHand: [0.44, 0.8, 0],
    RightArm: [-0.4, 1.17, 0],
    RightForeArm: [-0.42, 0.97, 0],
    RightHand: [-0.44, 0.8, 0],
    LeftUpLeg: [0.3, 0.75, 0],
    LeftLeg: [0.3, 0.4, 0],
    RightUpLeg: [-0.3, 0.75, 0],
    RightLeg: [-0.3, 0.4, 0],
  };
  const boneNames = ['Spine2', 'LeftArm', 'RightArm', 'LeftUpLeg', 'RightUpLeg'];
  const segs = 24;
  const rows = [];
  for (let y = 0.7; y <= 1.3001; y += 0.03) rows.push(y);
  const verts = [];
  const index = [];
  rows.forEach((y) => {
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const rest = [0.12 * Math.sin(a), y, 0.12 * Math.cos(a)];
      const bind = unskin(TURN, rest);
      const normal = unskin([...TURN.slice(0, 3), 0, ...TURN.slice(4, 7), 0, ...TURN.slice(8, 11), 0], [Math.sin(a), 0, Math.cos(a)]);
      verts.push({ bind, rest, normal, weights: [[0, 1]], skin: TURN });
    }
  });
  for (let r = 0; r < rows.length - 1; r++) {
    for (let s = 0; s < segs; s++) {
      const a = r * segs + s;
      const b = r * segs + ((s + 1) % segs);
      index.push(a, b, a + segs, b, b + segs, a + segs);
    }
  }
  const waist = bones.Spine[1] - 0.012;
  return { verts, index, boneNames, bones, paint: () => 'shirt', waist };
}

describe('knitted tops', () => {
  it('cuts the polo round the neck and at a tucked hem, measured as she stands', () => {
    const body = cylinderBody();
    const { shell, placket } = buildTop(body, POLO);
    const F = topFields(body, POLO);
    const neck = shell.verts.filter((v) => v.edge === 'neck' && !v.apart);
    const hem = shell.verts.filter((v) => v.edge === 'hem' && !v.apart);
    expect(neck.length).toBeGreaterThan(20);
    expect(hem.length).toBeGreaterThan(20);
    // On a straight cylinder the neck line is the cap above her neck bone, all the way round.
    for (const v of neck) expect(v.rest[1]).toBeCloseTo(body.bones.Neck[1] + POLO.neckCap, 3);
    for (const v of hem) expect(v.rest[1]).toBeCloseTo(body.waist - POLO.hemDrop, 3);
    // Everything stands off the body, and nothing is above the neck line.
    for (const v of shell.verts.filter((q) => !q.apart)) {
      expect(Math.hypot(v.rest[0], v.rest[2])).toBeGreaterThan(0.12);
      expect(F.neckField({ ...v, rest: [v.rest[0] * 0.12 / Math.hypot(v.rest[0], v.rest[2]), v.rest[1], v.rest[2] * 0.12 / Math.hypot(v.rest[0], v.rest[2])] })).toBeLessThan(1e-6);
    }
    expect(shell.normals.length).toBe(shell.verts.length);
  });

  it('puts the placket down the middle of her front, from the neck, with its buttons', () => {
    const body = cylinderBody();
    const { placket } = buildTop(body, POLO);
    expect(placket).not.toBe(null);
    expect(placket.top).toBeGreaterThan(body.bones.Neck[1] + POLO.neckCap - 0.01);
    expect(placket.buttons.length).toBe(POLO.buttons.length);
    expect(placket.slits.length).toBe(0);
    for (const b of placket.buttons) {
      expect(Math.abs(b.centre[0])).toBeLessThan(0.002);
      expect(b.centre[2]).toBeGreaterThan(0.12); // on her front (+z as she stands), not her side
      expect(b.normal[2]).toBeGreaterThan(0.9);
    }
    const ys = placket.verts.map((v) => v.rest[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(POLO.placketLength, 2);
  });

  it('gives the jumper no placket, ribbing at the hem and a hem over the shorts', () => {
    const body = cylinderBody();
    const { shell, placket, shade } = buildTop(body, JUMPER);
    expect(placket).toBe(null);
    const hem = shell.verts.filter((v) => v.edge === 'hem' && !v.apart);
    for (const v of hem) expect(v.rest[1]).toBeCloseTo(body.waist - JUMPER.hemDrop, 3);
    const ribbed = shell.verts.map((v, i) => [v, shade[i]]).filter(([v]) => !v.apart && v.rest[1] < body.waist - JUMPER.hemDrop + JUMPER.hemBand - 0.005);
    expect(ribbed.length).toBeGreaterThan(0);
    for (const [, k] of ribbed) expect(k).toBe(JUMPER.bandShade);
  });

  it('opens the top button into a V on her front, the placket split along it, with her skin in it', () => {
    const body = cylinderBody();
    const { shell, placket, vee } = buildTop(body, { ...POLO, open: 1 });
    expect(vee).not.toBe(null);
    expect(vee.top - vee.bottom).toBeCloseTo(POLO.buttons[1] - POLO.veeStop, 6);
    // The neck's edge comes down the V at her front, and her back is untouched.
    const neck = shell.verts.filter((v) => v.edge === 'neck' && !v.apart);
    expect(Math.min(...neck.map((v) => v.rest[1]))).toBeLessThan(vee.bottom + 0.004);
    for (const v of neck.filter((q) => q.rest[2] < 0)) expect(v.rest[1]).toBeCloseTo(body.bones.Neck[1] + POLO.neckCap, 3);
    // The undone button is on her left half (+x as she stands), its buttonhole on her right, the rest down the middle.
    expect(placket.buttons.length).toBe(POLO.buttons.length);
    expect(placket.buttons[0].centre[0]).toBeGreaterThan(0.005);
    expect(placket.slits.length).toBe(1);
    expect(placket.slits[0].centre[0]).toBeLessThan(-0.005);
    for (const b of placket.buttons.slice(1)) expect(Math.abs(b.centre[0])).toBeLessThan(0.002);
    const inset = buildInset(body, vee);
    expect(inset.tris.length).toBeGreaterThan(0);
    const used = new Set(inset.tris.flat());
    for (const i of used) expect(vee.field(inset.verts[i])).toBeGreaterThan(-0.002);
  });
});

describe('shorts', () => {
  it('cut level at the waist, with the polo tucked inside them all the way to their top', () => {
    const body = cylinderBody();
    const shorts = buildShorts(body);
    const waist = shorts.shell.verts.filter((v) => v.edge === 'waist' && !v.apart);
    expect(waist.length).toBeGreaterThan(20);
    for (const v of waist) expect(v.rest[1]).toBeCloseTo(body.waist, 4);
    // Below their top, every point of the polo is nearer her than every point of the shorts.
    const radius = (v) => Math.hypot(v.rest[0], v.rest[2]);
    const below = (verts) => verts.filter((v) => !v.apart && v.rest[1] < body.waist - 1e-4).map(radius);
    const polo = below(buildTop(body, POLO).shell.verts);
    expect(polo.length).toBeGreaterThan(20);
    expect(Math.max(...polo)).toBeLessThan(Math.min(...below(shorts.shell.verts)));
    expect(SHORTS.ease).toBeGreaterThan(POLO.tuckEase);
  });
});

describe('the collar', () => {
  const ring = (verts, y) => verts.filter((v) => Math.abs(v.rest[1] - y) < 0.004).map((v) => Math.hypot(v.rest[0], v.rest[2]));

  it('stands on the neck edge, closes at the front over the placket, and lies outside the shirt', () => {
    const body = cylinderBody();
    const { shell } = buildTop(body, POLO);
    const collar = buildCollar(shell, body, { placketWidth: POLO.placketWidth, over: [shell] });
    expect(collar).not.toBe(null);
    expect(collar.shade.length).toBe(collar.verts.length);
    // Its two ends meet over the middle of her front.
    const front = collar.verts.filter((v) => v.rest[2] > 0.1 && v.rest[1] > body.bones.Neck[1] + POLO.neckCap - 0.004);
    expect(Math.min(...front.map((v) => Math.abs(v.rest[0])))).toBeLessThan(COLLAR.closedGap + 0.003);
    // Below the neck edge, where the fall lies on the shirt, it is outside it.
    const neckY = body.bones.Neck[1] + POLO.neckCap;
    for (const y of [neckY - 0.008, neckY - 0.015]) {
      const shirt = ring(shell.verts.filter((v) => !v.apart), y);
      const mine = ring(collar.verts, y);
      if (shirt.length && mine.length) expect(Math.min(...mine)).toBeGreaterThan(Math.max(...shirt) - 0.001);
    }
    // It stands up above the neck edge.
    expect(Math.max(...collar.verts.map((v) => v.rest[1]))).toBeGreaterThan(neckY + COLLAR.standFront);
    // The wings leave the placket showing: nothing below the neck edge on her front is over the placket.
    const low = collar.verts.filter((v) => v.rest[2] > 0.1 && v.rest[1] < neckY - 0.004);
    expect(low.length).toBeGreaterThan(0);
    for (const v of low) expect(Math.abs(v.rest[0])).toBeGreaterThan(POLO.placketWidth / 2);
    // And the points turn out towards her shoulders: the lowest point of each wing is further out than where it starts.
    const lowest = low.reduce((a, b) => (b.rest[1] < a.rest[1] ? b : a));
    expect(Math.abs(lowest.rest[0])).toBeGreaterThan(POLO.placketWidth / 2 + 0.01);
  });

  it('on an open neck ends at the top corners of the V, so the points splay apart', () => {
    const body = cylinderBody();
    const { shell, vee } = buildTop(body, { ...POLO, open: 3 });
    const collar = buildCollar(shell, body, { vee, placketWidth: POLO.placketWidth, over: [shell] });
    const front = collar.verts.filter((v) => v.rest[2] > 0.1);
    expect(Math.min(...front.map((v) => Math.abs(v.rest[0])))).toBeGreaterThan(vee.halfWidth(vee.top) - 0.004);
  });

  it('opens one to five buttons, each further down than the last, all five with a placket in two halves', () => {
    const body = cylinderBody();
    const bottoms = [1, 2, 3, 4, 5].map((open) => buildTop(body, { ...POLO, open }).vee.bottom);
    for (let k = 1; k < bottoms.length; k++) expect(bottoms[k]).toBeLessThan(bottoms[k - 1]);
    const all = buildTop(body, { ...POLO, open: 5 });
    expect(all.placket).not.toBe(null);
    expect(all.placket.buttons.length).toBe(POLO.buttons.length);
    expect(all.placket.slits.length).toBe(POLO.buttons.length);
    // Her cleavage is shaded down the middle of the skin in the V, lighter away from it.
    const inset = buildInset(body, all.vee);
    expect(inset.shade.length).toBe(inset.verts.length);
    expect(Math.min(...inset.shade)).toBeLessThan(1);
  });
});

describe('buttons undone on each farm', () => {
  it('deals Amy none or one and Jess anything from none to all five, the same for the same farm', () => {
    const range = (id) => CHARACTERS.find((c) => c.id === id).poloOpen;
    expect(range('amy')).toEqual([0, 1]);
    expect(range('jess')).toEqual([0, POLO.buttons.length]);
    const seen = { amy: new Set(), jess: new Set() };
    for (let seed = 1; seed < 300; seed++) {
      for (const id of ['amy', 'jess']) {
        const n = dealPoloOpen(range(id), createRandom(seed));
        expect(n).toBe(dealPoloOpen(range(id), createRandom(seed)));
        seen[id].add(n);
      }
    }
    expect([...seen.amy].sort()).toEqual([0, 1]);
    expect([...seen.jess].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(dealPoloOpen([0, 5], () => 0.99999)).toBe(5);
    expect(dealPoloOpen(undefined, () => 0.5)).toBe(0);
  });

  it('puts the top button on the collar stand, done up in the middle and undone at the same height on its half', () => {
    const body = cylinderBody();
    const up = buildTop(body, POLO).placket;
    expect(up.buttons[0].centre[1]).toBeGreaterThan(up.top);
    const open = buildTop(body, { ...POLO, open: 2 }).placket;
    expect(open.buttons[0].centre[1]).toBeCloseTo(up.buttons[0].centre[1] - up.top + open.top, 4);
    expect(open.buttons[0].centre[0]).toBeGreaterThan(body.bones.Neck[0]); // off the middle, on its own half
    expect(open.slits.length).toBe(2); // a buttonhole for each undone button
    // The rest are evenly spaced.
    const gaps = up.buttons.slice(1).map((b, i) => up.buttons[i].centre[1] - b.centre[1]);
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0], 3);
  });
});

describe('evening out the skinning', () => {
  it('softens a sudden change of bone between neighbours, keeping weights whole and the skin map in step', () => {
    // A strip whose left half follows bone 1 and right half bone 2, its skin map a different shift for each.
    const m = grid(6);
    const shift = (x) => [1, 0, 0, x, 0, 1, 0, 0, 0, 0, 1, 0];
    m.verts.forEach((v) => {
      const right = v.bind[0] > 0.5;
      v.weights = [[right ? 2 : 1, 1]];
      v.skin = shift(right ? 0.1 : 0);
      v.rest = applySkin(v.skin, v.bind);
    });
    const jump = (mesh) => {
      const at = (x) => mesh.verts.find((v) => Math.abs(v.bind[0] - x) < 1e-9 && Math.abs(v.bind[1] - 0.5) < 1e-9);
      const w2 = (v) => v.weights.find(([b]) => b === 2)?.[1] ?? 0;
      return w2(at(4 / 6)) - w2(at(3 / 6));
    };
    expect(jump(m)).toBeCloseTo(1, 9);
    smoothSkinning(m, 4, 0.5);
    expect(jump(m)).toBeLessThan(0.5);
    for (const v of m.verts) {
      expect(v.weights.length).toBeLessThanOrEqual(4);
      expect(v.weights.reduce((t, [, w]) => t + w, 0)).toBeCloseTo(1, 9);
      // The skin map is the weights' blend of the bones' maps, as skinning will make it.
      const w2 = v.weights.find(([b]) => b === 2)?.[1] ?? 0;
      expect(v.skin[3]).toBeCloseTo(0.1 * w2, 6);
      v.rest.forEach((c, k) => expect(c).toBeCloseTo(applySkin(v.skin, v.bind)[k], 9));
    }
  });
});


describe('the wax jacket', () => {
  it('goes on down below the body with a skirt, opens in a V at the top and has studs down a storm flap', async () => {
    const { COAT } = await import('../src/npc/polo.js');
    const body = cylinderBody();
    const { shell, placket, vee } = buildTop(body, COAT);
    const hem = shell.verts.filter((v) => v.edge === 'hem' && !v.apart);
    expect(hem.length).toBeGreaterThan(20);
    for (const v of hem) expect(v.rest[1]).toBeCloseTo(body.waist - COAT.hemDrop - COAT.skirt, 3);
    // Hanging straight on, never in at her.
    for (const v of hem) expect(Math.hypot(v.rest[0], v.rest[2])).toBeGreaterThan(0.12 + COAT.ease - 0.001);
    expect(vee).not.toBe(null);
    expect(vee.top - vee.bottom).toBeGreaterThan(0.12);
    expect(placket.buttons.length).toBe(COAT.studs);
    // The flap runs down to just above the hem.
    const low = Math.min(...placket.verts.map((v) => v.rest[1]));
    expect(low - (body.waist - COAT.hemDrop - COAT.skirt)).toBeLessThan(COAT.placketToHem + 0.02);
    // Stands off whatever is under it: further out than the jumper everywhere on her body.
    const jumper = buildTop(body, JUMPER).shell.verts.filter((v) => !v.apart);
    const out = (v) => Math.hypot(v.rest[0], v.rest[2]);
    const maxJumper = Math.max(...jumper.filter((v) => Math.abs(v.rest[1] - 1.0) < 0.02).map(out));
    const minCoat = Math.min(...shell.verts.filter((v) => !v.apart && Math.abs(v.rest[1] - 1.0) < 0.02 && v.rest[2] < 0).map(out));
    expect(minCoat).toBeGreaterThan(maxJumper);
  });
});

describe('the other tops', () => {
  it('opens a plaid worn over the polo all the way down, its fronts apart to the hem', async () => {
    const { PLAID_OPEN } = await import('../src/npc/polo.js');
    const body = cylinderBody();
    const { vee, placket, shell } = buildTop(body, PLAID_OPEN);
    expect(vee).not.toBe(null);
    const hemY = body.waist - PLAID_OPEN.hemDrop;
    expect(vee.halfWidth(hemY + 0.01)).toBeGreaterThanOrEqual(PLAID_OPEN.veeFloor);
    // Nothing of it across her middle at the front, from the neck to the hem.
    const used = [...new Set(shell.tris.flat())].map((i) => shell.verts[i]);
    // Close at the collar, falling open below it: nothing across her middle anywhere down the front.
    for (const v of used.filter((q) => !q.apart && q.rest[2] > 0.1)) {
      const want = v.rest[1] < vee.top - PLAID_OPEN.veeDrop ? PLAID_OPEN.veeFloor : PLAID_OPEN.veeNeck;
      expect(Math.abs(v.rest[0])).toBeGreaterThan(want - 0.01);
    }
    expect(placket.slits.length).toBe(placket.buttons.length); // every button undone, a buttonhole for each
  });

  it('buttons a plaid shirt to the hem, done right up or with the top few undone', async () => {
    const { PLAID } = await import('../src/npc/polo.js');
    const body = cylinderBody();
    const shut = buildTop(body, { ...PLAID, open: 0 });
    expect(shut.vee).toBe(null);
    expect(shut.placket.buttons.length).toBe(PLAID.studs);
    // Done right up: the top button is on the collar's stand, above where the shirt meets her neck.
    expect(Math.max(...shut.placket.buttons.map((b) => b.centre[1]))).toBeGreaterThan(shut.placket.top);
    const open = buildTop(body, { ...PLAID, open: 2 });
    expect(open.vee).not.toBe(null);
    expect(open.placket.buttons.length).toBe(PLAID.studs);
    expect(Math.min(...open.placket.verts.map((v) => v.rest[1]))).toBeLessThan(body.waist - PLAID.hemDrop + 0.04);
  });

  it('puts a second polo outside the first, with shorter sleeves and a lower neck', async () => {
    const { OVER_POLO } = await import('../src/npc/polo.js');
    const body = cylinderBody();
    const under = buildTop(body, POLO).shell.verts.filter((v) => !v.apart);
    const over = buildTop(body, OVER_POLO).shell.verts.filter((v) => !v.apart);
    const out = (v) => Math.hypot(v.rest[0], v.rest[2]);
    const at = (vs) => vs.filter((v) => Math.abs(v.rest[1] - 1.05) < 0.02).map(out);
    expect(Math.min(...at(over))).toBeGreaterThan(Math.max(...at(under)));
    const top = (vs) => Math.max(...vs.filter((v) => v.edge === 'neck' && v.rest[2] < 0).map((v) => v.rest[1]));
    expect(top(over)).toBeLessThanOrEqual(top(under));
  });

  it('buttons a plaid over the polo, outside it with a lower neck, and lays the polo collar out over the plaid collar', async () => {
    const { PLAID_OVER } = await import('../src/npc/polo.js');
    const { SHIRT_UNDER_COLLAR } = await import('../src/npc/collar.js');
    const body = cylinderBody();
    const polo = buildTop(body, POLO).shell;
    const plaid = buildTop(body, { ...PLAID_OVER, open: 0 }).shell;
    const out = (v) => Math.hypot(v.rest[0], v.rest[2]);
    const at = (vs, y) => vs.filter((v) => !v.apart && Math.abs(v.rest[1] - y) < 0.02).map(out);
    expect(Math.min(...at(plaid.verts, 1.05))).toBeGreaterThan(Math.max(...at(polo.verts, 1.05)));
    const top = (vs) => Math.max(...vs.filter((v) => v.edge === 'neck' && v.rest[2] < 0).map((v) => v.rest[1]));
    expect(top(plaid.verts)).toBeLessThanOrEqual(top(polo.verts));
    const shirt = buildCollar(plaid, body, { placketWidth: PLAID_OVER.placketWidth, over: [plaid] }, SHIRT_UNDER_COLLAR);
    const hers = buildCollar(polo, body, { placketWidth: POLO.placketWidth, over: [polo, plaid, shirt] });
    const high = (c) => Math.max(...c.verts.map((v) => v.rest[1]));
    expect(high(hers)).toBeGreaterThan(high(shirt)); // her polo's fold above the plaid's
    // Round the back, at the plaid collar's fold, her fall lies outside it (her stand is inside, under it).
    const back = (c, y) => c.verts.filter((v) => v.rest[2] < -0.02 && Math.abs(v.rest[0]) < 0.03 && Math.abs(v.rest[1] - y) < 0.006).map(out);
    const y = high(shirt) - 0.004;
    expect(Math.max(...back(hers, y))).toBeGreaterThan(Math.max(...back(shirt, y)));
  });

  it('pulls the under polo sleeve back inside the one over it where it has come through', async () => {
    const { tuckSleeves } = await import('../src/npc/polo.js');
    // Two sleeves as tubes round her left arm's bone (straight down), on that bone and in the same pose stored and standing.
    const ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
    const bones = { LeftArm: [0.4, 1.2, 0], LeftHand: [0.4, 0.8, 0], RightArm: [-0.4, 1.2, 0], RightHand: [-0.4, 0.8, 0] };
    const body = { bones, boneNames: ['Spine2', 'LeftArm'] };
    const tube = (r) => {
      const verts = [];
      const tris = [];
      const segs = 16;
      for (let k = 0; k <= 8; k++) {
        for (let j = 0; j < segs; j++) {
          const a = (j / segs) * Math.PI * 2;
          const p = [0.4 + r * Math.cos(a), 1.15 - k * 0.04, r * Math.sin(a)];
          verts.push({ rest: p, bind: p.slice(), skin: ID, weights: [[1, 1]] });
          if (k < 8) {
            const i = k * segs + j;
            const n = k * segs + ((j + 1) % segs);
            tris.push([i, n, i + segs], [n, n + segs, i + segs]);
          }
        }
      }
      return { verts, tris };
    };
    const under = tube(0.03);
    const over = tube(0.04);
    // A few of the under sleeve's points out through the over one, as squeezing the inside of the arm does.
    const pushed = [40, 41, 56].map((i) => under.verts[i]);
    for (const v of pushed) {
      const out = [v.rest[0] - 0.4, 0, v.rest[2]];
      const k = 0.045 / Math.hypot(...out);
      v.rest = [0.4 + out[0] * k, v.rest[1], out[2] * k];
      v.bind = v.rest.slice();
    }
    expect(tuckSleeves(under, over, body)).toBe(3);
    for (const v of pushed) {
      const r = Math.hypot(v.rest[0] - 0.4, v.rest[2]);
      expect(r).toBeLessThan(0.04); // back inside
      expect(r).toBeGreaterThan(0.03); // not pulled in past where it was meant to be
      expect(v.bind).toEqual(v.rest); // bind kept in step (this skin is the identity)
    }
    expect(tuckSleeves(under, over, body)).toBe(0); // nothing left to pull in
  });

  it('pops a collar up round her neck instead of laying it down', () => {
    const body = cylinderBody();
    const { shell } = buildTop(body, POLO);
    const flat = buildCollar(shell, body, { placketWidth: POLO.placketWidth, over: [shell] });
    const popped = buildCollar(shell, body, { placketWidth: POLO.placketWidth, over: [shell] }, { ...COLLAR, popped: true });
    const high = (c) => Math.max(...c.verts.map((v) => v.rest[1]));
    const low = (c) => Math.min(...c.verts.map((v) => v.rest[1]));
    expect(high(popped)).toBeGreaterThan(high(flat) + 0.01);
    expect(low(popped)).toBeGreaterThan(low(flat));
  });
});

describe('a shirt and tie', () => {
  it('tucks a work shirt in with seven buttons to the waistband and a chest pocket on her left', async () => {
    const { SHIRT } = await import('../src/npc/polo.js');
    const body = cylinderBody();
    const { placket, pocket, shell } = buildTop(body, SHIRT);
    expect(placket.buttons.length).toBe(7);
    expect(Math.max(...placket.buttons.map((b) => b.centre[1]))).toBeGreaterThan(placket.top); // done right up, on the stand
    expect(Math.min(...placket.buttons.map((b) => b.centre[1]))).toBeGreaterThan(body.waist);
    expect(Math.min(...shell.verts.map((v) => v.rest[1]))).toBeLessThan(body.waist); // tucked into her shorts
    expect(pocket).not.toBe(null);
    const xs = pocket.verts.map((v) => v.rest[0]);
    expect(Math.min(...xs)).toBeGreaterThan(0.02); // all on her left (+x as she stands)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(SHIRT.pocket.width, 2);
  });

  it('lays the tie down her front from a knot up in the collar to the waistband, widening to about 8 cm', async () => {
    const { SHIRT } = await import('../src/npc/polo.js');
    const { buildTie, TIE } = await import('../src/npc/tie.js');
    const body = cylinderBody();
    const shirt = buildTop(body, SHIRT);
    const tie = buildTie(body, { top: shirt.placket.top, ground: [shirt.shell, shirt.placket] });
    expect(tie).not.toBe(null);
    expect(tie.knotTop).toBeGreaterThan(shirt.placket.top);
    const ys = tie.verts.map((v) => v.rest[1]);
    expect(Math.min(...ys)).toBeGreaterThan(body.waist);
    expect(Math.min(...ys)).toBeLessThan(body.waist + 0.01);
    const xs = tie.verts.map((v) => v.rest[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(TIE.blade, 2);
    // In front of the shirt everywhere: no point of the tie further in than her shirt there.
    for (const v of tie.verts) expect(Math.hypot(v.rest[0], v.rest[2])).toBeGreaterThan(0.12);
    // The knot stands out from the blade, and the blade is narrow under it.
    const knot = tie.verts.filter((v) => v.rest[1] > tie.knotTop - TIE.knotHeight && v.rest[1] <= tie.knotTop);
    const blade = tie.verts.filter((v) => v.rest[1] < tie.knotTop - TIE.knotHeight - 0.05);
    expect(Math.max(...knot.map((v) => v.rest[2]))).toBeGreaterThan(Math.max(...blade.map((v) => v.rest[2])) + 0.005);
  });

  it('loosened, pulls the knot a little down over the open neck and runs its ends up into the collar', async () => {
    const { SHIRT_ROLLED } = await import('../src/npc/polo.js');
    const { buildTie, TIE } = await import('../src/npc/tie.js');
    const body = cylinderBody();
    const shirt = buildTop(body, { ...SHIRT_ROLLED, open: 1 });
    expect(shirt.vee).not.toBe(null);
    const inset = buildInset(body, shirt.vee, SHIRT_ROLLED);
    const tie = buildTie(body, { top: shirt.placket.top, ground: [shirt.shell, shirt.placket, inset], loose: true, drop: 0.025, vee: shirt.vee });
    expect(tie).not.toBe(null);
    expect(tie.knotTop).toBeCloseTo(shirt.placket.top - 0.025, 6);
    expect(tie.knotTop - TIE.knotHeight).toBeLessThan(shirt.vee.bottom); // over the point of the open neck
    // Its ends reach up to the neck, either side of her middle.
    const high = tie.verts.filter((v) => v.rest[1] > shirt.placket.top - 0.005);
    expect(high.some((v) => v.rest[0] > 0.01)).toBe(true);
    expect(high.some((v) => v.rest[0] < -0.01)).toBe(true);
  });

  it('presses a point collar down on to the shirt rather than leaving its points standing off it', async () => {
    const { SHIRT } = await import('../src/npc/polo.js');
    const { POINT_COLLAR } = await import('../src/npc/collar.js');
    const body = cylinderBody();
    const { shell } = buildTop(body, SHIRT);
    const opts = { placketWidth: SHIRT.placketWidth, over: [shell] };
    const out = (c) => Math.max(...c.verts.map((v) => Math.hypot(v.rest[0], v.rest[2])));
    const lying = buildCollar(shell, body, opts, POINT_COLLAR);
    const standing = buildCollar(shell, body, opts, { ...POINT_COLLAR, lie: null });
    expect(out(lying)).toBeLessThan(out(standing) - 0.005);
    expect(out(lying)).toBeLessThan(0.12 + SHIRT.ease + 0.012); // within about a centimetre of the shirt
  });

  it('draws every button on the shirt, the tie lying over them', async () => {
    const { SHIRT } = await import('../src/npc/polo.js');
    const { buildTie } = await import('../src/npc/tie.js');
    const body = cylinderBody();
    const shirt = buildTop(body, SHIRT);
    const tie = buildTie(body, { top: shirt.placket.top, ground: [shirt.shell, shirt.placket] });
    expect(SHIRT.underTie).toBeUndefined();
    for (const b of shirt.placket.buttons.filter((b) => b.centre[1] < tie.knotTop - 0.04)) {
      const over = tie.verts.filter((v) => Math.abs(v.rest[1] - b.centre[1]) < 0.002 && Math.abs(v.rest[0] - b.centre[0]) < 0.003);
      expect(over.length).toBeGreaterThan(0);
      expect(Math.min(...over.map((v) => v.rest[2]))).toBeGreaterThan(b.centre[2] + 0.0026); // clear of the button's top
    }
  });
});

describe('the crop-top', () => {
  it('is a band round her bust and two straps over her shoulders, and nothing below the band', async () => {
    const { buildCropTop, cropFields, CROP } = await import('../src/npc/crop.js');
    const body = cylinderBody();
    const built = buildCropTop(body);
    expect(built).not.toBe(null);
    const F = cropFields(body);
    const verts = [...new Set(built.shell.tris.flat())].map((i) => built.shell.verts[i]).filter((v) => !v.apart);
    for (const v of verts.filter((q) => q.edge !== 'strap')) expect(F.field(v)).toBeLessThan(0.006); // stood off her, so a few millimetres out
    expect(Math.min(...verts.map((v) => v.rest[1]))).toBeGreaterThan(F.bust.y - CROP.under - 0.005);
    // Two thin straps above the band, strapAcross either side of her middle, front and back, lying just off her.
    const straps = verts.filter((v) => v.edge === 'strap');
    expect(straps.length).toBeGreaterThan(20);
    for (const v of straps) expect(Math.abs(Math.abs(v.rest[0]) - CROP.strapAcross)).toBeLessThan(CROP.strapWidth + 0.004); // lifted off her as she faces
    expect(Math.max(...straps.map((v) => v.rest[2]))).toBeGreaterThan(0.05);
    expect(Math.min(...straps.map((v) => v.rest[2]))).toBeLessThan(-0.05);
  });
});

describe('the crop-top between her breasts', () => {
  it('draws her cleavage on her skin above the band, darkest at the band and gone at the top', async () => {
    const { buildCropTop, CROP } = await import('../src/npc/crop.js');
    const { groove } = buildCropTop(cylinderBody());
    expect(groove.verts.length).toBeGreaterThan(20);
    expect(Math.min(...groove.shade)).toBeGreaterThanOrEqual(1 - CROP.grooveShadow - 1e-9);
    expect(Math.min(...groove.shade)).toBeLessThan(0.5);
    expect(Math.max(...groove.shade)).toBeCloseTo(1, 6);
    const rows = groove.verts.length / 10;
    expect(groove.shade[groove.shade.length - 1 - 5]).toBeCloseTo(1, 6); // the middle of the top row
    expect(rows).toBe(9);
  });
  it('is cut level with each breast, not with the highest one', async () => {
    const { cropFields } = await import('../src/npc/crop.js');
    const body = cylinderBody();
    const F = cropFields(body);
    const y = F.bust.y;
    F.bust.sides = { left: { x: 0.07, y: y + 0.012, z: F.bust.z }, right: { x: -0.02, y: y - 0.003, z: F.bust.z } };
    // Over each apex the band's top sits that breast's own height above (or below) the single bust height; round her back, nowhere.
    expect(F.top([0.07, 0, 0.2]) - F.top([-0.02, 0, 0.2])).toBeCloseTo(0.015, 2);
    expect(Math.abs(F.top([0.07, 0, -0.2]) - F.top([-0.02, 0, -0.2]))).toBeLessThan(0.003);
  });
});

describe('the crop-top round her back', () => {
  it('goes all the way round, however narrow it is at the back', async () => {
    const { buildCropTop } = await import('../src/npc/crop.js');
    const body = cylinderBody();
    const built = buildCropTop(body, { ...(await import('../src/npc/crop.js')).CROP, backTop: -0.03, backUnder: 0.04 });
    const used = [...new Set(built.shell.tris.flat())].map((i) => built.shell.verts[i]).filter((v) => !v.apart && v.edge !== 'strap');
    expect(used.some((v) => v.rest[2] < -0.11)).toBe(true);
    expect(used.some((v) => v.rest[0] > 0.11)).toBe(true);
  });
});

describe('stretched over the hollows', () => {
  it("finds a ring's convex outline and how far it reaches in any direction", async () => {
    const { convexHull, hullReach } = await import('../src/npc/crop.js');
    // A square with a dent in one side: the hull skips the dent.
    const hull = convexHull([[1, 1], [-1, 1], [-1, -1], [1, -1], [0, 0.5], [1, 0]]);
    expect(hull.length).toBe(4);
    expect(hullReach(hull, 0, 1)).toBeCloseTo(1, 6); // across the dent, out to the square's edge
    expect(hullReach(hull, 1, 0)).toBeCloseTo(1, 6);
  });
});

