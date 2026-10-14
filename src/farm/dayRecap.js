// The recap card shown when you call it a day (endOfDay.js): Amy's logbook for the day, the bucket list ticked off today and how far you
// rode, over the dark, before the screen fades and the next day loads. Pure (the game passes in what it knows), tested.

/**
 * What the card says. `entries` are the logbook's lines for today, `ticked` the names of the bucket list items done today, `score` the
 * list's { count, totalCount }, `metres` how far you rode, `bogs` how many times a quad stuck.
 */
export function dayRecap({ day, entries = [], ticked = [], score = { count: 0, totalCount: 0 }, metres = 0, bogs = 0 }, p) {
  const log = entries.slice(-p.recapLogLines);
  const facts = [];
  if (metres >= 50) facts.push(metres >= 1000 ? `${(metres / 1000).toFixed(1)} km ridden` : `${Math.round(metres / 10) * 10} m ridden`);
  if (bogs > 0) facts.push(bogs === 1 ? 'stuck once' : `stuck ${bogs} times`);
  return {
    title: `Day ${day}`,
    log,
    logMore: Math.max(0, entries.length - log.length),
    ticked: ticked.slice(0, p.recapTickLines),
    tickedMore: Math.max(0, ticked.length - p.recapTickLines),
    total: score.totalCount ? `${score.count} of ${score.totalCount} on the bucket list` : '',
    facts,
  };
}

/** Today's logbook entries (not the ones carried over from earlier days), as lines. */
export function todaysLog(entries, formatEntry, day) {
  return entries.filter((e) => !e.old && (e.day ?? day) === day && !e.ranking).map((e) => formatEntry(e, day));
}

/** The card: open, locked against a stray press for `recapLock` seconds, then ready to be dismissed with E, Enter or a click. */
export class DayRecap {
  constructor() {
    this.t = null;
    this.gone = false; // dismissed: the fade can start
  }

  get active() {
    return this.t !== null && !this.gone;
  }

  open() {
    this.t = 0;
    this.gone = false;
  }

  update(dt) {
    if (this.t !== null) this.t += dt;
  }

  /** Whether a press would be taken yet. */
  ready(p) {
    return this.active && this.t >= p.recapLock;
  }

  /** A press: returns true if it dismissed the card (too early or already gone does nothing). */
  dismiss(p) {
    if (!this.ready(p)) return false;
    this.gone = true;
    return true;
  }
}
