// The show: on the last Sunday of a month the day ends at a local show instead of the plain recap. The quad you last rode is judged on
// clean, tidy and running sweet, against a few other entries, and the girls ride the slow race between themselves. Pure (the game says
// what the quad is like), tested in tests/showDay.test.js. DECISIONS.md, "A show day (#34, was TODO 139)".

import { createRandom } from '../core/random.js';
import { MONTH_DAYS } from '../world/seasons.js';

export const DEFAULT_SHOW_PARAMS = {
  cleanMudAt: 0.5, // mud coat (0..1) at which the clean mark is nothing
  bodyWearCost: 6, // marks off tidy for a fully worn body
  damageCost: 2, // marks off tidy for each bent rod, bent rim or puncture
  engineWearCost: 5, // marks off running sweet for a fully worn engine
  foulingCost: 2, // and for a fully fouled plug
  faultCost: 2, // and for each fault started
  flatBatteryBelow: 0.25, // a battery under this costs a mark off running sweet
  rivalMin: 14, // the other entries' totals (of 30) are dealt between these
  rivalMax: 27,
  rivals: 4, // other entries in the class
  amyPatience: 0.6, // chance Amy wins the slow race (she is the patient one; Jess hates going slowly)
  favourEntered: 0.3, // favour each girl gives you for entering
  favourWon: 0.4, // and a little more each for a first or second
  showEveAfter: 25, // seconds into the day before a girl says the show is tomorrow
  keptResults: 12, // rosettes the farm remembers
  rosettesShown: 8, // and the shelf in the barn shows the latest of
};

export const SHOW_PARAM_RANGES = {
  cleanMudAt: [0.1, 1, 0.05],
  bodyWearCost: [0, 10, 0.5],
  damageCost: [0, 5, 0.5],
  engineWearCost: [0, 10, 0.5],
  foulingCost: [0, 5, 0.5],
  faultCost: [0, 5, 0.5],
  flatBatteryBelow: [0, 0.6, 0.05],
  rivalMin: [5, 25, 1],
  rivalMax: [15, 30, 1],
  rivals: [1, 8, 1],
  amyPatience: [0, 1, 0.05],
  favourEntered: [0, 1, 0.05],
  favourWon: [0, 1, 0.05],
  showEveAfter: [0, 300, 5],
  keptResults: [1, 40, 1],
  rosettesShown: [1, 12, 1],
};

export const PLACES = [
  { place: 1, label: 'First', rosette: 0xc0281c },
  { place: 2, label: 'Second', rosette: 0x2d5ba8 },
  { place: 3, label: 'Third', rosette: 0xe8c840 },
  { place: 4, label: 'Fourth', rosette: 0x2e8a4a },
];
const COMMENDED = { label: 'Highly commended', rosette: 0xe8e0d0 };

const RIVAL_NAMES = ['Mr Pryce', 'the Mortons', 'Mrs Atherton', 'Young Tom', 'Dai from the top farm', 'Mrs Hollis', 'the vicar', 'Old Mr Banks'];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mark = (v) => Math.round(clamp(v, 0, 10) * 10) / 10;

/** The last Sunday of its month? `date` is a farm date (seasons.js `farmDate`: weekday 0 is Monday, so Sunday is 6). */
export function isShowDay(date) {
  return date.weekday === 6 && date.dom + 7 > MONTH_DAYS[date.month];
}

/** The Saturday before one. */
export function isShowEve(date) {
  return date.weekday === 5 && date.dom < MONTH_DAYS[date.month] && date.dom + 8 > MONTH_DAYS[date.month]; // the Sunday is in the same month
}

/**
 * Marks out of ten for the quad. `q` is { mud (0..1, the worse of body and wheels), bodyWear, damage (bent rods, rims, punctures),
 * engineWear, fouling, faults (started), battery (0..1) }. Missing values count as none.
 */
export function judgeQuad(q, p = DEFAULT_SHOW_PARAMS) {
  const clean = mark(10 * (1 - (q.mud ?? 0) / p.cleanMudAt));
  const tidy = mark(10 - (q.bodyWear ?? 0) * p.bodyWearCost - (q.damage ?? 0) * p.damageCost);
  const flat = (q.battery ?? 1) < p.flatBatteryBelow ? 1 : 0;
  const running = mark(10 - (q.engineWear ?? 0) * p.engineWearCost - (q.fouling ?? 0) * p.foulingCost - (q.faults ?? 0) * p.faultCost - flat);
  return { clean, tidy, running, total: Math.round((clean + tidy + running) * 10) / 10 };
}

