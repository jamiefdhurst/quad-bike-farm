# Engine sound review: what we've found and what to do

Moved here from `.scratch/engine-review/plan.md` with the tools (#851): `tools/engine-review/` (its README says what each does). Vehicles are
named as the game names them; a recording is named as ASSETS.md names it, so a "Fiesta", "Carlton" or "Jeep" below is a recording, not a
vehicle. The decision that came out of it is at the end of `docs/decisions/sound.md`.

A running record while Jamie reviews the engines on the Engine Sound Review page
(https://claude.ai/artifact/H8yX61SejrcWYC2TZE8JGo). When the review is done this becomes the `/todo` issue(s).
Scripts are in `tools/engine-review/`.

## Found

- **Above about 3k rpm every engine stops changing** (2026-11-15). In pulse mode each firing is a recorded idle firing at its
  recorded speed (`pulsePitchFollow: 0`), picked afresh every time. Once firings come faster than a bang lasts, you only hear
  the first few ms of a different bang each time: no note (repeat at the firing rate 0.1 to 0.3 on the Farm 300), and no
  change in brightness or level past about 5k (the rev EQ is fully in by `pulseRefRpm + pulseEqRange`).
- **The cars run out of recording.** Their rev grains (blended in from `pulseRevLo`) stop at 2940 rpm (Griffin), 3050
  (Crag), 3110 (Vauclair), 5450 (Finch, 90% under 4400). Above that the same top grains replay cut short.
- **Cut whole-cycle grains drop firings.** The cars' grains are whole four-cylinder cycles (`pulseDivide: 4`). Cut to fit a
  shorter cycle, the end of each one (its later firings) is lost, which may be the "missing a lot" Jamie hears on the Finch
  and Griffin.
- **Five machines share one bank.** `engine-bank`: the Farm 300 and Ursa idle on `idle`, the Bruin, Shepherd and Clipper on
  `idle2`. `idle3` (a third machine) isn't used by anything.

## Decided

1. **Farm 300 (and the petrol singles like it): pitch beyond the recording**, not steady at speed (steady sounded
   artificial). Make it sound less artificial before it goes in.
2. **Diesels: steady at speed** works (Yak, Crag, Vauclair; Tor and tractor to confirm).
3. **The Finch and Griffin need a rethink:** their revs break up after 2 to 2.5k. Try building their revs from the idle
   only, as the quads do, instead of from the rev recordings.
4. **No hunt for higher-rev recordings for the cars** for now.
5. **When the review is done**, it becomes a `/todo` (issue, worktree, PR) with per-vehicle settings and a test that the
   note gets clearer as the revs rise.

- **The T185's whine is in its recording** (2026-11-15). The Piaggio Ape idle in `engine-bank-atc` has a 3.2 to 3.6 kHz whine in a few
  stretches (strongest 32.9 to 33.0 s); 63 of its 1215 idle firings stand 5.5 dB or more over the recording's usual tone. Marking
  them `ok: false` in the bank (which the worklet already honours) took a 30 s idle from 34 whining moments (up to 27.6 dB) to none
  (15.8). `dewhine.mjs` does it; in the game it belongs in the slicer's checks (`tools/slice_engine_audio.py`) so a re-slice
  keeps it. No other bank has stretches like it; the Plover is tonal throughout and is left alone.
- **The cars from idle only measure well.** Each whole-cycle idle grain cut evenly into its four firings (`pulseSplit: 4`,
  `pulseDivide: 1`, no rev blend), sped up part of the way above its recorded rpm (`pulseHighFollow: 0.5`), less bass cut
  (`pulseLowCut: 6`) and louder with revs (`pulseRevLoudness: 0.6`): the note holds to the top (repeat at the cycle 0.76 to 0.98)
  and level and brightness rise with the revs.

## Proposed: one model for every engine (2026-11-15, waiting on Jamie)

Jamie: the per-vehicle fixes so far are mostly guessing; is there a consistent model from engine size, cylinders, resonance,
bonnet and so on? Proposal: a source-filter model.

- In a real engine the firing pulse shortens with the revs (valve events are fixed in crank degrees) while the resonances (pipe,
  silencer, body, bonnet) stay put. The recordings mix the two: `pulsePitchFollow` 0 keeps both fixed (flat at the top), 1 moves
  both (artificial), 0.5 is a fudge.
- Offline, split each recording with linear prediction into its resonance filter and its bare pulses (the residual). In play,
  each firing plays a bare pulse time-scaled exactly by the revs, and the sum goes through the vehicle's fixed filter.
- A physical description per vehicle drives it: cylinders, strokes, firing intervals, displacement, exhaust length (quarter-wave
  resonances), silencer, bonnet or cab, listening position. Some is on the specs already (`pipeLength`, `mufflerFreqA`) but only
  the synth mode reads it.
- The filter starts from the recording's own and is shifted by the description, so shared-bank vehicles differ for a reason.
- Fitted, not guessed: build revs from idle for the banks that have real rev recordings (the Mini recording in `engine-bank-fiesta` to about 4.4k, green to
  5.8k, yellow and the two-strokes higher, UTV to 3.7k), score against the real revs (tone, note clarity, loudness rise), fit a
  few global constants there, apply them to all.
- A new `engineSound` mode beside `pulse` until every vehicle has moved. The filter's coefficients go in the bank index; the
  residual is worked out at load, so no new audio files.

Asked: 1. prototype on the banks with real revs first (recommended); 2. start the filter from each recording (recommended);
3. listen only to the T185 section for now and park the others (recommended). Jamie: yes to all three; the T185 is fixed.

### Prototype result (2026-11-15): the source-filter model doesn't earn its place

Built in the scratch worklet (`model.mjs` analysis, resonances fitted per firing so the idle's rhythm stays out of them;
band-limited bare pulses; `fit.mjs`, `trend.mjs`, `cycle.mjs` score it).

- Against the same engine's real revs (six banks, `fit.mjs`): tone 3.35 dB off at best against 3.81 as now; within the noise of
  clips 0.1 to 2 s long, and the cars' real revs only reach 1.9k (Griffin) and 4.1k (Finch).
- Against how real revs of each type change (nine long rev recordings, `trend.mjs`): the best model 2.96 dB against 3.03 as now.
  Full compression (follow 1, what the physics says) scores worse; the fit prefers little.
- **Real tone changes only 1 to 4 dB across the range.** As now is about right on singles and diesels; anything that follows
  pitch overshoots, which is why "pitch beyond" can sound artificial.
- **The note is what differs.** Real four-stroke singles repeat at the firing rate at 0.3 to 0.6 (the quarry quad rising 0.23 to
  0.61); ours 0 to 0.3. Two-strokes 0.1 to 0.55; diesels 0.1 to 0.6. Steady 0.85 overshoots to about 0.9 (why it sounded
  artificial on the Farm 300); steady 0.3 to 0.5 lands in the real range.
- **Real fours repeat by the cycle, not the firing:** their cylinders differ (the Mini firing -0.42 / cycle 0.45; the TDi -0.41 /
  0.33). Ours are too even (0.5 to 0.97 at both), most of all the Griffin (0.95+ against a real 0.1 to 0.4).
- Caveats: the note measure is noisy (about ±0.15 between neighbouring steps); nothing real above about 5.8k for four-strokes.

Jamie (2026-11-15): 1. drop the source-filter rebuild; 2. prototype the per-type rule, fitted to the real revs, then on the
page; 3. park the shared-bank voices for now.

Proposed instead: a rule per engine type from its description (strokes, cylinders, fuel), fitted to the real rev recordings of
that type: how alike successive firings are (steadiness), and for multi-cylinder engines each cylinder keeping its own character
so the sound repeats by the cycle. Distinct voices for the shared bank stay an ear-judged question (nothing to fit them to).

## Prototyped, waiting on Jamie's ears (page sections, prototype worklet `tools/engine-review/prototype/engineWorklet.js`)

- The Finch and Griffin built from idle (ladder, revving, driving).
- Pitch beyond for the singles: 0.5, 0.35, 0.35 varied (±3% rate a firing), 0.5 varied with a little steady (0.3); Farm 300 and
  Bruin.
- Steady at speed on the Vauclair, tractor and Tor, and the Yak and Crag driving.
- New voices for the five on `engine-bank`: Ursa on the unused third machine 8% slower and softer; Bruin 15% slower with a low
  drone; Shepherd 18% faster and brighter; Clipper on the third machine 12% slower and muffled. New settings in the scratch
  worklet: `pulseRate`, `pulseRateJitter`, `pulseSplit`, `pulseSteady`, `pulseHighFollow`.

### Fitting the per-type rule (`calibrate.mjs`, results in `calibrated.json`)

Scored on how the built revs repeat against real rev recordings of the type (by the firing, and by the cycle for several
cylinders), five rpms per recording, two seeds. Tone change shown as a guard; it barely moves with any of these.

- **Four-stroke singles** (the ATV and quarry recordings in `engine-bank`, the trail-bike recording; built from the Farm 300's and RB300's idle): steady 0.2 to 0.3. Note error
  0.220 as now, 0.148 fitted. Tone unchanged (2.9 dB).
- **Two-stroke singles** (Derbi, dirt bike; from the TZ65's and Adder's idle): steady 0.2 to 0.4. 0.193 as now, 0.143 fitted.
- **Fours and multi-cylinder diesels:** the first grid barely helped (petrol 0.556 to 0.516, diesels 0.230 to 0.218) and its
  best sat at the edge; ours stay far too even. The engine model's own timing jitter is only 0.18 x roughness (about ±1% on a
  car), so the game's cars are as even as the test. Added per-cylinder spread (strength, timing) and per-firing variation
  (`pulseFireJitter`, `pulseStrengthJitter`: how unevenly the mixture burns, a carb more than injection) to the scratch
  worklet, and refitting over a wider grid.
- **Refit with the wider grid:** petrol fours 0.555 as now, 0.459 fitted (steady 0.3, cylinders 8 dB and 0.1 of a period apart,
  each firing up to 0.1 late and ±30% in strength), tone closer too (3.47 to 2.93 dB), still at the grid's edge. Diesels barely
  move (0.230 to 0.215: steady 0.3, small spread).
- **Real fours differ from each other more than from ours:** the Fiesta's own drive recording runs evenly (0.8 to 0.88 at the
  firing), the Mini and the Carlton are lumpy (-0.4 to 0.5). That is engine character, not noise: one value per "petrol four"
  is the wrong level. A car is fitted to its own engine's revs where it has them (Finch, Griffin); the per-type fit is the
  fallback. This is where carb against injection (and engine families) will sit: how uneven the cylinders and firings are.
