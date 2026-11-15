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

Graded from `tools/shot.mjs` shots by day and at night (the jump, the strip and the cones, and the spawn view across the field) and from the builders' code. The hay patch, the harrow field, the bonfire and the molehills were graded from their code only: the shots of the two patches came out as the spawn view, so they have not been looked at. Jamie then walked it (13 November) and his findings corrected the grades below, marked (walk). The move (#682) rebuilds the blocks and passables to the standard with the field, or lets them go with the yard (#805 is the barn and yard's list).

| Object | Grade | What it lacks |
| --- | --- | --- |
| Grass and tufts | passable | Tufts of one shape on a flat green, no flowers, thistles, dock or cow parsley; the same everywhere in the field |
| Home Loop (dirt track) | passable | A blotchy brown texture with no edge: no worn grass fringe, grass crest down the middle, or standing water in the ruts; (walk) the ruts are predictable (#833) and a texture seam cuts off at x -18.8, z -50.3 (#828) |
| Mud ruts (`mudRuts`) | passable | The look is fine in the shots; the cost is not: 13 draw calls and 0.13M triangles for the whole scene's ruts in my count |
| Bogs | passable | A dip in the ground (`bogDepth` 0.12 m) with a darker patch; from the code, no reeds, wet sheen or standing water, and not looked at in the shots |
| Puddles | block | A flat grey ellipse in the shots with a hard edge and no sky in it; ripples when ridden through were not checked |
| Jump ramp | passable | Planks, cheeks, steel lip and bolts, but (walk) it feels random: a plank ramp for its own sake. Should be old equipment put to use, on the field's flattest line (#832) |
| Cone course | block | Big plain orange cones with no base, stripe or wear (#738), and (walk) no order, numbers or start: Jamie never worked out how to ride it (#831) |
| Drag strip | block | A hard-edged grey gravel rectangle with painted lines; no loose stone at the edges, no start lights or marshal's post (it goes: #616) |
| Line-up sleepers | passable | As #668: plain sleepers, no wear, weeds or end-grain splits |
| Bonfire and its stones | block | (walk) The stone ring looks as bad as the logs: a ring of one small stone, a flat ash disc, a pile of thin sticks; unlit at night, so nothing marks the place (#834) |
| Bonfire logs (the seats) | block | (walk) Plain cylinders with cut ends; no bark, knots or axe marks, all the same size (#738) |
| Brushwood heaps | passable | Seven thin sticks to a heap, all one length pattern; no leaves or twigs |
| Hay patch and its grass | passable | Taller tufts in a rectangle with hard edges: no mown-strip edge, and no swathes to turn |
| Square bales | good | Twine loops and a straw texture on each face (`squareBale.js`); not looked at closely in the field |
| Harrow field | passable | A skin texture over level grass, hard-edged |
| Molehills | block | (walk) Very low texture: plain half-spheres of one size (#836) |
| Chain harrows | passable | Not looked at; from its code a frame and chain, check against the real thing in #691 |
| Paddock rails and posts | block | As #668 and (walk): plain boxes with low texture, no weather, knots or staples; goes in the move, and Home Ground's own rails are #835 |
| Field gates and gateposts | block | (walk) Low texture; and a gate to the field from the yard is needed in the new plan (#835) |
| Cattle grid | block | (walk) Low texture (#835) |
| Hedges round the field | passable | A far version (`hedgeFar.js`) and a near one; in the shots a plain even band of one height, with no gateways, gaps or standard trees; (walk) you can walk through the big-leaf parts (#829) and the leaves are heavy to draw (#837) |
| Boundary trees | passable | The real GLB trees: good shapes, but they are the heaviest thing in view (see the review) and are all the same few |
| Log yard at the wood's gate | passable | Rounds, splitter and stack: logs and cones need proper detail (#738); it moves with the wood (#683) |
| Field's lighting at night | block | Nothing: no lit window or bulb carries into the field, the bonfire is cold, so the field is black from dusk |
| Ground shape: hills and dips | good | (walk) The balance of hills and dips is good and is to be kept: the move reuses it and the ramp's search finds a flat line in it, rather than levelling the field |

## The stubble fields, the farm road and the Dutch barn (#670)

Graded from my own shots at about 30 spots by day (13:00) and 5 at night (21:00), along the road, in both fields, round the Dutch barn, the pad, the grid, the big gate, the trough and the shed, and from the builders' code (`props.js`, `outbuildingProps.js`, `outbuildings.js`, `cattleGrid.js`). The spray patch only draws while its job runs, so it is graded from its code and was not looked at. I did not ride or walk it: Jamie's walk is added below when it is done, as for #669. In the move the fields go to #681, the drive and its grid and gates to #568, and the Dutch barn, pad and muck heap to the farmstead (#682); each rebuilds the blocks and passables to the standard as it takes the piece.

| Object | Grade | What it lacks |
| --- | --- | --- |
| Stubble ground (barley and wheat) | passable | One flat straw colour with faint drill stripes: no stones, weeds, straw swathes, headland, mud at the gateways or edge to the field; barley and wheat differ only in tone |
| Stubble clumps (`stubble-north`, `stubble-south`) | passable | Sparse yellow tufts in rows that read well; each clump is 24 triangles for six stalks, which is what makes it the heaviest thing in view (see the review) |
| Tramlines | good | Two clear wheel lines across each field, a different spacing in each |
| North field's hollow | passable | A soft dip with a darker tint: no standing water, rushes or wet sheen, and from the road it hardly reads as a hollow |
| South field's rise | good | A long smooth lift to the far hedge that carries the eye up; to be kept |
| Spray patch (`SprayView`, from code only) | passable | A skin of cells that tints darker as sprayed and a mist at the nozzles; hard-edged rectangle with no edge to the field; the job moves to a whole field (#691) |
| Farm road tarmac | passable | An even speckled grey with a soft edge: no patches, cracks, potholes (#214), gravel at the edges, wear down the middle, or mud and straw carried out at the gateways |
| Road verges | passable | A flat strip of short green on each side: no long grass, nettles, docks or cow parsley, and no edge where the tarmac meets the grass |
| Road hedges, both sides | passable | A dense dark hedge on one side and a big-leaf one on the other, each an even band: no gaps, standard trees or weathering; the big leaves can be walked through (#829) and are heavy to draw (#837) |
| Hedge gateways into the fields (four) | block | Bare mouths in the hedge: no posts, no gate, no mud, no change in the ground; the shot from above shows them as plain openings |
| Cattle grid | passable | Steel tubes laid over a pit that is a 2 cm black slab: no depth, no concrete side walls, no white kerb, no "Cattle grid" sign (#568's list); low texture (#835) |
| Grid wings (post-and-rail) | block | Plain boxes, one timber colour, no weather, knots or staples (#835) |
| Gate across the road beyond the grid | passable | Steel tubes, brace, hinge straps and a chain: good; the posts are plain brown boxes with no caps or staples; it shuts the corridor hedge to hedge and goes in the move (#568) |
| Big gate onto the lane | passable | The same gate; plain box posts; the lane beyond it is a bare pale ground (#678); goes in the move (#568) |
| Cars' pad | block | A perfect circle of tarmac 18 m across with a hard edge and a ring of bare earth round it, like a stamp; no markings, drain, oil or weeds; the cars move to the house (#682) |
| Dutch barn: roof | good | Curved corrugated sheet gone rusty over a lattice of arched trusses, purlins and eaves beams, seen from below |
| Dutch barn: stanchions and blocks | good | I-section posts, a block wall to 1.2 m with sheet above; no gutters or downpipes |
| Dutch barn: back and end sheeting | passable | The corrugated texture shows a repeating zigzag at close range and is the same on every panel; no rust streaks from the fixings, no holes |
| Dutch barn: bale stack and seat bales | good | Round bales stacked in three layers in the hollows of the layer below, with ends, twine and straw; all the same yellow and size |
| Dutch barn: floor and inside | passable | Trodden bare floor with straw; nothing else in it (no feeder, rack, tools or light; it is black at night) |
| Muck heap | passable | A lumpy dark heap with straw in it: one colour, no steam, no flies or fork, no run-off at the foot; goes to the cattle shed's back (#694) |
| Water trough | block | A grey box with a thin white sliver for a lid on four thin legs: no water, ball valve, pipe or wear; it stands against a hedge in an arable field where no stock graze, half hidden by the leaves; trough models belong with #710 |
| Field shed | passable | Rubble stone texture with lichen, a rusty tin roof, a lintel: good outside; an empty room with no door, window frame, floor or anything in it, and no place on the plan |
| Hedgerow and boundary trees round the fields | passable | The real GLB trees, good shapes, one of a few kinds repeated; the heaviest thing in view (see the review) |
| The area at night | block | No light on the road, pad, barn, grid or gates: the pad and drive are black from dusk and the barn is a silhouette; no reflector posts at the lane end |
