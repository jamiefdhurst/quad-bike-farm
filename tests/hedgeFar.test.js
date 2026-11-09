import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { farHedgeTriangles, buildFarHedges, HedgeSwap, leafTint } from '../src/world/hedgeFar.js';

const piece = (x, over = {}) => ({ x, z: 0, along: [1, 0], length: 1.2, width: 1.6, top: 3, groundA: 0, groundB: 0, kind: 'hedge', gap: false, ...over });
const run = (xs, over = {}) => xs.map((x, i) => piece(x, { gap: i === 0, ...over }));
const bounds = (positions) => {
  const b = new THREE.Box3();
  for (let i = 0; i < positions.length; i += 3) b.expandByPoint(new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]));
  return b;
};

describe('far hedge strips', () => {
  it('keeps the hedge\'s height, thickness and length, sunk a little into the ground', () => {
    const { positions } = farHedgeTriangles([run([0, 1.2, 2.4, 3.6])]);
    const b = bounds(positions);
    expect(b.max.y).toBeCloseTo(3, 5);
    expect(b.min.y).toBeLessThan(0);
    expect(b.max.z - b.min.z).toBeCloseTo(1.6, 5);
    expect(b.max.x - b.min.x).toBeCloseTo(4.8, 5);
  });

  it('has an uneven top line: each piece peaks at its own height and meets its neighbours halfway', () => {
    const tops = [2, 3.5, 2.5];
    const r = tops.map((top, i) => piece(i * 1.2, { top, gap: i === 0 }));
    const { positions } = farHedgeTriangles([r]);
    const highest = (x0, x1) => {
      let m = -Infinity;
      for (let i = 0; i < positions.length; i += 3) if (positions[i] >= x0 - 1e-6 && positions[i] <= x1 + 1e-6) m = Math.max(m, positions[i + 1]);
      return m;
    };
    expect(highest(1.2 - 0.01, 1.2 + 0.01)).toBeCloseTo(3.5, 5); // the middle piece's peak
    expect(highest(-0.01, 0.01)).toBeCloseTo(2, 5); // the first's
    expect(highest(0.6 - 0.01, 0.6 + 0.01)).toBeCloseTo(2.75, 5); // halfway between them
  });

  it('leaves a gap where a gateway is: the stretch either side of it is closed at its end', () => {
    const joined = farHedgeTriangles([run([0, 1.2, 2.4, 3.6])]);
    const gappy = farHedgeTriangles([run([0, 1.2]), run([4, 5.2])]); // 1.6 m of gateway between
    
    expect(gappy.positions.length).toBeGreaterThan(joined.positions.length); // two more end caps
    const b = bounds(gappy.positions);
    expect(b.max.x - b.min.x).toBeCloseTo(6.4, 5);
  });

  it('draws a wall in grey with lighter copes along the top, and a hedge in green', () => {
    const grey = (kind) => {
      const { colors } = farHedgeTriangles([run([0, 1.2], { kind })], kind);
      return [...colors];
    };
    const wall = grey('wall');
    const lum = (i) => wall[i] * 0.3 + wall[i + 1] * 0.59 + wall[i + 2] * 0.11;
    expect(Math.abs(wall[0] - wall[2])).toBeLessThan(0.05); // grey, not green
    const lums = [];
    for (let i = 0; i < wall.length; i += 3) lums.push(lum(i));
    expect(Math.max(...lums)).toBeGreaterThan(Math.min(...lums) * 1.2); // the cope is lighter than the stone under it
    const hedge = grey('hedge');
    expect(hedge[1]).toBeGreaterThan(hedge[0]); // green
    expect(hedge[1]).toBeGreaterThan(hedge[2]);
  });

  it('shades the foot darker than the top, and the faces have flat normals that point out', () => {
    const { colors, positions, normals } = farHedgeTriangles([run([0, 1.2])]);
    let foot = Infinity;
    let top = -Infinity;
    for (let i = 0; i < positions.length / 3; i++) {
      const g = colors[i * 3 + 1];
      if (positions[i * 3 + 1] < 0) foot = Math.min(foot, g);
      else top = Math.max(top, g);
    }
    expect(foot).toBeLessThan(top);
    // the first side quad is on the left of the line (+z is across), so it faces -z
    expect(normals[2]).toBeLessThan(0);
  });

  it('turns with the leaves: the tint multiplies the hedge strips, not the walls', () => {
    const colourOf = (g) => g.children[0].geometry.getAttribute('color').getY(0);
    const plain = buildFarHedges(run([0, 1.2]));
    const tinted = buildFarHedges(run([0, 1.2]), { tint: [1, 2, 1] });
    expect(colourOf(tinted)).toBeCloseTo(colourOf(plain) * 2, 5);
    const wall = buildFarHedges(run([0, 1.2], { kind: 'wall' }), { tint: [1, 2, 1] });
    expect(colourOf(wall)).toBeCloseTo(colourOf(buildFarHedges(run([0, 1.2], { kind: 'wall' }))), 5);
  });

  it('reads the near leaves\' tint from the model', () => {
    const leaf = new THREE.MeshStandardMaterial({ map: new THREE.Texture(), color: new THREE.Color(2.2, 1.35, 0.4) });
    leaf.alphaTest = 0.5;
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BufferGeometry(), leaf));
    const t = leafTint(root);
    expect(t[0]).toBeCloseTo(2.2, 5);
    expect(leafTint(new THREE.Group())).toEqual([1, 1, 1]);
  });
});

