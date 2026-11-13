---
paths:
  - "src/vehicle/**"
  - "tests/vehicleModels.test.js"
  - "tests/fixedPoints.json"
---

## Using the detail kit (vehicle items 88 to 101)

Each vehicle's "in full detail" item uses the shared kit in `src/vehicle/detail/` (docs/decisions/vehicles.md, "A shared detail kit for the vehicle models (TODO 87)"). The aim is a model much more in proportion and much more like its real counterpart. Work one vehicle at a time.

- **Start with proportion.** Check that vehicle's entry in `REAL_SIZES` (`realSizes.js`) against the real one's published figures and correct it if it's wrong, then look at its errors: write a scratch test that prints `proportionErrors(measureModel(model, layout), REAL_SIZES[id])` (build it with `buildAllModels` in `tests/helpers/vehicleModels.js`). `docs/decisions/vehicles.md` ("A shared detail kit") lists where each vehicle stood when the kit landed. Fix the body's shape until every measure is within 8%, then add the id to `IN_PROPORTION` so the test keeps it there.
- **Fixed points stay put**: seats, grips, footrests, pegs, dash, cameras, rider and pillion anchors, rack, mug, hitch, winch (`tests/fixedPoints.json`, checked to 2 mm). Build the new body round them. If one is badly out of proportion itself, moving it is a decision: ask Jamie, check the girls on it, regenerate with `UPDATE_FIXED_POINTS=1 npx vitest run tests/vehicleModels.test.js`, and say why in `docs/decisions/vehicles.md`.
- **Triangle budget** (`budgets.js`, checked in `tests/vehicleModels.test.js`): put detail where it shows from the seat and from beside it, not underneath.
- **The pieces.** Tyres: `treadTyre(kind, { radius, width, rimR, count })` (`tread.js`; pick the kind that matches the real tyre). Bolts: `boltsMesh(points, normal, material, { size, kind })` with `boltCircle`/`boltRow` (`fixings.js`). Cables and hoses: `cableGeometry(anchors, r)` and `hoseGeometry(anchors, r, { ribbed })` through the points they're clipped to (`cables.js`). Brakes: `discGeometry`, `caliperGeometry`, `drumGeometry` (`brakes.js`; the disc and drum go in the wheel's `spin` group, the caliper and backing plate in the wheel group). Decals: `decalMesh(kind, opts, { width })` (`decals.js`): `badge` with the maker from `MAKER_FOR`, `stripes`, `warning`, `chassis`, `number`, `dealer`. Place a decal 1 mm off the surface. Never a real maker's name; the test checks the strings.
- **The cab and interior pieces** (TODO 340, docs/decisions/vehicles.md "A cab and interior kit"): `buildSteeringWheel` (`steeringWheel.js`), `buildSeat` (`seats.js`), `buildSeatBelt` (`belts.js`, the `stowed`/`worn` children the belt poser expects), `buildLever`, `buildHandbrake`, `buildPedal` (`cabControls.js`), toggles, rockers, knobs, bezels, vents and the glovebox (`switchgear.js`), `buildMirror` (`mirrors.js`), `buildLamp` (`lamps.js`, the lens named `lens` for the light code), handles, catches, hinges, grilles, wipers and seals (`fittings.js`), `trimMaterial` (`trim.js`, big surfaces with UVs only) and `buildRoadWheel` (`roadWheels.js`). Each takes `mats` overrides of the palette in `parts.js`. Replacing a vehicle's own part with the kit's keeps the names the game looks for (gearLever, parkBrakeLever, handlebars, belt_<seat>...) on the same groups, at the same fixed points.
- **Touch wear** comes from the named levers, pedals, footrests and seat points; add a vehicle's own (a door sill, a grab handle) as `userData.touchWear` in the body's frame.
- **Wear** is not modelled by hand. The wear layer finds the edges and nooks of whatever geometry there is, so give parts real edges (a box-like panel, not a smooth blob) where paint should rub through. Set how worn the vehicle is with `bodyWear` on its spec. Don't paint rust or mud into a material's colour.
- **Name the real vehicle once.** A model's body file starts with one line, "After a Land Rover Series III 88-inch hard-top pick-up.", and nothing else in `src` or `tests` names it: the code says `tor`, `bruin`, `hartley` (`tests/vehicleCodeNames.test.js` fails otherwise; the words are in `tools/realMakes.json`).
- Matching the real thing means its look, not its name or badge: the makers are made up (Kestrel, Tamura, Ridgeback, Viper, Hartley, Moorland, Thorne, Ashby).
- Check with tests, and for a vehicle model also by eye (see "Lessons from the red quad" below): the tests can't see a gap or a floating label.

## Lessons from the red quad (item 88)

The red took many rounds because these were missed. Do them first on every vehicle item.

- **Ask for reference photos before building.** Photos of the real machine: the body from the sides, front and rear, and its controls. Memory and web searches gave boxy fenders, round headlights and a floating hitch; with photos it took one round. If there are none, ask; don't build from memory.
- **Look at renders of model work.** Unit tests can't see a gap, a floating label or a part ending in the air, so this is the exception to "no screenshot rounds". Use `.scratch/pp/redshot.mjs` as the pattern: it hides the HUD, fixes the camera, and works with the overlay clicked through. Shoot front-side, rear-side, above, and from the seat for controls, and crop in close (a narrow fov) for lettering. Say what you did and didn't see.
- **No see-through gaps.** Every edge should join something: a deck's end, a rack leg, a frame rail, a brace. Make parts meet exactly (shared heights and edges, a wall at a deck's end, a cover between decks) and test that they do. A bar must end on a surface, never in the air.
- **No straight edges where the real thing is moulded.** Crown, roll and round the plastics (`farm300Deck.js`); sweep the ends in plan and in height.
- **Lettering and labels.** Put them on flat, square-edged faces, not rounded corners, and 1 mm off the surface. Put each at its measured place from the photo, once.
- **Holes.** Rounded boxes butted edge to edge leave a notch at every corner where two meet, and where three meet it goes right through: pinholes in every door and post. Build panels and posts from plain boxes (or overlap the pieces by more than the radius). Add a ray-grid test like `tests/cragModel.test.js`'s: fire rays at each side and the back from outside, on a grid that does not line up with the seams, and fail if one hits the inside instead of the skin. Never say a gap is fixed without it.
- **Z-fighting.** Two surfaces 1 mm apart fight at distance. Embed an attached part a few millimetres into its parent.
- **Fixed points may move on purpose.** The red's handlebars went 40 mm lower: regenerate `tests/fixedPoints.json` for that vehicle only, check nothing else changed, and say why in `docs/decisions/vehicles.md`.
- **Touch wear.** `touchWear` points are capped at eight in all, and a boot patch shows nothing on black vinyl. A part marked up with no neighbour uses `wearNookMin` on its mesh.
- **Controls.** Model them from the real machine's (the pod, levers, switches, thumb throttle) in a module like `farm300Controls.js`. Parts the game poses keep their names; a new style (such as the choke's `slide`) needs `CHOKE_STYLES`, the quad's pose, a test, the debug panel and the console. Choke knobs are black, not yellow.
- **Reuse.** The red's pod, levers, 2WD/4WD rocker and thumb throttle are for the other quads' items to adapt, not rebuild. Check the gaps and the lettering in each from the seat.
- **Cluster badges.** A vehicle's cluster takes its maker's name (`makerBadge` in `dash.js`) in empty space on its face, and a number plate only if the vehicle would leave the farm.