- **Each car on its own engine's revs:** the Finch needs nothing beyond cutting its cycles into firings (note error 0.054 with
  every setting at 0, 0.050 fitted), so its own recording (the Fiesta's) runs evenly. The Griffin fits lumpy (no steadiness, 8 dB and 0.1 between
  cylinders, firing variation 0.1 and ±30%), 0.597 to 0.435, still at the grid's edge; its Carlton recording is the roughest.
- **On the page (version 4), waiting on Jamie's ears:** "One rule per engine type": as now and fitted ladders, revving and
  fitted driving for the Farm 300, RB300, TZ65, Adder, Yak, Crag, Vauclair, Finch, Griffin and Tor. The Vauclair takes the diesel
  fit cut into four, the Tor the fit across all fours (its grains are already one per firing, and it keeps its odd
  `pulseDivide: 3`).
- **Jamie on version 4 (2026-11-15):** quads and bikes work very well: revs consistent, everything sounds correct. Diesels
  completely broken, cutting out even at idle (the old idles were right enough). Griffin almost there, a few too many pops as it
  revs, but boomy as it should be and probably suitable. Tor cuts out and sounds broken like the diesels. And at the very top of
  the revs every engine just gets faster: it needs the change in pitch (or resonance) a real engine has as the revs climb.
