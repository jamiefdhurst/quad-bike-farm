// Recordings to choose from for a vehicle's engine, each heard through the game's own engine model and worklet (#857).
//
//   node tools/engine-review/candidates.mjs [vehicle ...]            then node tools/engine-review/build.mjs
//
// Reads the list in .scratch/shop/cars/candidates.json, { "<vehicle id>": [{ "id": <Freesound id>, "note": "...", optional
// "idle": [from, to], "starter": [from, caught, crankRpm], "shutdown": [from, to] }] }, each preview saved by tools/freesound.mjs
// (.scratch/shop/fs/<id>.mp3, or an older download in .scratch/shop/raw2/). For each one:
//
// - finds its steadiest idle (tools/engine-review/idlescan.py) in the vehicle's idle range, or takes the one given;
// - slices a trial bank from it into .scratch/shop/cars/banks/ (tools/slice_engine_audio.py --trial): up to 30 s of idle cut into
//   whole cycles, its own starter and shutdown where the list gives their times, and the vehicle's present ones where it doesn't;
// - writes the pulse model into it (tools/engine-bank-model.mjs's `measure`) and scans its idle for whine (srcscan.mjs);
// - renders it as the vehicle (idle, a ladder up the revs, revving stood still, driving and starting) with only the bank changed,
//   and the vehicle as it is now beside them, into a section of compare.json for the review page;
// - ranks them by the idle's length, how steady its firing rate is, how cleanly it repeats (other noise) and whine, keeps the top
//   five a vehicle on the page and writes the table to .scratch/shop/cars/ranking.md.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { SPECS, renderClip, bankFor, banks, startScript, idleScript, revScript, REV_SECONDS, driveScript } from './render.mjs';
import { DEFAULT_ENGINE_PARAMS } from '../../src/engine/engineParams.js';
import { DEFAULT_AUDIO_PARAMS } from '../../src/audio/audioParams.js';
import { measure } from '../engine-bank-model.mjs';

const SR = 48000;
const SHOP = '.scratch/shop/cars';
const OUT = '.scratch/engine-review';
const PY = process.env.PYTHON ?? (existsSync('.scratch/venv/bin/python3') ? '.scratch/venv/bin/python3' : 'python3');
const KEEP = 5;

// What each vehicle needs: the idle's rpm range to look in (the recording's, not the game's), its cylinders, and what it is.
const VEHICLES = {
  finch: { rpm: [650, 1300], cyl: 4, what: 'a small carburettor petrol four' },
  griffin: { rpm: [650, 1300], cyl: 4, what: 'a bigger petrol four with a loud exhaust' },
  vauclair: { rpm: [600, 1100], cyl: 4, what: 'a diesel four' },
  tor: { rpm: [380, 800], cyl: 4, what: 'a big slow petrol four idling near 500 rpm' },
};

// The vehicle's settings with only the bank changed: its idle cut into its firings. The Tor plays its present Jeep one beat in three
// (pulseDivide 3); a recording that idles near its own pace plays every firing.
function trialAudio(spec, idleRpm) {
  const audio = { ...spec.audio, recIdleSource: 'quad', pulseSplit: VEHICLES[spec.id].cyl };
  if (spec.id === 'tor') {
    const idle = { ...DEFAULT_ENGINE_PARAMS, ...spec.engine }.idleRpmWarm;
    const divide = Math.max(1, Math.round(idleRpm / idle - 0.25));
    audio.pulseDivide = divide;
    if (divide === 1) for (const k of ['pulseSlowest', 'pulsePitchFollow']) audio[k] = DEFAULT_AUDIO_PARAMS[k];
  }
  return audio;
}

function ladder(spec) {
  const eng = { ...DEFAULT_ENGINE_PARAMS, ...spec.engine };
  const steps = [];
  for (let r = Math.ceil(eng.idleRpmWarm / 500) * 500; r < eng.maxRpm; r += 500) steps.push(r);
  steps.push(eng.maxRpm);
  return {
    duration: 1 + steps.length * 1.2,
    script: (t) => (t < 1 ? {} : { throttle: 0.35, gearRpm: steps[Math.min(steps.length - 1, Math.floor((t - 1) / 1.2))], gearLock: 1, driveLoad: 0.3 }),
  };
}
const CLIPS = [
  ['idle', 'Idle', () => ({ duration: 8, script: idleScript() })],
  ['ladder', 'Ladder up the revs', (s) => ladder(s)],
  ['revs', 'Revving, stood still', () => ({ duration: REV_SECONDS, script: revScript() })],
  ['drive', 'Driving', (s) => ({ duration: 30, script: driveScript(s) })],
  ['start', 'Starting', (s) => ({ recordStart: true, duration: 16, script: startScript(s) })],
];

