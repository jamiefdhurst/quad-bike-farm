// The farm as it was laid out before the new map became the one everybody plays (#692), for the tests that say how far a piece moved or how much
// bigger it grew. Built from the same RAW numbers the new farm starts from, so it needs no old code beyond the resolver.
import { RAW_LAYOUT } from '../../src/world/layout.js';
import { resolveWithBarnLocal } from '../../src/world/layoutBarn.js';

export const TODAY = resolveWithBarnLocal(RAW_LAYOUT, RAW_LAYOUT.anchors);
