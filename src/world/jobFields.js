// Which field each farm job happens on (#691, docs/farm-plan.md "One job per field"), and the job's area as the field's polygon rather than a
// rectangle. Pure: no Three.js, no DOM. The jobs still read their place as a rectangle with `minX..maxZ` (the layout's `hayMeadow`, `sprayField`
// and `harrowField`); on the new farm that rectangle is the polygon's bounds and carries the polygon as `poly`, so a cell of a job's grid
// outside the field is simply not there (`liveCells`).

import { polygonBounds, polygonArea, insetPolygon, pointInPolygon, polygonEdges, distanceToEdges, intersectPolygons, rectPolygon } from './polygons.js';
import { HEADLAND_WIDTH } from './farmTracks.js';

/**
 * The field (a key of the plan's fields) each job happens on, on the new farm. Until the crop year decides (#697, #698) the muck goes on Long Piece,
 * the spraying on Lane Field and the harrowing on Low Ley (settled with Jamie, 13 November 2026). The feeding is the hens and the pig in the yard's
 * orchard; nothing feeds the sheep yet.
 */
export const JOB_FIELDS = {
  muck: 'longpiece',
  silage: 'ley',
  hay: 'hay',
  spray: 'lanefield',
  harrow: 'ley',
  logs: 'wood',
  feed: 'farmstead',
};

/** The jobs whose place is a patch of a field that is worked cell by cell, with the layout key each reads it from, and whether its edge is the headland's. */
export const FIELD_WORK = {
  hay: { key: 'hayMeadow', headland: false },
  spray: { key: 'sprayField', headland: true },
  harrow: { key: 'harrowField', headland: false },
};

/** The field `name` in the layout's `fields`, or undefined (today's farm has none). */
export const fieldOf = (layout, name) => layout.fields?.find((f) => f.name === name);

/** Metres in from a field's hedge lines a job's ground starts, so a point on the line it shares with the next field is never that field's (#1110). */
export const FIELD_EDGE = 1;

/** Metres from the brook's water's edge to a job's: past its banks, gravel bars and the ford's landings, where nothing is cut into the field (#1110). */
export const BROOK_CLEAR = 8;

/**
 * A job's place as the rectangle the jobs read, with the polygon on it: the field's own outline `FIELD_EDGE` in from its hedges, or its
 * headland-free middle (the headland is ploughed round last and sprayed by no one), and cut clear of the brook where it runs through
 * (`brook`, world/brook.js). `area` is square metres.
 */
export function jobPlace(field, headland = false, brook = null) {
  const inset = insetPolygon(field.points, headland ? HEADLAND_WIDTH : FIELD_EDGE);
  const poly = brook ? clearOfBrook(inset, brook) : inset;
  return { ...polygonBounds(poly), poly, area: polygonArea(poly), field: field.name };
}

/**
 * `poly` with what lies across the brook cut off: the brook's line, `BROOK_CLEAR` m off its water either side (measured along z, so a little less out from the water where it bends sharply), splits the field, and the larger
 * side is the field's (Low Ley's south strip, beyond the water, is left out). A field the brook doesn't reach is as it was.
 */
export function clearOfBrook(poly, brook, clear = BROOK_CLEAR) {
  const edges = polygonEdges(poly);
  const b = polygonBounds(poly);
  const line = brook.line(2).filter((p) => p.x >= b.minX - 2 && p.x <= b.maxX + 2);
  if (!line.some((p) => [-1, 0, 1].some((s) => pointInPolygon(poly, p.x, p.z + s * (p.half + clear), 0, edges)))) return poly;
  const x0 = b.minX - 10;
  const x1 = b.maxX + 10;
  const far = b.maxZ - b.minZ + 100;
  // Each side of the water as one shape: the line's bank, carried out past the field's ends, and a long way out from the water.
  const side = (s) => {
    const bank = line.map((p) => [p.x, p.z + s * (p.half + clear)]);
    const zEnd = (p) => p.z + s * (p.half + clear);
    return [[x0, zEnd(line[0])], ...bank, [x1, zEnd(line[line.length - 1])], [x1, b.maxZ * (s > 0) + b.minZ * (s < 0) + s * far], [x0, b.maxZ * (s > 0) + b.minZ * (s < 0) + s * far]];
  };
  const pieces = [...intersectPolygons(side(-1), poly), ...intersectPolygons(side(1), poly)];
  return pieces.reduce((best, p) => (Math.abs(polygonArea(p)) > Math.abs(polygonArea(best)) ? p : best), pieces[0] ?? poly);
}

