// The game as the console sees it: a tree of values (vehicle.red.temperature, girl.amy.favour, weather.rain, tune.<group>.<key>...)
// built over the live game. Every value reads and writes through the same fields and methods the debug panel uses.
import { netCharge } from '../engine/charging.js';
import { NEEDS, NEED_LABELS } from '../npc/needs.js';
import { describeMind, OFFER_KINDS } from '../npc/chooser.js';
import { group, value, slug } from './shell.js';
import { getTuningGroups } from '../core/tuning.js';
import { FAULT_KINDS } from '../vehicle/faults.js';
import { applicableQuirks, featuresOf } from '../vehicle/quirks.js';
import { WHEEL_NAMES } from '../vehicle/tyres.js';
import { setFault, setQuirk } from '../debug/vehicleDebug.js';
import { TAP_POSITIONS } from '../vehicle/fuelSystem.js';
import { LIGHT_MODES } from '../vehicle/lightSwitch.js';
import { SIGNAL_MODES } from '../vehicle/indicators.js';
import { DRIVE_MODES } from '../vehicle/driveMode.js';
import { WEATHER_KINDS } from '../world/weather.js';

const DEG = 180 / Math.PI;
const round = (v, n = 3) => Math.round(v * 10 ** n) / 10 ** n;

// Small makers, so the tree below reads as a list of what exists.
const num = (get, set, min, max, unit = '', help = '') => value({ type: 'number', get: () => round(get()), set, min, max, unit, help });
const ro = (get, unit = '', help = '') => value({ type: 'number', get: () => round(get()), unit, help });
const flag = (get, set, help = '') => value({ type: 'bool', get, set, help });
const text = (get, help = '') => value({ type: 'text', get, help });
const choice = (choices, get, set, help = '') => value({ type: 'choice', choices, get, set, help });

/**
 * The registered tuning groups as nested folders. "Red quad/Engine" becomes red-quad then engine. `only` picks groups by name and
 * `strip` is the part of the name to leave off ("Red quad/"); a group whose whole name is stripped puts its values straight in.
 */
export function tuningTree(only = () => true, strip = '') {
  const root = {};
  for (const g of getTuningGroups()) {
    if (!only(g.name)) continue;
    const rest = strip && g.name.startsWith(strip) ? g.name.slice(strip.length) : g.name;
    let at = root;
    for (const part of rest.split('/').filter(Boolean).map(slug)) at = at[part] ??= {};
    at.$groups = [...(at.$groups ?? []), g];
  }
  return foldersOf(root);
}

function foldersOf(map) {
  return group(() => {
    const out = {};
    for (const [name, sub] of Object.entries(map)) {
      if (name === '$groups') continue;
      out[name] = foldersOf(sub);
    }
    for (const g of map.$groups ?? []) Object.assign(out, valuesOf(g));
    return out;
  });
}

/** The values of one registered group: every ranged number or choice, and every boolean. */
function valuesOf({ params, ranges, onChange }) {
  const out = {};
  const changed = () => onChange?.();
  for (const [key, range] of Object.entries(ranges)) {
    if (typeof range[0] === 'string') out[key] = choice(range, () => params[key], (v) => ((params[key] = v), changed()));
    else if (typeof params[key] === 'number') out[key] = num(() => params[key], (v) => ((params[key] = v), changed()), range[0], range[1]);
  }
  for (const [key, v] of Object.entries(params)) if (typeof v === 'boolean') out[key] = flag(() => params[key], (b) => ((params[key] = b), changed()));
  return out;
}

