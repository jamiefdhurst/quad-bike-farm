// What each girl wears on top today. Most days a polo; some days a plaid flannel shirt, buttoned up in place of the polo or worn
// open over it; some days a second polo, white or black and a size bigger, over her own; and on a very warm day Jess may wear just
// a string crop-top. Any collar may be popped. Dealt for each day of the farm from its own stream of the farm seed, so a day
// replays the same, with each girl's odds in characters.js (outfitOdds, poppedChance). Pure.

export const OUTFIT_KINDS = {
  polo: { label: 'her polo' },
  plaid: { label: 'a plaid shirt' },
  doublePolo: { label: 'two polos' },
  cropTop: { label: 'a crop-top (a warm day)' },
};

/** The plaid flannels: a ground, a broad check across it and a thin line. */
export const PLAID_PALETTE = [
  { name: 'red and black', colours: ['#a3222a', '#1b1414', '#d9c9a0'] },
  { name: 'green and navy', colours: ['#2f5a3c', '#1d2740', '#c9b45a'] },
  { name: 'blue and white', colours: ['#3d6aa8', '#e8e6e0', '#1c2a48'] },
  { name: 'brown and cream', colours: ['#6b4a32', '#e3d6b8', '#2a1d14'] },
];

/** The polo worn over her own: white or black. */
export const OVER_POLO_COLOURS = ['#f1efe8', '#1c1c1e'];

/** The string crop-top. */
export const CROP_COLOURS = ['#151515', '#f3f0ea', '#d4508c', '#58b5c9'];

export const DEFAULT_OUTFIT_PARAMS = {
  warmAbove: 20, // degrees C: a day this warm at its warmest is a day for a crop-top
  plaidOpenChance: 0.5, // how often a plaid shirt is worn open over the polo rather than buttoned up instead of it
};

export const OUTFIT_PARAM_RANGES = {
  warmAbove: [10, 30, 0.5],
  plaidOpenChance: [0, 1, 0.05],
};

/**
 * Today's outfit for a girl. `odds`: { polo, plaid, doublePolo, cropTop } (they needn't add up to 1); `warm`: whether the day is
 * warm enough for a crop-top (if not, its share goes to the polo); `popped`: her chance of a popped collar. Always draws the same
 * number of randoms, so one girl's deal doesn't move the other's. Returns { kind, plaid, plaidOpen, over, crop, popped }.
 */
export function dealOutfit(random, odds, { warm = false, popped = 0, p = DEFAULT_OUTFIT_PARAMS } = {}) {
  const r = [random(), random(), random(), random(), random(), random()];
  const share = { ...odds };
  if (!warm) {
    share.polo = (share.polo ?? 0) + (share.cropTop ?? 0);
    share.cropTop = 0;
  }
  const kinds = Object.keys(OUTFIT_KINDS);
  const total = kinds.reduce((s, k) => s + (share[k] ?? 0), 0) || 1;
  let kind = 'polo';
  let acc = 0;
  for (const k of kinds) {
    acc += (share[k] ?? 0) / total;
    if (r[0] < acc) {
      kind = k;
      break;
    }
  }
  const pick = (list, x) => list[Math.min(list.length - 1, Math.floor(x * list.length))];
  return {
    kind,
    plaid: pick(PLAID_PALETTE, r[1]).colours,
    plaidOpen: r[2] < p.plaidOpenChance,
    over: pick(OVER_POLO_COLOURS, r[3]),
    crop: pick(CROP_COLOURS, r[4]),
    popped: kind !== 'cropTop' && r[5] < popped,
  };
}

/** A style with anything missing filled in, so the debug panel can switch to any kind (e.g. one dealt before a field existed). */
export function completeStyle(style = {}) {
  return { kind: 'polo', plaid: PLAID_PALETTE[0].colours, plaidOpen: false, over: OVER_POLO_COLOURS[0], crop: CROP_COLOURS[0], popped: false, ...style };
}

/** A short description for the debug panel and the console. */
export function describeOutfit(o) {
  if (!o || o.kind === 'polo' || !o.kind) return `her polo${o?.popped ? ', collar popped' : ''}`;
  if (o.kind === 'cropTop') return 'a crop-top';
  if (o.kind === 'doublePolo') return `two polos (${o.over === OVER_POLO_COLOURS[0] ? 'white' : 'black'} over hers)${o.popped ? ', collars popped' : ''}`;
  const name = PLAID_PALETTE.find((q) => q.colours === o.plaid || q.colours[0] === o.plaid?.[0])?.name ?? 'plaid';
  return `a ${name} plaid shirt, ${o.plaidOpen ? 'open over her polo' : 'buttoned'}${o.popped ? ', collar popped' : ''}`;
}
