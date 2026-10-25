# Performance

How fast the game runs and loads: the frame budget, drawing less, frame time on a real GPU, stutters and load time. Issues labelled `🚀 performance`, worked with `/perf` (`.claude/commands/perf.md`), which measures before and after with `tools/perf.mjs`.

## Where things stand

What is true now, with the sections below to read for the detail. Keep it current: an item that changes how something stands fixes the line here as well as adding its section.

- **The frame budget in CI.** Draw calls and triangles at five spots (spawn, yard, village street, wood gate, hilltop), the same on any machine, fail a PR over `BUDGETS` in `tools/frameBudget.mjs` (spawn 2,600 calls and 3.5M triangles; the others about 8% over what they measured after #365). Raised only on purpose, with a line here. "Holding the frame to its budget in CI (#364)".
- **Drawing less far away.** Set pieces, barn fixtures and vehicles' small parts are left out by distance (`src/world/farDetail.js`), and vehicles stop casting shadows past 80 m; scattered things go through `tiledInstances`/`instanceModel` and ground cover stops at 70 to 90 m. "Draw less far away (#365)", and in world.md "Drawing less (frame time) (2026-10-12)".
- **Frame time on Jamie's Mac** (`tools/perf.mjs`, real GPU, 1600 by 1000 at 2x): 11 to 15 ms a frame at every spot against a local budget of 8 ms, with every feature's own update under 0.15 ms, so the time is in drawing. Load: "Ready" in about 2.7 s from a fresh browser against 2.5 s. "A /perf command and a performance label (#396)".
- **Loading.** Voice files fetched when a line is wanted, engine banks within 45 m, the start screen's tips built in. In process.md: "Loading faster (2026-10-09)", "Smaller downloads (TODO 104, 2026-10-18)".
- **Open:** shaders prepared while loading (#372), counting stutters (#373), batching vehicles (#374), building areas only near (#375), parked vehicles sleeping (#150), less work far away (#152), fewer objects made every frame (#174), switched-off vehicles costing nothing (#225).

---

The sections below are the record, oldest first. A new decision goes at the end.

## Holding the frame to its budget in CI (#364)

- The budget (2,600 calls, 3.5M triangles at the spawn) had no enforcement and the spawn was over it after the village (4,477 calls, 4.36M). The smoke test now counts draw calls and triangles from `renderer.info` at five spots and fails over them: `tools/frameBudget.mjs` (`BUDGETS`), measured in the page smoke already loads. Frame ms is not checked, because software GL makes it meaningless; `perf.mjs` stays the local tool for that.
- A spot is measured as you on foot there looking north, east, south and west, worst view kept, so a view into a hedge can't hide a busy one. Spawn is the one exception: the view the game opens on. The game doesn't draw on every animation frame, so the counts are divided by renders (`info.render.frame`), not rAF ticks.
- Measured when set: spawn 4,477 calls and 4.36M; yard 5,652 and 4.31M; village street 5,227 and 4.24M; wood gate 3,424 and 4.14M; top of the pasture 4,271 and 7.54M. The last four got about 8% headroom (yard 6,100 and 4.7M, village 5,650 and 4.6M, wood 3,700 and 4.5M, hilltop 4,600 and 8.2M). They are strict from the start; the figures are the same on repeat runs.
- Spawn is in `KNOWN_OVER`: reported but not failed on until the "drawing less far away" issue brings it back under, then the list is emptied.
- The Smoke job's summary shows each spot against its budget with the change from main, measured on main's build the same way (`tools/budget.mjs`). If main can't be built or measured the table has no change column and the job still passes or fails on the budget alone.
- Raising a budget is deliberate: change `BUDGETS` and add a line here saying what was added and why it is worth it.
- `FeatureGuard` also times each guarded feature (smoothed, a feature run twice in a frame adds up) so the "farm features" stage can be split: the console's `perf` gives `slowestFeatures` and the Tune tab's "Frame time" folder lists the five slowest.

## Draw less far away (#365)

- At the spawn the game drew 4,470 things a frame: vehicles about 160 meshes each at any distance (and again for shadows), the village 960, the barn's loose props 270. `src/world/farDetail.js` (`FarDetail`, run from `World.update` every quarter second and in photo mode) now leaves things out by distance, all in the Graphics params (Tune tab, `tune.graphics`).
- **Set pieces** (`setPieceDistance` 160 m from the nearest edge of their bounds, found once): the neighbour's farm, brushwood, the log stacks, the cone courses. The village keeps its own `drawDistance`, now 150 m from the edge of its area (it was 260 m from its centre, which still drew it from the spawn).
- **Barn fixtures** (`barnPropsDistance` 15 m, nearest edge): the tyre and spares racks, charger, generator, helmet hooks, jumper rack, jacks, fuel tank. The issue said about 40 m, but the spawn is 34 m from the racks, so 40 saved nothing there; from outside the barn they sit behind a wall.
- **Vehicles** (`quad`, `trailer`, `tipTrailer`, `sprayer`): a part with a bounding sphere under 15 cm (bolts, cables, decals, brake bits; not a light's lens or anything that glows) never casts a shadow, and is hidden beyond `vehicleDetailDistance` 60 m. Past `shadowDistance` 80 m the whole vehicle stops casting. Found by size rather than by tagging each kit part, so every model gets it. Hidden parts come back only if we hid them, so a part the game hid stays hidden. This replaces the issue's invisible shadow boxes, which the shadow cut-off made unnecessary. A level change needs 5 m of margin, so a vehicle on the line doesn't flicker.
- **Tussocks and bracken** `roughDistance` 90 to 75 m: the triangles were still 3.85M at the spawn after the above; 60 m took it to 2.98M and 75 m to 3.29M.
- **Start screen tips** come from `vite.config.js` (`__FAQ_TIPS__`) so the first page no longer imports `faqContent.js`. The dev server's time to Ready measured 2.75 s afterwards (2.70 before); the saving is in the built start page, not measured.
- **Result** (`tools/budget.mjs` on a build, same on any machine): spawn 4,470 calls to 2,207 and 3.40M triangles; yard 5,652 to 2,945; village street 5,227 to 3,957; wood gate 3,424 to 1,901; hilltop 4,271 to 2,413 (6.97M triangles). Spawn is strict now (`KNOWN_OVER` is empty) and the other budgets are tightened to about 8% over these.
- Not done: merging static props (`mergeStatic`) in the barn and village, which the distance cut-offs made less pressing.

## A /perf command and a performance label (#396)

- Performance was becoming crucial and was only measured when a session remembered to. Settled with Jamie: a `🚀 performance` area label; `/todo` still takes issues in number order, performance ones included, and only `/perf` takes performance issues first; `/perf <n>` measures main before touching anything and the branch after, the same way, and a change that doesn't move the numbers is reverted rather than shipped; `/perf` alone is a check-up that finds the biggest cost and proposes an issue; the before and after table goes in the PR body and here.
- `tools/perf.mjs` replaces `.scratch/pp/perf.mjs` and `loadtime.mjs`: it builds and serves the checkout (or origin/main in a throwaway worktree with `--main`), loads it in Chrome on the real GPU, times "Ready" from the loading screen, and measures the frame budget's five spots with `measureInPage`'s new `dwell` (ms a frame, the worst frame and the three slowest features, worst view kept). Two runs by default, medians kept; `tools/perfReport.mjs` combines them and writes the table.
- Noise: two builds of the same game differed by up to 1 ms a frame at a spot and 3 ms in the worst frame, so `NOISE` calls less than 1.2 ms (and 4 ms worst) "same". Calls and triangles drift a little as main moves.
- Measured on main when it landed: spawn 2,204 calls, 3.40M triangles, 12.5 ms; yard 2,936, 13.1 ms; village 3,955, 15.2 ms; wood 1,913, 11.5 ms; hilltop 2,442, 6.97M, 14.6 ms; the worst frame at the spawn 31.8 ms. The 8 ms local budget is over everywhere: the first thing for `/perf`.
- Load is now timed from a fresh browser on a build (2.7 s to Ready), not the warm dev server the 2.5 s budget was set on (1.7 s then).
