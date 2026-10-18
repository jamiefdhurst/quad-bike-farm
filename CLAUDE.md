# Quad bike farm

First-person British farm quad-bike game: Three.js, Vite, ES modules, Rapier physics, Vitest. Two companions, Amy and Jess, who ride, drive, bicker and talk. README.md says what the game is and links the rest: `docs/game.md` what it does for a player, `docs/how-its-built.md` the code, `docs/console-and-panel.md` the debug tools; DECISIONS.md records why things are the way they are (read the section for whatever you're touching before changing it).

## How work is done here

- The to-do list is the GitHub issues (labels in `.github/settings.yml`); `/todo` works one, `/idea` adds them. Each item is built in its own worktree (`tools/worktree.sh`) on a branch, opened as a pull request with the issue's labels and set to merge itself when the Test check passes. Never commit to `main` or switch branch in the main checkout: other sessions are working in it. DECISIONS.md, "Issues, pull requests and releases (TODO 106)".
- Autonomous: don't ask whether to write the code, just do it. Do ask when there's a real decision the issue doesn't settle (look, feel, scope, which of two behaviours). Ask once, up front, as a short numbered list with a recommendation for each. Jamie answers in a matching numbered list. If nothing needs deciding, don't ask.
- Plan briefly, then build. Keep to the item; note other ideas at the end rather than doing them.
- Assets: CC0 or public domain only, credited in ASSETS.md. Prefer procedural. (One named exception: the girls' cars' engine banks use BBC RemArc recordings, allowed while the game is private; see the top of ASSETS.md.)
- Prose (docs, commit messages, comments, lines the girls say): British English, no em dashes, no throat-clearing.
- The girls refer to the player only as "you", never "he" or "she" or "they".

## Code

- `src/game.js` wires everything together. `src/start` and `src/faq` are the start screen and the FAQ page (below). Behaviour lives in modules: `src/npc` (companions: `companion.js` state machine, `companionDriving.js`, `herDriving.js` her driving brain, `companionVoice.js` + `voiceLines.js` + `jessLines.js` + `banterLines.js` what they say, `characters.js` who they are), `src/vehicle` (`detail/` the shared detail kit: tread, wear, decals, bolts, cables, brakes, real sizes, and the cab and interior pieces; `quadSpecs.js` the five quads, `quad.js`, `quadPhysics.js`, `quadModel.js` procedural bodies, `bog.js`), `src/engine` (engine model and params), `src/audio`, `src/effects` (smoke, mud, rain), `src/world` (terrain, layout, weather), `src/items` (jerry can, hose, toolbox, winch), `src/workshop` (toolbox tuning), `src/debug` (the debug panel).
- The farm remembers between loads (`src/farm`: `farmSave.js` the save and the day, `farmState.js` what a vehicle and the girls keep). Something new that is a vehicle's or a girl's lasting condition (wear, a fault, a level she has learnt) goes in `captureVehicle`/`restoreVehicle` (or `ENGINE_KEPT`) or `captureGirls`/`restoreGirls`, with a test; something about the farm's character that is dealt at random comes from a `this.farmSeed` stream, not `this.seed`. Read DECISIONS.md, "A farm that remembers (TODO 15)".
- Keep logic pure and testable where you can (no Three.js or DOM), with a test in `tests/`. Look at `boredom.js`, `bog.js`, `banter.js` for the pattern.
- New tunables go in the module's `DEFAULT_*_PARAMS` with a one-line comment, plus a `[min, max, step]` entry in its ranges, registered with `registerTuning` so they show in the debug panel (see "Debug panel" below).
- Match the surrounding style: single quotes, about 140-column lines, comments that say why. There's no prettier or eslint config; don't run either over existing files.
- A quad spec must name a `style` and `dashStyle` that exist (a test checks); the game won't load otherwise.
- The day moves on (`src/world/daylight.js`): the temperature, the frost and the light change over a game, so read `weather.temperature`, `weather.frost` and `daylight.darkness` as they are now, never once at the start. An effect drawn with its own fixed light colour (a custom shader, a sprite) gets dimmed with the daylight in `updateWeather`, or it glows at night. A new light source goes through the fixed pool in `effects/vehicleLights.js` (or a light made at the start and only dimmed), never a light added mid-game, which recompiles every shader.
- Anything scattered over the farm in numbers (plants, stones, posts) goes through `tiledInstances` (`src/world/tiledInstances.js`) or `instanceModel`, never one InstancedMesh for the lot, which is never culled; small ground cover also registers with the draw distance (`drawDistance.add`). Read DECISIONS.md, "Drawing less (frame time)".

## Using the detail kit (vehicle items 88 to 101)

Each vehicle's "in full detail" item uses the shared kit in `src/vehicle/detail/` (DECISIONS.md, "A shared detail kit for the vehicle models (TODO 87)"). The aim is a model much more in proportion and much more like its real counterpart. Work one vehicle at a time.

- **Start with proportion.** Check that vehicle's entry in `REAL_SIZES` (`realSizes.js`) against the real one's published figures and correct it if it's wrong, then look at its errors: write a scratch test that prints `proportionErrors(measureModel(model, layout), REAL_SIZES[id])` (build it with `buildAllModels` in `tests/helpers/vehicleModels.js`). DECISIONS lists where each vehicle stood when the kit landed. Fix the body's shape until every measure is within 8%, then add the id to `IN_PROPORTION` so the test keeps it there.
- **Fixed points stay put**: seats, grips, footrests, pegs, dash, cameras, rider and pillion anchors, rack, mug, hitch, winch (`tests/fixedPoints.json`, checked to 2 mm). Build the new body round them. If one is badly out of proportion itself, moving it is a decision: ask Jamie, check the girls on it, regenerate with `UPDATE_FIXED_POINTS=1 npx vitest run tests/vehicleModels.test.js`, and say why in DECISIONS.
- **Triangle budget** (`budgets.js`, checked in `tests/vehicleModels.test.js`): put detail where it shows from the seat and from beside it, not underneath.
- **The pieces.** Tyres: `treadTyre(kind, { radius, width, rimR, count })` (`tread.js`; pick the kind that matches the real tyre). Bolts: `boltsMesh(points, normal, material, { size, kind })` with `boltCircle`/`boltRow` (`fixings.js`). Cables and hoses: `cableGeometry(anchors, r)` and `hoseGeometry(anchors, r, { ribbed })` through the points they're clipped to (`cables.js`). Brakes: `discGeometry`, `caliperGeometry`, `drumGeometry` (`brakes.js`; the disc and drum go in the wheel's `spin` group, the caliper and backing plate in the wheel group). Decals: `decalMesh(kind, opts, { width })` (`decals.js`): `badge` with the maker from `MAKER_FOR`, `stripes`, `warning`, `chassis`, `number`, `dealer`. Place a decal 1 mm off the surface. Never a real maker's name; the test checks the strings.
- **The cab and interior pieces** (TODO 340, DECISIONS.md "A cab and interior kit"): `buildSteeringWheel` (`steeringWheel.js`), `buildSeat` (`seats.js`), `buildSeatBelt` (`belts.js`, the `stowed`/`worn` children the belt poser expects), `buildLever`, `buildHandbrake`, `buildPedal` (`cabControls.js`), toggles, rockers, knobs, bezels, vents and the glovebox (`switchgear.js`), `buildMirror` (`mirrors.js`), `buildLamp` (`lamps.js`, the lens named `lens` for the light code), handles, catches, hinges, grilles, wipers and seals (`fittings.js`), `trimMaterial` (`trim.js`, big surfaces with UVs only) and `buildRoadWheel` (`roadWheels.js`). Each takes `mats` overrides of the palette in `parts.js`. Replacing a vehicle's own part with the kit's keeps the names the game looks for (gearLever, parkBrakeLever, handlebars, belt_<seat>...) on the same groups, at the same fixed points.
- **Touch wear** comes from the named levers, pedals, footrests and seat points; add a vehicle's own (a door sill, a grab handle) as `userData.touchWear` in the body's frame.
- **Wear** is not modelled by hand. The wear layer finds the edges and nooks of whatever geometry there is, so give parts real edges (a box-like panel, not a smooth blob) where paint should rub through. Set how worn the vehicle is with `bodyWear` on its spec. Don't paint rust or mud into a material's colour.
- Matching the real thing means its look, not its name or badge: the makers are made up (Kestrel, Tamura, Ridgeback, Viper, Hartley, Moorland, Thorne, Ashby).
- Check with tests, and for a vehicle model also by eye (see "Lessons from the red quad" below): the tests can't see a gap or a floating label.

