# The console and the debug panel

For tinkering while it runs. See also CLAUDE.md, "Debug panel", for how the tabs are organised.

## Console

Backslash (the key left of Z, or the `#` key on a UK keyboard) opens a command line along the bottom of the screen, separate from the debug panel. Backslash again shuts it (the mouse stays locked while it is open, so the game carries on and you do not need to click). Esc also shuts it, but the browser takes Esc to release the mouse, so you click the game to carry on. As soon as you type a `.` or a space, every choice for the next word is listed under the line (a long list scrolls). Tab completes whatever you are typing (commands, paths, vehicles, girls, places, values) and goes through the choices if there are several, Shift+Tab goes back, the up and down arrows bring back old lines. `help` lists every command, `help <command>` gives examples, `help topics` explains the tree.

Every value is at a dotted path. Type the path alone to read it, or the path and a value to set it:

- `vehicle.red.temperature 0.4`, `vehicle.red.faults.carb 0.3`, `vehicle.red.tyres.flPsi 2`, `vehicle.red.quirks.<kind> on`: each vehicle's running state, faults, engine health, quirks, tyres, position, and `vehicle.red.tune.*` for its own engine and controls.
- `girl.amy.favour 10`, `girl.jess.autonomy off`, `girl.amy.skills.*`, `girl.amy.tune.*`.
- `weather.kind rain`, `weather.rain`, `weather.wet`, `weather.temperature -4`, `weather.time 17.5` (the time of day, in hours).
- `player.x`, `player.heading`, `player.flying`; `girls.autonomy`, `girls.speech`, `audio.sound`.
- `tune.<group>.<key>`: every number in the Tune tab.

`list`, `find psi`, `get`, `range`, `set`, `add`, `toggle`, `dump` (copies JSON) read and write them. Positions are x east, z south, y up, heading in degrees (0 faces +z, 90 faces +x), the same for you, vehicles, girls and items:

- `tp red barn`, `tp me 100 20`, `tp amy to jess`, `tp tractor here`, `tp petrol-can 10 10 90`, then `nudge`, `face`, `where`, `places`.
- `reset red`, `reset vehicles`, `reset girls`, `reset all`.
- `start|stop|warm|cool|fill|fix <vehicle|all>`, `vehicles`, `girls`.
- `girl amy drive red`, `girl jess doughnuts`, `girl amy invite-barn`: the same things as the Girls tab buttons.
- `weather rain`, `fly`, `autonomy off` (the girls start nothing on their own, but follow and answer you), `speech off`, `sound off`.

## Tuning panel

A small graph at the top of the Vehicles tab's Running folder draws the picked vehicle's revs, speed, wheel slip and throttle over the last ten seconds (it fills while the panel is open), so you can feel-tune a quad by riding it and watching, with no long simulation runs.

Press `` ` `` to open it. It releases the mouse so you can use the panel; click the game to carry on. Each quad has its own folder (Engine, Vibration, Audio, Smoke, Vehicle), alongside Sound, Player, Companion and Sky. The live engine readouts (state, rpm, mixture, roughness, fouling) and the shortcuts (warm or cool the engine, clear a flood) follow the quad you're on or looking at. There's also a shortcut to put both quads back in the yard and one to copy every value as JSON. On the Girls tab each girl's folder shows what she is doing and why (her needs and what she chose), with the buttons that make her do things folded away in "Make her do" below it, so both girls' details fit on the screen at once.

