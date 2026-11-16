// What the neighbour looks like, in one place: she is one woman, so the rig standing in her yard (neighbourHost.js) and the one that drives to
// the farm in her Tor (trafficView.js) are dressed from the same outfit and stand the same height.

import { withJumper, OUTFITS } from '../npc/outfit.js';

/** Her height in metres. */
export const NEIGHBOUR_HEIGHT = 1.68;

/** Her outfit: the girls' model with grey hair in a plum jumper. */
export function neighbourOutfit() {
  return withJumper({ ...OUTFITS.original, colors: { hair: '#b9b4aa' } }, '#6b4a6e');
}
