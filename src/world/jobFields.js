// Which field each farm job happens on (#691, docs/farm-plan.md "One job per field"), and the job's area as the field's polygon rather than a
// rectangle. Pure: no Three.js, no DOM. The jobs still read their place as a rectangle with `minX..maxZ` (the layout's `hayMeadow`, `sprayField`
// and `harrowField`); on the new farm that rectangle is the polygon's bounds and carries the polygon as `poly`, so a cell of a job's grid
// outside the field is simply not there (`liveCells`).

import { polygonBounds, polygonArea, insetPolygon, pointInPolygon, polygonEdges, distanceToEdges } from './polygons.js';
import { HEADLAND_WIDTH } from './farmTracks.js';

/**
 * The field (a key of the plan's fields) each job happens on, on the new farm. Until the crop year decides (#697, #698) the muck goes on Long Piece,
 * the spraying on Lane Field and the harrowing on Low Ley (settled with Jamie, 13 November 2026). The feeding is in the yard's orchard and, for the
 * sheep, the sheep field.
 */
export const JOB_FIELDS = {
  muck: 'longpiece',
  silage: 'ley',
  hay: 'hay',
  spray: 'lanefield',
  harrow: 'ley',
  logs: 'wood',
  feed: 'farmstead',
  feedSheep: 'sheep',
};

/** The jobs whose place is a patch of a field that is worked cell by cell, with the layout key each reads it from, and whether its edge is the headland's. */
export const FIELD_WORK = {
  hay: { key: 'hayMeadow', headland: false },
  spray: { key: 'sprayField', headland: true },
  harrow: { key: 'harrowField', headland: false },
};

/** The field `name` in the layout's `fields`, or undefined (today's farm has none). */
export const fieldOf = (layout, name) => layout.fields?.find((f) => f.name === name);

/**
 * A job's place as the rectangle the jobs read, with the polygon on it: the field's own outline, or its headland-free middle (the headland is
 * ploughed round last and sprayed by no one). `area` is square metres.
 */
export function jobPlace(field, headland = false) {
  const poly = headland ? insetPolygon(field.points, HEADLAND_WIDTH) : field.points;
  return { ...polygonBounds(poly), poly, area: polygonArea(poly), field: field.name };
}

/** The three field jobs' places on the new farm, by the layout key each reads. */
export function fieldWorkPlaces(fields) {
  const out = {};
  for (const [job, { key, headland }] of Object.entries(FIELD_WORK)) {
    const field = fields.find((f) => f.name === JOB_FIELDS[job]);
    if (field) out[key] = jobPlace(field, headland);
  }
  return out;
}

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

/** The field a job happens on, named for the chalkboard: its dealt name ("Lane Field"), or null where the farm has no such field (today's). */
export function jobFieldLabel(layout, job) {
  const name = JOB_FIELDS[job];
  const field = fieldOf(layout, name);
  return field ? field.label ?? name : null; // its dealt name, or its key where the layout has none (fieldNames.js `fieldLabel`, which this can't import: farm/farmSave.js reads the layout)
}
