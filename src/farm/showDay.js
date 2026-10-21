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
  rivalYearly: 0.8, // marks every rival gains for each farm year after the first (they get better kept; capped at 29)
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
  rivalYearly: [0, 3, 0.1],
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
 * Marks out of ten for the quad. `q` is { mud (0..1, the worse of body and wheels; mudBody and mudWheels if known), bodyWear, damage (bent
 * rods, rims, punctures), engineWear, fouling, faults (started), battery (0..1) }. Missing values count as none. `notes` says what cost
 * each mark its points, for the judge to read out.
 */
export function judgeQuad(q, p = DEFAULT_SHOW_PARAMS) {
  const clean = mark(10 * (1 - (q.mud ?? 0) / p.cleanMudAt));
  const tidy = mark(10 - (q.bodyWear ?? 0) * p.bodyWearCost - (q.damage ?? 0) * p.damageCost);
  const flat = (q.battery ?? 1) < p.flatBatteryBelow ? 1 : 0;
  const running = mark(10 - (q.engineWear ?? 0) * p.engineWearCost - (q.fouling ?? 0) * p.foulingCost - (q.faults ?? 0) * p.faultCost - flat);
  const body = q.mudBody ?? q.mud ?? 0;
  const wheels = q.mudWheels ?? q.mud ?? 0;
  const notes = {
    clean: [body >= 0.1 && 'mud on the body', wheels >= 0.1 && 'mud on the wheels'].filter(Boolean),
    tidy: [(q.bodyWear ?? 0) >= 0.2 && 'a worn body', (q.damage ?? 0) > 0 && (q.damage === 1 ? 'a puncture or a bent part' : `${q.damage} punctures or bent parts`)].filter(Boolean),
    running: [
      (q.engineWear ?? 0) >= 0.2 && 'a worn engine',
      (q.fouling ?? 0) >= 0.2 && 'a fouled plug',
      (q.faults ?? 0) > 0 && (q.faults === 1 ? 'a fault' : `${q.faults} faults`),
      flat && 'a flat battery',
    ].filter(Boolean),
  };
  return { clean, tidy, running, total: Math.round((clean + tidy + running) * 10) / 10, notes };
}

/** The reasons for one mark as a phrase: "mud on the body and mud on the wheels", or "spotless" if nothing cost it a point. */
export function noteText(list) {
  return list.length ? list.join(' and ') : 'spotless';
}

/** What the entry would score now, in a line for the calendar. */
export function previewText(label, marks) {
  const worst = [['clean', marks.clean], ['tidy', marks.tidy], ['running sweet', marks.running]].sort((a, b) => a[1] - b[1])[0];
  const why = marks.notes[worst[0] === 'running sweet' ? 'running' : worst[0]];
  return `${label} would get ${marks.total} of 30 now${worst[1] < 10 ? `; ${worst[0]} loses most (${noteText(why)})` : ''}`;
}

