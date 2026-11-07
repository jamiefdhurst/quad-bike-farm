// Lunch, and a biscuit between. Hunger (needs.js) builds through the morning to a peak at half past twelve; a hungry girl who is free
// fetches her bag from her car and eats on the Tor's tailgate or the bales (or under the barn roof in the wet), which meets it in full,
// or takes a biscuit from the tin in the barn, which meets a little at any time. Come and stand by her while she eats and she shares a
// word. Both are offers weighed by the chooser (chooser.js). Pure logic: the game says who is free, how hungry and where you are, and
// does the walking, the sitting and the props; this says what happens next.

export const DEFAULT_LUNCH_PARAMS = {
  startHour: 11.5, // the hour before which nobody thinks of lunch
  endHour: 15, // and after which they have missed it (a biscuit is all that's left)
  hungerAt: 0.4, // hunger she has to feel before she thinks of lunch
  weight: 1.3, // how much she cares for lunch (weighed against everything else she could do, chooser.js)
  biscuitAt: 0.25, // hunger she has to feel before she thinks of the tin
  biscuitWeight: 0.7, // how much she cares for a biscuit
  biscuitCooldown: 300, // seconds before the same girl takes another biscuit
  cooldown: 1500, // seconds before the same girl has another lunch (so one a day)
  eatSeconds: 40, // seconds she sits with her lunch
  biscuitSeconds: 8, // seconds she stands with her biscuit
  fetchTimeout: 80, // seconds she has to get to her car and back with the bag
  goTimeout: 80, // seconds she has to get from the car to a seat
  joinRange: 4, // metres: you are this close to her while she eats to be sharing it
  joinSeconds: 3, // seconds you have to stand there
  joinFavour: 1.2, // favour for the girl whose lunch you joined
  sulkHunger: 0.85, // hunger past which she remarks on missing lunch, once the afternoon is on
  sulkHour: 15.5, // the hour from which she does
};

export const LUNCH_PARAM_RANGES = {
  startHour: [6, 16, 0.25],
  endHour: [11, 20, 0.25],
  hungerAt: [0, 1, 0.05],
  weight: [0, 3, 0.05],
  biscuitAt: [0, 1, 0.05],
  biscuitWeight: [0, 3, 0.05],
  biscuitCooldown: [0, 1800, 10],
  cooldown: [0, 3600, 30],
  eatSeconds: [5, 180, 5],
  biscuitSeconds: [2, 40, 1],
  fetchTimeout: [10, 300, 5],
  goTimeout: [10, 300, 5],
  joinRange: [1, 15, 0.5],
  joinSeconds: [0.5, 20, 0.5],
  joinFavour: [0, 10, 0.1],
  sulkHunger: [0.3, 1, 0.01],
  sulkHour: [12, 22, 0.25],
};

/** Where she eats it: the Tor's tailgate when the Tor is parked and the day is dry, else the bales, and under the barn roof in the rain. */
export function whereToEat({ rain = 0, torParked = false, balesFree = true } = {}, rainAbove = 0.15) {
  if (rain > rainAbove) return 'barn';
  if (torParked) return 'tailgate';
  return balesFree ? 'bales' : 'barn';
}

export class Lunch {
  constructor(params = { ...DEFAULT_LUNCH_PARAMS }) {
    this.p = params;
    this.clock = 0;
    this.sessions = {}; // girl id -> { kind: 'lunch' | 'biscuit', phase, t, said, near, joined }
    this.lunchAt = {}; // girl id -> clock of her last lunch
    this.biscuitAt = {}; // girl id -> clock of her last biscuit
    this.sulked = {}; // girl id -> the day she last remarked on missing lunch
    this.forced = null; // 'lunch' | 'biscuit': the debug panel asks the next free girl
  }

  get active() {
    return Object.keys(this.sessions).length > 0;
  }

  /** Whether this girl has her lunch or her biscuit under way. */
  has(girl) {
    return !!this.sessions[girl];
  }

  /** Her session's phase ('fetch', 'go', 'eat'), or null. */
  phase(girl) {
    return this.sessions[girl]?.phase ?? null;
  }

  lunchTime(hour) {
    return hour >= this.p.startHour && hour <= this.p.endHour;
  }

