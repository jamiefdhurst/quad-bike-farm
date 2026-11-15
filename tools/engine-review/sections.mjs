// The comparison sections on the review page: each a set of vehicles (rows) by settings and script (columns), rendered through the
// scratch worklet (tools/engine-review/prototype/engineWorklet.js), which plays exactly as the game's with its new settings left at 0. Writes WAVs, AAC
// for the page and compare.json.
//
//   WORKLET=tools/engine-review/prototype/engineWorklet.js node tools/engine-review/sections.mjs [section id ...]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { renderClip, SPECS, banks, bankFor, idleScript, revScript, REV_SECONDS, driveScript } from './render.mjs';
import { DEFAULT_ENGINE_PARAMS } from '../../src/engine/engineParams.js';
import { modelBank, burstSeconds } from './model.mjs';

if (!process.env.WORKLET) throw new Error('set WORKLET to the prototype worklet (tools/engine-review/prototype/engineWorklet.js)');
const SR = 48000;
const OUT = '.scratch/engine-review';
mkdirSync(`${OUT}/wav/compare`, { recursive: true });

// Every 500 rpm from idle to the top, 1.2 s a step after a second at idle, tied to the road at part throttle.
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
const SCRIPTS = {
  ladder: (s) => ladder(s),
  revs: () => ({ duration: REV_SECONDS, script: revScript() }),
  drive: (s) => ({ duration: 30, script: driveScript(s) }),
  idle: () => ({ duration: 6, script: idleScript() }),
  longIdle: () => ({ duration: 30, script: idleScript() }),
};
const WORDS = { ladder: 'ladder', revs: 'revving', drive: 'driving', idle: 'idle', longIdle: '30 s idle' };

// The cars built from their idle alone: each recorded cycle cut into its four firings, no rev recording, sped up part of the way
// above the recording, less bass cut and more loudness with the revs.
const FROM_IDLE = { pulseSplit: 4, pulseDivide: 1, pulseRevLo: 0, pulseRevHi: 0, pulseHighFollow: 0.5, pulseLowCut: 6, pulseRevLoudness: 0.6 };
const STEADY = { pulseSteady: 0.85 };
// New voices for the five on one bank: which recorded machine, how fast it plays (a bigger or smaller engine), tone.
const VOICES = {
  farm300: {},
  ursa: { recIdleSource: 'third', pulseRate: 0.92, pulseTone: 4500 },
  bruin: { pulseRate: 0.85, pulseDrone: 5, pulseDroneFreq: 100 },
  shepherd: { pulseRate: 1.18, pulseTone: 9000 },
  clipper: { recIdleSource: 'third', pulseRate: 0.88, pulseTone: 2500 },
};
const VOICE_WORDS = {
  farm300: 'unchanged, the one the others are told apart from',
  ursa: 'the bank\'s third recorded machine, played 8% slower, softer top',
  bruin: 'its own recording 15% slower (a bigger single), a low drone',
  shepherd: 'its own recording 18% faster (a small 200), brighter',
  clipper: 'the third machine 12% slower, muffled under a bonnet',
};

