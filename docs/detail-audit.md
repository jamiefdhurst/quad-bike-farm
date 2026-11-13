# Detail audit

Every visible object in the world graded **good**, **passable** or **block** against `.claude/rules/looks.md`, by area, as the pre-move reviews (#668 to #672) are done. #414 uses it. A **good** object has its outline, trim and small detail; a **passable** one has the outline and some trim but lacks something named here; a **block** is a plain shape with none, to be rebuilt in the move.

## The barn and yard (#668)

Graded first from `tools/shot.mjs` shots and the code, then corrected from Jamie's own walk of it (the #668 comment of 13 November), which found most of the small things too basic. #805 rebuilds the blocks and passables to the standard in the move (#682).

| Object | Grade | What it lacks |
| --- | --- | --- |
| Barn front and doors | passable | The texture differs top and bottom and does not line up; the two doors differ in size and the hay door goes through the roof (#613) |
| Barn, second span (annex) | passable | Plain boards over the door up to the eaves, posts in place of a wall, no trim on the valley |
| Barn roof | passable | A gutter on one edge only and no downpipes seen, no weather vane (#169) |
| Barn lighting | passable | Two dim bulbs at the top; more are needed |
| Loft and its ladder | block | The ladder is very basic and climbing it goes through the floor; the floor and wall alpha-fight; the loft has no use (removed in the move) |
| Straw on the floor, bales inside | block | Plain pieces; the bales are too regular |
| Workbench and boards | passable | The boards need headings, the records overlap their lines, the classified board's shadow does not match what is pinned |
| Pinboard and its tools | block | Poor tool shapes; removed until #517 |
| Vice, jars, battery charger | block | Very basic textures; the jars have no meaning |
| Battery booster | block | Alpha-fights |
| Shelf of parts | block | Plain backing and plain parts |
| Floor spots | block | Plain circles |
| Tyre rack | block | No inside to the tyres, plain shelf, a number on each label |
| Jack | block | Basic textures, a part floats |
| Calendar, weather display, clock | passable | Spread apart; the weather display reads strangely |
| Writing in the barn | block | A lot of Comic Sans (#807) |
| Money tin, parts catalogue | passable | In odd places (#809) |
| Coat rack, helmet hooks | passable | Too basic; move them in the new barn |
| Bays 1 and 2 | block | Painted lines on a concrete floor (#404); the rusty quad and the Plover block the bench |
| Pit | block | A painted rectangle, not a hole (#329) |
| Shed kit (compressor, parts washer) | good | Not marked down by the walk |
| Generator | block | Very basic texture; too loud and runs dry too quickly (#810) |
| Bell pole | passable | A bit basic |
| Fuel tanks and bowsers | block | They float (#614); the hose textures are awful |
| Feed bin and bucket | block | No inside textures |
| Hens' house and pig's pen | block | No real textures; too tight |
| Silage bales | passable | The wrapped ones behind the barn are hard to reach |
| Paddock fences | block | No reason to be there and the girls get stuck (removed in the move) |
| Line-up sleepers | passable | Plain sleepers, no wear or weeds |
| Yard ground | block | Grass and a dirt track: no concrete, joints, drain, puddles or scraped muck line |
| Lights at night | block | No yard light: the yard is black at dusk but for the barn's bulb (#171) |

## The grass field, Home Ground (#669)

Graded from `tools/shot.mjs` shots by day and at night (the jump, the strip and the cones, and the spawn view across the field) and from the builders' code. The hay patch, the harrow field, the bonfire and the molehills were graded from their code only: the shots of the two patches came out as the spawn view, so they have not been looked at. Not ridden or walked. The move (#682) rebuilds the blocks and passables to the standard with the field, or lets them go with the yard (#805 is the barn and yard's list).

| Object | Grade | What it lacks |
| --- | --- | --- |
| Grass and tufts | passable | Tufts of one shape on a flat green, no flowers, thistles, dock or cow parsley; the same everywhere in the field |
| Home Loop (dirt track) | passable | A blotchy brown texture with no edge: no worn grass fringe, grass crest down the middle, or standing water in the ruts |
| Mud ruts (`mudRuts`) | passable | The look is fine in the shots; the cost is not: 13 draw calls and 0.13M triangles for the whole scene's ruts in my count |
| Bogs | passable | A dip in the ground (`bogDepth` 0.12 m) with a darker patch; from the code, no reeds, wet sheen or standing water, and not looked at in the shots |
| Puddles | block | A flat grey ellipse in the shots with a hard edge and no sky in it; ripples when ridden through were not checked |
| Jump ramp | good | Planks, cheeks, steel lip and bolts; no wear, no skid marks and no tyres or a post marking the run-up |
| Cone course | block | Big plain orange cones with no base, stripe or wear (#738); the slalom is 12 cones of one model |
| Drag strip | block | A hard-edged grey gravel rectangle with painted lines; no loose stone at the edges, no start lights or marshal's post (it goes: #616) |
| Line-up sleepers | passable | As #668: plain sleepers, no wear, weeds or end-grain splits |
| Bonfire and its stones | passable | Ring of dodecahedron stones, a ring of ash, a pile of thin sticks, flame cards; at night it is unlit until you light it, so nothing marks the place |
| Bonfire logs (the seats) | passable | Plain cylinders with cut ends; no bark texture, knots or axe marks, and all the same size |
| Brushwood heaps | passable | Seven thin sticks to a heap, all one length pattern; no leaves or twigs |
| Hay patch and its grass | passable | Taller tufts in a rectangle with hard edges: no mown-strip edge, and no swathes to turn |
| Square bales | good | Twine loops and a straw texture on each face (`squareBale.js`); not looked at closely in the field |
| Harrow field | passable | A skin texture over level grass, hard-edged; molehills are plain half-spheres of one size |
| Chain harrows | passable | Not looked at; from its code a frame and chain, check against the real thing in #691 |
| Paddock rails and posts | block | As #668: plain boxes with no weather, knots or staples; goes in the move |
| Field gates and gateposts | passable | Not looked at closely: a gate to the field from the yard is needed in the new plan |
| Hedges round the field | passable | A far version (`hedgeFar.js`) and a near one; in the shots a plain even band of one height, with no gateways, gaps or standard trees |
| Boundary trees | passable | The real GLB trees: good shapes, but they are the heaviest thing in view (see the review) and are all the same few |
| Log yard at the wood's gate | passable | Rounds, splitter and stack: logs and cones need proper detail (#738); it moves with the wood (#683) |
| Field's lighting at night | block | Nothing: no lit window or bulb carries into the field, the bonfire is cold, so the field is black from dusk |
