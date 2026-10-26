# Quad Bike Farm

A first-person browser game on a British farm: a yard of quads with properly temperamental engines, a Moorland or two, a tractor, a Yak, trailers, the weather and the day going by, and Amy and Jess, two friends who ride, drive, bicker and talk. The farm remembers between loads.

Three.js, Rapier physics, Web Audio. Desktop, keyboard and mouse or a gamepad.

## Running it

```sh
mise install    # Node 26, from mise.toml; CI uses the same file
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). The loading screen counts the models and then the sounds (every engine recording, the ride sounds and both girls' voices), so the game never starts silent. Click to lock the mouse and you're in. Press `H` to show or hide the controls; to change a key, pause with `Esc` and click "Change keys" on the card. `Esc` lets the mouse go and pauses the game, sound and all, until you click again; nothing moves behind the start screen either. The tuning panel and the console don't pause it, so you can watch it live.

It draws at most 60 frames a second, at 1.5 times the screen's points on a Retina screen rather than the full 2, and the grass, stubble, tussocks and bracken stop 70 to 90 m away, where you can't make out a stalk anyway; so it runs cool on a laptop. "Graphics" in the Tune tab (or `tune.graphics` in the console) lifts the cap (0), raises the scale or the distances; the console's `perf` says the frame rate, the work a frame and what the graphics card is asked to draw.

The start screen shows the game's sign, a tip that changes every few seconds, and a link to **How to play, and the FAQ** (`faq.html`), which opens in a new tab while the game waits where it is. It answers the questions a player asks (why won't it start, how do I get out of a bog, what does Amy want), with the secrets folded away behind a click, and a search box. The controls, every vehicle's engine, gearbox, tank and reverse, the girls, the whole bucket list and a "Recently changed" list (from the commit messages) are read from the game itself, so they're always current.

Other scripts:

- `npm test` runs the tests with Vitest.
- `npm run build` makes a production build in `dist/`, and `npm run preview` serves it.

## More

- [Playing the game](docs/game.md): the controls, the vehicles, cold starts, mud, fuel, the day, the girls, the gamepad.
- [The console and the debug panel](docs/console-and-panel.md): for tinkering while it runs.
- [How it is put together](docs/how-its-built.md): a tour of the code.
- [DECISIONS.md](DECISIONS.md): why things are the way they are. [ASSETS.md](ASSETS.md): where every recording and model came from, and its licence. [CLAUDE.md](CLAUDE.md): how work is done here.

## What's next, and how it gets done

The to-do list is the [GitHub issues](https://github.com/jamiefdhurst/quad-bike-farm/issues), labelled by kind (feature, enhancement, bug, task) and by part of the game (girls, vehicles, engine, world, sound, items, interface); the labels are defined in `.github/settings.yml`. Items moved from the old list in this file say "Was TODO n", the number DECISIONS.md knows them by.

- `/idea` in Claude Code turns an idea, or a brainstorm on a theme, into issues once each one has a yes; the noes go in `docs/decisions/ideas-turned-down.md`.
- `/todo` takes the next issue (one labelled "🔜 next" first, otherwise the lowest number), builds it in its own worktree (`tools/worktree.sh`), opens a pull request and sets it to merge itself once the Test check passes.
- Every merge to `main` that changes what ships (the source, `public/`, the pages, the build config or the packages) runs the tests again, builds the game and publishes a GitHub release with `dist` zipped up and a `v` tag. The version comes from the merged pull request's labels: "💥 breaking" (an old farm save won't load) is a major release, "✨ feature" a minor one, anything else a patch.
- Each release is then deployed to https://qbf.jamiehurst.co.uk (password protected) by `.github/workflows/deploy.yml`, which can also be run by hand with a version to put an older one back.
- Dependabot opens updates monthly and merges minor and patch ones itself once the tests pass.

