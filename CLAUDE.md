# Quad bike farm

First-person British farm quad-bike game: Three.js, Vite, ES modules, Rapier physics, Vitest. Two companions, Amy and Jess, who ride, drive, bicker and talk. `docs/what-the-game-is.md` says what every part of the game is for and `docs/style.md` how it looks. README.md describes the game and links `docs/game.md` (for a player), `docs/how-its-built.md` (the code) and `docs/console-and-panel.md` (the debug tools). DECISIONS.md indexes why things are the way they are, by area in `docs/decisions/`: read the "Where things stand" summary for the area you're touching, and the sections it names, before changing it.

## Area rules

The detailed rules for each part of the game are in `.claude/rules/`. They load on their own when a session started in that checkout touches matching files, but not for files in another worktree, so **read every one your work touches** before starting:

- `girls-minds.md`: anything the girls decide to do, notice, look at or react to (`src/npc`, and their hooks in `game.js`).
- `vehicle-detail.md`: vehicle models, the detail kit and the lessons from the red quad (`src/vehicle`).
- `debug-panel.md`: the panel's three tabs and the console. Anything new that can be tuned, watched, set or started goes in both.
- `voice-lines.md`: adding or changing what the girls say, and recording and committing the banks.
- `faq.md`: the FAQ, the start screen and the logo. Every item that changes what a player sees or does updates the FAQ.
- `controls.md`: anything you can use, pick up or talk to: the one rule for keys, the prompt, feedback, and names from `docs/glossary.md`.
- `interface.md`: screens, the HUD and messages: the shared tokens, the close-up frame, and when to use a prompt, a toast or a girl's line.
- `looks.md`: anything new you'll see in the world (buildings, yards, props, items): the **Looks like** brief, how detailed, and one look before the PR.
- `world.md`: the moving day, light sources, and anything scattered over the farm in numbers (`src/world`, `src/effects`).
- `checking.md`: the smoke test, the frame guard, headless checks, engine sound renders, frame time and load time.

## How work is done here

