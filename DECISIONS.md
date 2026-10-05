# Decisions

A running log of choices made while building this, so later work starts from the same assumptions.

## Working agreement (2026-10-04)

- Built autonomously from the original brief. All later work on this project is autonomous too.
- Audio started procedural-only per the brief. CC0 audio files are allowed as a fallback if the AudioWorklet synth isn't good enough.
- Local git repo on `main`, no remote.
- NPC code lives under `src/npc/` as a generic NPC behaviour state machine with a `Companion` built on it. The in-game label follows the brief.

## Stack

- Three.js + Vite, plain ES modules. Rapier (`@dimforge/rapier3d-compat`) for physics. lil-gui for tuning. Vitest for the engine tests.
- Fixed 60 Hz physics step with render interpolation for the bike and the walking player, so high refresh rate displays don't judder.
- Y is up. The quad's local forward axis is +Z.

## Assets

- No CC0 quad bike exists on Poly Pizza, Kenney or Quaternius (only CC-BY motorbikes and buggies), so the quad is built from primitives in `src/vehicle/quadModel.js` with named parts.
- Companion character: Quaternius "Animated Woman" (CC0). It ships Idle, Walking, Sitting and SitIdle clips, so no procedural sit pose was needed. The legs are spread procedurally on top of SitIdle so she straddles the pillion seat instead of sitting side-saddle.
- The only CC0 "hay" model is a sheaf, not a bale, so round bales (straw and black-wrapped silage) are built in code. Same for the five-bar field gate.

## Engine and drivetrain tuning

- Mixture is the single idea behind the engine: `choke enrichment - enrichment needed at this temperature`. Catch chance, idle, roughness, power and plug fouling all derive from it. Opening the throttle dilutes the choke a little, so cranking with the throttle open clears a flood.
- A stalled-from-flooding engine keeps its fouling and dries out slowly, so it's hard to restart straight away. Choke off and throttle open while cranking is the cure.
- The drivetrain is an automatic: centrifugal clutch into a CVT. Braking drags on the engine only while the drivetrain is "coupled" (the clutch has locked with the bike moving). Coupling releases when the bike nearly stops.
- Tuned so a hard stop from about 20 mph or more stalls a stone-cold engine on choke, gentler or slower stops don't, and a warm engine never stalls from braking. Checked with a seeded headless sim across 40 seeds.
- Warm idle lowered to 1150 rpm (feedback, 2026-10-04). That needed the stall threshold dropped to 350 rpm and braking drag reduced, because a single misfire costs about 140 rpm and a warm engine under braking load must stay clear of the stall line by more than that.
- Drive force keeps a floor of 40% even when engine power is low, so a cold bike is sluggish but rideable.
- The quad never rolls over in normal riding: the Rapier vehicle slides before it tips. There's a "right the quad" action (T when riding, or E when looking at a tipped quad) in case it does.

## Interaction and NPC

- Interaction targets are invisible proxy meshes. A direct ray hit wins; otherwise anything whose bounds come within 8 degrees of the view direction counts. Without that, standing upright next to the quad, your eye line passes over it and you'd have to look down to get a prompt.
- The companion's walking is direct-path with ray probes at knee height for steering: if the way ahead is blocked she tries angles either side, sticking to one side for a moment so she doesn't dither. If she makes no progress for 5 seconds she ignores obstacles and pushes through. Checked routing round the barn.
- She's parented to the quad's pillion anchor while seated, which sits inside the vibrating body group, so she shakes with the bike for free. Her spine also gets a small sway from the vibration output.
- Hedges don't cast shadows. Hundreds of instances made the shadow pass the biggest single cost.

## Verification

- Engine behaviour is covered by Vitest (`tests/engine.test.js`), checked across 100 seeds for flakiness.
- The rest was checked in headless Chrome via puppeteer during development: a full autopilot lap with her on the pillion (no tipping, no stalls), a cold start through real key and wheel events, mounting and dismounting, the menu, and audio pulse rate against rpm via an analyser node. These scripts were throwaway and aren't in the repo.
- `?cam=x,y,z,yawDeg,pitchDeg` in the URL pins the camera for screenshots, and `window.game` is exposed in dev builds only.

## Engine audio, second pass (2026-10-04)

- Replaced per-pulse sample playback with an AudioWorklet synth (`src/audio/engineWorklet.js`). The old approach pitch-shifted one thump sample with rpm, which sounded like a sped-up recording at high revs.
- The new model: each firing pulse is a pressure kick (sharp blowdown, then falling flow for about a third of the cycle) into a delay-line exhaust pipe with an inverting open-end reflection, then two fixed silencer resonances and a load-dependent tone filter. Rising revs mean faster pulses through fixed resonances, as in a real engine.
- Pulses are scaled down as revs rise (`densityComp`) so overlapping pulses don't run away into clipping. Full throttle ends up about three times idle loudness.
- Every pulse varies a little in strength (`combustionJitter`) even when warm, to avoid a synthetic perfectly periodic buzz.
- Starter: the engine model now slows the crank before each compression stroke and surges after it. The worklet's starter is armature whine with commutator ripple, brush hiss and gear-mesh rattle, following that speed, plus a solenoid clunk.
- Tuned by rendering timelines offline (OfflineAudioContext in headless Chrome) and reading spectrograms, not by ear. Judging by ear is still to do.

## Smoke and outfit (2026-10-04)

