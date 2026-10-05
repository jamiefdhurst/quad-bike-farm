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
| `B` | Looking at a parked quad with a pillion seat and nobody on it: sit on the back. Wait there and one of the girls comes over and drives you (see Companions) |
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

Running wears an engine and makes it rougher still, all the way to fully rough if you keep at it (about half an hour of hard riding). Past about 0.8 (its build roughness plus wear), it turns erratic: it stumbles through runs of misfires, losing nearly all its power for a moment and nearly dying, catches again sometimes with a bang and a puff of smoke, flares up at idle, and won't hold a steady tickover. Fully worn, that's a stumble every two or three seconds and it dies on you now and then, and the girls will tell you it needs looking at. A service from the toolbox brings it back to its own character.

The idle and roughness are printed in the console and shown in the tuning panel.

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

The weather's different every game: sunny, sunny intervals, overcast, drizzly, raining or foggy (the console says which; `?weather=rain` and so on forces one, and the seed repeats it). Showers come and go during a game, more on a showery day: the sky darkens and the mist thickens as rain comes in, rain streaks past you with its own patter, and the wind pushes the exhaust smoke harder. Rain wets the ground, which darkens and dries slowly after: wet grass and especially wet mud are slipperier, and the bogs are worse. The girls have something to say about the day, and about the rain coming and going.

There are three bogs: two on the track and one in the low ground of the field, dark churned patches with a wet shine. Go into one slowly, or stop in it, and the mud drags you down and grips the wheels: keep the throttle on and they churn and dig you in, and once you're sunk past halfway it holds you against anything the tyres can do. Charge it with a run-up and you'll get through, much slower than you went in. Stuck but not too deep, rock it: forwards, backwards, forwards, and each change of direction works it a little looser. Too deep for that, use the green quad's winch: look at the green and press `X` to take the hook off it, walk the cable (30 m of it) to the stuck quad and press `E` on it to hook on, then hold `X` near the green (its remote is on a lead) or sitting on it to wind in. It pulls the stuck quad out towards the green. `E` on the hooked quad unhooks it, `X` while carrying the hook puts it back. The girls steer round the bogs on their own drives, but following you they'll go where you go; stuck, one gives up, gets off and shouts for help, and one on the back of yours will tell you what she thinks.

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

- **Red**: three chrome-ringed analogue dials in a pill-shaped pod. A rev counter scaled to its engine (red from 5,800), a 0 to 40 mph speedo with a drum trip counter, and a fuel gauge from E to F with a red reserve zone and the tap position (ON, RES, OFF) under the needle. A tiny temperature gauge sits low in the rev counter. IGN, reverse and low-fuel lamps are set into the dials. With the ignition off the fuel needle drops to E.
- **Blue**: one wide amber display with a bar-graph rev counter, big speed digits, a vertical fuel gauge that goes red on reserve, a row of temperature blocks, warning icons and a trip meter, in a rounded pod with a slim brow over it.
- **Yellow**: the same layout as the blue's, compact and red-on-black, in a rounder bare pod under the motocross crossbar.
- **Green**: a vintage dash on top of its handlebar headlight: a cream-faced 0 to 40 mph speedo in a chrome cup, a small cream fuel gauge with a low-fuel lamp, a small temperature gauge, chrome-ringed IGN and reverse lamps and a tap window.
- **Orange**: a minimal race dash: a green, amber and red rev bar with a shift light, small speed digits, six fuel blocks, five temperature blocks and a reverse flag.

Every dash has a temperature gauge: blue while the engine is cold, white when it's warm, with a red zone at the top for later. There's no on-screen readout of the quad any more, so you read the dash and listen to the engine to work out what's wrong. The needles rest at cold with the ignition off.

The displays go blank with the ignition off.

## Riding with her

