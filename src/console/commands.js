// The console's commands. They work on the tree (shell.js) and on a `host`, the game seen through a small set of calls (gameHost.js),
// so they are tested here against a stand-in host. Keep every command in `GROUPS` order: `help` prints them like that.
import { resolve, walk, show, describe, parseValue, pathCandidates } from './shell.js';

/*
 * host:
 *   vehicles(): [{ id, name }]            girls(): string[]            things(): string[]  (me, vehicles, girls, items)
 *   places(): { [name]: { x, z, heading? } }
 *   locate(thing): { x, y, z, heading } | null      put(thing, { x, z, heading? }): string
 *   vehicleVerbs: string[]                vehicleVerb(id, verb): string | void      resetThing(thing): string
 *   girlVerbs(id): [{ verb, label, vehicle }]         girlVerb(id, verb, vehicleId): void
 *   weatherKinds(): string[]              setWeather(kind): string
 *   dump(text): void                      (copies to the clipboard)
 *   farmText(): string   farmSave(): boolean   farmJson(): string   farmLoad(json): string   farmWipe(): void   farmEndDay(): string   (the farm that remembers)
 *   notebookLearnt(): [{ id, text, learnt }]   learnThing(id): boolean   learnAll(): void   forgetAll(): void   (the notebook's "Things I've learnt")
 *   errors(): [{ name, count, message }]   clearErrors(): void   (features whose update threw, caught by core/featureGuard.js)
 *   perf(): { fps, ms, worstMs, p99Ms, longFrames, longTotal, longFrameCauses, heapMb, allocMbPerSecond, calls, triangles, width, height, pixelRatio, maxFps }   (how hard the game is working)
 */

const GROUPS = ['Looking', 'Changing', 'Moving', 'Vehicles', 'Girls', 'World', 'Console'];
const num = (t, what) => {
  const n = Number(t);
  if (t === undefined || t === '' || !Number.isFinite(n)) throw new Error(`${what} should be a number${t === undefined ? ' (it is missing)' : `, not "${t}"`}`);
  return n;
};
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const fmtPos = (p) => `x ${round(p.x)}, z ${round(p.z)}, up ${round(p.y)}, heading ${Math.round(p.heading)}°`;

