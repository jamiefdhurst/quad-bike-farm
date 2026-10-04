// Starting positions that vary a little each game: the quads are shuffled
// between their parking slots and nudged, and the jerry can is left at one of
// a few likely spots.

const MIN_GAP = 2.8; // metres between quad centres

export function randomiseQuadSpawns(spawn, count, random) {
  const slots = spawn.quads.slice(0, count);
  for (let attempt = 0; attempt < 40; attempt++) {
    // Shuffle which quad gets which slot.
    const order = slots.map((s, i) => i).sort(() => random() - 0.5);
    const placed = order.map((slot) => {
      const s = slots[slot];
      return {
        x: s.x + (random() * 2 - 1) * spawn.quadJitter,
        z: s.z + (random() * 2 - 1) * spawn.quadJitter,
        yaw: s.yaw + (random() * 2 - 1) * spawn.quadYawJitter,
      };
    });
    const clear = placed.every((a, i) => placed.every((b, j) => i === j || Math.hypot(a.x - b.x, a.z - b.z) >= MIN_GAP));
    if (clear) return placed;
  }
  return slots.map((s) => ({ ...s }));
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
