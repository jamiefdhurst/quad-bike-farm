# Quad Bike Farm

A small first-person browser game: three quad bikes (two farm four-strokes and a two-stroke sport quad) with properly temperamental single-cylinder engines, a muddy track round a British field, and your girlfriend, who'll hop on the back if you ask.

Three.js, Rapier physics, Web Audio. Desktop, keyboard and mouse.

## Running it

```sh
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173), click the page to lock the mouse, and you're in. Press `H` to show or hide the controls.

Other scripts:

- `npm test` runs the engine and fuel tests with Vitest.
- `npm run build` makes a production build in `dist/`, and `npm run preview` serves it.

## Controls

**On foot**

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` | Move |
| Mouse | Look |
| `Shift` | Jog |
| `E` | Interact with whatever you're looking at: ride the quad, or talk to her |
| `K` `R` `Q` `Z` `F` | While looking at a quad: ignition, starter, choke and fuel tap, without getting on |
| Hold `E` | Holding the jerry can: pour into the quad you're looking at, or refill the can at the petrol tank |
| `G` | Put the jerry can down |

**On the quad**

| Key | Action |
| --- | --- |
| `K` | Ignition on / off |
| `R` (hold) | Crank the starter |
| `Q` / `Z` | Choke more / less, in 10% steps. Hold to keep stepping |
| `W` | Throttle |
| `S` | Brake. Hold it at a standstill to reverse |
| `A` / `D` | Steer |
| `E` | Get off. Above walking pace you jump off and the quad carries on by itself at the same speed and steering until it crashes, tips, stalls or runs dry. To stop a runaway, look at it and press `K`, or catch it once it's below a jog (3 m/s) to get back on. |
| `C` (hold) or middle mouse | Look back over your shoulder |
| `F` | Fuel tap: ON, RESERVE, OFF |
| `T` | Right the quad if it's tipped over |
| Mouse | Look around from the seat |

**Talking to her**

Look at her and press `E`. Pick an option with the number keys, or scroll to highlight and click. `E` closes the menu.

**Other**

