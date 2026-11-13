import { describe, it, expect } from 'vitest';
import { readFileSync, writeSync } from 'fs';
import { buildGameTree } from '../src/console/gameTree.js';
import { buildCommands } from '../src/console/commands.js';
import { Shell, resolve, parseValue } from '../src/console/shell.js';
import { VEHICLE_VERBS } from '../src/console/gameHost.js';
import { VEHICLE_NAMES } from '../src/vehicle/names.js';
import { girlActions } from '../src/debug/girlActions.js';
import { jobActions } from '../src/debug/jobActions.js';

// `tools/consolePath.sh 'lane.kids on' 'tp me 105 -17' 'mist vauclair'` runs each line through the real command table and tree, so nothing
// reaches Jamie unrun. The game is a stand-in: it has no vehicles of its own (the stand-in knows every vehicle by its model name:
// farm300, tor, crag, vauclair ...), `tp` places are read from gameHost.js, and a value is parsed but never set. A NO about a vehicle id may be the stand-in, not the line.
const root = () => buildGameTree({ units: [], companions: [], weather: {} }, {});
const asked = (process.env.CONSOLE_LINES ?? '').split('\n').filter((l) => l.trim());

const placeNames = () => {
  const src = readFileSync(new URL('../src/console/gameHost.js', import.meta.url), 'utf8');
  const spots = src.slice(src.indexOf('const spots = {'), src.indexOf('return Object.fromEntries'));
  return [...spots.matchAll(/^ {6}(\w+):/gm)].map((m) => m[1]);
};

// Every job is on this stand-in farm, so a job line that is NO here may be a job a real farm does not have (`job` on its own lists them).
const anything = () => new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : anything()), apply: () => 0 });
const standInJobs = () => jobActions(new Proxy({ serviceJob: { name: '', kinds: [], left: new Set() } }, { get: (t, k) => (k in t ? t[k] : anything()) })).jobs;

const standIn = () => {
  const vehicles = [...Object.keys(VEHICLE_NAMES), 'rusty'];
  const places = Object.fromEntries(placeNames().map((n) => [n, { x: 0, z: 0 }]));
  const base = {
    vehicleVerbs: VEHICLE_VERBS,
    vehicles: () => vehicles.map((id) => ({ id, name: id, summary: '' })),
    girls: () => ['amy', 'jess'],
    things: () => ['me', ...vehicles, 'amy', 'jess'],
    places: () => places,
    locate: () => ({ x: 0, y: 0, z: 0, heading: 0 }),
    put: (thing, spot) => `${thing} to ${spot.x}, ${spot.z}`,
    girlVerbs: (id) => girlActions({ companions: [{ character: { id }, name: id }], hud: { toast: () => {} } }).forGirl(id),
    vehicleVerb: (id, verb) => `${id}: ${verb}`,
    jobs: () => standInJobs().map((j) => ({ id: j.id, name: j.name, stage: '', verbs: j.actions.map((a) => ({ verb: a.verb, label: a.label })) })),
    jobVerb: () => undefined,
  };
  return new Proxy(base, { get: (t, k) => (k in t ? t[k] : () => undefined) });
};

const check = (shell, line) => {
  const [head, ...rest] = line.trim().split(/\s+/);
  if (shell.command(head)) {
    const out = shell.run(line);
    const bad = out.find((o) => o.kind === 'error');
    return bad ? `NO   ${line}: ${bad.text}` : `ok   ${line}`;
  }
  const r = resolve(shell.root, head);
  if (r.error) return `NO   ${line}: ${r.error}`;
  if (r.node.group) return rest.length ? `NO   ${line}: ${head} is a folder, not a value` : `ok   ${line} (folder: ${Object.keys(r.node.children()).slice(0, 40).join(', ')})`;
  if (!rest.length) return `ok   ${line} (reads ${r.node.type})`;
  if (!r.node.set) return `NO   ${line}: ${head} is read only`;
  const p = parseValue(r.node, rest[0] === '=' ? rest.slice(1).join(' ') : rest.join(' '));
  return p.error ? `NO   ${line}: ${p.error}` : `ok   ${line} (sets ${r.node.type})`;
};

describe('console lines', () => {
  it('has the top-level folders other docs name', () => {
    const top = Object.keys(root().children());
    for (const name of ['vehicle', 'girl', 'weather', 'farm', 'lane', 'village', 'pit', 'mot', 'river']) expect(top).toContain(name);
  });

  it('runs tp the way its usage says', () => {
    const shell = new Shell({ root: root(), commands: buildCommands(standIn()) });
    expect(check(shell, 'tp me 105 -17')).toMatch(/^ok/);
    expect(check(shell, 'tp me to barn')).toMatch(/^ok/);
    expect(check(shell, 'tp me to 105 -17')).toMatch(/^NO/);
  });

  it.runIf(asked.length)('answers for the lines asked about', () => {
    const shell = new Shell({ root: root(), commands: buildCommands(standIn()) });
    writeSync(2, `\n${asked.map((l) => check(shell, l)).join('\n')}\n`);
  });
});
