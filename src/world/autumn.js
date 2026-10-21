// Autumn: on the farm's autumn days (world/seasons.js: September to November). The leaves on the oaks, bushes and hedges turn, the wood's floor is thick with them, more
// come down round you under the trees, conkers lie under the oaks, and wet leaves on the Hollow Run are slippery. It is a look for the
// wood and the farm's trees, with the weather following the season in seasons.js. Pure; the pieces that draw
// it are in autumnView.js.

export const CONKERS_PER_TREE = 7; // conkers lying round the foot of each oak

export const DEFAULT_AUTUMN_PARAMS = {
  leafFall: 90, // leaves in the air round you at once under the trees (0: none come down)
  leafFallOutside: 0.2, // and how many of those come down out in the fields, as a share: a few drift in from the hedges
  throwWeight: 0.8, // how keen Jess is to throw a conker at you, under the oaks (chooser.js weighs it)
  throwRange: 14, // metres she can be from you and still have a go
  throwMinRange: 4, // and no nearer than this: she'd just hand it to you
  throwCooldown: 150, // seconds between her throws, at the soonest
  throwWindup: 0.9, // seconds she takes to pick one up and wind up
  throwSpeed: 11, // metres a second the conker flies at
  throwSpread: 0.9, // metres her aim is out by, at the most (it was never a good throw)
  throwHitRadius: 0.55, // metres from your head a conker has to land to count as a hit
};

export const AUTUMN_PARAM_RANGES = {
  leafFall: [0, 300, 5],
  leafFallOutside: [0, 1, 0.05],
  throwWeight: [0, 3, 0.05],
  throwRange: [5, 30, 1],
  throwMinRange: [1, 10, 0.5],
  throwCooldown: [0, 900, 10],
  throwWindup: [0.3, 3, 0.05],
  throwSpeed: [5, 25, 0.5],
  throwSpread: [0, 3, 0.05],
  throwHitRadius: [0.2, 1.5, 0.05],
};

/** The leaf colours (a multiplier on the green leaf texture, so well above 1 in red) for each kind of tree. */
export const AUTUMN_TINTS = {
  treeA: [2.9, 1.15, 0.3], // oak: burnt orange
  treeB: [2.5, 1.55, 0.35], // the other oak: gold
  bush: [2.4, 0.75, 0.3], // hazel and holly turning russet
  hedge: [2.2, 1.35, 0.4], // the hedgerows: yellow-brown
};

/** The leaves in winter: dull, dark and thin-looking (a multiplier on the green leaf texture, below 1: the trees are not bare, just done). */
export const WINTER_TINTS = {
  treeA: [0.78, 0.62, 0.42],
  treeB: [0.74, 0.62, 0.45],
  bush: [0.7, 0.62, 0.45],
  hedge: [0.62, 0.6, 0.42],
};

/** The colours of leaves in the air and on the ground: [r, g, b] 0..1. */
export const LEAF_COLOURS = [
  [0.78, 0.36, 0.08],
  [0.86, 0.55, 0.12],
  [0.62, 0.2, 0.07],
  [0.8, 0.7, 0.2],
  [0.45, 0.28, 0.1],
];

/** 0..1 how deep in leaves the ground is here: the wood's floor, and nothing outside it. */
export function leafCover(woods, x, z) {
  return woods?.inWoods?.(x, z) ? 1 : 0;
}

/** Where the conkers lie: `perTree` round the foot of each oak, between 0.7 and 2.8 m out, left out where the track, a log or the pond is. */
export function conkerSpots(trees, woods, perTree, random) {
  const out = [];
  for (const [tx, tz] of trees) {
    for (let i = 0; i < perTree; i++) {
      const a = random() * Math.PI * 2;
      const r = 0.7 + random() * 2.1;
      const x = tx + Math.cos(a) * r;
      const z = tz + Math.sin(a) * r;
      if (woods.treeOk(x, z)) out.push([x, z]);
    }
  }
  return out;
}

/** How many leaves are in the air: all of them under the trees, `outside` of them in the fields. */
export function leavesInAir(p, woods, x, z) {
  return Math.round(p.leafFall * (woods?.inWoods?.(x, z, 6) ? 1 : p.leafFallOutside));
}