- Exhaust smoke is a pooled point-sprite system with one puff per firing pulse, capped at 45 puffs a second; at high revs pulses merge into fewer, denser puffs. Puffs are kept above the terrain because point sprites depth-test at their centre, and big puffs half in the ground looked like stains. Proper soft particles would need a depth pre-pass; not worth it yet.
- The companion's outfit is data in `src/npc/outfit.js` (`OUTFITS`). The model's texture is a six-colour palette, so clothes are recoloured by swapping palette entries. The polo collar points and placket are placed by raycasting her skinned mesh to find the chest surface, then attached to the upper spine bone. The navy is lighter than true navy (#3a5690) because darker values read as black under the overcast lighting.

## Choke keys (2026-10-04)

- Choke moved from the mouse wheel to `Q` (more) and `Z` (less), 10% per press, repeating while held (after 0.35 s, then every 0.12 s). Keys are constants at the top of `src/vehicle/quad.js`. The mouse wheel is now only used for highlighting menu options.

## Recorded engine sound (2026-10-04)

- The synth still didn't sound real, so the default is now recorded: each firing pulse from the engine model plays one recorded pulse ("grain"). The synth stays selectable in the tuning panel for comparison.
- Chose per-pulse grains over steady-rpm loops so the engine model's lumpy idle, misfires and stalls still come through, in sync with vibration and smoke.
- Sources are CC0 Freesound recordings (see ASSETS.md). The main quad recording idles at about 11.5 pulses a second, so it's a four-stroke single at roughly 1,350 rpm, the same engine type the model simulates. Its revs are blips without a steady rhythm, so pulses above 1,500 rpm come from a second recording with a clean rev sweep. Rising-rev pulses play with the throttle open, falling-rev pulses with it closed.
- The second machine is level-matched to the first using both recordings' idle pulses, and the two are blended across 1,500 to 2,100 rpm.
- The starter's chug in the recording is irregular, so cranking is an engage sound followed by a crossfaded loop whose speed follows the cranking speed, rather than one grain per compression stroke.
- Cutting is done offline by `tools/slice_engine_audio.py` into one WAV plus a JSON index. WAV rather than MP3 so browser MP3 decoder delay can't shift the cut points.
- Using Freesound's MP3 previews for now; the original WAVs need a Freesound login.
- Choppiness fix: the first cut placed each cut a fixed 4 ms before the next thump's peak, but the attack starts earlier, so most grains ended with a scrap of the next thump. The slicer now finds each attack's start and cuts at the quietest zero crossing just before it, and rejects grains with an odd length or a loud tail (about a third of them). At playback each grain carries a few milliseconds of overlap and crossfades into the next, and every pulse carries its own cycle length from the engine model so its grain is stretched to fit exactly, which closes the gaps a rough idle used to leave.

## Companion polish and roadside controls (2026-10-04)

- She's 1.5 m tall now (was 1.66 m).
- Collar and wellies are fitted to her body instead of sized by hand: `fittedShell` in `src/npc/outfit.js` casts rays in towards a bone's axis from all round, finds the surface, and builds a shell a few millimetres outside it. The collar uses the hit nearest the axis (so hair is ignored); the boots use the outermost hit with a short reach (so the jeans hem tucks inside, and the other leg isn't caught). Shells are built in the rest pose and parented to the bones.
- She glances at the player on a random timer (4 to 11 s apart, 1.5 to 3.5 s each), looks at you while you're talking to her, and doesn't bother while you're riding with her behind you. Head turns are split 40/60 between neck and head, layered after the animation.
- Seated on the quad she fidgets every 3 to 8 s: lifting an arm, leaning, stretching or looking out to the side. Standing, she occasionally leans or looks around, half as often. All are procedural bone offsets with ease in and out, so they work on top of any clip.
- While looking at the quad on foot, K, R, Q and Z work its ignition, starter and choke, and the engine status shows. The quad only listens while it's the focused interactable.
- The player no longer shoves the quad by walking into it. The character controller's impulses on dynamic bodies are off.
- Misfires no longer drop the sound out. A misfire's pulse now plays with its opening thump held down (25%) while the rest of the cycle plays at 70%, because a real misfire loses the bang but the engine keeps turning. Every pulse also runs 5% longer than its predicted cycle, so a late next pulse crossfades over it instead of leaving a gap. Warm idle now measures the same as the original recording for short dropouts (none).

## Second quad (2026-10-04)

