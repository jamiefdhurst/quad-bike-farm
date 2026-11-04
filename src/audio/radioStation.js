// What is on air: the radio's stations and the order they play things in. A station is a library of songs and short talk items (a
// sting, the weather, the farming report, the news, a phone-in: recorded by tools/generate_radio_talk.py) shuffled into a programme that
// goes on for ever. Each station has one programme on the game's audio clock, so two radios tuned to it at once play the same thing.
// Nothing here plays a sound: radioAudio.js asks `between(from, to)` what should be on, and radioLibrary.js loads the files. Pure, so
// it is tested without Web Audio.

import { createRandom } from '../core/random.js';

/**
 * The stations, in the order a press of the radio key steps through them. `talkOrder` is the kinds of talk item that come round, with a
 * kind repeated where it should be heard more often.
 */
export const STATIONS = [
  {
    id: 'dale',
    name: 'Dale FM',
    style: 'easy listening and pop',
    seed: 0x6a42,
    talkOrder: ['farming', 'news', 'weather', 'phonein', 'farming', 'traffic', 'news', 'phonein'],
  },
  {
    id: 'quarry',
    name: 'Quarry Rock',
    style: 'rock',
    seed: 0x51a3,
    talkOrder: ['news', 'gig', 'weather', 'competition', 'traffic', 'news', 'phonein', 'gig'],
  },
];

export const DEFAULT_STATION = 'dale';

export function stationById(id) {
  return STATIONS.find((s) => s.id === id) ?? STATIONS[0];
}

/** The station after this one, going round. */
export function nextStationId(id) {
  const i = STATIONS.findIndex((s) => s.id === id);
  return STATIONS[(i + 1) % STATIONS.length].id;
}

export const DEFAULT_STATION_PARAMS = {
  gap: 0.3, // seconds of quiet between one item and the next
  talkRunMin: 2, // the fewest talk items between two songs
  talkRunMax: 3, // and the most
  repeatGap: 3, // items of the same kind that must come round before one is heard again (less in a small library)
  silence: 8, // seconds of nothing to wait when a station has nothing to play yet
};

export const STATION_PARAM_RANGES = {
  gap: [0, 3, 0.05],
  talkRunMin: [0, 6, 1],
  talkRunMax: [1, 8, 1],
  repeatGap: [0, 10, 1],
  silence: [1, 60, 1],
};

export const STATION_PARAMS = { ...DEFAULT_STATION_PARAMS };

/** A shuffled bag: every item once a lap, in a new order each lap, and none of the last few of one lap first in the next. */
export class Bag {
  constructor(items, random, repeatGap = STATION_PARAMS.repeatGap) {
    this.items = items;
    this.random = random;
    this.repeatGap = repeatGap;
    this.queue = [];
    this.recent = [];
  }

  lap() {
    const q = [...this.items];
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    // none of the ones just heard at the front: swap them further back
    const keep = Math.min(this.repeatGap, q.length - 1);
    for (let k = 0; k < keep; k++) {
      if (!this.recent.includes(q[k])) continue;
      const swap = q.findIndex((x, i) => i >= keep && !this.recent.includes(x));
      if (swap > 0) [q[k], q[swap]] = [q[swap], q[k]];
    }
    return q;
  }

  next() {
    if (!this.items.length) return null;
    if (!this.queue.length) this.queue = this.lap();
    const item = this.queue.shift();
    this.recent.push(item);
    if (this.recent.length > this.repeatGap) this.recent.shift();
    return item;
  }
}

export class Programme {
  /** `library` is { music: [{ id, seconds }], talk: [{ id, kind, seconds }] } for this station. */
  constructor(station, library, P = STATION_PARAMS) {
    this.station = station;
    this.P = P;
    this.random = createRandom(station.seed);
    this.slots = []; // { item, kind, start, end }, in order
    this.queue = []; // what is wanted next: 'music' or a talk kind
    this.talkIndex = 0;
    this.origin = 0; // when the first thing starts: the moment the station first has something to play
    this.setLibrary(library, -Infinity);
  }

  /** A new library (a song added, or the files loaded): from `now` on it is drawn from; what is already on air carries on. */
  setLibrary(library, now = 0) {
    this.library = library;
    const keepRecent = this.music?.recent ?? [];
    this.music = new Bag(library.music, this.random, this.P.repeatGap);
    this.music.recent = keepRecent.filter((x) => library.music.some((m) => m.id === x.id));
    this.talk = {};
    for (const kind of new Set(library.talk.map((t) => t.kind))) {
      this.talk[kind] = new Bag(library.talk.filter((t) => t.kind === kind), this.random, this.P.repeatGap);
    }
    // what is on air carries on, but a wait for nothing is over now there is something to play
    while (this.slots.length) {
      const last = this.slots[this.slots.length - 1];
      if (last.start > now || last.kind === 'silence') this.slots.pop();
      else break;
    }
    if (!this.slots.length) this.origin = Math.max(0, now);
    this.queue = [];
  }

  get end() {
    return this.slots.length ? this.slots[this.slots.length - 1].end : 0;
  }

  /** The next thing wanted: a song, then a run of talk. */
  want() {
    if (!this.queue.length) {
      const { talkRunMin: lo, talkRunMax: hi } = this.P;
      const run = lo + Math.floor(this.random() * (Math.max(lo, hi) - lo + 1));
      this.queue.push('music');
      for (let i = 0; i < run; i++) this.queue.push(this.nextTalkKind(i === 0));
    }
    return this.queue.shift();
  }

  /** The kind of the next talk item: a sting or a link first in a run when the station has them, then round the order. */
  nextTalkKind(first) {
    const kinds = this.station.talkOrder.filter((k) => this.talk[k]);
    if (first && this.talk.ident && this.random() < 0.5) return 'ident';
    if (first && this.talk.link && this.random() < 0.4) return 'link';
    if (!kinds.length) return this.talk.ident ? 'ident' : this.talk.link ? 'link' : null;
    return kinds[this.talkIndex++ % kinds.length];
  }

  append() {
    const want = this.want();
    let item = null;
    if (want === 'music') item = this.music.next();
    else if (want && this.talk[want]) item = this.talk[want].next();
    const start = this.slots.length ? this.end + this.P.gap : this.origin;
    const seconds = item ? item.seconds : this.P.silence;
    this.slots.push({ item, kind: item ? (want === 'music' ? 'music' : want) : 'silence', start, end: start + seconds });
  }

  /** Makes sure the programme is planned as far as `t`. */
  extend(t) {
    let guard = 0;
    while (this.end < t && guard++ < 5000) this.append();
  }

  /** The slot on air at `t` seconds: { item, kind, start, end } (item is null while the station has nothing to play). */
  at(t) {
    this.extend(t + 1);
    return this.slots.find((s) => t >= s.start && t < s.end) ?? this.slots[this.slots.length - 1];
  }

  /** Every slot that overlaps [from, to). */
  between(from, to) {
    this.extend(to + 1);
    return this.slots.filter((s) => s.end > from && s.start < to);
  }
}

/** How many seconds of a stretch of programme are music, talk and silence (for the tests and the debug panel). */
export function shares(slots) {
  const out = { music: 0, talk: 0, silence: 0 };
  for (const s of slots) out[s.kind === 'music' || s.kind === 'silence' ? s.kind : 'talk'] += s.end - s.start;
  return out;
}
