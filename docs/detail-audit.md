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
| Stubble ground (barley and wheat) | passable | (walk) The tramline in the north field runs into the back of the Dutch barn: no headland where it ends (it goes with the move, #689). One flat straw colour with faint drill stripes: no stones, weeds, straw swathes, headland, mud at the gateways or edge to the field; barley and wheat differ only in tone |
| Stubble clumps (`stubble-north`, `stubble-south`) | passable | Sparse yellow tufts in rows that read well; each clump is 24 triangles for six stalks, which is what makes it the heaviest thing in view (see the review) |
| Tramlines | good | Two clear wheel lines across each field, a different spacing in each |
| North field's hollow | passable | A soft dip with a darker tint: no standing water, rushes or wet sheen, and from the road it hardly reads as a hollow |
| South field's rise | good | A long smooth lift to the far hedge that carries the eye up; to be kept |
| Spray patch (`SprayView`, from code only) | passable | A skin of cells that tints darker as sprayed and a mist at the nozzles; hard-edged rectangle with no edge to the field; the job moves to a whole field (#691) |
| Farm road tarmac | passable | (walk) The drive is to be tarmac with gravel edges, which it does not have. An even speckled grey with a soft edge: no patches, cracks, potholes (#214), gravel at the edges, wear down the middle, or mud and straw carried out at the gateways |
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
| Dutch barn: back and end sheeting | passable | (walk) The sheet was banded in thirds, with the rust in a different place on each: a 3 m tile on a 4.5 m wall, fixed in #842. Still the same on every panel; no rust streaks from the fixings, no holes |
| Dutch barn: bale stack and seat bales | good | Round bales stacked in three layers in the hollows of the layer below, with ends, twine and straw; all the same yellow and size |
| Dutch barn: floor and inside | passable | Trodden bare floor with straw; nothing else in it (no feeder, rack, tools or light; it is black at night) |
| Muck heap | passable | A lumpy dark heap with straw in it: one colour, no steam, no flies or fork, no run-off at the foot; goes to the cattle shed's back (#694) |
| Water trough | block | (walk) Makes no sense in an arable field: troughs are for grazed fields (#710), so it goes. A grey box with a thin white sliver for a lid on four thin legs: no water, ball valve, pipe or wear; it stands against a hedge in an arable field where no stock graze, half hidden by the leaves; trough models belong with #710 |
| Field shed | passable | Rubble stone texture with lichen, a rusty tin roof, a lintel: good outside. (walk) Two stones in different colours on the wall and alpha fighting in the doorway, fixed in #842; and nothing in it to give it a reason to be there: it becomes the sheep field's stone field barn (#624). An empty room with no door or window frame |
| Hedgerow and boundary trees round the fields | passable | The real GLB trees, good shapes, one of a few kinds repeated; the heaviest thing in view (see the review) |
| The area at night | block | No light on the road, pad, barn, grid or gates: the pad and drive are black from dusk and the barn is a silhouette; no reflector posts at the lane end |

## Hollow Wood (#671)

Graded from my own shots at about 30 spots by day (13:00), 8 at night (19:30) and 11 in autumn (`?season=autumn`), from the gate, along the Hollow Run and the Fern Trail, at the pond, the bogs, the logs and the log yard and from above, and from the builders' code (`woods.js`, `woodsProps.js`, `trailProps.js`, `autumn.js`, `autumnView.js`, `woodPieces.js`). The conkers were graded from their code only. The log yard shows only on a farm that has the tractor, so those shots are from a farm that does (seed 1). I did not ride or walk it. Jamie then walked it (15 November) and said it is "pretty OK", so the wood's shape is kept; his findings are marked (walk) below. In the move (#683) the wood goes as one piece; it rebuilds the blocks and passables to the standard as it takes them, and #561 and #738 are the plants' and the logs' lists.

| Object | Grade | What it lacks |
| --- | --- | --- |
| Wood floor (leaf litter) | passable | Blotchy brown and green with moss patches, and square blocks of tone showing where the texture is too coarse (at the bog and at the sign); no drifts of leaves, fungi, stones or moss on the roots; in autumn the fallen leaves are pastel ellipses |
| Oaks (170, the farm's two GLB models) | passable | (walk) A thin wood, and more trees are wanted (#848). Good shapes, with forked limbs and bark; two models only, one lime green, so the wood reads as one tree repeated; about 6,000 triangles each, the heaviest thing in the wood (see the review) |
| Hazel and holly (110, one model) | passable | (walk) Some tree variety is wanted (#848). A mound of broad leaves like a lettuce; hazel and holly are the same model, with no catkins, nuts or glossy spiked holly leaf |
| Hollow Run: bed and ruts | passable | Two dark ruts and a grass strip that read well; no puddles in the ruts, no leaf drift, no root crossings, one colour all the way round |
| Hollow Run: berms, whoops and the swell | good | The shapes are good and are kept (`woods.profile`) |
| Lead-in from the gate | passable | As the Run: a plain dark strip, with no gateway mud or worn grass at the gate |
| Hedges round the wood | passable | (walk) The fence does not line into the hedge, with obvious gaps (#845). A chain of cubes with gaps you can see through, bushes in front; the big leaves can be walked through (#829) and are heavy to draw (#837) |
| Wood gate (five-bar, tied open) | passable | (walk) Its fence does not meet the hedge cleanly (#845). From the code a leaf tied back with baler twine; seen only from a distance, the posts are plain brown boxes with no caps or staples, as the road's gates (#670) |
| Logs across the Run (5) | block | One flat brown, an eight-sided cylinder with a flat pale disc at each end and two stubs: no bark, rings, moss or splits (#738) |
| Deadwood (7) | block | The same plain cylinder, lying on bare ground with no leaves or fungi round it (#738) |
| Pond: water and shore | passable | Flat slate water with no sky in it, no lilies or frogs and a hard dark lip (ripples when ridden through were not checked) |
| Pond: reeds | good | A thick ring of long reeds that hides the lip and reads as a pond |
| Bogs (2) | block | A grey flat polygon laid on the ground like a plastic sheet; no reeds, sheen or standing water |
| Fern Trail: path | passable | A pale packed-earth way with two dips and a good width, one tone and no puddles in the dips |
| Fern Trail: roots | passable | The tubes swell and dive into the ground well; the bark texture is stretched into a herringbone zigzag that reads as a snake |
| Fern Trail: hop log | good | Bark and cut ends with rings, and moss on top |
| Way-marker posts | good | A blue band with an arrow disc, a foot and a slight lean; 11 along 390 m |
| Fern Trail sign | passable | (walk) Still too obvious: a big dark green board with a bright blue strip at the mouth of the wood (#846). The painting is good, with its border, words and a cap on two posts |
| Ferns | block | (walk) Just colours, no texture. Flat green stars with hard edges and one colour; in autumn a flat olive (#561) |
| Brambles | block | (walk) Just colours, no texture. A few flat triangles for leaves on thin pink canes: no thorns, berries or arching (#561) |
| Conkers (from code only) | passable | About 1,200 3 cm brown spheres under the oaks; not looked at closely |
| Leaves in the air | passable | In autumn they are tan squares that fall straight; no tumble or sway |
| Autumn tint (oaks, bushes, hedges) | passable | Lime and yellow, never orange or brown, one tone across a whole tree; the bush goes olive. The tint was a guess when built ("Autumn in the wood (TODO 83)") |
| Log yard: rounds (12) | block | Plain stumps in two heaps of six, one brown (#738); on a farm with no tractor there is nothing at all |
| Log yard: stack and its posts | block | Two thin posts and, when it is filled, plain half-cylinders with flat ends (`woodStack` in `KNOWN_BLOCKS`, #738) |
| The wood at night | block | Black from dusk: no light at the gate, on the posts or at the pond, so the track vanishes |
| The wood on the map | block | (walk) The trees are in an obvious pattern: the map draws a lattice of dots 6 m apart over the whole wood, not the trees that are there (#847) |

## The gravel pit (#672)

Graded from my own shots at 18 spots by day (13:00) and 6 at night (19:12): from the barley field and the gate, along the lead-in, from the lip and the west rim, on the floor at the plant, the excavator, the cabin and the pond, at the signs and the east hedge, and from above; and from the builders' code (`quarry.js`, `quarryProps.js`, `quarryDebris.js`, `quarryTextures.js`, `screeningPlantModel.js`, `excavatorModel.js`, `siteCabinModel.js`, `containerModel.js`). The dead trees and the pit climb's cones were graded from their code only. I did not ride or walk it. Jamie then walked it (15 November) and said most of the bottom is fine or already on the list; his findings are marked (walk) below. A model can be good and still be wrong for a disused pit (fresh paint, doors in use): the grade is against `looks.md`, and what makes a relic read as disused is in the review's Change list. In the move (#685) the pit rebuilds the blocks and passables to the standard as it takes them.

| Object | Grade | What it lacks |
| --- | --- | --- |
| The pit's walls | passable | Good shape (lip, middle, scree toe, chutes and buttresses), but the texture is wavy saturated bands of orange, grey and cream that follow the surface, with band edges that step in pixel blocks up close; no level bedding, topsoil line at the lip, roots or fallen turf |
| The pit floor and the haul roads | passable | A pale gravel with ruts and loose stone that reads well; the floor has no wheel scars, standing water or weeds, and the roads are one width and colour all the way down with no wear or washed-out edge |
| Field grass | passable | An even mown green with square blocks of tone where the texture is too coarse; no rough grass, thistle, bramble or ride kept open |
| Hawthorn | passable | The farm's bush model, spaced out evenly over the field |
| Gorse (the bushes with yellow on top) | block | (walk) Just triangles and very basic: a flat-shaded vertex-coloured mound with no leaf or spine texture, spaced out evenly |
| Stones and boulders | block | (walk) No texture. Good shapes (welded, split faces, flat base) but pure white and untextured, so they read as marshmallows |
| Heaps of gravel and sand | passable | Smooth mounds with a hard circular edge, one colour each: no stones, crust, grass, seedlings or tide line |
| The pond | passable | A flat grey ellipse with a tint and a few grass tufts at the edge: no reeds, rushes, sheen or reflection |
| Screening plant (hopper, crusher, conveyors, ladder, generator) | good | Legs, braces, ladder, rail, belts on trestles and a junction box, with a rust texture; no torn belt or weeds at the footings; the cable is a bare black rod that reads as stray lines on the pad (see the review's Fix) |
| The plant's pad | passable | A hardcore slab with a skirt of stone spreading out and a hard edge; no cracks, oil or weeds |
| Excavator | good | Tracks with 42 shoes and grousers, slew ring, hood, cab with a door and levers, two-piece boom, stick and bucket with teeth and rams with hoses, each joint on a pin; but the cab and boom are bright fresh yellow over a rusted body, so it reads as working |
| Site cabin | good | Ribbed cladding cut round the openings, a door ajar, barred windows, gutter and downpipe, an air-con box and a desk and chair inside; fresh cream, so it reads as in use |
| Steel container | good | Real corrugation with dents, corner castings, two leaves with locking bars, cams, handles and a hasp and padlock, on three sleepers; a dark green with light rust, one leaf ajar; stands on bare lawn with no hardstanding |
| Drums | passable | A lathe body with hoops, chimes, lid and bungs; bright new blue, green and red, undamaged, no labels or rust |
| Tyres | block | (walk) No inner texture: the inside is plain. Grooved with lugs, plain black; about 1,900 triangles each (13,000 for 7), heavy for a tyre |
| Pallet | block | (walk) Not joined at the bottom: it floats. Boards on three bearers in one wood tone, the top boards' undersides are about 2 cm above the bearers' tops and run the same way as them, so nothing joins them (`quarryProps.js`, the pallet in the drums-and-tyres block); no splits, missing boards or weeds |
| Dead trees at the rim | block | (walk) Very basic textures and not well modelled: a bare cylinder with two stubs in one flat grey-brown colour, no bark texture, no taper break, roots or fallen limbs |
| Lip fence | passable | (walk) It has no collision: you ride through it (`buildFence` in `quarryProps.js` makes no colliders; the hedges, gates, wall and pig pen's fence all have them). Leaning timber posts, 16% gone, two sagging strands that run to the ground in places: the right idea; posts are plain boxes and the wire is a thin grey rod with no barbs or staples |
| Signs (three) | passable | A board held off its post by straps with lettering on the front and plain steel on the back: good; the wording is American ("NO TRESPASSING"), and all three are fresh |
| Gate (five-bar, tied open) | passable | A timber leaf in the barley hedge, as the wood's: no steel, no chain, no concrete posts, no bellmouth (all new in the move) |
| Field hedges (four, far version) | passable | (walk) No tree line between the stubble field and the pit, so the pit's field reads as bare against the arable. A chain of cubes with trees standing through on the east side; cheap (4,056 triangles for all four) but not a fence a disused pit has (#558) |
| Things round the top of the pit | passable | (walk) Not enough: a container and signs and little else. A real pit has a weighbridge and its kiosk, a fuel tank and pump, stockpile bays, a tipper or dumper left standing, concrete pipes, fly-tipping and a dead pole (the review's Change list) |
| Pit climb's cones | block | (walk) Strangely horizontal on the side of the pit. `buildClimbCones` (`startLine.js`) turns each only about the vertical, so on a wall of 30 to 47 degrees it stands plumb against the face; I did not see it. Small cones with START and FINISH on them, plain colour, no base or sleeve (the cones' detail is #738's). A flag in the ground may suit the climb better |
| The area at night | good | Black, which is right for a disused pit: nothing is lit; the walls' bands still show faintly under the moon; the lane gate will need reflective bands to be seen from the lane |

## The wet meadow and pond (#673)

Graded from my own shots at 14 spots by day (13:00) and 6 at dusk (19:12, already dark in November): from the gateway, along the track, round the pond on all four sides, at an oak and the reeds close to, from the south-east corner, the west end, the north hedge, the lane's far bank and from above; and from the builders' code (`hill.js`, `hillProps.js`: `buildPond`, `buildMeadowTrees`, `buildTussocks`). The meadow's hedges are the lane's and the grass field's and are graded with them (#669). I did not ride or walk it: Jamie's walk is added below when it is done, as for #669 to #672. In the move (#684) the meadow rebuilds the blocks and passables to the standard as it takes them.

| Object | Grade | What it lacks |
| --- | --- | --- |
| The pond's water | block | A flat disc in the stream's colour (`0x35332a`) with no sky in it: black from above (shot 10) and at dusk, flat grey up close (shots 08, 13) with one hard white glint; an exact ellipse with a hard edge, no ripple, weed, ducks or movement, and it never rises or browns after rain as the stream does (#563) |
| The pond's dish and shore | passable | A smooth dish 1.1 m deep with a dark mud ring of even width round it; no bank edge, no shelf, no hoofprints, stones or roots, and a perfect ellipse (`pondR`) |
| Reeds | passable | 260 clumps of six plain green blades in an even ring (shots 03, 08, 13): no seed heads, brown stems, rushes or flag iris, one thinner patch on the track's side |
| Oaks (seven) | passable | The farm's two oak models (good shapes, collider 0.32 m) in an even ring within 12 m of the water: no veteran, deadwood, ivy or roots, and oaks where alder and willow would stand |
| Hazel under the oaks | passable | The farm's hedge bush scaled to 1.4 to 2.6 m, one kind, no collider (you ride through it) |
| The muddy way in | block | A 14 m, three-point smear of dark mud that ends in a point at the reeds (shots 01, 02): no ruts, puddles, hoofprints or edge, and pale round dabs at even spacing in it like polka dots |
| The gateway in the lane's hedge | block | A bare mouth in the hedge: no posts, no gate (the south, north, pit and road gates have models, the paddocks have none) and no worn ground except the mud patch |
| Grass and tussocks | passable | An even mown green with tufts of one shape (shots 09, 10, 11), as Home Ground's; none of the rushes, poached ground, flowers or wet patches a wet meadow has |
| The meadow's hedges | passable | Graded with the lane's and the grass field's (#669): the same near and far hedges, an even band with no gaps or standard trees |
| The meadow at night | block | Black, and the water does not catch the moon: the pond is a dark hole at dusk (shots 03, 10) |
