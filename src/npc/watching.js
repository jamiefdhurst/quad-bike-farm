// Teaching her by showing her. You ask a girl to watch you do something (bump-start a quad, double-declutch into a gear with no
// synchromesh); when you do it, her skill at it jumps, but only if she was looking (her attention, attention.js) for most of the
// last few seconds. If her eye was caught by something else she misses it and says so. Pure logic, tested in tests/watching.test.js:
// the game says who is looking each frame and when you have done the thing, and acts on the events.

export const DEFAULT_WATCH_PARAMS = {
  watchSeconds: 45, // how long she waits for you to do it before she gives up
  showSeconds: 8, // the stretch just before you finish that counts as her watching it
  lookedShare: 0.6, // the share of that stretch she must have spent looking at you or your vehicle
  watchRange: 20, // metres: how near she must be for you to ask her to watch
  watchWeight: 1.2, // how strongly she turns to look when asked (1 is like a state's focus; a loud noise can still beat it)
};

export const WATCH_PARAM_RANGES = {
  watchSeconds: [5, 180, 1],
  showSeconds: [2, 30, 0.5],
  lookedShare: [0.1, 1, 0.05],
  watchRange: [3, 60, 1],
  watchWeight: [0, 3, 0.1],
};

/** What you can show her: the skill it teaches and the wheel's label. */
export const WATCH_THINGS = {
  bumpStart: { skill: 'bumpStart', label: 'Watch me bump-start it' },
  doubleDeclutch: { skill: 'doubleDeclutch', label: 'Watch me double-declutch' },
};

export class Watching {
  constructor(params = { ...DEFAULT_WATCH_PARAMS }) {
    this.p = params;
    this.sessions = new Map(); // girl id -> { thing, age, samples: [{ dt, looking }] }
  }

  /** She is asked to watch for `thing` (a WATCH_THINGS key). Replaces whatever she was watching for. */
  begin(id, thing) {
    if (!WATCH_THINGS[thing]) return false;
    this.sessions.set(id, { thing, age: 0, samples: [] });
    return true;
  }

  /** What she is watching for, or null. */
  thing(id) {
    return this.sessions.get(id)?.thing ?? null;
  }

  cancel(id) {
    this.sessions.delete(id);
  }

  /** One frame. `looking(id)` says whether she is looking at you or your vehicle now. Returns [{ id, type: 'gaveUp' }]. */
  update(dt, looking) {
    const events = [];
    for (const [id, s] of this.sessions) {
      s.age += dt;
      s.samples.push({ dt, looking: !!looking(id) });
      // Only the last showSeconds count, so drop what is older.
      let total = s.samples.reduce((a, x) => a + x.dt, 0);
      while (s.samples.length > 1 && total - s.samples[0].dt >= this.p.showSeconds) total -= s.samples.shift().dt;
      if (s.age >= this.p.watchSeconds) {
        this.sessions.delete(id);
        events.push({ id, type: 'gaveUp' });
      }
    }
    return events;
  }

  /** The share of the last `showSeconds` she spent looking (the time before she was asked counts as not looking). */
  share(id) {
    const s = this.sessions.get(id);
    if (!s) return 0;
    const looked = s.samples.reduce((a, x) => a + (x.looking ? x.dt : 0), 0);
    return Math.min(1, looked / Math.min(this.p.showSeconds, Math.max(s.age, 1e-6)));
  }

  /**
   * You have done `thing`. Everyone watching for it is done: [{ id, skill, saw, share }]. `saw` is whether she was looking enough.
   */
  shown(thing) {
    const out = [];
    for (const [id, s] of [...this.sessions]) {
      if (s.thing !== thing) continue;
      const share = this.share(id);
      out.push({ id, skill: WATCH_THINGS[thing].skill, saw: share >= this.p.lookedShare, share });
      this.sessions.delete(id);
    }
    return out;
  }
}
