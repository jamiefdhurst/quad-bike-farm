// Starting positions that vary each game: the quads are shuffled between their
// parking slots and nudged, sometimes left elsewhere on the farm, and the jerry
// can is left at one of a few likely spots.

const MIN_GAP = 4.5; // metres between quad centres
const BIG_GAP = 6; // and between a tractor, UTV or Land Rover and anything else, centre to centre
const NUDGES = 8; // goes at a random nudge that misses `blocked` before a vehicle is put on its spot's middle

/**
 * Where each vehicle starts. One quad, picked at random from the first `homeCount`, is hers: it's always in the yard, and she starts beside it.
 * Up to `spawn.yardMax` go in the yard (hers among them); the rest, and now and then one that could have been in the yard, are left elsewhere
 * on the farm. `big` flags the tractor, UTV and Land Rovers (by index): they are always left out on the farm, keep further from their
 * neighbours and aren't left in a tight spot such as the Dutch barn's bay. `blocked(x, z)` says a nudged position is in the way of something
 * (spawnBlocked): it is nudged again, and at worst put on the spot's middle, which the layout keeps clear. Returns { placed: [{ x, z, yaw, where }], home }.
 */
export function randomiseQuadSpawns(spawn, count, random, { homeCount = count, big = [], blocked = () => null } = {}) {
  const slots = spawn.quads;
  const yardRoom = Math.min(slots.length, spawn.yardMax ?? slots.length);
  const home = Math.floor(random() * homeCount);
  const gapOf = (i) => (big[i] ? BIG_GAP : MIN_GAP);
  const indices = Array.from({ length: count }, (_, i) => i);
  const nudge = (x, z, j) => {
    for (let n = 0; n < NUDGES; n++) {
      const at = { x: x + (random() * 2 - 1) * j, z: z + (random() * 2 - 1) * j };
      if (!blocked(at.x, at.z)) return at;
    }
    return { x, z };
  };
  for (let attempt = 0; attempt < 60; attempt++) {
    // Who is left away from the yard: the big ones, then some by chance, then whoever there isn't room for.
    const away = indices.map((i) => i !== home && (big[i] || random() < spawn.awayChance));
    const stay = indices.filter((i) => !away[i]);
    while (stay.length > yardRoom) {
      const out = stay.splice(Math.floor(random() * stay.length), 1)[0];
      if (out === home) stay.push(out); // hers stays; try again
      else away[out] = true;
    }
    // The big ones choose first, so they have their pick of the roomy spots.
    const awaySpots = spawn.away.slice().sort(() => random() - 0.5);
    const placed = [];
    let enough = true;
    for (const i of indices.filter((k) => away[k]).sort((a, b) => (big[b] ? 1 : 0) - (big[a] ? 1 : 0))) {
      const at = awaySpots.findIndex((a) => !(big[i] && a.tight));
      if (at < 0) {
        enough = false;
        break;
      }
      const a = awaySpots.splice(at, 1)[0];
      const p = nudge(a.x, a.z, a.jitter ?? spawn.awayJitter); // a tight spot has its own
      placed[i] = { ...p, yaw: random() * Math.PI * 2, where: a.where };
    }
    if (!enough) continue;
    const order = slots.map((s, i) => i).sort(() => random() - 0.5); // which stays where
    let next = 0;
    for (const i of stay) {
      const s = slots[order[next++]];
      const flip = random() < spawn.quadFlipChance ? Math.PI : 0;
      const p = nudge(s.x, s.z, spawn.quadJitter);
      placed[i] = { ...p, yaw: s.yaw + flip + (random() * 2 - 1) * spawn.quadYawJitter, where: 'in the yard' };
    }
    const clear = placed.every((a, i) => placed.every((b, j) => i === j || Math.hypot(a.x - b.x, a.z - b.z) >= Math.max(gapOf(i), gapOf(j))));
    if (clear) return { placed, home };
  }
  // Nothing fitted: the parking slots, then the open spots, unjittered (the big ones only on the open spots).
  const yard = slots.map((s) => ({ ...s, where: 'in the yard' }));
  const open = spawn.away.filter((a) => !a.tight).map((a) => ({ x: a.x, z: a.z, yaw: 0, where: a.where }));
  let y = 0;
  let o = 0;
  return { placed: indices.map((i) => (!big[i] && y < yardRoom ? yard[y++] : open[o++ % open.length])), home: indices.find((i) => !big[i]) ?? 0 };
}

/**
 * Ground no vehicle may start on, as circles { x, z, r, what }: the trailers, the fuel tank and bowser, the silage stack, the barn and its
 * doorway, the paddock, the straw bales, the bell, the trees by the barn, the jump and its run-up, the drag strip and the bog in the field.
 * `r` is how far a vehicle's centre must keep from the middle. The track is checked separately (spawnBlocked). Pure, from the layout.
 */