- Quads are data: `src/vehicle/quadSpecs.js` lists each one's name, colour and parameter overrides, and `QuadUnit` builds the engine, bike, vibration, smoke and sound for it. Spawn points are `LAYOUT.spawn.quads`, in the same order. Adding another quad is a spec plus a spawn point.
- Red quad: the original tuning, Honda-style. Blue quad: Yamaha-style. It idles at 1,450 rpm warm (Yamaha's manual figure for its quads is 1,450 to 1,550), revs to 9,000, has a quicker throttle response, needs more choke cold, runs lumpier cold, warms in 120 s rather than 150 s, and is lighter and stronger. Its cold engine is weaker, which keeps the cold hard-braking stall (from about 18 mph) despite the faster revs; warm it never stalls from braking.
- The blue quad's recorded idle uses the rev-sweep machine's own idle pulses (`recIdleSource: 'rev'`), so it's one machine throughout and sounds different from the red.
- One AudioContext (`AudioHub`) with one worklet voice per quad. Master volume, mute, wind and latency are shared ("Sound" in the panel); everything else is per quad.
- Paint and headlight lens materials are per quad; other materials are shared.
- She can be asked onto either quad. If she's seated on one and asked onto the other, she gets off and walks over. Menu options are per quad, nearest first.
- The HUD status and the panel's live readouts follow the quad you're riding, else the one you're looking at, else the last one you used.

## Fuel, speedos and dashes (2026-10-04)

- Fuel is modelled as tank, tap and carburettor float bowl (`src/vehicle/fuelSystem.js`, pure logic, tested). The engine is fed from the bowl; the bowl refills from the tank through the tap. Below half a bowl the engine model leans the mixture out, so running dry comes through as stumbling, misfires and power loss in the sound, shake and smoke before it stalls. That's about 6 s while riding and nearly a minute at idle. With an empty bowl it can't fire.
- Game-paced consumption: a full 12 litre tank lasts about 25 minutes flat out and roughly 12 hours at idle. It burns more on choke.
- Tap ON can't reach the last 2 litres (1.8 on the blue quad). RESERVE can. OFF shuts it. This gives the classic "it's coughing, flick to reserve" moment.
- Refuelling is a carried 20 litre jerry can, poured at 0.5 L/s by holding E at a quad, and refilled from an endless petrol tank by the barn at 0.8 L/s. Interactables can now take a `hold(dt)` handler, and a prompt can be plain text (`{ text }`) when E does nothing.
- You can't ride while holding the can: E pours while you're holding it, so put it down with G first. Carrying it on the rack was left out to keep this simple.
- Dashes have two styles (`src/vehicle/dash.js`): classic (red: analogue rev counter, green LCD, separate lamps) and modern (blue: one amber LCD with a bar-graph tach, in an angular pod with a visor). The LCD canvases only redraw when what they show changes. The speed reads 0 below about walking pace to stop it flickering at a standstill.

## Third quad: two-stroke sport (2026-10-04)

- Automatic like the others (a manual gearbox was judged too complex for now). No premix fuel yet.
- The engine model has a `strokes` setting: 2 fires every revolution. Pulse periods carry through to vibration, smoke and sound unchanged. Two-stroke character comes from a few new settings, all 0 for the four-strokes so they behave exactly as before: `skipChance` (alternate firings skipped at light throttle and low revs, the ring-ding), `idleFoulRate` (oily plugs load up at idle and throttle clears them), and on the drivetrain `powerbandRpm` / `torqueBelowBand` (weak low down, then on the pipe).
- Its idle is 1,800 rpm rather than Yamaha's 1,500 for the Blaster, because the recorded two-stroke idles around 2,200 and stretching its pulses much further slows the sound unnaturally.
- It rarely stalls under hard braking, even cold: its high idle and quick revving pull it through the braking drag. Weakening its cold engine enough to force a stall made it miserable to ride from cold, so that's left as part of its character.
- Sound: a second pulse bank (`engine-bank-2t`) cut from a two-stroke motocross bike's idle and a Honda CRM250 pulling away and backing off. The slicer now takes a bank name and named sources, and normalises every bank so idle pulses sit at the same loudness. A grain's "rpm" is defined as 120 / pulse period for every engine type, which is what the runtime matches on, so two-strokes need no special case in grain picking. The hub loads both banks and each quad picks one with `recBank`.
- Models: `buildQuadModel` takes a `style`: 'utility' (red, as before), 'utility2' (blue: brush guard, square lamps, railed racks, rounded tank, grey seat, flatter fenders) and 'sport' (yellow: sloped nose with number plate, small lamps, bumper, sharp fenders, no racks, long single seat with tail, nerf bars and pegs, expansion chamber with a high silencer, upright finned cylinder, motocross bars with a crossbar ahead of the dash, wider rear tyres).
- The sport quad is a single-seater: no pillion seat or anchor, so she isn't offered it (`quad.hasPillion`).
- Its smoke is denser and blue-tinted (a new `tint` smoke setting) for two-stroke oil.

## Start state and the yellow pillion (2026-10-04)

- Fuel taps start OFF (`startTap`). The float bowl starts full, so a quad started with the tap off runs for a few seconds, then stumbles and stalls: flicking it ON is part of starting up.
- Each game the quads are shuffled between the yard's parking slots and nudged by up to 1.2 m and 20 degrees, keeping at least 2.8 m between them. The jerry can is left at one of five likely spots (petrol tank, barn doors, paddock, silage bales, field gate) with a small shift. The seed is printed in the console and `?seed=N` repeats a layout. The player starts facing the quad she's standing by.
- The yellow sport quad now takes a passenger after all: a slim pad at the back of its long seat with a grab strap. It's a tight fit, which is the point.

## Four-stroke revving, second pass (2026-10-04)

- Revving sounded strange while idle was fine. The causes: only 18 usable rising-rev pulses from a short ATV clip (2,700 to 5,200 rpm), so revving cycled the same few and over-stretched them; a hard switch between rising and falling pulses at 25% throttle; single-firing grains at high revs, meaning a join every 15 to 20 ms; and big loudness differences between grains.
- Revs for both four-strokes now come from a CC0 Honda CRF250 recording (a four-stroke single) riding off and backing off: 235 rising and 80 falling pulses, 2,000 to 7,000 rpm, plus its idle as a bridge. The ATV clip now only provides the blue quad's idle. The slicer's level matching takes a list of source pairs.
- At higher revs a grain spans several consecutive recorded firings (at least `recMinGrainMs`, 32 ms), linked through the bank's recording order, and the following pulses on that layer are covered by it.
- Whether a pulse comes from the rising or falling set is now a probability that slides with throttle, not a threshold.
- Each grain's loudness is pulled halfway towards its kind's median (`recLevelling`), cutting pulse-to-pulse loudness wobble at full throttle by about a fifth. The rev layer has its own gain (`recRevGain`, 0.75 for the four-strokes) because the CRF250 was recorded under load.

## Tap-off timing and idle variation (2026-10-04)

- With the tap OFF a quad ran for nearly three minutes at idle on what was in the float bowl. The bowl is now 12 ml instead of 40, idle burns a bit more (45% of full-throttle consumption per revolution rather than 25%), and starvation starts at 65% of a bowl rather than 50%. Tap off: a warm idle stumbles from about 10 s and dies at about 30 s; on choke it dies at about 20 s. Running dry on the move gives 2 to 3 s of stumbling before it dies, shorter than before. That's the trade-off.
- Each game every quad's warm idle shifts by up to 450 rpm either way (seeded, so `?seed=N` repeats it), never below 70% of its spec idle. `applyIdleOffset` scales the stall point and braking drag with the idle, so the margins stay the same, and raises the clutch bite point if needed so a high idler doesn't creep. Simulated at both extremes for all three quads: no warm stalls, no creep, and warm braking never stalls. Low idlers are a bit less likely to stall from cold braking. The chosen idles are printed in the console.

## Two-stroke revving, second pass (2026-10-04)

- Same diagnosis as the four-strokes: 14 rising and 32 falling pulses, stretched up to 1.5 times at high revs. Added a second CC0 two-stroke dirt bike recording that reaches about 9,000 rpm, and more CRM250 sections: now 574 rising and 319 falling pulses, 2,600 to 10,000 rpm. Period limits are tight per section, from rpm tracking, so the tracker can't lock onto double or half the firing rate. Rev sections from these noisy riding recordings get a looser quality check (`revTail`, `revOdd`). The second bike has no idle, so it's level-matched to the CRM250 on rev pulses: level pairs can now name the base source.
- The slicer used to throw out pulses that failed its checks, which broke the recordings into runs of 1 or 2 pulses. Now every pulse stays in the chain and failures are marked `ok: false`: playback can read straight through them but never starts a grain on one.
- Playback follows the recording: if the pulse after the last one played is within 8% of the needed rpm (`recFollow`), it carries on with that instead of picking afresh. Crossfades lengthen to up to 7 ms at higher revs.
- Measured against the raw recordings with a broadband click count: two-stroke joins went from about 14 extra clicks a second to within the raw recordings' own range; the four-strokes match their raw recording. Pulse-to-pulse loudness varies a bit more than before, because playback now carries the recordings' natural swells.
- Idle variation reworked (feedback: too subtle). It was a uniform shift of up to ±450 rpm, so the typical shift was only about 225, and a floor at 70% of the spec idle clipped the red. Each spec now has an explicit `idleRange: [min, max]`, picked evenly by seed: red 650 to 1,650, blue 950 to 1,950, yellow 1,300 to 2,300 (about ±500). The minimums are the lowest that simulate safely: at 600 the red occasionally stalls warm under hard braking. The warm idle is shown in the status panel. Recorded grains can now stretch to 1.8 times (rate 0.55) so very low idles don't leave gaps.

## Four-stroke revving, third pass (2026-10-04)

- Feedback: four-stroke revving still didn't sound right. The CRF250 is a high-revving dirt bike ridden through a gearbox, and it sounded like one: bright and buzzy, a different machine from the quad at idle.
- Revs for both four-strokes now come from two CC0 recordings of ATVs being ridden: the same ATV as the blue idle driving away (2,500 to 4,800 rpm), and another ATV riding round a quarry (3,000 to 5,500 rpm). That's the sound of a quad working through a CVT, which sits at 4,000 to 5,500 rpm under load rather than sweeping through gears. 601 rising and 218 falling pulses. The CRF250 is no longer used.
- Both were recorded from the side of the track, so their loudness follows distance from the microphone (a tenfold swing in places). The slicer's `flatten` option rescales each riding segment so its loudness follows rpm instead, about as steeply as the CRF250's did, smoothed over 0.3 s so pulse-to-pulse variation stays. Boosts are capped so a quiet stretch can't become a roar, and two stretches that stayed erratic were left out.
- The four-stroke bank also rejects pulses whose length falls outside the segment's period limits (`periodCheck`): the quarry recording is noisy enough for the tracker to slip. It's off for the two-stroke bank, where it would thin out the top end.
- Offline renders against the CRF250 bank: similar loudness at each throttle, no gaps, fewer broadband clicks (14 a second at full throttle against 58), steadier loudness, clean harmonics at full throttle where the CRF250 smeared, and much less energy above 2 kHz.
- The engine model still revs to 8,500 (red) and 9,000 (blue) at full throttle. The recordings top out around 5,500, so up there grains are played up to 1.5 times faster.
- Recorded grains can now stretch to 2.2 times (rate 0.45, was 0.55). At a yellow idle of 900 rpm its idle grains needed more than 1.8 times and left gaps (about 4% of the time silent); at 0.45 there are none. Simulated at 900: no warm stalls, no creep, no braking stalls.

## Rev limits, roughness and fuel variation (2026-10-04)

- The red and blue quads went straight to 8,500 and 9,000 rpm at full throttle. Real CVT quads hold their revs much lower under load (the ATV recordings sit at 4,000 to 5,500), and the recorded revs had to be sped up by as much as 1.5 times up there. Full throttle now holds 6,200 on the red (redline 5,800) and 6,800 on the blue (redline 6,400). The yellow two-stroke is unchanged.
- The drivetrain's torque curve now runs against each engine's own top rpm rather than a fixed 8,500, so drive force at full throttle is unchanged. Fuel burn per revolution is up by the same ratio (8,500 / 6,200) with the idle fraction cut to match, so a tank lasts the same flat out and the tap-off timing at idle is unchanged. The yellow keeps its old idle fraction.
- Each game every quad's warm roughness (`roughnessRange`, applied to `baseRoughness`) and starting fuel (`fuelRange`, litres) are picked from ranges in its spec, from the same seed, after the idles, so a seed keeps its idles. `idleVariation.js` became `quadVariation.js`. Simulated at the roughness extremes with the idle extremes: no warm stalls or creep. The red at 650 rpm stalls under hard warm braking 1 to 3% of the time, about the same as with the old rev limit; at 700 it doesn't. Seeds now give different jerry can spots from before.

## More smoke, wider spawns (2026-10-04)

- Feedback: more smoke on all of them. Every density is up by roughly half (warm haze more than doubled, from 0.04 to 0.09), with puffs living up to 4 s and growing to 1.9 m. The blue's and yellow's own overrides went up in step.
- Feedback: starting positions more random, sometimes further away. Yard nudges are now up to 2.5 m and 45 degrees, with a quarter of quads parked the other way round. One quad, picked at random, is hers: always in the yard, and she starts beside it. Each of the others has a 40% chance of being left at one of seven spots round the farm instead, at any angle. Checked over 40 seeds: every quad settles upright within 0.6 m of where it was put. The spots are 5 to 35 m from the track centre line on slopes of 10% or less.

## Her voice (2026-10-04)

- Request: make her talk, British, lines like "this is a bit rough", "careful", "oh this is fun", plus idle sounds and sighs.
- There are no CC0 recordings of lines like these, and voice files generated with a text-to-speech service wouldn't be CC0. So her words use the browser's speech synthesis at runtime, preferring the most natural British woman's voice installed (Google UK English Female, Edge's Sonia or Libby, then Serena, Kate, Flo, Shelley and so on), and fall back to any British voice that isn't one of the known men's voices. Every line is captioned, so it still works where speech isn't available. Speech can't go through Web Audio, so it isn't positioned: its volume fades with distance instead, and it follows the master volume and mute.
- Non-verbal sounds are real CC0 recordings (eight sighs from four women, eight hmms, six laughs, a yawn, six hummed phrases, a gasp, a disappointed "oh"), cut and evened out by `tools/slice_companion_audio.py` and played from her head with HRTF panning.
- `Chatter` (pure, tested) decides whether she speaks: a quiet gap after every line, a cooldown per situation, a chance to bother, no line again until about half the others have been used, and a chattiness multiplier. Answers to you skip all of that. Reactions to something that just happened (a hard brake, a stall, finally catching) skip the quiet gap but wait for her to finish speaking.
- `CompanionVoice` watches the game and raises situations: speed, deceleration and vertical jolting while she's riding pillion; engine state changes and cranking time on quads near her, with a hint chosen from what's wrong; time spent waiting; the player riding off and coming back; pouring petrol near her; opening the menu.
- Checked headless with a scripted ride: she answered the request, said "It's cold, it'll want the choke." after 9 s of cold cranking, "Hooray." when it caught, and complained about the bumps on the ride. Her voice there was Flo (en-GB). Left standing for five simulated minutes at default chattiness she said or did something every 30 to 45 s: two lines, hums, sighs, a yawn.

