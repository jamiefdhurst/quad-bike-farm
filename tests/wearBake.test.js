import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { findCreases, bakeWear, bakeNooks, bakeNooksSteps, pieces, hash01 } from '../src/vehicle/detail/wear.js';

const L = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.2, 0), new THREE.Vector2(0.2, 0.05), new THREE.Vector2(0.05, 0.05), new THREE.Vector2(0.05, 0.2), new THREE.Vector2(0, 0.2)]);

describe('wear: creases', () => {
  it('a box: every edge convex, the diagonals across its faces not creases at all', () => {
    const { creases, any } = findCreases(new THREE.BoxGeometry(1, 1, 1));
    expect(any).toBe(true);
    const sorted = [...creases].sort();
    expect(sorted.filter((c) => c === 0)).toHaveLength(12); // one diagonal per triangle, 12 triangles
    expect(sorted.filter((c) => c > 0.99)).toHaveLength(24); // each of 12 edges seen from both sides
    expect(sorted.some((c) => c < 0)).toBe(false);
  });

  it('an L-shaped bracket: the fold inside the L is concave', () => {
    const { creases } = findCreases(new THREE.ExtrudeGeometry(L, { depth: 0.1, bevelEnabled: false }));
    expect(Math.min(...creases)).toBeLessThan(-0.99);
    expect(Math.max(...creases)).toBeGreaterThan(0.99);
  });

  it('a smooth cylinder: its sides are not creases, its rims are', () => {
    const geo = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8);
    const { creases } = findCreases(geo);
    const convex = [...creases].filter((c) => c > 0.5).length;
    expect(convex).toBe(2 * 8 * 2); // each rim's 8 sides, seen from the wall and from the cap
  });

  it('bakes the distance to each side, exact at the vertices', () => {
    const g = bakeWear(new THREE.BoxGeometry(1, 2, 3));
    expect(g.index).toBeNull();
    const d = g.attributes.wearDist;
    for (let v = 0; v < 3; v++) {
      for (let k = 0; k < 3; k++) {
        if (k === v) expect(d.array[v * 3 + k]).toBeGreaterThan(0);
        else expect(d.array[v * 3 + k]).toBe(0);
      }
    }
    // The crease is the same at a triangle's three vertices.
    const c = g.attributes.wearCrease.array;
    expect([c[0], c[1], c[2]]).toEqual([c[3], c[4], c[5]]);
  });

  it('a geometry with no creases keeps its index and gets zeros', () => {
    const sphere = new THREE.SphereGeometry(1, 16, 12);
    const g = bakeWear(sphere, { minAngle: 0.35, fullAngle: 1, openEdge: 0, nookReach: 0.03, nookCount: 4 });
    expect(g).toBe(sphere);
    expect(Math.max(...g.attributes.wearCrease.array)).toBe(0);
  });
});

describe('wear: nooks', () => {
  it('two pieces of one merged geometry are told apart', () => {
    const a = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const b = new THREE.BoxGeometry(0.1, 0.1, 0.1).translate(1, 0, 0);
    const merged = new THREE.BufferGeometry();
    const pa = a.toNonIndexed().attributes.position.array;
    const pb = b.toNonIndexed().attributes.position.array;
    merged.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...pa, ...pb]), 3));
    const p = pieces(merged);
    expect(new Set(p).size).toBe(2);
  });

  it('a part touching another makes a nook where they meet, and nowhere far from it', () => {
    const big = bakeWear(new THREE.BoxGeometry(1, 0.1, 1));
    const small = bakeWear(new THREE.BoxGeometry(0.1, 0.1, 0.1));
    const m = new THREE.Matrix4().makeTranslation(0.45, 0.1, 0.45); // sat on the big one's corner
    bakeNooks([{ geometry: big, matrix: new THREE.Matrix4() }, { geometry: small, matrix: m }]);
    const pos = big.attributes.position;
    const nook = big.attributes.wearNook.array;
    for (let i = 0; i < pos.count; i++) {
      const near = pos.getX(i) > 0.4 && pos.getZ(i) > 0.4 && pos.getY(i) > 0;
      if (near) expect(nook[i], `vertex ${i}`).toBeGreaterThan(0);
      else expect(nook[i], `vertex ${i}`).toBe(0);
    }
  });
});

describe('wear: marks on a part with no neighbours', () => {
  it('a part with a nookMin gets patchy grime, a steady amount each time, and one without gets none', () => {
    const g = () => bakeWear(new THREE.BoxGeometry(1, 0.1, 1, 4, 1, 4));
    const marked = g();
    const plain = g();
    bakeNooks([{ geometry: marked, matrix: new THREE.Matrix4(), nookMin: 0.6 }]);
    bakeNooks([{ geometry: plain, matrix: new THREE.Matrix4() }]);
    const n = [...marked.attributes.wearNook.array];
    expect(Math.max(...n)).toBeGreaterThan(0);
    expect(Math.max(...n)).toBeLessThanOrEqual(Math.round(0.6 * 255));
    expect(new Set(n).size).toBeGreaterThan(3); // patchy, not one flat amount
    expect(Math.max(...plain.attributes.wearNook.array)).toBe(0);
    expect(hash01(0.1, 0.2, 0.3)).toBe(hash01(0.1, 0.2, 0.3));
  });
});

describe('wear: which way a material wears', async () => {
  const { wearKind, wearColourGlsl, WEAR_KINDS } = await import('../src/effects/wearLayer.js');
  const mat = (color, roughness, metalness) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

  it('tells rubber, bare metal, painted metal and plastic apart', () => {
    expect(wearKind(mat(0x171717, 0.93, 0))).toBe('rubber');
    expect(wearKind(mat(0xd8dadc, 0.14, 1))).toBe('metal');
    expect(wearKind(mat(0x1f2123, 0.42, 0.45))).toBe('painted'); // a frame
    expect(wearKind(mat(0xa8271f, 0.3, 0))).toBe('finish'); // a quad's red plastic
    expect(wearKind(mat(0xa8271f, 0.3, 0), { metalBody: true })).toBe('painted'); // the same red on a tractor's tinwork
    expect(wearKind(mat(0x141414, 0.48, 0), { metalBody: true })).toBe('finish'); // a black seat in it stays vinyl
  });

  it('picks its own shader branch for each kind', () => {
    WEAR_KINDS.forEach((k, i) => expect(wearColourGlsl(k)).toContain(`#if ${i} == 0`));
  });
});

describe('wear: spread over frames (#459)', () => {
  const part = () => ({ geometry: bakeWear(new THREE.BoxGeometry(1, 1, 1, 12, 12, 12)), matrix: new THREE.Matrix4() });

  it('a big mesh takes several steps, and a mesh is added to the grid in a step of its own, so no step is a frame-long hitch', () => {
    const meshes = [part(), part(), part()];
    expect(meshes[0].geometry.attributes.position.count).toBeGreaterThan(3000);
    let steps = 0;
    for (const _ of bakeNooksSteps(meshes)) steps++;
    expect(steps).toBeGreaterThan(meshes.length * 2 + 3); // grid: one each; nooks: more than one each
  });

  it('gives the same nooks however it is stepped', () => {
    const stepped = [part(), part()];
    const whole = [part(), part()];
    for (const _ of bakeNooksSteps(stepped));
    bakeNooks(whole);
    whole.forEach((w, i) => expect([...stepped[i].geometry.attributes.wearNook.array]).toEqual([...w.geometry.attributes.wearNook.array]));
  });
});