| Key | Action |
| --- | --- |
| `H` | Show or hide the controls |
| `M` | Mute |
| `` ` `` | Tuning panel |

## The quads

- **Red quad**: Honda-style farm quad. Soft and steady, with a low warm idle around 1,150 rpm. Racks, round headlights, a pillion seat.
- **Blue quad**: Yamaha-style farm quad. Idles higher (about 1,450 rpm warm), revs harder and higher, needs more choke from cold and runs lumpier until it's warm, warms a bit quicker and pulls a little harder. It has a brush guard, square headlights, railed racks and a grey seat. Its idle comes from a different recorded machine, so it sounds different too.
- **Yellow quad**: a two-stroke sport quad, Blaster-style. It fires every revolution, so it buzzes rather than thumps, and ring-dings at idle. It's weak low down, then comes on hard around 6,000 rpm and revs past 10,000. It has almost no engine braking, and it slowly loads up its plug if you leave it idling (blip the throttle to clear it). It trails blue-white oil smoke. It's lighter and quicker, with an expansion-chamber exhaust, motocross bars, nerf bars and a race number plate. She can squeeze onto a slim pad at the back. It sounds like a two-stroke dirt bike.

- **Green quad**: a Kawasaki-style farm workhorse, older and heavier. A big lazy four-stroke that idles low and lumpy (it idles on a Honda CRF250 recording, a different machine again), revs slowly but pulls hard low down, takes an age to warm up, wants plenty of choke, runs rougher than the others and engine-brakes hard. Slower at the top (about 33 mph), with a bigger tank. Boxy bodywork, a single round headlight in a nacelle on the bars, flat mesh racks, a winch, mudflaps and a tan seat.
- **Orange quad**: a Suzuki LT250R-style two-stroke race quad. Lighter and lower than the yellow, revs to 11,500 and comes on harder still around 7,000, rear-wheel drive, barely any engine braking, and smokes like a chimney. A big "22" number plate, long flat fenders, wide nerf bars and a fat expansion chamber. Single race seat, so she can't ride on the back (she can still start or drive it). It idles on a Honda CRM250 recording, so it sounds different from the yellow.

All five are automatics and all start cold. Through the CVT the red tops out at 6,200 rpm and the blue at 6,800 (the yellow revs past 10,000), but the engine works against the ground: it bogs a little as you pull away, cruises nearer 5,700 flat out, labours lower up hills and through mud, flares when the wheels spin or leave the ground, and engine-brakes on a closed throttle with the revs rising with speed downhill. Try climbing the steep bank by the yard on a stone-cold engine with the choke out and it will probably stall. Each quad has its own character, the same every game: how it idles, how rough it runs and how it shakes. The red is the smooth one; the blue idles fast and keen with a quicker buzz; the yellow ring-dings and buzzes through the bars more than the body; the green idles slow and lumpy with a big slow heave like a tractor; the orange hunts nervously and shakes harsh and hard. Where each quad is parked, where the jerry can has been left, and each quad's exact warm idle, roughness and starting fuel vary a little every game, picked from ranges in `src/vehicle/quadSpecs.js`:

| | `idleRange` (rpm) | `roughnessRange` | `fuelRange` (litres) | Body shake at idle |
| --- | --- | --- | --- | --- |
| Red | 1,050 to 1,150 | 0.04 to 0.12 | 2.5 to 11 of 12 | 2 mm, gentle |
| Blue | 1,400 to 1,550 | 0.20 to 0.30 | 1.2 to 8 of 11 | 3.5 mm, quick |
| Yellow | 1,500 to 1,800 | 0.35 to 0.50 | 1.5 to 8 of 9 | 3 mm, buzzy bars |
| Green | 800 to 900 | 0.55 to 0.70 | 3 to 13 of 14 | 12 mm, slow heave |
| Orange | 2,000 to 2,300 | 0.75 to 0.90 | 1.5 to 7.5 of 8 | 10 mm, harsh |

Running wears an engine and makes it rougher still; a service from the toolbox brings it back to its own character. Badly worn, a hard stop can now and then stall it.

The idle and roughness are shown in the status panel and printed in the console.

She starts beside a random quad in the yard. The others are parked in the yard at any angle, sometimes facing the other way, or (40% each) left somewhere else on the farm: by the field gate, the paddock, the straw bales, the west hedge, out past the far bend, at the bottom of the track or in the middle of the field. The console says where each one is. The browser console prints the layout's seed; add `?seed=<number>` to the URL to get the same layout again.

Everything below applies to any of them.

## Starting a cold engine

The engine starts stone cold and won't fire without choke.

1. Walk up to the quad and press `E` to get on.
2. Hold `Q` to pull the choke to 100%. The yellow lever on the left handlebar moves.
3. Turn the fuel tap ON with `F`. The quads are parked with it OFF; forget and it'll start, run for a few seconds on what's in the carburettor, then stumble and die.
4. Press `K` for ignition. The green IGN light comes on and the blue TEMP light shows the engine is cold.
5. Hold `R` to crank. It should catch within a couple of seconds and settle into a high, lumpy idle. The whole bike shakes.
6. Let it warm. With the choke left on, the idle creeps up as it warms. Ease the choke off with `Z`, a notch or two at a time. Too early and it stumbles and dies. Too late and it starts to hunt, runs rich and eventually floods and stalls.
7. Once it's warm (TEMP light out, a couple of minutes) it idles low and steady with no choke.

Things to know:

- A warm engine with lots of choke is hard to start.
- Braking hard from speed while it's still cold can stall it. Roll off early and brake gently until it's warm.
- If you flood it, take the choke off and crank with the throttle held open (`W` + `R`) to clear it.
- The bike keeps idling when you get off, and you can watch and hear it shake from outside. With nobody on it, it also jolts over the ground as it moves, harder the faster it goes, so a quad driving itself round in circles visibly bounces. Riding it, the shake is as it always was.

## Mud

The track and especially its puddles are slippery: grip drops from 2.2 on grass to 0.7 on the track and 0.42 in a puddle (all scaled by tyre pressure). The yellow quad is rear-wheel drive and spins its back wheels if you give it everything in the mud; the four-wheel-drive farm quads only slip in puddles. Tyres throw clumps and puddles splash, wheels leave ruts that fade over a couple of minutes, and the quads get muddier the more you ride, dark and wet at first and drying lighter. To wash one, pick up the hose on its reel at the south end of the petrol tank (`E`; it reaches 25 m), and hold `E` at a quad: the wheels come clean first, then the bodywork, over about 8 seconds for a filthy one, leaving the paint wet and shiny until it dries. `G` puts the hose back. Mind where you point it if she's about. Each quad's Mud folder in the tuning panel has the spray and rut settings, and "Mud on it" cleans it off.

## Tinkering

Pick up the red toolbox by the petrol tank (`E`), take it to a quad that's switched off and press `E` to get the spanners out. The panel has five adjustments, each with its current and stock values and a note on the trade-off:

- **Idle screw**: the warm idle, within safe limits.
- **Carb mixture**: leaner pulls a bit harder and uses less fuel but runs rougher; richer is easier from cold but smokier and thirstier, and fully rich slowly fouls the plug.
- **Throttle stop (speed limiter)**: farm quads come with it screwed in. Each turn out adds about 7% top speed (fully off is about +20%: the red goes from 35 to 42 mph), plus a few more revs and more fuel.
- **Clutch springs**: softer bites sooner, stiffer later; it always bites above the idle.
- **Tyre pressures**: softer grips better (especially in mud) but bounces more.

"Back to stock" puts everything back exactly. Engines also wear as they run (faster when worked hard), getting rougher: a lumpy, hunting idle and a lot more shake. The panel says how it's running, and **Service it** (`V`) clears the wear and leaves it as sweet as that quad gets. Changes last for the game. `G` puts the toolbox down; you can't ride while carrying it. She has opinions about all of this.

## Fuel

Each quad has a fuel tank, a fuel tap and a fuel gauge on the dash. Taps start OFF. How much is in each tank varies every game (see `fuelRange` above); the blue can start below its reserve, so it'll only run on RESERVE until it's filled.

- A full tank lasts roughly 25 minutes of hard riding, and much longer at idle.
- The tap has three positions. On **ON** it can't reach the last couple of litres, so when it starts to cough and stumble, flick it to **RESERVE** with `F` and head for fuel. **OFF** shuts the fuel off; the engine runs on what's in the carburettor for a moment, then dies.
- If it runs completely dry, it stalls and won't restart until it has fuel.
- To refuel: find the red jerry can (it's left somewhere around the yard, the paddock or the gate) and pick it up with `E` (it holds 20 litres). Look at a quad and hold `E` to pour, with a glug. Refill the can by holding `E` at the green petrol tank. `G` puts the can down. You can't ride holding the can, so put it down first.

## The dashes

The quads have different instruments:

- **Red**: three chrome-ringed analogue dials in a pill-shaped pod. A rev counter scaled to its engine (red from 5,800), a 0 to 40 mph speedo with a drum trip counter, and a fuel gauge from E to F with a red reserve zone and the tap position (ON, RES, OFF) under the needle. TEMP, IGN, reverse and low-fuel lamps are set into the dials. With the ignition off the fuel needle drops to E.
- **Blue**: one wide amber display with a bar-graph rev counter, big speed digits, a vertical fuel gauge that goes red on reserve, warning icons and a trip meter, in a rounded pod with a slim brow over it.
- **Yellow**: the same layout as the blue's, compact and red-on-black, in a rounder bare pod under the motocross crossbar.
- **Green**: a vintage dash on top of its handlebar headlight: a cream-faced 0 to 40 mph speedo in a chrome cup, a small cream fuel gauge with a low-fuel lamp, chrome-ringed IGN, TEMP and reverse lamps and a tap window.
- **Orange**: a minimal race dash: a green, amber and red rev bar with a shift light, small speed digits, six fuel blocks and cold and reverse flags.

The displays go blank with the ignition off.

## Riding with her

Look at her and press `E`:

- **Get on the red / blue / yellow quad**: she walks over and sits on the pillion seat. Get on and ride; she stays on. Asking her onto the other quad while she's sitting on one, she gets off and walks over.
- **Start the red / blue / yellow quad**: she walks to its handlebars, turns the key, checks the fuel tap (usually), puts the choke on if it's cold (usually), and cranks in short goes, talking herself through it. If it catches she eases the choke off as it warms, then leaves it to you; after four goes she gives up and switches it off. Get on while she's at it and she stops.
- **Take me for a ride on the red / blue quad**: she gets on the front, starts it and waits for you to get on the back (look at the quad and press `E`). She drives bigger loops and keeps going while you're aboard. Press `E` on the back to talk to her: stop here, slow down, go a bit faster, let me off, or let me drive (she gets off, you slide forward, and she hops on the back). You can also get on the back whenever she's driving and going slowly.
- **Follow me on the red / blue / yellow quad**: she gets on that one, starts it and waits for you to set off on another, then follows about 8 m behind at your pace, up to about 25 mph (less if she's feeling careful, more if confident). Get too far ahead and she shouts after you; stop and she pulls up behind you and waits. To finish, get off and talk to her.
- **Drive the red / blue / yellow quad**: she gets on the front, starts it like the learner she is, and potters round a loop near where she started for about a minute. How she drives depends on how she feels that day: careful (creeping, shaky, lots of stops, quick to get scared) or confident (quicker, smoother, bigger loops), and a fright makes her more careful next time while a good go builds her confidence. She then stops, bored or scared, and gets off or hops on the back. While she drives you can ask her to stop and get off or move onto the back. Get on and she shuffles back; if her quad is too fast to climb onto, press `E` on it to ask her to stop and let you on.
- **Stand next to the red / blue quad**: she gets off if she's on, or walks over if she isn't, and stands beside it facing it.

The menu only offers what makes sense: no "get on" while she's already on, no "stand next to it" while she's already there. She stays put on the pillion when you get off until you ask her to get down. Jump off at speed with her on the back and she'll let you know what she thinks.

On the back she holds on round your waist (look down and you'll see her hands), leans with you into corners, lurches forward under hard braking, and looks about or over your shoulder. Hold `C` or the middle mouse button to look back at her. Left alone on a quad she holds the rails (or the strap on the yellow).

She talks, now and then, with captions at the bottom of the screen:

- Riding pillion she reacts to the ride: "Oh, this is fun!" on a smooth run, "This is a bit rough." over bumps, "Careful!" when you go too fast, a gasp when you brake hard, and something when it stalls or runs out of petrol.
- If you crank a quad near her for a while without it starting, she has a guess at why: the choke if it's cold, flooding if it's rich, the fuel tap if the carburettor is dry.
- Left waiting she sighs, hums, yawns and asks if you're going. Ride off without her and she'll shout after you.
- Sat on the back of a parked quad, every few minutes she asks if she can get off; the menu then has "Yes, hop off" and "No, stay there" (she grumbles and stays). If you don't answer, after several minutes she lets herself off. On the back by her own choice (after one of her drives, or bored), she gets bored of it sooner and gets off. On a long ride together she sometimes asks if you can stop soon.
- Jump off and leave her on a quad driving itself and she's either terrified or having the time of her life (40% of the time), and tells you about it afterwards. Hating it, after 8 to 18 seconds she climbs onto the front and either stops it, switches it off and gets down, or drives it about herself.
- She speaks up the further away you are, and shouts some things (being left behind, a quad riding itself), which carry twice as far.
- She comments when the seat is shaking hard, and has a favourite quad each game.
- Left standing about for a minute or so, she does something on her own: wanders off for a look round, gets on a quad to wait (and stays on it until you ask her down), has a go at starting one, or takes one for a drive. Turn this off with `ownMind` in the Companion folder.
- She answers when you ask her something.

Her lines are recorded offline with a British woman's voice ("cori", from the Piper text-to-speech engine) and play from where she is, like her sighs, hums and laughs, which are real recordings. After changing the lines in `src/npc/voiceLines.js`, re-record them with `tools/generate_companion_voice.py` (usage at the top of the script). Until then, a new line uses the browser's speech, but only with a voice known to be a woman's (Flo or Shelley on a Mac, Google UK English Female in Chrome, Sonia or Libby in Edge); with none of those she just shows the caption. Her figure (bust, waist, hips) can be adjusted live in the Companion folder of the tuning panel. How chatty she is, her volume, speech rate and pitch, captions and the thresholds she reacts to are in the Companion folder of the tuning panel. The lines are in `src/npc/voiceLines.js`.

## Tuning panel

Press `` ` `` to open it. It releases the mouse so you can use the panel; click the game to carry on. Each quad has its own folder (Engine, Vibration, Audio, Smoke, Vehicle), alongside Sound, Player, Companion and Sky. The live engine readouts (state, rpm, mixture, roughness, fouling) and the shortcuts (warm or cool the engine, clear a flood) follow the quad you're on or looking at. There's also a shortcut to put both quads back in the yard and one to copy every value as JSON.

