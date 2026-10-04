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
