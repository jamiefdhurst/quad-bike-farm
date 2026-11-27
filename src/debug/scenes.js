// Scenes: a feature set up in one go so it can be looked at in play in half a minute. A scene is console `lines` (weather, time, where you
// are) and then, where it has to place or dress a girl or move a flock, a `setup` from sceneSetups.js that uses the game's own methods.
// The console's `scene` command and the Girls tab's Scenes folder run the same list. A new item that can only be judged by eye adds its
// scene here.

import { SETUPS } from './sceneSetups.js';

/**
 * @typedef {object} Scene
 * @property {string} id       what the console calls it
 * @property {string} label    the panel's button text (no ": " in it: buttonText.js cuts there)
 * @property {string[]} lines  console lines, run first, in order
 * @property {string} [setup]  a function in SETUPS, run after the lines
 */

/** @type {Scene[]} */
export const SCENES = [
  { id: 'lifthut', label: 'Put you at the foot of the shepherd\'s hut\'s steps in daylight and send Amy up to it on the nearest quad, to see her arrive, park, get off and go in', lines: ['weather.time 11', 'tp me to hut', 'girl amy lift'] },
  { id: 'callThem', label: 'Put you out on the lane in daylight with the girls in the yard: open your wheel (Enter at nobody) and Call them', lines: ['weather.time 11', 'tp me to lane'] },
  { id: 'exhaustBlow', label: 'Put you in the yard at dawn with the Farm 300 stone cold and its exhaust joint blowing: start it and listen to the tick and chuff fade as it warms', lines: ['weather fair', 'weather.time 7', 'cool all', 'vehicle.farm300.faults.exhaustBlow 0.8', 'tp me to yard'] },
  { id: 'coldgauge', label: 'Put you beside the Finch in daylight with every engine stone cold, to get in, start it and watch the temperature needle rise from C to the middle and stay there idling (about six minutes)', lines: ['weather.time 11', 'cool all', 'tp me finch'] },
  { id: 'hotrev', label: 'Put you on the Adder in the yard on a sunny midday, warm and running with the parking brake on, to hold the revs up and watch the needle climb into the red and the power go within a minute or two (Amy then says it is the revving)', lines: ['weather.kind sunny', 'weather.time 12', 'tp adder to yard', 'start adder', 'tp me adder'], setup: 'hotrev' },
  { id: 'carrevs', label: 'Put you beside the Finch in daylight with its engine running, to get in and rev it to the top and hear every firing hold together (tp me griffin, vauclair, crag or yak and start the same one for the others)', lines: ['weather fair', 'weather.time 11', 'tp me finch', 'start finch'] },
  { id: 'quadrevs', label: 'Put you beside the Farm 300 in daylight with its engine running, to get on and rev it up the range and hear its revs ring as one note that climbs (tp me rb300, hornet or tz65 and start the same one for the others)', lines: ['weather.time 11', 'tp me farm300', 'start farm300'] },
  { id: 'bearingHum', label: 'Put you in the yard in daylight on the Farm 300 with a worn wheel bearing: ride it and listen to the hum rise with speed and sit on the wheel it is in', lines: ['weather fair', 'weather.time 11', 'vehicle.farm300.faults.bearing 0.8', 'tp me to yard'] },
  {
    id: 'frost',
    label: 'Set up a frosty dawn, every vehicle stone cold',
    lines: ['weather sunny', 'weather.temperature -4', 'weather.time 6.8', 'weather.puddleIce 1', 'cool all', 'tp me to yard'],
  },
  { id: 'controls', label: 'Make it dusk and send Amy off in the Tor or Crag and Jess on the red: lights, indicators, and what they leave behind', lines: ['weather.time 21.5', 'girl amy drive tor', 'girl jess drive farm300'] },
  { id: 'carboil', label: 'Put you in front of the Finch (or another car, the Tor or the Crag) where it is parked on a dry midday, running, low on coolant and boiling over, to see the steam rise from the grille and the front of the bonnet, not the cab', lines: ['weather.kind fair', 'weather.time 12'], setup: 'carboil' },
  { id: 'hotoff', label: 'Put you in the yard by the Adder, switched off as if just worked hard: listen to its metal tick as it cools, slower and slower, for a minute or so; then `vehicle.adder.soak 0.3` for one that has only idled, which hardly ticks', lines: ['weather.kind sunny', 'weather.time 12', 'tp adder to yard', 'tp me to yard', 'vehicle.adder.soak 1'] },
  { id: 'hotpink', label: 'Put you on the Hornet (or, on a farm without one, another air-cooled quad that pinks) in the yard on a sunny midday with its engine already hot: idling it stays quiet, and pulling away or revving it it pinks, a quick metallic rattle', lines: ['weather.kind sunny', 'weather.time 12'], setup: 'hotpink' },
  { id: 'earlier', label: 'Put you stood by the girls with a race and a tipped quad already in the day, so they bring them up in half a minute', lines: ['weather fair', 'weather.time 11', 'tp me to yard'], setup: 'earlier' },
  { id: 'generator', label: 'Put you at the barn generator with a full tank, in daylight, to start it, listen to it run and see how long it lasts', lines: ['weather fair', 'weather.time 12', 'generator.fuel 5', 'tp me to generator'] },
  { id: 'boards', label: 'Put you at the barn with ads pinned on the small ads board, in daylight, to look at the boards on its back wall', lines: ['weather.time 12', 'farm.ads on', 'tp me to barn'] },
  { id: 'snow', label: 'Set up snow falling at midday, in the yard', lines: ['weather snow', 'weather.time 12', 'tp me to yard'] },
  { id: 'flock', label: 'Put the flock on its half of the hill just past the stream, and you looking at it', lines: ['weather fair', 'weather.time 10'], setup: 'flock' },
  { id: 'backlane', label: 'Set up daylight for Back Lane: then `tp me to backlane`, `backlaneford`, `hairpins` or `footpath` to look at the hedges, verge, signs, passing places and ford', lines: ['weather fair', 'weather.time 12'] },
  { id: 'aroad', label: 'Set up daylight for the A-road and the lane: then `tp me to junction`, `villagejunction`, `lanesouth`, `cottages`, `postbox` or `busstop`, `lane.aRoad on` for a vehicle on the A-road, and walk or ride over a give-way line to be turned round (or `lane.turnYouRound on`)', lines: ['weather fair', 'weather.time 12'] },
  { id: 'moor', label: 'Set up daylight on the Moor: then `tp me to moor`, `ridge`, `stile` or `moorgrid`, `lane.moorMonth 8` for the purple heather, `5` for the cotton grass, `9` for the rust bracken, and walk up to the stile in the ridge wall to be turned round; `tp me to flush` and ride west into the wet flush to bog, `tp me to moorsheep` on Back Lane by the summer flock (`weather.season summer` reloads for May to September; `weather.season spring` for the curlews and skylarks, which also call on the heather, with the wind always up there), and ride over either cattle grid for the rattle (`tp me to moorgrid`)', lines: ['weather fair', 'weather.time 13'] },
  { id: 'farland', label: 'Set up a clear day on the Moor\'s ridge to look at the far landscape: then `tp me to ridge`, and `tp me to hairpins` for Back Lane\'s south end looking along the lane, or `tp me to hill` for the hilltop; the view reaches about 1.5 km on a clear day and the land beyond the map\'s edge is for looking at; `tune.graphics.viewDistance` (300 to 3000) sets how far a clear day shows and every other weather keeps its share of it', lines: ['weather fair', 'weather.time 13'] },
  { id: 'terraces', label: 'Put you on the top tread of the sheep field, above its two banks', lines: ['weather fair', 'weather.time 11', 'tp me to terraces'] },
  { id: 'flask', label: 'Put Amy by the flask on the rock at the top of the hill, with you beside it', lines: [], setup: 'flask' },
  { id: 'lunch', label: 'Set up midday with both girls hungry, and you in the yard, so they fetch their bags and have lunch', lines: ['weather fair', 'weather.time 12.3', 'tp me to yard', 'girl.amy.needs.hunger 0.9', 'girl.jess.needs.hunger 0.9'] },
  { id: 'tz65', label: 'Put the mini moto in the paddock and send Jess for a go on it', lines: ['weather fair', 'weather.time 11'], setup: 'moto' },
  {
    id: 'wardrobe',
    label: 'Line both girls up in the next outfit and layer (run again for the next)',
    lines: ['weather fair', 'weather.time 11'],
    setup: 'wardrobe',
  },
  { id: 'farhedges', label: 'Put you in the yard with the hedges swapping to their far strips at 25 m instead of 150 m, and the oaks and bushes to their lighter far ones at 25 m instead of 70 m', lines: ['weather sunny', 'weather.time 12', 'tp me to yard'], setup: 'farHedges' },
  { id: 'landform', label: 'Put you at the west edge of the farm, about 20 m above the yard, to see the land fall away east', lines: ['weather sunny', 'weather.time 12', 'tp me -450 0'] },
  { id: 'hollowwood', label: 'Put you at Hollow Wood\'s gate in daylight, to look at the oaks (they swap for lighter ones beyond 70 m), the lean-to and woodpile, and the ferns (tp me to woodpile, veteranoak, fern or hollowrun for the rest; weather.season autumn for the turned leaves)', lines: ['weather sunny', 'weather.time 12', 'tp me wood'] },
  { id: 'landmarks', label: 'Put you ten metres south of Hay Meadow\'s lone ash in daylight, to look at the field landmarks', lines: ['weather sunny', 'weather.time 12', 'tp me 0 133'] },
  { id: 'drive', label: 'Put you on the road eight metres from the cattle grid in daylight, to look at it and the tarmac, gravel edges, potholes and verges beside it (it is the drive, with its field gate and reflector posts, and where the drag races run along it, #616)', lines: ['weather sunny', 'weather.time 12', 'tp me cattlegrid'] },
  { id: 'neighbour', label: 'Put you just inside the neighbour\'s gateway in daylight, to look at her yard, her barn and her house (she is across the lane, with her track from it and her fields behind)', lines: ['weather sunny', 'weather.time 12', 'tp me neighbour'] },
  { id: 'farmstead', label: 'Put you in the yard in daylight, to look at the barn with its doors facing it, the bell, tanks and generator by it, and from here the stackyard, orchard, garden wall and Home Ground\'s rail (tp me stackyard, orchard, garden, cars and home go round them; barnwall, homegate and stackbales go to the yard\'s hose reel, steel gate and square bales; weather.wet 1 fills its puddles)', lines: ['weather sunny', 'weather.time 12', 'tp me yard'] },
  { id: 'yardnight', label: 'Put you in the yard at 21:00 with the generator running (pull again if it does not catch), to see the floodlights on the barn\'s door wall and on the pole behind the tanks (the vane on the barn\'s ridge turns into the wind by day)', lines: ['weather sunny', 'weather.time 21', 'generator.fuel 5', 'generator.running true', 'tp me yard'] },
  { id: 'barnlights', label: 'Put you in the barn at 21:00 with the generator running (pull again if it does not catch), to see its six bulbs, the desk by the boards, the weather board by the doors and the clock over the bench', lines: ['weather sunny', 'weather.time 21', 'generator.fuel 5', 'generator.running true', 'tp me to barn'] },
  { id: 'inspectionpit', label: 'Stand the inspection pit in the barn and put you inside it in daylight, to look down into the trench: its block walls, the steps and grab rail, the lamps, and the chequer-plate cover rolled over one end (walk to the big bay in the middle of the barn; `farm.pit off` fills it in again)', lines: ['farm.pit on', 'weather sunny', 'weather.time 12', 'tp me barn'] },
  { id: 'river', label: 'Put you on the river crossing\'s south landing by day, to look at the banks (gravel bars inside the bends, cut banks outside), the crossing\'s gravel, ruts and stones, the reeds, rushes and sedge, the pools and riffles below it (still dark pools, each spilling over a short riffle of broken water with a gravel bar onto the next; `tp me to riffle` for the bar beside the first), and to hear the river: the water babbles over the crossing and each riffle and murmurs along the pools, with rooks, a wagtail and a moorhen and the willows in the wind (`weather.stream 1` for a full river, `weather.rain 0.8` for rain, `river.sound` for how loud it is where you stand)', lines: ['weather.kind sunny', 'weather.time 11', 'tp me to river'] },
  { id: 'dawnchorus', label: 'Put you on Home Ground at 06:45 (first light near the equinoxes) with the dawn chorus singing from the hedges round you: blackbirds, robins and wrens, placed where each sits and duller further off (`birds` says how thick it is; it is gone two hours after sunrise, the odd song carries on until about 10:00, and `birds chorus` starts it again at any hour)', lines: ['weather.kind sunny', 'weather.time 6.75', 'tp me to home', 'birds chorus'] },
  { id: 'rooks', label: 'Put you on Home Ground in the hour before sunset with a flock of rooks coming over, cawing as it crosses the sky in one direction (`birds rooks` sends another; they come on their own every few minutes until sunset)', lines: ['weather.kind sunny', 'weather.time 16.75', 'tp me to home', 'birds rooks'] },
  { id: 'tracks', label: 'Set up daylight for the farm\'s tracks: then `tp me to stonetrack` for the stone track north, `farmbridge` for the farm bridge over the river\'s head, `boundarytrack` for the grass track, `brookford` for its ford over the east brook (ride down the landing and through it, `weather.stream 1` for the brook full) and `headland` for the headland', lines: ['weather sunny', 'weather.time 12'] },  { id: 'pitgate', label: 'Put you just inside the gravel pit\'s gate in daylight, to look at the fence round its field and the road from the gate to the lip (the farm gate in post and wire; tp me pitlane for the shut lane gate, pitwall for the flags at the foot of the climb)', lines: ['weather sunny', 'weather.time 12', 'tp me pitgate'] },
  { id: 'pitrelics', label: 'Put you on the gravel pit\'s floor behind the screening plant in daylight, to look at the relics as years of standing have left them: the torn belt and the weeds at the plant\'s footings, the cracked pad, the excavator in faded yellow with rust from its pins, its windscreen put through and grass up through its tracks, the cabin shut, padlocked and boarded with its chair blown over, and the heaps grassed over with birch and buddleia (`tp me pitpond` for the reeds round the pond and the rusted drums, `tp me pitcontainer` for the container chained on its hardstanding)', lines: ['weather sunny', 'weather.time 12', 'tp me plant'] },
  { id: 'pitscrub', label: 'Put you on the gravel pit\'s ride by the climb\'s finish in daylight, to look at the field gone to scrub: hawthorn, gorse, bramble and birch thick along the lip, rough grass and thistles, the mown ride kept open round the pit, and across it the walls\' faint level beds with iron in patches, the dark topsoil at the lip with roots hanging out and the scree at the foot (`tp me pitlip` for the lip close, `tp me pitdeadtree` for a dead tree at the rim, `tp me pittrees` for the tree line from Top Field)', lines: ['weather sunny', 'weather.time 12', 'tp me pitride'] },
  { id: 'pitentrance', label: 'Put you on the gravel pit\'s lane entrance by the lane in daylight, to look at the shut lane gate on its concrete posts, chained and padlocked, the broken bellmouth with its ruts, the blocks, the height barrier, the old works sign and the newer plate, the weeds, buddleia and the hedge with its litter, and the spoil bank over it (`weather.wet 1` fills the ruts\' puddles; `weather.time 21` and a quad\'s lights on the barrier for its bands)', lines: ['weather sunny', 'weather.time 12', 'tp me pitentrance'] },
  { id: 'nether', label: 'Put you on the green at Nether Thornby in daylight, to look at the street with the pub, the shop and the cottages (it is across the lane, its street running east to the A-road: tp me carpark for the pub, approach for the lane before the 30 signs and smallfarm for the farm, motbay and mot for the garage on the lane, `village.shop on`, `village.garage on` or `village.parts on` to stand at each, and the bridge is on the lane just north of the garage)', lines: ['weather sunny', 'weather.time 12', 'tp me village'] },
  {
    id: 'footsteps',
    label: 'Put you in the yard on concrete at midday with Amy tagging along behind you: walk and jog, then `tp me to stonetrack` for gravel, `barn` for the barn floor, `dutchbarn` for straw and `wet` for mud, and stand still to let her catch you up (her steps are quieter and only heard inside 6 m); `tune` has the volumes',
    lines: ['weather sunny', 'weather.time 12', 'tp me to yard', 'girl amy tag-along'],
  },
  {
    id: 'helmetvoice',
    label: 'Put you in the barn at midday with Amy fetching her helmet from the hooks and tagging along: listen to her voice ring in here and go muffled once the helmet is on her head (`girl amy helmet` hangs it up again; `tp me to yard` for her outside; `tune` has her voiceHelmetCutoff)',
    lines: ['weather sunny', 'weather.time 12', 'tp me to barn', 'girl amy helmet', 'girl amy tag-along'],
  },
  { id: 'splitter', label: 'Put you at the log splitter on the tractor at the woodpile by day, the engine running, its brake on and a round on the beam: hold E to push the ram through and listen to the pump whine, the ram strain in the round and the oil hiss as it comes back', lines: ['weather.kind sunny', 'weather.time 12'], setup: 'splitter' },
  { id: 'end', label: 'Let the girls go about their day again after a scene', lines: [], setup: 'end' },
];

/** Runs a scene's lines, then its setup, stopping at the first failure. Returns what to print. `game` is the game (the setups need it). */
export function runScene(scene, shell, game, setups = SETUPS) {
  const keep = shell.history.length;
  const out = [];
  const say = (line) => {
    const r = shell.run(line);
    const bad = r.find((l) => l.kind === 'error');
    if (bad) throw new Error(`${scene.id} stopped at "${line}": ${bad.text}`);
    out.push(...r.map((l) => l.text));
  };
  try {
    setups.prepare?.(game);
    for (const line of scene.lines) say(line);
    if (scene.setup) out.push(...setups[scene.setup](game, say));
  } catch (e) {
    out.push(e.message);
    out.failed = true; // the smoke test tells a scene that broke from one that printed something (tools/smokeActions.mjs)
  }
  shell.history.length = keep; // the scene's own lines are not what was typed
  return out;
}
