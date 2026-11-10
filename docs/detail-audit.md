# Detail audit

Every visible object in the world graded **good**, **passable** or **block** against `.claude/rules/looks.md`, by area, as the pre-move reviews (#668 to #672) are done. #414 uses it. A **good** object has its outline, trim and small detail; a **passable** one has the outline and some trim but lacks something named here; a **block** is a plain shape with none, to be rebuilt in the move.

## The barn and yard (#668)

Graded from `tools/shot.mjs` shots (daylight and 20:00; the framing was far, so none of the small detail was judged at full size) and from the code and the issue's known faults, not from riding or walking it. **Good** here means "no fault found at that distance or in the code" and must be looked at close by whoever rebuilds the piece. The move is #682.

| Object | Grade | What it lacks |
| --- | --- | --- |
| Barn, first span (`barnBuild.js`: walls, white corner posts, door frame, header, hay door frame and shutter, sliding doors on a rail) | good | Two door sizes differ (2.3 m and 2.0 m half widths); the hay door's top goes through the roof line |
| Barn, second span (annex) | passable | Plain boards over the door up to the eaves, posts in place of a wall (open to the weather), no trim on the valley |
| Barn roof | passable | No gutters or downpipes, no weather vane (#169) |
| Loft (`loft.js`) | good | |
| Workbench, toolbox, boards, cork board | good | The boards read as flat painted panels (#503) |
| Bays 1 and 2 | block | Painted lines on a concrete floor: no kerb, no oil stain, no wheel stops (#404) |
| Pit | block | A painted rectangle, not a hole (#329) |
| Shed kit (compressor, parts washer) | good | |
| Bell and post (`bellBuild.js`) | good | |
| Generator | good | |
| Weather station, wall calendar, money tin, job board, helmet hooks, jumper rail | good | |
| Fuel tanks and bowsers | passable | They float (#614): feet and nozzle holders do not meet the ground; no bund or drip tray |
| Hens' pen and pig's sty (`farmAnimals.js`) | passable | Plain rail pens, no house or ark with a roof; 151 draw calls for 4,000 triangles |
| Silage bales | good | |
| Yard lawn and paddock fences | passable | Fences are one colour; no gate, no worn gateway |
| Line-up sleepers | passable | Plain sleepers, no wear or weeds |
| Yard ground | block | Grass and a dirt track: no concrete, joints, drain, puddles or scraped muck line (the **Looks like** list in #682) |
| Lights at night | block | No yard light: the yard is black at dusk but for the barn's bulb (#171) |
