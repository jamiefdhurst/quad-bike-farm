import { GRIZZLY_DECK, GRIZZLY_RACKS } from './grizzlyBody.js';

// The loan quad's body numbers (TODO 96): a late Yamaha Kodiak 450 (the Tamura Ursa 450), after the photos in `.scratch/quads/tamura-loan/`
// (a side-on 450, the 2003 Kodiak's front, the engine bay, the switchgear and the LCD). It is the Grizzly's cousin, so it takes the same deck
// machinery (foremanDeck.js) and rack heights (the rackAnchor and mug heights are fixed points) with its own numbers: a little taller at
// the front, a black flare along every fender's edge rather than painted ones, a black steel bumper, black alloy wheels and a bright
// silver muffler (the shared utility exhaust, its can left bright). Pure numbers, no materials, so a test can check them.

// (Its faces stay where the Grizzly's are, so the grille, lamps, bumper and tail panel of grizzlyDetail.js fit as they are.)
export const KODIAK_DECK = {
  ...GRIZZLY_DECK,
  front: { z0: 0.3, zf: 0.885, top: 0.755, crown: 0.035, dip: 0.03, faceH: 0.3, lean: 0.07 }, // the face leans: out at the bottom, back at the top, over a taller, rounder front
  rear: { z0: -0.3, zf: -0.9, top: 0.78, crown: 0.03, dip: 0, faceH: 0.2 },
  half: 0.57,
  cornerR: 0.15,
  flareW: 0.045, // the black strip along the top of each fender's edge
  flareTaper: 1, // the strip dies away to nothing down the face's corner, so it never sinks into the rolled edge there
  blackWalls: true, // the inner wings and the decks' end walls are black plastic
  paintedSkirt: true, // and the wall below it is painted: only the strip and the arch's trim are black
};

export const KODIAK_RACKS = GRIZZLY_RACKS;

/**
 * The face's own numbers: the leaning face is further forward at the height of the grille (0.545) and the lamps (0.6) than at its top, by
 * `lean` times how far down the face that height is.
 */
export const KODIAK_FACE = { z: KODIAK_DECK.front.zf + 0.045, grilleY: 0.545, lampX: 0.265, lampY: 0.595, lampZ: KODIAK_DECK.front.zf + 0.03 };

/** The lamp's lens radius and the surround's control points ([u, v] from the lens's middle, u outwards): the blue's almond, but slimmer, more angular and swept up to a sharper point. */
export const KODIAK_LAMP = { r: 0.038 };
export function kodiakLampOutline() {
  return [[-0.06, 0.004], [-0.046, -0.034], [-0.004, -0.05], [0.06, -0.046], [0.13, -0.026], [0.19, 0.012], [0.215, 0.044], [0.16, 0.048], [0.08, 0.058], [0.0, 0.056], [-0.045, 0.034]];
}
