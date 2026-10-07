// The handbrake: an empty quad only stays put on a slope if somebody set its parking brake. This watches the quads for one rolling away
// with the brake off, and works out whose fault it was from who last got off it and whether they set the brake. Pure logic.

export const DEFAULT_HANDBRAKE_PARAMS = {
  rollSpeed: 0.5, // m/s an empty quad with the brake off has to be going before it counts as rolling away
  restSeconds: 3, // seconds it has to be nearly still before it can be called rolling away again
  ownUpAfter: 2.5, // seconds after it starts rolling before the girl who forgot owns up
  hearRange: 18, // metres a girl can be from a rolling quad and notice
};

export const HANDBRAKE_PARAM_RANGES = {
  rollSpeed: [0.1, 3, 0.05],
  restSeconds: [0.5, 20, 0.5],
  ownUpAfter: [0, 10, 0.1],
  hearRange: [3, 60, 1],
};

export class RollWatch {
  constructor(P = DEFAULT_HANDBRAKE_PARAMS) {
    this.P = P;
    this.state = new Map(); // quad id -> { rolling, still }
    this.pending = []; // { id, who, left } own-ups still to come
    this.tally = {}; // who -> how many times they left a quad without the brake that then rolled
  }

  /**
   * @param {number} dt
   * @param {{ id: string, attended: boolean, braked: boolean, speed: number, left: ({ who: string, braked: boolean }|null) }[]} quads
   *   `attended`: somebody is at the controls (or it is still carrying on from them); `left`: who last got off it, and whether they set the brake.
   * @returns {{ type: 'roll' | 'own', id: string, who: string|null }[]}  `who`: whose fault (a girl's id or 'you'), or null if nobody's
   */
  update(dt, quads) {
    const P = this.P;
    const events = [];
    for (const q of quads) {
      const s = this.state.get(q.id) ?? { rolling: false, still: 0 };
      this.state.set(q.id, s);
      const loose = !q.attended && !q.braked;
      if (s.rolling) {
        s.still = !loose || q.speed < 0.1 ? s.still + dt : 0;
        if (s.still >= P.restSeconds || q.attended || q.braked) s.rolling = false;
      } else if (loose && q.speed > P.rollSpeed) {
        s.rolling = true;
        s.still = 0;
        const who = q.left && !q.left.braked ? q.left.who : null;
        if (who) this.tally[who] = (this.tally[who] ?? 0) + 1;
        events.push({ type: 'roll', id: q.id, who });
        if (who && who !== 'you') this.pending.push({ id: q.id, who, left: P.ownUpAfter });
      }
    }
    this.pending = this.pending.filter((p) => {
      if ((p.left -= dt) > 0) return true;
      events.push({ type: 'own', id: p.id, who: p.who });
      return false;
    });
    return events;
  }
}

/** Which girl says what about a quad rolling away, given who is near it. Returns [{ girl, situation }] in the order they speak. */
export function rollReactions(event, girls) {
  const near = girls.filter((g) => g.near);
  if (event.type === 'own') return near.some((g) => g.id === event.who) ? [{ girl: event.who, situation: 'handbrakeOwn' }] : [];
  if (!near.length) return [];
  if (!event.who) return [{ girl: near[0].id, situation: 'handbrakeRoll' }];
  if (event.who === 'you') return [{ girl: near[0].id, situation: 'handbrakeYou' }];
  const friend = near.find((g) => g.id !== event.who);
  if (friend) return [{ girl: friend.id, situation: `handbrake${event.who[0].toUpperCase()}${event.who.slice(1)}` }];
  return [{ girl: event.who, situation: 'handbrakeOwn' }]; // only she is near, so she owns up straight away
}
