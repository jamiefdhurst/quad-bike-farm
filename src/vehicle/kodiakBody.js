import { GRIZZLY_DECK, GRIZZLY_RACKS } from './grizzlyBody.js';

// The loan quad's body numbers (TODO 96): a late Yamaha Kodiak 450 (the Tamura Ursa 450), after the photos in `.scratch/quads/tamura-loan/`
// (a side-on 450, the 2003 Kodiak's front, the engine bay, the switchgear and the LCD). It is the Grizzly's cousin, so it takes the same deck
// machinery (foremanDeck.js) and rack heights (the rackAnchor and mug heights are fixed points) with its own numbers: a little taller at
// the front, a black flare along every fender's edge rather than painted ones, a black steel bumper, black alloy wheels and a bright
// silver muffler (the shared utility exhaust, its can left bright). Pure numbers, no materials, so a test can check them.

// (Its faces stay where the Grizzly's are, so the grille, lamps, bumper and tail panel of grizzlyDetail.js fit as they are.)
export const KODIAK_DECK = {
  ...GRIZZLY_DECK,
  front: { z0: 0.3, zf: 0.885, top: 0.755, crown: 0.035, dip: 0.03, faceH: 0.27 },
  rear: { z0: -0.3, zf: -0.9, top: 0.78, crown: 0.03, dip: 0, faceH: 0.2 },
  half: 0.57,
  flareW: 0.045, // the black strip along the top of each fender's edge
  paintedSkirt: true, // and the wall below it is painted: only the strip and the arch's trim are black
};

export const KODIAK_RACKS = GRIZZLY_RACKS;

/** The round lamps low in the front deck's face: x either side, y, and the lens radius. */
export const KODIAK_LAMP = { x: 0.27, y: 0.6, r: 0.05 };
