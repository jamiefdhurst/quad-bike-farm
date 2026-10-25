---
paths:
  - "tools/smoke.mjs"
  - "tools/render_engine_sound.mjs"
  - "src/core/featureGuard.js"
  - "tools/frameBudget.mjs"
  - "tools/frameBudgetRun.mjs"
  - "tools/budget.mjs"
  - "tools/perf.mjs"
  - "tools/perfReport.mjs"
---

# Checking beyond the unit tests

- **Smoke test.** `npm run smoke` (`tools/smoke.mjs`) starts Vite, opens the game in headless Chrome with software GL, clears the overlay so frames run, and plays three set-ups for about 20 s each (`SMOKE_SECONDS=10` for shorter, `node tools/smoke.mjs 2` for one). It fails on a page error, a `console.error`, a feature the frame guard caught, a NaN position, a girl more than 0.6 m off the ground or a vehicle more than 2 m under it. Unit tests never build `game.js`. It needs Chrome (`CHROME_PATH` if it isn't in a usual place).
- **The frame guard.** Per-frame feature updates in `game.js`'s main update go through `this.guard.run('updateX', () => this.updateX(dt))` (`src/core/featureGuard.js`), so one feature's error is logged once with its name and counted and the rest of the frame still runs. The count shows in the console's `errors` and the Tune tab's "Frame time" folder.
- **Headless checks**, only for model work (one look at anything new you'll see, two rounds at most: `looks.md`) or where you can get past the "Click to play" overlay (click it every time the page loads, and confirm it in the screenshot): puppeteer-core in `.scratch/pp` (untracked) with system Chrome, existing scripts there to copy from (the "headless-browser-checks" memory). Run your own dev server from your worktree with `npx vite --port 5180` in the background; Jamie's is on 5173. Editing source while a headless check runs reloads the page under it.
- **Engine sound:** `node tools/render_engine_sound.mjs <vehicle id> out.wav` renders it offline through the real engine model and worklet (idle, full throttle, idle, half, full) in seconds. `--bank` and `--set` to compare, `--start` for the start (key, starter, catching), `--start --no-catch` for four seconds of cranking on an empty tank. Leave the WAVs in `.scratch/` for Jamie to listen to.
- **The frame budget in CI** (#364). The smoke test, while the farm is still sunny, stands you at fixed spots (spawn as the game opens, the yard, the village street, the wood's gate, the top of the pasture; each looking north, east, south and west, worst view kept), counts draw calls and triangles from `renderer.info` (the same on any machine, with the GL draws stubbed) and fails over `BUDGETS` in `tools/frameBudget.mjs`. Spawn is in `KNOWN_OVER`: reported, not failed, until the "drawing less far away" issue brings it under 2,600 calls and 3.5M triangles; then empty that list. The Smoke job's summary shows each spot with the change from main (main's build measured the same way by `node tools/budget.mjs --root ../main-base --dist dist`). Locally, `node tools/budget.mjs --dist dist --out numbers.json` measures a build on its own and `--summary numbers.json` prints the table. Raise a budget only on purpose, with a line in `docs/decisions/performance.md`.
- **Time per feature.** `FeatureGuard` times each guarded feature: the console's `perf` has `slowestFeatures` and the Tune tab's "Frame time" folder lists the five slowest. It splits the "farm features" stage, so look there before profiling.
- **Frame time and loading on a real GPU:** `node tools/perf.mjs --out after.json` builds and serves the checkout itself (no dev server needed), loads it in Chrome on this Mac's GPU and reports time to "Ready" and MB fetched, then at each of the five spots the draw calls, triangles, ms a frame, worst frame and slowest features, against the frame budget and the local ones (8 ms a frame, 2.5 s to Ready, `tools/perfReport.mjs`). About 80 s for two runs. `--main` measures origin/main the same way in a throwaway worktree, `--compare before.json after.json` prints the table, `--steps` the loading steps' timeline, `--profile 10 --dev` a CPU profile by function. Run it after anything that adds to the world, to every frame's work or to loading; `/perf` is built on it (`.claude/commands/perf.md`), and `perf` in the game's console gives the same figures live.
