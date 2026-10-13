// Mud on the lens. Pure logic, no Three or DOM: what is stuck on your view, how it gets there, how it dries and what a wipe does.
//
// Riding an open vehicle (a quad, the mini moto, the tractor) close behind another one on the mud, through a puddle or the ford at speed,
// or in hard rain splatters your view. Splats are blobs placed over the screen (x and y 0..1). They dry slowly on their own. The first wipe
// only smears them wide and thin; a second wipe takes the smear off. Goggles (TODO 48) will set `guard` to keep most of it off.
// effects/lensMudView.js draws it.

export const DEFAULT_LENS_PARAMS = {
  guard: 0, // how much is kept off the lens, 0 bare-faced to 1 none gets through (goggles will set this)
  puddleRate: 0.22, // splats a second per metre a second through standing water, at full depth
  puddleMinSpeed: 3, // slower than this (m/s) a puddle only wets the tyres
  followRate: 0.05, // splats a second per metre a second of the quad ahead, per unit of mud under it, close up
  followRange: 10, // metres behind another vehicle that it can throw mud at you
  followCone: 0.88, // cosine of how far off dead ahead it can be and still throw at you (0.88 is about 28 degrees)
  followMinSpeed: 3, // the one ahead is too slow to fling anything under this (m/s)
  followMinMud: 0.2, // and it needs this much mud under its tyres
  rainRate: 0.03, // raindrops a second per metre a second per unit of rain
  rainMinSpeed: 4, // drops only reach the lens faster than this (m/s)
  dryTime: 200, // seconds for a fresh splat to dry out and drop off
  dropDryTime: 12, // seconds for a raindrop
  wipeSmear: 0.55, // how much of a fresh splat's thickness the first wipe leaves, as a smear
  wipeClear: 0.04, // and how much a second wipe leaves of that (enough to take a smear off)
  smearGrow: 1.7, // how much wider the first wipe makes a splat
  maxSplats: 30, // the most on the lens at once
  splatSize: 0.09, // a mud splat's width, as a share of the screen's height
};

export const LENS_PARAM_RANGES = {
  guard: [0, 1, 0.05],
  puddleRate: [0, 1, 0.01],
  puddleMinSpeed: [0, 10, 0.5],
  followRate: [0, 0.3, 0.005],
  followRange: [2, 25, 0.5],
  followCone: [0.5, 1, 0.01],
  followMinSpeed: [0, 10, 0.5],
  followMinMud: [0, 1, 0.05],
  rainRate: [0, 0.2, 0.005],
  rainMinSpeed: [0, 15, 0.5],
  dryTime: [20, 600, 10],
  dropDryTime: [2, 60, 1],
  wipeSmear: [0, 1, 0.05],
  wipeClear: [0, 1, 0.02],
  smearGrow: [1, 3, 0.1],
  maxSplats: [4, 60, 1],
  splatSize: [0.03, 0.25, 0.005],
};

/** The vehicles with a windscreen or a cab, which keep your view clean. Everything else is open. */
const CLOSED = new Set(['utv', 'landrover', 'landrover200', 'fiesta', 'corsa']);

/** Whether a vehicle (by its spec id) leaves you open to what is thrown up. */
export function isOpenVehicle(specId) {
  return !CLOSED.has(specId);
}

export function createLens() {
  return { splats: [], seq: 0 };
}

/**
 * The nearest vehicle ahead that could be throwing mud at you.
 * @param {{x:number,z:number,yaw:number}} me
 * @param {{x:number,z:number,speed:number,mud:number}[]} others   Everything else on the move: where, its speed and the mud under its tyres.
 * @returns {{dist:number, mud:number, speed:number}|null}
 */
export function leaderAhead(me, others, p) {
  const fx = Math.sin(me.yaw);
  const fz = Math.cos(me.yaw);
  let best = null;
  for (const o of others) {
    if (o.speed < p.followMinSpeed || o.mud < p.followMinMud) continue;
    const dx = o.x - me.x;
    const dz = o.z - me.z;
    const dist = Math.hypot(dx, dz);
    if (dist > p.followRange || dist < 0.5) continue;
    if ((dx * fx + dz * fz) / dist < p.followCone) continue;
    if (!best || dist < best.dist) best = { dist, mud: o.mud, speed: o.speed };
  }
  return best;
}

