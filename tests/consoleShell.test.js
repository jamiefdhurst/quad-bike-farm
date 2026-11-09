import { describe, it, expect } from 'vitest';
import { Shell, group, value, resolve, tokenise, slug, tabStep, commonPrefix, pathCandidates, walk, hintChoices } from '../src/console/shell.js';
import { buildCommands } from '../src/console/commands.js';
import { VEHICLE_VERBS } from '../src/console/gameHost.js';
import { SCENES, runScene } from '../src/debug/scenes.js';
import { SETUPS } from '../src/debug/sceneSetups.js';

function makeWorld() {
  const state = { temp: 0.2, brake: false, kind: 'sunny', fuel: 3, x: 10, z: 20, heading: 0, busy: false };
  const tree = group(() => ({
    vehicle: group(() => ({
      red: group(() => ({
        temperature: value({ get: () => state.temp, set: (v) => (state.temp = v), min: 0, max: 1 }),
        parkbrake: value({ type: 'bool', get: () => state.brake, set: (v) => (state.brake = v) }),
        fuel: value({ get: () => state.fuel, set: (v) => (state.fuel = v), min: 0, max: 10, unit: 'litres' }),
        state: value({ type: 'text', get: () => 'running' }),
      })),
      refurb: group(() => ({ temperature: value({ get: () => 1, set: () => {}, min: 0, max: 1 }) })),
    })),
    weather: group(() => ({ kind: value({ type: 'choice', choices: ['sunny', 'rain', 'rain-heavy'], get: () => state.kind, set: (v) => (state.kind = v) }) })),
    player: group(() => ({ flying: value({ type: 'bool', get: () => false, set: () => {} }) })),
    girls: group(() => ({ autonomy: value({ type: 'bool', get: () => true, set: () => {} }), speech: value({ type: 'bool', get: () => true, set: () => {} }) })),
    audio: group(() => ({ sound: value({ type: 'bool', get: () => true, set: () => {} }) })),
  }));
  const host = {
    vehicleVerbs: [{ name: 'start', help: 'x' }],
    vehicles: () => [{ id: 'red', name: 'Red quad' }, { id: 'tractor', name: 'Tractor' }],
    girls: () => ['amy', 'jess'],
    things: () => ['me', 'red', 'tractor', 'amy', 'jess', 'toolbox'],
    places: () => ({ barn: { x: -64, z: 60 }, ramp: { x: 16, z: -8 } }),
    locate: (t) => (t === 'ghost' ? null : { x: state.x, y: 1, z: state.z, heading: state.heading }),
    put: (t, p) => {
      if (state.busy && t === 'amy') throw new Error('Amy is busy');
      state.x = p.x;
      state.z = p.z;
      if (p.heading !== undefined) state.heading = p.heading;
      return `${t} moved`;
    },
    resetThing: (t) => `${t} reset`,
    vehicleVerb: (id, verb) => `${id}: ${verb}`,
    girlVerbs: () => [{ verb: 'drive', label: '% drives', vehicle: true }, { verb: 'ramp', label: '% jumps' }],
    girlVerb: (id, verb, v) => (state.last = [id, verb, v]),
    jobs: () => [
      { id: 'hay', name: 'Make hay', stage: 'cut 0 of 12', verbs: [{ verb: 'cut', label: 'Jump the hay job to the cut stage' }, { verb: 'done', label: 'Jump the hay job to the done stage' }] },
      { id: 'muck', name: 'Muck out', stage: '0% in the tub', verbs: [{ verb: 'fill', label: 'Fill the trailer with muck' }] },
    ],
    jobVerb: (id, verb) => {
      (state.jobsDone ??= []).push(`${id} ${verb}`);
      return verb === 'fill' ? 'The tub is full' : undefined;
    },
    weatherKinds: () => ['sunny', 'rain'],
    weatherNow: () => 'sunny',
    setWeather: (k) => `now ${k}`,
    scenes: () => [{ id: 'frost', label: 'Set up a frosty dawn' }],
    runScene: (id) => [`ran ${id}`],
    dump: (t) => (state.dumped = t),
    farmText: () => `day ${state.day ?? 4}`,
    farmSave: () => true,
    farmJson: () => '{"day":4}',
    farmWipe: () => (state.wiped = true),
    farmEndDay: () => 'fading to black: day 5 loads next',
    farmSendHome: () => 'the girls are going home',
    notebookLearnt: () => [{ id: 'flood', text: 'A flooded engine clears.', learnt: !!state.learnt?.has('flood') }, { id: 'wax', text: 'Diesel waxes.', learnt: !!state.learnt?.has('wax') }],
    learnThing: (id) => ((state.learnt ??= new Set()).has(id) ? false : (state.learnt.add(id), true)),
    learnAll: () => (state.learnt = new Set(['flood', 'wax'])),
    forgetAll: () => (state.learnt = new Set()),
    errors: () => (state.errors ?? []),
    clearErrors: () => (state.errors = []),
    perf: () => ({ fps: 59.8, ms: 4.234, worstMs: 9.06, calls: 812, triangles: 1234567, width: 2592, height: 1676, pixelRatio: 1.5, maxFps: 60, ...state.perfExtra }),
    farmLoad: (json) => {
      const s = JSON.parse(json);
      state.loaded = s;
      return `stored day ${s.day}`;
    },
  };
  const shell = new Shell({ root: tree, commands: buildCommands(host) });
  return { shell, state, tree };
}
const text = (lines) => lines.map((l) => l.text).join('\n');

