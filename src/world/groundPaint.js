// The ground's painting, a tile at a time (#759). Pure: no Three.js, no canvas. `terrain.js` makes the canvases and textures.
//
// The ground is painted at 10 pixels a metre, which over a farm as big as the new map is far more than one texture can hold (or the load can
// afford). So the tiles of the ground (groundTiles.js) are painted as you come near them and let go as you leave, a few milliseconds a frame, and
// the whole ground is painted once at about a pixel a metre (the overview) for whatever is not painted yet or is too far for the detail to show.
// A tile is painted a little beyond its edge (`PAINT_PAD`), so the texture filter reads the next tile's painting at the seam, not its own edge.

import { tileDistance } from './groundTiles.js';

export const PAINT_PX = 10; // pixels a metre on a painted tile
export const PAINT_PAD = 0.8; // metres painted beyond a tile's edge each side, eight pixels

/** The part of the ground a tile's painting holds: the tile and `PAINT_PAD` beyond it. */
export function paintWindow(tile) {
  return { minX: tile.minX - PAINT_PAD, maxX: tile.maxX + PAINT_PAD, minZ: tile.minZ - PAINT_PAD, maxZ: tile.maxZ + PAINT_PAD };
}

/** The pixels a metre of the overview: about one, fewer if the ground is so wide that a canvas that size could not hold it. */
export function overviewScale(bounds, maxPixels = 4096) {
  return Math.min(1, maxPixels / Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ));
}

/**
 * Which tiles are painted, and the painting of them in turn. A tile is painted once you are within `paintNear` metres of it and let go when you
 * are `hysteresis` of that further off. `begin(tile)` starts painting one and returns a job (`job.step()` does a little and returns true when it
 * is done); `finish(tile, job)` hands the finished painting over (the upload); `drop(tile)` is told when one is let go. In play it does one tile
 * at a time, nearest first, for `budgetMs` a frame, and never starts the hand-over once the budget is spent, so a frame holds at most one.
 */
export class PaintSet {
  constructor(tiles, params, { begin, finish, drop, now = () => performance.now() }) {
    this.tiles = tiles;
    this.params = params;
    this.begin = begin;
    this.finish = finish;
    this.drop = drop;
    this.now = now;
    this.painted = new Set(); // tile ids
    this.job = null; // { tile, job }
    this.paints = 0;
    this.paintMs = 0;
    this.worstFrameMs = 0;
    this.worstFinishMs = 0;
  }

  /** The tiles to paint when you are at (x, z): not painted, within `paintNear`, nearest first. */
  pending(x, z, radius = this.params.paintNear) {
    const out = [];
    for (const t of this.tiles) {
      if (this.painted.has(t.id)) continue;
      const dist = tileDistance(t, x, z);
      if (dist <= radius) out.push({ tile: t, dist });
    }
    return out.sort((a, b) => a.dist - b.dist);
  }

  /** Lets go of the painted tiles you have left behind, and of the one half painted if it is now far. */
  release(x, z) {
    const limit = this.params.paintNear * (1 + this.params.hysteresis);
    for (const t of this.tiles) {
      if (this.painted.has(t.id) && tileDistance(t, x, z) > limit) {
        this.painted.delete(t.id);
        this.drop(t);
      }
    }
    if (this.job && tileDistance(this.job.tile, x, z) > limit) this.job = null;
  }

  /** Paints every tile within `radius` metres of (x, z) right now: the ones round where you start, behind the start screen. Returns how many. */
  prime(x, z, radius = this.params.paintPrime) {
    let n = 0;
    for (const { tile } of this.pending(x, z, radius)) {
      const job = this.begin(tile);
      while (!job.step());
      this.finish(tile, job);
      this.painted.add(tile.id);
      n++;
    }
    return n;
  }

  /** In play: lets go of what is far and paints the nearest tile that needs it for up to `budgetMs`. Returns whether a tile was finished. */
  update(x, z, budgetMs = this.params.paintMs) {
    this.release(x, z);
    const start = this.now();
    let finished = false;
    while (this.now() - start < budgetMs) {
      if (!this.job) {
        const next = this.pending(x, z)[0];
        if (!next) break;
        this.job = { tile: next.tile, job: this.begin(next.tile) };
      }
      const t0 = this.now();
      const done = this.job.job.step();
      this.paintMs += this.now() - t0;
      if (!done) continue;
      const t1 = this.now();
      this.finish(this.job.tile, this.job.job);
      this.worstFinishMs = Math.max(this.worstFinishMs, this.now() - t1);
      this.painted.add(this.job.tile.id);
      this.job = null;
      this.paints++;
      finished = true;
      break;
    }
    this.worstFrameMs = Math.max(this.worstFrameMs, this.now() - start);
    this.waiting = this.pending(x, z).length;
    return finished;
  }

  stats() {
    return { painted: this.painted.size, waiting: this.waiting ?? 0, paints: this.paints, paintMs: this.paintMs, worstFrameMs: this.worstFrameMs, worstFinishMs: this.worstFinishMs };
  }
}
