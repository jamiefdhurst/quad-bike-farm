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
| `E` | Get off (only below walking pace) |
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

## The three quads

- **Red quad**: Honda-style farm quad. Soft and steady, with a low warm idle around 1,150 rpm. Racks, round headlights, a pillion seat.
- **Blue quad**: Yamaha-style farm quad. Idles higher (about 1,450 rpm warm), revs harder and higher, needs more choke from cold and runs lumpier until it's warm, warms a bit quicker and pulls a little harder. It has a brush guard, square headlights, railed racks and a grey seat. Its idle comes from a different recorded machine, so it sounds different too.
- **Yellow quad**: a two-stroke sport quad, Blaster-style. It fires every revolution, so it buzzes rather than thumps, and ring-dings at idle. It's weak low down, then comes on hard around 6,000 rpm and revs past 10,000. It has almost no engine braking, and it slowly loads up its plug if you leave it idling (blip the throttle to clear it). It trails blue-white oil smoke. It's lighter and quicker, with an expansion-chamber exhaust, motocross bars, nerf bars and a race number plate. She can squeeze onto a slim pad at the back. It sounds like a two-stroke dirt bike.

All three are automatics and all start cold. Where each quad is parked, where the jerry can has been left, and each quad's warm idle change every game. Each quad's idle is picked from its `idleRange` in `src/vehicle/quadSpecs.js` (red 650 to 1,650, blue 950 to 1,950, yellow 1,300 to 2,300) and shown in the status panel. The browser console prints the layout's seed; add `?seed=<number>` to the URL to get the same layout again.

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
- The bike keeps idling when you get off, and you can watch and hear it shake from outside.

## Fuel

Each quad has a fuel tank, a fuel tap and a fuel gauge on the dash. Taps start OFF. The red quad starts at about 60%, the blue at about 25%, and the yellow at about two thirds of its smaller tank.

- A full tank lasts roughly 25 minutes of hard riding, and much longer at idle.
- The tap has three positions. On **ON** it can't reach the last couple of litres, so when it starts to cough and stumble, flick it to **RESERVE** with `F` and head for fuel. **OFF** shuts the fuel off; the engine runs on what's in the carburettor for a moment, then dies.
- If it runs completely dry, it stalls and won't restart until it has fuel.
- To refuel: find the red jerry can (it's left somewhere around the yard, the paddock or the gate) and pick it up with `E` (it holds 20 litres). Look at a quad and hold `E` to pour, with a glug. Refill the can by holding `E` at the green petrol tank. `G` puts the can down. You can't ride holding the can, so put it down first.

## The dashes

The quads have different instruments:

- **Red**: a round analogue rev counter, plus a green LCD with speed in mph, a fuel bar, RES and OFF flags for the tap, and a trip meter. Separate TEMP, IGN and FUEL lamps.
- **Blue**: one wide amber display with a bar-graph rev counter, big speed digits, a vertical fuel gauge that goes red on reserve, warning icons and a trip meter, in an angular pod with a visor.
- **Yellow**: the same layout as the blue's, compact and red-on-black, in a bare pod under the motocross crossbar.

Both go blank with the ignition off.

## Riding with her

Look at her and press `E`:

- **Get on the red / blue / yellow quad**: she walks over and sits on the pillion seat. Get on and ride; she stays on. Asking her onto the other quad while she's sitting on one, she gets off and walks over.
- **Stand next to the red / blue quad**: she gets off if she's on, or walks over if she isn't, and stands beside it facing it.

The menu only offers what makes sense: no "get on" while she's already on, no "stand next to it" while she's already there. She stays put on the pillion when you get off until you ask her to get down.

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
  npc/                 state machine, character rig, companion behaviour
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

**Engine sound** (`src/audio/engineWorklet.js`). Two engines, chosen in the tuning panel (Audio, `engineSound`):

- *recorded* (default): every firing pulse from the engine model plays one real recorded pulse, cut from CC0 recordings and resampled to last exactly one engine cycle. The four-strokes idle on quad recordings and rev on a Honda CRF250 four-stroke single, blended across 1,500 to 2,100 rpm. At higher revs each grain spans several real recorded firings, so there are fewer joins. The two-stroke uses its own bank, with idle from a two-stroke motocross bike and revs from a Honda CRM250 and a second two-stroke dirt bike. While the revs are steady, playback reads straight on through the recording rather than jumping between unrelated pulses. Because pulses still come from the engine model, a cold idle is still lumpy, misfires are still missing beats, and it stays in sync with the vibration and smoke. Cranking is a looped starter recording.
- *synth*: a pulse-driven exhaust synth with a simulated pipe and silencer.

To recut the recordings, see the instructions at the top of `tools/slice_engine_audio.py`.

**Exhaust smoke** (`src/effects/exhaustSmoke.js`). One soft puff per firing pulse, so you can see the beats at idle. White-grey vapour when cold, darker when rich or flooded, a burst when you snap the throttle open, and barely anything once warm. Tunable in the Smoke folder.

**Vibration** (`src/vibration/vibrationModel.js`). Each firing pulse kicks a set of damped oscillators (body heave, pitch and roll, handlebars, rider's head) in a slightly random direction. Kicks are strongest at idle and with a rough engine, and fade as rpm rises. The bike body, handlebars, seated camera and anything sitting on the bike all move with it.

**Companion** (`src/npc/companion.js`). A small state machine (idle, walking, mounting, seated, dismounting). Requests are methods, and `getActions()` decides which ones the menu shows. To add a new request, add a method and an entry in `getActions()`, plus a state if it needs one.

**Quads** (`src/vehicle/quadSpecs.js`, `src/vehicle/quadUnit.js`). Each quad is a spec (name, colour and overrides for engine, vehicle, vibration, audio and smoke parameters) built into a `QuadUnit` that owns its engine model, physics, vibration, smoke and sound. To add a third, add a spec and a spawn point in the layout.

**Layout** (`src/world/layout.js`). Positions for the field, barn, gate, track control points and spawn points all live here.

**Parameters**. Every tunable number lives in a `*Params.js` file next to the code that uses it, with a range for the tuning panel.

Design decisions and their reasons are logged in [DECISIONS.md](DECISIONS.md). Asset sources and licences are in [ASSETS.md](ASSETS.md).
