// What is on air: the one station every radio on the farm picks up. A programme of a fixed length goes round and round on the game's clock,
// so two radios tuned in at once play the same thing. More talk than music: a presenter whose words are never quite words (syllables
// with a voice's pitch and vowels), now and then a song (a simple tune over a bass and a beat), and a jingle between the two. Pure and
// deterministic: `programmeEvents(from, to)` is the same list every time, which is what the tests look at and radioAudio.js plays.

import { createRandom } from '../core/random.js';

export const PROGRAMME_SECONDS = 600;
const STATION_SEED = 0x6a42;

// Vowel formants (F1, F2 in Hz) a voice moves between while it "talks".
const VOWELS = [
  [730, 1090], // ah
  [530, 1840], // eh
  [270, 2290], // ee
  [570, 840], // aw
  [300, 870], // oo
  [660, 1720], // a
];

// A major pentatonic from the key's root, in semitones, for the tunes.
const PENTATONIC = [0, 2, 4, 7, 9];
const KEY_ROOTS = [196, 220, 247, 261.6]; // G, A, B, C below the middle octave's top: a few keys to go round

/** Frequency of `semis` above `root`. */
const hz = (root, semis) => root * Math.pow(2, semis / 12);

/** The cycle: a list of { start, end, kind, seed } that adds up to PROGRAMME_SECONDS. More talk than music. */
export function buildCycle(seed = STATION_SEED, length = PROGRAMME_SECONDS) {
  const r = createRandom(seed);
  const out = [];
  let t = 0;
  const push = (kind, dur) => {
    const d = Math.min(dur, length - t);
    if (d <= 0.5) return;
    out.push({ start: t, end: t + d, kind, seed: Math.floor(r() * 1e9) });
    t += d;
  };
  while (t < length - 0.5) {
    push('jingle', 4 + r() * 2);
    push('talk', 28 + r() * 24);
    if (r() < 0.55) push('music', 32 + r() * 22);
    push('talk', 20 + r() * 22);
    if (r() < 0.3) push('music', 28 + r() * 18);
  }
  out[out.length - 1].end = length; // the last runs to the end of the cycle
  return out;
}

const CYCLE = buildCycle();

/** What is on at `t` seconds: { start, end, kind, seed } of its segment. */
export function segmentAt(t, cycle = CYCLE, length = PROGRAMME_SECONDS) {
  const x = ((t % length) + length) % length;
  return cycle.find((s) => x >= s.start && x < s.end) ?? cycle[cycle.length - 1];
}

/** The share of the cycle that is talk, music and jingles (for the tests: more talk than music). */
export function shares(cycle = CYCLE) {
  const total = cycle.reduce((s, c) => s + (c.end - c.start), 0);
  const out = { talk: 0, music: 0, jingle: 0 };
  for (const c of cycle) out[c.kind] += (c.end - c.start) / total;
  return out;
}

/** A presenter's talk: phrases of syllables, each with a pitch contour. Times are seconds from the segment's start. */
function talkEvents(seg) {
  const r = createRandom(seg.seed);
  const out = [];
  const female = r() < 0.4;
  const base = female ? 175 + r() * 35 : 100 + r() * 25;
  let t = 0.3;
  const length = seg.end - seg.start;
  while (t < length - 0.4) {
    const syllables = 4 + Math.floor(r() * 9);
    const question = r() < 0.12;
    let vowel = Math.floor(r() * VOWELS.length);
    for (let i = 0; i < syllables && t < length - 0.2; i++) {
      const k = i / syllables;
      const dur = 0.11 + r() * 0.12;
      if (r() < 0.45) vowel = Math.floor(r() * VOWELS.length);
      const stress = r() < 0.25 ? 1.12 : 1;
      const contour = 1.06 - k * 0.14 + (question && k > 0.7 ? (k - 0.7) * 0.9 : 0); // falls through the phrase; a question lifts at the end
      out.push({
        kind: 'syllable',
        t: seg.start + t,
        dur,
        f0: base * contour * stress,
        f1: VOWELS[vowel][0],
        f2: VOWELS[vowel][1],
        hiss: r() < 0.22, // an s or sh at the front of it
        gain: 0.7 + r() * 0.3,
      });
      t += dur + 0.015 + (r() < 0.2 ? 0.06 : 0); // a word break now and then
    }
    t += 0.25 + r() * 0.7; // a breath between phrases
  }
  return out;
}