export function spawnKeepOut(layout) {
  const out = [];
  const add = (x, z, r, what) => out.push({ x, z, r, what });
  const L = layout;
  if (L.tipTrailer) add(L.tipTrailer.x, L.tipTrailer.z, 5.5, 'the tipping trailer');
  if (L.sprayer) add(L.sprayer.x, L.sprayer.z, 4.5, 'the sprayer');
  if (L.trailer) add(L.trailer.x, L.trailer.z, 8, 'the bale trailer');
  if (L.fuelTank) add(L.fuelTank.x, L.fuelTank.z, 4, 'the petrol tank');
  if (L.dieselBowser) add(L.dieselBowser.x, L.dieselBowser.z, 4, 'the diesel bowser');
  if (L.hose) add(L.hose.x, L.hose.z, 3, 'the hose');
  if (L.bell) add(L.bell.x, L.bell.z, 3, 'the bell');
  if (L.barn) {
    add(L.barn.x, L.barn.z, Math.hypot(L.barn.halfX, L.barn.halfZ) + 3, 'the barn');
    add(L.barn.x + L.barn.halfX + 3, L.barn.z, 5, 'the barn doorway');
    if (L.barn.annex) {
      const az = L.barn.z + L.barn.halfZ + L.barn.annex.halfZ; // the second span, and its doorway
      add(L.barn.x, az, Math.hypot(L.barn.halfX, L.barn.annex.halfZ) + 3, 'the barn extension');
      add(L.barn.x + L.barn.halfX + 3, az, 5, 'the extension doorway');
    }
    if (L.silage) add(L.silage.x + 2.5, L.silage.z + 1.5, 5, 'the silage'); // the wrapped bales stacked beside the barn (props.js)
  }
  if (L.paddock) add(L.paddock.x, L.paddock.z, L.paddock.half * Math.SQRT2 + 3, 'the paddock');
  for (const [x, z] of L.strawBaleSpots ?? []) add(x, z, 3.5, 'a straw bale');
  for (const [x, z] of [[-76, 72], [-84, 52]]) add(x, z, 4, 'a tree by the barn'); // the trees behind the barn (props.js)
  if (L.jumpRamp) {
    const r = L.jumpRamp;
    const fx = Math.sin(r.yaw);
    const fz = Math.cos(r.yaw);
    for (let a = -22; a <= r.length + 14; a += 6) add(r.x + fx * a, r.z + fz * a, 6, 'the jump');
  }
  if (L.dragStrip) {
    const d = L.dragStrip;
    const fx = Math.sin(d.yaw);
    const fz = Math.cos(d.yaw);
    for (let a = -8; a <= d.length + d.runOff; a += 6) add(d.x + fx * a, d.z + fz * a, d.width / 2 + 3, 'the drag strip');
  }
  if (L.bonfire) add(L.bonfire.x, L.bonfire.z, 6, 'the bonfire');
  for (const b of L.bogs ?? []) if (b.x !== undefined) add(b.x, b.z, b.radius + 4, 'the bog');
  return out;
}

/**
 * What's in the way of a vehicle starting at (x, z), or null if nothing is: one of the keep-out circles, or the track (closer than
 * `trackClear` metres to its edge, if a track is given).
 */
export function spawnBlocked(keepOut, x, z, { track = null, trackHalfWidth = 2.3, trackClear = 3 } = {}) {
  const hit = keepOut.find((k) => Math.hypot(x - k.x, z - k.z) < k.r);
  if (hit) return hit.what;
  if (track && track.distanceTo(x, z, trackHalfWidth + trackClear + 1) < trackHalfWidth + trackClear) return 'the track';
  return null;
}

/** Where `count` jerry cans start: each at a different one of the layout's spots, picked at random, with a little jitter. */
export function randomJerryCanSpots(layout, random, count) {
  const left = [...layout.jerryCanSpots];
  return Array.from({ length: Math.min(count, left.length) }, () => jerryCanSpotAt(layout, left.splice(Math.floor(random() * left.length), 1)[0], random));
}

export function randomJerryCanSpot(layout, random) {
  return randomJerryCanSpots(layout, random, 1)[0];
}

function jerryCanSpotAt(layout, spot, random) {
  const j = layout.jerryCanJitter;
  return {
    x: spot.x + (random() * 2 - 1) * j,
    z: spot.z + (random() * 2 - 1) * j,
    yaw: spot.yaw + (random() * 2 - 1) * 0.6,
    where: spot.where,
  };
}