// The per-type rule, as fitted to the real rev recordings (calibrate.mjs writes calibrated.json): which type each vehicle is, and
// how its idle grains are cut (a cycle of several cylinders into its firings).
const CALIBRATED = JSON.parse(readFileSync(existsSync(`${OUT}/calibrated.json`) ? `${OUT}/calibrated.json` : new URL('./prototype/calibrated.json', import.meta.url), 'utf8'));
const TYPE_OF = {
  farm300: ['four-stroke single'],
  rb300: ['four-stroke single'],
  tz65: ['two-stroke single'],
  adder: ['two-stroke single'],
  yak: ['diesel, several cylinders', 3],
  crag: ['diesel, several cylinders', 4],
  vauclair: ['diesel, several cylinders', 4],
  finch: ['Finch, its own revs', 4],
  griffin: ['Griffin, its own revs', 4],
  tor: ['petrol four'],
};
// The engine models of the Yak and Crag say one cylinder, but their idles are whole cycles of a three and a four: cut into firings,
// the engine has to fire that many times a cycle, or three in four of each cycle is silence (version 4's dropouts).
const ENGINE_FIX = { yak: { cylinders: 3 }, crag: { cylinders: 4 } };
// The Griffin's level (recVolume 1.1, the loudest of all) drove its boomiest firings into the output's soft clipper: a tick each.
// 3 dB less keeps it out (about the Finch's 0.8).
const LEVEL_FIX = { griffin: { recVolume: 1.1 * 10 ** (-3 / 20) } };
function calibrated(id) {
  const [type, split] = TYPE_OF[id];
  // The Tor keeps its own settings (one beat every third firing, slowed: the Jeep's idle is too quick for it) and only takes the
  // fitted steadiness: its spread on top of the every-third-firing trick broke it in version 4.
  if (id === 'tor') return { pulseSteady: CALIBRATED[type]?.best?.pulseSteady ?? 0 };
  return {
    pulseRevLo: 0,
    pulseRevHi: 0,
    pulsePitchFollow: 0,
    ...(split ? { pulseSplit: split, pulseDivide: 1, pulseCylinders: split } : {}),
    ...(CALIBRATED[type]?.best ?? {}),
    ...(LEVEL_FIX[id] ?? {}),
  };
}
// The top of the revs: each firing's pulse shortening towards the top, as a real one does. With `model`, from the recording with
// its resonances divided out and put back fixed (so only the pulse moves); without, plainly (so the resonances move too).
function top(id, { from = 0.5, follow = 0.5, model = false, wholeRange = false, burst = false } = {}) {
  const eng = { ...DEFAULT_ENGINE_PARAMS, ...SPECS.find((s) => s.id === id).engine };
  if (burst) return { audio: { ...calibrated(id) }, model: true, burst: true };
  const audio = { ...calibrated(id), ...(wholeRange ? { pulsePitchFollow: follow } : { pulseTopFollow: follow, pulseTopFrom: from * eng.maxRpm, pulseTopTo: eng.maxRpm }) };
  return { audio, model };
}

