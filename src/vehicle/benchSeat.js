/** The bench seats you can take beside a girl who is driving the UTV or the Land Rover, nearest the door first. */
export const BENCH_SEATS = ['left', 'mid'];

/**
 * Which seat you get in: the one by the door if it is free, else the middle (the other girl is by the window). `taken` is a Set or array
 * of seat names with someone in them or on the way. Null when the bench is full.
 */
export function pickBenchSeat(taken) {
  const t = new Set(taken);
  return BENCH_SEATS.find((s) => !t.has(s)) ?? null;
}

/** Where you step down: the door side, a little further out each try, then behind it (model frame, x towards the left). */
export function benchDismountSpots(stand) {
  return [
    [stand.x, stand.z],
    [stand.x + 0.5, stand.z],
    [stand.x, stand.z - 1.1],
    [stand.x, stand.z + 1.1],
  ];
}