## How it's put together

```
src/
  main.js, game.js     bootstrap and the main loop
  core/                input, tuning registry
  engine/              engine model (pure logic, no Three.js) and its parameters
  vibration/           pulse-driven vibration model (pure logic) and parameters
  effects/             exhaust smoke
  audio/               procedural Web Audio engine sound
  vehicle/             quad model, Rapier vehicle, drivetrain, dash styles, fuel; quadSpecs.js defines the quads
  items/               jerry can and petrol tank
  player/              walking and seated first-person player
  npc/                 state machine, character rig, companion behaviour, her voice lines
  interaction/         look-at interaction and the context menu
  hud/                 crosshair, prompts, status, help
  world/               terrain, track, sky, props, layout
  debug/               lil-gui tuning panel
tests/                 engine state machine and fuel tests
tools/                 slice_engine_audio.py, cuts recordings into engine pulses (Python, numpy)
public/audio/          the cut engine recordings
```

**Engine model** (`src/engine/engineModel.js`). A state machine (off, ignition, cranking, running, stalled) driven by one idea: mixture. Mixture is the enrichment the choke supplies minus the enrichment a cold engine needs. It decides whether the engine catches, where it idles, how rough it runs and how much power it makes. Running rich fouls the plug, and a fully fouled plug stalls it. Temperature rises while running and falls slowly when off. Each power stroke is emitted as a firing pulse with its own timing and strength jitter, and both the vibration and the audio play those same pulses. That's why a rough engine sounds and feels lumpy together.