## Engine sound from idle (2026-10-05)

- Feedback: acceleration still sounded very wrong on all of them; could the idle be extrapolated to high revs instead?
- Diagnosis: every rev sound so far came from a different machine than its idle, and played back faster or slower to fit each engine cycle. Resampling shifts the exhaust's resonances along with the firing rate, which a real engine doesn't do: its pipe and silencer resonate in the same place at any revs, and only the firings come quicker.
- New default engine sound, `pulse`: every firing plays a recorded idle firing at its own speed (`pulsePitchFollow` 0), cut off with a crossfade over 40% of a cycle when the next one fires. Below idle speed it's stretched as before. Each firing gets louder with revs, `(rpm / pulseRefRpm) ^ pulseRevLoudness`, capped at `pulseLoudnessCap`. An EQ that comes in with revs cuts the deep thump (low shelf at 160 Hz, up to -16 dB) and lifts the rasp (peak at 1.5 kHz, up to +8 dB), and a fixed 6 kHz low-pass tames the edges of the cut-off firings. `recorded` and `synth` are still selectable.
- Fitted against real engines rather than by ear: two recordings that each have an idle and revs from the same machine on the same microphone (the ATV behind the blue's idle, revving to 6,000 rpm, and the two-stroke motocross bike behind the yellow's idle, blipping to 3,700). For each, how the spectrum changes from idle to higher revs, in third-octave bands, compared with a render of the same quad held at the same revs. Average error, four-stroke: recorded mode 6.4 dB, pulse mode 3.4 dB. Two-stroke: recorded 8.2 dB, pulse 3.1 dB. Loudness now rises like the real engines too: +8, +12, +14 dB at 3,000, 4,500 and 6,000 rpm against the real +6, +10, +15 (four-stroke); recorded mode only managed +6, +8, +10.
- The same EQ settings fitted both engines. The yellow two-stroke needed its loudness to rise faster (`pulseRevLoudness` 1.1) and a lower cap (2) so it doesn't clip flat out at 10,500 rpm. Each quad has its own `pulseRefRpm` near its idle.
- Over a full rev range on all three: no gaps, fewer clicks than recorded mode on the red and yellow and about the same on the blue, and steadier loudness. A spectrogram shows continuous harmonics from idle to full revs, without the vertical streaks recorded mode's joins leave.