describe('console tree and parsing', () => {
  it('slugs names', () => {
    expect(slug('Red quad')).toBe('red-quad');
    expect(slug('2WD and 4WD')).toBe('2wd-and-4wd');
  });
  it('tokenises with quotes and keeps a trailing empty word', () => {
    expect(tokenise('echo "a b" c')).toEqual(['echo', 'a b', 'c']);
    expect(tokenise('get ')).toEqual(['get', '']);
  });
  it('resolves paths whatever the case and says what is missing', () => {
    const { tree } = makeWorld();
    expect(resolve(tree, 'Vehicle.RED.temperature').path).toBe('vehicle.red.temperature');
    expect(resolve(tree, 'vehicle.blue').error).toMatch(/no "blue"/);
  });
  it('walks every value', () => {
    const { tree } = makeWorld();
    expect(walk(tree).map(([p]) => p)).toContain('vehicle.red.fuel');
  });
});

describe('reading and writing values', () => {
  it('reads by path alone and sets with a value, an equals or set', () => {
    const { shell, state } = makeWorld();
    expect(text(shell.run('vehicle.red.temperature'))).toBe('vehicle.red.temperature = 0.2');
    shell.run('vehicle.red.temperature 0.7');
    expect(state.temp).toBe(0.7);
    shell.run('vehicle.red.temperature = 0.1');
    expect(state.temp).toBe(0.1);
    shell.run('set vehicle.red.temperature 0.9');
    expect(state.temp).toBe(0.9);
  });
  it('accepts on/off for bools, choices only from the list, and notes going outside the range', () => {
    const { shell, state } = makeWorld();
    shell.run('set vehicle.red.parkbrake on');
    expect(state.brake).toBe(true);
    expect(text(shell.run('set vehicle.red.parkbrake maybe'))).toMatch(/not on or off/);
    expect(text(shell.run('set weather.kind hail'))).toMatch(/not one of/);
    shell.run('set weather.kind rain');
    expect(state.kind).toBe('rain');
    expect(text(shell.run('set vehicle.red.fuel 50'))).toMatch(/outside the panel's 0 to 10/);
    expect(state.fuel).toBe(50);
  });
  it('refuses read-only values, folders and non-numbers', () => {
    const { shell } = makeWorld();
    expect(text(shell.run('set vehicle.red.state stopped'))).toMatch(/read only/);
    expect(text(shell.run('set vehicle.red 1'))).toMatch(/folder/);
    expect(text(shell.run('set vehicle.red.fuel lots'))).toMatch(/not a number/);
  });
  it('toggles and adds', () => {
    const { shell, state } = makeWorld();
    shell.run('toggle vehicle.red.parkbrake');
    expect(state.brake).toBe(true);
    shell.run('add vehicle.red.fuel -2');
    expect(state.fuel).toBe(1);
  });
  it('reads a whole folder, lists, finds and dumps', () => {
    const { shell, state } = makeWorld();
    expect(text(shell.run('get vehicle.red'))).toMatch(/vehicle.red.fuel = 3 litres/);
    expect(text(shell.run('list'))).toMatch(/vehicle\./);
    expect(text(shell.run('find red temp'))).toMatch(/vehicle.red.temperature/);
    shell.run('dump vehicle.red');
    expect(JSON.parse(state.dumped)['vehicle.red.fuel']).toBe(3);
  });
  it('says so for an unknown command, and does not treat a path as one', () => {
    const { shell } = makeWorld();
    expect(text(shell.run('frobnicate'))).toMatch(/no command "frobnicate"/);
    expect(text(shell.run('vehicle.nope.x'))).toMatch(/no "nope"/);
  });
});

describe('moving things', () => {
  it('tp takes coordinates, a heading, a place or another thing', () => {
    const { shell, state } = makeWorld();
    shell.run('tp red 100 -5 90');
    expect([state.x, state.z, state.heading]).toEqual([100, -5, 90]);
    shell.run('tp red barn');
    expect([state.x, state.z]).toEqual([-64, 60]);
    shell.run('tp red to ramp');
    expect([state.x, state.z]).toEqual([16, -8]);
    shell.run('tp me to red');
    expect(state.x).toBeCloseTo(18.5);
  });
  it('tp here puts it in front of you', () => {
    const { shell, state } = makeWorld();
    state.heading = 90;
    shell.run('tp red here');
    expect(state.x).toBeCloseTo(14);
    expect(state.z).toBeCloseTo(20);
  });
  it('nudge and face are relative to where it is', () => {
    const { shell, state } = makeWorld();
    shell.run('nudge red 5 -3');
    expect([state.x, state.z]).toEqual([15, 17]);
    shell.run('face red 180');
    expect(state.heading).toBe(180);
  });
  it('reports a busy girl, an unknown thing and a bad number', () => {
    const { shell, state } = makeWorld();
    state.busy = true;
    expect(text(shell.run('tp amy 1 1'))).toMatch(/busy/);
    expect(text(shell.run('tp banana 1 1'))).toMatch(/nothing called "banana"/);
    expect(text(shell.run('tp red x y'))).toMatch(/not a place or a thing/);
    expect(text(shell.run('tp red 1'))).toMatch(/z should be a number/);
  });
  it('reset handles one, vehicles and all', () => {
    const { shell } = makeWorld();
    expect(text(shell.run('reset red'))).toBe('red reset');
    expect(text(shell.run('reset vehicles'))).toBe('red reset\ntractor reset');
    expect(shell.run('reset all').length).toBe(5);
  });
});

describe('verbs and girls', () => {
  it('runs a vehicle verb on one or all', () => {
    const { shell } = makeWorld();
    expect(text(shell.run('start red'))).toBe('red: start');
    expect(text(shell.run('start all'))).toBe('red: start\ntractor: start');
    expect(text(shell.run('start nonesuch'))).toMatch(/no vehicle/);
  });
  it('runs girl actions, asking for a vehicle when one is needed', () => {
    const { shell, state } = makeWorld();
    expect(text(shell.run('girl amy drive'))).toMatch(/needs a vehicle/);
    shell.run('girl jess drive tractor');
    expect(state.last).toEqual(['jess', 'drive', 'tractor']);
    shell.run('girl amy ramp');
    expect(state.last).toEqual(['amy', 'ramp', undefined]);
    expect(text(shell.run('girl amy'))).toMatch(/drive/);
    expect(text(shell.run('girl amy dance'))).toMatch(/cannot "dance"/);
  });
  it('help lists every command, in detail for one', () => {
    const { shell } = makeWorld();
    const all = text(shell.run('help'));
    for (const c of shell.commands) expect(all).toContain(c.usage.split(' ')[0]);
    expect(text(shell.run('help tp'))).toMatch(/e\.g\. tp me 100 20/);
  });
  it('every command has a group, usage, help and an example', () => {
    const { shell } = makeWorld();
    for (const c of shell.commands) {
      expect(c.group, c.name).toBeTruthy();
      expect(c.usage, c.name).toBeTruthy();
      expect(c.help, c.name).toBeTruthy();
    }
  });
  it('autonomy, speech, fly and sound go through the tree', () => {
    const { shell } = makeWorld();
    expect(text(shell.run('autonomy off'))).toBe('girls.autonomy = on');
    expect(text(shell.run('autonomy sideways'))).toMatch(/not on or off/);
  });
});

describe('the farm\'s jobs', () => {
  it('lists every job with its stage and what can be done to it', () => {
    const { shell } = makeWorld();
    const out = text(shell.run('job'));
    expect(out).toMatch(/hay\s+cut 0 of 12\s+\[cut done\]/);
    expect(out).toMatch(/muck/);
  });
  it('lists one job\'s actions, runs one, and says what the game said or what it did', () => {
    const { shell, state } = makeWorld();
    expect(text(shell.run('job hay'))).toMatch(/cut\s+Jump the hay job to the cut stage/);
    expect(text(shell.run('job hay cut'))).toBe('hay: Jump the hay job to the cut stage');
    expect(text(shell.run('job muck fill'))).toBe('The tub is full');
    expect(state.jobsDone).toEqual(['hay cut', 'muck fill']);
  });
  it('refuses a job or action that does not exist, naming the ones that do', () => {
    const { shell } = makeWorld();
    expect(text(shell.run('job sheep'))).toMatch(/no job "sheep".*hay, muck/);
    expect(text(shell.run('job hay mow'))).toMatch(/no "mow".*cut, done/);
  });
  it('completes job names, then actions', () => {
    const { shell } = makeWorld();
    expect(shell.complete('job ').candidates).toEqual(['hay', 'muck']);
    expect(shell.complete('job hay ').candidates).toEqual(['cut', 'done']);
  });
});

describe('tab completion', () => {
  it('completes commands, then paths a folder at a time', () => {
    const { shell } = makeWorld();
    expect(shell.complete('te').candidates).toEqual([]);
    expect(shell.complete('tog').candidates).toEqual(['toggle']);
    expect(shell.complete('get v').candidates).toEqual(['vehicle.']);
    expect(shell.complete('get vehicle.').candidates).toEqual(['vehicle.red.', 'vehicle.refurb.']);
    expect(shell.complete('get vehicle.red.t').candidates).toEqual(['vehicle.red.temperature']);
  });
  it('completes values by type and the arguments of tp', () => {
    const { shell } = makeWorld();
    expect(shell.complete('set vehicle.red.parkbrake ').candidates).toEqual(['off', 'on']);
    expect(shell.complete('set weather.kind r').candidates).toEqual(['rain', 'rain-heavy']);
    expect(shell.complete('tp ').candidates).toContain('toolbox');
    expect(shell.complete('tp red ').candidates).toEqual(expect.arrayContaining(['barn', 'here', 'to']));
    expect(shell.complete('tp red to ').candidates).toEqual(expect.arrayContaining(['barn', 'amy']));
    expect(shell.complete('start ').candidates).toEqual(['all', 'red', 'tractor']);
    expect(shell.complete('girl ').candidates).toEqual(['amy', 'jess']);
    expect(shell.complete('girl amy ').candidates).toEqual(['drive', 'ramp']);
    expect(shell.complete('girl amy drive ').candidates).toEqual(['red', 'tractor']);
    expect(shell.complete('weather ').candidates).toEqual(['rain', 'sunny']);
  });
  it('completes after a bare path', () => {
    const { shell } = makeWorld();
    expect(shell.complete('vehicle.red.parkbrake ').candidates).toEqual(['off', 'on']);
  });
  it('Tab fills the shared start, then goes through the choices, and Shift+Tab goes back', () => {
    const { shell } = makeWorld();
    let step = tabStep(shell, 'set weather.kind r', null);
    expect(step.line).toBe('set weather.kind rain'); // both start "rain", which is itself a choice
    step = tabStep(shell, step.line, step);
    expect(step.line).toBe('set weather.kind rain-heavy');
    step = tabStep(shell, step.line, step);
    expect(step.line).toBe('set weather.kind rain');
    step = tabStep(shell, step.line, step, -1);
    expect(step.line).toBe('set weather.kind rain-heavy');
  });
  it('Tab on one choice finishes it with a space (a folder with a dot)', () => {
    const { shell } = makeWorld();
    expect(tabStep(shell, 'tog', null).line).toBe('toggle ');
    expect(tabStep(shell, 'get w', null).line).toBe('get weather.');
  });
  it('Tab extends to the shared start when the choices differ later', () => {
    const { shell } = makeWorld();
    const step = tabStep(shell, 'get vehicle.r', null);
    expect(step.line).toBe('get vehicle.re'); // red and refurb agree as far as "re"
    expect(step.candidates).toEqual(['vehicle.red.', 'vehicle.refurb.']);
    const next = tabStep(shell, step.line, step);
    expect(next.line).toBe('get vehicle.red.');
    expect(tabStep(shell, next.line, next).line).toBe('get vehicle.refurb.');
  });
  it('the hint lists every choice straight after a dot or a space, by its last part', () => {
    const { shell } = makeWorld();
    expect(hintChoices(shell, 'get vehicle.')).toEqual(['red.', 'refurb.']);
    expect(hintChoices(shell, 'get vehicle.red.')).toContain('temperature');
    expect(hintChoices(shell, 'girl ')).toEqual(['amy', 'jess']);
    expect(hintChoices(shell, 'tog')).toEqual(['toggle']); // a lone choice shows too
    expect(hintChoices(shell, 'toggle')).toEqual([]); // already typed in full
  });
  it('helpers', () => {
    expect(commonPrefix(['abc', 'abd'])).toBe('ab');
    const { tree } = makeWorld();
    expect(pathCandidates(tree, 'weather.')).toEqual(['weather.kind']);
    expect(pathCandidates(tree, 'v', { foldersOnly: true })).toContain('vehicle.');
    expect(pathCandidates(tree, 'weather.', { foldersOnly: true })).toEqual([]);
  });
  it('offers nothing for an unknown path', () => {
    const { shell } = makeWorld();
    expect(shell.complete('get nothing.').candidates).toEqual([]);
  });
});

describe('the notebook\'s things I\'ve learnt', () => {
  it('lists them, writes one down by id, all of them, or none', () => {
    const { shell } = makeWorld();
    expect(text(shell.run('learn'))).toContain('[ ] flood: A flooded engine clears.');
    expect(text(shell.run('learn flood'))).toBe('wrote down flood');
    expect(text(shell.run('learn flood'))).toBe('flood was already written down');
    expect(text(shell.run('learn'))).toContain('[x] flood');
    expect(text(shell.run('learn nonsense'))).toMatch(/no "nonsense"/);
    expect(text(shell.run('learn all'))).toBe('wrote them all down');
    expect(text(shell.run('learn none'))).toBe('rubbed them all out');
    expect(text(shell.run('learn'))).toContain('[ ] wax');
  });
});

describe('the farm save', () => {
  it('says the day, saves, copies, wipes and loads a pasted save whole', () => {
    const { shell, state } = makeWorld();
    expect(text(shell.run('save'))).toBe('day 4');
    expect(text(shell.run('save now'))).toMatch(/^saved/);
    expect(text(shell.run('save copy'))).toBe('copied the save');
    expect(text(shell.run('save day'))).toMatch(/^fading to black/);
    expect(text(shell.run('save home'))).toMatch(/^the girls are going home/);
    expect(state.dumped).toBe('{"day":4}');
    shell.run('save wipe');
    expect(state.wiped).toBe(true);
    expect(text(shell.run('save load {"version": 1, "day": 7, "farmSeed": 3}'))).toBe('stored day 7');
    expect(state.loaded).toEqual({ version: 1, day: 7, farmSeed: 3 });
    expect(text(shell.run('save load'))).toMatch(/paste the save/);
    expect(text(shell.run('save frobnicate'))).toMatch(/no "save frobnicate"/);
  });
});

describe('errors', () => {
  it('says none have thrown, lists the ones that have, and clears them', () => {
    const { shell, state } = makeWorld();
    expect(text(shell.run('errors'))).toBe('no feature has thrown');
    state.errors = [{ name: 'updateBackNaps', count: 12, message: 'x is not defined' }];
    expect(text(shell.run('errors'))).toBe('12x updateBackNaps: x is not defined');
    shell.run('errors clear');
    expect(text(shell.run('errors'))).toBe('no feature has thrown');
  });
});

describe('perf', () => {
  it('says the frame rate, the work a frame and what is drawn', () => {
    const { shell } = makeWorld();
    expect(text(shell.run('perf'))).toBe(
      '60 fps (cap 60), 4.23 ms a frame on average, 9.1 ms at worst\n812 draw calls and 1.23M triangles a frame, shadows included\n2592 x 1676 pixels (render scale 1.5)',
    );
  });

  it('says the stutters, what caused them and the memory, when the game reports them', () => {
    const { shell, state } = makeWorld();
    state.perfExtra = { p99Ms: 21.46, longFrames: 2, longTotal: 5, longFrameCauses: ['41 ms, memory clean-up', '36 ms, drawing (30 ms)'], heapMb: 183.4, allocMbPerSecond: 12.34 };
    const lines = text(shell.run('perf')).split('\n');
    expect(lines).toContain('slowest 1% of frames 21.5 ms; 2 over 33 ms in the last 10 s (5 since the game started)');
    expect(lines).toContain('last long frames: 41 ms, memory clean-up; 36 ms, drawing (30 ms)');
    expect(lines).toContain('memory 183 MB, allocating 12.3 MB a second');
  });

  it('says how the ground\'s tiles are drawn (#665)', () => {
    const { shell, state } = makeWorld();
    state.perfExtra = { ground: { tiles: 49, built: 49, waiting: 0, bySteps: { 1: 29, 2: 20 }, worstBuildMs: 3.456 } };
    expect(text(shell.run('perf')).split('\n')).toContain('ground: 49 of 49 tiles drawn (29 every 1 m, 20 every 2 m), 0 waiting; the slowest took 3.5 ms to build');
  });
});

describe('scenes', () => {
  it('lists the scenes and says which one is missing', () => {
    const { shell } = makeWorld();
    expect(text(shell.run('scene'))).toMatch(/frost/);
    expect(text(shell.run('scene nowhere'))).toMatch(/no scene "nowhere"/);
  });
  it('runs a scene through the host', () => {
    const { shell } = makeWorld();
    expect(text(shell.run('scene frost'))).toMatch(/Set up a frosty dawn[\s\S]*ran frost/);
  });
  it('runs the lines then the setup, stops at the first line that fails and keeps its lines out of the history', () => {
    const { shell } = makeWorld();
    const before = shell.history.length;
    const seen = [];
    const setups = { prepare: (g) => seen.push(`prepare ${g}`), go: (g, say) => (seen.push(g), say('echo setup'), ['done']) };
    const ok = runScene({ id: 'x', lines: ['echo one'], setup: 'go' }, shell, 'GAME', setups);
    expect(ok).toEqual(['one', 'setup', 'done']);
    expect(seen).toEqual(['prepare GAME', 'GAME']);
    seen.length = 0;
    const bad = runScene({ id: 'y', lines: ['echo one', 'nonsense.path 1', 'echo two'], setup: 'go' }, shell, 'GAME', setups);
    expect(bad.join('\n')).toMatch(/y stopped at "nonsense.path 1"/);
    expect(bad.join('\n')).not.toMatch(/two|setup/);
    expect(shell.history.length).toBe(before);
  });
  it('only uses lines the console understands, and setups that exist', () => {
    const real = buildCommands({ vehicleVerbs: VEHICLE_VERBS, vehicles: () => [], girls: () => [], things: () => [], places: () => ({}) });
    for (const sc of SCENES) {
      if (sc.setup) expect(SETUPS[sc.setup], `${sc.id} setup`).toBeTypeOf('function');
      for (const line of sc.lines) {
        const head = line.split(' ')[0];
        expect(real.some((c) => c.name === head || c.aliases?.includes(head)) || head.includes('.'), `${sc.id}: ${line}`).toBe(true);
      }
    }
  });
});