/** The other entries, dealt the same way every time for a given farm and month: [{ name, total }], best first. */
export function rivalEntries(farmSeed, date, p = DEFAULT_SHOW_PARAMS) {
  const rnd = createRandom(((farmSeed ?? 0) ^ 0x5a0d) + date.year * 31 + date.month * 7);
  const names = [...RIVAL_NAMES];
  const out = [];
  for (let i = 0; i < Math.min(p.rivals, names.length); i++) {
    const name = names.splice(Math.floor(rnd() * names.length), 1)[0];
    out.push({ name, total: Math.round((p.rivalMin + rnd() * Math.max(0, p.rivalMax - p.rivalMin)) * 10) / 10 });
  }
  return out.sort((a, b) => b.total - a.total);
}

/** Where you come, 1 up. A tie goes to you: the judge knows who made the tea. */
export function placeOf(total, rivals) {
  return 1 + rivals.filter((r) => r.total > total).length;
}

/** The rosette for a place: { place, label, rosette (colour) }. */
export function rosetteFor(place) {
  return PLACES.find((x) => x.place === place) ?? { place, ...COMMENDED };
}

/** The slow race, ridden between the girls off the page: who won (last across the line without stopping) and who lost. `rnd` is 0..1. */
export function slowRace(rnd, p = DEFAULT_SHOW_PARAMS) {
  const amy = rnd < p.amyPatience;
  return { winner: amy ? 'amy' : 'jess', loser: amy ? 'jess' : 'amy' };
}

/** The whole show: what you got and the girls' race. `quad` is the judged quad's { label, ...condition } or null if you never rode one. */
export function runShow({ quad, farmSeed, date, rnd, p = DEFAULT_SHOW_PARAMS }) {
  const rivals = rivalEntries(farmSeed, date, p);
  const marks = quad ? judgeQuad(quad, p) : null;
  const place = marks ? placeOf(marks.total, rivals) : null;
  return { marks, rivals, place, entries: rivals.length + (marks ? 1 : 0), rosette: place ? rosetteFor(place) : null, race: slowRace(rnd, p), quad: quad?.label ?? null };
}

/** What the farm keeps of the shows: a rosette per entry, latest last. */
export class ShowKeeper {
  constructor(p = DEFAULT_SHOW_PARAMS) {
    this.p = p;
    this.results = [];
  }

  /** Records a result for farm day `day` (judged once a day: a second go replaces the first). */
  add(day, date, show) {
    if (!show.place) return;
    this.results = this.results.filter((r) => r.day !== day);
    this.results.push({ day, month: date.monthName, year: date.year, place: show.place, total: show.marks.total, entries: show.entries, quad: show.quad, race: show.race.winner });
    this.results = this.results.slice(-this.p.keptResults);
  }

  judgedOn(day) {
    return this.results.some((r) => r.day === day);
  }

  /** The rosettes on the shelf, latest last: [{ place, rosette (colour), month, year }]. */
  shelf() {
    return this.results.slice(-this.p.rosettesShown).map((r) => ({ ...r, rosette: rosetteFor(r.place).rosette }));
  }

  wins() {
    return this.results.filter((r) => r.place === 1).length;
  }

  toJSON() {
    return this.results.map((r) => ({ ...r }));
  }

  restore(saved) {
    if (!Array.isArray(saved)) return;
    this.results = saved.filter((r) => r && Number.isFinite(r.day) && Number.isFinite(r.place) && Number.isFinite(r.total)).map((r) => ({ ...r })).slice(-this.p.keptResults);
  }
}

/** The card for the show (shown in place of the plain recap's header): lines of text and the headline. */
export function showCard(show, girls = { amy: 'Amy', jess: 'Jess' }) {
  const race = `${girls[show.race.winner]} won the slow race. ${girls[show.race.loser]} put a foot down.`;
  if (!show.marks) return { title: 'The show', headline: 'You did not enter anything', lines: [], race };
  const m = show.marks;
  return {
    title: 'The show',
    headline: `${show.rosette.label}${show.place <= 4 ? ` of ${show.entries}` : ''}: ${show.quad}`,
    lines: [`Clean ${m.clean}`, `Tidy ${m.tidy}`, `Running sweet ${m.running}`, `${m.total} out of 30`],
    race,
  };
}

/** The calendar's words for a show day or the day before. */
export function showPrompt(date) {
  if (isShowDay(date)) return 'The show is today: press E to go to it';
  return null;
}