/** @param {import('../game.js').Game} g @param {object} host  gameHost's position helpers */
export function buildGameTree(g, host) {
  const unitOf = (id) => g.units.find((u) => u.id === id);

  const where = (thing) => ({
    x: num(() => host.locate(thing).x, (v) => host.put(thing, { x: v, z: host.locate(thing).z }), -500, 500, 'm', 'east'),
    z: num(() => host.locate(thing).z, (v) => host.put(thing, { x: host.locate(thing).x, z: v }), -500, 500, 'm', 'south'),
    y: ro(() => host.locate(thing).y, 'm', 'height'),
    heading: num(() => host.locate(thing).heading, (v) => host.put(thing, { ...host.locate(thing), heading: v }), -360, 360, '°', '0 faces +z, 90 faces +x'),
  });

  // Vehicles ---------------------------------------------------------------------------------------------------------------
  const vehicle = (id) => {
    const u = () => unitOf(id);
    const e = () => u().engine;
    const q = () => u().quad;
    return group(() => {
      const spec = u().spec;
      const out = {
        state: text(() => e().state),
        ...where(id),
        speed: ro(() => q().speed * 2.237, 'mph'),
        rpm: ro(() => e().rpm),
        throttle: ro(() => e().throttle),
        load: ro(() => e().load),
        rolled: ro(() => e().rollSpeed, '', 'how fast the wheels turn it over (bump-start), 0 to 1 of a starter'),
        temperature: num(() => e().temperature, (v) => e().setTemperature(v), 0, 1, '', '0 cold, 1 warm'),
        overheating: ro(() => e().heat),
        trailer: text(() => (q().loadedOn ? (g.trailer.load.mode === 'aboard' ? (g.trailer.load.strapped ? 'strapped on' : 'on, loose') : 'on the ramps') : 'off'), 'on the bale trailer?'),
        battery: num(() => e().battery, (v) => (e().battery = v), 0, 1),
        charging: ro(() => (e().isRunning ? netCharge(e().rpm, e().params.idleRpmWarm, e().params.maxRpm, e().lightLoad, e().params.batteryChargeRate, e().params) * 60 : 0), '/min', 'battery gained a minute at these revs and lamps'),
        fuel: num(() => q().fuel.litres, (v) => (q().fuel.litres = v), 0, q().fuel.params.tankCapacity, 'litres'),
        tap: choice(TAP_POSITIONS, () => q().fuel.tap, (v) => (q().fuel.tap = v), 'the fuel tap'),
        hours: num(() => q().usage.hours, (v) => (q().usage.hours = v), 0, 5000),
        odometer: num(() => q().usage.odoMiles, (v) => (q().usage.odoMiles = v), 0, 100000, 'miles'),
        trip: num(() => q().tripMiles, (v) => (q().tripMiles = v), 0, 1000, 'miles'),
        parkbrake: flag(() => !!q().parkBrake, (v) => (q().parkBrake = v)),
        ignition: flag(() => e().ignitionOn, (v) => e().setIgnition(v)),
        mixture: ro(() => e().mixture),
        roughness: ro(() => e().roughness),
        shake: ro(() => u().vibration.intensity),
        idle: ro(() => u().idleRpm ?? 0, 'rpm', 'dealt at the start'),
        topRpm: ro(() => u().topRpm ?? 0, 'rpm', 'dealt at the start'),
        tune: tuningTree((n) => n.startsWith(`${u().name}/`), `${u().name}/`),
      };
      if (q().lights) out.lights = choice(LIGHT_MODES, () => q().lights.mode, (v) => q().lights.set(v), 'the UTV light switch');
      if (q().signals) out.indicators = choice(SIGNAL_MODES, () => q().signals.mode, (v) => q().signals.set(v), 'the indicators and hazards');
      if (q().drive) out.drive = choice(q().drive.hasLock ? DRIVE_MODES : ['2wd', '4wd'], () => q().drive.mode, (v) => (q().drive.mode = v), 'the 2WD / 4WD switch');
      if (!q().fuel.params.noTap || (q().landRover && !q().engine.params.compressionIgnition)) out.choke = num(() => q().choke, (v) => (q().choke = v), 0, 1); // the Land Rover has a choke but no tap
      if (e().params.waterCooled) out.coolant = num(() => e().coolant, (v) => (e().coolant = v), 0, 1);
      if (q().sump) out.oil = num(() => q().sump.level, (v) => (q().sump.level = v), 0, 1, '', 'engine oil level');

      const faults = {};
      for (const kind of FAULT_KINDS) faults[kind] = num(() => (q().faults.started[kind] ? q().faults.levels[kind] : 0), (v) => setFault(q().faults, kind, v), 0, 1, '', '0 clears it');
      out.faults = group(() => faults, 'the faults');

      out.brakes = group(() => ({
        snow: num(() => w().snow, (v) => g.setSnow(v), 0, 1, '', 'snowing now'),
    snowCover: num(() => w().cover, (v) => g.setSnowCover(v), 0, 1, '', 'how far the ground and seats are under snow'),
    wet: num(() => q().brakes.wet, (v) => (q().brakes.wet = v), 0, 1, '', '1 is soaked: they barely bite until they dry'),
        binding: flag(() => q().brakes.binding, (v) => q().brakes.setBinding(v)),
      }), 'the brakes');

      out.engineHealth = group(() => ({
        plugFouling: num(() => e().fouling, (v) => (e().fouling = v), 0, 1),
        airFilterClog: num(() => e().clog, (v) => (e().clog = v), 0, 1),
        wear: num(() => e().wear, (v) => (e().wear = v), 0, e().params.wearMax ?? 1),
        scuffing: num(() => e().scuff, (v) => (e().scuff = v), 0, 1, '', '1 seizes it'),
        seized: flag(() => e().seized, (v) => (e().seized = v)),
        hardStart: num(() => q().startTrouble, (v) => (q().startTrouble = Math.round(v)), 0, 6, '', 'goes the last start took; 2 or more makes the girls keep it going'),
        water: num(() => e().water, (v) => (e().water = v), 0, 1),
        fuelWater: num(() => q().fuel.water, (v) => (q().fuel.water = v), 0, 0.3, '', 'fraction of the tank that is water'),
        tapBowl: num(() => q().fuel.sediment, (v) => (q().fuel.sediment = v), 0, 1, '', 'how full the sediment bowl on the tap is; full, the water reaches the carb'),
        dieselSoak: num(() => e().dieselSoak, (v) => (e().dieselSoak = v), 0, 1),
        ...(e().params.strokes === 2 ? { silencerBlown: num(() => e().silencerBlown, (v) => (e().silencerBlown = v), 0, 1) } : {}),
      }));

      const quirks = {};
      for (const kind of applicableQuirks(featuresOf(spec, !!g.podRack.podOn(id)))) quirks[kind] = flag(() => q().quirks.has(kind), (v) => setQuirk(q().quirks, kind, v));
      out.quirks = group(() => quirks, 'tick one to give it that quirk');

      const tyres = {};
      WHEEL_NAMES.forEach((name, i) => {
        tyres[`${slug(name)}Psi`] = num(() => q().tyres.psi[i], (v) => { q().tyres.psi[i] = v; q().physics.applyParams(); }, 0.5, 7, 'psi');
      });
      out.tyres = group(() => tyres);
      return out;
    }, `${u().name}`);
  };
  const vehicles = group(() => Object.fromEntries(g.units.map((u) => [u.id, vehicle(u.id)])), 'every vehicle in this game');

  // Girls ------------------------------------------------------------------------------------------------------------------
  const girl = (id) => {
    const c = () => g.companions.find((o) => o.character.id === id);
    return group(() => ({
      state: text(() => c().state),
      free: text(() => { const a = c().availability(); return a.free ? 'yes' : `no: ${a.why}`; }),
      lookingAt: text(() => c().attention.describe()),
      needs: group(() => Object.fromEntries(NEEDS.map((n) => [n, num(() => c().needs[n], (v) => (c().needs[n] = v), 0, 1, '', `how much she wants ${NEED_LABELS[n]} (0 met, 1 pressing)`)]))),
      chose: text(() => describeMind(c().mind).chose),
      nearlyChose: text(() => describeMind(c().mind).nearly),
      thinking: text(() => describeMind(c().mind).next),
      setOn: text(() => c().intent.describe((k) => OFFER_KINDS[k]?.label ?? k)),
      reacting: text(() => c().reactingText),
      mud: num(() => c().mucky.mud, (v) => (c().mucky.mud = v), 0, 1, '', 'how muddy her jeans are'),
      dust: num(() => c().mucky.dust, (v) => (c().mucky.dust = v), 0, 1, '', 'how dusty her hair and face are'),
      pairedWith: text(() => g.pairState(id)),
      waiting: text(() => c().waitingText()),
      ...where(id),
      favour: num(() => g.favour.scores[id], (v) => (g.favour.scores[id] = v), -30, 30, '', 'how she rates you'),
      standing: ro(() => g.favour.standing(id)),
      mood: text(() => g.favour.mood(id)),
      autonomy: flag(() => c().params.ownMind, (v) => (c().params.ownMind = v), 'does things on her own when left standing about'),
      speech: flag(() => c().params.voice, (v) => (c().params.voice = v), 'talks at all'),
      tripsRoundTheBack: num(() => g.romance.girls[id].visits, (v) => (g.romance.girls[id].visits = Math.round(v)), 0, 6),
      lockedIn: flag(() => g.romance.girls[id].locked, (v) => {
        g.romance.girls[id].locked = v;
        if (v) g.favour.lock(id, g.romance.p.lockScore);
        else g.favour.unlock(id);
      }),
      skills: group(() => Object.fromEntries(Object.keys(g.skills.levels[id]).map((s) => [s, num(() => g.skills.level(id, s), (v) => g.skills.set(id, s, v), 0, 1)]))),
      tune: girlTune(c().name),
    }), id);
  };
  /** Her own build and her pillion riding, side by side: "Amy" straight in, "Amy pillion" in a folder. */
  const girlTune = (name) => {
    const own = getTuningGroups().find((x) => x.name === name);
    const pillion = getTuningGroups().find((x) => x.name === `${name} pillion`);
    return group(() => ({ ...(own ? valuesOf(own) : {}), ...(pillion ? { pillion: group(() => valuesOf(pillion)) } : {}) }));
  };
  const girls = group(() => Object.fromEntries(g.companions.map((c) => [c.character.id, girl(c.character.id)])), 'Amy and Jess');

  // You, the day, sound --------------------------------------------------------------------------------------------------
  const player = group(() => ({
    ...where('me'),
    pitch: num(() => g.player.pitch * DEG, (v) => (g.player.pitch = v / DEG), -88, 88, '°', 'up is positive'),
    flying: flag(() => !!g.player.flying, (v) => g.setFlying(v), 'free-fly: no gravity, no walls'),
    riding: text(() => (g.riddenUnit ? g.riddenUnit.id : 'on foot')),
  }), 'you');

  const w = () => g.weather;
  const weather = group(() => ({
    kind: choice(Object.keys(WEATHER_KINDS), () => w().kind, (v) => g.setWeatherKind(v)),
    rain: num(() => w().rain, (v) => g.setRain(v), 0, 1, '', 'falling now'),
    wet: num(() => w().wet, (v) => (w().wet = v), 0, 1, '', 'how wet the ground is'),
    temperature: num(() => w().temperature, (v) => g.setTemperature(v), -15, 35, '°C'),
    frost: ro(() => w().frost),
    chill: ro(() => w().chill),
    band: text(() => w().band),
    wind: ro(() => w().wind),
    time: num(() => g.daylight.hour, (v) => g.setTime(v), 0, 30, 'h', 'time of day, hours after midnight (past 24 is the same night going on)'),
    clock: text(() => g.daylight.text()),
    darkness: ro(() => g.daylight.darkness),
  }), 'the day');

  const gAll = group(() => ({
    autonomy: flag(() => g.girlsAuto, (v) => g.setGirlsAuto(v), 'off: they start nothing on their own, but follow and answer you'),
    speech: flag(() => g.companions.every((c) => c.params.voice), (v) => g.companions.forEach((c) => (c.params.voice = v)), 'off: they say nothing out loud'),
    workLight: text(() => g.workLight.describe()),
  }), 'both girls');
  const farm = group(() => ({
    muck: num(() => g.muck.load, (v) => g.debugSetMuck(v), 0, 1, '', 'muck in the tipping trailer'),
    laid: ro(() => g.muck.laid, '', 'patches laid on the stubble this job'),
    muckDone: flag(() => g.muck.done, (v) => v && g.debugFinishMuck(), 'the muck job is done (ticks the board)'),
    board: text(() => g.jobBoard.lines().map((l) => `${l.done ? '[x]' : '[ ]'} ${l.text}`).join('; ') || 'nothing on', "today's jobs on the barn door"),
    records: text(() => g.records.lines().map((l) => `${l.label}: ${l.text}`).join('; '), 'the bests on the barn board'),
    day: text(() => g.farmText(), 'the farm that remembers: which day it is and when it last saved (the save command does the rest)'),
    climb: text(() => (g.hillClimb.active ? `${g.hillClimb.girl} (${g.hillClimb.phase})` : g.hillClimb.youArmed ? 'you are asked for' : 'idle'), 'the hill climb'),
  }), 'farm jobs');
  const audio = group(() => ({ sound: flag(() => !g.audioHub.params.muted, (v) => (g.audioHub.params.muted = !v), 'all game sound') }));

  return group(() => ({
    vehicle: vehicles,
    girl: girls,
    girls: gAll,
    player,
    weather,
    farm,
    audio,
    tune: tuningTree(),
  }));
}
