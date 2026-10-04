# Quad Bike Farm

A small first-person browser game: a farm quad bike with a properly temperamental single-cylinder engine, a muddy track round a British field, and your girlfriend, who'll hop on the back if you ask.

Three.js, Rapier physics, Web Audio. Desktop, keyboard and mouse.

## Running it

```sh
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173), click the page to lock the mouse, and you're in. Press `H` to show or hide the controls.

Other scripts:

- `npm test` runs the engine model tests with Vitest.
- `npm run build` makes a production build in `dist/`, and `npm run preview` serves it.

## Controls

**On foot**

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` | Move |
| Mouse | Look |
| `Shift` | Jog |
| `E` | Interact with whatever you're looking at: ride the quad, or talk to her |

**On the quad**

| Key | Action |
| --- | --- |
| `K` | Ignition on / off |
| `R` (hold) | Crank the starter |
| `Q` / `Z` | Choke more / less, in 10% steps. Hold to keep stepping |
| `W` | Throttle |
| `S` | Brake. Hold it at a standstill to reverse |
| `A` / `D` | Steer |
| `E` | Get off (only below walking pace) |
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

## Starting a cold engine

The engine starts stone cold and won't fire without choke.

1. Walk up to the quad and press `E` to get on.
2. Hold `Q` to pull the choke to 100%. The yellow lever on the left handlebar moves.
3. Press `K` for ignition. The green IGN light comes on and the blue TEMP light shows the engine is cold.
4. Hold `R` to crank. It should catch within a couple of seconds and settle into a high, lumpy idle. The whole bike shakes.
5. Let it warm. With the choke left on, the idle creeps up as it warms. Ease the choke off with `Z`, a notch or two at a time. Too early and it stumbles and dies. Too late and it starts to hunt, runs rich and eventually floods and stalls.
6. Once it's warm (TEMP light out, a couple of minutes) it idles low and steady with no choke.

Things to know:

- A warm engine with lots of choke is hard to start.
- Braking hard from speed while it's still cold can stall it. Roll off early and brake gently until it's warm.
- If you flood it, take the choke off and crank with the throttle held open (`W` + `R`) to clear it.
- The bike keeps idling when you get off, and you can watch and hear it shake from outside.

## Riding with her

Look at her and press `E`:

- **Get on the quad**: she walks over and sits on the pillion seat. Get on and ride; she stays on.
- **Stand next to the quad**: she gets off if she's on, or walks over if she isn't, and stands beside it facing it.

The menu only offers what makes sense: no "get on" while she's already on, no "stand next to it" while she's already there. She stays put on the pillion when you get off until you ask her to get down.

## Tuning panel

Press `` ` `` to open it. It releases the mouse so you can use the panel; click the game to carry on. Every engine, vibration, audio, vehicle, player and companion value is in there, along with live engine readouts (state, rpm, mixture, roughness, fouling) and shortcuts: warm or cool the engine instantly, clear a flood, put the quad back at the barn, and copy every value as JSON.

## How it's put together

```
src/
  main.js, game.js     bootstrap and the main loop
  core/                input, tuning registry
  engine/              engine model (pure logic, no Three.js) and its parameters
  vibration/           pulse-driven vibration model (pure logic) and parameters
  effects/             exhaust smoke
  audio/               procedural Web Audio engine sound
  vehicle/             quad model, Rapier vehicle, drivetrain, dash
  player/              walking and seated first-person player
  npc/                 state machine, character rig, companion behaviour
  interaction/         look-at interaction and the context menu
  hud/                 crosshair, prompts, status, help
  world/               terrain, track, sky, props, layout
  debug/               lil-gui tuning panel
tests/engine.test.js   engine state machine tests
```

**Engine model** (`src/engine/engineModel.js`). A state machine (off, ignition, cranking, running, stalled) driven by one idea: mixture. Mixture is the enrichment the choke supplies minus the enrichment a cold engine needs. It decides whether the engine catches, where it idles, how rough it runs and how much power it makes. Running rich fouls the plug, and a fully fouled plug stalls it. Temperature rises while running and falls slowly when off. Each power stroke is emitted as a firing pulse with its own timing and strength jitter, and both the vibration and the audio play those same pulses. That's why a rough engine sounds and feels lumpy together.

**Drivetrain** (`src/vehicle/drivetrain.js`). An automatic: centrifugal clutch into a CVT. It turns engine rpm and power into drive force, and puts braking load back on the engine while the clutch is locked to a moving bike.

**Engine sound** (`src/audio/engineWorklet.js`). An AudioWorklet synth. Each firing pulse is a pressure kick into a simulated exhaust pipe and silencer with fixed resonances, so revs change the pulse rate rather than shifting the whole sound up. The starter motor, intake, valve tick and overrun pops are synthesised alongside. Every value is in the Audio folder of the tuning panel.

**Exhaust smoke** (`src/effects/exhaustSmoke.js`). One soft puff per firing pulse, so you can see the beats at idle. White-grey vapour when cold, darker when rich or flooded, a burst when you snap the throttle open, and barely anything once warm. Tunable in the Smoke folder.

**Vibration** (`src/vibration/vibrationModel.js`). Each firing pulse kicks a set of damped oscillators (body heave, pitch and roll, handlebars, rider's head) in a slightly random direction. Kicks are strongest at idle and with a rough engine, and fade as rpm rises. The bike body, handlebars, seated camera and anything sitting on the bike all move with it.

**Companion** (`src/npc/companion.js`). A small state machine (idle, walking, mounting, seated, dismounting). Requests are methods, and `getActions()` decides which ones the menu shows. To add a new request, add a method and an entry in `getActions()`, plus a state if it needs one.

**Layout** (`src/world/layout.js`). Positions for the field, barn, gate, track control points and spawn points all live here.

**Parameters**. Every tunable number lives in a `*Params.js` file next to the code that uses it, with a range for the tuning panel.

Design decisions and their reasons are logged in [DECISIONS.md](DECISIONS.md). Asset sources and licences are in [ASSETS.md](ASSETS.md).