**Drivetrain** (`src/vehicle/drivetrain.js`). An automatic: centrifugal clutch into a CVT. It turns engine rpm and power into drive force, and puts braking load back on the engine while the clutch is locked to a moving bike.

**Ride sounds and Doppler** (`src/audio/rideAudio.js`, `rideEvents.js`, `propagation.js`). Riding sounds like the ground: grass swish, grit on the track, squelch and splash at the puddles, suspension knocks and landing thuds, and wind for the rider that rises with speed. Each quad's sound reaches you through a delay line set to its distance over the speed of sound, so a quad driving past rises and falls in pitch (about 3% each way at 10 m/s) and sounds duller further away. Levels are in the Sound folder of the tuning panel.

**Engine sound** (`src/audio/engineWorklet.js`). Three engines, chosen in the tuning panel (Audio, `engineSound`):

- *pulse* (default): revs built from the idle recording. Every firing pulse from the engine model plays one real recorded idle firing at close to its own speed, cut off with a short crossfade when the next firing starts. As revs rise the firings simply come closer together, so the exhaust's character stays the same machine as idle, the way a real engine's does. On top, each firing gets louder with revs, and an EQ that follows the revs takes out some of the deep thump and lifts the mid-range rasp, as measured from real engines going from idle to high revs. Each quad revs on its own idle: the red on the main quad recording, the blue on the ATV recording, the yellow on the two-stroke motocross bike.