function writeWav(path, out, scale = 0.5) {
  const wav = Buffer.alloc(44 + out.length * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + out.length * 2, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(out.length * 2, 40);
  for (let i = 0; i < out.length; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[i] * scale)) * 32767), 44 + i * 2);
  writeFileSync(path, wav);
}
const toPage = (wav, file) => execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '128000', wav, `${OUT}/site/audio/${file}.mp4`]);

function preview(id) {
  for (const p of [`.scratch/shop/fs/${id}.mp3`, `.scratch/shop/raw2/${id}.mp3`, `.scratch/shop/raw/${id}.mp3`]) if (existsSync(p)) return p;
  throw new Error(`no preview for ${id}: node tools/freesound.mjs fetch ${id}`);
}
function details(id) {
  const p = `.scratch/shop/fs/${id}.json`;
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { id, name: `Freesound ${id}`, author: '?', link: `https://freesound.org/s/${id}/` };
}

// The bank's starter, crank and shutdown (and the Tor's starting handle, the Griffin's stall) that the trial bank lacks, copied from
// the vehicle's present bank: its WAV with them appended, their entries as they were (their gain is on the raw samples, as here).
function borrow(trialPath, presentPath) {
  const trial = JSON.parse(readFileSync(trialPath, 'utf8'));
  const present = JSON.parse(readFileSync(presentPath, 'utf8'));
  const presentPcm = rawBank(presentPath);
  const wavPath = trialPath.replace(/\.json$/, '.wav');
  const raw = readFileSync(wavPath);
  const head = raw.subarray(0, 44);
  const pcm = [raw.subarray(44)];
  let at = (raw.length - 44) / 2;
  const borrowed = [];
  for (const [name, o] of Object.entries(present.oneshots)) {
    if (trial.oneshots[name]) continue;
    const from = Math.round(o.start * present.sampleRate);
    const n = Math.round(o.dur * present.sampleRate);
    pcm.push(Buffer.from(presentPcm.subarray(from * 2, (from + n) * 2)));
    trial.oneshots[name] = { ...o, start: at / trial.sampleRate };
    at += n;
    borrowed.push(name);
  }
  if (borrowed.length) {
    const body = Buffer.concat(pcm);
    head.writeUInt32LE(36 + body.length, 4);
    head.writeUInt32LE(body.length, 40);
    writeFileSync(wavPath, Buffer.concat([head, body]));
    writeFileSync(trialPath, JSON.stringify(trial));
  }
  return borrowed;
}

// The idle's whine by srcscan.mjs: its grains' tonal peaks, and the share of grains in runs standing 6 dB over the median (the
// shipped banks' p90 is 12 to 14 dB, so the runs say more than the level).
function whine(bankPath) {
  const out = execFileSync('node', ['tools/engine-review/srcscan.mjs', bankPath]).toString();
  const m = out.match(/: (\d+) grains .*median (-?[\d.]+) dB, p90 (-?[\d.]+)/);
  if (!m) return null;
  const inRuns = [...out.matchAll(/s: (\d+) grains, around/g)].reduce((a, r) => a + +r[1], 0);
  return { median: +m[2], p90: +m[3], share: +(inRuns / +m[1]).toFixed(3) };
}

// Longer (to a minute), steadier and cleaner is higher; an idle under 20 s scores nothing (as idlescan.py's).
const scoreOf = (i) => (!i || i.length < 20 ? 0 : (Math.min(i.length, 60) / 60) * i.repeat / (1 + i.wander / 2));

// The present bank's WAV at its own rate (bankFor's data is resampled to the renderer's).
function rawBank(jsonPath) {
  const name = jsonPath.split('/').pop().replace(/\.json$/, '.wav');
  const path = [jsonPath.replace(/\.json$/, '.wav'), `source/audio/${name}`].find(existsSync);
  const buf = readFileSync(path);
  return buf.subarray(buf.indexOf('data') + 8);
}

