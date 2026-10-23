---
paths:
  - "tools/smoke.mjs"
  - "tools/render_engine_sound.mjs"
  - "src/core/featureGuard.js"
---

# Checking beyond the unit tests

- **Smoke test.** `npm run smoke` (`tools/smoke.mjs`) starts Vite, opens the game in headless Chrome with software GL, clears the overlay so frames run, and plays three set-ups for about 20 s each (`SMOKE_SECONDS=10` for shorter, `node tools/smoke.mjs 2` for one). It fails on a page error, a `console.error`, a feature the frame guard caught, a NaN position, a girl more than 0.6 m off the ground or a vehicle more than 2 m under it. Unit tests never build `game.js`. It needs Chrome (`CHROME_PATH` if it isn't in a usual place).
- **The frame guard.** Per-frame feature updates in `game.js`'s main update go through `this.guard.run('updateX', () => this.updateX(dt))` (`src/core/featureGuard.js`), so one feature's error is logged once with its name and counted and the rest of the frame still runs. The count shows in the console's `errors` and the Tune tab's "Frame time" folder.
- **Headless checks**, only for model work or where you can get past the "Click to play" overlay (click it every time the page loads, and confirm it in the screenshot): puppeteer-core in `.scratch/pp` (untracked) with system Chrome, existing scripts there to copy from (the "headless-browser-checks" memory). Run your own dev server from your worktree with `npx vite --port 5180` in the background; Jamie's is on 5173. Editing source while a headless check runs reloads the page under it.
- **Engine sound:** `node tools/render_engine_sound.mjs <vehicle id> out.wav` renders it offline through the real engine model and worklet (idle, full throttle, idle, half, full) in seconds. `--bank` and `--set` to compare, `--start` for the start (key, starter, catching), `--start --no-catch` for four seconds of cranking on an empty tank. Leave the WAVs in `.scratch/` for Jamie to listen to.
- **Frame time:** `node .scratch/pp/perf.mjs` (dev server on 5180) checks the spawn view's draw calls, triangles and ms a frame against a budget and profiles a few seconds by function. Run it after anything that adds to the world or to every frame's work; `perf` in the game's console does the same live.
- **Loading:** `node .scratch/pp/loadtime.mjs` (dev server on 5181) times each loading step to "Ready"; keep it under about 2.5 s, and run it after anything that adds to loading. `loadprof.mjs` says which functions take the time.
