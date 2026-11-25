#!/usr/bin/env node
// How steep a track is (#1061): its centreline sampled every metre against the terrain, the pitch along it (the rise from one sample to the next) and
// across it (the fall from one edge of the track to the other at a sample), in degrees, with the stretches steeper than a limit and the worst in
// each field. The functions are pure; tests/boundaryTrackPitch.test.js holds the boundary track to them.
//
//   node tools/trackPitch.mjs                    the boundary track against 20 degrees
//   node tools/trackPitch.mjs stoneNorth 15      any road of the network, against any limit

import { pathToFileURL } from 'node:url';

const deg = (r) => (Math.atan(r) * 180) / Math.PI;

/**
 * Every `step` m along road `id` of the network `net`: `{ s, x, z, along, across }`, game metres and degrees. `along` is the pitch from this sample to
 * the next (the last sample to the road's end), `across` the fall between the track's two edges, its half width either side of the centreline.
 */
export function trackPitch(net, id, heightAt, { step = 1 } = {}) {
  const road = net.road(id);
  const half = road.halfWidth;
  const out = [];
  for (let s = 0; s < road.length; s += step) {
    const p = net.pointAt(id, s);
    const q = net.pointAt(id, Math.min(road.length, s + step));
    const run = Math.hypot(q.x - p.x, q.z - p.z);
    const along = run > 1e-6 ? deg(Math.abs(heightAt(q.x, q.z) - heightAt(p.x, p.z)) / run) : 0;
    const [nx, nz] = [-p.tz, p.tx];
    const across = deg(Math.abs(heightAt(p.x + nx * half, p.z + nz * half) - heightAt(p.x - nx * half, p.z - nz * half)) / (2 * half));
    out.push({ s, x: p.x, z: p.z, along, across });
  }
  return out;
}

/** The runs of samples steeper than `limit` along or across, joined when under `join` m apart: `{ from, to, along, across, first, last }`. */
export function stretchesOver(samples, limit, join = 5) {
  const runs = [];
  for (const r of samples) {
    if (r.along <= limit && r.across <= limit) continue;
    const last = runs[runs.length - 1];
    if (last && r.s - last.to <= join) Object.assign(last, { to: r.s, along: Math.max(last.along, r.along), across: Math.max(last.across, r.across), last: r });
    else runs.push({ from: r.s, to: r.s, along: r.along, across: r.across, first: r, last: r });
  }
  return runs;
}

/** The steepest sample along and across: `{ along, across }`, each a sample. */
export const steepest = (samples) => ({
  along: samples.reduce((a, r) => (r.along > a.along ? r : a), samples[0]),
  across: samples.reduce((a, r) => (r.across > a.across ? r : a), samples[0]),
});

async function main([id = 'boundaryTrack', limitArg = '20']) {
  const limit = Number(limitArg);
  const { LAYOUT } = await import('../src/world/layout.js');
  const { PLAN_ORIGIN } = await import('../src/world/layoutNew.js');
  const { createTerrainHeight } = await import('../src/world/terrainHeight.js');
  const { Track } = await import('../src/world/track.js');
  const { roadNetwork } = await import('../src/world/roads.js');
  const { createFields } = await import('../src/world/fields.js');
  const heights = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints));
  const fields = createFields(LAYOUT);
  const net = roadNetwork(LAYOUT);
  const samples = trackPitch(net, id, (x, z) => heights.heightAt(x, z));
  const where = (r) => `game (${r.x.toFixed(0)}, ${r.z.toFixed(0)}), plan (${(r.x + PLAN_ORIGIN[0]).toFixed(0)}, ${(r.z + PLAN_ORIGIN[1]).toFixed(0)}), ${fields.areaOf(r.x, r.z)}`;
  const worst = steepest(samples);
  console.log(`${id}: ${net.road(id).length.toFixed(0)} m, ${samples.length} samples a metre apart`);
  console.log(`steepest along ${worst.along.along.toFixed(1)} degrees at ${where(worst.along)}`);
  console.log(`steepest across ${worst.across.across.toFixed(1)} degrees at ${where(worst.across)}`);
  const runs = stretchesOver(samples, limit);
  console.log(`${runs.length} stretches steeper than ${limit} degrees${runs.length ? ':' : ''}`);
  for (const u of runs) console.log(`  ${u.from} to ${u.to} m: along ${u.along.toFixed(1)}, across ${u.across.toFixed(1)}; from ${where(u.first)} to plan (${(u.last.x + PLAN_ORIGIN[0]).toFixed(0)}, ${(u.last.z + PLAN_ORIGIN[1]).toFixed(0)})`);
  const byField = new Map();
  for (const r of samples) {
    const k = fields.areaOf(r.x, r.z);
    const b = byField.get(k) ?? { metres: 0, along: 0, across: 0 };
    byField.set(k, { metres: b.metres + 1, along: Math.max(b.along, r.along), across: Math.max(b.across, r.across) });
  }
  console.log('steepest in each field it runs through:');
  for (const [k, b] of byField) console.log(`  ${k}: ${b.metres} m, along ${b.along.toFixed(1)}, across ${b.across.toFixed(1)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2));
