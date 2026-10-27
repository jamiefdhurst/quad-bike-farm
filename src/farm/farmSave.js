// The farm that remembers: one save in the browser, read when the page loads and written while you play. Each load is the next
// day. `?seed=N` ignores the save and never writes it, so a seeded game repeats exactly. Pure (the storage is passed in), tested.

export const SAVE_KEY = 'quadBikeFarm';
export const SAVE_VERSION = 1;

export const DEFAULT_FARM_PARAMS = {
  saveEvery: 30, // seconds of play between saves (it also saves when the tab is hidden or closed)
  overnightDrain: 0.05, // battery lost overnight with the key off
  flatOvernight: 0.02, // what's left of a battery when the key was left on overnight
  mudKept: 0.5, // fraction of a quad's mud still on it in the morning (the rest dries and drops off)
  laneKept: 0.5, // fraction of the green lane's ruts still there in the morning (the rest dries out)
  favourKept: 0.5, // fraction of each girl's favour that carries to the next day
  memoryKept: 0.5, // and of how far each feeling for what went well or badly sits from none (npc/memory.js)
  frictionKept: 0.5, // fraction of the girls' friction that carries when they hadn't fallen out
  frictionFallenOut: 6, // their friction in the morning after a falling-out that wasn't made up (8 falls out again)
  endDayHour: 17, // hours after midnight: from then the barn's wall calendar lets you call it a day (sunset is 17:15)
  endDayHomeRadius: 20, // metres from the barn's middle each girl has to be within to call it a day
  endDayFade: 2.2, // seconds the screen takes to go black when you call it a day
  endDayHold: 1.4, // seconds it stays black, saying the day is done, before the next day loads
  recapLogLines: 5, // logbook lines on the end-of-day card (the latest)
  recapTickLines: 6, // bucket list items ticked today that the card names (the rest are counted)
  storySentences: 4, // sentences in the day's story on the card (the most notable things that happened, then the day's totals)
  storiesKept: 10, // days' stories kept in the save, to read on the wall calendar
  recapLock: 1, // seconds before a press dismisses the card, so the press that opened it does not
  recapJessDelay: 3, // seconds after Amy's sign-off that Jess has hers
};

export const FARM_PARAM_RANGES = {
  saveEvery: [5, 300, 5],
  overnightDrain: [0, 0.5, 0.01],
  flatOvernight: [0, 0.3, 0.01],
  mudKept: [0, 1, 0.05],
  laneKept: [0, 1, 0.05],
  favourKept: [0, 1, 0.05],
  memoryKept: [0, 1, 0.05],
  frictionKept: [0, 1, 0.05],
  frictionFallenOut: [0, 10, 0.5],
  endDayHour: [12, 23, 0.25],
  endDayHomeRadius: [8, 60, 1],
  endDayFade: [0.5, 6, 0.1],
  endDayHold: [0.5, 5, 0.1],
  recapLogLines: [1, 12, 1],
  recapTickLines: [1, 12, 1],
  storySentences: [1, 8, 1],
  storiesKept: [1, 40, 1],
  recapLock: [0, 3, 0.1],
  recapJessDelay: [0, 8, 0.5],
};

/** The browser's localStorage, or null where it can't be had (a private window, blocked site data, tests). */
export function browserStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    s.getItem(SAVE_KEY);
    return s;
  } catch {
    return null;
  }
}

/** Whether a parsed save is one this game can use: the right shape, whatever build wrote it (missing parts are dealt). */
export function validSave(save) {
  return (
    !!save &&
    typeof save === 'object' &&
    Number.isInteger(save.version) &&
    save.version >= 1 &&
    save.version <= SAVE_VERSION &&
    Number.isInteger(save.day) &&
    save.day >= 1 &&
    Number.isFinite(save.farmSeed)
  );
}

/** The save in `storage`, or null if there isn't a usable one. */
export function readSave(storage) {
  if (!storage) return null;
  try {
    const save = JSON.parse(storage.getItem(SAVE_KEY) ?? 'null');
    return validSave(save) ? save : null;
  } catch {
    return null;
  }
}

/** Writes the save. False if the browser wouldn't take it (full, blocked). */
export function writeSave(storage, save) {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ ...save, version: SAVE_VERSION }));
    return true;
  } catch {
    return false;
  }
}

export function wipeSave(storage) {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    // nothing to do: it stays, and New farm tries again next time
  }
}

/**
 * What this load is, from the URL and the save:
 * - seeded: `?seed=` is in the URL; the save is left alone and never written, and it is a plain first day.
 * - continuing: there is a save; this is the day after it, on the same farm (its farmSeed deals the farm's character).
 * - otherwise a new farm, Day 1, whose farm seed is the game's own seed.
 * Returns { seeded, continuing, save, day, farmSeed } (farmSeed null for a new farm: the game uses its seed).
 */
export function openFarm({ search = '', storage = null } = {}) {
  const seeded = new URLSearchParams(search).has('seed');
  if (seeded) return { seeded: true, continuing: false, save: null, day: 1, farmSeed: null };
  const save = readSave(storage);
  if (!save) return { seeded: false, continuing: false, save: null, day: 1, farmSeed: null };
  return { seeded: false, continuing: true, save, day: save.day + 1, farmSeed: save.farmSeed };
}

/** The start screen's view of the save: { day } for the day "Continue" plays, or null with no save (or a seeded game). */
export function continueInfo({ search = '', storage = null } = {}) {
  const f = openFarm({ search, storage });
  return f.continuing ? { day: f.day } : null;
}

/** Specs for a saved fleet, in its order, or null if any of them is no longer in the game (the fleet is dealt again). */
export function fleetFromSave(ids, specs) {
  if (!Array.isArray(ids) || !ids.length) return null;
  const out = ids.map((id) => specs.find((s) => s.id === id));
  return out.every(Boolean) ? out : null;
}

/** One line about the farm for the debug panel and the console. `savedAgo` is seconds since it last saved, or null. */
export function describeFarm({ day, seeded, wiped, started, savedAgo }) {
  if (seeded) return 'a seeded game: not saved';
  if (wiped) return `day ${day}, wiped: a new farm next time it loads`;
  if (!started) return `day ${day}, saves once you start playing`;
  return `day ${day}, ${savedAgo === null ? 'not saved yet' : `saved ${Math.round(savedAgo)} s ago`}`;
}
