// CC0 shutdowns (and the Griffin's stall) to choose from, each heard on the recording Jamie picked for the vehicle's idle (#857).
//
//   node tools/engine-review/shutdowns.mjs [vehicle ...]            after candidates.mjs, then node tools/engine-review/build.mjs
//
// Reads .scratch/shop/cars/shutdowns.json, { "<vehicle id>": { "pick": <Freesound id of its idle>, "shutdown": [{ "id", "cut":
// [from, to], "idle": [from, to], "note" }], "stall": [...] } }: each cut is the run-down from the moment it is switched off (or
// starts to die) to quiet, and `idle` a stretch of the same recording's idle before it, which sets its loudness against the bank's
// idle as the shipped banks' borrowed run-downs are (oneshotLevel). For each one the pick's trial bank is sliced again with the cut
// in it (tools/slice_engine_audio.py --trial), the rest borrowed from the present bank as candidates.mjs does, and rendered as the
// vehicle idling and then switched off (or stalling), beside the pick with its present run-down. Each goes in a section of
// compare.json, off-<vehicle> or stall-<vehicle>, with the cut as recorded.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { SPECS, renderClip, banks } from './render.mjs';
import { borrow, trialAudio, writeWav, toPage, preview, details, SHOP, OUT, PY } from './candidates.mjs';
import { DEFAULT_ENGINE_PARAMS } from '../../src/engine/engineParams.js';

// Idling, then the key off (or a stall) at 2.5 s, and 4 s more for it to run down.
const AT = 2.5;
const KINDS = {
  shutdown: { col: 'off', label: 'Switched off', script: () => (t, engine) => { if (t >= AT) engine.setIgnition(false); return t < AT + 4 ? {} : null; } },
  stall: { col: 'stall', label: 'Stalling', script: () => (t, engine) => { if (t >= AT && engine.isRunning) engine.stall('rough'); return t < AT + 4 ? {} : null; } },
};

// A stretch of a recording at its own rate: the cut with a second of what came before it.
function excerpt(wav, from, to, file) {
  const buf = readFileSync(wav);
  const pcm = buf.subarray(buf.indexOf('data') + 8);
  const rate = buf.readUInt32LE(24);
  const a = Math.max(0, Math.round((from - 1) * rate)) * 2;
  const b = Math.min(pcm.length, Math.round((to + 0.3) * rate) * 2);
  const out = new Float32Array((b - a) / 2);
  for (let i = 0; i < out.length; i++) out[i] = pcm.readInt16LE(a + i * 2) / 32768;
  const path = `${SHOP}/wav/${file}.wav`;
  writeWav(path, out, 1, rate);
  toPage(path, file);
  return +(out.length / rate).toFixed(2);
}

function render(spec, audio, bankPath, kind, row) {
  const [lo, hi] = spec.roughnessRange ?? [0.08, 0.08];
  const { pcm, trace } = renderClip({ ...spec, audio }, { roughness: (lo + hi) / 2, bankPath, duration: AT + 4, script: KINDS[kind].script() });
  const file = `cand-${row}-${KINDS[kind].col}`;
  const wav = `${SHOP}/wav/${file}.wav`;
  writeWav(wav, pcm);
  toPage(wav, file);
  return { label: KINDS[kind].label, seconds: +(pcm.length / 48000).toFixed(2), trace, file, kind: KINDS[kind].col };
}

