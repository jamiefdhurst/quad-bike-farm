import { paintWoods } from '../../src/world/groundTexture.js';
import { pointInPolygon } from '../../src/world/polygons.js';

/**
 * Runs `paintWoods` for the wood `w` (createWoods) on a canvas that only records, at a metre a pixel over a window round the whole wood, and
 * honours `clip()` as a canvas does: a floor cell or a fallen leaf whose middle is outside the clip in force is clipped away. Gives every spot
 * drawn as { x, z, litter, kept } in metres (`litter` for the floor's cells and drifts, `kept` false where the clip took it), the clips set (each a run of [x, z] points),
 * the saves and restores, how many saves were left open at the end (`depth`) and the clip still in force when the track was first stroked.
 */
export function paintWoodFloor(w, { fine = true, autumn = false } = {}) {
  const b = { minX: w.rect.minX - 20, maxX: w.rect.maxX + 20, minZ: w.rect.minZ - 20, maxZ: w.rect.maxZ + 20 };
  const toPx = (x, z) => [x - b.minX, z - b.minZ];
  const spots = [];
  const clips = [];
  const stack = [];
  let clip = null;
  let path = [];
  let saves = 0;
  let restores = 0;
  let stroked = false; // the floor and its drifts are drawn first, then the track is stroked and its ruts, roots and the pond drawn over them
  let clipAtTrack = null; // the clip still in force when the track is first stroked
  const at = (x, z) => spots.push({ x, z, litter: !stroked, kept: !clip || pointInPolygon(clip, x, z) });
  const record = {
    save: () => (saves++, stack.push(clip)),
    restore: () => (restores++, (clip = stack.pop() ?? null)),
    beginPath: () => (path = []),
    moveTo: (px, pz) => path.push([px + b.minX, pz + b.minZ]),
    lineTo: (px, pz) => path.push([px + b.minX, pz + b.minZ]),
    clip: () => {
      clip = path.slice();
      clips.push(clip);
    },
    stroke: () => {
      if (!stroked) clipAtTrack = clip;
      stroked = true;
    },
    fillRect: (px, pz, wide, tall) => at(px + b.minX + wide / 2, pz + b.minZ + tall / 2),
    ellipse: (px, pz) => at(px + b.minX, pz + b.minZ),
  };
  const ctx = new Proxy(record, { get: (t, k) => (k in t ? t[k] : () => {}), set: () => true });
  const c = { ctx, s: 1, win: b, fine, toPx, over: () => true, inWin: () => true, due: () => false };
  for (const _ of paintWoods(c, { woods: w }, autumn));
  return { spots, clips, saves, restores, depth: stack.length, clipAtTrack };
}