function renderRow(spec, row, { bankPath, audio, note, bankName }) {
  const s = { ...spec, audio };
  const [lo, hi] = spec.roughnessRange ?? [0.08, 0.08];
  const eng = { ...DEFAULT_ENGINE_PARAMS, ...spec.engine };
  const entry = { id: row, name: note.name, bank: bankName, note: note.text, idleRpm: eng.idleRpmWarm, maxRpm: eng.maxRpm, roughness: { mid: (lo + hi) / 2 }, clips: {} };
  for (const [key, label, make] of CLIPS) {
    const { pcm, trace } = renderClip(s, { roughness: (lo + hi) / 2, bankPath, ...make(spec) });
    if (key === 'ladder') for (const p of trace) p[3] = null;
    const file = `cand-${row}-${key}`;
    const wav = `${SHOP}/wav/${file}.wav`;
    writeWav(wav, pcm);
    toPage(wav, file);
    entry.clips[key] = { label, seconds: +(pcm.length / SR).toFixed(2), trace, file, kind: key };
  }
  return entry;
}

const main = import.meta.url === `file://${process.argv[1]}`;
if (main) {
  const only = process.argv.slice(2);
  const LIST = JSON.parse(readFileSync(`${SHOP}/candidates.json`, 'utf8'));
  mkdirSync(`${SHOP}/wav`, { recursive: true });
  mkdirSync(`${OUT}/site/audio`, { recursive: true });
  const prev = existsSync(`${OUT}/compare.json`) ? JSON.parse(readFileSync(`${OUT}/compare.json`, 'utf8')) : [];
  const ranking = existsSync(`${SHOP}/ranking.json`) ? JSON.parse(readFileSync(`${SHOP}/ranking.json`, 'utf8')) : {};
  const sections = new Map(prev.map((s) => [s.id, s]));
  for (const [vid, want] of Object.entries(VEHICLES)) {
    if (only.length && !only.includes(vid)) continue;
    const spec = SPECS.find((s) => s.id === vid);
    const presentBank = `public/audio/${spec.audio.recBank}.json`;
    const scored = [];
    for (const c of LIST[vid] ?? []) {
      const d = details(c.id);
      const wav = `${SHOP}/wav/${c.id}.wav`;
      if (!existsSync(wav)) execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@44100', '-c', '1', preview(c.id), wav]);
      const scan = JSON.parse(execFileSync(PY, ['tools/engine-review/idlescan.py', wav, '--rpm', want.rpm.join('-'), '--cyl', String(want.cyl), '--json']).toString())[0];
      // An idle given in the list (heard to run longer than the scan holds it) keeps the scan's rate, spread and repeat.
      const idle = c.idle ? { ...scan.idle, start: c.idle[0], end: c.idle[1], length: c.idle[1] - c.idle[0] } : scan.idle;
      if (!idle) {
        scored.push({ c, d, scan, reason: 'no steady idle found' });
        continue;
      }
      // Up to 30 s of the idle, cut into whole cycles (every cylinder once) within 15% of its measured cycle.
      const cycle = 120 / idle.rpm;
      const name = `trial-${vid}-${c.id}`;
      const dir = `${SHOP}/banks/${vid}-${c.id}`;
      const config = {
        name,
        segments: [['idle', 'src', idle.start, Math.min(idle.end, idle.start + 30), [cycle * 0.85, cycle * 1.15]]],
        oneshots: [],
        level: [['idle', 'idle', 'src']],
        idleCycles: true,
      };
      if (c.starter) {
        const [from, caught, crankRpm] = c.starter;
        // The engage is the first quarter second; the loop two compressions after it (one turn of a four), so it goes round on the beat.
        const loop = Math.min(caught - from - 0.3, (2 * 60) / (2 * crankRpm));
        config.oneshots.push(['starterEngage', 'src', from, from + 0.25], ['crankLoop', 'src', from + 0.25, from + 0.25 + loop, { crankRpm }]);
      }
      if (c.shutdown) config.oneshots.push(['shutdown', 'src', c.shutdown[0], c.shutdown[1]]);
      if (config.oneshots.length) config.oneshotLevel = { src: [idle.start, Math.min(idle.end, idle.start + 30)] };
      mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}/config.json`, JSON.stringify(config, null, 1));
      execFileSync(PY, ['tools/slice_engine_audio.py', '--trial', `${dir}/config.json`, '--out', dir, `src=${wav}`]);
      const bankPath = `${dir}/${name}.json`;
      const borrowed = borrow(bankPath, presentBank);
      banks.delete(bankPath);
      banks.delete(`${bankPath}#data`);
      const audio = trialAudio(spec, idle.rpm);
      const { data, ...bank } = bankFor(bankPath);
      const key = `idle/${audio.pulseSplit}`;
      const json = JSON.parse(readFileSync(bankPath, 'utf8'));
      json.model = { [key]: measure(bank, data, 'idle', audio.pulseSplit) };
      writeFileSync(bankPath, JSON.stringify(json));
      banks.delete(bankPath);
      const w = whine(bankPath);
      // Whine counts against a recording when more than a tenth of its idle grains are in runs that stand out.
      const score = +(scoreOf(idle) * (w && w.share > 0.1 ? 0.7 : 1)).toFixed(3);
      scored.push({ c, d, scan: { ...scan, idle }, whine: w, borrowed, bankPath, audio, score, name });
    }
    scored.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    const kept = scored.filter((s) => s.score > 0).slice(0, KEEP);
    const rows = [renderRow(spec, `${vid}-now`, { bankPath: presentBank, audio: spec.audio, bankName: spec.audio.recBank, note: { name: `${spec.name}, as now`, text: 'the present bank, to compare' } })];
    for (const s of kept) {
      const i = s.scan.idle;
      const own = ['starter', 'shutdown'].filter((k) => s.c[k]);
      const text = `${s.d.author}, ${i.length.toFixed(0)} s idle at ${i.rpm} rpm (wanders ${i.wander}%), ${own.length ? `its own ${own.join(' and ')}` : 'no starter or shutdown of its own'}${s.borrowed.length ? `; the present ${s.borrowed.join(', ')}` : ''}. ${s.c.note ?? ''}`.trim();
      const row = `${vid}-${s.c.id}`;
      rows.push(renderRow(spec, row, { bankPath: s.bankPath, audio: s.audio, bankName: `Freesound ${s.c.id}`, note: { name: s.d.name, text } }));
      // The recording itself, so its own start and stop can be heard as recorded.
      const file = `cand-${row}-source`;
      toPage(`${SHOP}/wav/${s.c.id}.wav`, file);
      rows.at(-1).clips.source = { label: 'The recording', seconds: s.scan.seconds, trace: [[0, 0, 0, null, 0], [s.scan.seconds, 0, 0, null, 0]], file, kind: 'source' };
    }
    rows[0].clips.source = { ...rows[0].clips.idle, label: 'The recording (as now: its idle)' };
    const fewer = kept.length < 3 ? ` Only ${kept.length} found worth hearing: ${scored.filter((s) => !s.score).map((s) => `${s.c.id} (${s.reason ?? `idle ${s.scan.idle.length.toFixed(0)} s, under 20`})`).join(', ') || 'nothing else turned up in the searches'}.` : '';
    sections.set(`cand-${vid}`, {
      id: `cand-${vid}`,
      title: `${spec.name}: ${want.what}`,
      intro: `Each recording's steadiest idle cut into a trial bank and played as the ${spec.name}, with nothing else changed; the top row is how it sounds now. Ranked best first by the idle's length, how steady it fires and how little else is in it.${fewer}`,
      cols: [...CLIPS.map(([k, l]) => [k, l]), ['source', 'The recording']],
      rows,
    });
    ranking[vid] = scored.map((s) => ({ id: s.c.id, name: s.d.name, author: s.d.author, link: s.d.link, licence: s.d.licence, score: s.score ?? 0, idle: s.scan?.idle ?? null, whine: s.whine ?? null, reason: s.reason ?? null, kept: kept.includes(s) }));
    console.log(`${vid}: ${scored.length} tried, ${kept.length} kept`);
  }
  writeFileSync(`${OUT}/compare.json`, JSON.stringify([...sections.values()]));
  writeFileSync(`${SHOP}/ranking.json`, JSON.stringify(ranking, null, 1));
  const md = Object.entries(ranking).map(([vid, list]) => [`## ${vid}`, '', '| kept | score | id | author | idle | rpm | wanders | repeats | whine p90 | in whine runs |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...list.map((r) => `| ${r.kept ? 'yes' : ''} | ${r.score} | [${r.id}](${r.link}) | ${r.author} | ${r.idle ? `${r.idle.start} to ${r.idle.end} s` : r.reason} | ${r.idle?.rpm ?? ''} | ${r.idle?.wander ?? ''}% | ${r.idle?.repeat ?? ''} | ${r.whine?.p90 ?? ''} | ${r.whine ? `${(r.whine.share * 100).toFixed(0)}%` : ''} |`), ''].join('\n')).join('\n');
  writeFileSync(`${SHOP}/ranking.md`, md);
  console.log(md);
}
