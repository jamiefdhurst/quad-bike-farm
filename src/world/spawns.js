// Starting positions that vary each game: the quads are shuffled between their
// parking slots and nudged, sometimes left elsewhere on the farm, and the jerry
// can is left at one of a few likely spots.

const MIN_GAP = 2.8; // metres between quad centres

/**
 * Where each quad starts. One quad, picked at random, is hers: it's always in the
 * yard, and she starts beside it. The rest go in the yard or, now and then, are
 * left elsewhere on the farm. Returns { placed: [{ x, z, yaw, where }], home }.
 */
export function randomiseQuadSpawns(spawn, count, random) {
  const slots = spawn.quads.slice(0, count);
  const home = Math.floor(random() * count);
  for (let attempt = 0; attempt < 40; attempt++) {
    // Shuffle which quad gets which slot.
    const order = slots.map((s, i) => i).sort(() => random() - 0.5);
    const awaySpots = spawn.away.slice().sort(() => random() - 0.5);
    const placed = order.map((slot, i) => {
      if (i !== home && random() < spawn.awayChance) {
        const a = awaySpots.pop();
        return {
          x: a.x + (random() * 2 - 1) * spawn.awayJitter,
          z: a.z + (random() * 2 - 1) * spawn.awayJitter,
          yaw: random() * Math.PI * 2,
          where: a.where,
        };
      }
      const s = slots[slot];
      const flip = random() < spawn.quadFlipChance ? Math.PI : 0;
      return {
        x: s.x + (random() * 2 - 1) * spawn.quadJitter,
        z: s.z + (random() * 2 - 1) * spawn.quadJitter,
        yaw: s.yaw + flip + (random() * 2 - 1) * spawn.quadYawJitter,
        where: 'in the yard',
      };
    });
    const clear = placed.every((a, i) => placed.every((b, j) => i === j || Math.hypot(a.x - b.x, a.z - b.z) >= MIN_GAP));
    if (clear) return { placed, home };
  }
  return { placed: slots.map((s) => ({ ...s, where: 'in the yard' })), home };
}

export function randomJerryCanSpot(layout, random) {
  const spots = layout.jerryCanSpots;
  const spot = spots[Math.floor(random() * spots.length)];
  const j = layout.jerryCanJitter;
  return {
    x: spot.x + (random() * 2 - 1) * j,
    z: spot.z + (random() * 2 - 1) * j,
    yaw: spot.yaw + (random() * 2 - 1) * 0.6,
    where: spot.where,
  };
}