## Her voice, recorded (2026-10-05)

- Feedback: she often spoke with a man's voice. Browsers fall back to their default voice (Daniel, a man, on a British Mac) when the chosen voice isn't loaded yet or a network voice like Google UK English Female fails, and the old fallback only filtered by language.
- Options were: only allow known female browser voices (quality depends on what's installed), record lines with a Mac voice (Apple's licence makes that personal and non-commercial only, against the CC0 rule), or record them offline with Piper's "cori" British voice, trained on public-domain LibriVox recordings. Chose Piper.
- `tools/generate_companion_voice.py` reads every spoken line from `voiceLines.js` (through node), records it, trims and levels it, and packs them into `companion-voice.wav`/`.json` keyed by text. A few lines get adjusted text where Piper paused oddly at a comma. Measured pitch across all 70 lines: median 216 Hz, a woman's range. Lines play through Web Audio from her head, like her other sounds.
- A line not yet recorded falls back to the browser, but only with a voice from a list of women's voices, local ones first since network voices are the ones that fail; with none, she just shows the caption.

## Her figure (2026-10-05)

- Request: a slightly more hourglass shape with a big bust. Her body mesh (the Quaternius model) is reshaped once at load in its bind pose (`src/npc/figure.js`): a fuller, rounder bust, a narrower waist and wider hips, as smooth regions placed relative to her own skeleton, so they scale with her height and every animation (idle, walking, sitting, mounting) carries the shape without changes. It runs before the outfit is fitted, so the collar, placket and wellies follow the new body; the polo itself is part of the body's texture.
- Tunables `bust`, `waist` and `hips` in the Companion folder (0 is the original model, default 1, up to 2) reshape her and refit the clothes live. The model is low-poly with flat shading, so the shape is as round as its triangles allow.