### Lessons from the red quad (item 88)

The red took many rounds because these were missed. Do them first on every vehicle item.

- **Ask for reference photos before building.** Photos of the real machine: the body from the sides, front and rear, and its controls. Memory and web searches gave boxy fenders, round headlights and a floating hitch; with photos it took one round. If there are none, ask; don't build from memory.
- **Look at renders of model work.** Unit tests can't see a gap, a floating label or a part ending in the air, so this is the exception to "no screenshot rounds". Use `.scratch/pp/redshot.mjs` as the pattern: it hides the HUD, fixes the camera, and works with the overlay clicked through. Shoot front-side, rear-side, above, and from the seat for controls, and crop in close (a narrow fov) for lettering. Say what you did and didn't see.
- **No see-through gaps.** Every edge should join something: a deck's end, a rack leg, a frame rail, a brace. Make parts meet exactly (shared heights and edges, a wall at a deck's end, a cover between decks) and test that they do. A bar must end on a surface, never in the air.
- **No straight edges where the real thing is moulded.** Crown, roll and round the plastics (`foremanDeck.js`); sweep the ends in plan and in height.
- **Lettering and labels.** Put them on flat, square-edged faces, not rounded corners, and 1 mm off the surface. Put each at its measured place from the photo, once.
- **Holes.** Rounded boxes butted edge to edge leave a notch at every corner where two meet, and where three meet it goes right through: pinholes in every door and post. Build panels and posts from plain boxes (or overlap the pieces by more than the radius). Add a ray-grid test like `tests/defenderModel.test.js`'s: fire rays at each side and the back from outside, on a grid that does not line up with the seams, and fail if one hits the inside instead of the skin. Never say a gap is fixed without it.
- **Z-fighting.** Two surfaces 1 mm apart fight at distance. Embed an attached part a few millimetres into its parent.
- **Fixed points may move on purpose.** The red's handlebars went 40 mm lower: regenerate `tests/fixedPoints.json` for that vehicle only, check nothing else changed, and say why in DECISIONS.
- **Touch wear.** `touchWear` points are capped at eight in all, and a boot patch shows nothing on black vinyl. A part marked up with no neighbour uses `wearNookMin` on its mesh.
- **Controls.** Model them from the real machine's (the pod, levers, switches, thumb throttle) in a module like `foremanControls.js`. Parts the game poses keep their names; a new style (such as the choke's `slide`) needs `CHOKE_STYLES`, the quad's pose, a test, the debug panel and the console. Choke knobs are black, not yellow.
- **Reuse.** The red's pod, levers, 2WD/4WD rocker and thumb throttle are for the other quads' items to adapt, not rebuild. Check the gaps and the lettering in each from the seat.
- **Cluster badges.** A vehicle's cluster takes its maker's name (`makerBadge` in `dash.js`) in empty space on its face, and a number plate only if the vehicle would leave the farm.

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

