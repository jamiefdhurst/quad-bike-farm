// The farm that remembers: one save in the browser, read when the page loads and written while you play. Each load is the next
// day. `?seed=N` ignores the save and never writes it, so a seeded game repeats exactly. Pure (the storage is passed in), tested.

import { LAYOUT_VERSION } from '../world/layout.js';

export const SAVE_KEY = 'quadBikeFarm';
export const SAVE_VERSION = 2; // 2: vehicles are keyed by their model names (#589); a version 1 save is converted as it is read (migrateSave)
export const LAYOUT_RESET_TOAST = 'The farm has been laid out again. Your vehicles, money and the girls are as you left them.';

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

/** What each vehicle's id was before it became its in-game model name (#589), for saves written then. `plover` and `rusty` kept theirs. */
export const OLD_VEHICLE_IDS = {
  red: 'farm300', blue: 'bruin', yellow: 'hornet', green: 'rb300', orange: 'adder', kids: 'asp', moto: 'tz65', ag200: 'shepherd', mower: 'clipper',
  atc: 't185', loan: 'ursa', tractor: 'hartley', utv: 'yak', landrover: 'tor', landrover200: 'crag', fiesta: 'finch', corsa: 'griffin', p309: 'vauclair',
};

const newId = (id) => OLD_VEHICLE_IDS[id] ?? id;
const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const rekey = (o) => (isObject(o) ? Object.fromEntries(Object.entries(o).map(([id, v]) => [newId(id), v])) : o);
const renameAll = (list) => (Array.isArray(list) ? list.map((id) => (typeof id === 'string' ? newId(id) : id)) : list);
const renameSpec = (list) => (Array.isArray(list) ? list.map((e) => (isObject(e) && typeof e.specId === 'string' ? { ...e, specId: newId(e.specId) } : e)) : list);

/**
 * A version 1 save as version 2: every place the save names a vehicle by id uses its model name now (#589): the fleet, the cork board's
 * bought, sold and ledger, each vehicle's condition, the pods, what each girl has worked out about each quad, the ticked "Ride the ..."
 * achievements, each record's quad, the rolling road's runs, the MOT's sheets and certificates, and the batteries. Nothing is dropped, so it
 * is never `breaking`. A save already at version 2 is returned as it is.
 */
export function migrateSave(save) {
  if (!save || save.version >= 2) return save;
  const out = { ...save, version: 2 };
  out.fleet = renameAll(save.fleet);
  if (isObject(save.market)) out.market = { ...save.market, bought: renameSpec(save.market.bought), sold: renameAll(save.market.sold), ledger: renameSpec(save.market.ledger) };
  out.vehicles = rekey(save.vehicles);
  out.pods = rekey(save.pods);
  out.batteries = rekey(save.batteries);
  out.road = rekey(save.road);
  if (isObject(save.girls)) out.girls = { ...save.girls, opinions: isObject(save.girls.opinions) ? Object.fromEntries(Object.entries(save.girls.opinions).map(([girl, seen]) => [girl, rekey(seen)])) : save.girls.opinions };
  if (Array.isArray(save.bucket)) out.bucket = save.bucket.map((id) => (typeof id === 'string' && id.startsWith('ride-') ? `ride-${newId(id.slice(5))}` : id));
  if (isObject(save.records)) out.records = { ...save.records, byQuad: isObject(save.records.byQuad) ? Object.fromEntries(Object.entries(save.records.byQuad).map(([kind, quads]) => [kind, rekey(quads)])) : save.records.byQuad };
  if (isObject(save.mot)) {
    out.mot = {
      ...save.mot,
      last: rekey(save.mot.last),
      certificate: rekey(save.mot.certificate),
      history: Array.isArray(save.mot.history) ? save.mot.history.map((h) => (isObject(h) && typeof h.specId === 'string' ? { ...h, specId: newId(h.specId) } : h)) : save.mot.history,
    };
  }
  for (const key of Object.keys(out)) if (out[key] === undefined) delete out[key]; // a part the old save never had stays missing
  return out;
}

/** The save in `storage`, or null if there isn't a usable one. */
export function readSave(storage) {
  if (!storage) return null;
  try {
    const save = JSON.parse(storage.getItem(SAVE_KEY) ?? 'null');
    return validSave(save) ? migrateSave(save) : null;
  } catch {
    return null;
  }
}

/** Writes the save. False if the browser wouldn't take it (full, blocked). */
export function writeSave(storage, save) {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ ...save, version: SAVE_VERSION, layoutVersion: LAYOUT_VERSION }));
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
 * The save as the map the game has now can use it. A save from another layout version (one with none is version 1) loses every kept
 * position, so those are dealt afresh as on a new farm: the bales, the lane's ruts, the mown, cut, sprayed and combed ground, the loose
 * batteries and what was left lying about. Everything else carries over (condition, money, favour, records, the calendar, the stocks).
 * Returns { save, reset }; the same save and false when the versions match.
 */
export function forLayout(save, layoutVersion = LAYOUT_VERSION) {
  if (!save || (save.layoutVersion ?? 1) === layoutVersion) return { save, reset: false };
  const kept = { ...save, layoutVersion };
  for (const key of ['bales', 'lane', 'mowing', 'harrow', 'batteries', 'lostThings']) delete kept[key];
  if (kept.hay) kept.hay = { stacked: kept.hay.stacked }; // the stack in the shed is a count; the cut grass was in a place
  if (kept.spray) kept.spray = { tank: kept.spray.tank }; // what is left in the sprayer, not where it went
  if (kept.boosterPack) kept.boosterPack = { ...kept.boosterPack, where: 'loose' };
  return { save: kept, reset: true };
}

/**
 * What this load is, from the URL and the save:
 * - seeded: `?seed=` is in the URL; the save is left alone and never written, and it is a plain first day.
 * - continuing: there is a save; this is the day after it, on the same farm (its farmSeed deals the farm's character).
 * - otherwise a new farm, Day 1, whose farm seed is the game's own seed.
 * Returns { seeded, continuing, save, day, farmSeed, layoutReset } (farmSeed null for a new farm: the game uses its seed; layoutReset when
 * the save was from another layout version and its positions were dropped).
 */
export function openFarm({ search = '', storage = null, layoutVersion = LAYOUT_VERSION } = {}) {
  const seeded = new URLSearchParams(search).has('seed');
  if (seeded) return { seeded: true, continuing: false, save: null, day: 1, farmSeed: null };
  const read = readSave(storage);
  if (!read) return { seeded: false, continuing: false, save: null, day: 1, farmSeed: null };
  const { save, reset } = forLayout(read, layoutVersion);
  return { seeded: false, continuing: true, save, day: save.day + 1, farmSeed: save.farmSeed, layoutReset: reset };
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
