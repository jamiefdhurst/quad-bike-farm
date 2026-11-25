// The ground's 1 m grid worked out in workers (#1107). It is 1.8 million asks of terrainHeight.js on the new farm, about 2 s on one thread,
// and each ask stands alone, so it is shared out in bands of columns among a few workers (groundWorker.js) started before the models load,
// and the load waits for it only when the World is built. The heights are the same numbers to the bit: each worker deals the ground from the
// same layout with the same code. Where workers can't run (an old browser, a test) the answer is null and GroundGrid works it out itself.

import { groundBounds } from './groundTiles.js';

/** Most workers it will start, however many cores: measured on a 14-core Mac, 6 to 10 took the wait from 0.49 s to 0.39 s, and past that starting them is most of the time (#1107). */
export const MAX_GROUND_WORKERS = 8;

/** `count` columns split into `n` bands as even as can be: [[ix0, ix1], ...], each ix1 the next ix0, the last ending at `count`. */
export function columnBands(count, n) {
  const k = Math.max(1, Math.min(n, count));
  return Array.from({ length: k }, (_, i) => [Math.floor((i * count) / k), Math.floor(((i + 1) * count) / k)]);
}

/** How many workers for this machine: one fewer than its cores (the page's own thread carries on loading), at least 2 and at most MAX_GROUND_WORKERS. */
export function workerCount(cores = globalThis.navigator?.hardwareConcurrency) {
  return Math.max(2, Math.min(MAX_GROUND_WORKERS, (cores || 4) - 1));
}

/**
 * Starts working out the grid over the layout's ground (groundTiles.js `groundBounds`) for `layout`: a promise of the Float32Array a GroundGrid takes, or of
 * null if workers can't be had or any band fails, in which case the grid is worked out on the page as before. `makeWorker` is for a test.
 */
export function sampleGroundInWorkers(layout, { bounds = groundBounds(layout), makeWorker = defaultWorker, workers = workerCount() } = {}) {
  const count = bounds.maxX - bounds.minX + 1;
  const stride = bounds.maxZ - bounds.minZ + 1;
  const started = [];
  try {
    const bands = columnBands(count, workers);
    const jobs = bands.map(([ix0, ix1]) => {
      const w = makeWorker();
      if (!w) throw new Error('no worker');
      started.push(w);
      return new Promise((resolve, reject) => {
        w.onmessage = ({ data }) => (data.error ? reject(new Error(data.error)) : resolve(data));
        w.onerror = (e) => reject(new Error(e?.message ?? 'worker failed'));
        w.postMessage({ layout, bounds, ix0, ix1 });
      });
    });
    return Promise.all(jobs)
      .then((parts) => {
        const heights = new Float32Array(count * stride);
        for (const { ix0, out } of parts) heights.set(out, ix0 * stride);
        return heights;
      })
      .catch((err) => {
        console.warn('Ground worked out on the page instead:', err.message);
        return null;
      })
      .finally(() => started.forEach((w) => w.terminate?.()));
  } catch {
    started.forEach((w) => w.terminate?.());
    return Promise.resolve(null);
  }
}

function defaultWorker() {
  if (typeof Worker === 'undefined') return null;
  return new Worker(new URL('./groundWorker.js', import.meta.url), { type: 'module' });
}