- The to-do list is the GitHub issues (labels in `.github/settings.yml`). `/todo` works one, `/idea` adds them, `/test` tries merged work with Jamie (issues labelled `🧪 testing`, which `/todo` skips, as it skips `💤 later`: kept but held back), `/perf` works `🚀 performance` issues first, measuring before and after, and `/tidy` works `🧩 cohesion` issues first and checks for drift (both only from the current phase or Alongside; `/todo` takes them by milestone like the rest). Each item is built in its own worktree (`tools/worktree.sh`) on a branch, opened as a PR with the issue's labels and set to merge itself when the Test check passes. Never commit to `main` or switch branch in the main checkout: other sessions are working in it.
- The farm's layout and the order of the work are in `docs/farm-plan.md` (map: `docs/farm-plan.svg`) and the milestones in `.github/settings.yml`. `/todo` follows them (`tools/nextTodo.mjs`): a `🔜 next` issue first, then the earliest milestone, skipping issues whose `Depends on:` isn't closed; `/todo alongside` takes the Alongside milestone. Every issue has a **Where it fits** section, and anything placed in the world names its place on the plan, or the plan changes first in its own PR.
- **The commands are read from the main checkout**, so `/todo`, `/tidy` and `/perf` first run `tools/upToDate.sh` and stop if the checkout is behind `origin/main`: Jamie pulls it (sessions never do, as others work in it).
- **Never substitute a source.** If an issue says to use something as given (a draft, a file, a map, a link) and you can't reach it, stop and ask Jamie. Don't redraw, rewrite or approximate it, however close you could get: a stand-in drifts from the plan without anyone noticing (#719).
- Autonomous: don't ask whether to write the code, just do it. Ask only for a real decision the issue doesn't settle (look, feel, scope, which of two behaviours): once, up front, a short numbered list with a recommendation for each. Jamie answers in a matching numbered list.
- **Never give Jamie a console line, path or `tp` place you have not run.** Not from memory, not copied from an issue body (they are often wrong), and not read off a usage string: run each whole line with `tools/consolePath.sh 'tp me 105 -17' 'lane.kids on' ...` (it uses the real command table and tree; `tp` places come from `src/console/gameHost.js`) and give it only on `ok`. Fix a wrong line in the issue as you find it.
- When you start an item, say its number, title and link before anything else.
- Plan briefly, then build. Keep to the item; note other ideas at the end rather than doing them.
- When Jamie asks how something works, or something turns out to be confusing, add it to the FAQ as well as answering.
- Assets: CC0 or public domain only, credited in ASSETS.md. Prefer procedural. (One exception, the BBC RemArc engine recordings: see the top of ASSETS.md.)
- Prose (docs, commit messages, comments, lines the girls say): British English, no em dashes, no throat-clearing. The girls refer to the player only as "you", never "he", "she" or "they".

## Code

- `src/game.js` wires everything together; behaviour lives in modules (`src/npc`, `src/vehicle`, `src/engine`, `src/audio`, `src/effects`, `src/world`, `src/items`, `src/workshop`, `src/farm`, `src/debug`, `src/console`, `src/start`, `src/faq`). `docs/how-its-built.md` is the tour.
- Keep logic pure and testable where you can (no Three.js or DOM), with a test in `tests/`; `boredom.js`, `bog.js` and `banter.js` show the pattern.
- New tunables go in the module's `DEFAULT_*_PARAMS` with a one-line comment, plus a `[min, max, step]` range, registered with `registerTuning` and placed in `TUNE_CATEGORIES` (a test fails until it is).
- A new per-frame feature update in `game.js` goes through `this.guard.run('updateX', () => this.updateX(dt))`.
- The farm remembers between loads (`src/farm`). A vehicle's or a girl's lasting condition (wear, a fault, a level she has learnt) goes in `captureVehicle`/`restoreVehicle` (or `ENGINE_KEPT`) or `captureGirls`/`restoreGirls`, with a test; something about the farm's character dealt at random comes from a `this.farmSeed` stream, not `this.seed`. docs/decisions/world.md, "A farm that remembers (TODO 15)".
- A quad spec must name a `style` and `dashStyle` that exist. A new vehicle goes in `FOR_SALE` or `NOT_FOR_SALE` in `src/farm/classifieds.js`. Tests check both.
- Style: single quotes, about 140-column lines, comments that say why. No prettier or eslint; don't run either over existing files.

## Testing (keep it cheap)

- `npm test` must pass before every commit. Add or update unit tests for any logic you change.
- `npm run smoke` before opening a PR that touches `game.js` or adds to the frame (CI runs it too; `checking.md`).
- No headless browser checks or screenshot rounds, apart from model work (anything new you'll see gets one look, `looks.md`) and the smoke test: they are slow, and screenshots keep showing the "Click to play" overlay. The one exception is a check where you get past the overlay and confirm it in the screenshot (`checking.md`). Otherwise rely on unit tests and say what you didn't verify. No long simulation runs or tuning loops: pick sensible values.
- Jamie tries the running game for what only eyes and ears can judge (a look, a feel, a line by ear, how it plays), not for what a test can assert: prompts and their keys, toasts, that a sound is triggered, refusals, values. Those are tests before the item is done, and a stand-in game (`tests/villageHost.test.js`) is how to test code that lives in a host class.
- Never make sound in tests: stub `speechSynthesis.speak` and set `game.audioHub.params.muted = true`.

## Versions and releases

Every merge to `main` that changes what ships is released by CI as `vX.Y.Z`; the bump comes only from the merged PR's labels (`tools/nextVersion.mjs`). Never tag, make a release or change `package.json`'s version by hand.

- Every PR has **exactly one type label** (the required "Version label" check fails otherwise and says what the merge will release as). Use the issue's unless the work turned out to be something else. `✨ feature` (minor): something new the player can do or see. `⚡ enhancement` or `🐛 bug` (patch). `🔨 task`, `📚 documentation`, `🚨 tests` (patch, usually no release).
- Pass every `--label` to `gh pr create` itself, never afterwards with `gh pr edit`.
- Add **`💥 breaking`** (major) only when an old farm save stops loading or loses something it kept: raising the oldest version `validSave` accepts, or dropping or renaming something the save keeps without carrying the old value across. Raising `SAVE_VERSION` with old saves still loading, and controls, balance or looks changing, are not breaking.

## Finishing an item

1. `npm test` passes, and `npm run smoke` too if you touched `game.js` or added to the frame.
2. The debug panel and console have anything new (`debug-panel.md`), and anything judged by eye or ear has a scene in `src/debug/scenes.js` (`scene <name>`); the FAQ answers it (`faq.md`); new or changed keys are in `src/hud/controls.js`; `docs/game.md` is fixed where it describes something the item changed (the README stays short); assets are credited in ASSETS.md; new lines are recorded and their banks committed on the branch (`voice-lines.md`).
3. The area's file in `docs/decisions/` gets a section at its end headed with the issue number (and its old TODO number if it has one): what was decided, why, and any numbers measured, in about ten lines. Not what wasn't checked (that goes on a testing issue) and not a restatement of the code. If the item changes how something stands, fix that line in the file's summary too.
4. Commit in sensible chunks with plain messages saying what changed for the player ("Let the girls share a quad, one driving and one on the back"): they become the FAQ's "Recently changed". No AI attribution of any kind. Stage only your own files by name: never `git add -A`, `git add .` or `git commit -a`.
5. Rebase on `origin/main`, push, open the PR ("Closes #n", the issue's labels), `gh pr merge --auto --merge`, and watch the checks until it has merged; fix anything red. Then `tools/worktree.sh finish <n>`. Don't wait for the release.
6. If something unchecked could be wrong in a way worth fixing and only the running game shows it (a look, a feel, a line by ear, a girl in play), open one `🧪 testing` issue for it (`/todo` step 10 has the shape); otherwise none.
7. Tell Jamie in a few lines what changed, what you checked and what you didn't, anything you did differently from what the issue asked (and why), with the PR link, the version it releases as and the testing issue if there is one.