- *recorded*: every firing pulse from the engine model plays one real recorded pulse, cut from CC0 recordings and resampled to last exactly one engine cycle. The four-strokes idle on quad recordings and rev on two recordings of ATVs being ridden (one driving away, one riding round a quarry), blended across 1,500 to 2,100 rpm. Both ATVs move about in front of the microphone, so the slicer takes the distance out of their loudness and levels it to rise with rpm instead. At higher revs each grain spans several real recorded firings, so there are fewer joins. The two-stroke uses its own bank, with idle from a two-stroke motocross bike and revs from a Honda CRM250 and a second two-stroke dirt bike. While the revs are steady, playback reads straight on through the recording rather than jumping between unrelated pulses. Because pulses still come from the engine model, a cold idle is still lumpy, misfires are still missing beats, and it stays in sync with the vibration and smoke. Cranking is a looped starter recording.
- *synth*: a pulse-driven exhaust synth with a simulated pipe and silencer.

To recut the recordings, see the instructions at the top of `tools/slice_engine_audio.py`.

**Exhaust smoke** (`src/effects/exhaustSmoke.js`). One soft puff per firing pulse, so you can see the beats at idle. White-grey vapour when cold, darker when rich or flooded, a burst when you snap the throttle open, and a light haze once warm. Tunable in the Smoke folder.

