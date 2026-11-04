// Scenes: a feature set up in one go so it can be looked at in play in half a minute. Each is a list of console lines, so a scene is only
// ever what the console can already do (and the console's own tests and tools/consolePath.sh vouch for the lines). The console's `scene`
// command and the Girls tab's Scenes folder run the same list. A new item that can only be judged by eye adds its scene here.

/**
 * @typedef {object} Scene
 * @property {string} id      what the console calls it
 * @property {string} label   the panel's button text
 * @property {string[]} lines console lines, run in order
 */

/** @type {Scene[]} */
export const SCENES = [
  {
    id: 'frost',
    label: 'Set up a frosty dawn, the red quad stone cold',
    lines: ['weather sunny', 'weather.temperature -4', 'weather.time 6.8', 'weather.puddleIce 1', 'cool red', 'tp me to yard'],
  },
  { id: 'snow', label: 'Set up snow falling at midday, in the yard', lines: ['weather snow', 'weather.time 12', 'tp me to yard'] },
  { id: 'flock', label: 'Stand you at the sheep on the pasture', lines: ['weather fair', 'weather.time 10', 'tp me to pasture'] },
  {
    id: 'flask',
    label: 'Set up the flask on the rock at the top of the hill, with Amy',
    lines: ['weather fair', 'weather.time 15', 'tp me to viewpoint', 'girl amy flask'],
  },
  { id: 'moto', label: 'Send Jess to have a go on the mini moto, with you in the yard', lines: ['weather fair', 'weather.time 11', 'tp me to yard', 'girl jess moto'] },
  {
    id: 'wardrobe',
    label: 'Set up a wet day with both girls beside you, sent for a jumper and a coat',
    lines: ['weather rain', 'weather.time 11', 'tp me to yard', 'tp amy to me', 'tp jess to me', 'girl amy jumper', 'girl amy coat', 'girl jess jumper', 'girl jess coat'],
  },
];

/** Runs a scene's lines through the shell, stopping at the first that fails. Returns what to print. */
export function runScene(scene, shell) {
  const keep = shell.history.length;
  const out = [];
  for (const line of scene.lines) {
    const r = shell.run(line);
    const bad = r.find((l) => l.kind === 'error');
    if (bad) {
      out.push(`${scene.id} stopped at "${line}": ${bad.text}`);
      break;
    }
    out.push(...r.map((l) => l.text));
  }
  shell.history.length = keep; // the scene's own lines are not what was typed
  return out;
}
