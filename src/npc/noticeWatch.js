// What the vehicles do that the girls notice: an engine catching or dying, a backfire, a pop, a spit back, a boil-over, being revved
// while stood, a horn, going over, lurching forward from a standstill, landing a jump. The game hands it every vehicle each frame; it hands back notices (attention.js) for the game to
// pass to each girl. Pure: no Three.js.

import { DEFAULT_NOTICE_PARAMS } from './attention.js';

/** Engine events (engineModel.js `events`) and the notice each makes. */
const ENGINE_NOTICES = { caught: 'engineStart', stalled: 'stall', seized: 'stall', backfire: 'backfire', overrunPop: 'pop', spitBack: 'spitBack', boilOver: 'boilOver' };

export class NoticeWatch {
  constructor(p = DEFAULT_NOTICE_PARAMS) {
    this.p = p;
    this.last = new Map(); // vehicle id -> { rpm, horn, tipped, revAgo, rev, speed, lurchAgo, air }
  }

  /**
   * `vehicles`: [{ id, x, y, z, events (engine event types this frame), rpm, running, speed, horn, tipped, airborne }]. Returns
   * [{ kind, key, x, y, z, strength }], each a notice for attention.js.
   */
  update(dt, vehicles) {
    const p = this.p;
    const out = [];
    for (const v of vehicles) {
      const was = this.last.get(v.id) ?? { rpm: v.rpm, horn: v.horn, tipped: v.tipped, revAgo: Infinity, rev: null, speed: v.speed, lurchAgo: Infinity, air: 0 };
      const at = { key: v.id, x: v.x, y: v.y, z: v.z };
      const seen = new Set();
      for (const type of v.events ?? []) {
        const kind = ENGINE_NOTICES[type];
        if (kind && !seen.has(kind)) {
          seen.add(kind);
          out.push({ kind, strength: 1, ...at });
        }
      }
      if (v.horn && !was.horn) out.push({ kind: 'horn', strength: 1, ...at });
      if (v.tipped && !was.tipped) out.push({ kind: 'tipped', strength: 1, ...at });
      // Revved while stood: the revs climbing fast and coming back down without it going anywhere (pulling away isn't revving).
      // Counted at the top of the blip, as strong as the fastest climb.
      const rate = dt > 0 ? (v.rpm - was.rpm) / dt : 0;
      let revAgo = was.revAgo + dt;
      let rev = was.rev;
      if (!v.running || v.speed > p.revMaxSpeed) rev = null;
      else if (rate > p.revRate) rev = { peak: Math.max(rev?.peak ?? 0, rate) };
      else if (rev && rate < 0) {
        if (revAgo >= p.revEvery) {
          out.push({ kind: 'rev', strength: Math.min(1.5, rev.peak / (2 * p.revRate) + 0.5), ...at });
          revAgo = 0;
        }
        rev = null;
      }
      // Leaping forward from slow: a dropped clutch, a kangaroo hop, a runaway.
      const accel = dt > 0 ? (v.speed - was.speed) / dt : 0;
      let lurchAgo = was.lurchAgo + dt;
      if (!v.airborne && was.speed < p.lurchMaxSpeed && accel > p.lurchAccel && lurchAgo >= p.lurchEvery) {
        out.push({ kind: 'lurch', strength: Math.min(1.5, accel / (2 * p.lurchAccel) + 0.5), ...at });
        lurchAgo = 0;
      }
      // Landing after real air: a jump.
      const air = v.airborne ? was.air + dt : 0;
      if (!v.airborne && was.air >= p.jumpMinAir) out.push({ kind: 'jump', strength: Math.min(1.5, was.air / (2 * p.jumpMinAir) + 0.5), ...at });
      this.last.set(v.id, { rpm: v.rpm, horn: !!v.horn, tipped: !!v.tipped, revAgo, rev, speed: v.speed, lurchAgo, air });
    }
    return out;
  }
}