/** The three field jobs' places on the new farm, by the layout key each reads, clear of `brook` where it has one. */
export function fieldWorkPlaces(fields, brook = null) {
  const out = {};
  for (const [job, { key, headland }] of Object.entries(FIELD_WORK)) {
    const field = fields.find((f) => f.name === JOB_FIELDS[job]);
    if (field) out[key] = jobPlace(field, headland, brook);
  }
  return out;
}

/** The outline the map draws round a job's place while it is on: its polygon, or its rectangle's corners where it has none (today's farm). */
export const placeOutline = (place) => place.poly ?? rectPolygon(place);

const edgesOf = new WeakMap(); // a place's polygon edges, worked out once

const edgesFor = (place) => {
  if (!edgesOf.has(place)) edgesOf.set(place, polygonEdges(place.poly));
  return edgesOf.get(place);
};

/**
 * Whether (x, z) is in a job's place, its polygon if it has one, otherwise its rectangle. `pad` metres counts that much of the strip outside the
 * edge as in (the ragged margin of the hay); a negative one asks to be that far inside.
 */
export function inPlace(place, x, z, pad = 0) {
  if (place.poly) return pointInPolygon(place.poly, x, z, -pad, edgesFor(place));
  return x >= place.minX - pad && x <= place.maxX + pad && z >= place.minZ - pad && z <= place.maxZ + pad;
}

/** Metres (x, z) is outside the place's edge (negative inside, 0 on it), by the polygon or the rectangle. */
export function outsideBy(place, x, z) {
  if (!place.poly) {
    const dx = Math.max(place.minX - x, 0, x - place.maxX);
    const dz = Math.max(place.minZ - z, 0, z - place.maxZ);
    const outside = Math.hypot(dx, dz);
    return outside > 0 ? outside : -Math.min(x - place.minX, place.maxX - x, z - place.minZ, place.maxZ - z);
  }
  const d = distanceToEdges(edgesFor(place), x, z);
  return pointInPolygon(place.poly, x, z, 0, edgesFor(place)) ? -d : d;
}

/**
 * Which cells of a job's grid (`cols` by `rows` of `cell` metres from the rectangle's corner) are the field: 1 where the cell's middle is in the
 * polygon, and all of them where the place has none (today's rectangles).
 */
export function liveCells(place, cols, rows, cell) {
  const live = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      live[r * cols + c] = !place.poly || inPlace(place, place.minX + (c + 0.5) * cell, place.minZ + (r + 0.5) * cell) ? 1 : 0;
    }
  }
  return live;
}

/** How many cells of `live` are the field. */
export function countLive(live) {
  let n = 0;
  for (const v of live) n += v;
  return n;
}

/**
 * The field's own cells of a job's grid, as indexes, the ones nearest the middle of its bounds first: where the debug panel puts work done at
 * once, so it is out in the field and not along one edge of it.
 */
export function liveMiddleFirst(live, cols, rows) {
  const far = (i) => Math.abs((i % cols) + 0.5 - cols / 2) + Math.abs(Math.floor(i / cols) + 0.5 - rows / 2);
  const cells = [];
  for (let i = 0; i < live.length; i++) if (live[i]) cells.push(i);
  return cells.sort((a, b) => far(a) - far(b) || a - b);
}

/** The field a job happens on, named for the chalkboard: its dealt name ("Lane Field"), or null where the farm has no such field (today's). */
export function jobFieldLabel(layout, job) {
  const name = JOB_FIELDS[job];
  const field = fieldOf(layout, name);
  return field ? field.label ?? name : null; // its dealt name, or its key where the layout has none (fieldNames.js `fieldLabel`, which this can't import: farm/farmSave.js reads the layout)
}
