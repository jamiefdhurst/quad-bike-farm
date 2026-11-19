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
  {
    id: 'frost',
    label: 'Set up a frosty dawn, every vehicle stone cold',
    lines: ['weather sunny', 'weather.temperature -4', 'weather.time 6.8', 'weather.puddleIce 1', 'cool all', 'tp me to yard'],
  },
  { id: 'controls', label: 'Make it dusk and send Amy off in the Tor or Crag and Jess on the red: lights, indicators, and what they leave behind', lines: ['weather.time 21.5', 'girl amy drive tor', 'girl jess drive farm300'] },
  { id: 'earlier', label: 'Put you stood by the girls with a race and a tipped quad already in the day, so they bring them up in half a minute', lines: ['weather fair', 'weather.time 11', 'tp me to yard'], setup: 'earlier' },
  { id: 'generator', label: 'Put you at the barn generator with a full tank, in daylight, to start it, listen to it run and see how long it lasts', lines: ['weather fair', 'weather.time 12', 'generator.fuel 5', 'tp me to generator'] },
  { id: 'boards', label: 'Put you at the barn with ads pinned on the small ads board, in daylight, to look at the boards on its back wall', lines: ['weather.time 12', 'farm.ads on', 'tp me to barn'] },
  { id: 'snow', label: 'Set up snow falling at midday, in the yard', lines: ['weather snow', 'weather.time 12', 'tp me to yard'] },
  { id: 'flock', label: 'Put the flock on its half of the hill just past the stream, and you looking at it', lines: ['weather fair', 'weather.time 10'], setup: 'flock' },
  { id: 'backlane', label: 'Put you on Back Lane in daylight (the new farm: ?layout=2), to look at the hedges, verge, signs and passing places, then `tp me to backlaneford`, `hairpins` or `footpath`', lines: ['weather fair', 'weather.time 12', 'tp me to backlane'] },
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
  { id: 'farhedges', label: 'Put you in the yard with the hedges swapping to their far strips at 25 m instead of 150 m', lines: ['weather sunny', 'weather.time 12', 'tp me to yard'], setup: 'farHedges' },
  { id: 'landform', label: 'Put you at the west edge of the farm, about 20 m above the yard, to see the land fall away east (on layout 2: today\'s farm is not tilted)', lines: ['weather sunny', 'weather.time 12', 'tp me -450 0'] },
  { id: 'hollowwood', label: 'Put you at Hollow Wood\'s gate in daylight, to look at the oaks (they swap for lighter ones beyond 70 m), the lean-to and woodpile, and the ferns (on layout 2: tp me to woodpile, veteranoak, fern or hollowrun for the rest; weather.season autumn for the turned leaves)', lines: ['weather sunny', 'weather.time 12', 'tp me wood'] },
  { id: 'landmarks', label: 'Put you ten metres south of Hay Meadow\'s lone ash in daylight, to look at the field landmarks (on layout 2: today\'s farm has none; tp me to loneoak, oldgateposts, deadelm, farpond, castroller, brookalders or bigoaks for the rest)', lines: ['weather sunny', 'weather.time 12', 'tp me 0 133'] },
  { id: 'drive', label: 'Put you on the road eight metres from the cattle grid in daylight, to look at it and the tarmac, gravel edges, potholes and verges beside it (on layout 2 it is the drive, with its field gate and reflector posts)', lines: ['weather sunny', 'weather.time 12', 'tp me cattlegrid'] },
  { id: 'neighbour', label: 'Put you just inside the neighbour\'s gateway in daylight, to look at her yard, her barn and her house (on layout 2 she is across the lane, with her track from it and her fields behind)', lines: ['weather sunny', 'weather.time 12', 'tp me neighbour'] },
  { id: 'farmstead', label: 'Put you in the yard in daylight, to look at the barn with its doors facing it, the bell, tanks and generator by it, and from here the stackyard, orchard, garden wall and Home Ground\'s rail (on layout 2: tp me stackyard, orchard, garden, cars and home go round them)', lines: ['weather sunny', 'weather.time 12', 'tp me yard'] },
  { id: 'pitgate', label: 'Put you just inside the gravel pit\'s gate in daylight, to look at the fence round its field and the road from the gate to the lip (on layout 2: the farm gate in post and wire; tp me pitlane for the shut lane gate, pitwall for the flags at the foot of the climb)', lines: ['weather sunny', 'weather.time 12', 'tp me pitgate'] },
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
