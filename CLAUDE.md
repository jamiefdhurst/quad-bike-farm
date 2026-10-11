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
- **Girls** (`girlsTab.js`): one folder per girl: what she is doing, then "Why", then her actions in a closed "Make her do" folder (so both girls' details fit on screen at once), then favour and romance, then skills; shared things go in "Both girls and the farm". A new girl behaviour that can be started gets an action button (in "Make her do") for whoever does it, using a `forced` flag or request method on the module rather than waiting for chance. Per-girl state is per girl, not a list mixing both.
- **Tune** (`tuneCategories.js`): every `registerTuning` group needs a place in `TUNE_CATEGORIES`, in the category it belongs to (driving, engines, items, world, or one of the girls' three). A test fails until it is listed. Groups sort by category then name; don't rely on registration order.
- Actions live with the thing they act on (vehicle actions on Vehicles, girl actions on her folder), never in a separate pile.
- Buttons and settable values call the real game methods (as the in-game action does), so what you see in the panel is what the game does. Anything pure the buttons need goes in a tested module, not inline.
- Not persisted: no saved tabs, folders or values.
- The console (backslash, `src/console`) is the same state by typed path. A new vehicle state, girl value or world setting that goes in the panel goes in `gameTree.js` too (tuning groups appear on their own), and a new on-demand girl action goes in `src/debug/girlActions.js`, which both the Girls tab and `girl <name> <verb>` use. Commands are tested in `tests/consoleShell.test.js` against a stand-in host.

## The girls' minds

How the girls notice, react and decide is being rebuilt (TODO 130 to 137) so each part lives in one place and everything new plugs into it rather than bringing its own timers and dice. Follow every part below for anything new the girls do; `tests/girlsMinds.test.js`, `tests/reactions.test.js`, `tests/availability.test.js`, `tests/needs.test.js` and `tests/chooser.test.js` check what they can. Read DECISIONS.md's sections for TODO 130 onwards before changing any of it.

### What she decides to do (needs and the chooser)

What a girl does on her own follows from what she wants (`src/npc/needs.js`: warmth, company, excitement, rest, something to do) and is chosen in one place (`src/npc/chooser.js`, run by `updateMinds` in game.js every couple of seconds while she's free). Never give a new thing she does on her own its own timer and `random() < chance`.

- **A new thing she decides to do on her own** is an offer: give it an `OFFER_KINDS` entry (a label, the needs it satisfies and by how much, `urgent` if she should stop something idle for it), have its pure module return `offers(ctx)` (whether she could do it now: weather, distance, cooldowns, room; with a `weight` param for how keen she is) and `take(offer)` (what the old start did, returning the event), handle that event in a game.js method the update loop shares, and add the module to `offersFor` in game.js. The module's update keeps everything after she's started, and never starts it itself (each moved module has a test for that). A debug-panel force may still start it directly.
- **Something that should change what she wants** goes in `needsContext` in game.js (what moves the needs) or `Needs.update`, with its rate as a `need*` param. A new need goes in `NEEDS` with a label, and every offer that meets it says so.
- **A new boredom choice** is an entry in `boredOdds` and an offer in `boredOffers` on the companion.
- **How she goes about it** (`src/npc/intent.js`): give the offer kind a `pace` ('hurry', 'brisk' or 'dawdle') if it calls for one; have her say she's off to do it if it has no line yet; anything new that takes her from what she was doing for you (a new way of asking or calling her) calls `companion.interrupt()` first, as the wheel and the bell do.
- Personality is weights and rates in `characters.js` (Jess's restlessness, Amy's cold), not rules.
- The Girls tab's "Why" folder shows her needs (settable), what she chose and for what, and what she nearly chose: use it, and `Think now`, to see a new offer working rather than waiting for chance. Everything a girl decides to do with her free time is an offer now; the things left on their own clocks are reactions (to your rev, to being left on a quad, to falling out) and are listed in DECISIONS.md ("Needs and a chooser (TODO 133): the rest moved"). A new reaction stays a reaction; a new choice is an offer.

### Is she free? (availability)

One answer, `companion.availability()` (`src/npc/availability.js`, pure, tested): `{ free, why, settled, held, canRemark }`. Never decide from `fsm.is('idle')` plus flags (a test fails on that in game.js).

- **Giving her something to do on her own** (a feature starting something): `c.availability().free`.
- **Something she'd only notice or remark on** (a smell, a quad going by): `c.availability().canRemark` (stood about or sat resting, and nothing holding both girls).
- **You asking her** (the wheel, the debug panel, the console): `c.availability({ asked: true })`; soft jobs give way and the farm's holds don't count. Say `why` when she's busy.
- **A feature checking its own girl mid-job**: pass `mine` (its job flag or hold key) so its own job doesn't count against her.
- **A new thing she does that should keep other features off her**: a feature that has her for a while calls `c.hold(key, why)` and `c.release(key)`; a flag on her goes in `JOBS` (soft if your asking should interrupt it). Something that holds both girls at once goes in `worldHold` (set in game.js).
- **A new state** gets a `STATE_WHY` entry (the test fails until it has one).
- The request methods' own `fsm.is('idle')` guards stay: they're what the state machine can do from where she is, not whether she's free.

### What she looks at (attention)

Decided in one place, `src/npc/attention.js` (pure, tested). Never turn her head or set `rig.lookTarget` from a feature.

- **Something happens that she would notice** (a sound, a crash, something worth turning to see): call `game.notice(kind, at, { key, strength })` where it happens. `kind` must be in `NOTICE_KINDS` (add it with its seconds, range, heard and interest, and its salience in `DEFAULT_NOTICE_PARAMS`, which is the "What catches the eye" tuning); the test fails for an unknown kind. Vehicle events (engine, horn, tipping, revving) come through `src/npc/noticeWatch.js`: add a new one there rather than calling notice from the vehicle.
- **A new state** (in `companion.js`, `companionDriving.js`, `companionHayRide.js`, `companionResting.js` or a new state file) has a `look`: `'free'` (whatever catches her eye), `'own'` (another poser has her head, as the pillion pose does, and gets attention's pick to turn it), or a function returning a focus `{ x, y, z, weight }` (`lookAtVehicle`, `lookAhead`). The test fails until it has one.
- **A sub-activity inside a state** (warming her hands while idle) calls `companion.attend(point, { weight, seconds })` while it's doing it.
- **Walking somewhere** needs nothing: from standing she looks at the target first (`lookLead`). A walk that mustn't pause puts `hurry: true` in the walking state's data.
- **Something new that pins her where she stands** (hands on something, a pose) adds itself to `freeToTurn()`, so she doesn't turn round to look mid-way through it.
- **Someone or something she should keep an eye on all the time** (not a one-off event) goes in `attentionWorld` in `game.watchNotices`.

### How her body reacts (reactions)

A flinch, a step back, hands over her ears or her mouth, a cheer, turning away from smoke: `src/npc/reactions.js` (pure, tested) says which and when, `src/npc/companionReacting.js` poses it (the last rig poser, so it shows over anything else). Never pose a startle, a recoil or a gesture of surprise inside a feature.

- **A notice that should make her move**: add a rule to `NOTICE_REACTIONS` (which reaction, within how many metres, a chance or the name of her param holding it, `notOwn` for things she shouldn't react to on her own vehicle). Nothing else is needed: every notice is checked.
- **A feature that makes her react directly** (a line that goes with a jump back, smoke she breathed): call `companion.react(type, { from, strength })`, and fall back to something smaller if it returns false (she wasn't free to).
- **A new kind of reaction**: add it to `REACTIONS` (its timing and what it needs: `'any'`, `'feet'` or `'hands'`), its pose in `poseReacting`, check `mayReact` covers who may do it, and it gets a debug button for free from the list in `girlActions.js` (add it there). Look at it in a headless screenshot from in front of her (`.scratch/pp/reactshot.mjs`): IK targets are the wrists and the fingers reach on past them, so hands aimed at her middle cross.
- **Something new that occupies her hands** (holding, carrying, a pose with the hands on something) makes `mayReact` say no to `'hands'` reactions while it lasts.
- Per-girl differences go in her params (`reactEarsChance`, `reactCheerChance`, `reactCheerArms`, `reactFlinch` in `characters.js`), not in the rules.

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
2. Debug panel: anything new that can be tuned, watched, set or started is in the panel as above. Docs: README.md describes the feature for a player (new or changed keys go in `src/hud/controls.js`, which the in-game help and the FAQ both read); the FAQ gets an answer for it (see "The FAQ and the start screen" below); add a short section to DECISIONS.md with what was decided and why, and numbers where you measured something; credit any asset in ASSETS.md. Mark the item **Done.** in the README TODO list (keep its number). Anything new the girls do, notice or react to follows "The girls' minds" above.
3. Commit in sensible chunks with plain messages saying what changed for the player ("Let the girls share a quad, one driving and one on the back"): they become the FAQ's "Recently changed" list as written. No AI attribution of any kind: no Co-Authored-By, session links or "Generated with" lines. Other sessions may be working in the same tree, so stage only the files (or lines) you changed, by name: never `git add -A`, `git add .` or `git commit -a`.
4. `git push origin main`.
5. Tell Jamie in a few lines what changed, what you checked and what you didn't.