  /**
   * What each free, hungry girl could do now: [{ key: 'lunch' | 'biscuit', girl, weight }] for the chooser. `ctx`: { hour, tin (the tin is
   * there to be opened), girls: [{ id, free, hunger }] }.
   */
  offers(ctx) {
    const p = this.p;
    const out = [];
    for (const g of ctx.girls) {
      if (!g.free || this.sessions[g.id]) continue;
      if (this.lunchTime(ctx.hour) && g.hunger >= p.hungerAt && this.clock - (this.lunchAt[g.id] ?? -Infinity) >= p.cooldown) {
        out.push({ key: 'lunch', girl: g.id, weight: p.weight });
      }
      if (ctx.tin && g.hunger >= p.biscuitAt && this.clock - (this.biscuitAt[g.id] ?? -Infinity) >= p.biscuitCooldown) {
        out.push({ key: 'biscuit', girl: g.id, weight: p.biscuitWeight });
      }
    }
    return out;
  }

  /** She chose to: books it and returns the event the game acts on. */
  take(offer) {
    return this.begin(offer.girl, offer.key);
  }

  /** Starts it for this girl (a choice, or the debug panel). Returns { type: 'fetch' | 'tin', girl } or null if she's already at one. */
  begin(girl, kind) {
    if (this.sessions[girl]) return null;
    this.sessions[girl] = { kind, phase: kind === 'lunch' ? 'fetch' : 'tin', t: 0, said: new Set(), near: 0, joined: false };
    return { type: kind === 'lunch' ? 'fetch' : 'tin', girl };
  }

  /** The game could not do it (nowhere to go, she was stopped): forget it without a cooldown. */
  cancel(girl) {
    delete this.sessions[girl];
  }

  /** She has the bag from her car: on to the seat. Returns the event the game acts on. */
  gotBag(girl) {
    const s = this.sessions[girl];
    if (!s || s.phase !== 'fetch') return null;
    s.phase = 'go';
    s.t = 0;
    return { type: 'go', girl };
  }

  /** She is sat down (lunch) or has the lid up (biscuit): the eating starts. */
  startedEating(girl) {
    const s = this.sessions[girl];
    if (!s || (s.phase !== 'go' && s.phase !== 'tin')) return [];
    s.phase = 'eat';
    s.t = 0;
    return [{ type: 'eat', girl, kind: s.kind }, { type: 'say', girl, line: s.kind === 'lunch' ? 'lunchEat' : 'biscuitEat' }];
  }

  /**
   * One step. `ctx`: { hour, day, youDistance: { amy: m, jess: m } (to each girl), girls: { id: hunger } }. Events: { type: 'say', girl, line },
   * { type: 'join', girl } (you came over to share it), { type: 'end', girl, kind, why: 'done' | 'lost' }.
   */
  update(dt, ctx) {
    const p = this.p;
    this.clock += dt;
    const events = [];
    for (const [girl, s] of Object.entries(this.sessions)) {
      s.t += dt;
      const end = (why) => {
        delete this.sessions[girl];
        if (why === 'done') (s.kind === 'lunch' ? this.lunchAt : this.biscuitAt)[girl] = this.clock;
        events.push({ type: 'end', girl, kind: s.kind, why });
      };
      if (s.phase === 'fetch' && s.t >= p.fetchTimeout) end('lost');
      else if (s.phase === 'go' && s.t >= p.goTimeout) end('lost');
      else if (s.phase === 'tin' && s.t >= p.goTimeout) end('lost');
      else if (s.phase === 'eat') {
        if (s.kind === 'lunch' && !s.joined) {
          s.near = (ctx.youDistance?.[girl] ?? Infinity) <= p.joinRange ? s.near + dt : 0;
          if (s.near >= p.joinSeconds) {
            s.joined = true;
            events.push({ type: 'join', girl }, { type: 'say', girl, line: 'lunchJoin' });
          }
        }
        if (s.t >= (s.kind === 'lunch' ? p.eatSeconds : p.biscuitSeconds)) {
          events.push({ type: 'say', girl, line: s.kind === 'lunch' ? 'lunchDone' : 'biscuitDone' });
          end('done');
        }
      }
    }
    // Missed lunch: once the afternoon is on and she is still starving, she says so (once a day, never refusing anything).
    if (ctx.hour >= p.sulkHour) {
      for (const [girl, hunger] of Object.entries(ctx.girls ?? {})) {
        if (hunger >= p.sulkHunger && this.sulked[girl] !== ctx.day && !this.sessions[girl]) {
          this.sulked[girl] = ctx.day;
          events.push({ type: 'say', girl, line: 'lunchMissed' });
        }
      }
    }
    return events;
  }
}
