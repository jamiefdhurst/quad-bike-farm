// Starting positions that vary each game: the quads are shuffled between their
// parking slots and nudged, sometimes left elsewhere on the farm, and the jerry
// can is left at one of a few likely spots.

const MIN_GAP = 2.8; // metres between quad centres
const BIG_GAP = 4.6; // and between a tractor, UTV or Land Rover and anything else, centre to centre

/**
 * Where each vehicle starts. One quad, picked at random from the first `homeCount`, is hers: it's always in the yard, and she starts beside it.
 * The rest go in the yard or, now and then, are left elsewhere on the farm; with more vehicles than parking slots the extras are left out on the
 * farm. `big` flags the tractor, UTV and Land Rover (by index): they keep further from their neighbours and aren't left in a tight spot such as
 * the Dutch barn's bay. Returns { placed: [{ x, z, yaw, where }], home }.
 */
export function randomiseQuadSpawns(spawn, count, random, { homeCount = count, big = [] } = {}) {
  const slots = spawn.quads.slice(0, count);
  const home = Math.floor(random() * homeCount);
  const gapOf = (i) => (big[i] ? BIG_GAP : MIN_GAP);
  const indices = Array.from({ length: count }, (_, i) => i);
  for (let attempt = 0; attempt < 60; attempt++) {
    // Who is left away from the yard: by chance, then whoever there isn't a slot for.
    const away = indices.map((i) => i !== home && random() < spawn.awayChance);
    const stay = indices.filter((i) => !away[i]);
    while (stay.length > slots.length) {
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
      const j = a.jitter ?? spawn.awayJitter; // a tight spot has its own
      placed[i] = { x: a.x + (random() * 2 - 1) * j, z: a.z + (random() * 2 - 1) * j, yaw: random() * Math.PI * 2, where: a.where };
    }
    if (!enough) continue;
    const order = slots.map((s, i) => i).sort(() => random() - 0.5); // which stays where
    let next = 0;
    for (const i of stay) {
      const s = slots[order[next++]];
      const flip = random() < spawn.quadFlipChance ? Math.PI : 0;
      placed[i] = {
        x: s.x + (random() * 2 - 1) * spawn.quadJitter,
        z: s.z + (random() * 2 - 1) * spawn.quadJitter,
        yaw: s.yaw + flip + (random() * 2 - 1) * spawn.quadYawJitter,
        where: 'in the yard',
      };
    }
    const clear = placed.every((a, i) => placed.every((b, j) => i === j || Math.hypot(a.x - b.x, a.z - b.z) >= Math.max(gapOf(i), gapOf(j))));
    if (clear) return { placed, home };
  }
  // Nothing fitted: the parking slots, then the open spots, unjittered.
  const spots = [...slots.map((s) => ({ ...s, where: 'in the yard' })), ...spawn.away.filter((a) => !a.tight).map((a) => ({ x: a.x, z: a.z, yaw: 0, where: a.where }))];
  return { placed: indices.map((i) => spots[i % spots.length]), home };
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
