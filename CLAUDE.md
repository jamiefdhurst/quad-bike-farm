# Quad bike farm

First-person British farm quad-bike game: Three.js, Vite, ES modules, Rapier physics, Vitest. Two companions, Amy and Jess, who ride, drive, bicker and talk. README.md says what the game does; DECISIONS.md records why things are the way they are (read the section for whatever you're touching before changing it).

## How work is done here

- Autonomous: don't ask whether to write the code, just do it. Do ask when there's a real decision the TODO item doesn't settle (look, feel, scope, which of two behaviours). Ask once, up front, as a short numbered list with a recommendation for each. Jamie answers in a matching numbered list. If nothing needs deciding, don't ask.
- Plan briefly, then build. Keep to the item; note other ideas at the end rather than doing them.
- Assets: CC0 or public domain only, credited in ASSETS.md. Prefer procedural.
- Prose (docs, commit messages, comments, lines the girls say): British English, no em dashes, no throat-clearing.
- The girls refer to the player only as "you", never "he" or "she" or "they".

## Code

- `src/game.js` wires everything together. `src/start` and `src/faq` are the start screen and the FAQ page (below). Behaviour lives in modules: `src/npc` (companions: `companion.js` state machine, `companionDriving.js`, `herDriving.js` her driving brain, `companionVoice.js` + `voiceLines.js` + `jessLines.js` + `banterLines.js` what they say, `characters.js` who they are), `src/vehicle` (`quadSpecs.js` the five quads, `quad.js`, `quadPhysics.js`, `quadModel.js` procedural bodies, `bog.js`), `src/engine` (engine model and params), `src/audio`, `src/effects` (smoke, mud, rain), `src/world` (terrain, layout, weather), `src/items` (jerry can, hose, toolbox, winch), `src/workshop` (toolbox tuning), `src/debug` (the debug panel).
- Keep logic pure and testable where you can (no Three.js or DOM), with a test in `tests/`. Look at `boredom.js`, `bog.js`, `banter.js` for the pattern.
- New tunables go in the module's `DEFAULT_*_PARAMS` with a one-line comment, plus a `[min, max, step]` entry in its ranges, registered with `registerTuning` so they show in the debug panel (see "Debug panel" below).
- Match the surrounding style: single quotes, about 140-column lines, comments that say why. There's no prettier or eslint config; don't run either over existing files.
- A quad spec must name a `style` and `dashStyle` that exist (a test checks); the game won't load otherwise.

## Debug panel

Backtick opens it. It has three tabs, each with a job; keep them that way, and keep each one ordered by what matters rather than by when it was added. Show what is worth tweaking or watching, not every internal number.

- **Vehicles** (`debugGui.js`, `vehicleDebug.js`): the picked vehicle (or whichever you're on). Order: actions, Running, Problems, Quirks, Tyres, how it was dealt, then every vehicle's own tuning. A new vehicle state goes in Running if you'd watch it and in Problems if it can go wrong; anything that can go wrong must be settable and clearable there, and "Put it right" must clear it (add it to `fixEverything`, with a test). A new quirk or fault is listed automatically from its kind list.
- **Girls** (`girlsTab.js`): one folder per girl, her actions first, then what she is doing, then favour and romance, then skills; shared things go in "Both girls and the farm". A new girl behaviour that can be started gets an action button for whoever does it, using a `forced` flag or request method on the module rather than waiting for chance. Per-girl state is per girl, not a list mixing both.
- **Tune** (`tuneCategories.js`): every `registerTuning` group needs a place in `TUNE_CATEGORIES`, in the category it belongs to (driving, engines, items, world, or one of the girls' three). A test fails until it is listed. Groups sort by category then name; don't rely on registration order.
- Actions live with the thing they act on (vehicle actions on Vehicles, girl actions on her folder), never in a separate pile.
- Buttons and settable values call the real game methods (as the in-game action does), so what you see in the panel is what the game does. Anything pure the buttons need goes in a tested module, not inline.
- Not persisted: no saved tabs, folders or values.
- The console (backslash, `src/console`) is the same state by typed path. A new vehicle state, girl value or world setting that goes in the panel goes in `gameTree.js` too (tuning groups appear on their own), and a new on-demand girl action goes in `src/debug/girlActions.js`, which both the Girls tab and `girl <name> <verb>` use. Commands are tested in `tests/consoleShell.test.js` against a stand-in host.

## The girls' attention

What a girl looks at is decided in one place, `src/npc/attention.js` (pure, tested), so the girls seem to notice the world. Never turn her head or set `rig.lookTarget` from a feature; anything new for the girls follows this pattern, and `tests/companionLooks.test.js` checks what it can:

- **Something happens that she would notice** (a sound, a crash, something worth turning to see): call `game.notice(kind, at, { key, strength })` where it happens. `kind` must be in `NOTICE_KINDS` (add it with its seconds, range, heard and interest, and its salience in `DEFAULT_NOTICE_PARAMS`, which is the "What catches the eye" tuning); the test fails for an unknown kind. Vehicle events (engine, horn, tipping, revving) come through `src/npc/noticeWatch.js`: add a new one there rather than calling notice from the vehicle.
- **A new state** (in `companion.js`, `companionDriving.js`, `companionHayRide.js`, `companionResting.js` or a new state file) has a `look`: `'free'` (whatever catches her eye), `'own'` (another poser has her head, as the pillion pose does, and gets attention's pick to turn it), or a function returning a focus `{ x, y, z, weight }` (`lookAtVehicle`, `lookAhead`). The test fails until it has one.
- **A sub-activity inside a state** (warming her hands while idle) calls `companion.attend(point, { weight, seconds })` while it's doing it.
- **Walking somewhere** needs nothing: from standing she looks at the target first (`lookLead`). A walk that mustn't pause puts `hurry: true` in the walking state's data.
- **Something new that pins her where she stands** (hands on something, a pose) adds itself to `freeToTurn()`, so she doesn't turn round to look mid-way through it.
- **Someone or something she should keep an eye on all the time** (not a one-off event) goes in `attentionWorld` in `game.watchNotices`.

## The FAQ and the start screen

The start screen (`index.html`, `src/start/startScreen.js`, the logo in `src/start/logo.js`) links to `faq.html`, the how-to page for a player, which should always be the best place to learn the game. Half of it is generated from the game's data so it can't go stale: the controls (`src/hud/controls.js`), each vehicle's facts (`src/faq/facts.js`, from its spec), the girls (`characters.js`), the bucket list (`achievements.js`) and "Recently changed" (the commit messages, via `vite.config.js`; `src/faq/changes.js` drops housekeeping ones). The other half is hand-written in `src/faq/faqContent.js`.

- Every item that changes what a player sees or does updates the FAQ: add the questions a player would ask about it ("How do I...", "Why won't...") with answers, and fix any existing answer it makes wrong (search `faqContent.js` for the feature's words). Better one more question than a longer answer.
- A new vehicle needs a `VEHICLE_NOTES` entry and a new girl a `GIRL_NOTES` entry; `tests/faq.test.js` fails until they have one. If a vehicle fact the page shows is wrong, fix `facts.js` rather than the note.
- Mark anything the game deliberately hides (a secret, a hidden mechanic, a romance beat) `spoiler: true` so it folds away. Give useful short answers a `tip` (under 140 characters, never a spoiler): the start screen shows them.
- When Jamie asks how something works, or something turns out to be confusing, add it to the FAQ as well as answering.
- The page is for a player: what to do and what happens, not file names or tuning numbers (those go in "For tinkerers" if anywhere). Same prose rules as the rest: British English, no em dashes, the player is "you".
- The logo is drawn in code. Keep "by Jamie Hurst" on it.

## Testing (keep it cheap)

- `npm test` (Vitest) must pass before every commit. Add or update unit tests for any logic you change.
- Don't do headless browser checks. They are slow and costly, and screenshots keep coming out showing the "Click to play" overlay instead of the game. The only exception is a check where you have worked out how to get past the overlay (click it, every time the page loads) and can confirm that in the screenshot. Otherwise rely on unit tests, and say in your summary what you didn't verify. No long simulation runs, no repeated tuning loops: pick sensible values.
- If you do use the exception above, the headless setup (see the "headless-browser-checks" memory): puppeteer-core in `.scratch/pp` (untracked) with system Chrome; existing scripts there to copy from (`errs.mjs` checks the game loads without errors). Run your own dev server with `npx vite --port 5180` in the background; Jamie's is on 5173. Editing source while a headless check runs reloads the page under it.
- Engine sound: `node tools/render_engine_sound.mjs <vehicle id> out.wav` renders it offline through the real engine model and worklet (idle, full throttle, idle, half, full) in seconds, no browser. Use it to compare banks or settings (`--bank`, `--set`), `--start` to hear the start (key, starter, catching) instead, and `--start --no-catch` for four seconds of cranking on an empty tank; leave the WAVs in `.scratch/` for Jamie to listen to.
- Loading: `node .scratch/pp/loadtime.mjs` (with your dev server on 5181) times each loading step to "Ready"; keep it under about 2.5 s, and run it after anything that adds to loading. `loadprof.mjs` says which functions take the time.
- Never make sound in tests: stub `speechSynthesis.speak` and set `game.audioHub.params.muted = true`.

## Voice lines

- Spoken lines are recorded into `public/audio/companion-voice*-NNN.mp3` (files of about a minute, decoded by the game only when a line in one is needed) by `tools/generate_companion_voice.py` (see the "voice-generation-setup" memory). After adding or editing lines, re-record in the background (cached, so only new lines take time):
  - `TQDM_DISABLE=1 PYTHONWARNINGS=ignore .scratch/cb/bin/python tools/generate_companion_voice.py --character amy --cache .scratch/voice-cache --fallback .scratch/piper/en_GB-cori-high.onnx --piper .scratch/venv/bin/piper` (for a whole new voice or settings, add `--workers 2`, about 1.7 times as fast, and run it under `caffeinate -i` so the Mac does not sleep)
  - the same with `--character jess` and no fallback.
- `--bank-only` rebuilds a bank from the cache without recording anything (about 12 s a girl), for when only the bank's format or packing changes.
- Unrecorded lines fall back to browser speech, so the game works before recording finishes; commit the banks when it's done.

## Finishing an item

1. `npm test` passes.
2. Debug panel: anything new that can be tuned, watched, set or started is in the panel as above. Docs: README.md describes the feature for a player (new or changed keys go in `src/hud/controls.js`, which the in-game help and the FAQ both read); the FAQ gets an answer for it (see "The FAQ and the start screen" below); add a short section to DECISIONS.md with what was decided and why, and numbers where you measured something; credit any asset in ASSETS.md. Mark the item **Done.** in the README TODO list (keep its number). Anything new the girls do or notice follows "The girls' attention" above.
3. Commit in sensible chunks with plain messages saying what changed for the player ("Let the girls share a quad, one driving and one on the back"): they become the FAQ's "Recently changed" list as written. No AI attribution of any kind: no Co-Authored-By, session links or "Generated with" lines. Other sessions may be working in the same tree, so stage only the files (or lines) you changed, by name: never `git add -A`, `git add .` or `git commit -a`.
4. `git push origin main`.
5. Tell Jamie in a few lines what changed, what you checked and what you didn't.
