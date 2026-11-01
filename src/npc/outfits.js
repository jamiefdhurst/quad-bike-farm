// What each girl wears on top today. Most days a polo; some days a plaid flannel shirt over it, buttoned (her polo's collar out over
// the plaid's) or worn open; some days a second polo, white or black and a size bigger, over her own; now and then a white or pale
// blue shirt and a tie in her polo's colour, on its own or over the polo, done right up or loosened; and on a very warm day Jess may
// wear just a string crop-top. Any collar may be popped. Dealt for each day of the farm from its own stream of the farm seed, so a day
// replays the same, with each girl's odds in characters.js (outfitOdds, poppedChance). Pure.

export const OUTFIT_KINDS = {
  polo: { label: 'her polo' },
  plaid: { label: 'a plaid shirt' },
  doublePolo: { label: 'two polos' },
  cropTop: { label: 'a crop-top (a warm day)' },
  shirtTie: { label: 'shirt and tie' },
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

/** The shirt worn with a tie: white or pale blue. */
export const SHIRT_COLOURS = [
  { name: 'white', colour: '#f4f3ef' },
  { name: 'pale blue', colour: '#c4d7ec' },
];

export const DEFAULT_OUTFIT_PARAMS = {
  warmAbove: 20, // degrees C: a day this warm at its warmest is a day for a crop-top
  plaidOpenChance: 0.5, // how often a plaid shirt is worn open over the polo rather than buttoned over it
  shirtOverPoloChance: 0.5, // how often a shirt and tie is worn over the polo rather than on its own
};

export const OUTFIT_PARAM_RANGES = {
  warmAbove: [10, 30, 0.5],
  plaidOpenChance: [0, 1, 0.05],
  shirtOverPoloChance: [0, 1, 0.05],
};

/**
 * Today's outfit for a girl. `odds`: { polo, plaid, doublePolo, cropTop } (they needn't add up to 1), and `shirtTie`, the chance
 * that a shirt and tie takes the place of whatever else she'd have worn; `warm`: whether the day is warm enough for a crop-top (if
 * not, its share goes to the polo); `popped`: her chance of a popped collar; `underOpen` and `plaidButtons`: her ranges of buttons
 * undone on the polo under a second one and on a buttoned plaid; `tieLoose`: her chance of wearing a shirt and tie loosened rather
 * than done right up. Always draws the same number of randoms, so one girl's deal doesn't move the other's. The shirt and tie's
 * come from `extra`, a stream of their own, so adding it moved nobody's other outfits (without one they follow on in `random`).
 * Returns { kind, plaid, plaidOpen, over, crop, popped, underOpen, plaidButtons, shirt, shirtOverPolo,
 * tieLoose, shirtOpen, tieDrop }.
 */
export function dealOutfit(random, odds, { warm = false, popped = 0, underOpen = [0, 0], plaidButtons = [0, 0], tieLoose = 0, extra = null, p = DEFAULT_OUTFIT_PARAMS } = {}) {
  const r = Array.from({ length: 8 }, () => random());
  const e = Array.from({ length: 6 }, () => (extra ?? random)());
  const between = ([lo, hi], x) => lo + Math.min(hi - lo, Math.floor(x * (hi - lo + 1)));
  const share = { ...odds };
  if (!warm) {
    share.polo = (share.polo ?? 0) + (share.cropTop ?? 0);
    share.cropTop = 0;
  }
  share.shirtTie = 0;
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
  if (e[0] < (odds.shirtTie ?? 0)) kind = 'shirtTie';
  const pick = (list, x) => list[Math.min(list.length - 1, Math.floor(x * list.length))];
  return {
    kind,
    plaid: pick(PLAID_PALETTE, r[1]).colours,
    plaidOpen: r[2] < p.plaidOpenChance,
    over: pick(OVER_POLO_COLOURS, r[3]),
    crop: pick(CROP_COLOURS, r[4]),
    popped: kind !== 'cropTop' && kind !== 'shirtTie' && r[5] < popped, // nobody pops a collar with a tie on
    underOpen: between(underOpen, r[6]), // in two polos, the buttons undone on hers under the other (the top one has her usual)
    plaidButtons: between(plaidButtons, r[7]), // a buttoned plaid's buttons undone: none, done right up, to a few
    shirt: pick(SHIRT_COLOURS, e[1]).colour,
    shirtOverPolo: e[2] < p.shirtOverPoloChance,
    tieLoose: e[3] < tieLoose,
    shirtOpen: between([1, 1], e[4]), // loosened, the top one undone
    tieDrop: Math.round((0.02 + 0.01 * e[5]) * 1000) / 1000, // and the knot pulled 2 to 3 cm down
  };
}

/** A style with anything missing filled in, so the debug panel can switch to any kind (e.g. one dealt before a field existed). */
export function completeStyle(style = {}) {
  return {
    kind: 'polo',
    plaid: PLAID_PALETTE[0].colours,
    plaidOpen: false,
    over: OVER_POLO_COLOURS[0],
    crop: CROP_COLOURS[0],
    popped: false,
    underOpen: 0,
    plaidButtons: 0,
    shirt: SHIRT_COLOURS[0].colour,
    shirtOverPolo: false,
    tieLoose: false,
    shirtOpen: 1,
    tieDrop: 0.025,
    ...style,
  };
}

/** Which outfits a girl may wear: the crop-top only for one with a chance of it (Jess). */
export function outfitsFor(odds = {}) {
  return Object.keys(OUTFIT_KINDS).filter((k) => k !== 'cropTop' || (odds.cropTop ?? 0) > 0);
}

/** A short description for the debug panel and the console. */
export function describeOutfit(o) {
  if (!o || o.kind === 'polo' || !o.kind) return `her polo${o?.popped ? ', collar popped' : ''}`;
  if (o.kind === 'cropTop') return 'a crop-top';
  if (o.kind === 'shirtTie') {
    const shirt = SHIRT_COLOURS.find((s) => s.colour === o.shirt)?.name ?? 'white';
    return `a ${shirt} shirt and tie${o.shirtOverPolo ? ' over her polo' : ''}, ${o.tieLoose ? 'the tie loosened' : 'done right up'}`;
  }
  if (o.kind === 'doublePolo') return `two polos (${o.over === OVER_POLO_COLOURS[0] ? 'white' : 'black'} over hers)${o.popped ? ', collars popped' : ''}`;
  const name = PLAID_PALETTE.find((q) => q.colours === o.plaid || q.colours[0] === o.plaid?.[0])?.name ?? 'plaid';
  return `a ${name} plaid shirt, ${o.plaidOpen ? 'open over her polo' : 'buttoned over her polo'}${o.popped ? ', collar popped' : ''}`;
}

/**
 * What she says about her clothes the first time you talk to her on a day she's in something that wants explaining (a shirt and
 * tie: the voice line's name), or null. `saidOn`: the day she last said it.
 */
export function outfitRemark(style, day, saidOn) {
  return style?.kind === 'shirtTie' && saidOn !== day ? 'shirtTie' : null;
}
