// Placing a building's contents from the building (#661). Pure: no Three.js, no DOM.
//
// `layout.js` writes everything that belongs to a building or a set piece (the barn's bench, the yard's bell, the village's cottages) as an offset
// from that piece's anchor, `{ x, z, yaw }`, wrapped in `at('barn', ...)`. `resolveLayout` turns each one into the absolute numbers every reader of
// `LAYOUT` already uses. Moving a piece is then one anchor, and turning it turns everything with it.
//
// An offset is in the anchor's own frame: with yaw 0 it is the world's, and a yaw turns the frame the way Three.js turns an object about y, so
// local +z points where a thing with that yaw faces (sin yaw, cos yaw). Inside an `at(...)`:
//   - `{ x, z }` is a point. A `yaw` beside it turns with the anchor. `halfX` and `halfZ` with no `yaw` are an axis-aligned box and swap on a quarter turn.
//   - `{ minX, maxX, minZ, maxZ }` is a rectangle (it stays one, so only quarter turns).
//   - an array of `[x, z]` or `[x, z, yaw]` is a list of points.
//   - an `x` or `z` on its own, or a flat list of them, is a line across the anchor's frame: it moves, and turns by a half turn, but a quarter turn
//     cannot say which axis it is on, so it throws (give the thing its other coordinate, as `loft.edge` and `ladder.x` do).
//   - anything else (`y`, `radius`, `length`, `width`, a name) is a scalar and stays as it is.

const QUARTER = Math.PI / 2;
const COS = [1, 0, -1, 0];
const SIN = [0, 1, 0, -1];

export class Anchored {
  constructor(anchor, value) {
    this.anchor = anchor;
    this.value = value;
  }
}

/** Marks `value` (a point, a rectangle, a list of points or an object holding them) as given in the frame of the anchor called `anchor`. */
export const at = (anchor, value) => new Anchored(anchor, value);

/** How many quarter turns `yaw` is (0 to 3), or null if it is not one. */
export function quarterTurns(yaw) {
  const k = Math.round(yaw / QUARTER);
  return Math.abs(yaw - k * QUARTER) < 1e-9 ? ((k % 4) + 4) % 4 : null;
}

// Offsets are written to a few decimals and so are the numbers they resolve to: rounding to a micron keeps -64 + 1.7 as -62.3.
const tidy = (v) => Math.round(v * 1e6) / 1e6 + 0;

const isNumber = (v) => typeof v === 'number';
const isTuple = (v) => Array.isArray(v) && (v.length === 2 || v.length === 3) && v.every(isNumber);
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Anchored);

function frameOf(anchor, name) {
  if (!anchor || !isNumber(anchor.x) || !isNumber(anchor.z)) throw new Error(`layout: no anchor called '${name}'`);
  const yaw = anchor.yaw ?? 0;
  const q = quarterTurns(yaw);
  return { x: anchor.x, z: anchor.z, yaw, q, c: q === null ? Math.cos(yaw) : COS[q], s: q === null ? Math.sin(yaw) : SIN[q] };
}

const pointOf = (f, lx, lz) => ({ x: tidy(f.x + lx * f.c + lz * f.s), z: tidy(f.z - lx * f.s + lz * f.c) });

function place(v, f, path) {
  if (v instanceof Anchored) throw new Error(`layout: ${path} is anchored inside another anchor`);
  if (Array.isArray(v)) {
    if (v.length && v.every(isTuple)) {
      return v.map(([x, z, yaw]) => {
        const p = pointOf(f, x, z);
        return yaw === undefined ? [p.x, p.z] : [p.x, p.z, tidy(yaw + f.yaw)];
      });
    }
    if (v.length && v.every(isNumber)) {
      if (f.q !== 0 && f.q !== 2) throw new Error(`layout: ${path} is a bare list of coordinates, which cannot turn a quarter`);
      return v.map((n) => tidy(f.q === 2 ? -n : n));
    }
    return v.map((item, i) => place(item, f, `${path}[${i}]`));
  }
  if (!isPlain(v)) return v;
  const out = {};
  for (const [k, val] of Object.entries(v)) out[k] = place(val, f, `${path}.${k}`);
  const has = (k) => isNumber(v[k]);
  if (has('x') && has('z')) {
    Object.assign(out, pointOf(f, v.x, v.z));
    if (has('yaw')) out.yaw = tidy(v.yaw + f.yaw);
    else if (has('halfX') && has('halfZ')) {
      if (f.q === null) throw new Error(`layout: ${path} is a box with no yaw, which cannot turn by ${f.yaw}`);
      if (f.q % 2) [out.halfX, out.halfZ] = [v.halfZ, v.halfX];
    }
  } else if (has('x') || has('z')) {
    const k = has('x') ? 'x' : 'z';
    if (f.q !== 0 && f.q !== 2) throw new Error(`layout: ${path}.${k} is one coordinate on its own, which cannot turn a quarter: give it the other`);
    out[k] = tidy(f[k] + (f.q === 2 ? -1 : 1) * v[k]);
  }
  if (has('minX') && has('maxX') && has('minZ') && has('maxZ')) {
    if (f.q === null) throw new Error(`layout: ${path} is a rectangle, which cannot turn by ${f.yaw}`);
    const corners = [pointOf(f, v.minX, v.minZ), pointOf(f, v.maxX, v.maxZ)];
    out.minX = Math.min(corners[0].x, corners[1].x);
    out.maxX = Math.max(corners[0].x, corners[1].x);
    out.minZ = Math.min(corners[0].z, corners[1].z);
    out.maxZ = Math.max(corners[0].z, corners[1].z);
  } else if ((has('minX') && has('maxX')) || (has('minZ') && has('maxZ'))) {
    const axis = has('minX') ? 'X' : 'Z';
    if (f.q !== 0 && f.q !== 2) throw new Error(`layout: ${path} is a range along one axis, which cannot turn a quarter: give it the other`);
    const a = tidy((axis === 'X' ? f.x : f.z) + (f.q === 2 ? -1 : 1) * v[`min${axis}`]);
    const b = tidy((axis === 'X' ? f.x : f.z) + (f.q === 2 ? -1 : 1) * v[`max${axis}`]);
    out[`min${axis}`] = Math.min(a, b);
    out[`max${axis}`] = Math.max(a, b);
  }
  return out;
}

function walk(v, anchors, path, onAnchored) {
  if (v instanceof Anchored) {
    onAnchored?.(path, v.anchor);
    return place(v.value, frameOf(anchors[v.anchor], v.anchor), path);
  }
  if (Array.isArray(v)) return v.map((item, i) => walk(item, anchors, `${path}[${i}]`, onAnchored));
  if (!isPlain(v)) return v;
  const out = {};
  for (const [k, val] of Object.entries(v)) out[k] = walk(val, anchors, path ? `${path}.${k}` : k, onAnchored);
  return out;
}

/** The layout with every `at(...)` turned into absolute numbers. `raw.anchors` is `{ name: { x, z, yaw } }`. */
export function resolveLayout(raw) {
  return walk(raw, raw.anchors, '', null);
}

/** Every `at(...)` in the raw layout as `{ path, anchor }`, so a test can tell what belongs to which anchor. */
export function anchoredPaths(raw) {
  const found = [];
  walk(raw, raw.anchors, '', (path, anchor) => found.push({ path, anchor }));
  return found;
}
