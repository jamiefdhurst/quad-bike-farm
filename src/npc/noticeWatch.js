// What the vehicles do that the girls notice: an engine catching or dying, a backfire, a pop, a spit back, a boil-over, being revved
// while stood, a horn, going over. The game hands it every vehicle each frame; it hands back notices (attention.js) for the game to
// pass to each girl. Pure: no Three.js.

import { DEFAULT_NOTICE_PARAMS } from './attention.js';

/** Engine events (engineModel.js `events`) and the notice each makes. */
const ENGINE_NOTICES = { caught: 'engineStart', stalled: 'stall', seized: 'stall', backfire: 'backfire', overrunPop: 'pop', spitBack: 'spitBack', boilOver: 'boilOver' };

export class NoticeWatch {
  constructor(p = DEFAULT_NOTICE_PARAMS) {
    this.p = p;
    this.last = new Map(); // vehicle id -> { rpm, horn, tipped, revAgo }
  }

  /**
   * `vehicles`: [{ id, x, y, z, events (engine event types this frame), rpm, running, speed, horn, tipped }]. Returns
   * [{ kind, key, x, y, z, strength }], each a notice for attention.js.
   */
  update(dt, vehicles) {
    const p = this.p;
    const out = [];
    for (const v of vehicles) {
      const was = this.last.get(v.id) ?? { rpm: v.rpm, horn: v.horn, tipped: v.tipped, revAgo: Infinity };
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
      // Revved while stood (or near enough): the revs climbing fast.
      const rate = dt > 0 ? (v.rpm - was.rpm) / dt : 0;
      let revAgo = was.revAgo + dt;
      if (v.running && v.speed < p.revMaxSpeed && rate > p.revRate && revAgo >= p.revEvery) {
        out.push({ kind: 'rev', strength: Math.min(1.5, rate / (2 * p.revRate) + 0.5), ...at });
        revAgo = 0;
      }
      this.last.set(v.id, { rpm: v.rpm, horn: !!v.horn, tipped: !!v.tipped, revAgo });
    }
    return out;
  }
}
