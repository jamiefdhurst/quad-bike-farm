// The river's sound (#999): water over stones at the crossing and a murmur along the deep reaches, from the nearest point of the river, louder when the
// stream is up and in rain, heard from about 40 m; and by day rooks, a pied wagtail, a moorhen and the willows' leaves in the wind. Pure: where you are,
// the river (brook.js) and the weather in, how much of each out; the sound itself is made on the spot by `audio/riverAudio.js`.

export const DEFAULT_RIVER_SOUND_PARAMS = {
  heardFrom: 40, // m from the river's water at which its sound has fallen to nothing
  crossingBoost: 0.9, // how much more babble the crossing's riffle has than a reach of deep water
  crossingReach: 14, // m either side of the crossing over which its babble fades into the rest
  upBoost: 0.8, // how much louder it runs with the stream full (`streamLevel` 1) than low
  rainBoost: 0.35, // and how much louder again in steady rain (the rain on the water and the run-off)
  birdsEvery: 9, // seconds between one bird's calls and the next, near the water by day, on average
  willowWind: 1, // how much the willows' leaves rustle in a full wind
};

export const RIVER_SOUND_RANGES = {
  heardFrom: [10, 120, 1],
  crossingBoost: [0, 3, 0.05],
  crossingReach: [2, 40, 1],
  upBoost: [0, 3, 0.05],
  rainBoost: [0, 2, 0.05],
  birdsEvery: [2, 60, 1],
  willowWind: [0, 2, 0.05],
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const boxes = new WeakMap(); // brook -> the box round its river's water

/**
 * The nearest point of the river's water to (x, z): { x, z, d } with `d` the metres from (x, z) to the water's edge there (0 on or in it), or null if the
 * river is further than `within` m. Only the river (`riverK` over a tenth), not the narrow brook either end of it.
 */
export function nearestRiver(brook, x, z, within = 60) {
  if (!brook?.river) return null;
  // Most of the farm is nowhere near it: a box round the river's water, worked out once, says so before the search along it (it runs every frame).
  if (!boxes.has(brook)) {
    const b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (let xx = brook.minX; xx <= brook.maxX; xx += 1) {
      if (brook.riverK(xx) < 0.1) continue;
      const zc = brook.zAt(xx);
      const half = brook.halfAt(xx);
      b.minX = Math.min(b.minX, xx); b.maxX = Math.max(b.maxX, xx);
      b.minZ = Math.min(b.minZ, zc - half); b.maxZ = Math.max(b.maxZ, zc + half);
    }
    boxes.set(brook, b);
  }
  const box = boxes.get(brook);
  if (x < box.minX - within - 1 || x > box.maxX + within + 1 || z < box.minZ - within - 1 || z > box.maxZ + within + 1) return null;
  let best = null;
  const span = (from, to, step) => {
    for (let xx = from; xx <= to; xx += step) {
      if (xx < brook.minX || xx > brook.maxX || brook.riverK(xx) < 0.1) continue;
      const zc = brook.zAt(xx);
      const half = brook.halfAt(xx);
      const across = Math.max(-half, Math.min(half, z - zc));
      const d = Math.max(0, Math.hypot(x - xx, z - zc) - half);
      if (!best || d < best.d) best = { x: xx, z: zc + across, d };
    }
  };
  span(x - within, x + within, 1);
  if (best) span(best.x - 1, best.x + 1, 0.1);
  return best && best.d <= within ? best : null;
}

/** 0..1 how much the birds are about by the water at this darkness (0 day, 1 full dark): all day, fewer at dusk, none at night. */
export const dayBirds = (darkness = 0) => 1 - clamp01((darkness - 0.2) / 0.4);

/**
 * What to play at (x, z): `level` 0..1 how near the river is (1 on its water, nothing from `heardFrom` m), `babble` the bright water over stones (most
 * at the crossing), `murmur` the low run of the deep reaches, both louder with the stream up and in rain; `at` the nearest point of the river to pan
 * them to; `birdsEvery` the seconds between bird calls (Infinity at night or out of earshot); `willows` how much their leaves rustle (the wind, by day).
 * `weather` is { streamLevel 0..1, rain 0..1, darkness 0..1, wind 0..1 }.
 */
export function riverHeard(brook, x, z, weather = {}, p = DEFAULT_RIVER_SOUND_PARAMS) {
  const quiet = { level: 0, babble: 0, murmur: 0, at: null, birdsEvery: Infinity, birds: 0, willows: 0 };
  const near = nearestRiver(brook, x, z, p.heardFrom);
  if (!near) return quiet;
  const { streamLevel = 0, rain = 0, darkness = 0, wind = 0 } = weather;
  const level = (1 - clamp01(near.d / p.heardFrom)) ** 2 * clamp01(brook.riverK(near.x) * 1.5);
  if (level <= 0) return quiet;
  const swell = 1 + p.upBoost * clamp01(streamLevel) + p.rainBoost * clamp01(rain);
  const cross = brook.crossing();
  const riffle = cross ? clamp01(1 - Math.abs(near.x - cross.x) / p.crossingReach) : 0;
  const day = dayBirds(darkness);
  const birds = level > 0.05 ? day * clamp01(1 - rain * 0.7) : 0; // fewer calls in the rain
  return {
    level,
    babble: level * swell * (0.35 + p.crossingBoost * riffle),
    murmur: level * swell * 0.55,
    at: { x: near.x, z: near.z },
    birds,
    birdsEvery: birds > 0.05 ? p.birdsEvery / birds : Infinity,
    willows: level * day * clamp01(wind) * p.willowWind,
  };
}