There are two of them, each starting beside her own quad in the yard. **Amy** (blonde, navy polo) is the one you know. **Jess** (black hair, burgundy polo) is cheekier: she winds you up, is braver behind the bars, gets bored sooner and is more likely to take a quad off on her own, and she usually enjoys being left on a runaway. Each has her own voice and lines. They don't interact with each other, except that each leaves alone a quad the other is busy with, and one waits for the other to finish before chattering. Their names, looks and personalities are in `src/npc/characters.js` (Jess's lines in `src/npc/jessLines.js`). They're both after you, and it shows: they bicker. Standing about together near you, they have a go at each other now and then; talk to one with the other close by and the other chips in; ride past one with the other on your back and they shout at each other; come back from a ride and the one left behind has something to say; one watches the other drive and heckles; one gets stuck and the other enjoys it; and sharing a quad, they squabble about the driving. Amy is sweet with an edge, Jess is cheeky and competitive. Their exchanges are in `src/npc/banterLines.js`. They can share a quad, one driving and one on the back: ask one to get on the back of the quad the other is driving (she pulls up to let her on), or to drive the quad the other is sitting on the back of, and now and then a bored one hops on the back of her friend's quad as it sets off. With her friend aboard the driver goes round bigger loops for a minute and a half to over three minutes, then both get off. With both seats taken there's no room for you. Everything below applies to both.

Look at one of them and press `E` to open her wheel. Move the mouse towards a slice and click (or press its number). The first ring has a slice for each quad she could do something with, in its colour, plus anything that isn't about a particular quad (answering her when she's asked to get off, getting off the one she's on, or stopping while she's driving); a quad's slice opens a second ring of what she could do with it. Right-click (or Backspace) goes back a ring; `E` closes it. Riding on the back while she drives, `E` opens a one-ring wheel for the ride. The options:

