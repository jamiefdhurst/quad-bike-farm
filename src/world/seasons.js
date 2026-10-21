// The farm's calendar and the seasons that follow from it. The farm has its own year (not today's date): a new farm starts on a date dealt
// from its farm seed and every game after is the next day, with the real months' lengths (365 days, no leap years). The date gives the
// season, and the season gives the day its weather pool, its warmth, how long the daylight is, how wet or dusty the ground is and how
// the trees look. Pure, tested (tests/seasons.test.js); game.js applies it.

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const YEAR_DAYS = 365;

/** Which season each month is in (the meteorological ones: spring is March to May). */
const SEASON_OF_MONTH = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];

/** Day of the year (0..364) of the middle of each season, for `?season=` and the debug panel. */
const MIDDLE = { spring: dayOfYearOf(4, 15), summer: dayOfYearOf(7, 15), autumn: dayOfYearOf(10, 15), winter: dayOfYearOf(1, 15) };

/** Day of the year (0 for the 1st of January) of a month (0..11) and day of the month (1-based). */
function dayOfYearOf(month, dom) {
  let d = 0;
  for (let m = 0; m < month; m++) d += MONTH_DAYS[m];
  return d + dom - 1;
}

/** The farm's first day: a day of the year (0..364) dealt from the farm's seed. `createRandom` is the game's. */
export function startDayOfYear(farmSeed, createRandom) {
  return Math.floor(createRandom((farmSeed ?? 0) ^ 0x5ea5)() * YEAR_DAYS) % YEAR_DAYS;
}

/**
 * The farm's date on farm day `day` (1 is the first day): { dayOfYear, month (0..11), dom (1-based), monthName, year (1 is the farm's
 * first), season, weekday (0 is Monday; the farm's own weeks, which start wherever its first day falls) }.
 */
export function farmDate({ start, day }) {
  const n = Math.max(0, Math.floor(day || 1) - 1) + start;
  const dayOfYear = n % YEAR_DAYS;
  let month = 0;
  let left = dayOfYear;
  while (left >= MONTH_DAYS[month]) left -= MONTH_DAYS[month++];
  return { dayOfYear, month, dom: left + 1, monthName: MONTH_NAMES[month], year: 1 + Math.floor(n / YEAR_DAYS), season: SEASON_OF_MONTH[month], weekday: (n + 3) % 7 };
}

/** The season in the URL's `?season=` ('spring', 'summer', 'autumn' or 'winter'), or null. */
export function forcedSeason(value) {
  return SEASONS.includes(value) ? value : null;
}

/** The date for a day of the year as the farm's date (for a forced season: the middle of it). */
export function dateOfYearDay(dayOfYear, year = 1) {
  return farmDate({ start: dayOfYear, day: 1 + (year - 1) * YEAR_DAYS });
}

/**
 * The date for today: from the farm's seed and the day, or the middle of the forced season. `start` is the farm's first day of the year.
 */
export function dateToday({ farmSeed, day, forced = null, createRandom }) {
  const f = forcedSeason(forced);
  if (f) return dateOfYearDay(MIDDLE[f]);
  return farmDate({ start: startDayOfYear(farmSeed, createRandom), day });
}

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * How far the year has got towards midsummer, 0 (the shortest day, the 21st of December) to 1 (the longest, the 21st of June): the daylight and warmth follow this smoothly, so there is no jump at the change of season.
 */
export function summerness(dayOfYear) {
  const t = (dayOfYear - dayOfYearOf(11, 21)) / YEAR_DAYS;
  return 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
}

/** Per season: multipliers on the weather kinds' weights (missing is 1), on the temperature bands' odds, and the ground. */
export const SEASON_WEATHER = {
  spring: { kinds: { sunny: 0.8, fair: 1.8, drizzle: 2, rain: 1.5, snow: 0.1, storm: 0.7, fog: 1.2 }, bands: { frosty: 0.3, cold: 1, mild: 1.4, warm: 0.7, hot: 0 } },
  summer: { kinds: { sunny: 1.1, fair: 1, overcast: 0.8, drizzle: 0.5, rain: 0.8, snow: 0, storm: 2.5, fog: 0.4 }, bands: { frosty: 0, cold: 0.05, mild: 0.6, warm: 3, hot: 2 } },
  autumn: { kinds: { sunny: 0.55, fair: 1.2, overcast: 2.5, drizzle: 3, rain: 3, snow: 0.05, storm: 0.9, fog: 3 }, bands: { frosty: 0.4, cold: 1.5, mild: 1.3, warm: 0.2, hot: 0 } },
  winter: { kinds: { sunny: 0.35, fair: 0.8, overcast: 3, drizzle: 2, rain: 3, snow: 3, storm: 0.3, fog: 3 }, bands: { frosty: 3, cold: 2.5, mild: 0.5, warm: 0, hot: 0 } },
};

export const SEASON_GROUND = {
  // wet: how damp the ground is at the least (the weather's wet never dries below it); dust: how much the stubble lifts (1 as it was);
  // leaves: autumn colour in the trees; bare: how dull and thin the leaves look (winter).
  spring: { wet: 0.25, dust: 0.6, label: 'soft and green' },
  summer: { wet: 0, dust: 1.4, label: 'dry and dusty' },
  autumn: { wet: 0.2, dust: 0.5, label: 'damp, with the leaves coming down' },
  winter: { wet: 0.4, dust: 0.1, label: 'cold and muddy' },
};

/** The odds of each weather kind today, as multipliers on the kinds' own weights (weather.js's `pickWeatherKind`). */
export function weatherWeights(season) {
  return SEASON_WEATHER[season]?.kinds ?? {};
}

/** The multipliers on the temperature bands' odds today (weather.js's `pickTemperature`). */
export function temperatureBandWeights(season) {
  return SEASON_WEATHER[season]?.bands ?? {};
}

/**
 * Daylight for a date: { sunrise, sunset, sunHigh }. Hours as in daylight.js (sunrise 7.25 and sunset 17.25 was an October day, so
 * mid-autumn comes out about that).
 */
export function daylightFor(dayOfYear) {
  const s = summerness(dayOfYear);
  const half = lerp(3.9, 8.1, s); // half the daylight in hours: 7.8 hours at midwinter, 16.2 at midsummer, about 10 in mid-October, 12 at the equinox
  const noon = 12.25;
  return { sunrise: noon - half, sunset: noon + half, sunHigh: lerp(0.24, 1.0, s) };
}

/** Daylight params for the date, over the defaults `base` (a copy). The start window keeps clear of the dark. */
export function daylightParams(base, date) {
  const d = daylightFor(date.dayOfYear);
  return {
    ...base,
    sunrise: Math.round(d.sunrise * 4) / 4,
    sunset: Math.round(d.sunset * 4) / 4,
    sunHigh: d.sunHigh,
    startLatest: Math.min(base.startLatest, Math.round((d.sunset - 1.5) * 4) / 4),
  };
}

/** The ground's character today. */
export function groundFor(season) {
  return SEASON_GROUND[season] ?? SEASON_GROUND.autumn;
}

/** Is it autumn, with the leaves turned and the conkers down? */
export function isAutumn(season) {
  return season === 'autumn';
}

/** Is it winter, with the leaves dull and thin? */
export function isWinter(season) {
  return season === 'winter';
}

/** What the lines the girls say about the season are keyed on (companion lines for it live in npc/seasonLines.js). */
export function seasonLabel(season) {
  return groundFor(season).label;
}