## Quad bodywork, getting off at speed, ground jolts, more of her (2026-10-05)

Done in parallel by subagents in separate worktrees (bodywork, getting off at speed, her figure), merged into main.

- Bodywork: the quads are still entirely procedural, now built from moulded shapes: fender shells swept round each wheel, lofted seats, tanks and hoods, bent-tube racks and frames, lathed tyres with chunky lugs, real-looking rims, CV boots, coil-overs and engines. Each keeps its character (red: round lamps, racks, swingarm; blue: square lamps, brush guard, independent rear; yellow: number plate, nerf bars, expansion chamber, chain drive). Wishbones, swingarms and shocks are posed from the physics wheel heights every frame. Static parts are merged per material: about 36k to 46k triangles per quad (from about 10k) with fewer draw calls than before. All anchors (seat, pillion, camera, dash, wheels, exhaust tip) are where they were.
- Getting off at speed: above walking pace E is a jump to the outside of the turn (inside or behind if that's blocked) with a short stumble, and the quad carries on. A small PI cruise controller (`src/vehicle/cruise.js`, tested) holds the speed it had on the throttle only, starting from 40% of the throttle you had so it doesn't overshoot, and the bars stay where they were, so a held turn is a steady circle (about 6 m radius at 10 m/s). It lets go when it tips, the engine stops, or it's stuck below 30% of its target for 3 s, and then the parking brake takes over. You can get back on below 3 m/s. If she's on the back she shouts while it's driving itself and tells you what she thinks once it stops.
- Feedback: a riderless quad going round didn't shake. Engine shake fades at high revs (it's about 0.2 on the body-shake measure flat out, against 0.6 at a warm idle), and the terrain is too smooth at this scale to jolt it. The vibration model now adds jolts from the ground: one every 0.8 m or so on average, sized by speed, mostly small with the odd big one, into the same body, bars and head oscillators. At 9 m/s a riderless quad now measures about 1.0, like a cold idle. You feel it riding too.
- Her lines: about three times as many (around 300 spoken lines), plus new situations: gentle riding, a long ride together, you getting on in front of her, the odd warm word when you're stood together, the seat shaking hard (riding, or left sat on an idling quad; after 40 s of that she admits she quite likes it), and a favourite quad picked each game that she mentions once per ride. Body-shake level for her comments is `voiceShakeLevel` (0.95). All re-recorded with the cori voice.
- Agent test browsers spoke her lines out loud through the speakers while testing (the "muppet" heard without captions). Test scripts now stub speech synthesis.

## Shake, shouting, dashes (2026-10-05)

- Feedback: the shake had become more visible when riding, which should stay as it was; it's a quad driving itself that should visibly shake, and still didn't enough. Ground jolts now only apply with nobody on it, and much harder (`groundGain` 8): a riderless quad going round at 9 m/s measures about 2.6 on the body-shake measure (it was 0.2 without jolts; a warm idle is about 0.6). With you on it the vibration is exactly as before.
- Left on a quad driving itself, she now picks a mood each time: terrified, or loving it (`ghostFunChance` 0.4), each with its own lines while it goes and afterwards.
- Feedback: she should shout louder when you're further away. Every line gets louder with distance, `1 + 0.12` per metre beyond 4 m, up to 2.5 times, and situations marked `shout: true` (left behind, riding itself and its aftermath) are 1.6 times louder again, fade with distance at half the rate, and can be heard twice as far (50 m). A shout at 15 m comes out at about -5 dB against hearing her up close; it was about -21 dB.
- Dashes: all pods are now moulded rounded shapes (an extruded rounded outline with bevelled edges), with rounded LCD corners. The red quad's dash is three analogue dials in a pill-shaped pod: rev counter (now scaled to its 6,200 rpm instead of a fixed 10,000), speedo with a drum trip counter, and an E to F fuel gauge with a reserve zone and the tap position, with lamps set into the dials. Tried a curved hood over the blue's display, but it hid the rev bars from the seat, so it's a slim rounded brow instead.
- The voice generator caches each line's recording (`--cache`), so after editing lines only new or changed ones are recorded again.

## Her starting quads, her own mind, more smoke, parked creep (2026-10-05)