/**
 * Splats a second, of mud and of raindrops, from what is happening now.
 * @param {object} s  { speed (m/s), puddle (0..1, the deepest wheel), leader (from leaderAhead or null), rain (0..1), covered (bool, under a roof) }
 */
export function splatRates(s, p) {
  const open = 1 - Math.min(1, Math.max(0, p.guard));
  const speed = Math.abs(s.speed);
  let mud = 0;
  if (s.puddle > 0 && speed > p.puddleMinSpeed) mud += s.puddle * speed * p.puddleRate;
  if (s.leader) mud += s.leader.mud * Math.min(s.leader.speed, 14) * p.followRate * (1 - s.leader.dist / p.followRange);
  const drops = s.rain > 0 && !s.covered && speed > p.rainMinSpeed ? s.rain * speed * p.rainRate : 0;
  return { mud: mud * open, drops: drops * open };
}

/** Puts one splat on the lens: `kind` is 'mud' or 'drop', `scale` multiplies its size. */
export function addSplat(lens, random, p, kind = 'mud', scale = 1) {
  const drop = kind === 'drop';
  const splat = {
    id: lens.seq++,
    kind,
    x: 0.08 + random() * 0.84,
    y: 0.1 + random() * 0.8,
    size: (drop ? 0.012 + random() * 0.014 : p.splatSize * (0.4 + random() * 0.9)) * scale,
    thick: drop ? 0.4 + random() * 0.2 : 0.75 + random() * 0.25,
    smeared: false,
    seed: random(),
  };
  lens.splats.push(splat);
  // The lens only holds so much: the oldest, driest one goes.
  while (lens.splats.length > p.maxSplats) {
    let at = 0;
    for (let i = 1; i < lens.splats.length; i++) if (lens.splats[i].thick < lens.splats[at].thick) at = i;
    lens.splats.splice(at, 1);
  }
  return splat;
}

/** Time passing: new splats from what is happening (`s` as in splatRates, or null for none) and the old ones drying. Returns whether anything changed. */
export function updateLens(lens, dt, s, random, p) {
  let changed = false;
  if (s) {
    const rates = splatRates(s, p);
    for (const [kind, rate] of [['mud', rates.mud], ['drop', rates.drops]]) {
      // A chance per frame, and the odd double splat at a big rate; a puddle at speed throws a big one.
      let expect = rate * dt;
      while (expect > 0) {
        if (random() < Math.min(1, expect)) {
          addSplat(lens, random, p, kind, kind === 'mud' && s.puddle > 0.5 ? 1.4 : 1);
          changed = true;
        }
        expect -= 1;
      }
    }
  }
  for (let i = lens.splats.length - 1; i >= 0; i--) {
    const sp = lens.splats[i];
    sp.thick -= dt / (sp.kind === 'drop' ? p.dropDryTime : p.dryTime);
    if (sp.thick <= 0.03) lens.splats.splice(i, 1);
  }
  return changed || lens.splats.length > 0; // drying fades what is there, so it is redrawn while anything is stuck
}

/** A wipe with a hand: the first leaves a wide thin smear, the second takes that off. Returns how many splats it touched. */
export function wipeLens(lens, p) {
  let touched = 0;
  for (let i = lens.splats.length - 1; i >= 0; i--) {
    const sp = lens.splats[i];
    touched++;
    if (!sp.smeared && sp.kind === 'mud') {
      sp.smeared = true;
      sp.size *= p.smearGrow;
      sp.thick *= p.wipeSmear;
    } else {
      sp.thick *= sp.kind === 'drop' ? 0 : p.wipeClear;
    }
    if (sp.thick <= 0.03) lens.splats.splice(i, 1);
  }
  return touched;
}

/** How much of the view is covered, 0..1: for the debug panel and to say whether a wipe is worth it. */
export function lensCoverage(lens) {
  let c = 0;
  for (const sp of lens.splats) c += sp.size * sp.size * Math.PI * sp.thick * (sp.smeared ? 0.5 : 1) * 1.8; // a splat is wider than tall on a wide screen
  return Math.min(1, c);
}
