# The engine review's tools

Made for the engine review of 14 and 15 November 2026 (#851): why every engine stops changing above about 3k rpm, and a rule per
engine type fitted to real rev recordings. The findings, every number and what was decided are in
`docs/briefs/engine-review.md`; the decision is at the end of `docs/decisions/sound.md`. These are the tools that measured it, kept
so the issues that build the rule port from them instead of guessing.

Run everything from the repo root. Inputs (the worklet, banks, specs) are read from `src/` and `public/audio/`; **outputs go to
`.scratch/engine-review/`** (WAVs, `data.json`, `compare.json`, `fit.json`, `sweep/`, `banks/`, `site/`), which is untracked.

`WORKLET=<path>` makes `render`, `probe`, `fit`, `trend`, `calibrate` and `sections` play a copy of the worklet in place of
`src/audio/engineWorklet.js`. `prototype/engineWorklet.js` is that copy with the review's new settings, which play exactly as the
game's while they are left at 0: `pulseRate`, `pulseRateJitter`, `pulseSplit`, `pulseSteady`, `pulseHighFollow`, `pulseTopFollow`
(with `pulseTopFrom` and `pulseTopTo`), `pulseBurst`, `pulseCylinders`, `pulseCylGain`, `pulseCylTime`, `pulseFireJitter`, `pulseStrengthJitter` and the
source-filter mode that was tried and dropped. It is the reference the next issues port from. `prototype/calibrated.json` is the
fitted values, by engine type (`best` is the settings, `note` the error of the fit and `asNow` the error with every setting 0).

```
WORKLET=tools/engine-review/prototype/engineWorklet.js
```

## Rendering and measuring

| Tool | What it does | Run |
| --- | --- | --- |
| `render.mjs` | Renders every vehicle (or the ones named) through the real engine model and worklet as five clips: the start, idle, a rough idle, revving stood still and a scripted drive (no physics; gear changes on manuals). Writes WAVs to `wav/`, AAC to `site/audio/` (`afconvert`, macOS only) and each clip's rpm, throttle and gear to `data.json`. Naming vehicles overwrites `data.json` with only those, so finish with a full run. Also exports `SPECS`, `renderClip`, the scripts and `bankFor` for the others. | `node tools/engine-review/render.mjs [vehicle id ...]` |
| `sweep.mjs` | Holds each engine at 500 rpm steps from idle to its top (tied to the road through the clutch, throttle part open), renders it and prints the firing rate heard against the engine's, loudness and tone for each step. | `node tools/engine-review/sweep.mjs [vehicle id ...] [--set param=value ...]` |
| `probe.mjs` | Drives the worklet with perfectly even firings at fixed rpm, no engine model: what the worklet does with revs, apart from what the model sends it. | `node tools/engine-review/probe.mjs <vehicle id> [--cyl n] [--set param=value ...] [--wav out.wav]` |
| `coverage.mjs` | For each vehicle, the revs it reaches against the revs its bank's usable grains were recorded at. | `node tools/engine-review/coverage.mjs` |

## Looking for faults in a render

| Tool | What it does | Run |
| --- | --- | --- |
| `gaps.mjs` | Counts dropouts (5 ms windows 20 dB under the clip's median) and clicks (samples jumping 8 times the typical step) in WAVs. | `node tools/engine-review/gaps.mjs a.wav [b.wav ...]` |
| `ticks.mjs` | Counts ticks a second: bursts above 2.5 kHz five times over the 20 ms around them. The measure for the Griffin's ticking; `gaps.mjs`'s click count only catches steep low-frequency waveform. | `node tools/engine-review/ticks.mjs a.wav [b.wav ...]` |
| `wavpeak.mjs` | The strongest narrow tone from 2 to 6 kHz in a WAV, and how many 85 ms frames show one 6 dB over the median. | `node tools/engine-review/wavpeak.mjs a.wav [b.wav ...]` |
| `whine.mjs` | Renders a long idle and looks for a narrow spectral peak standing out, listing the grains playing when one shows. The T185's whine. A third argument plays a patched bank (`dewhine.mjs`'s) in place of the shipped one. | `node tools/engine-review/whine.mjs <vehicle id> [seconds] [bank.json]` |
| `srcscan.mjs` | Scans a bank's idle grains in the source recording for a narrow tonal peak, grain by grain. | `node tools/engine-review/srcscan.mjs <bank name> [kind]` |
| `dewhine.mjs` | Marks the idle grains whose peak stands more than `over` dB (5.5) over the recording's median as `ok: false` (which the worklet honours) and writes the bank to `banks/`. In the game this belongs in `tools/slice_engine_audio.py`, so a re-slice keeps it (#852). | `node tools/engine-review/dewhine.mjs <bank name> [over]` |
| `cuts.mjs` | Where a cycle's even cut into firings lands: the level in the 1 ms at each cut against the firing's RMS (high means it starts mid-sound), and where the loudest moment falls in each slice. | `node tools/engine-review/cuts.mjs <bank> <split> [kind]` |

## Fitting the rule

| Tool | What it does | Run |
| --- | --- | --- |
| `model.mjs` | The source-filter analysis (linear-prediction split of a recording into its resonances and bare pulses) and the band and burst helpers the others use. The source-filter rebuild it served was dropped; see the brief. Not run on its own. | imported |
| `fit.mjs` | Scores ways of building revs from an idle recording against the same engine's real revs: third-octave bands, lower is closer. `--wav` keeps the clips in `wav/fit/`. Writes `fit.json`. | `WORKLET=... node tools/engine-review/fit.mjs [--wav]` |
| `trend.mjs` | How tone and note change as the revs rise, real against built, over the long rev recordings in the banks. | `WORKLET=... node tools/engine-review/trend.mjs` |
| `calibrate.mjs` | Fits the per-type rule (steadiness, and for several cylinders the spread of each cylinder's strength and timing and each firing's variation) to the real rev recordings of each type, scoring the note by the firing and by the cycle at five rpms, two seeds, with a click guard (a setting with a quarter as many clicks again as today's is rejected). Merges the result into `calibrated.json` in the output folder, starting from `prototype/calibrated.json`. `STEADY_ONLY=1` scores steadiness alone and writes nothing. | `WORKLET=... node tools/engine-review/calibrate.mjs [type ...]` |

The types are the keys of `prototype/calibrated.json`: `four-stroke single`, `two-stroke single`, `petrol four`, `diesel, several
cylinders`, and the Finch and the Griffin on their own engines' revs.

## The review page

`sections.mjs` renders the comparison sections (each a set of vehicles by settings and script) through the prototype worklet into
`wav/compare/`, `site/audio/` and `compare.json`; `WORKLET` is required. `build.mjs` then puts `data.json` and the sections into
`site/index.html` from `site/template.html`, in the order `page.json` sets: the sections waiting on Jamie's ears first, numbered to
match the questions in chat, then the done and parked ones folded away. Keep `page.json` in step with the questions asked. The page
was published as an artifact with root `.scratch/engine-review/site` and the audio files listed. Jamie marks moments on it and pastes
the copied notes back; each names vehicle, clip, time, rpm, throttle and gear.

```
node tools/engine-review/render.mjs
WORKLET=tools/engine-review/prototype/engineWorklet.js node tools/engine-review/sections.mjs
node tools/engine-review/build.mjs
```

One vehicle on its own, with the game's own worklet, is `tools/render_engine_sound.mjs` (`.claude/rules/checking.md`).