- Request: ask her to start a quad. `StartingAttempt` (`src/npc/startingAttempt.js`, pure, tested against the real engine and fuel models) is a novice's routine: key on, the tap if she remembers (75%), choke if it's cold (80%, and 15% when it's warm, which floods it), cranking in 2 to 4 s goes with pauses, remembering what she forgot between goes (55%), and giving up after four goes with the ignition off. Once it catches she eases the choke off as it warms, then hands it over. She holds the starter through `quad.helperStarter`. In tests she gets a cold quad going with the tap off most of the time but not always, and has it warm with the choke off in about two minutes. She talks herself through it, and her usual "have you tried the choke?" hints are muted while she's the one cranking.
- Request: when left idle for a while she should do things on her own, but stay on a quad once she's on one. After 55 to 90 s standing about (not seated, not being talked to) she picks: get on a quad within 40 m (35%), have a go at starting one (30%), or wander 6 to 18 m for a look round, saying what she's up to. Seated, she never gets bored off. `ownMind` turns it off.
- Feedback: still not enough smoke. Master opacity 1.4 (from 1.0), every density up by roughly a third to two thirds, puffs live up to 5 s and grow to 2.3 m, and the blue's and yellow's overrides in step.
- Found while testing: parked quads crept down the yard's 6 to 8% slopes at about 1.2 cm/s (a metre a minute), engine off, since the wider spawns. The raycast wheels' brakes don't fully hold, and neither more brake, more side grip nor body damping changed it. Now a parked quad (nobody driving, no throttle, nearly still) has its horizontal velocity cancelled each step once it's below `parkedHoldSpeed` (0.15 m/s); it still settles and bounces vertically. Measured: no drift at all over 35 s.
- Her lines are re-recorded with the cache: 376 lines, 57 new. The voice bank is 24 MB at 22 kHz.

## Ride sounds and Doppler (2026-10-05)

Six parallel agents this round (engine load, ride sounds and Doppler, mud, pillion body language, her driving, a toolbox), each in its own worktree, merged as they finish.

- Each quad's sound (engine, tyres, splashes, thuds) reaches the listener through its own delay line set to distance over the speed of sound, so Doppler comes from the travel time rather than a computed pitch factor. It shifts everything the quad makes, needs no change to the engine worklet, and measures +2.9% / -2.9% for a 10 m/s pass-by (textbook: +3.0 / -2.8), and +2.7 / -2.6% on a riderless quad circling at 9.4 m/s in game. The delay is smoothed (80 ms) and limited to a 40 m/s closing speed so getting on and off doesn't chirp. A low-pass falling with distance stands in for air absorption. Quads are now heard with their real travel time (about 29 ms at 10 m).
- Ride sounds: looped filtered noise through built-in Web Audio nodes for the continuous layers (rumble, grass, gravel grit, water churn), following speed and the surface under each wheel (grass, dirt, mud, water shares); synthesised knocks and rattles; five CC0 recordings for squelches, splashes and landing thuds. Knocks and landings come from the physics suspension. The terrain is too smooth for many physics knocks, so small knocks come per metre travelled, and on a riderless quad from the same ground jolts that shake it. Wind for the rider rises with speed. Levels: tyres on dirt at 10 m/s about 10 dB under the engine at full throttle. Not judged by ear; grit brightness, wind level and squelch density are the likeliest to want a nudge.
- Her voice doesn't go through the delay path, so it has no Doppler.

## Toolbox (2026-10-05)

- Request: a way to tweak the idle and other things with the engine off, maybe with a toolbox, and ideally make the quads a bit faster. A toolbox you carry to a switched-off quad opens a panel with five real adjustments: idle screw, carb mixture, throttle stop (the speed limiter), clutch springs and tyre pressures (`src/vehicle/tuneUp.js`, pure and tested; panel in `src/workshop/`).
- Every setting is applied from a snapshot of the quad as you first found it, so "Back to stock" is exact. Safe limits are in the logic: the idle never goes below the spec's safe minimum (a lean mixture's idle drop is wound back in on the screw), the clutch always bites at least 400 rpm above idle, and the idle can't go higher than the stiffest clutch can clear.
- Limiter fully off: about +20% top speed (red 35 to 42 mph, blue 38 to 45, yellow 41 to 50), a few hundred more rpm flat out, about 7% more fuel per km. Two clicks lean: red 0 to 20 mph 2.2 to 2.0 s and about 11% less fuel, a little rougher. Checked: no stalls from five hard stops at the lowest idle, leanest mixture and softest clutch on any quad, no creep at the highest idle with the softest clutch.
- Mixture is a new engine param, `mixtureTrim`, so lean and rich running come from the existing engine, smoke and fouling models, with small drive, fuel and warm-up effects on top. Three clicks rich slowly fouls the plug (a stall after roughly 14 minutes' running); the panel says so.
- She reacts when you tinker, take the limiter off, put it back to stock, or ride her on a de-restricted quad faster than it used to go.

## Engine load (2026-10-05)

- `src/vehicle/engineLoad.js` measures each physics step how much of the engine's effort goes into resistance (hills, mud, obstacles): the force the tyres put down minus mass times measured acceleration. While pulling away in the CVT's lowest ratio, the effort of getting moving counts too. Grip comes from each tyre's suspension force (less in mud); asking for more spins the wheels, which drops the load. Rapier's vehicle never actually skids at these settings, so wheelspin only exists in the engine.
- The engine pulls its target revs toward idle in proportion to load, so a warm engine sags at most halfway and can't stall from load. A weak (cold, choked) engine under a heavy climbing load is dragged below idle and stalls: stone cold on choke it stalls pulling away up the 11 degree yard bank; from about a third warm it labours but keeps going. Warm, 6 seeds x 3 quads x 90 s of track riding gave no stalls.
- Drive force still comes from the revs the engine is trying for, so the bike goes exactly as before (same speeds at the same times on the flat and on a 20 degree ramp); only sound and feel change. Red flat out now cruises at about 5,700 rpm, climbing 4,400 to 5,000 (the ATV recordings sit at 4,000 to 5,500), and the climbing sound is measurably deeper.
- Throttle shut with the clutch coupled to a rolling bike, the wheels hold the engine above idle (70 rpm per m/s) and half the engine braking carries on; before, engine braking vanished 0.2 s after closing the throttle. `overrunBrake` 0 restores the old coast.
- Cruising lower made a tank last 15 to 20% longer, so fuel per revolution went up 12% and the idle fraction down by the same factor: tank life is back to about 25 minutes of riding and idle burn (tap-off timing) is unchanged.

## Pillion body language, and a braking bug (2026-10-05)

- Riding pillion, her body language is a posing layer (`src/npc/pillionPose.js`) on top of the sitting clip, so the clips and the seated state are unchanged. Her hands are placed with two-bone IK (`armIK.js`) onto grip points: round your waist when you're in front (within 1 to 3 cm of the target), the rails on the utilities, the yellow's strap only when it's moving (her thighs when it's parked). Leaning, tucking, the braking lurch and bumps come from damped springs driven by the quad's own acceleration (`pillionDynamics.js`, tested): she leans up to 0.3 rad in a hard turn and about 0.35 rad forward under hard braking, lagging the bike slightly and settling rather than snapping.
- Look back: hold C or the middle mouse button; the view turns 205 degrees over your shoulder in 0.35 s with the eye moved out over the shoulder, and she sits up and looks at you.
- Bug found while testing: after the engine-load merge, hard braking only managed about 1 m/s2 (it was about 10). Rapier's raycast vehicle ignores a wheel's brake whenever that wheel has any engine force, and the new overrun engine braking left a small negative drive force on. Drive force is now zeroed whenever the brake is above rolling resistance: braking is back to 9.5 to 10 m/s2.
- Known: there's no rider body, so from outside her hug clasps an empty seat; from the rider's view it works.

