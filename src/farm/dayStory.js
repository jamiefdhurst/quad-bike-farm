// The day's story, written (#55): a few sentences on the recap card about what happened today, from a small log that features push
// into as things happen (who raced, who fell out, which quad broke). A narrator in the third person with the girls named, built from
// templates, so it needs no voice. Pure (the game passes in what it knows), tested.

const NAMES = { amy: 'Amy', jess: 'Jess' };
const name = (id) => NAMES[id] ?? 'Someone';

/** Today's events, in the order they happened. Not saved: the story is written when you call it a day, and the story is what is kept. */
export class DayEvents {
  constructor() {
    this.list = [];
  }

  /** `kind` is one of: race { winner, loser } (girl ids), youRaced { place }, fellOut { cause, fault }, madeUp {}, stranded { girl, how, quad },
   * seized { quad }, show { place } */
  add(kind, data = {}) {
    this.list.push({ kind, ...data });
  }
}

/** How much each kind is worth telling, most first. The story takes the top few and puts them back in the order they happened. */
const WEIGHT = { fellOut: 6, seized: 5, show: 5, stranded: 4, race: 3, youRaced: 3, madeUp: 2 };

/** Each kind of event as a choice of sentences (a function of the event, so the girls can be named). */
const TELL = {
  race: (e) => [
    `${name(e.winner)} beat ${name(e.loser)} in a race, and ${name(e.loser)} was sore about it.`,
    `${name(e.winner)} won a race against ${name(e.loser)} and did not let it drop.`,
    `${name(e.loser)} lost a race to ${name(e.winner)}.`,
  ],
  youRaced: (e) => [
    e.place === 1 ? 'You won a race.' : e.place === 2 ? 'You came second in a race.' : 'You raced and came in behind.',
    e.place === 1 ? 'You raced the girls and came out ahead.' : 'You had a race and did not win it.',
  ],
  fellOut: (e) => {
    const why = { race: 'over a race', borrow: 'over a borrowed quad', digs: 'over a run of digs' }[e.cause] ?? 'over nothing much';
    return e.fault
      ? [`${name(e.fault)} and ${name(e.fault === 'amy' ? 'jess' : 'amy')} fell out ${why}.`, `The girls fell out ${why}, and ${name(e.fault)} was the one in the wrong.`]
      : [`The girls fell out ${why}.`, `There was a row between Amy and Jess ${why}.`];
  },
  madeUp: () => ['By the end of it they had made up.', 'They made it up in the end.', 'Amy and Jess were friends again by teatime.'],
  stranded: (e) => {
    const what = e.how === 'tip' ? 'tipped' : 'got stuck';
    return [`${name(e.girl)} ${what} the ${e.quad} and had to be fetched.`, `The ${e.quad} ${e.how === 'tip' ? 'went over' : 'sank in'} with ${name(e.girl)} on it.`];
  },
  seized: (e) => [`The ${e.quad} seized up.`, `The ${e.quad} broke down and locked solid.`],
  show: (e) => [e.place === 1 ? 'You took first at the show.' : e.place ? `You came ${['', '', 'second', 'third'][e.place] ?? 'down the list'} at the show.` : 'You showed a quad and went home without a place.'],
};

/** Sentences from the day's totals: they only add up to something worth saying when there is a lot, or they fill a quiet day. */
function totals({ metres = 0, bogs = 0, jobs = 0, jobsCleared = false }) {
  const out = [];
  if (jobsCleared) out.push('The chalkboard was cleared.');
  else if (jobs > 0) out.push(jobs === 1 ? 'One job came off the chalkboard.' : `${jobs} jobs came off the chalkboard.`);
  if (bogs >= 2) out.push(`You got stuck ${bogs} times.`);
  else if (bogs === 1) out.push('You got stuck once.');
  if (metres >= 1000) out.push(`You rode ${(metres / 1000).toFixed(1)} km.`);
  return out;
}

const QUIET = ['A quiet one. Mostly tea.', 'Nothing much happened. Nobody minded.', 'A slow day, and a pleasant one.'];

/**
 * The day's story: up to `p.storySentences` sentences. `events` is DayEvents.list, `totals` the day's counts, `random` picks between
 * the wordings. Events are picked by weight (the earliest wins a tie) and told in the order they happened, then the totals fill any room.
 */
export function writeStory(events, tot, p, random = Math.random) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  const ranked = events
    .map((e, i) => ({ e, i, w: WEIGHT[e.kind] ?? 0 }))
    .filter((x) => x.w > 0 && TELL[x.e.kind])
    .sort((a, b) => b.w - a.w || a.i - b.i)
    .slice(0, p.storySentences)
    .sort((a, b) => a.i - b.i);
  const out = ranked.map(({ e }) => pick(TELL[e.kind](e)));
  for (const t of totals(tot)) if (out.length < p.storySentences) out.push(t);
  return out.length ? out : [pick(QUIET)];
}

/** The stories to keep: newest last, only the last `p.storiesKept`. A day told twice (a reload after calling it a day) replaces its own. */
export function keepStory(stories, day, sentences, p) {
  const kept = (stories ?? []).filter((s) => s.day !== day);
  kept.push({ day, text: sentences.join(' ') });
  return kept.slice(-p.storiesKept);
}

/** The saved stories, whatever shape an old or damaged save left them in. */
export function validStories(stories) {
  return Array.isArray(stories) ? stories.filter((s) => s && Number.isInteger(s.day) && typeof s.text === 'string') : [];
}
