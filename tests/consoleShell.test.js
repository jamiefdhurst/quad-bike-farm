import { describe, it, expect } from 'vitest';
import { Shell, group, value, resolve, tokenise, slug, tabStep, commonPrefix, pathCandidates, walk, hintChoices } from '../src/console/shell.js';
import { buildCommands } from '../src/console/commands.js';

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
    weatherKinds: () => ['sunny', 'rain'],
    weatherNow: () => 'sunny',
    setWeather: (k) => `now ${k}`,
    dump: (t) => (state.dumped = t),
    farmText: () => `day ${state.day ?? 4}`,
    farmSave: () => true,
    farmJson: () => '{"day":4}',
    farmWipe: () => (state.wiped = true),
    farmEndDay: () => 'fading to black: day 5 loads next',
    perf: () => ({ fps: 59.8, ms: 4.234, worstMs: 9.06, calls: 812, triangles: 1234567, width: 2592, height: 1676, pixelRatio: 1.5, maxFps: 60 }),
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

describe('the farm save', () => {
  it('says the day, saves, copies, wipes and loads a pasted save whole', () => {
    const { shell, state } = makeWorld();
    expect(text(shell.run('save'))).toBe('day 4');
    expect(text(shell.run('save now'))).toMatch(/^saved/);
    expect(text(shell.run('save copy'))).toBe('copied the save');
    expect(text(shell.run('save day'))).toMatch(/^fading to black/);
    expect(state.dumped).toBe('{"day":4}');
    shell.run('save wipe');
    expect(state.wiped).toBe(true);
    expect(text(shell.run('save load {"version": 1, "day": 7, "farmSeed": 3}'))).toBe('stored day 7');
    expect(state.loaded).toEqual({ version: 1, day: 7, farmSeed: 3 });
    expect(text(shell.run('save load'))).toMatch(/paste the save/);
    expect(text(shell.run('save frobnicate'))).toMatch(/no "save frobnicate"/);
  });
});

describe('perf', () => {
  it('says the frame rate, the work a frame and what is drawn', () => {
    const { shell } = makeWorld();
    expect(text(shell.run('perf'))).toBe(
      '60 fps (cap 60), 4.23 ms a frame on average, 9.1 ms at worst\n812 draw calls and 1.23M triangles a frame, shadows included\n2592 x 1676 pixels (render scale 1.5)',
    );
  });
});
