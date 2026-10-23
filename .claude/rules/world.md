---
paths:
  - "src/world/**"
  - "src/effects/**"
---

# The world: the day, lights and things in numbers

- The day moves on (`src/world/daylight.js`): the temperature, the frost and the light change over a game, so read `weather.temperature`, `weather.frost` and `daylight.darkness` as they are now, never once at the start. An effect drawn with its own fixed light colour (a custom shader, a sprite) gets dimmed with the daylight in `updateWeather`, or it glows at night.
- A new light source goes through the fixed pool in `effects/vehicleLights.js` (or a light made at the start and only dimmed), never a light added mid-game, which recompiles every shader.
- Anything scattered over the farm in numbers (plants, stones, posts) goes through `tiledInstances` (`src/world/tiledInstances.js`) or `instanceModel`, never one InstancedMesh for the lot, which is never culled; small ground cover also registers with the draw distance (`drawDistance.add`). docs/decisions/world.md, "Drawing less (frame time)".
- After anything that adds to the world or to every frame's work, run `node .scratch/pp/perf.mjs` (see `checking.md`).