- **Why the diesels and Tor broke** (`gaps.mjs` counts dropouts and clicks, `isolate.mjs` switches each piece on alone):
  1. The Yak's and Crag's engine models say one cylinder, so cut into firings they fired once a cycle and played a third or a
     quarter of it: silence the rest (the Crag's ladder 149 dropouts). Fixed by giving the engine its real cylinders (Yak 3,
     Crag 4): no dropouts. In the game this is a spec change (`engine.cylinders`), with the misfire and roughness sharing that
     follows from it.
  2. A late firing released the one before it at once, leaving a gap: the release now waits for it.
  3. The cylinder spread (8 dB) clicks where firings of very different strength meet (three to four times the clicks); the note
     score couldn't hear that. The fit now rejects any setting with half as many clicks again as today's.
  4. The spread is off at idle, where the recording has its own engine's unevenness, and comes in by twice the idle.
  5. The Tor keeps its own settings (a beat every third firing, slowed, as Jamie chose for the too-quick idle of the Jeep recording) and only
     takes the fitted steadiness. It wants a better-matched idle recording one day (with the CC0 hunt).
- **Refit with the click guard (a quarter as many clicks again as today's at most) and steadiness-only options:**
  - Diesels: steadiness makes them less like real diesel revs (note error 0.230 with none, 0.251 at 0.3, 0.281 at 0.6, 0.362 at
    0.85: real diesel revs are rough firing to firing). The diesel fix is the true cylinders and the cut into firings, nothing
    else. Jamie liked steady 0.85 by ear before the cylinder fix; his ear decides.
  - Finch: steady 0.3 only, note error 0.044 (0.054 with none), no clicks.
  - Griffin: steady 0, cylinders 4 dB and 0.2 of a period apart, firing variation 0.1 and ±30%; note error 0.458 (0.597 as
    now), clicks 6675 against 5765 (the unguarded 8 dB pick had 9776: the pops Jamie heard).
  - Petrol four (the Tor's fallback, not used now it keeps its own): cylinders 4 dB and 0.2 apart, variation 0.1 and ±30%.
- **Version 5 on the page:** the mended fitted section (no dropouts in any fitted clip) and "The top of the revs".
- **Jamie on version 6 (2026-11-15):** 1. the diesels' fitted version (true cylinders, cut into firings, nothing else) is
  right; 2. the Tor is good (its own settings plus the fitted steadiness); 3. the Griffin is a lot better but has ticking under
  it; 4. at the top of the revs, the shorter pulses from half way up. Asked what physics says should work.
- **The Griffin's ticking** (`ticks.mjs`: bursts above 2.5 kHz five times the 20 ms around them; the earlier click count only
  caught steep low-frequency waveform, so it was the wrong measure for this):
  1. Even cuts land on the Carlton's bangs (the level at the cut is 0.88 of the firing's RMS, the Fiesta's 0.39), so every firing
     started abruptly. Cuts now go at the quietest millisecond within a quarter of a firing of each even point (`cuts.mjs`
     measures it), which also keeps the recording's own cylinder spacing. Applied to every cut engine; the diesels, Tor and
     Finch measured no worse.
  2. The Griffin's level (recVolume 1.1, the loudest) drove the soft clipper (1.6% of samples fitted, 15.7% as now): 3 dB less
     (about the Finch's 0.8) keeps it out.
  3. What is left (about 0.6 to 0.9 a second at 2,000 to 3,000 rpm, against 2.4 as now) comes with the Carlton recording,
     whatever the settings: accept until the CC0 replacement, and check that with `ticks.mjs` when it is chosen.
- **Physics of the top:** the pulse shortens with the revs everywhere, but it is only heard once firings run into each other:
  when the gap between firings is no longer than a firing's main burst (80% of its energy). Measured per recording: Farm 300
  53% of its top (why half way suited it), RB300 75%, two-strokes about 31%, cars and Crag about 24%, Yak 44%. The rule with
  nothing to tune, "burst fits the gap" (`pulseBurst`, measured on the bare pulses): below that point a firing plays as
  recorded, above it its burst shortens just enough to fit the gap, resonances fixed. Both shortened versions measure more
  ticks on the Griffin (3.2 to 3.8 a second) and TZ65 (4.5 to 11.5, perhaps its rasp at 160 firings a second).
- **Version 7:** 1. the Griffin's ticking; 2. the half-way pick against burst fits the gap. Diesels and Tor moved to done
  (re-rendered with the quiet cuts).
- **The top of the revs** (nothing real above about 5.8k to fit): page section with the pulse shortening towards the top, resonances
  kept (the source-filter model's one useful part) or moving (plain), and the model's pulse shortening from idle.
- **The Yak and Crag have the cars' fault:** their idle grains are whole cycles of a three- and a four-cylinder diesel, but the
  specs say one cylinder, so above idle each cycle is cut short and its later firings are lost. Cut into firings in the fit.

## Later, the reason to get this right

- **The cars need CC0 recordings** (done in #858) in place of the BBC ones (`engine-bank-fiesta`, `-corsa`, `-309`: RemArc licence, ASSETS.md).
  The per-type rule should make that easier: an idle recording of the right kind of engine is enough if the revs are built from
  it.
- **Engine characters from the same source material:** fuel injection against carburettor (an injected engine fires evenly
  cylinder to cylinder and cycle to cycle; a carbed one is lumpier), tappety engines (the model already has valve ticks,
  `valveLoose`), and so on. These are settings on the same rule, not new recordings.

## Still to look at

- Whether the Plover's usual tone sounds right.
- If the adjusted voices aren't distinct enough: new CC0 recordings for some of the quads and bikes (Freesound, see the
  freesound-shopping memory).

## Filed (2026-11-15)

Jamie said yes to all, as recommended. All in Alongside, each passing `tools/issueLint.mjs`:

- #851 Keep the engine review's tools and findings in the repo (🔜 next: everything else points at it)
- #852 Stop the T185 whining now and then at idle (after #851)
- #853 Let the cars and the diesels fire every cylinder as they rev (after #851)
- #854 Make the quads and bikes rev with a note you can follow, and the cars with uneven cylinders (after #853)
- #855 Make engines rise in pitch at the top of the revs (after #854)
- #856 Fail the tests when an engine cuts out, ticks or stops rising (after #855)
- #857 Shortlist CC0 recordings for the cars and the Tor (after #855)
- #858 Give the cars and the Tor the CC0 recordings Jamie picked (after #857 and #856)
- #859 Settle what kind of engine each vehicle has (❓, after #854 and #855)

#310 (the Finch and the Griffin sound bad revving) closed as folded into #853 to #855.