/** The other entries, dealt the same way every time for a given farm and month: [{ name, total }], best first. */
export function rivalEntries(farmSeed, date, p = DEFAULT_SHOW_PARAMS) {
  const rnd = createRandom(((farmSeed ?? 0) ^ 0x5a0d) + date.year * 31 + date.month * 7);
  const names = [...RIVAL_NAMES];
  const out = [];
  const better = Math.max(0, date.year - 1) * p.rivalYearly;
  for (let i = 0; i < Math.min(p.rivals, names.length); i++) {
    const name = names.splice(Math.floor(rnd() * names.length), 1)[0];
    out.push({ name, total: Math.min(29, Math.round((p.rivalMin + rnd() * Math.max(0, p.rivalMax - p.rivalMin) + better) * 10) / 10) });
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

/**
 * The whole show. `entries` are the farm's own: [{ id ('you', 'amy' or 'jess'), name, label, quad (the condition judgeQuad reads) }], with
 * yours first. The ranking puts every entry and the rivals in order of marks; a tie goes to you, then the girls, then the rivals.
 */
export function runShow({ entries = [], farmSeed, date, rnd, p = DEFAULT_SHOW_PARAMS }) {
  const rivals = rivalEntries(farmSeed, date, p);
  const judged = entries.map((e, i) => ({ id: e.id, name: e.name, label: e.label, marks: judgeQuad(e.quad, p), you: e.id === 'you', order: i }));
  const ranking = [...judged.map((j) => ({ ...j, total: j.marks.total })), ...rivals.map((r, i) => ({ id: null, name: r.name, total: r.total, order: 100 + i }))]
    .sort((a, b) => b.total - a.total || a.order - b.order)
    .map((r, i) => ({ ...r, place: i + 1 }));
  const mine = ranking.find((r) => r.you);
  return {
    marks: mine?.marks ?? null,
    rivals,
    ranking,
    girls: Object.fromEntries(ranking.filter((r) => r.id === 'amy' || r.id === 'jess').map((r) => [r.id, { place: r.place, total: r.total, label: r.label }])),
    place: mine?.place ?? null,
    entries: ranking.length,
    rosette: mine ? rosetteFor(mine.place) : null,
    race: slowRace(rnd, p),
    quad: mine?.label ?? null,
  };
}

/** The rosette as a little drawing for the card: a ring of gathered ribbon, a pale middle and two tails, in the place's colour. */
export function rosetteSvg(colour) {
  const c = `#${colour.toString(16).padStart(6, '0')}`;
  return `<svg class="rosette" viewBox="0 0 80 100" width="64" height="80" aria-hidden="true"><path d="M26 56 L18 98 L32 88 L38 98 L42 58Z" fill="${c}"/><path d="M54 56 L62 98 L48 88 L42 98 L38 58Z" fill="${c}"/><circle cx="40" cy="38" r="30" fill="${c}"/><circle cx="40" cy="38" r="21" fill="#f2ead6"/><circle cx="40" cy="38" r="30" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="2" stroke-dasharray="3 4"/></svg>`;
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

  /** The line for the records board: how many first places and rosettes the farm has. */
  recordLine() {
    const n = this.results.length;
    const w = this.wins();
    return { kind: 'show', label: 'Show rosettes', set: n > 0, today: false, text: n ? `${w} first${w === 1 ? '' : 's'}, ${n} placed` : 'not yet' };
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

/** The card for the show: the headline, the judge's reasons, the full ranking and the slow race. */
export function showCard(show, names = { amy: 'Amy', jess: 'Jess' }) {
  const race = `${names[show.race.winner]} won the slow race. ${names[show.race.loser]} put a foot down.`;
  if (!show.marks) return { title: 'The show', headline: 'You did not enter anything', lines: [], ranking: [], race, rosette: null };
  const m = show.marks;
  const rank = show.ranking.map((r) => ({ text: `${r.place}. ${r.name}${r.label ? ` (${r.label})` : ''}  ${r.total}`, you: !!r.you }));
  return {
    title: 'The show',
    headline: `${show.rosette.label}${show.place <= 4 ? ` of ${show.entries}` : ''}: ${show.quad}`,
    lines: [`Clean ${m.clean}: ${noteText(m.notes.clean)}`, `Tidy ${m.tidy}: ${noteText(m.notes.tidy)}`, `Running sweet ${m.running}: ${noteText(m.notes.running)}`, `${m.total} out of 30`],
    ranking: rank,
    race,
    rosette: show.rosette.rosette,
  };
}

/** Who says what over the card, and when (seconds after it opens): the slow race, then the best girl ahead of you or the worst behind. */
export function showSpeech(show, gap = 3) {
  const out = [];
  const say = (girl, situation, at) => out.push({ girl, situation, at });
  const { winner } = show.race;
  say('amy', winner === 'amy' ? 'showSlowWon' : 'showSlowLost', 0);
  say('jess', winner === 'jess' ? 'showSlowWon' : 'showSlowLost', gap);
  const girls = Object.entries(show.girls).sort((a, b) => a[1].place - b[1].place);
  if (show.place && girls.length) {
    const [best, bestInfo] = girls[0];
    const [worst, worstInfo] = girls[girls.length - 1];
    if (bestInfo.place < show.place) say(best, 'showAheadOfYou', gap * 2);
    else if (worstInfo.place > show.place) say(worst, 'showBehindYou', gap * 2);
  }
  return out;
}