How the girls notice, react and decide has been rebuilt so each part lives in one place and everything new plugs into it rather than bringing its own timers and dice. Follow every part below for anything new the girls do; `tests/girlsMinds.test.js`, `tests/reactions.test.js`, `tests/availability.test.js`, `tests/needs.test.js` and `tests/chooser.test.js` check what they can. Read DECISIONS.md's sections on it (from "The girls' attention" on) before changing any of it.

### What she decides to do (needs and the chooser)

What a girl does on her own follows from what she wants (`src/npc/needs.js`: warmth, company, excitement, rest, something to do) and is chosen in one place (`src/npc/chooser.js`, run by `updateMinds` in game.js every couple of seconds while she's free). Never give a new thing she does on her own its own timer and `random() < chance`.

- **A new thing she decides to do on her own** is an offer: give it an `OFFER_KINDS` entry (a label, the needs it satisfies and by how much, `urgent` if she should stop something idle for it), have its pure module return `offers(ctx)` (whether she could do it now: weather, distance, cooldowns, room; with a `weight` param for how keen she is) and `take(offer)` (what the old start did, returning the event), handle that event in a game.js method the update loop shares, and add the module to `offersFor` in game.js. The module's update keeps everything after she's started, and never starts it itself (each moved module has a test for that). A debug-panel force may still start it directly.
- **Something that should change what she wants** goes in `needsContext` in game.js (what moves the needs) or `Needs.update`, with its rate as a `need*` param. A new need goes in `NEEDS` with a label, and every offer that meets it says so.
- **A new boredom choice** is an entry in `boredOdds` and an offer in `boredOffers` on the companion.
- **How she goes about it** (`src/npc/intent.js`): give the offer kind a `pace` ('hurry', 'brisk' or 'dawdle') if it calls for one; have her say she's off to do it if it has no line yet; anything new that takes her from what she was doing for you (a new way of asking or calling her) calls `companion.interrupt()` first, as the wheel and the bell do.
- Personality is weights and rates in `characters.js` (Jess's restlessness, Amy's cold), not rules.
- **The two together** (`src/npc/pair.js`): going over to her friend and tagging along are offers; a new walk her friend may tag along on goes in `TAG_KINDS`. Stood together they face each other through `pairFacing` in the idle state, so anything new that turns a stood girl goes before it there or in `freeToTurn()`.
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
- **A new way of waiting about that fits what's around her** goes in `WAITING_IDLES` (`src/npc/waiting.js`, with what it needs) and `STANDING_IDLES` (its pose); `pins` makes her face the thing and not turn round, `hands` keeps hands-up reactions off. Each girl's taste for it is her `waitTastes` in characters.js.
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
- Apart from model checks (see "Lessons from the red quad"), don't do headless browser checks. They are slow and costly, and screenshots keep coming out showing the "Click to play" overlay instead of the game. The only exception is a check where you have worked out how to get past the overlay (click it, every time the page loads) and can confirm that in the screenshot. Otherwise rely on unit tests, and say in your summary what you didn't verify. No long simulation runs, no repeated tuning loops: pick sensible values.
- If you do use the exception above, the headless setup (see the "headless-browser-checks" memory): puppeteer-core in `.scratch/pp` (untracked) with system Chrome; existing scripts there to copy from (`errs.mjs` checks the game loads without errors). Run your own dev server from your worktree with `npx vite --port 5180` in the background; Jamie's is on 5173. Editing source while a headless check runs reloads the page under it.
- Engine sound: `node tools/render_engine_sound.mjs <vehicle id> out.wav` renders it offline through the real engine model and worklet (idle, full throttle, idle, half, full) in seconds, no browser. Use it to compare banks or settings (`--bank`, `--set`), `--start` to hear the start (key, starter, catching) instead, and `--start --no-catch` for four seconds of cranking on an empty tank; leave the WAVs in `.scratch/` for Jamie to listen to.
- Frame time: `node .scratch/pp/perf.mjs` (with your dev server on 5180) checks the spawn view's draw calls, triangles and the game's own ms a frame against a budget and profiles a few seconds by function; run it after anything that adds to the world or to every frame's work, and the console's `perf` in the game.
- Loading: `node .scratch/pp/loadtime.mjs` (with your dev server on 5181) times each loading step to "Ready"; keep it under about 2.5 s, and run it after anything that adds to loading. `loadprof.mjs` says which functions take the time.
- Never make sound in tests: stub `speechSynthesis.speak` and set `game.audioHub.params.muted = true`.

## Voice lines

- Spoken lines are recorded into `public/audio/companion-voice*-NNN.mp3` (files of about a minute, decoded by the game only when a line in one is needed) by `tools/generate_companion_voice.py` (see the "voice-generation-setup" memory). After adding or editing lines, re-record in the background (cached, so only new lines take time):
  - `TQDM_DISABLE=1 PYTHONWARNINGS=ignore .scratch/cb/bin/python tools/generate_companion_voice.py --character amy --cache .scratch/voice-cache --fallback .scratch/piper/en_GB-cori-high.onnx --piper .scratch/venv/bin/piper` (for a whole new voice or settings, add `--workers 2`, about 1.7 times as fast, and run it under `caffeinate -i` so the Mac does not sleep)
  - the same with `--character jess` and no fallback.
- You do the waiting and the committing, never Jamie. Start the recording so you are told when it ends (`run_in_background`), or poll it, and when both girls have finished check `git status` for the changed `public/audio/companion-voice*` files, stage them by name and commit ("Record the new lines for ...") on the item's branch, before its PR merges. Do this in the same session, before you give your final summary, and never hand the step back as "commit the banks when it's done". If the recording fails, fix it or say so plainly.
- `--bank-only` rebuilds a bank from the cache without recording anything (about 12 s a girl), for when only the bank's format or packing changes.
- Unrecorded lines fall back to browser speech, so the game works before recording finishes; commit the banks when it's done.

## Versions and releases

Every merge to `main` that changes what ships (`src`, `public`, the pages, `vite.config.js`, the package files) is released by CI as `vX.Y.Z` with the built game zipped (`.github/workflows/release.yml`). The version bump comes only from the merged PR's labels (`tools/nextVersion.mjs`), so labelling the PR is how you choose it. Never tag, make a release or change `package.json`'s version by hand.

- Every PR has **exactly one type label**; the required "Version label" check fails until it does, and its summary says what the merge will release as. Use the issue's type label unless the work turned out to be something else.
- `✨ feature` (minor): something new the player can do or see. `⚡ enhancement` or `🐛 bug` (patch): an existing thing made better or fixed. `🔨 task`, `📚 documentation`, `🚨 tests` (patch, and usually no release at all, since they don't change what ships): work the player doesn't see. `⬆️ dependencies` is dependabot's.
- Add **`💥 breaking`** (major) on top only when an old farm save stops loading or loses something it kept: raising the oldest version `validSave` accepts, or dropping or renaming something `captureVehicle`, `captureGirls` or the farm save keep without carrying the old value across. Raising `SAVE_VERSION` with the old saves still loading is not breaking. Controls, balance and looks changing are not breaking.
- A push straight to `main` (Jamie's quick fixes) has no PR, so it releases as a patch.

## Finishing an item

1. `npm test` passes.
2. Debug panel: anything new that can be tuned, watched, set or started is in the panel as above. Docs: the FAQ gets an answer for it (see "The FAQ and the start screen" below), and new or changed keys go in `src/hud/controls.js`, which the in-game help and the FAQ both read; fix `docs/game.md` where it describes something the item changed (the README stays short: don't describe features there); add a short section to DECISIONS.md with what was decided and why, headed with the issue number (and its old TODO number if it has one), with numbers where you measured something; credit any asset in ASSETS.md. Anything new the girls do, notice or react to follows "The girls' minds" above.
3. Commit in sensible chunks with plain messages saying what changed for the player ("Let the girls share a quad, one driving and one on the back"): they become the FAQ's "Recently changed" list as written. No AI attribution of any kind: no Co-Authored-By, session links or "Generated with" lines. Stage only the files (or lines) you changed, by name: never `git add -A`, `git add .` or `git commit -a`.
4. Rebase on `origin/main`, push the branch, open the PR ("Closes #n", the issue's labels), `gh pr merge --auto --merge`, and watch the checks (`gh pr checks --watch`) until it has merged; fix anything red. Then `tools/worktree.sh finish <n>`. The release builds itself.
5. Tell Jamie in a few lines what changed, what you checked and what you didn't, with the PR link and the release version.
