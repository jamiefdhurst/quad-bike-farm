# Decisions

Why things are the way they are, kept by area in `docs/decisions/`. Each file opens with **where things stand**: what is true now, and which sections to read for it. The record follows, oldest first.

| Area | File | What it covers |
| --- | --- | --- |
| The girls | [girls.md](docs/decisions/girls.md) | How Amy and Jess decide, notice and react, what they do, you and them, bodies and clothes |
| Vehicles | [vehicles.md](docs/decisions/vehicles.md) | Specs, the fleet, physics, drivetrains, dashes, lights, models, trailers |
| The engine | [engine.md](docs/decisions/engine.md) | Mixture, starting, wear, faults, fuel, heat, lubrication |
| The world | [world.md](docs/decisions/world.md) | The farm, weather and the day, the save, money and jobs, animals, frame time |
| Sound | [sound.md](docs/decisions/sound.md) | Engine sound and banks, ride sounds, voices, the radio |
| Items and the workshop | [items.md](docs/decisions/items.md) | Toolbox, bench, spares, batteries, generator, tractor attachments, winch |
| The interface | [interface.md](docs/decisions/interface.md) | Debug panel, console, wheel, controls, gamepad, start screen and FAQ, map, photos |
| How work is done | [process.md](docs/decisions/process.md) | Stack, issues and PRs, releases, CI, instructions, loading |
| Ideas turned down | [ideas-turned-down.md](docs/decisions/ideas-turned-down.md) | What Jamie said no to, so it isn't offered again |

**Finding a section.** Code and docs name a section by its heading. `grep -rn '^## <its name>' docs/decisions` finds it.

**Adding one.** At the end of the area's file, headed with the issue number (and its old TODO number if it has one): what was decided, why, and any numbers measured, in about ten lines. What wasn't checked goes on a `🧪 testing` issue, not here. If the item changes how something stands, fix that line in the file's summary as well. Something that spans areas goes in the one it mostly changes, with a line in the other's summary if it matters there.

**Old numbers.** TODO and item numbers in sections written before 11 October 2026 are the README list's old numbers. That day the finished items were taken out of the list and the rest renumbered from 1, so an old number names the item it was then, not the one with that number now. On 18 October 2026 the list moved to GitHub issues (TODO 106): each open item became an issue whose body ends "Was TODO n", so a TODO number here can be searched for there.
