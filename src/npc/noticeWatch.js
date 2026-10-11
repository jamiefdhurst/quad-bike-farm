// What the vehicles do that the girls notice: an engine catching or dying, a backfire, a pop, a spit back, a boil-over, being revved
// while stood (someone opening the throttle, not an idle that hunts or sits high on the choke), a horn, going over, lurching forward from a standstill, landing a jump. The game hands it every vehicle each frame; it hands back notices (attention.js) for the game to
// pass to each girl. Pure: no Three.js.

import { DEFAULT_NOTICE_PARAMS } from './attention.js';

/** Engine events (engineModel.js `events`) and the notice each makes. */
const ENGINE_NOTICES = { caught: 'engineStart', stalled: 'stall', seized: 'stall', backfire: 'backfire', overrunPop: 'pop', spitBack: 'spitBack', boilOver: 'boilOver' };

export class NoticeWatch {
  constructor(p = DEFAULT_NOTICE_PARAMS) {
    this.p = p;
    this.last = new Map(); // vehicle id -> { rpm, horn, tipped, revAgo, rev, base, speed, lurchAgo, air }
  }

  /**
   * `vehicles`: [{ id, x, y, z, events (engine event types this frame), rpm, running, throttle (0..1, what you or she is asking
   * of it), idleRpm, maxRpm, speed, horn, tipped, airborne }]. Returns
   * [{ kind, key, x, y, z, strength }], each a notice for attention.js.
   */
  update(dt, vehicles) {
    const p = this.p;
    const out = [];
    for (const v of vehicles) {
      const was = this.last.get(v.id) ?? { rpm: v.rpm, horn: v.horn, tipped: v.tipped, revAgo: Infinity, rev: null, base: v.rpm, speed: v.speed, lurchAgo: Infinity, air: 0 };
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
      const { revAgo, rev, base, notice } = this.revs(dt, v, was);
      if (notice) out.push({ kind: 'rev', strength: notice, ...at });
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
      this.last.set(v.id, { rpm: v.rpm, horn: !!v.horn, tipped: !!v.tipped, revAgo, rev, base, speed: v.speed, lurchAgo, air });
    }
    return out;
  }

  /**
   * Revved while stood: the throttle opened and the revs pulled well clear of where that engine was idling, while it stays put
   * (pulling away isn't revving). The idle it is measured from follows the revs slowly while the throttle is shut, so a choke's fast
   * idle, a hunting idle or a rough one never counts however much it wanders. Counted once a blip, at its top (the revs stop
   * climbing or the throttle shuts), as strong as how far it got up the rev range; at most every `revEvery` seconds.
   */
  revs(dt, v, was) {
    const p = this.p;
    const idle = v.idleRpm ?? 0;
    const span = Math.max(1, (v.maxRpm ?? idle + 5000) - idle);
    const open = (v.throttle ?? 0) >= p.revThrottle;
    let revAgo = was.revAgo + dt;
    let rev = was.rev;
    let base = Math.max(idle, was.base ?? v.rpm);
    let notice = 0;
    if (!v.running || v.speed > p.revMaxSpeed) {
      rev = null;
      base = Math.max(idle, v.rpm);
    } else if (!rev) {
      if (open && v.rpm - base > p.revAbove * span) rev = { peak: v.rpm, counted: false };
      else if (!open) base += (v.rpm - base) * Math.min(1, dt / Math.max(0.05, p.revBaseSeconds));
    }
    if (rev) {
      if (!rev.counted && (!open || v.rpm < rev.peak - 0.03 * span)) {
        if (revAgo >= p.revEvery) {
          notice = Math.min(1.5, 0.5 + 1.25 * ((rev.peak - base) / span));
          revAgo = 0;
        }
        rev.counted = true;
      }
      rev.peak = Math.max(rev.peak, v.rpm);
      // Over once the throttle is shut and the revs are back down near the idle.
      if (!open && v.rpm - base < 0.5 * p.revAbove * span) rev = null;
    }
    return { revAgo, rev, base, notice };
  }
}
