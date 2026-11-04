// The start-of-day briefing (#45, was TODO 150). Soon after the game loads Amy reads out the day, turning state you'd otherwise have to
// go and find into story: the weather (and what the barn's board says of it), which quad is playing up, then what each girl has in mind
// (npc/agenda.js). Pure: `planBriefing` works out the steps, `Briefing` walks them one at a time as the girls are free to speak.

import { agendaKey } from './agenda.js';

export const DEFAULT_BRIEFING_PARAMS = {
  briefingOn: 1, // 1 = the girls brief you at the start of the day, 0 = they don't
  briefingAfter: 8, // seconds into the game before Amy starts
  briefingGap: 0.8, // seconds of quiet between one part of the briefing and the next
  briefingGiveUp: 40, // seconds with nobody free to say the next part before it is dropped
  briefingTroubleFrom: 0.25, // how bad a quad's worst fault must be for it to be called playing up
};

export const BRIEFING_PARAM_RANGES = {
  briefingOn: [0, 1, 1],
  briefingAfter: [0, 60, 1],
  briefingGap: [0, 4, 0.1],
  briefingGiveUp: [10, 120, 5],
  briefingTroubleFrom: [0.05, 1, 0.05],
};

/** The weather line that fits the day (companionVoice's weather remark and the briefing share it): rain and storm first, then a worthwhile temperature. */
export function weatherSituation(weather) {
  if (!weather) return null;
  const temperature = { frosty: 'frost', cold: 'cold', warm: 'warm' }[weather.band];
  const kind = weather.storm > 0.5 ? 'storm' : weather.rain > 0.25 ? 'raining' : temperature ?? ({ sunny: 'sunny', fair: 'sunny', fog: 'fog' }[weather.kind] ?? 'grey');
  return { sunny: 'weatherSunny', raining: 'weatherRain', storm: 'weatherStorm', fog: 'weatherFog', grey: 'weatherGrey', frost: 'weatherFrost', cold: 'weatherCold', warm: 'weatherWarm' }[kind];
}

/**
 * The quad most worth a warning: the one whose worst started fault is highest, if it is at least `from`. `faults` is { specId: faults } where
 * each has `started[kind]` and `levels[kind]` (vehicle/faults.js); returns the spec id or null.
 */
export function worstTrouble(faults, kinds, from) {
  let best = null;
  let worst = from;
  for (const [id, f] of Object.entries(faults)) {
    for (const k of kinds) {
      if (f.started?.[k] && f.levels[k] >= worst) {
        worst = f.levels[k];
        best = id;
      }
    }
  }
  return best;
}

/**
 * What the last day left behind, from the farm's save (farm/farmState.js), most telling first and at most `max`: the girls still not
 * speaking, then a key left on with the engine stopped (so a flat battery this morning). `save` is the raw save, from before the night;
 * returns steps like planBriefing's, [] on a new farm.
 */
export function yesterdayOf(save, max = 2) {
  if (!save) return [];
  const steps = [];
  if (save.girls?.fallenOut) {
    steps.push({ girl: 'amy', key: 'briefingYesterdayFallenOut' }, { girl: 'jess', key: 'briefingYesterdayFallenOut', cutIn: true });
  }
  const keyLeftOn = Object.values(save.vehicles ?? {}).some((v) => v?.keyOn && !v.running && !v.engine?.batteryOut);
  if (keyLeftOn) steps.push({ girl: 'amy', key: 'briefingYesterdayKey' });
  // A falling-out is two parts (her, then Jess cutting in); count the telling, not the parts.
  const told = [];
  let kinds = 0;
  for (const st of steps) {
    if (!st.cutIn) kinds++;
    if (kinds > max) break;
    told.push(st);
  }
  return told;
}

/**
 * The parts of the briefing, in order, each { girl, key } or { girl, quad: specId, key } (a line about a quad, said by `voice.sayQuad`).
 * `day`: { weather, promise, trouble (a spec id or null), agendas: { amy, jess } (agenda ids or null), yesterday (yesterdayOf's steps, optional) }.
 */
export function planBriefing(day) {
  const steps = [];
  const say = (girl, key, extra = {}) => steps.push({ girl, key, ...extra });
  say('amy', 'briefingOpen');
  for (const st of day.yesterday ?? []) say(st.girl, st.key);
  const weather = weatherSituation(day.weather);
  if (weather) say('amy', weather);
  if (day.promise) say('amy', day.promise.worse ? 'forecastWorse' : 'forecastBetter');
  if (day.trouble) say('amy', 'briefingTrouble', { quad: day.trouble });
  else say('amy', 'briefingAllWell');
  if (day.agendas.amy) say('amy', agendaKey(day.agendas.amy), { agenda: true });
  if (day.agendas.jess) say('jess', agendaKey(day.agendas.jess), { agenda: true });
  return steps;
}

export class Briefing {
  constructor(p = DEFAULT_BRIEFING_PARAMS) {
    this.p = p;
    this.clock = 0;
    this.steps = null; // null until it starts
    this.gap = 0;
    this.stuck = 0;
    this.done = false;
  }

  get active() {
    return !!this.steps && !this.done;
  }

  /** Starts it now (the debug panel and the console), with the steps from `planBriefing`. */
  begin(steps) {
    this.steps = [...steps];
    this.gap = 0;
    this.stuck = 0;
    this.done = false;
  }

  /** Whether it is time for the game to plan it: on, not yet begun, and `briefingAfter` seconds in. */
  due(dt) {
    if (this.steps || !this.p.briefingOn) return false;
    return (this.clock += dt) >= this.p.briefingAfter;
  }

  /**
   * Time passes. `quiet`: nobody is talking. `can(girl)`: that girl could say something now. Returns the next step to say, or null; the caller
   * says it and the pause before the one after starts here. A part that nobody can say for `briefingGiveUp` seconds is dropped.
   */
  next(dt, quiet, can) {
    if (!this.active) return null;
    if (!this.steps.length) {
      this.done = true;
      return null;
    }
    if (!quiet) return null;
    if ((this.gap -= dt) > 0) return null;
    if (!can(this.steps[0].girl)) {
      if ((this.stuck += dt) >= this.p.briefingGiveUp) this.steps.shift();
      return null;
    }
    this.stuck = 0;
    this.gap = this.p.briefingGap;
    return this.steps.shift();
  }

  /** Over with, so it is not begun again this game. */
  skip() {
    this.steps = [];
    this.done = true;
  }
}
