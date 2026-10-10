// A quad's history: each game it turns up with some wear already on it, sometimes a fault already starting, sometimes the last
// person's tinkering left in (throttle stop screwed out, mixture rich), and someone having had it out the day before. The girls
// know some of it, as well as their `diagnoseAccuracy` lets them. Pure logic, from a seeded random so `?seed=` repeats it.

import { FAULT_KINDS } from './faults.js';

export const DEFAULT_HISTORY_PARAMS = {
  wearFromHours: 0.7, // how much of a quad's starting wear follows its hour meter (the rest is luck)
  faultChanceLow: 0.15, // each game the chance a quad starts with a fault is picked from this range, so some fleets are all sound...
  faultChanceHigh: 0.6, // ...and some are a wreck
  secondFault: 0.25, // chance a quad that has one fault has a second, of a different kind
  faultLevelLow: 0.15, // a starting fault's level is picked from this range (0.15 is just noticeable, 1 is its worst)
  faultLevelHigh: 0.55,
  tinkerChance: 0.25, // chance a quad starts with someone's tinkering left in
  tinkerBoth: 0.2, // of those, the chance it's both the throttle stop and the mixture
  stopTurnsMax: 3, // throttle stop turns out from stock (the toolbox's own limit)
  richClicksMax: 3, // mixture clicks rich from stock (the toolbox's own limit)
  riderNobody: 0.1, // chance nobody had it out yesterday
  riderJess: 0.5, // of the rest, the chance it was Jess (she gets about)
};

export const HISTORY_PARAM_RANGES = {
  wearFromHours: [0, 1, 0.05],
  faultChanceLow: [0, 1, 0.05],
  faultChanceHigh: [0, 1, 0.05],
  secondFault: [0, 1, 0.05],
  faultLevelLow: [0.15, 1, 0.05],
  faultLevelHigh: [0.15, 1, 0.05],
  tinkerChance: [0, 1, 0.05],
  tinkerBoth: [0, 1, 0.05],
  stopTurnsMax: [1, 6, 1],
  richClicksMax: [1, 5, 1],
  riderNobody: [0, 1, 0.05],
  riderJess: [0, 1, 0.05],
};

const lerp = (a, b, t) => a + (b - a) * t;

/** This game's chance of a starting fault, shared by every quad: one roll for the fleet. */
export function pickFaultChance(random, P = DEFAULT_HISTORY_PARAMS) {
  return lerp(P.faultChanceLow, P.faultChanceHigh, random());
}

/**
 * One quad's history. `hoursT` is where its hour meter sits in the spec's range (0 low, 1 high), which pulls the wear up with it.
 * Returns { wear, faults: [{ kind, level }], tinker: { limiter, mixture } | null, lastRider: 'amy' | 'jess' | null }.
 */
export function pickHistory(spec, random, { faultChance, hoursT = 0.5, P = DEFAULT_HISTORY_PARAMS }) {
  const [wearLo, wearHi] = spec.wearRange ?? [0, 0];
  const wear = Math.round(lerp(wearLo, wearHi, P.wearFromHours * hoursT + (1 - P.wearFromHours) * random()) * 1000) / 1000;

  const faults = [];
  if (random() < faultChance) {
    const pool = [...FAULT_KINDS];
    const count = random() < P.secondFault ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const kind = pool.splice(Math.floor(random() * pool.length), 1)[0];
      faults.push({ kind, level: Math.round(lerp(P.faultLevelLow, P.faultLevelHigh, random()) * 100) / 100 });
    }
  }

  let tinker = null;
  if (spec.tinkers !== false && random() < P.tinkerChance) {
    const both = random() < P.tinkerBoth;
    const stop = both || random() < 0.5;
    tinker = {
      limiter: stop ? 1 + Math.floor(random() * P.stopTurnsMax) : 0,
      mixture: both || !stop ? 1 + Math.floor(random() * P.richClicksMax) : 0,
    };
  }

  const lastRider = random() < P.riderNobody ? null : random() < P.riderJess ? 'jess' : 'amy';
  return { wear, faults, tinker, lastRider };
}

/**
 * What one girl believes about a quad's history, from its truth and how good she is (`accuracy`, her diagnoseAccuracy).
 * She may have missed a fault or the tinkering altogether, and misremember who had it out (naming the other girl).
 * Returns { rider: 'amy' | 'jess' | null, faults: kinds she knows, tinker: whether she's spotted it, tinkerKinds: 'limiter' | 'mixture' }.
 */
export function girlKnows(history, accuracy, random) {
  let rider = history.lastRider;
  if (rider && random() >= accuracy) rider = rider === 'amy' ? 'jess' : 'amy';
  const faults = history.faults.filter(() => random() < accuracy).map((f) => f.kind);
  const tinker = history.tinker ? random() < accuracy : false;
  return { rider, faults, tinker };
}

/** Whether the tinkering is still there: any toolbox setting still off stock, in the way the history left it. */
export function stillTinkered(history, settings) {
  if (!history.tinker || !settings) return { limiter: false, mixture: false };
  return { limiter: history.tinker.limiter > 0 && settings.limiter > 0, mixture: history.tinker.mixture > 0 && settings.mixture > 0 };
}

/** Which topics a girl could bring up about a quad right now, in the order she'd mention them. Each is a line kind. */
export function historyTopics(knows, history, { faultsNow, settingsNow }, said) {
  const topics = [];
  if (knows.rider) topics.push(knows.rider === 'amy' ? 'histRiderAmy' : 'histRiderJess');
  for (const kind of knows.faults) if (faultsNow(kind)) topics.push(HISTORY_FAULT_KINDS[kind]);
  if (knows.tinker) {
    const t = stillTinkered(history, settingsNow);
    if (t.limiter) topics.push('histLimiter');
    if (t.mixture) topics.push('histMixture');
  }
  return topics.filter((t) => !said.has(t));
}

export const HISTORY_FAULT_KINDS = { puncture: 'histPuncture', belt: 'histBelt', cable: 'histCable', carb: 'histCarb', mounts: 'histMounts' };
