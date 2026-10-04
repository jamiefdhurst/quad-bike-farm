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
