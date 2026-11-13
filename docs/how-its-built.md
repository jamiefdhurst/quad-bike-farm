# How it is put together

A tour of the code. Why things are the way they are is in [DECISIONS.md](../DECISIONS.md); CLAUDE.md has the rules for working on it.

```
src/
  main.js, game.js     bootstrap and the main loop
  core/                input, tuning registry
  engine/              engine model (pure logic, no Three.js) and its parameters
  vibration/           pulse-driven vibration model (pure logic) and parameters
  effects/             exhaust smoke
  audio/               procedural Web Audio engine sound
  vehicle/             quad model, Rapier vehicle, drivetrain, dash styles, fuel; quadSpecs.js defines the quads
  items/               jerry cans, oil bottle and petrol tank
  player/              walking and seated first-person player
  npc/                 state machine, character rig, companion behaviour, her voice lines
  interaction/         look-at interaction and the context menu
  hud/                 crosshair, prompts, notes for carried items, help (controls.js is the controls list)
  start/               the start screen and the logo
  faq/                 the FAQ page: hand-written answers (faqContent.js) and the parts generated from the game
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

- *pulse* (default): revs built from the idle recording. Every firing pulse from the engine model plays one real recorded idle firing at close to its own speed, cut off with a short crossfade when the next firing starts. As revs rise the firings simply come closer together, so the exhaust's character stays the same machine as idle, the way a real engine's does. On top, each firing gets louder with revs, and an EQ that follows the revs takes out some of the deep thump and lifts the mid-range rasp, as measured from real engines going from idle to high revs. Each quad revs on its own idle: the red on the main quad recording, the blue on the ATV recording, the orange on the 250cc motocross bike. The green and the yellow blend into real rev recordings as they rev (`pulseRevLo` to `pulseRevHi`): the green from a Ténéré 250 into a farm ATV, the yellow from a DT 125 into a 85cc motocross bike, each firing still at its own speed.

- *recorded*: every firing pulse from the engine model plays one real recorded pulse, cut from CC0 recordings and resampled to last exactly one engine cycle. The four-strokes idle on quad recordings and rev on two recordings of ATVs being ridden (one driving away, one riding round a quarry), blended across 1,500 to 2,100 rpm. Both ATVs move about in front of the microphone, so the slicer takes the distance out of their loudness and levels it to rise with rpm instead. At higher revs each grain spans several real recorded firings, so there are fewer joins. The two-stroke uses its own bank, with idle from a two-stroke motocross bike and revs from a 250cc motocross bike and a second two-stroke dirt bike. While the revs are steady, playback reads straight on through the recording rather than jumping between unrelated pulses. Because pulses still come from the engine model, a cold idle is still lumpy, misfires are still missing beats, and it stays in sync with the vibration and smoke. Cranking is a looped starter recording.
- *synth*: a pulse-driven exhaust synth with a simulated pipe and silencer.

To recut the recordings, see the instructions at the top of `tools/slice_engine_audio.py`.

**Mist and rainbows (TODO 61).** About six games in ten have a mist morning: on a cool, still morning (the damper and colder the better) a low mist lies in the barley field's hollow, out past the east gateway. It is thickest in the first hour after sunrise and burns off over the next couple of hours, sooner on a warm day. Wind or rain clears it, and it doesn't form in snow. After a proper shower, once the rain has eased and the sun is out, a rainbow can stand in the sky opposite the sun: the lower the sun, the taller the bow, and with the sun high you won't see one. It fades some minutes later. "Mist" and "Rainbows" in the Tune tab set them; the console has `weather.mist` and `weather.rainbow` (setting one holds it, `mistAuto` and `rainbowAuto` hand it back). The girls don't remark on either yet.

**Fumes in the barn** (`src/world/barnFumes.js`). Running an engine indoors fills the barn with haze (tunable under "Fumes in the barn"); it takes about a minute of idling to get thick and a few minutes to clear.

**Exhaust smoke** (`src/effects/exhaustSmoke.js`). One soft puff per firing pulse, so you can see the beats at idle. White-grey vapour when cold, darker when rich or flooded, a burst when you snap the throttle open, and a light haze once warm. Tunable in the Smoke folder.

**Vibration** (`src/vibration/vibrationModel.js`). Each firing pulse kicks a set of damped oscillators (body heave, pitch and roll, handlebars, rider's head) in a slightly random direction. Kicks are strongest at idle and with a rough engine, and fade as rpm rises. The bike body, handlebars, seated camera and anything sitting on the bike all move with it.

**Companion** (`src/npc/companion.js`). A small state machine (idle, walking, mounting, seated, dismounting). Requests are methods, and `getActions()` decides which ones the menu shows. To add a new request, add a method and an entry in `getActions()`, plus a state if it needs one.

**Quad models** (`src/vehicle/quadModel.js`, `src/vehicle/quadGeometry.js`). Procedural: fender shells swept round each wheel, lofted seats, tanks and hoods, bent-tube racks and frames, lathed tyres with lugs, and suspension arms and shocks posed from the physics wheel heights every frame. Static parts are merged per material.

**Quads** (`src/vehicle/quadSpecs.js`, `src/vehicle/quadUnit.js`). Each quad is a spec (name, colour and overrides for engine, vehicle, vibration, audio and smoke parameters) built into a `QuadUnit` that owns its engine model, physics, vibration, smoke and sound. To add a third, add a spec and a spawn point in the layout.

**The weather and the girls' minds** (`src/world/weatherHost.js`: the weather switches, the time of day, the wind and the snow coat; `src/npc/mindsHost.js`: each girl's needs and what she chooses to do) are hosts `game.js` builds and calls inside the frame guard (#126); the state they work on stays on the game. `src/items/powerHost.js` does the same for the batteries, the booster pack, the bench charger and the generator. `src/items/toolsHost.js` does the same for the hand tools and bottles: putting them down, the dipstick and tank dip, and pouring coolant or anti-gel.

**The rolling road** (`src/farm/rollingRoad.js` is the pure part: the power curve, a run as a small state machine that returns the throttle and load to hold, the road days, what the farm keeps and the slip; `src/world/rollingRoadSite.js` the trailer's geometry from where the Tor or Crag stops; `rollingRoadModel.js` the trailer; `rollingRoadHost.js` the visit, colliders, the screen, the run and the girls; `rollingRoadView.js` the slip and the wall sheet). The tuner is a `Visit` of her own in `traffic.js` with a `stay` step, so the lane's visitors still come. A run reads the engine model's own `power` and `rpm` and feeds `quad.pto` back, the hook the tractor's log splitter uses. Tested in `tests/rollingRoad*.test.js`.

**Roads** (`src/world/roads.js`, `roadMesh.js`). Every road is one entry in `layout.roads`: a centreline, a width, a surface, markings, verges, junctions. `roads.js` is the pure part and answers where the tarmac is (`tarmacAt`, `surfaceAt`), the nearest road, how to level the ground across one (`levelAt`, with a camber and a check for cuttings over 1.5 m), the points along one for traffic routes and the map (`pointsAlong`, `lanePath`) and the passing places on single track. `roadMesh.js` draws them: a strip of carriageway, markings as decals, kerbs and the tarmac texture, shared by the lane and the village street; the farm road is painted into the ground instead (`groundTexture.js`), so mud and weather lie on it. Tests in `tests/roads.test.js`, `roadMesh.test.js` and `groundRoad.test.js`.

**Fields** (`src/world/fieldPlan.js`, `fieldMap.js`, `polygons.js`, `fields.js`). Each field is a clockwise polygon with a kind, each hedge a line with gaps given as metres along it, and a gateway the two points either side of a gap. `fieldPlan.js` builds today's farm from the layout, `fieldMap.js` answers where a point is, how far the hedge is and the way round from any plan, and `fields.js` adds the tarmac, stubble and the rest. Pure geometry in `polygons.js`; tests in `tests/polygonFields.test.js` and `tests/fieldsPolygons.test.js`.

**The ground** (`src/world/groundTiles.js` is the pure part; `terrain.js` draws it). `layout.ground` is a rectangle of whole metres, sampled once at 1 m into a `GroundGrid` that is both the one Rapier heightfield and what every drawn tile reads. The drawn ground is tiles of about 64 m at 1, 2, 4 or 8 m by distance, built nearest first as you move (`World.update` runs `updateGround` in the frame guard), with a tile's edge laid on its coarser neighbour's line so they meet. The ring of coarse ground beyond is `layout.outerMargin` round it. The ground is painted a tile at a time as you come near (`groundPaint.js` is the pure part: which tiles, nearest first, a few milliseconds a frame; `groundTexture.js` paints a window of the ground onto a canvas, every random number belonging to its cell or item so windows agree), over one coarse painting of all of it; the tarmac map for the shine is made only near roads (`roadWet.js`, `fields.tarmacBoxes()`). `layout.budgetSpots` names extra places for the frame budget. Tests in `tests/groundTiles.test.js`, `groundPaint.test.js` and `groundPaintWindows.test.js`.

**Layout** (`src/world/layout.js`). Positions for the field, barn, gate, track control points and spawn points all live here. What belongs to a building (the barn's bench, the yard's bell, the village's cottages) is written as an offset from that building's anchor, inside `at('barn', ...)`, and `resolveLayout` (`src/world/layoutAnchors.js`) turns it into the absolute numbers every reader of `LAYOUT` uses, so moving a building is changing its anchor.

**Parameters**. Every tunable number lives in a `*Params.js` file next to the code that uses it, with a range for the tuning panel.