const main = import.meta.url === `file://${process.argv[1]}`;
if (main) {
  const only = process.argv.slice(2);
  const LIST = JSON.parse(readFileSync(`${SHOP}/shutdowns.json`, 'utf8'));
  const prev = existsSync(`${OUT}/compare.json`) ? JSON.parse(readFileSync(`${OUT}/compare.json`, 'utf8')) : [];
  const sections = new Map(prev.map((s) => [s.id, s]));
  for (const [vid, want] of Object.entries(LIST)) {
    if (only.length && !only.includes(vid)) continue;
    const spec = SPECS.find((s) => s.id === vid);
    const presentBank = `public/audio/${spec.audio.recBank}.json`;
    const pickDir = `${SHOP}/banks/${vid}-${want.pick}`;
    const pickConfig = JSON.parse(readFileSync(`${pickDir}/config.json`, 'utf8'));
    const pickBank = `${pickDir}/trial-${vid}-${want.pick}.json`;
    const pick = JSON.parse(readFileSync(pickBank, 'utf8'));
    const idleRpm = 120 / pickConfig.segments[0][4].reduce((a, b) => a + b) * 2;
    const audio = trialAudio(spec, idleRpm);
    const pickWav = `${SHOP}/wav/${want.pick}.wav`;
    for (const kind of ['shutdown', 'stall']) {
      if (!want[kind]?.length) continue;
      const { col, label } = KINDS[kind];
      const what = kind === 'shutdown' ? 'run-down' : 'stall';
      const rows = [{ id: `${vid}-${col}-now`, name: `${spec.name} on ${want.pick}, its present ${what}`, bank: `Freesound ${want.pick}`, note: `the ${what} it has now, to compare`,
        idleRpm: { ...DEFAULT_ENGINE_PARAMS, ...spec.engine }.idleRpmWarm, clips: { [col]: render(spec, audio, pickBank, kind, `${vid}-${col}-now`) } }];
      rows[0].clips.cut = { ...rows[0].clips[col], label: 'As recorded (as now: the same)' };
      for (const c of want[kind]) {
        const d = details(c.id);
        const wav = `${SHOP}/wav/${c.id}.wav`;
        if (!existsSync(wav)) execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@44100', '-c', '1', preview(c.id), wav]);
        const name = `trial-${vid}-${want.pick}-${col}-${c.id}`;
        const dir = `${SHOP}/banks/${vid}-${want.pick}-${col}-${c.id}`;
        mkdirSync(dir, { recursive: true });
        const config = { ...pickConfig, name, oneshots: [[kind, 'off', ...c.cut]], oneshotLevel: { off: c.idle } };
        writeFileSync(`${dir}/config.json`, JSON.stringify(config, null, 1));
        execFileSync(PY, ['tools/slice_engine_audio.py', '--trial', `${dir}/config.json`, '--out', dir, `src=${pickWav}`, `off=${wav}`]);
        const bankPath = `${dir}/${name}.json`;
        borrow(bankPath, presentBank);
        // The idle is the pick's, cut the same way, so its pulse model is the pick's too.
        const json = JSON.parse(readFileSync(bankPath, 'utf8'));
        json.model = pick.model;
        writeFileSync(bankPath, JSON.stringify(json));
        banks.delete(bankPath);
        banks.delete(`${bankPath}#data`);
        const row = `${vid}-${col}-${c.id}`;
        const clips = { [col]: render(spec, audio, bankPath, kind, row) };
        clips.cut = { label: 'As recorded', seconds: 0, trace: [], file: `cand-${row}-cut`, kind: 'source' };
        clips.cut.seconds = excerpt(wav, c.cut[0], c.cut[1], clips.cut.file);
        clips.cut.trace = [[0, 0, 0, null, 0], [clips.cut.seconds, 0, 0, null, 0]];
        rows.push({ id: row, name: d.name, bank: `Freesound ${c.id}`, note: `${d.author}, ${c.cut[0]} to ${c.cut[1]} s. ${c.note ?? ''}`.trim(), clips });
      }
      sections.set(`${col}-${vid}`, {
        id: `${col}-${vid}`,
        title: `${spec.name}: ${kind === 'shutdown' ? 'switched off' : 'stalling'}`,
        intro: `Each ${what} cut into the ${spec.name}'s new idle (${want.pick}) and played as it ${kind === 'shutdown' ? 'is switched off' : 'stalls'} after ${AT} s, levelled against its own recording's idle; the top row is the ${what} it has now. Beside each, the cut as recorded with a second before it.`,
        cols: [[col, label], ['cut', 'As recorded']],
        rows,
      });
      console.log(`${vid} ${kind}: ${want[kind].length} cut`);
    }
  }
  writeFileSync(`${OUT}/compare.json`, JSON.stringify([...sections.values()]));
}