- **Get on the red / blue / yellow quad**: she walks over and sits on the pillion seat. Get on and ride; she stays on. Asking her onto the other quad while she's sitting on one, she gets off and walks over.
- **Start the red / blue / yellow quad**: she walks to its handlebars, turns the key, checks the fuel tap (usually), puts the choke on if it's cold (usually), and cranks in short goes, talking herself through it. If it catches she eases the choke off as it warms, then leaves it to you; after four goes she gives up and switches it off. Get on while she's at it and she stops.
- **Take me for a ride on the red / blue quad**: she gets on the front, starts it and waits for you to get on the back (look at the quad and press `E`). She drives bigger loops and keeps going while you're aboard. Press `E` on the back to talk to her: stop here, slow down, go a bit faster, let me off, or let me drive (she gets off, you slide forward, and she hops on the back). You can also get on the back whenever she's driving and going slowly.
- **Sitting on the back by yourself**: look at a parked quad and press `B`. If nobody's driving it, after 6 to 25 seconds a free girl (usually the nearer) walks over, says so, gets on the front, starts it and drives you about in big loops. Unlike a ride you asked for, this is her idea and it lasts as long as one of her drives (a minute to two and a half): she gets bored, pulls up and gets off without waiting for you to say stop, leaving you on the back. Nobody offers again for a while: 45 seconds to 2 minutes after Amy's ride, 25 to 70 seconds after Jess's (hers also last a bit less, 45 to 110 seconds). If you get off before she's got on, she gives up after 25 seconds. You can still talk to her with `E` and ask her to stop or let you off. On the back by yourself, `E` gets you off.
- **Follow me on the red / blue / yellow quad**: she gets on that one, starts it and waits for you to set off on another, then follows about 8 m behind at your pace, up to about 25 mph (less if she's feeling careful, more if confident). Get too far ahead and she shouts after you; stop and she pulls up behind you and waits. Get off your quad and she waits a while (30 to 90 seconds; Jess less), then gives up on you: either she goes off for a drive on her own (more likely the more confident she is) or she pulls up and gets off or moves to the back, as after any drive. Talk to her to finish sooner.
- **Drive the red / blue / yellow quad**: she gets on the front, starts it like the learner she is, and potters round a loop near where she started for about a minute. How she drives depends on how she feels that day: careful (creeping, shaky, lots of stops, quick to get scared) or confident, and the more confident the bolder: at the very top she'll do up to about 28 mph in big loops out across the field for three minutes or more, picking her way slowly out of the yard and among parked quads and only opening it up with room around her. A fright makes her more careful next time while a good go builds her confidence. She then stops, bored or scared, and gets off or hops on the back. While she drives you can ask her to stop and get off or move onto the back. Get on and she shuffles back; if her quad is too fast to climb onto, press `E` on it to ask her to stop and let you on.
- **Stand next to the red / blue quad**: she gets off if she's on, or walks over if she isn't, and stands beside it facing it.

The wheel only offers what makes sense: no "get on" while she's already on, no "stand next to it" while she's already there. She stays put on the pillion when you get off until you ask her to get down. Jump off at speed with her on the back and she'll let you know what she thinks.

On the back she holds on round your waist (look down and you'll see her hands), leans with you into corners, lurches forward under hard braking, and looks about or over your shoulder. Hold `C` or the middle mouse button to look back at her. Left alone on a quad she holds the rails (or the strap on the yellow).

She talks, now and then, with captions at the bottom of the screen:

- Riding pillion she reacts to the ride: "Oh, this is fun!" on a smooth run, "This is a bit rough." over bumps, "Careful!" when you go too fast, a gasp when you brake hard, and something when it stalls or runs out of petrol.
- If you crank a quad near her for a while without it starting, she has a guess at why: the choke if it's cold, flooding if it's rich, the fuel tap if the carburettor is dry.
- Left waiting she sighs, hums, yawns and asks if you're going. Ride off without her and she'll shout after you.
- Sat on the back of a parked quad, every few minutes she asks if she can get off; the menu then has "Yes, hop off" and "No, stay there" (she grumbles and stays). If you don't answer, after several minutes she lets herself off. On the back by her own choice (after one of her drives, or bored), she gets bored of it sooner and gets off. On a long ride together she sometimes asks if you can stop soon.
- Jump off and leave her on a quad driving itself and she's either terrified or having the time of her life (40% of the time), and tells you about it afterwards. Hating it, after 8 to 18 seconds she climbs onto the front and either stops it, switches it off and gets down, or drives it about herself.
- She speaks up the further away you are, and shouts some things (being left behind, a quad riding itself), which carry twice as far.
- She comments when the seat is shaking hard, and has a favourite quad each game.
- Left standing about, sooner or later she does something on her own: wanders off for a look round (sometimes a long one), gets on a quad to wait, has a go at starting one, or takes one for a drive. When is never the same: usually somewhere between half a minute and a minute and a half, but anywhere from a few seconds over ten to a few minutes, and sooner when she's restless (which comes and goes). What she does is reshuffled each time, and the more confident a driver she's become, the more often she goes for a drive. Turn this off with `ownMind` in the Companion folder.
- She answers when you ask her something.

Their lines are recorded offline with Chatterbox, a text-to-speech engine that copies a voice from a short reference recording and can be made more or less emotional: each kind of situation has a feel (calm, chatty, cross, excited or scared), so a fright sounds frightened. Amy's reference is the Piper "cori" voice she had before, Jess's is a LibriVox reader. Every line is checked with a speech recogniser and recorded again if it doesn't come out right; a few of Amy's short shouts that Chatterbox can't manage are recorded with Piper instead, and anything still wrong is left to the browser's voice. Lines play from where she is, like her sighs, hums and laughs, which are real recordings (Jess's a shade quicker and higher). After changing the lines in `src/npc/voiceLines.js` or `src/npc/jessLines.js`, re-record them with `tools/generate_companion_voice.py --character amy` (or `jess`; usage at the top of the script). Until then, a new line uses the browser's speech, but only with a voice known to be a woman's (Flo or Shelley on a Mac, Google UK English Female in Chrome, Sonia or Libby in Edge); with none of those she just shows the caption. Her figure (bust, waist, hips) can be adjusted live in the Companion folder of the tuning panel. How chatty she is, her volume, speech rate and pitch, captions and the thresholds she reacts to are in the Companion folder of the tuning panel. The lines are in `src/npc/voiceLines.js`.

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
  hud/                 crosshair, prompts, notes for carried items, help
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

1. Vehicles need to get way more muddy **Done.** Bodywork now plasters over within about half a minute of driving through mud, and climbs much higher up the quad.
2. I can sit pillion without anyone else there, then the girls automatically jump on to drive me around, and jump off when they're bored, they don't need to wait for me to say stop **Done.** `B` at a parked quad sits you on the back; a free girl soon offers, drives you about, then gets off by herself when bored.
3. Remove the helpful vehicle HUD so I have to guess what the issues are, add a temp gauge to each of the quads **Done.** The quad readout is gone; every dash now has a temperature gauge.
4. Pillion on the orange one **Done.** The orange now has a slim pad and grab strap on the tail of its race seat, so you and the girls can ride on the back like on the yellow.
5. A way for two girls to sit on the back of a quad at the same time - one on the fairing maybe?
6. The girls say very nice things to me sometimes - tell me they love me, care for me, etc.
7. One more go at the collar, which despite what you've said is still not right.
8. Who you favour. Each girl quietly keeps score: rides given, times you talked to her, whose favourite quad you pick. Favoured, she's warmer and up for anything. Neglected, she sulks, says no to things, or takes a quad off on her own. The rivalry gets an edge: the favoured one gloats and the other gets pointed.
9. Pranks. Jess sneaks over and turns your fuel tap off, or puts the choke on, while you're away. Amy hides the jerry can or the toolbox. You find out when it won't start, and the culprit can't keep a straight face.
10. Teaching them. Ride on the back while one drives and coach her ("easy on the throttle", "choke off now"). Each girl gets better at specific things (choke, starting, cornering, mud) rather than just "more confident", and you can hear it in what she says.
11. Favours. Now and then one asks for something: wash her favourite quad, take her over to the bales, beat Jess round the track for her, fetch the jerry can. Doing it pleases her. Ignoring it, she remembers.
12. Places to be. On a sunny day they sit on the bales or the paddock fence, or lie in the grass. When it rains they shelter in the barn doorway. Bored, a girl might also go and wait at a favourite spot rather than only at a quad.
13. Batteries and starting. Leave the ignition on and the battery drains, so the starter cranks slower until it won't turn over. Then you bump-start it down the bank, jump it from another quad, or use the pull-start on the two-strokes (hold and yank, which takes a knack when it's cold).
14. Two-stroke oil. The yellow and orange run on pre-mix: a second jerry can by the tank. Fill one with straight petrol and it runs hot, then nips up and seizes. Too much oil and it smokes like a bonfire and fouls plugs.
15. Faults that develop. Things go wrong over time, separate from wear:
   - A slow puncture from the hedge (it pulls to one side; there's a foot pump in the toolbox).
   - A slipping drive belt (revs flare, no go).
   - A sticking throttle cable that keeps it running on.
   - A dirty carb that hunts worse and worse.

   Each has a symptom you can feel or hear, and a girl who might spot it.
16. Heat. The air-cooled ones get hot idling for ages on a sunny day and start pinking and running rough. The water-cooled orange's fan cuts in with its own sound. A quad thrashed and then switched off ticks as it cools, and it starts differently hot.
17. Inside the barn. Open the big doors and the barn becomes a space:
    - Rain drumming loudly on the tin roof.
    - Straw bales to sit on, and the workbench with the toolbox.
    - A spot to park quads under cover, where they stay dry, don't get muddier and start better on cold mornings.

    When it rains the girls make a run for it and sit on the bales. You can drive in, and the engine's roar inside is a different sound.
18. The workshop corner. The barn bench becomes where real jobs happen: change a plug, clean a carb, swap a tyre, top up two-stroke oil. Each job is a short hands-on sequence, and the girls watch, help or heckle.
19. The hayloft. Climb the ladder: a view over the farm through the loft door, and a hiding place. The girls can climb up too, and Jess might drop straw on you.
20. Manual gears - one of them should be manual with a clutch.
21. Additional vehicles: a random one each time (each needing its own sound and characteristics):
    - A neighbour's beaten-up old three-wheeler ATC (a real tip-over risk).
    - A tiny kids' 50cc quad Jess insists on riding.
    - A mini moto with a pull-start.
    - A smart new quad on loan for the day.