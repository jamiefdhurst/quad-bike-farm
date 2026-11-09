import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { resolveLayout, anchoredPaths } from '../src/world/layoutAnchors.js';
import before from './fixtures/layout-before-anchors.json';

// Every number in the layout before it was written from anchors must still be the number it resolves to.
function compare(a, b, path, bad) {
  if (typeof a === 'number') {
    if (typeof b !== 'number' || Math.abs(a - b) > 0.001) bad.push(`${path}: ${a} became ${b}`);
  } else if (Array.isArray(a)) {
    if (!Array.isArray(b) || b.length !== a.length) bad.push(`${path}: list changed`);
    else a.forEach((v, i) => compare(v, b[i], `${path}[${i}]`, bad));
  } else if (a && typeof a === 'object') {
    for (const k of Object.keys(a)) compare(a[k], b?.[k], `${path}.${k}`, bad);
  } else if (a !== b) bad.push(`${path}: ${JSON.stringify(a)} became ${JSON.stringify(b)}`);
}

describe('the layout written from anchors', () => {
  it('resolves to the same numbers the layout always had, to a millimetre', () => {
    const bad = [];
    compare(before, LAYOUT, 'LAYOUT', bad);
    expect(bad).toEqual([]);
  });
});

// Moving and turning an anchor. The expected numbers are worked out here from the unmoved layout, not by the resolver.
const MOVE = { x: 37, z: -12 };
const X_KEYS = new Set(['x', 'minX', 'maxX', 'edgeX', 'footX']);
const Z_KEYS = new Set(['z', 'minZ', 'maxZ']);
// Read off a point once the layout is resolved (layout.js): they follow a move, but say nothing of a turn, so only the points they come from are checked.
const DERIVED = new Set(['loft.edgeX', 'loft.ladder.footX', 'village.garage.pumps.xs', 'village.garage.pumps.z']);

const moved = (name, change) => {
  const anchors = { ...RAW_LAYOUT.anchors, [name]: { ...RAW_LAYOUT.anchors[name], ...change(RAW_LAYOUT.anchors[name]) } };
  return resolveLayout({ ...RAW_LAYOUT, anchors });
};
const isNumber = (v) => typeof v === 'number';
const isTuple = (v) => Array.isArray(v) && (v.length === 2 || v.length === 3) && v.every(isNumber);
const near = (a, b) => Math.abs(a - b) < 1e-4;

// The same point, the same way round, after the anchor (ax, az) turns a quarter: world +z becomes where world +x was.
const quarter = (ax, az, x, z) => ({ x: ax + (z - az), z: az - (x - ax) });

function expectedPoint(mode, a, x, z) {
  return mode === 'move' ? { x: x + MOVE.x, z: z + MOVE.z } : quarter(a.x, a.z, x, z);
}

// Walks an anchored value, unmoved `b` against resolved `m`, writing every difference from what moving or turning should do to `bad`.
function checkOwned(mode, a, b, m, path, bad) {
  if (Array.isArray(b)) {
    if (isTuple(b)) {
      const p = expectedPoint(mode, a, b[0], b[1]);
      const want = [p.x, p.z, ...(b.length === 3 ? [b[2] + (mode === 'turn' ? Math.PI / 2 : 0)] : [])];
      want.forEach((v, i) => { if (!near(v, m[i])) bad.push(`${path}[${i}]: wanted ${v}, got ${m[i]}`); });
    } else if (b.length && b.every(isNumber)) {
      b.forEach((v, i) => { if (!near(v + (mode === 'move' ? MOVE.x : 0), m[i])) bad.push(`${path}[${i}]: ${v} became ${m[i]}`); });
    } else b.forEach((v, i) => checkOwned(mode, a, v, m[i], `${path}[${i}]`, bad));
    return;
  }
  if (!b || typeof b !== 'object') {
    if (b !== m) bad.push(`${path}: ${b} became ${m}`);
    return;
  }
  const has = (k) => isNumber(b[k]);
  const point = has('x') && has('z') ? expectedPoint(mode, a, b.x, b.z) : null;
  const rect = has('minX') && has('maxX') && has('minZ') && has('maxZ');
  const corners = rect ? [expectedPoint(mode, a, b.minX, b.minZ), expectedPoint(mode, a, b.maxX, b.maxZ)] : null;
  const turned = mode === 'turn';
  for (const k of Object.keys(b)) {
    const here = `${path}.${k}`;
    if (DERIVED.has(here)) {
      if (mode === 'move') {
        const want = Array.isArray(b[k]) ? b[k].map((v) => v + MOVE.x) : b[k] + (X_KEYS.has(k) ? MOVE.x : MOVE.z);
        if (JSON.stringify(want.length ? want.map((v) => +v.toFixed(4)) : +want.toFixed(4)) !== JSON.stringify(m[k].length ? m[k].map((v) => +v.toFixed(4)) : +m[k].toFixed(4))) bad.push(`${here}: did not move with it`);
      }
      continue;
    }
    if (isNumber(b[k])) {
      let want = b[k];
      if (point && k === 'x') want = point.x;
      else if (point && k === 'z') want = point.z;
      else if (rect && /^(min|max)[XZ]$/.test(k)) {
        const xs = [corners[0].x, corners[1].x];
        const zs = [corners[0].z, corners[1].z];
        want = { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }[k];
      } else if (k === 'yaw' && point) want = b.yaw + (turned ? Math.PI / 2 : 0);
      else if (turned && !has('yaw') && point && has('halfX') && has('halfZ') && (k === 'halfX' || k === 'halfZ')) want = k === 'halfX' ? b.halfZ : b.halfX;
      else if (X_KEYS.has(k) || Z_KEYS.has(k)) want = b[k] + (X_KEYS.has(k) ? MOVE.x : MOVE.z) * (mode === 'move' ? 1 : 0);
      if (!near(want, m[k])) bad.push(`${here}: wanted ${want}, got ${m[k]}`);
    } else checkOwned(mode, a, b[k], m[k], here, bad);
  }
}

