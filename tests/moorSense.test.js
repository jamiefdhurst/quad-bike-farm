import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { createMoorSense, SHEEP_LOOK } from '../src/world/moorSense.js';
import { AMY_MOOR_LINES, JESS_MOOR_LINES } from '../src/npc/moorLines.js';
import { VOICE_LINES as AMY_LINES } from '../src/npc/voiceLines.js';
import { JESS_LINES } from '../src/npc/jessLines.js';
import { DEFAULT_COMPANION_PARAMS, COMPANION_PARAM_RANGES } from '../src/npc/companionParams.js';

// What a girl on the back notices on the Moor (#821): the open common, a wet flush coming up, sheep ahead.
const two = layoutNew(LAYOUT, RAW_LAYOUT);
const moor = createTerrainHeight(two, new Track(two.trackPoints)).moor;
const flush = two.moor.flushes[0];
const sheepAt = (x, z) => ({ moor: true, flock: { sheep: [{ x, z }] } });

describe('the Moor as a girl on the back sees it', () => {
  it('is on the common west of the lane and not on the farm\'s side', () => {
    const sense = createMoorSense(moor);
    expect(sense.common(flush.x, flush.z)).toBe(true);
    expect(sense.common(moor.laneEdge(flush.z) + 20, flush.z)).toBe(false);
  });

  it('sees a flush coming up ahead, not behind, not far off, and not when already in it', () => {
    const sense = createMoorSense(moor);
    expect(sense.wetAhead(flush.x + 16, flush.z, -5, 0)).toBe(true); // heading west towards the flush's east edge
    expect(sense.wetAhead(flush.x + 16, flush.z, 5, 0)).toBe(false); // driving away from it
    expect(sense.wetAhead(flush.x + 60, flush.z, -5, 0)).toBe(false);
    expect(sense.wetAhead(flush.x, flush.z, -5, 0)).toBe(false); // in it already: that is the bog's own line
    expect(sense.wetAhead(flush.x + 16, flush.z, 0.2, 0)).toBe(false); // crawling
  });

  it('sees the Moor\'s flock ahead within `SHEEP_LOOK` m, not behind or beyond, and no other flock', () => {
    const sense = createMoorSense(moor, () => [sheepAt(100, 0)]);
    expect(sense.sheepAhead(90, 0, 5, 0)).toBe(true);
    expect(sense.sheepAhead(110, 0, 5, 0)).toBe(false);
    expect(sense.sheepAhead(100 - SHEEP_LOOK - 5, 0, 5, 0)).toBe(false);
    sense.flocks = [{ flock: { sheep: [{ x: 100, z: 0 }] } }]; // the hill's flock has no `moor`
    expect(sense.sheepAhead(90, 0, 5, 0)).toBe(false);
  });
});

describe('what the girls say there', () => {
  it('has lines for each of the three, a few each, in both girls\' sets', () => {
    for (const key of ['moorOpen', 'moorBog', 'moorSheep']) {
      expect(AMY_MOOR_LINES[key].lines.length).toBeGreaterThanOrEqual(3);
      expect(JESS_MOOR_LINES[key].length).toBeGreaterThanOrEqual(3);
      expect(AMY_LINES[key]).toBeTruthy();
      expect(JESS_LINES[key]).toBeTruthy();
    }
  });
  it('never calls you "he" or "she", or uses an em dash', () => {
    const all = [...Object.values(AMY_MOOR_LINES).flatMap((l) => l.lines), ...Object.values(JESS_MOOR_LINES).flat()];
    for (const l of all) expect(l).not.toMatch(/\b(he|she)\b|—/i);
  });
  it('has the speed she remarks on tunable', () => {
    expect(DEFAULT_COMPANION_PARAMS.voiceMoorSpeed).toBe(6);
    expect(COMPANION_PARAM_RANGES.voiceMoorSpeed).toEqual([2, 15, 0.5]);
  });
});
