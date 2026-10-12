// Crash damage: a hard hit on a gatepost or a bad landing off the ramp can bend a track rod or a rim. CrashWatch spots the
// hit from the quad's velocity (a sudden loss of speed, not braking) or the landing (a fall brought up short), and
// damageFor says what it bent and on which wheel. The faults themselves live in faults.js ('rod' and 'rim'). Pure, no Three.js.

export const DEFAULT_CRASH_PARAMS = {
  hitMinDv: 3.5, // m/s of speed knocked off within a moment before it counts as a hit rather than braking
  hitFullDv: 9, // m/s knocked off at which a hit is as bad as it gets
  landMinDv: 5, // m/s of fall brought up short before a landing counts
  landFullDv: 11, // m/s at which a landing is as bad as it gets
  window: 0.08, // seconds over which the speed lost is added up (a suspension spreads a landing over a few steps)
  cooldown: 1.5, // seconds after one before another counts (one crash is several bounces)
  maxStep: 0.1, // a step longer than this (a hitch, a teleport) is ignored
  rodChance: 0.7, // chance a hit on a front wheel that is as bad as it gets bends the track rod (less for a lighter one)
  hitRimChance: 0.6, // and bends the rim, on whichever wheel took it
  landRimChance: 0.45, // chance a landing as bad as it gets bends a rim (the landing wheel is picked at random)
  levelLow: 0.35, // how bent it is after the lightest hit that does anything
  levelHigh: 1, // and the worst
  frontShare: 0.5, // a hit with at least this share of its push along the quad is head-on, and a front wheel takes it
};

export const CRASH_PARAM_RANGES = {
  hitMinDv: [1, 10, 0.5],
  hitFullDv: [3, 20, 0.5],
  landMinDv: [1, 10, 0.5],
  landFullDv: [3, 20, 0.5],
  window: [0.02, 0.3, 0.01],
  cooldown: [0, 10, 0.5],
  maxStep: [0.02, 0.5, 0.01],
  rodChance: [0, 1, 0.05],
  hitRimChance: [0, 1, 0.05],
  landRimChance: [0, 1, 0.05],
  levelLow: [0, 1, 0.05],
  levelHigh: [0, 1, 0.05],
  frontShare: [0, 1, 0.05],
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Watches one quad's velocity for crashes. `update` is given its velocity in the world and which way its nose points, and
 * returns an impact the step one happens: { type: 'hit' | 'landing', strength 0..1, dir: { x, z } } (dir is the way the
 * quad was shoved, in the world), or null.
 */
export class CrashWatch {
  constructor(params = DEFAULT_CRASH_PARAMS) {
    this.params = params;
    this.reset();
  }

  /** Forgets the last velocity (parked, got off, put somewhere else), so the jump to a standstill isn't a crash. */
  reset() {
    this.prev = null;
    this.hx = 0; // speed knocked off in the last moment, as a vector
    this.hz = 0;
    this.fall = 0; // fall brought up short in the last moment
    this.cool = 0;
  }

  update(dt, vel) {
    const p = this.params;
    this.cool = Math.max(0, this.cool - dt);
    const prev = this.prev;
    this.prev = { x: vel.x, y: vel.y, z: vel.z };
    if (!prev || !(dt > 0) || dt > p.maxStep) {
      this.hx = this.hz = this.fall = 0;
      return null;
    }
    const decay = Math.exp(-dt / p.window);
    this.hx *= decay;
    this.hz *= decay;
    this.fall *= decay;
    const dx = vel.x - prev.x;
    const dz = vel.z - prev.z;
    // Only a push against the way it was going counts: speeding up isn't a crash.
    if (dx * prev.x + dz * prev.z < 0) {
      this.hx += dx;
      this.hz += dz;
    }
    if (vel.y > prev.y && prev.y < 0) this.fall += vel.y - prev.y;
    if (this.cool > 0) return null;
    const hit = Math.hypot(this.hx, this.hz);
    if (hit >= p.hitMinDv) {
      const out = { type: 'hit', strength: clamp((hit - p.hitMinDv) / Math.max(0.01, p.hitFullDv - p.hitMinDv), 0, 1), dir: { x: this.hx / hit, z: this.hz / hit } };
      this.settle();
      return out;
    }
    if (this.fall >= p.landMinDv) {
      const out = { type: 'landing', strength: clamp((this.fall - p.landMinDv) / Math.max(0.01, p.landFullDv - p.landMinDv), 0, 1), dir: { x: 0, z: 0 } };
      this.settle();
      return out;
    }
    return null;
  }

  settle() {
    this.hx = this.hz = this.fall = 0;
    this.cool = this.params.cooldown;
  }
}

/**
 * What an impact bends. `wheels` is [{ x, z, front, index }] in the quad's own frame (the ones that can be damaged), and
 * `push` the way the quad was shoved, also in its own frame (so the obstacle was the other way). A hit damages the wheel
 * nearest the obstacle; a landing, a random one. Returns [{ kind: 'rod' | 'rim', wheel, level }].
 */
export function damageFor(impact, wheels, push, P = DEFAULT_CRASH_PARAMS, random = Math.random) {
  if (!impact || !wheels.length) return [];
  const s = impact.strength;
  const level = P.levelLow + (P.levelHigh - P.levelLow) * s;
  const scale = 0.4 + 0.6 * s; // the lightest hit that counts has less than half the chance of the worst
  const out = [];
  if (impact.type === 'landing') {
    if (random() < P.landRimChance * scale) out.push({ kind: 'rim', wheel: wheels[Math.floor(random() * wheels.length)].index, level });
    return out;
  }
  const len = Math.hypot(push.x, push.z) || 1;
  const toward = { x: -push.x / len, z: -push.z / len }; // where the obstacle was
  let best = wheels[0];
  let bestDot = -Infinity;
  for (const w of wheels) {
    const d = w.x * toward.x + w.z * toward.z;
    if (d > bestDot) {
      bestDot = d;
      best = w;
    }
  }
  const headOn = Math.abs(push.z) / len >= P.frontShare; // the quad's length runs along z
  // A rod is only bent by a front wheel taking it, and a head-on hit puts that on a front wheel.
  if (best.front && random() < P.rodChance * scale * (headOn ? 1 : 0.5)) out.push({ kind: 'rod', wheel: best.index, level });
  if (random() < P.hitRimChance * scale) out.push({ kind: 'rim', wheel: best.index, level });
  return out;
}
