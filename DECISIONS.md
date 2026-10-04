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