// Everything outside the moved anchor's pieces must be exactly as it was.
function checkUnowned(b, m, path, owned, bad) {
  if (owned.has(path)) return;
  if (Array.isArray(b)) b.forEach((v, i) => checkUnowned(v, m[i], `${path}[${i}]`, owned, bad));
  else if (b && typeof b === 'object') for (const k of Object.keys(b)) checkUnowned(b[k], m?.[k], path ? `${path}.${k}` : k, owned, bad);
  else if (b !== m) bad.push(`${path}: ${b} became ${m}`);
}

describe('moving and turning an anchor', () => {
  const unmoved = resolveLayout(RAW_LAYOUT);
  const pieces = anchoredPaths(RAW_LAYOUT);
  const at = (tree, path) => path.split(/\.|(?=\[)/).filter(Boolean).reduce((v, k) => v[k.startsWith('[') ? Number(k.slice(1, -1)) : k], tree);

  it('has something on every anchor', () => {
    for (const name of Object.keys(RAW_LAYOUT.anchors)) expect(pieces.filter((p) => p.anchor === name).length, name).toBeGreaterThan(0);
  });

  for (const name of Object.keys(RAW_LAYOUT.anchors)) {
    const a = RAW_LAYOUT.anchors[name];
    const mine = pieces.filter((p) => p.anchor === name).map((p) => p.path);
    const run = (mode, change) => {
      const after = moved(name, change);
      const bad = [];
      for (const path of mine) checkOwned(mode, a, at(unmoved, path), at(after, path), path, bad);
      checkUnowned(unmoved, after, '', new Set([...mine, 'anchors']), bad); // the anchors table is what moved
      return bad;
    };

    it(`moves ${name} by (37, -12) and everything of its moves with it, and nothing else`, () => {
      expect(run('move', () => ({ x: a.x + MOVE.x, z: a.z + MOVE.z }))).toEqual([]);
    });

    it(`turns ${name} a quarter and everything of its turns with it, and nothing else`, () => {
      expect(run('turn', () => ({ yaw: (a.yaw ?? 0) + Math.PI / 2, turnable: true }))).toEqual([]);
    });
  }
});

describe('an anchor the game cannot draw turned', () => {
  const withAnchor = (change) => ({ ...RAW_LAYOUT, anchors: { ...RAW_LAYOUT.anchors, barn: { ...RAW_LAYOUT.anchors.barn, ...change } } });

  it('is refused, naming the anchor, when it has a yaw and is not turnable', () => {
    expect(() => resolveLayout(withAnchor({ yaw: Math.PI / 2 }))).toThrow(/anchor 'barn'.*doesn't honour a yaw/);
  });

  it('is allowed once the anchor says turnable', () => {
    expect(() => resolveLayout(withAnchor({ yaw: Math.PI / 2, turnable: true }))).not.toThrow();
  });

  it('needs nothing when the yaw is 0', () => {
    expect(() => resolveLayout(withAnchor({ yaw: 0 }))).not.toThrow();
    expect(() => resolveLayout({ ...RAW_LAYOUT, anchors: { ...RAW_LAYOUT.anchors, barn: { x: -64, z: 60 } } })).not.toThrow();
  });

  it('applies to the shipped layout: no anchor is turned or turnable yet', () => {
    for (const a of Object.values(RAW_LAYOUT.anchors)) expect(a.yaw ?? 0).toBe(0);
  });
});
