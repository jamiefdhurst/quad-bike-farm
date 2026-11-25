// The props' random streams (#1107), pure, so what a builder draws can be worked out without building it: the farm's list of placed things
// (farmPlacement.js, #1187) lays the same hedges and trees from the same draws.

export function seeded(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/**
 * Each builder's own random stream, from the props' fixed seed and its name (#1107): a change to one builder's draws no longer moves another's
 * things, and a builder can run later (behind the start screen) without moving anything built after it.
 */
export function streamFor(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return seeded(((1234 + (h >>> 0)) % 2147483646) + 1);
}