export const SECTIONS = [
  {
    id: 'top',
    title: 'The top of the revs',
    intro: 'The fitted sound (as you heard it, with the diesels mended) against three ways of giving the top of the revs the change in pitch a real engine has. As the revs climb a real exhaust pulse gets shorter (the valves stay open for the same turn of the crank), so its sound rises while the pipe and body keep their resonances. "Shorter pulses" does that from half the top revs up: the recording\'s resonances are taken out, the bare pulses are played faster, and the resonances put back where they were. "Plainly" plays the whole recording faster, resonances and all (like the pitch beyond you liked before). "From idle" is the shorter pulses all the way up, at the amount the real rev recordings fitted. Nothing above about 5.8k had real revs to fit to, so this one is for your ears.',
    rows: ['farm300', 'rb300', 'tz65', 'adder', 'finch', 'griffin', 'crag'],
    cols: [
      ['fit-ladder', 'Fitted, ladder', 'calibrated', 'ladder'],
      ['short-ladder', 'Shorter pulses at the top, ladder', (id) => top(id, { model: true }), 'ladder'],
      ['plain-ladder', 'Plainly faster at the top, ladder', (id) => top(id), 'ladder'],
      ['idle-ladder', 'Shorter pulses from idle, ladder', (id) => top(id, { model: true, wholeRange: true }), 'ladder'],
      ['burst-ladder', 'Burst fits the gap, ladder', (id) => top(id, { burst: true }), 'ladder'],
      ['short-revs', 'Shorter pulses at the top, revving', (id) => top(id, { model: true }), 'revs'],
      ['burst-revs', 'Burst fits the gap, revving', (id) => top(id, { burst: true }), 'revs'],
      ['plain-revs', 'Plainly faster at the top, revving', (id) => top(id), 'revs'],
    ],
  },
  {
    id: 'calibrated',
    title: 'One rule per engine type, fitted to real revs',
    intro: 'Each engine built from its idle alone, with one setting per type of engine fitted so its revs repeat the way real rev recordings of that type do: how alike one firing is to the next and, for engines with several cylinders, how each cylinder differs, so the sound repeats once a cycle. Diesels and cars with several cylinders have each recorded cycle cut into its firings, so none are dropped as the revs rise. The Finch and Griffin are fitted to their own engines\' rev recordings, since real fours differ a lot (the Fiesta\'s runs evenly, a Mini\'s is lumpy); the Tor takes the fit across all of them. Nothing per vehicle was tuned by ear.',
    rows: Object.keys(TYPE_OF),
    cols: [
      ['now-ladder', 'As now, ladder', {}, 'ladder'],
      ['cal-ladder', 'Fitted, ladder', 'calibrated', 'ladder'],
      ['now-revs', 'As now, revving', {}, 'revs'],
      ['cal-revs', 'Fitted, revving', 'calibrated', 'revs'],
      ['cal-drive', 'Fitted, driving', 'calibrated', 'drive'],
    ],
  },
  {
    id: 'cars',
    title: 'The cars, built from their idle',
    intro: 'The Finch and Griffin playing no rev recording at all. Each recorded idle cycle is cut into its four firings, so every firing the engine makes plays one real firing, cut off as the next one starts and sped up part of the way above the idle it was recorded at. Less bass is taken out as the revs rise, and it gets louder with them.',
    rows: ['finch', 'griffin'],
    cols: [
      ['now-ladder', 'As now, ladder', {}, 'ladder'],
      ['idle-ladder', 'From idle, ladder', FROM_IDLE, 'ladder'],
      ['idle-revs', 'From idle, revving', FROM_IDLE, 'revs'],
      ['now-drive', 'As now, driving', {}, 'drive'],
      ['idle-drive', 'From idle, driving', FROM_IDLE, 'drive'],
    ],
  },
  {
    id: 'pitch',
    title: 'Pitch beyond the recording, less artificial',
    intro: 'Four takes on the version you liked for the Farm 300, with the Bruin (another single on the same bank) to hear whether it carries over. The first is the one you heard. "Varied" plays each firing up to 3% faster or slower than the last, as a real engine never fires two the same.',
    rows: ['farm300', 'bruin'],
    cols: [
      ['p50', 'Pitch 0.5', { pulseHighFollow: 0.5 }, 'ladder'],
      ['p35', 'Pitch 0.35', { pulseHighFollow: 0.35 }, 'ladder'],
      ['p35v', 'Pitch 0.35, varied', { pulseHighFollow: 0.35, pulseRateJitter: 0.03 }, 'ladder'],
      ['p50vs', 'Pitch 0.5, varied, a little steady', { pulseHighFollow: 0.5, pulseRateJitter: 0.03, pulseSteady: 0.3 }, 'ladder'],
      ['p35v-revs', 'Pitch 0.35, varied, revving', { pulseHighFollow: 0.35, pulseRateJitter: 0.03 }, 'revs'],
    ],
  },
  {
    id: 'diesels',
    title: 'Steady at speed on the rest of the diesels',
    intro: 'You liked steady at speed on the Yak and Crag. This is it on the diesels you haven\'t heard yet (the Vauclair and the tractor) and on the Tor, which is petrol, with the Yak and Crag driving to hear it in use.',
    rows: ['vauclair', 'hartley', 'tor', 'yak', 'crag'],
    cols: [
      ['now-ladder', 'As now, ladder', {}, 'ladder'],
      ['steady-ladder', 'Steady, ladder', STEADY, 'ladder'],
      ['steady-revs', 'Steady, revving', STEADY, 'revs'],
      ['now-drive', 'As now, driving', {}, 'drive'],
      ['steady-drive', 'Steady, driving', STEADY, 'drive'],
    ],
  },
  {
    id: 'whine',
    title: 'The T185\'s whine',
    intro: 'The T185\'s idle recording has a whine at 3.2 to 3.6 kHz in a few stretches (about 65 of its 1215 firings), so it is heard whenever those happen to be picked. The fix takes them out of use. The Plover\'s recording is tonal all the way through, and nothing in it stands out from that, so the fix leaves it as it is: listen for whether its usual tone sounds right.',
    rows: ['t185', 'plover'],
    cols: [
      ['now', 'As now, 30 s idle', {}, 'longIdle'],
      ['fixed', 'Whining firings left out', {}, 'longIdle', true],
    ],
  },
  {
    id: 'voices',
    title: 'Five machines, one recording',
    intro: 'The Farm 300, Ursa, Bruin, Shepherd and Clipper all play the same bank (two of its three recorded machines). These give each its own voice from what we have: which machine it idles on, how fast the recording plays (slower sounds bigger, faster smaller) and its tone. The new-voice ladders also have pitch 0.5, the direction you picked.',
    rows: ['farm300', 'ursa', 'bruin', 'shepherd', 'clipper'],
    cols: [
      ['now-idle', 'As now, idle', {}, 'idle'],
      ['voice-idle', 'New voice, idle', 'voice', 'idle'],
      ['now-ladder', 'As now, ladder', {}, 'ladder'],
      ['voice-ladder', 'New voice, ladder', 'voice+', 'ladder'],
    ],
  },
];