**Vibration** (`src/vibration/vibrationModel.js`). Each firing pulse kicks a set of damped oscillators (body heave, pitch and roll, handlebars, rider's head) in a slightly random direction. Kicks are strongest at idle and with a rough engine, and fade as rpm rises. The bike body, handlebars, seated camera and anything sitting on the bike all move with it.

**Companion** (`src/npc/companion.js`). A small state machine (idle, walking, mounting, seated, dismounting). Requests are methods, and `getActions()` decides which ones the menu shows. To add a new request, add a method and an entry in `getActions()`, plus a state if it needs one.

**Quad models** (`src/vehicle/quadModel.js`, `src/vehicle/quadGeometry.js`). Procedural: fender shells swept round each wheel, lofted seats, tanks and hoods, bent-tube racks and frames, lathed tyres with lugs, and suspension arms and shocks posed from the physics wheel heights every frame. Static parts are merged per material.

**Quads** (`src/vehicle/quadSpecs.js`, `src/vehicle/quadUnit.js`). Each quad is a spec (name, colour and overrides for engine, vehicle, vibration, audio and smoke parameters) built into a `QuadUnit` that owns its engine model, physics, vibration, smoke and sound. To add a third, add a spec and a spawn point in the layout.

**Layout** (`src/world/layout.js`). Positions for the field, barn, gate, track control points and spawn points all live here.

**Parameters**. Every tunable number lives in a `*Params.js` file next to the code that uses it, with a range for the tuning panel.

Design decisions and their reasons are logged in [DECISIONS.md](DECISIONS.md). Asset sources and licences are in [ASSETS.md](ASSETS.md).

## TODO

1. She can drive differently depending on how she feels, confident or carefully - it can vary **Done.**
2. When you're on the quad, the girl seems a lot taller than you, which doesn't feel right **Done.**
3. Driving around should warm the quads up quicker, currently it has no effect **Done.**
4. After finishing driving, she never turns the quad off **Done** (she leaves it running nearly always, and very occasionally switches it off).
5. If she's on the back, after a while she asks occasionally if she can come off **Done.**
6. Quads get more rough over time, the roughness value needs to go up even more, or have more of an effect at the top range, a lot more in both idle variation and shaking, but it can be fixed with the toolbox **Done.**
7. I can also ride pillion with her **Done.**
8. Allow her to follow you and ride together on different quads **Done.**
9. Ability to wash the bikes **Done.**
10. She should get off sometimes even when she's been driving, when she gets bored. **Done.**
11. The girl's shirt collar is still not very good - it overlaps with her neck too much. Can we also give her shorts instead of jeans? **Done.**
12. If she's going round in circles and doesn't like it, after a while she jumps into the driver's seat and stops it, or drives around herself **Done.**
13. Add two other quads - another 4 and another 2 stroke, with different idle sounds and base characteristics **Done.**
14. Another girl, slightly different personality, and how do we inject more emotion into the voice?