## Mud (2026-10-05)

- Mud had a `mudAt` hook but made little difference: Rapier's raycast wheels count only half the drive force against grip and four wheels shared it, so tyres never lost traction; mud only cut cornering grip and puddles were plain mud. Now grip goes from 2.2 on grass to 0.7 on the track and 0.42 in puddles (new `puddleAt`), multiplied by tyre pressure.
- `src/vehicle/traction.js` (pure, tested) limits drive force to what the tyres can take. Driven wheels are treated as locked together and spin up together when you ask for more, losing some drive and a little sideways grip (15%; 35% made the yellow loop off at 11 m/s). The engine load now uses the drive fraction that really reaches the ground, so the revs flare when the wheels really spin. The yellow is rear-wheel drive (`fourWheelDrive: 0`): on the track it spins 0.8 for the first 1.5 s of a launch, its tail steps out but it's controllable at 11 m/s and needs lifting off before bends at 14. Red and blue never spin on the track and barely in puddles. Cornering on the track is about 0.5 g against 1.8 g on grass.
- Spray is a capped point buffer per quad like the smoke (clumps off each tyre, spray from spinning wheels, a burst into puddles). Mud on the quads is a per-quad shader blend over cloned materials, driven by a coat amount that builds with speed and wheelspin through mud (tyres in about 10 s, bodywork half-coated after a lap), favouring tyres, arches and low parts, wet and glossy at first and drying lighter over 4 minutes. Ruts are ring-buffered ribbons per wheel (4,000 segments a quad), fading over 150 s in mud and 40 s on grass, laid on a new lookup of the terrain mesh's own height so they sit on the drawn ground. All of it costs about 0.16 ms of CPU a frame for three quads and 6 draw calls.
- There's no way to wash the mud off in the game yet (the debug folder can). The puddle surface is still a grey disc.

## Her driving (2026-10-05)

- Request: she drives a quad herself, when bored or when asked; not far, not fast; bored or scared after about a minute; then off or onto the back; on the back she only gets off when asked. Built by an agent that was interrupted near the end and finished by a second one from its branch.
- She drives through the same control path as the player: `Quad.setDriver()` gives the quad an object whose throttle, brake, steer, starter and reverse are read each physics step in place of keys, so engine, drivetrain, mud, smoke, sound and vibration behave as they do for you. The brain (`HerDrive` in `src/npc/herDriving.js`, pure, tested) is a slow, wobbly speed controller steering round a small randomised loop (4 to 6 waypoints, 5 to 9 m radius) through her start point, kept clear of things with raycast probes and inside the hedges. Novice touches: wobbly throttle, yanking the bars, braking to look round, forgetting the choke (once: a stall teaches her), rolling back on a slope (she now notices, brakes and gives it more), and giving up if it keeps stalling. After 45 to 85 s she pulls up (bored, or scared 40% of the time) and gets off or moves to the pillion.
- Measured over 16 headless runs (all quads, cold and warm, grass, track, by the hedge, by the barn): no collisions, top speeds 3.2 to 4 m/s (average 1.6 to 2.1), at most 18 m from where she started, about a minute on the front. Stops take about a second from 2.5 m/s rather than stamping on the brake.
- Her front-seat pose is its own rig poser (hands on the grips through the shared arm IK), kept apart from the pillion pose layer. `boredDriveChance` 0.25 joined the boredom choices (getting on the back 0.3, starting one 0.2, otherwise wandering). You take the quad back by getting on, from the menu, or with E on her quad while it's moving; the menu reaches her from 14 m while she drives.

## Rougher quads (2026-10-05)

- Tuned by hand: the top of each roughness range went up (red 0.50, blue and yellow 1.00; the debug slider now goes to 1). Simulated 2 minutes of warm idling with a blip every 30 s at roughness up to 1 and both ends of each idle range, 20 seeds each: no stalls, lowest rpm well above the stall point.

## TODO list, one by one (2026-10-05)

1. Her driving mood. Each go she has a confidence from 0 (careful) to 1 (confident), her usual confidence plus or minus 0.35, which scales her driving params for that go (`src/npc/driveMood.js`, tested): careful is 0.7 times the speed, shakier, smaller loops, more pauses and much more likely to stop scared; confident is 1.4 times the speed, smoother, bigger loops and longer. A scary or failed go lowers her usual confidence by 0.15, a go that ended because she got bored or you asked raises it by 0.08. She sets off with a careful or confident line to match, and happy versus nervous remarks lean the same way. Measured: careful averaged 0.6 m/s (top 2) within 7.5 m; confident averaged 3.3 m/s (top 5.3) out to 28 m.
2. Her looking taller than you riding together. Your seated eye was only 0.64 m above the seat (right for someone about 1.45 m tall) while your standing eye height is 1.62 m, so her head (1.46 m above the ground on the pillion) was level with your eyes. The camera anchor is now 0.79 m above the seat, 1.67 m above the ground: you look slightly down at her over your shoulder, and the dash sits a little lower in the view.
3. Riding warms the engine faster. Warm-up followed revs only weakly (1.8 times faster flat out). Now heat follows how hard it's working: `warmUpRpmBoost` 2.0 on revs plus `warmUpLoadBoost` 1.5 on load times throttle. Measured from stone cold, easing the choke off as it warms: riding round in circles it's warm in about 50 s, idling about 116 s.
