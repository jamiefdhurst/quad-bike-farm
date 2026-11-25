// A worker that works out a band of the ground's 1 m grid (#1107): given the farm's layout and a range of columns, the heights there, from
// the same terrainHeight.js the game uses, so they are the very numbers the game would have worked out itself. groundSampler.js runs several.

import { Track } from './track.js';
import { createTerrainHeight } from './terrainHeight.js';
import { sampleColumns } from './groundTiles.js';

self.onmessage = ({ data: { layout, bounds, ix0, ix1 } }) => {
  try {
    const heights = createTerrainHeight(layout, new Track(layout.trackPoints));
    const out = sampleColumns(bounds, heights.heightAt, ix0, ix1);
    self.postMessage({ ix0, out }, [out.buffer]);
  } catch (err) {
    self.postMessage({ ix0, error: String(err?.message ?? err) });
  }
};