/** @returns {import('./shell.js').Command[]} */
export function buildCommands(host) {
  const vehicleIds = () => host.vehicles().map((v) => v.id);
  const needVehicle = (id) => {
    const key = vehicleIds().find((v) => v.toLowerCase() === String(id).toLowerCase());
    if (!key) throw new Error(`no vehicle "${id}". There is ${vehicleIds().join(', ')}`);
    return key;
  };
  const needThing = (id) => {
    const key = host.things().find((t) => t.toLowerCase() === String(id).toLowerCase());
    if (!key) throw new Error(`nothing called "${id}" to move. Try ${host.things().join(', ')}`);
    return key;
  };
  const needGirl = (id) => {
    const key = host.girls().find((t) => t.toLowerCase() === String(id).toLowerCase());
    if (!key) throw new Error(`no girl "${id}". There is ${host.girls().join(', ')}`);
    return key;
  };
  const list = (...xs) => xs.flat();
  const pathOf = (shell, p) => {
    const r = resolve(shell.root, p);
    if (r.error) throw new Error(r.error);
    return r;
  };

  /** Where a thing would go for "to <place or thing>": a place's spot, or a few metres from another thing. */
  const target = (mover, word) => {
    const places = host.places();
    const placeKey = Object.keys(places).find((k) => k === word.toLowerCase());
    if (placeKey) return { ...places[placeKey] };
    const other = host.things().find((t) => t.toLowerCase() === word.toLowerCase());
    if (!other) throw new Error(`"${word}" is not a place or a thing. Places: ${Object.keys(places).join(', ')}`);
    const at = host.locate(other);
    if (!at) throw new Error(`cannot tell where ${other} is`);
    // Beside them if it is you being put there, otherwise a few metres in front of them, facing the way they do.
    const h = (at.heading * Math.PI) / 180;
    if (mover === 'me') return { x: at.x + 2.5, z: at.z, heading: at.heading + 90 };
    return { x: at.x + Math.sin(h) * 3.5, z: at.z + Math.cos(h) * 3.5, heading: at.heading };
  };

  const placeOptions = () => Object.keys(host.places());
  const thingOptions = () => host.things();

  return [
    // Looking ---------------------------------------------------------------------------------------------------------------
    {
      name: 'help',
      aliases: ['?', 'commands'],
      group: 'Looking',
      usage: 'help [command]',
      help: 'every command, or one in detail',
      examples: ['help', 'help tp'],
      complete: (ctx, tokens) => (tokens.length === 0 ? ['topics', ...ctx.shell.commands.map((c) => c.name)] : []),
      run: ([what], shell) => {
        if (what === 'topics') return topics();
        if (what) {
          const c = shell.command(what);
          if (!c) throw new Error(`no command "${what}"`);
          return [`${c.usage}${c.aliases?.length ? `   (also ${c.aliases.join(', ')})` : ''}`, `  ${c.help}`, ...(c.examples ?? []).map((e) => `  e.g. ${e}`)];
        }
        const out = [
          'Type a command and press Enter. Tab completes (and goes through the choices), the arrow keys bring back old lines, backslash shuts this.',
          'Values live in a tree: vehicle.red.temperature, girl.amy.favour, weather.rain, tune.engine... Type a value\'s path alone to read it,',
          'or the path and a number (vehicle.red.temperature 0.5) to set it. help topics explains the tree and positions.',
        ];
        for (const group of GROUPS) {
          const here = shell.commands.filter((c) => c.group === group);
          if (!here.length) continue;
          out.push('', `${group}:`);
          for (const c of here) out.push(`  ${c.usage.padEnd(46)} ${c.help}`);
        }
        return out;
      },
    },
    {
      name: 'list',
      aliases: ['ls'],
      group: 'Looking',
      usage: 'list [path]',
      help: 'what is inside a folder of values (no path: the top)',
      examples: ['list', 'list vehicle', 'list vehicle.red', 'ls girl.amy'],
      complete: (ctx, tokens, partial) => (tokens.length === 0 ? pathCandidates(ctx.root, partial, { foldersOnly: true }) : []),
      run: ([path], shell) => {
        const { node, path: where } = path ? pathOf(shell, path) : { node: shell.root, path: '' };
        if (!node.group) return `${where} = ${show(node)}   (${describe(node) || 'a value'})`;
        const kids = Object.entries(node.children());
        if (!kids.length) return `${where || 'the console'} is empty`;
        return kids.map(([name, n]) => (n.group ? `${name}.` : `${name.padEnd(28)} ${show(n).padEnd(14)} ${describe(n)}`));
      },
    },
    {
      name: 'get',
      aliases: ['print'],
      group: 'Looking',
      usage: 'get <path>',
      help: 'read a value, or every value in a folder',
      examples: ['get vehicle.red.temperature', 'get weather'],
      complete: (ctx, tokens, partial) => (tokens.length === 0 ? pathCandidates(ctx.root, partial) : []),
      run: ([path], shell) => {
        if (!path) throw new Error('get what? e.g. get vehicle.red.fuel');
        return shell.read(pathOf(shell, path));
      },
    },
    {
      name: 'find',
      aliases: ['search'],
      group: 'Looking',
      usage: 'find <text>',
      help: 'every value whose path has that in it (all the words must match)',
      examples: ['find psi', 'find red temp', 'find favour'],
      run: (words, shell) => {
        if (!words.length) throw new Error('find what? e.g. find psi');
        const hits = walk(shell.root, '', 20000).filter(([p]) => words.every((w) => p.toLowerCase().includes(w.toLowerCase())));
        if (!hits.length) return 'nothing like that';
        return [...hits.slice(0, 80).map(([p, n]) => `${p.padEnd(44)} ${show(n)}`), ...(hits.length > 80 ? [`... and ${hits.length - 80} more, be more specific`] : [])];
      },
    },
    {
      name: 'where',
      aliases: ['pos'],
      group: 'Looking',
      usage: 'where [thing]',
      help: 'where you, a vehicle, a girl or an item is (no thing: you)',
      examples: ['where', 'where red', 'where amy'],
      complete: (ctx, tokens) => (tokens.length === 0 ? thingOptions() : []),
      run: ([thing = 'me']) => {
        const t = needThing(thing);
        const at = host.locate(t);
        return at ? `${t}: ${fmtPos(at)}` : `${t}: cannot tell`;
      },
    },
    {
      name: 'dump',
      group: 'Looking',
      usage: 'dump [path]',
      help: 'copy every value in a folder as JSON (no path: all the tuning)',
      examples: ['dump', 'dump vehicle.red'],
      complete: (ctx, tokens, partial) => (tokens.length === 0 ? pathCandidates(ctx.root, partial, { foldersOnly: true }) : []),
      run: ([path], shell) => {
        const { node, path: where } = pathOf(shell, path ?? 'tune');
        const out = {};
        for (const [p, n] of walk(node, where, 20000)) out[p] = n.get();
        host.dump(JSON.stringify(out, null, 2));
        return `copied ${Object.keys(out).length} values under ${where}`;
      },
    },

    // Changing --------------------------------------------------------------------------------------------------------------
    {
      name: 'set',
      group: 'Changing',
      usage: 'set <path> <value>',
      help: 'change a value (the path on its own with a value does the same). Numbers, on/off, or one of the listed choices',
      examples: ['set vehicle.red.temperature 0.4', 'set weather.kind rain', 'vehicle.red.parkbrake on'],
      complete: (ctx, tokens, partial) => {
        if (tokens.length === 0) return pathCandidates(ctx.root, partial);
        const r = resolve(ctx.root, tokens[0]);
        if (r.error || r.node.group) return [];
        return r.node.type === 'bool' ? ['on', 'off'] : r.node.type === 'choice' ? r.node.choices.map(String) : [];
      },
      run: ([path, ...rest], shell) => {
        if (!path || !rest.length) throw new Error('set <path> <value>, e.g. set vehicle.red.fuel 5');
        return shell.write(pathOf(shell, path), rest.join(' '));
      },
    },
    {
      name: 'toggle',
      group: 'Changing',
      usage: 'toggle <path>',
      help: 'flip an on/off value',
      examples: ['toggle vehicle.red.parkbrake', 'toggle player.flying'],
      complete: (ctx, tokens, partial) => (tokens.length === 0 ? pathCandidates(ctx.root, partial) : []),
      run: ([path], shell) => {
        const r = pathOf(shell, path ?? '');
        if (r.node.group || r.node.type !== 'bool') throw new Error(`${r.path} is not an on/off value`);
        return shell.write(r, r.node.get() ? 'off' : 'on');
      },
    },
    {
      name: 'add',
      aliases: ['inc'],
      group: 'Changing',
      usage: 'add <path> <amount>',
      help: 'raise (or, with a minus, lower) a number by an amount',
      examples: ['add vehicle.red.fuel -2', 'add girl.amy.favour 5'],
      complete: (ctx, tokens, partial) => (tokens.length === 0 ? pathCandidates(ctx.root, partial) : []),
      run: ([path, amount], shell) => {
        const r = pathOf(shell, path ?? '');
        if (r.node.group || r.node.type !== 'number') throw new Error(`${r.path} is not a number`);
        return shell.write(r, String(r.node.get() + num(amount, 'the amount')));
      },
    },
    {
      name: 'range',
      group: 'Changing',
      usage: 'range <path>',
      help: 'what a value will take (the panel\'s slider range, the choices)',
      examples: ['range vehicle.red.temperature'],
      complete: (ctx, tokens, partial) => (tokens.length === 0 ? pathCandidates(ctx.root, partial) : []),
      run: ([path], shell) => {
        const r = pathOf(shell, path ?? '');
        if (r.node.group) return `${r.path} is a folder`;
        return `${r.path}: ${r.node.type}${r.node.unit ? ` in ${r.node.unit}` : ''}. ${describe(r.node) || 'any value'}`;
      },
    },

    // Moving ----------------------------------------------------------------------------------------------------------------
    {
      name: 'tp',
      aliases: ['teleport', 'put'],
      group: 'Moving',
      usage: 'tp <thing> <x> <z> [heading]  |  tp <thing> to <place or thing>  |  tp <thing> here',
      help: 'put you, a vehicle, a girl or an item anywhere. Heading is degrees, 0 facing +z (south), 90 facing +x',
      examples: ['tp me 100 20', 'tp red barn', 'tp amy to jess', 'tp tractor here', 'tp me to ramp', 'tp petrol-can 10 10 90'],
      complete: (ctx, tokens) => {
        if (tokens.length === 0) return thingOptions();
        if (tokens.length === 1) return ['to', 'here', ...placeOptions()];
        if (tokens.length === 2 && tokens[1] === 'to') return list(placeOptions(), thingOptions());
        return [];
      },
      run: ([thing, a, b, c]) => {
        if (!thing || a === undefined) throw new Error('tp <thing> <x> <z>, or tp <thing> to <place>. Places: ' + placeOptions().join(', '));
        const t = needThing(thing);
        let spot;
        if (a === 'here') {
          const me = host.locate('me');
          const h = (me.heading * Math.PI) / 180;
          spot = { x: me.x + Math.sin(h) * 4, z: me.z + Math.cos(h) * 4, heading: me.heading + (t === 'me' ? 0 : 180) };
        } else if (a === 'to' || Number.isNaN(Number(a))) spot = target(t, a === 'to' ? b : a);
        else spot = { x: num(a, 'x'), z: num(b, 'z'), heading: c === undefined ? undefined : num(c, 'heading') };
        return host.put(t, spot);
      },
    },
    {
      name: 'nudge',
      aliases: ['move'],
      group: 'Moving',
      usage: 'nudge <thing> <dx> <dz> [dheading]',
      help: 'move something a few metres from where it is (x is east, z is south)',
      examples: ['nudge red 0 -3', 'nudge me 5 0 90'],
      complete: (ctx, tokens) => (tokens.length === 0 ? thingOptions() : []),
      run: ([thing, dx, dz, dh]) => {
        const t = needThing(thing ?? '');
        const at = host.locate(t);
        if (!at) throw new Error(`cannot tell where ${t} is`);
        return host.put(t, { x: at.x + num(dx, 'dx'), z: at.z + num(dz, 'dz'), heading: dh === undefined ? at.heading : at.heading + num(dh, 'dheading') });
      },
    },
    {
      name: 'face',
      aliases: ['turn'],
      group: 'Moving',
      usage: 'face <thing> <heading>',
      help: 'turn something where it stands (degrees, 0 faces +z, 90 faces +x)',
      examples: ['face red 180', 'face me 0'],
      complete: (ctx, tokens) => (tokens.length === 0 ? thingOptions() : []),
      run: ([thing, h]) => {
        const t = needThing(thing ?? '');
        const at = host.locate(t);
        if (!at) throw new Error(`cannot tell where ${t} is`);
        return host.put(t, { x: at.x, z: at.z, heading: num(h, 'heading') });
      },
    },
    {
      name: 'places',
      group: 'Moving',
      usage: 'places',
      help: 'the named spots tp understands',
      run: () => Object.entries(host.places()).map(([name, p]) => `${name.padEnd(14)} x ${round(p.x)}, z ${round(p.z)}`),
    },
    {
      name: 'reset',
      group: 'Moving',
      usage: 'reset <thing | vehicles | girls | all>',
      help: 'back to where it started: a vehicle to its spot (on its wheels), a girl stops where she is (off whatever she is on, out of what she is doing) and stands about for a minute, you to the start',
      examples: ['reset red', 'reset vehicles', 'reset all'],
      complete: (ctx, tokens) => (tokens.length === 0 ? ['vehicles', 'girls', 'all', ...thingOptions()] : []),
      run: ([what]) => {
        if (!what) throw new Error('reset what? e.g. reset red, reset vehicles, reset all');
        const w = what.toLowerCase();
        if (w === 'vehicles') return vehicleIds().map((id) => host.resetThing(id));
        if (w === 'girls') return host.girls().map((id) => host.resetThing(id));
        if (w === 'all') return [...vehicleIds(), ...host.girls(), 'me'].map((id) => host.resetThing(id));
        return host.resetThing(needThing(what));
      },
    },

    // Vehicles --------------------------------------------------------------------------------------------------------------
    ...host.vehicleVerbs.map((verb) => ({
      name: verb.name,
      group: 'Vehicles',
      usage: `${verb.name} <vehicle | all>`,
      help: verb.help,
      examples: [`${verb.name} red`, `${verb.name} all`],
      complete: (ctx, tokens) => (tokens.length === 0 ? [...vehicleIds(), 'all'] : []),
      run: ([id]) => {
        if (!id) throw new Error(`${verb.name} which vehicle? ${vehicleIds().join(', ')} or all`);
        if (id.toLowerCase() === 'all') return vehicleIds().map((v) => host.vehicleVerb(v, verb.name)).filter(Boolean);
        return host.vehicleVerb(needVehicle(id), verb.name);
      },
    })),
    {
      name: 'vehicles',
      group: 'Vehicles',
      usage: 'vehicles',
      help: 'every vehicle in this game: where it is and how it is running',
      run: () =>
        host.vehicles().map((v) => {
          const at = host.locate(v.id);
          return `${v.id.padEnd(10)} ${v.name.padEnd(18)} ${v.summary ?? ''} ${at ? `(x ${round(at.x)}, z ${round(at.z)})` : ''}`;
        }),
    },

    // Girls -----------------------------------------------------------------------------------------------------------------
    {
      name: 'girl',
      aliases: ['g'],
      group: 'Girls',
      usage: 'girl <amy | jess> <action> [vehicle]',
      help: 'make her do something now, as the debug panel buttons do. girl amy on its own lists her actions',
      examples: ['girl jess doughnuts', 'girl amy drive red', 'girl jess ride tractor', 'girl amy invite-barn'],
      complete: (ctx, tokens) => {
        if (tokens.length === 0) return host.girls();
        const id = host.girls().find((g) => g.toLowerCase() === tokens[0].toLowerCase());
        if (!id) return [];
        if (tokens.length === 1) return host.girlVerbs(id).map((a) => a.verb);
        const a = host.girlVerbs(id).find((x) => x.verb === tokens[1].toLowerCase());
        return tokens.length === 2 && a?.vehicle ? vehicleIds() : [];
      },
      run: ([who, verb, vehicle]) => {
        const id = needGirl(who ?? '');
        const verbs = host.girlVerbs(id);
        if (!verb) return verbs.map((a) => `${a.verb.padEnd(14)} ${a.label.replace('%', cap(id))}${a.vehicle ? '  [needs a vehicle]' : ''}`);
        const a = verbs.find((x) => x.verb === verb.toLowerCase());
        if (!a) throw new Error(`${id} cannot "${verb}". She can: ${verbs.map((x) => x.verb).join(', ')}`);
        if (a.vehicle && !vehicle) throw new Error(`${a.verb} needs a vehicle: girl ${id} ${a.verb} ${vehicleIds().join('|')}`);
        host.girlVerb(id, a.verb, a.vehicle ? needVehicle(vehicle) : undefined);
        return a.label.replace('%', cap(id));
      },
    },
    {
      name: 'girls',
      group: 'Girls',
      usage: 'girls',
      help: 'both girls: what they are doing and where',
      run: () =>
        host.girls().map((id) => {
          const at = host.locate(id);
          return `${id.padEnd(6)} ${(host.girlState?.(id) ?? '').padEnd(34)} ${at ? `(x ${round(at.x)}, z ${round(at.z)})` : ''}`;
        }),
    },

    // World -----------------------------------------------------------------------------------------------------------------
    {
      name: 'weather',
      group: 'World',
      usage: 'weather [kind]',
      help: 'say what the weather is, or change it. weather.rain, weather.temperature and weather.wet set the details',
      examples: ['weather', 'weather rain', 'set weather.temperature -4'],
      complete: (ctx, tokens) => (tokens.length === 0 ? host.weatherKinds() : []),
      run: ([kind]) => {
        if (!kind) return host.weatherNow();
        const k = host.weatherKinds().find((w) => w.toLowerCase() === kind.toLowerCase());
        if (!k) throw new Error(`no weather "${kind}". There is ${host.weatherKinds().join(', ')}`);
        return host.setWeather(k);
      },
    },
    {
      name: 'save',
      group: 'World',
      usage: 'save [now | show | copy | day | wipe | load <json>]',
      help: 'the farm that remembers: which day and when it saved; save it now, show or copy the save, end the day (the fade to the next day, whatever the time), wipe it, or load one (it plays from the next reload)',
      examples: ['save', 'save now', 'save copy', 'save load {"version":1,"day":3,...}'],
      complete: (ctx, tokens) => (tokens.length === 0 ? ['now', 'show', 'copy', 'day', 'wipe', 'load'] : []),
      run: ([what], shell) => {
        if (!what) return host.farmText();
        if (what === 'now') return host.farmSave() ? `saved: ${host.farmText()}` : `not saved: ${host.farmText()}`;
        if (what === 'show') return host.farmJson();
        if (what === 'copy') {
          host.dump(host.farmJson());
          return 'copied the save';
        }
        if (what === 'day') return host.farmEndDay();
        if (what === 'wipe') {
          host.farmWipe();
          return 'wiped: the next load deals a new farm';
        }
        if (what === 'load') {
          const json = shell.line.replace(/^\S+\s+\S+\s*/, '');
          if (!json) throw new Error('paste the save after "save load"');
          return host.farmLoad(json);
        }
        throw new Error(`no "save ${what}". Try save, save now, save show, save copy, save wipe or save load <json>`);
      },
    },
    {
      name: 'learn',
      group: 'World',
      usage: 'learn [id | all | none]',
      help: 'the notebook\'s "Things I\'ve learnt": list them with a tick for each you have, write one down by id, write them all down, or rub them all out',
      examples: ['learn', 'learn chokeFlood', 'learn all', 'learn none'],
      complete: (ctx, tokens) => (tokens.length === 0 ? ['all', 'none', ...host.notebookLearnt().map((d) => d.id)] : []),
      run: ([what]) => {
        if (what === 'all') return host.learnAll(), 'wrote them all down';
        if (what === 'none') return host.forgetAll(), 'rubbed them all out';
        if (what) {
          if (!host.notebookLearnt().some((d) => d.id === what)) throw new Error(`no "${what}". Try learn to see the list`);
          return host.learnThing(what) ? `wrote down ${what}` : `${what} was already written down`;
        }
        return host.notebookLearnt().map((d) => `${d.learnt ? '[x]' : '[ ]'} ${d.id}: ${d.text}`);
      },
    },
    ...[
      ['fly', 'player.flying', 'free-fly: no gravity, no walls. WASD, Space up, C down, Shift fast'],
      ['autonomy', 'girls.autonomy', 'the girls start nothing on their own (no pranks, rides, romance, banter...). They still follow and answer you'],
      ['speech', 'girls.speech', 'the girls say nothing out loud'],
      ['sound', 'audio.sound', 'all game sound'],
    ].map(([name, path, help]) => ({
      name,
      group: 'World',
      usage: `${name} [on | off]`,
      help,
      examples: [`${name}`, `${name} off`],
      complete: (ctx, tokens) => (tokens.length === 0 ? ['on', 'off'] : []),
      run: ([state], shell) => {
        const r = pathOf(shell, path);
        if (state === undefined) return shell.write(r, r.node.get() ? 'off' : 'on');
        const p = parseValue(r.node, state);
        if (p.error) throw new Error(p.error);
        return shell.write(r, state);
      },
    })),

    {
      name: 'perf',
      group: 'World',
      usage: 'perf',
      help: 'how hard the game is working: frames a second, the game\'s own time on each, the slowest 1% and what made the long ones long, and what the GPU is asked to draw. tune.graphics sets the cap, the render scale and the draw distances',
      examples: ['perf', 'tune.graphics.maxFps 0'],
      run: () => {
        const p = host.perf();
        const k = (n) => (n >= 1e6 ? `${round(n / 1e6, 2)}M` : n >= 1e3 ? `${round(n / 1e3)}k` : String(Math.round(n)));
        return [
          `${Math.round(p.fps)} fps (cap ${p.maxFps > 0 ? p.maxFps : 'none'}), ${round(p.ms, 2)} ms a frame on average, ${round(p.worstMs, 1)} ms at worst`,
          `${k(p.calls)} draw calls and ${k(p.triangles)} triangles a frame, shadows included`,
          `${p.width} x ${p.height} pixels (render scale ${p.pixelRatio})`,
          ...(p.p99Ms === undefined ? [] : [`slowest 1% of frames ${round(p.p99Ms, 1)} ms; ${p.longFrames} over 33 ms in the last 10 s (${p.longTotal} since the game started)`]),
          ...(p.longFrameCauses?.length ? [`last long frames: ${p.longFrameCauses.join('; ')}`] : []),
          ...(p.heapMb ? [`memory ${Math.round(p.heapMb)} MB, allocating ${round(p.allocMbPerSecond, 1)} MB a second`] : []),
          ...(p.stages?.length ? [`where the time goes: ${p.stages.map((x) => `${x.name} ${round(x.ms, 2)}`).join(', ')} (ms)`] : []),
        ];
      },
    },

    {
      name: 'errors',
      group: 'World',
      usage: 'errors [clear]',
      help: 'features whose update threw and was caught, so the rest of the frame ran: each with how many times and the last message. "errors clear" forgets them',
      examples: ['errors', 'errors clear'],
      run: (args) => {
        if (args[0] === 'clear') {
          host.clearErrors();
          return 'forgotten';
        }
        const list = host.errors();
        if (!list.length) return 'no feature has thrown';
        return list.map((e) => `${e.count}x ${e.name}: ${e.message}`);
      },
    },

    // Console ---------------------------------------------------------------------------------------------------------------
    {
      name: 'clear',
      aliases: ['cls'],
      group: 'Console',
      usage: 'clear',
      help: 'empty the screen',
      run: (args, shell) => {
        shell.cleared = true;
      },
    },
    {
      name: 'history',
      group: 'Console',
      usage: 'history',
      help: 'what you have typed (the up arrow brings these back)',
      run: (args, shell) => shell.history.slice(-30).map((h, i) => `${i + 1}  ${h}`),
    },
    {
      name: 'echo',
      group: 'Console',
      usage: 'echo <text>',
      help: 'say something back (for checking quoting)',
      run: (words) => words.join(' '),
    },
  ];

  function topics() {
    return [
      'THE TREE',
      '  Everything is a value at a dotted path. list shows what is inside, find searches, get reads, set (or just the path and a value) writes.',
      '  vehicle.<id>.*          running state, faults, quirks, tyres, position, and .tune.* for its own engine and controls',
      '  girl.<amy|jess>.*       position, favour, romance, skills, what she is doing, her tuning',
      '  girls.*, player.*       autonomy and speech; where you are, flying',
      '  weather.*, audio.*      the day and the sound',
      '  tune.<group>.<key>      every number in the debug panel\'s Tune tab (names lower case, spaces as dashes)',
      'POSITIONS',
      '  x is east, z is south, up is y. Heading is degrees: 0 faces +z, 90 faces +x, 180 faces -z. The same for you, vehicles and girls.',
      '  Things you can move: me, each vehicle id, amy, jess and the items (petrol-can, premix-can, diesel-can, toolbox, oil-bottle, feed-bucket, leads).',
      '  Or set the values: vehicle.red.x, vehicle.red.z, girl.amy.heading, player.y...',
      'TAB',
      '  Completes commands, paths, vehicles, girls, places and values. Press again to go through the choices, Shift+Tab goes back.',
      'GIRLS',
      '  A girl has to be stood about to be moved or sent anywhere. girl amy lists what she can be made to do.',
    ];
  }
}
