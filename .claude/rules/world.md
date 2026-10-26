---
paths:
  - "src/world/**"
  - "src/effects/**"
---

# The world: the day, lights and things in numbers

- The day moves on (`src/world/daylight.js`): the temperature, the frost and the light change over a game, so read `weather.temperature`, `weather.frost` and `daylight.darkness` as they are now, never once at the start. An effect drawn with its own fixed light colour (a custom shader, a sprite) gets dimmed with the daylight in `updateWeather`, or it glows at night.
- A new light source goes through the fixed pool in `effects/vehicleLights.js` (or a light made at the start and only dimmed), never a light added mid-game, which recompiles every shader.
- Anything scattered over the farm in numbers (plants, stones, posts) goes through `tiledInstances` (`src/world/tiledInstances.js`) or `instanceModel`, never one InstancedMesh for the lot, which is never culled; small ground cover also registers with the draw distance (`drawDistance.add`). docs/decisions/world.md, "Drawing less (frame time)".
- A new set piece (a yard, a group of buildings), a barn fixture or a new kind of vehicle model is named in `src/world/farDetail.js` (`SET_PIECE_NAMES`, `BARN_PROP_NAMES`, `VEHICLE_NAMES`, matching its `group.name`), or it is drawn at any distance. docs/decisions/performance.md, "Draw less far away (#365)". A big one (the village, the neighbour's farm) also gets a cheap far version swapped in by distance, so it never pops out: build it with `buildFarVersion` (`src/world/farVersion.js`) and hang it on the full group's `userData.farVersion`; docs/decisions/performance.md, "A far version of the village and the neighbour's farm (#400)".
- Any small mesh in the scene is left out automatically while it would span under a point on the screen (`FarDetail.leaveOutSpecks`, by moving it to layer 1, never touching `visible`): don't put anything on layer 1, and mark a mesh that must always show, however far, `userData.keepFar` (lights and glows are kept already). docs/decisions/performance.md, "Parts too small to see (#451)".
- After anything that adds to the world or to every frame's work, run `node tools/perf.mjs` (see `checking.md`). CI also counts draw calls and triangles from fixed spots (the smoke test, `tools/frameBudget.mjs`) and prints each with its change from main in the Smoke job's summary: anything added to the world says what it changed there in the PR (in chat if the PR body has no place for it), and a budget is raised only on purpose, with a line in `docs/decisions/performance.md` saying why.
