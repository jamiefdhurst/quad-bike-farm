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
  { id: 'snow', label: 'Set up snow falling at midday, in the yard', lines: ['weather snow', 'weather.time 12', 'tp me to yard'] },
  { id: 'flock', label: 'Put the flock at the end of the lane, south of the gate, and you looking at it', lines: ['weather fair', 'weather.time 10'], setup: 'flock' },
  { id: 'flask', label: 'Put Amy by the flask on the rock at the top of the hill, with you beside it', lines: [], setup: 'flask' },
  { id: 'moto', label: 'Put the mini moto in the paddock and send Jess for a go on it', lines: ['weather fair', 'weather.time 11'], setup: 'moto' },
  {
    id: 'wardrobe',
    label: 'Line both girls up in the next outfit and layer (run again for the next)',
    lines: ['weather fair', 'weather.time 11'],
    setup: 'wardrobe',
  },
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
  }
  shell.history.length = keep; // the scene's own lines are not what was typed
  return out;
}