describe('the swap between blocks and strips', () => {
  const tileMesh = (key, minX, maxX) => {
    const m = new THREE.Mesh();
    m.userData.tile = { key, minX, maxX, minZ: 0, maxZ: 0 };
    return m;
  };
  const make = () => {
    const near = new THREE.Group();
    const far = new THREE.Group();
    const a = tileMesh('0,0', 0, 50);
    const b = tileMesh('0,0', 0, 50); // a second sub-mesh of the same tile
    const f = tileMesh('0,0', 0, 50);
    near.add(a, b);
    far.add(f);
    return { swap: new HedgeSwap(near, far), a, b, f };
  };
  const at = (x) => ({ x, z: 0 });

  it('draws the blocks within the distance of the tile and the strip beyond it, with a margin either way', () => {
    const { swap, a, b, f } = make();
    swap.update(at(100), 150); // 50 m from the tile's edge
    expect([a.visible, b.visible, f.visible]).toEqual([true, true, false]);
    swap.update(at(205), 150); // 155 m: past it, but within the margin
    expect(a.visible).toBe(true);
    swap.update(at(215), 150); // 165 m
    expect([a.visible, b.visible, f.visible]).toEqual([false, false, true]);
    swap.update(at(205), 150); // back to 155 m: the strip holds
    expect(f.visible).toBe(true);
    swap.update(at(195), 150); // 145 m
    expect([a.visible, f.visible]).toEqual([true, false]);
  });

  it('never draws both, and with a distance of 0 draws only the blocks', () => {
    const { swap, a, f } = make();
    for (const x of [0, 100, 205, 400, 1000]) {
      swap.update(at(x), 150);
      expect(a.visible).not.toBe(f.visible);
    }
    swap.update(at(1000), 0);
    expect([a.visible, f.visible]).toEqual([true, false]);
  });

  it('decides without the margin when asked (the frame budget)', () => {
    const { swap, a } = make();
    swap.update(at(100), 150);
    swap.update(at(205), 150, true);
    expect(a.visible).toBe(false);
  });

  it('keeps the blocks where a tile has no strip', () => {
    const near = new THREE.Group();
    const a = tileMesh('9,9', 0, 10);
    near.add(a);
    const swap = new HedgeSwap(near, new THREE.Group());
    swap.update(at(1000), 150);
    expect(a.visible).toBe(true);
  });

  it('puts a strip in the same tile as its block, so the two swap together', () => {
    const far = buildFarHedges([piece(10), piece(70, { gap: true })]);
    expect(far.children.map((m) => m.userData.tile.key).sort()).toEqual(['0,0', '1,0']);
  });
});

describe('the farhedges scene', () => {
  it('brings the swap in to 25 m and scene end puts it back', async () => {
    const { SETUPS } = await import('../src/debug/sceneSetups.js');
    const { DEFAULT_GRAPHICS_PARAMS } = await import('../src/core/graphics.js');
    const g = { graphics: { ...DEFAULT_GRAPHICS_PARAMS }, companions: [] };
    SETUPS.farHedges(g);
    expect(g.graphics.hedgeFullDistance).toBe(25);
    SETUPS.end(g);
    expect(g.graphics.hedgeFullDistance).toBe(DEFAULT_GRAPHICS_PARAMS.hedgeFullDistance);
  });
});
