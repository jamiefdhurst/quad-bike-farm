# Glossary

One name for each place, thing and job, used everywhere a player reads it: prompts, toasts, the girls' lines, the FAQ, `docs/game.md`, the console and the debug panel (`.claude/rules/controls.md`). Code identifiers can differ; what a player reads cannot.

`tests/glossary.test.js` reads the "Not" column (variants separated by commas) and fails on any of them in `src/` or `docs/game.md`, so a variant that is listed cannot come back. A new thing gets a row before it gets a prompt. Use the name in the first column, and add the variants you find to the last.

**Vehicles are called by their made-up names, never the real make or model they copy** (the Tor, the Crag, the Bruin, the Finch...). A vehicle's id, style, files and every name in the code are its in-game model name, and the real one is named only on the "After a ..." line at the top of its body file. The farm's two old 4x4s are "the Tor and the Crag", one of them "a Tor or Crag". `tests/noRealMakes.test.js` fails on a real make or model anywhere in `src`, `tests`, `docs` or `.claude` outside an "After a ..." line and the record in `docs/decisions/`; its words are in `tools/realMakes.json`, each with why.

A row is for a name with a choice in it. A thing with one obvious name does not need one.

| Name | What it is | Not |
| --- | --- | --- |
| the drive | The old tarmac road on the new farm from the lane to the yard, open to the fields either side, with the cattle grid at the lane end (today's farm has the farm road instead) | driveway, farm track |
| the A-road | The main road down the valley east of the farm on the new farm, two lanes with a white dashed centre line, edge lines and cat's eyes. The lane meets it in the north and the village street at the village's junction, each with a give-way line and sign; pull out onto it and you are turned round | the highway, the dual carriageway, the trunk road |
| town | Where the fingerposts point and the girls say you are not going today: Kelby 4 miles up the A-road, Ashwell 3 miles down it, Haddon 6 miles on down the lane. Never reached; the girls turn you round at the A-road and at the lane's southern line | the city, the market town |
| Back Lane | The old single-track road round the farm's north, west and south on the new farm, with passing places, hedges and a ford; it leaves the public lane at the north and rejoins it below the village | the back road |
| passing place | A widened bay in Back Lane's edge with a white diamond sign, where one vehicle pulls in to let another by | lay-by, pull-in |
| Upper Thornby | The hamlet on the hill to the west that the footpath off Back Lane climbs to; seen as roofs and a church tower, never reached | the village (that is Nether Thornby) |
| radio station | One of the radio's two stations: Dale FM (easy listening and pop) and Quarry Rock (rock). The radio key changes between them | radio channel, radio frequency |
| woodpile | The stack of split logs by the wood's gate, with the rounds lying beside it. The farm map names it, with how many logs are on the stack. On the new farm it also has a lean-to with an old stack under it and a chopping block, which are there with or without the tractor | wood pile |
| Fern Trail | The narrow single-track path for the two-wheelers through the wood, marked by the blue-banded posts | Fern Path, Bike Trail, the trail loop |
| way-marker post | The timber post with a blue band and an arrow beside the Fern Trail | waymarker, waymark post |
| Call them | The choice on your own wheel (`Enter` looking at nobody) that whistles for the girls: those in reach come, those further off in earshot say where they are | summon |
| a lift | What a girl asks for, or takes a quad to get, when where she wants to be is more than about 150 m of walking away: a ride on the back of your quad, or her own quad | carpool |
| the Moor | The open common beyond Back Lane's west side, up to the ridge wall: heather, bracken, flushes, outcrops, peat banks, the spring and the trig pillar (the new farm) | the fell, the hill moor |
| ridge wall | The drystone wall along the top of the Moor, the end of the map, with the ladder stile in it | moor wall, top wall |
| ladder stile | The timber stile over the ridge wall: climbing it turns you round | moor stile |
| trig pillar | The white concrete pillar, a metre and a bit high with a brass plate on top, on the Moor's ridge | trig point, triangulation pillar |
| moor gate | The gate in the hill pasture's wall onto Back Lane and the Moor | hill gate |
| shepherd's hut | The little wheeled hut on top of the hill pasture, with the bunk, the stove and the kettle | shepherds hut, shepherd's shed, hill hut, hut on wheels |
| river | The wide river across the riverside meadow, past the pasture's east hedge: the brook widened | big stream |
| crossing | The marked shallows across the river, between the white posts | river ford |
| gravel pit | The old pit in the hedged field north of the barley field, through the gate in its north hedge (on the new farm, the Old Pit in the north-east corner by the lane, fenced in post and wire): the deep cut, its haul roads, pond and heaps | sandpit, sand pit, gravel quarry, borrow pit |
| lane gate | The gravel pit's gate onto the lane on the new farm, where the lorries came in: shut and chained for good, the haul road starts at it and nothing goes through it | pit gate, quarry gate, main gate |
| stone track | The farm's own hardcore track on the new farm, two arms from the yard: north to the pit's farm gate and south over the farm bridge into Brook Meadow; two wheel ruts of chippings with a grass crown | hardcore road |
| boundary track | The grass track round the inside of the new farm's boundary, about 14 m in, closing the loop; it goes round the Old Pit and over the stream at the green lane's ford | perimeter track, ring road |
| headland | The 6 m strip of grass inside every arable field's edge on the new farm, where the crop is never drilled and you can ride | headland strip |
| farm bridge | The small bridge on the stone track south that crosses the head of the river: sleeper deck on stone abutments, steel tube rails | plank bridge |
| farm gate | The gate in the gravel pit's west fence on the new farm, from the stone track: tied open, the way in, where the girls wait just inside | pit gate, quarry gate, back gate |
| haul road | One of the two wide gravel roads that fork at the gravel pit's lip and wind down its wall, each way round, to the floor | access road, ramp road |
| pit climb | The timed run up the gravel pit's steep wall, from the cones on the floor to the cones over the lip | gravel climb, wall climb |
| mower | The Ridgeback Clipper 12, the little ride-on with the cutting deck and the grass box; its job is mowing the lawns | lawnmower, lawn mower, lawn tractor, grass cutter |
| blade lever | The red-knobbed lever on the left of the mower's seat that engages the blade (T), with the amber BLADE lamp on the dash | PTO lever, cutter lever, deck lever |
| chain harrows | The set of harrows on the little two-wheeled carrier: a mat of steel links with a tine at each joint that you lower with T and drag over the harrow field | drag harrows, disc harrows, harrow mat |
| harrow field | The marked rectangle of the grass field, east of the middle inside the Home Loop, that the harrowing job combs | harrow paddock, harrowing paddock |
| field name | What a field of the new farm is called, dealt to each farm from its own seed and kept in its save: a name of its kind, such as Top Field for arable, Brook Meadow for wet grazing, Hill Pasture for the hill. It is written on the map and the chalkboard, never spoken: the girls say the kind of field, "the barley field", "the hay meadow" | parcel name, plot name, paddock name |
| lawns | The yard lawn at the yard's east edge and the paddock's floor, the grass the mower stripes (on the new farm, the garden's lawn behind its wall) | lawn patches, mowing plots |
| cork board | The board on the barn's back wall where photos are pinned | corkboard, cork-board |
| money tin | The tin on the corner shelf in the barn that holds the farm's money | biscuit tin |
| snack tin | The round cream-and-blue tin of biscuits on its own shelf in the barn that the girls help themselves from | biscuit tin (the money tin's old nickname), cookie jar |
| lunch bag | The canvas tote a girl fetches from her car at lunchtime | picnic basket, lunch box |
| workbench | The bench along the barn's north wall where jobs are done and the bay is | work bench |
| toolbox | The red box you carry and open at a quad | tool box |
| rack | The rack over a quad's back wheels, where the girls leave their tea and where you can strap a jerry can or the toolbox | luggage rack |
| strap | The orange ratchet strap that holds a jerry can or the toolbox down on a quad's rack: hold E on the rack to do it up or undo it | tiedown |
| booster pack | The black and yellow jump-start pack on the back of the workbench: charged on the bench charger, carried to a flat vehicle | jump starter, jump pack, battery pack, power pack |
| tyre plug | The sticky rubber strip from the plug kit in the toolbox, pushed into a puncture | tire plug, puncture plug, tyre strip, rope plug |
| jerry can | The 20 litre can you carry and pour from | jerrycan, jerry-can |
| diesel bowser | The squat dark green tank labelled RED DIESEL beside the farm's petrol tank, where a can is filled with diesel | diesel tank |
| seat belt | The belt in the Tor, the Crag and the UTV, on `;` | seatbelt |
| windscreen | The glass in front of you in the cars, the Tor, the Crag and the UTV | windshield, front screen |
| wipers | The blades that sweep the windscreen, worked by the wiper stalk on `X` | windshield wipers, wiper blades |
| mist | The fog of breath and wet clothes on the inside of a cab's glass; the heater, the wipers and a sleeve clear it | fog on the glass |
| your car | The Vauclair 39D, the silver-grey diesel you arrive in each morning, parked by the Dutch barn (the girls say "the Vauclair") | your saloon |
| tow rope | The rope on the Farm 300's and Bruin's racks | towrope, tow-rope |
| tank dip | Putting a stick down the filler, with `U` beside a quad, to read what is really in the tank, whatever its fuel gauge says | dip the fuel, fuel dipstick, tank stick |
| rolling road | The tuner's trailer with two steel rollers that comes to the farm about once a week: ride a quad onto it and have a run to see how much power it makes | dyno, dynamometer, dyno trailer, power rig |
| run | One go on the rolling road: the engine held and swept up through its revs while the power is measured, for £15 from the money tin | dyno run, power run |
| tuner | The woman who brings the rolling road | dyno operator, dyno man |
| results sheet | The sheet on the barn's back wall with a graph for each quad that has had a run | dyno sheet, power sheet, dyno chart |
| MOT | The test at Hollis Motors that goes over a Tor's or Crag's lights, brakes, wipers, horn, tyres, leaks and exhaust | M.O.T., roadworthiness test |
| MOT bay | The white-lined bay on the garage forecourt, in front of the western roller door, where a Tor or Crag is parked square to be tested | test bay, inspection bay |
| MOT sheet | The card the garage hands you after a test, with a pass or a fail beside each item | test report, MOT report |
| certificate | What a pass earns: good for a couple of weeks, kept by the farm and worth a little more on the cork board | MOT pass, test certificate |