/** A tune: a lead over a bass and a beat. */
function musicEvents(seg) {
  const r = createRandom(seg.seed);
  const out = [];
  const root = KEY_ROOTS[Math.floor(r() * KEY_ROOTS.length)];
  const bpm = 88 + Math.floor(r() * 40);
  const beat = 60 / bpm;
  const length = seg.end - seg.start;
  const bars = Math.floor(length / (beat * 4));
  let step = 2; // where the melody is on the pentatonic, wandering
  const bassNotes = [0, 0, 7 - 12, 5 - 12]; // root, root, fifth, fourth: the same four-bar turn
  for (let bar = 0; bar < bars; bar++) {
    const barStart = seg.start + bar * beat * 4;
    const bass = bassNotes[bar % 4] - 12;
    for (let b = 0; b < 4; b++) {
      const bt = barStart + b * beat;
      out.push({ kind: 'bass', t: bt, dur: beat * 0.85, freq: hz(root, bass), gain: 0.9 });
      if (b % 2 === 0) out.push({ kind: 'kick', t: bt, dur: 0.12, freq: 70, gain: 1 });
      else out.push({ kind: 'snare', t: bt, dur: 0.1, freq: 0, gain: 0.5 });
      for (let h = 0; h < 2; h++) out.push({ kind: 'hat', t: bt + h * beat * 0.5, dur: 0.03, freq: 0, gain: 0.25 });
      // the melody in eighth notes, with rests, taking a step either way along the scale
      for (let h = 0; h < 2; h++) {
        if (r() < 0.3) continue;
        step = Math.max(0, Math.min(PENTATONIC.length * 2 - 1, step + Math.floor(r() * 3) - 1));
        const semis = PENTATONIC[step % PENTATONIC.length] + 12 * Math.floor(step / PENTATONIC.length);
        out.push({ kind: 'lead', t: bt + h * beat * 0.5, dur: beat * (0.4 + r() * 0.3), freq: hz(root, semis + 12), gain: 0.6 });
      }
    }
  }
  return out;
}

/** A jingle: four notes climbing and a last one held. */
function jingleEvents(seg) {
  const r = createRandom(seg.seed);
  const root = KEY_ROOTS[Math.floor(r() * KEY_ROOTS.length)];
  const notes = [0, 4, 7, 12, 16];
  return notes.map((n, i) => ({ kind: 'lead', t: seg.start + 0.15 + i * 0.22, dur: i === notes.length - 1 ? 1.4 : 0.2, freq: hz(root * 2, n), gain: 0.8 }));
}

const BUILDERS = { talk: talkEvents, music: musicEvents, jingle: jingleEvents };

const built = new WeakMap();

/** Every event of one segment (times in cycle seconds), made once. */
export function segmentEvents(seg) {
  let list = built.get(seg);
  if (!list) built.set(seg, (list = BUILDERS[seg.kind](seg)));
  return list;
}

/**
 * The events that start in [from, to) on the game's clock, in order. A program longer than the window is looped, so the cycle repeats
 * every PROGRAMME_SECONDS. Each event's `t` is on the game's clock.
 */
export function programmeEvents(from, to, cycle = CYCLE, length = PROGRAMME_SECONDS) {
  const out = [];
  if (to <= from) return out;
  const first = Math.floor(from / length);
  const last = Math.floor(to / length);
  for (let lap = first; lap <= last; lap++) {
    const offset = lap * length;
    for (const seg of cycle) {
      if (seg.end + offset < from || seg.start + offset >= to) continue;
      for (const e of segmentEvents(seg)) {
        const t = e.t + offset;
        if (t >= from && t < to) out.push({ ...e, t });
      }
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