function writeWav(path, out) {
  const wav = Buffer.alloc(44 + out.length * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + out.length * 2, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(out.length * 2, 40);
  for (let i = 0; i < out.length; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[i] * 0.5)) * 32767), 44 + i * 2);
  writeFileSync(path, wav);
}

const MODELS = new Map(); // the model's analysis of a bank, by bank, idle kind and cut
const only = process.argv.slice(2);
const prev = existsSync(`${OUT}/compare.json`) ? JSON.parse(readFileSync(`${OUT}/compare.json`, 'utf8')) : [];
const result = [];
for (const sec of SECTIONS) {
  if (only.length && !only.includes(sec.id)) {
    const kept = prev.find((s) => s.id === sec.id);
    if (kept) result.push(kept);
    continue;
  }
  const rows = [];
  for (const id of sec.rows) {
    const spec = SPECS.find((s) => s.id === id);
    const eng = { ...DEFAULT_ENGINE_PARAMS, ...spec.engine };
    const [lo, hi] = spec.roughnessRange ?? [0.08, 0.08];
    const bankKey = `public/audio/${spec.audio?.recBank ?? 'engine-bank'}.json`;
    const entry = { id, name: spec.name, bank: spec.audio?.recBank ?? 'engine-bank', note: sec.id === 'voices' ? VOICE_WORDS[id] : sec.id === 'calibrated' || sec.id === 'top' ? `${TYPE_OF[id][0]}: ${JSON.stringify({ ...calibrated(id), ...(ENGINE_FIX[id] ? { engineCylinders: ENGINE_FIX[id].cylinders } : {}) }).replace(/[{}"]/g, '').replace(/,/g, ', ')}` : '', idleRpm: eng.idleRpmWarm, maxRpm: eng.maxRpm, roughness: { mid: +((lo + hi) / 2).toFixed(3) }, clips: {} };
    for (const [key, label, setsIn, kind, dewhined] of sec.cols) {
      const made = typeof setsIn === 'function' ? setsIn(id) : null;
      const sets = made ? made.audio : setsIn === 'calibrated' ? calibrated(id) : setsIn === 'voice' ? VOICES[id] : setsIn === 'voice+' ? { ...VOICES[id], pulseHighFollow: 0.5 } : setsIn;
      const fixedEngine = setsIn === 'calibrated' || made ? ENGINE_FIX[id] ?? {} : {};
      let bankMsg;
      if (made?.model) {
        const kind = { rev: 'idle2', third: 'idle3' }[{ ...spec.audio, ...sets }.recIdleSource] ?? 'idle';
        const mkey = `${bankKey}/${kind}/${sets.pulseSplit ?? 1}`;
        if (!MODELS.has(mkey)) {
          const full = bankFor(bankKey);
          MODELS.set(mkey, modelBank(full, full.data, kind, { split: sets.pulseSplit ?? 1, slopeOct: 4 }));
        }
        bankMsg = MODELS.get(mkey);
        if (made.burst) sets.pulseBurst = burstSeconds(bankMsg, bankMsg.data, kind, sets.pulseSplit ?? 1);
      }
      const shipped = banks.get(bankKey);
      if (dewhined) {
        execFileSync('node', ['tools/engine-review/dewhine.mjs', entry.bank]);
        banks.set(bankKey, JSON.parse(readFileSync(`${OUT}/banks/${entry.bank}.json`, 'utf8')));
      }
      const { pcm, trace } = renderClip({ ...spec, engine: { ...spec.engine, ...fixedEngine }, audio: { ...spec.audio, ...sets } }, { roughness: (lo + hi) / 2, bankMsg, ...SCRIPTS[kind](spec) });
      if (dewhined) shipped ? banks.set(bankKey, shipped) : banks.delete(bankKey);
      if (kind === 'ladder') for (const p of trace) p[3] = null;
      const file = `cmp-${sec.id}-${id}-${key}`;
      writeWav(`${OUT}/wav/compare/${file}.wav`, pcm);
      execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '128000', `${OUT}/wav/compare/${file}.wav`, `${OUT}/site/audio/${file}.mp4`]);
      entry.clips[key] = { label, seconds: +(pcm.length / SR).toFixed(2), trace, file, kind: WORDS[kind] };
    }
    rows.push(entry);
    console.log(`${sec.id} ${id}`);
  }
  result.push({ id: sec.id, title: sec.title, intro: sec.intro, cols: sec.cols.map(([k, l]) => [k, l]), rows });
}
writeFileSync(`${OUT}/compare.json`, JSON.stringify(result));
