// Calling it a day: the wall calendar in the barn lets you cross the day off once it is evening and the girls are in, then the screen
// fades to black while the farm saves and the page loads the next day (farmSave.js: each load is the next day). Pure, tested.

import { clockText } from '../world/daylight.js';

/**
 * What the calendar says and whether pressing E on it ends the day. `girls` is [{ name, home }], `day` the day being played, `canSave`
 * whether the browser will keep the farm.
 */
export function endOfDay({ hour, seeded, canSave, girls, day }, p) {
  if (seeded) return { ok: false, text: 'A seeded game does not carry on to another day' };
  if (!canSave) return { ok: false, text: 'This browser will not keep the farm, so there is no next day to carry on to' };
  if (hour < p.endDayHour) return { ok: false, text: `Too early to call it a day: wait until ${clockText(p.endDayHour)}` };
  const away = girls.filter((g) => !g.home);
  if (away.length === 1) return { ok: false, text: `${away[0].name} isn't back at the barn yet: ring the bell` };
  if (away.length > 1) return { ok: false, text: 'Ring the bell to bring the girls back to the barn first' };
  return { ok: true, text: `Press E to call it a day: day ${day} ends, and day ${day + 1} starts in the morning` };
}

/** The fade to black: it darkens over `fade` seconds, holds black for `hold`, then it is done and the page reloads. */
export class DayFade {
  constructor() {
    this.t = null;
  }

  get active() {
    return this.t !== null;
  }

  start() {
    if (this.t === null) this.t = 0;
  }

  /** Moves on `dt` seconds. Returns { alpha (0..1 how black), done }. */
  update(dt, p) {
    if (this.t === null) return { alpha: 0, done: false };
    this.t += dt;
    return { alpha: Math.min(1, this.t / Math.max(0.01, p.endDayFade)), done: this.t >= p.endDayFade + p.endDayHold };
  }
}
