// The game as the console sees it: a tree of values (vehicle.red.temperature, girl.amy.favour, weather.rain, tune.<group>.<key>...)
// built over the live game. Every value reads and writes through the same fields and methods the debug panel uses.
import { tinLevel, ledgerText } from '../farm/classifieds.js';
import { SEASONS } from '../world/seasons.js';
import { netCharge } from '../engine/charging.js';
import { NEEDS, NEED_LABELS } from '../npc/needs.js';
import { describeMind, OFFER_KINDS } from '../npc/chooser.js';
import { REMEMBERED_KINDS } from '../npc/memory.js';
import { strengthOf } from '../vehicle/strength.js';
import { AGENDA_IDS } from '../npc/agenda.js';
import { group, value, slug } from './shell.js';
import { PARTS, ALL_PART_IDS } from '../workshop/spares.js';
import { getTuningGroups } from '../core/tuning.js';
import { FAULT_KINDS } from '../vehicle/faults.js';
import { applicableQuirks, featuresOf } from '../vehicle/quirks.js';
import { WHEEL_NAMES } from '../vehicle/tyres.js';
import { setFault, setQuirk, engineReadouts } from '../debug/vehicleDebug.js';
import { TAP_POSITIONS } from '../vehicle/fuelSystem.js';
import { LIGHT_MODES } from '../vehicle/lightSwitch.js';
import { SIGNAL_MODES } from '../vehicle/indicators.js';
import { DRIVE_MODES } from '../vehicle/driveMode.js';
import { lensCoverage } from '../effects/lensMud.js';
import { WEATHER_KINDS } from '../world/weather.js';
import { completeStyle, outfitsFor } from '../npc/outfits.js';

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
        trailer: text(() => (q().loadedOn ? (g.trailer.load.mode === 'aboard' ? (g.trailer.load.strapped ? 'strapped on' : 'on, loose') : 'on the ramps') : 'off'), 'on the bale trailer?'),
        hitchAngle: ro(() => (g.trailerOf(q()) ? (g.trailerOf(q()).motion.hitchAngle * 180) / Math.PI : 0), 'deg', 'how far the trailer on its hook is off straight behind it, left positive'),
        folded: flag(() => !!g.trailerOf(q())?.motion.jammed, (v) => g.debugJackknife(u(), !!v), 'is the trailer on its hook folded against it? Set true to fold it, false to straighten it'),
        winch: flag(() => { const w = g.winch; return !!w && w.state === 'hooked' && (u() === w.unit ? !!w.anchor : w.target === q()); }, (v) => { const w = g.winch; const on = !!w && w.state === 'hooked' && (u() === w.unit ? !!w.anchor : w.target === q()); if (!!v !== on) g.hud.toast(g.debugWinch(u())); }, 'is the green\'s winch hooked on it? Set true to hook it (on the green itself, the nearest tree), false to take it off'),
        towRope: flag(() => g.towRope.target === q(), (v) => { if (!!v !== (g.towRope.target === q())) g.hud.toast(g.debugTowRope(u())); }, 'is the tow rope hooked on it? Set true to hook it from the nearest utility quad, false to take it off'),
        engineOut: flag(() => !!u().engineOut, (v) => g.debugEngineOut(u(), !!v), 'is the engine out on the floor by the parts rack? Set true to take it out, false to fit the first spare that suits it'),
        engineFrom: text(() => (u().engineOrigin ? `the ${u().engineOrigin.label}'s` : 'its own'), 'whose engine is in it (swapped at the bench)'),
        battery: num(() => e().battery, (v) => (e().battery = v), 0, 1),
        charging: ro(() => (e().isRunning ? netCharge(e().rpm, e().params.idleRpmWarm, e().params.maxRpm, e().lightLoad, e().params.batteryChargeRate, e().params) * 60 : 0), '/min', 'battery gained a minute at these revs and lamps'),
        fuel: num(() => q().fuel.litres, (v) => (q().fuel.litres = v), 0, q().fuel.params.tankCapacity, 'litres'),
        tap: choice(TAP_POSITIONS, () => q().fuel.tap, (v) => (q().fuel.tap = v), 'the fuel tap'),
        tapUncovered: text(() => (q().fuel.uncovered ? 'yes' : 'no'), 'has the fuel slopped away from the tap (low tank, steep nose-up bank)?'),
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
      if (q().barLights) out.lights = choice(q().barLights.modes, () => q().barLights.mode, (v) => q().barLights.set(v), 'the lights switch on the bars (off, low is dipped, high is main beam; the yellow\'s plain switch has only off and low)');
      if (q().snorkel.canFit) {
        out.snorkel = flag(() => q().snorkel.fitted, (v) => (v ? q().snorkel.fit(1) : q().snorkel.remove()), 'is a snorkel fitted? (the bench job fits one; set true or false here)');
        out.snorkelSeal = num(() => q().snorkel.seal, (v) => (q().snorkel.seal = v), 0, 1, '', '1 is bedded in, lower lets water in when it is deep; "Put it right" sets it to 1');
      }
      if (q().spotlamps.canFit) {
        out.spotlamps = flag(() => q().spotlamps.fitted, (v) => (v ? q().spotlamps.fit(1) : q().spotlamps.remove()), 'are spotlamps fitted? (the bench job fits them; set true or false here)');
        out.spotlampsOn = flag(() => q().spotlamps.on, (v) => (q().spotlamps.on = !!v && q().spotlamps.fitted), 'the spotlamps switch (9 in the game)');
        out.spotlampAim = num(() => q().spotlamps.aim, (v) => (q().spotlamps.aim = v), 0, 1, '', '1 is aimed true, lower points low and off to one side; "Put it right" sets it to 1');
      }
      if (q().radio) {
        out.radio = flag(() => q().radio.on, (v) => q().radio.set(v), 'the radio is on (it also needs the key on to make a sound)');
        out.radioVolume = num(() => q().radio.volume, (v) => q().radio.setVolume(v), 0, 1);
        out.radioState = text(() => `${q().radio.describe()}, signal ${q().radio.signal.toFixed(2)}`, 'what the radio is doing');
      }
      if (q().signals) out.indicators = choice(SIGNAL_MODES, () => q().signals.mode, (v) => q().signals.set(v), 'the indicators and hazards');
      if (q().drive) out.drive = choice(q().drive.hasLock ? DRIVE_MODES : ['2wd', '4wd'], () => q().drive.mode, (v) => (q().drive.mode = v), 'the 2WD / 4WD switch');
      if (!q().engine.params.injected && (!q().fuel.params.noTap || (q().landRover && !q().engine.params.compressionIgnition))) out.choke = num(() => q().choke, (v) => (q().choke = v), 0, 1); // the Land Rover has a choke but no tap
      for (const m of engineReadouts(e(), { manual: !!q().manual })) out[m.key] = typeof m.get(e()) === 'number' ? ro(() => m.get(e()), '', m.label) : text(() => String(m.get(e())), m.label);
      if (e().params.manualTiming) out.sparkLever = num(() => e().advance, (v) => (e().advance = v), 0, 1, '', 'the advance-retard lever on the left bar: 0 retarded (easy and safe to kick, no power), 1 advanced (kicks back when kicked, wants the revs up)');
      if (e().params.tickler) out.tickled = num(() => e().tickled, (v) => (e().tickled = v), 0, 3, '', 'fuel the tickler has put in the carb: enriches a cold start, floods the plug past ' + e().params.tickleFloodAbove);
      if (e().params.waterCooled) out.coolant = num(() => e().coolant, (v) => (e().coolant = v), 0, 1);
      if (e().params.waterCooled) out.thermostat = num(() => e().thermostat, (v) => (e().thermostat = v), 0, 1);
      if (q().sump) out.oil = num(() => q().sump.level, (v) => (q().sump.level = v), 0, q().sump.params.maxLevel, '', 'engine oil level (over 1 is overfilled)');

      const faults = {};
      for (const kind of FAULT_KINDS) faults[kind] = num(() => (q().faults.started[kind] ? q().faults.levels[kind] : 0), (v) => setFault(q().faults, kind, v), 0, 1, '', '0 clears it');
      out.faults = group(() => faults, 'the faults');
      out.valvesTight = flag(() => q().faults.kept.valveTight, (v) => (q().faults.kept.valveTight = v));
      if (q().faults.hasChain) {
        out.chain = group(() => ({
          oil: num(() => q().faults.kept.chainLube, (v) => (q().faults.kept.chainLube = v), 0, 1, '', '1 fresh, 0 bone dry'),
          off: flag(() => q().faults.chainOff, (v) => (q().faults.kept.chainOff = v)),
        }), 'the drive chain');
      }

      out.brakes = group(() => ({
        snow: num(() => w().snow, (v) => g.setSnow(v), 0, 1, '', 'snowing now'),
    snowCover: num(() => w().cover, (v) => g.setSnowCover(v), 0, 1, '', 'how far the ground and seats are under snow'),
    wet: num(() => q().brakes.wet, (v) => (q().brakes.wet = v), 0, 1, '', '1 is soaked: they barely bite until they dry'),
        binding: flag(() => q().brakes.binding, (v) => q().brakes.setBinding(v)),
      }), 'the brakes');
      out.carbIce = group(() => ({
        ice: num(() => q().carbIce.ice, (v) => (q().carbIce.ice = v), 0, 1, '', '1 is iced solid: power gone at steady part throttle until a blip or a stop clears it'),
      }), 'the carb\'s ice');
      if (e().params.compressionIgnition) {
        out.dieselWax = group(() => ({
          wax: num(() => q().fuel.wax, (v) => (q().fuel.wax = v), 0, 1, '', '1 is waxed solid: a diesel loses power, cuts out and will not catch until it warms or is treated'),
          antiGel: num(() => q().fuel.antiGel, (v) => (q().fuel.antiGel = v), 0, 1, '', 'the share of the tank treated with anti-gel'),
        }), 'the diesel\'s wax');
        out.dieselAir = group(() => ({
          airLock: num(() => q().fuel.airLock, (v) => (q().fuel.airLock = v), 0, 1, '', '1 is air in the line after running dry: the engine will not catch until it is bled at the lift pump'),
        }), 'air in the diesel\'s fuel line');
      }
      out.iceCable = group(() => ({
        ice: num(() => q().iceCable.ice, (v) => (q().iceCable.ice = v), 0, 1, '', '1 is frozen solid: it will not open (or, if it freezes open, shut) until it thaws'),
        open: flag(() => q().iceCable.mode === 'open', (v) => (q().iceCable.mode = v ? 'open' : 'shut')),
      }), 'the throttle cable\'s ice');

      out.engineHealth = group(() => ({
        plugFouling: num(() => e().fouling, (v) => (e().fouling = v), 0, 1),
        airFilterClog: num(() => e().clog, (v) => (e().clog = v), 0, 1),
        wear: num(() => e().wear, (v) => (e().wear = v), 0, e().params.wearMax ?? 1),
        pistonLooseness: num(() => e().pistonWear ?? e().wear, (v) => (e().pistonWear = v), 0, e().params.wearMax ?? 1, '', 'a worn piston knocks while the engine is cold; only a new piston and rings clear it'),
        scuffing: num(() => e().scuff, (v) => (e().scuff = v), 0, 1, '', '1 seizes it'),
        seized: flag(() => e().seized, (v) => (e().seized = v)),
        hardStart: num(() => q().startTrouble, (v) => (q().startTrouble = Math.round(v)), 0, 6, '', 'goes the last start took; 2 or more makes the girls keep it going'),
        water: num(() => e().water, (v) => (e().water = v), 0, 1),
        fuelWater: num(() => q().fuel.water, (v) => (q().fuel.water = v), 0, 0.3, '', 'fraction of the tank that is water'),
        plugSaver: num(() => q().fuel.additive, (v) => (q().fuel.additive = v), 0, 1, '', 'share of the tank treated with plug-saver; cuts the oily idle fouling'),
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
      tyres.frontTread = num(() => q().tyres.tread.front, (v) => (q().tyres.tread.front = v), 0, 1, '', '0 bald, 1 new');
      tyres.rearTread = num(() => q().tyres.tread.rear, (v) => (q().tyres.tread.rear = v), 0, 1, '', '0 bald, 1 new');
      out.tyres = group(() => tyres);
      out.strength = text(() => strengthOf(u().spec) ?? 'none', 'its hidden strength (hill, mud or tarmac): what the girls work out by riding');
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
      hearing: text(() => `${Math.round((c().hearingK ?? 1) * 100)}%`),
      needs: group(() => Object.fromEntries(NEEDS.map((n) => [n, num(() => c().needs[n], (v) => (c().needs[n] = v), 0, 1, '', `how much she wants ${NEED_LABELS[n]} (0 met, 1 pressing)`)]))),
      mood: num(() => c().mood.value, (v) => (c().mood.value = v), -1, 1, '', 'how she has been feeling lately (-1 low, 1 high); it eases towards how her needs have been'),
      chose: text(() => describeMind(c().mind).chose),
      nearlyChose: text(() => describeMind(c().mind).nearly),
      thinking: text(() => describeMind(c().mind).next),
      agenda: choice(['none', ...AGENDA_IDS], () => c().agenda.id ?? 'none', (v) => c().agenda.set(v, c().params), 'what she has in mind for the day, which she is keener on all game and says early on'),
      remembers: text(() => c().memory.describe(), 'what has gone well or badly for her lately, and so what she is keener or warier of'),
      quadViews: text(() => c().opinion.describe(g.strengthIds(), g.strengthTruth), 'which quad she thinks best on a hill, in mud and on tarmac, from riding them'),
      memory: group(() => Object.fromEntries(REMEMBERED_KINDS.map((k) => [k, num(() => c().memory.weight(k), (v) => (c().memory.feel[k] = v), 0.1, 3, '', `how keen (over 1) or wary (under 1) she is of: ${OFFER_KINDS[k]?.label ?? k}`)]))),
      setOn: text(() => c().intent.describe((k) => OFFER_KINDS[k]?.label ?? k)),
      reacting: text(() => c().reactingText),
      helmet: text(() => g.headgear.describe(id), 'where her helmet is: on the hooks, on her head, on a seat or on the ground'),
      coat: text(() => g.coats.describe(id), 'whether she has a wax jacket on, and her hood up or down'),
      outfit: choice(outfitsFor(c().character.outfitOdds), () => completeStyle(c().outfit.style).kind, (v) => c().setStyle({ ...completeStyle(c().outfit.style), kind: v }), 'what she has on top today'),
      plaidOpen: flag(() => completeStyle(c().outfit.style).plaidOpen, (v) => c().setStyle({ ...completeStyle(c().outfit.style), plaidOpen: v }), 'a plaid shirt worn open over her polo'),
      popped: flag(() => completeStyle(c().outfit.style).popped, (v) => c().setStyle({ ...completeStyle(c().outfit.style), popped: v }), 'her collar popped'),
      plaidButtons: num(() => completeStyle(c().outfit.style).plaidButtons, (v) => c().setStyle({ ...completeStyle(c().outfit.style), plaidButtons: Math.round(v) }), 0, 4, '', "buttons undone on a buttoned plaid (0: done right up)"),
      underOpen: num(() => completeStyle(c().outfit.style).underOpen, (v) => c().setStyle({ ...completeStyle(c().outfit.style), underOpen: Math.round(v) }), 0, 5, '', 'in two polos, buttons undone on hers under the other'),
      mud: num(() => c().mucky.mud, (v) => (c().mucky.mud = v), 0, 1, '', 'how muddy her jeans are'),
      dust: num(() => c().mucky.dust, (v) => (c().mucky.dust = v), 0, 1, '', 'how dusty her hair and face are'),
      poloOpen: num(() => c().outfit.poloOpen ?? 0, (v) => c().setPoloOpen(v), 0, 5, '', "how many of her polo's buttons are undone (0 to 5)"),
      pairedWith: text(() => g.pairState(id)),
      askingAlong: text(() => g.askAlongState(id)),
      practising: text(() => g.practising.describe(id)),
      waiting: text(() => c().waitingText()),
      ...where(id),
      quadCare: num(() => g.quadCare.care[id], (v) => (g.quadCare.care[id] = v), 0, 1, '', 'how much she cares about her quad'),
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
      lessonsPassed: text(() => [...g.lessons.passed[id]].join(', ') || 'none', 'the driving lessons she has passed you on'),
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
    stream: num(() => g.world.streamLevel.level, (v) => g.setStreamLevel(v), 0, 1, '', 'how high the stream stands, low to full (the ford deepens and runs faster)'),
    wet: num(() => w().wet, (v) => (w().wet = v), 0, 1, '', 'how wet the ground is'),
    temperature: num(() => w().temperature, (v) => g.setTemperature(v), -15, 35, '°C'),
    season: choice(SEASONS, () => g.season, (v) => g.reloadAsSeason(v), 'the season of the farm\'s date (spring, summer, autumn, winter); setting it loads the game again with ?season= (it shapes the weather, the daylight, the ground and the trees)'),
    date: text(() => g.seasonText(), 'the farm\'s date, its season and the length of the daylight'),
    autumn: text(() => (g.autumn ? 'an autumn day: turned leaves, conkers, a slippery wood' : 'not an autumn day (set season)'), 'whether it is autumn (decided as the farm loads)'),
    frost: ro(() => w().frost),
    lane: num(() => g.world.wear.laneMean(), (v) => g.world.wear.setLane(v), 0, 1, '', 'how rutted the green lane is, 0 sound to 1 a bog (the lane wears and recovers on its own as well)'),
    puddleIce: num(() => g.world.puddleIce.thickness[0] ?? 0, (v) => g.world.puddleIce.setAll(v), 0, 1, '', 'how thick the ice is on every puddle (0 open water; it then follows the temperature again)'),
    breakIce: flag(() => !g.world.puddleIce.thickness.some((_, i) => g.world.puddleIce.isIce(i)), (v) => v && g.world.puddleIce.breakAll(), 'on: every puddle\'s ice breaks now'),
    chill: ro(() => w().chill),
    damp: ro(() => w().damp),
    band: text(() => w().band),
    wind: ro(() => w().wind),
    windNow: ro(() => g.wind.strength),
    windHeading: num(() => Math.round(((g.wind.heading * 180) / Math.PI + 360) % 360), (v) => g.wind.setHeading((v * Math.PI) / 180), 0, 360, '°', 'the way the wind blows towards, in degrees from south (z) round towards east (x)'),
    strike: flag(() => g.thunder.flash > 0.05, (v) => v && g.strikeNow(), 'on: a flash of lightning now, somewhere in the hills (thunder follows)'),
    storm: ro(() => w().storm),
    gust: flag(() => g.wind.gust > 0.05, (v) => v && g.wind.blowGust(), 'on: a gust now'),
    time: num(() => g.daylight.hour, (v) => g.setTime(v), 0, 30, 'h', 'time of day, hours after midnight (past 24 is the same night going on)'),
    clock: text(() => g.daylight.text()),
    forecast: text(() => g.forecast.describe(g.daylight.hour), 'what the barn board says and what the day will do'),
    turn: flag(() => !!g.weather.from, (v) => v && g.turnWeatherNow(), 'on: the weather turns now (to what the forecast has, else something believable)'),
    darkness: ro(() => g.daylight.darkness),
    mist: num(() => g.mist.level, (v) => g.setMist(v), 0, 1, '', 'mist in the barley hollow (setting it holds it there; mistAuto lets the day decide)'),
    mistAuto: flag(() => g.mist.forced === null, (v) => v && g.setMist(null), 'on: the day decides the mist again'),
    rainbow: num(() => g.rainbow.strength, (v) => g.setRainbow(v), 0, 1, '', 'a rainbow opposite the sun, which has to be up (setting it holds it there; rainbowAuto lets the weather decide)'),
    rainbowAuto: flag(() => g.rainbow.forced === null, (v) => v && g.setRainbow(null), 'on: a shower with the sun out decides the rainbow again'),
  }), 'the day');

  const gAll = group(() => ({
    autonomy: flag(() => g.girlsAuto, (v) => g.setGirlsAuto(v), 'off: they start nothing on their own, but follow and answer you'),
    speech: flag(() => g.companions.every((c) => c.params.voice), (v) => g.companions.forEach((c) => (c.params.voice = v)), 'off: they say nothing out loud'),
    dares: text(() => g.dares.describe()),
    girlBench: text(() => g.girlBench.describe()),
    phoneCall: text(() => g.phoneCalls.describe()),
    cars: text(() => g.describeCars(), "the girls' cars: who's in them, who has them, when each girl next takes hers out"),
    workLight: text(() => g.workLight.describe()),
    trailerGuide: text(() => g.trailerGuide.describe()),
  }), 'both girls');
  const farm = group(() => ({
    muck: num(() => g.muck.load, (v) => g.debugSetMuck(v), 0, 1, '', 'muck in the tipping trailer'),
    laid: ro(() => g.muck.laid, '', 'patches laid on the stubble this job'),
    hensHunger: num(() => g.farmAnimals.hunger.hens, (v) => (g.farmAnimals.hunger.hens = Math.max(0, Math.min(1, v))), 0, 1, '', 'how hungry the hens are, 0 fed to 1 starving'),
    pigHunger: num(() => g.farmAnimals.hunger.pig, (v) => (g.farmAnimals.hunger.pig = Math.max(0, Math.min(1, v))), 0, 1, '', 'how hungry the pig is, 0 fed to 1 starving'),
    feedBucket: num(() => g.feedBucket.feed, (v) => g.feedBucket.setFeed(v), 0, 1, '', 'feed in the bucket, 0 empty to 1 full'),
    feedJob: flag(() => g.jobBoard.has('feed'), (v) => v && g.debugAnimals('job'), 'the feeding job is on the board (setting it puts it there)'),
    hensScatter: flag(() => false, (v) => v && g.debugAnimals('scatter'), 'set to true: the hens scatter'),
    muckDone: flag(() => g.muck.done, (v) => v && g.debugFinishMuck(), 'the muck job is done (ticks the board)'),
    bonfire: text(() => `${g.bonfire.state}, ${g.bonfire.piled} on the pile, ${Math.round(g.bonfire.intensity * 100)}% blaze`, 'the bonfire (world/bonfire.js)'),
    radios: flag(() => g.radioUnits().some((u) => u.quad.radio.on), (v) => g.setAllRadios(v), 'every radio in the Land Rovers and the cars: set on or off together'),
    bonfireLit: flag(() => g.bonfire.burning, (v) => (v ? g.debugLightFire() : g.bonfire.putOut()), 'the bonfire is lit (setting it builds the pile and lights it)'),
    hay: text(() => (g.hay ? `${g.hay.describe()}; ${g.hayLoading.describe()}` : 'no hay patch on this farm'), 'the hay job (world/haymaking.js): its stage, bales and who is loading'),
    spray: text(() => (g.spray ? g.spray.describe() : 'no spray field on this farm'), 'the spraying job (world/spraying.js): its stage, coverage, tank and boom'),
    sprayTank: num(() => g.spray?.tank ?? 0, (v) => g.spray && (g.spray.tank = Math.max(0, Math.min(1, v))), 0, 1, '', 'the sprayer tank, 0 empty to 1 full'),
    sprayBoom: flag(() => !!g.spray?.boomWant, (v) => g.debugSpray(v ? 'out' : 'in'), 'the sprayer boom is folded out'),
    sprayDone: flag(() => g.spray?.done ?? false, (v) => g.debugSpray(v ? 'done' : 'clear'), 'the field is sprayed (setting it ticks the board; clearing makes it need spraying again)'),
    hayStacked: ro(() => g.hay?.stacked ?? 0, '', 'hay bales stacked in the Dutch barn (kept from day to day)'),
    hayDone: flag(() => g.jobBoard.finished.has('hay'), (v) => v && g.debugHayStage('done'), 'the hay job is done (ticks the board)'),
    silageDone: flag(() => g.jobBoard.finished.has('silage'), (v) => v && g.debugFinishSilage(), 'the silage job is done (ticks the board)'),
    splitter: flag(() => !!g.splitterFitted, (v) => g.logStack && g.fitSplitter(!!v), 'the log splitter is fitted on the tractor in place of the bale spike'),
    logsStacked: num(() => g.logStack?.count ?? 0, (v) => g.logStack && (g.logStack.count = Math.max(0, Math.min(g.splitterParams.capacity, Math.round(v))), g.stackView.set(g.logStack.count)), 0, 120, '', 'logs on the stack at the wood (kept from day to day)'),
    logsDone: flag(() => g.jobBoard.finished.has('logs'), (v) => v && g.debugFinishLogs(), 'the log job is done (ticks the board)'),
    spikeLift: num(() => g.baleRig.lift.lift, (v) => { g.baleRig.lift.lift = Math.max(0, Math.min(1, v)); }, 0, 1, '', 'the bale spike arms, 0 down to 1 up'),
    service: text(() => (g.serviceJob ? `${g.serviceJob.name}: ${g.serviceJob.kinds.join(', ')} (${g.serviceJob.left.size} left)` : 'no service job on the board'), 'the service job on the barn board'),
    purse: num(() => g.market.purse, (v) => g.debugSetPurse(v), 0, 100000, '£', 'money in the tin, for second-hand buying'),
    tin: text(() => `£${g.market.purse} in the tin (${['a coin or two', 'change', 'stacks of coins', 'bundles of notes', 'notes over the rim'][tinLevel(g.market.purse)]}); ${g.market.ledger.length ? g.market.ledger.map(ledgerText).join('; ') : 'no deals yet'}`, 'what is in the money tin and the last few deals'),
    market: text(() => g.describeMarket(), 'the ads on the barn board and what you have bought (farm/classifieds.js)'),
    ads: flag(() => g.market.ads.length > 0, (v) => (v ? g.debugDealAds() : g.debugClearAds()), 'there are ads on the barn board (setting it puts some up, or takes them down)'),
    shed: text(() => g.describeShed(), 'the shed kit in the barn: what is standing, what is on the way (farm/shed.js)'),
    compressor: flag(() => g.shed.has('compressor', g.farm.day), (v) => g.giveShedPiece('compressor', v), 'the compressor is in the barn (setting it stands it there at once, or takes it away)'),
    washer: flag(() => g.shed.has('washer', g.farm.day), (v) => g.giveShedPiece('washer', v), 'the parts washer is in the barn (setting it stands it there at once, or takes it away)'),
    pit: flag(() => g.shed.has('pit', g.farm.day), (v) => g.giveShedPiece('pit', v), 'the inspection pit is in the big bay (setting it opens it at once, or fills it in)'),
    board: text(() => g.jobBoard.lines().map((l) => `${l.done ? '[x]' : '[ ]'} ${l.text}`).join('; ') || 'nothing on', "today's jobs on the barn door"),
    records: text(() => g.records.lines().map((l) => `${l.label}: ${l.text}`).join('; '), 'the bests on the barn board'),
    challenges: text(() => g.describeChallenges(), 'the chalkboard challenges: the bests, and the cold-start clock'),
    coldStart: flag(() => g.coldRun.active, (v) => (v !== g.coldRun.active ? g.startColdStart() : null), 'the cold-start clock is running (setting it starts it, or calls it off)'),
    lineUp: text(() => { const r = g.lineUpNow(); return `${r.score} / 100 with ${r.inBays} in the bays${r.ok ? '' : ` (${r.why})`}`; }, 'how the quads stand in the yard bays now, without putting it on the board'),
    judgeLineUp: flag(() => false, (v) => v && g.judgeLineUp(), 'judge the line-up now and put it on the board'),
    day: text(() => g.farmText(), 'the farm that remembers: which day it is and when it last saved (the save command does the rest)'),
    show: text(() => g.describeShow(), 'the farm show on the last Sunday of a month (farm/showDay.js): today, and the rosettes won'),
    showday: flag(() => g.isShowToday(), (v) => (g.showForced = v), 'make today show day (call it a day at the calendar to be judged; the last quad you rode is the entry)'),
    briefing: flag(() => g.briefing.active, (v) => (v ? g.startBriefing() : g.briefing.skip()), "Amy's briefing of the day (npc/briefing.js): setting it on starts it at once, off cuts it short"),
    calendar: text(() => g.endOfDayNow().text, 'what the barn calendar says about calling it a day (save day does it at once)'),
    ask: group(() => ({
      race: text(() => g.askNow('race').join('; ') || 'nothing in the way', 'what would stop asking for the lap race working now'),
      drag: text(() => g.askNow('drag').join('; ') || 'nothing in the way', 'what would stop asking for the drag race working now'),
      climb: text(() => g.askNow('climb').join('; ') || 'nothing in the way', 'what would stop asking for the hill climb working now'),
      cones: text(() => g.askNow('cones').join('; ') || 'nothing in the way', 'what would stop asking for the cone course working now'),
      last: text(() => g.lastAsk ?? 'none', 'why the last ask came to nothing'),
    }), 'asking the girls for a race, a drag run or the climb'),
    cones: text(() => `${g.coneCourse.active ? `${g.coneCourse.girl} (${g.coneCourse.phase})` : g.coneCourse.youArmed ? 'you are asked for' : 'idle'}; ${g.coneField.downCount} of ${g.coneField.cones.length} cones down`, 'the cone course'),
    climb: text(() => (g.hillClimb.active ? `${g.hillClimb.girl} (${g.hillClimb.phase})` : g.hillClimb.youArmed ? 'you are asked for' : 'idle'), 'the hill climb'),
  }), 'farm jobs');
  const wildlife = group(() => ({
    rabbits: ro(() => g.rabbits.rabbits.filter((r) => r.mode !== 'down').length, '', 'rabbits above ground (the rest are in the hedge)'),
    caught: ro(() => g.rabbits.rabbits.filter((r) => r.mode === 'caught').length, '', 'rabbits frozen in a headlight'),
    pheasants: text(() => g.pheasants.birds.map((b) => b.mode).join(', ') || 'none', 'each pheasant: hidden, fly or gone'),
    flush: flag(() => false, (v) => v && g.debugFlushPheasant(), 'set to true: the nearest pheasant bursts out as if you had come up to it'),
  }), 'rabbits and pheasants');
  const cat = group(() => ({
    mode: text(() => `${g.cat.mode}${g.cat.perchId != null ? ` on ${g.cat.perchId}` : ''}`, 'what the cat is doing (sit, walk, seek, sleep, flee, hide, greeted, curl...) and what it is on'),
    purring: ro(() => (g.cat.purring ? 1 : 0), '', 'whether the cat is purring'),
    call: flag(() => false, (v) => v && g.debugCat('call'), 'set to true: the cat is put down a few metres in front of you'),
    shoo: flag(() => false, (v) => v && g.debugCat('shoo'), 'set to true: shoo the cat as if you had pressed E at it'),
    perch: flag(() => false, (v) => v && g.debugCat('perch'), 'set to true: warm the nearest open vehicle and put the cat asleep on it'),
    shelter: flag(() => g.catForceShelter, (v) => g.debugCat('shelter', v), 'keep the cat in the barn whatever the weather'),
  }), 'the barn cat');
  const dog = group(() => ({
    mode: text(() => `${g.dog.mode}${g.dog.riding ? ` on ${g.dog.rackId}` : ''}${g.dog.target ? ` after ${g.dog.target}` : ''}`, 'what the dog is doing (idle, wander, sniff, follow, seek, hop, ride, down, chase, nip, dodge) and what she is on or after'),
    call: flag(() => false, (v) => v && g.debugDog('call'), 'set to true: the dog is put down a few metres in front of you'),
    ride: flag(() => g.dog.riding, (v) => (v ? g.debugDog('ride') : g.debugDog('down')), 'true: put the dog on the rear rack of the quad you are on; false: get her down'),
    chase: flag(() => false, (v) => v && g.debugDog('chase'), 'set to true: the dog goes after the nearest moving vehicle'),
    bark: flag(() => false, (v) => v && g.debugDog('bark'), 'set to true: the dog barks'),
  }), 'the farm dog');
  const fence = group(() => ({
    on: flag(() => g.fence.live, (v) => { g.fenceParams.live = v ? 1 : 0; }, 'whether the electric fence on the hill is switched on'),
    last: text(() => (g.fence.lastZap ? `${g.fence.lastZap.id} (${g.fence.lastZap.kind})` : 'nobody yet'), 'who last got a jolt from it'),
    zap: flag(() => false, (v) => v && g.debugZapFence(), 'set to true: you (or the quad you are on) catch the wire now'),
  }), 'the electric fence across the hill pasture');
  const generator = group(() => ({
    now: text(() => g.describeGenerator(), 'whether it runs, its fuel and what it powers'),
    fuel: num(() => g.generator.fuel, (v) => g.debugGeneratorFuel(v), 0, 20, ' L', 'diesel in the tank (setting it switches the set off)'),
    running: flag(() => g.generator.running, (v) => (v ? g.debugGeneratorPull() : g.switchGeneratorOff()), 'set to true: pull the cord once (it may not catch); false: switch it off'),
  }), 'the diesel generator outside the barn');
  const spares = group(() => ({
    now: text(() => g.sparesShelf.describe(), 'what is on the rack, on order and in the parcel'),
    ...Object.fromEntries(ALL_PART_IDS.map((id) => [id, num(() => g.spares.count(id), (v) => ((g.spares.counts[id] = Math.max(0, Math.round(v))), g.sparesShelf.paintCrates()), 0, 20, '', `${PARTS[id].many} on the rack`)])),
    orderAll: flag(() => false, (v) => v && g.sparesShelf.debugOrderAll(), 'set to true: order a pack of every part'),
    openParcel: flag(() => false, (v) => v && g.spares.hasParcel && g.sparesShelf.collect(), 'set to true: open the parcel at the barn door'),
  }), 'the spares shelf in the barn');
  const lane = group(() => ({
    now: text(() => g.trafficHost.describe(), 'what is on the lane and who is visiting'),
    pass: flag(() => false, (v) => v && g.trafficHost.debugPass(), 'set to true: a vehicle goes along the lane now'),
    post: flag(() => false, (v) => v && g.trafficHost.debugVisit('post'), 'set to true: the post van comes in at the big gate'),
    neighbour: flag(() => false, (v) => v && g.trafficHost.debugVisit('neighbour'), 'set to true: a neighbour calls'),
    southGate: flag(() => g.trafficHost.gate('south').isOpen, (v) => g.trafficHost.gate('south').set(!!v), 'the south gate onto the green lane: true is open'),
    gridGate: flag(() => g.trafficHost.gate('grid').isOpen, (v) => g.trafficHost.setGridGate(!!v), 'the gate by the cattle grid: true is open'),
    bigGate: flag(() => g.trafficHost.gate('road').isOpen, (v) => g.trafficHost.gate('road').set(!!v), 'the big gate in the east hedge: true is open'),
  }), 'the public lane, the visitors and the two gates');
  const neighbour = group(() => ({
    now: text(() => g.neighbourHost.describe(), 'where the neighbour is and what she did last'),
    hello: flag(() => false, (v) => v && g.neighbourHost.debugGreet(), 'set to true: she says hello now'),
    go: flag(() => false, (v) => v && g.neighbourHost.debugGoTo(), 'set to true: put you on foot at her gate'),
  }), 'the neighbour over the lane');
  const village = group(() => ({
    now: text(() => g.villageHost.describe(), 'the village down the lane: its limit, what was last bought and the fuel prices'),
    stayed: text(() => `${g.pubVisit.stayed.toFixed(0)} s at the pub with both girls (they say goodbye after ${g.pubParams.pubStay} s)`, 'how long you and the girls have been at the pub'),
    pub: flag(() => false, (v) => v && g.villageHost.debugGoTo('pub'), 'set to true: put you on foot in the pub car park'),
    shop: flag(() => false, (v) => v && g.villageHost.debugGoTo('shop'), 'set to true: put you on foot outside the shop'),
    garage: flag(() => false, (v) => v && g.villageHost.debugGoTo('garage'), 'set to true: put you on foot at the garage pumps'),
    parts: flag(() => false, (v) => v && g.villageHost.debugGoTo('parts'), 'set to true: put you on foot at the garage parts rack'),
  }), 'the village down the lane (Nether Thornby): its pub, shop and garage');
  const photos = group(() => ({
    now: text(() => g.photos.describe(), 'the photos pinned on the barn corkboard and the last one taken'),
    count: ro(() => g.photos.wall.photos.length, '', 'photos pinned'),
    take: flag(() => false, (v) => v && g.photos.press(), 'set to true: raise the camera now'),
    clear: flag(() => false, (v) => v && g.photos.clear(), 'set to true: take every photo down'),
    mode: flag(() => g.photos.modeActive, (v) => (v ? g.photos.enterMode() : g.photos.exitMode()), 'photo mode (key 8): the world stands still and the camera flies free'),
    hud: flag(() => g.photos.hudHidden, (v) => g.photos.modeActive && g.photos.setHudHidden(!!v), 'in photo mode: true hides the HUD'),
    pose: flag(() => g.photos.girlsPosing, (v) => g.photos.modeActive && g.photos.setGirlsPosing(!!v), 'in photo mode: true has the girls in the shot pose'),
  }), 'the camera and the barn corkboard');
  const waving = group(() => ({
    wave: flag(() => false, (v) => v && g.waveAtGirls(), 'set to true: wave as if you had pressed 6'),
  }), 'waving at the girls (key 6)');
  const towRope = group(() => ({
    now: text(() => { const r = g.towRope; return r.state === 'hooked' ? `${r.puller.unit?.label} to ${r.target.unit?.label}: ${r.tight ? `tight, ${Math.round(r.force)} N` : 'slack'}, ${r.length.toFixed(1)} m long` : r.state; }, 'where the tow rope is and how tight'),
    off: flag(() => false, (v) => v && g.towRope.stow(), 'set to true: take the rope off and put it back'),
  }), 'the tow rope on the utility quads');
  const kit = group(() => ({
    helmet: flag(() => g.headgear.you.helmet, (v) => v !== g.headgear.you.helmet && g.toggleYourGear('you'), 'your helmet is on'),
    goggles: flag(() => g.headgear.you.goggles, (v) => v !== g.headgear.you.goggles && g.toggleYourGear('goggles'), 'your goggles are on (they keep most of the mud off your view)'),
  }), 'your helmet and goggles from the hooks in the barn');
  const lens = group(() => ({
    covered: ro(() => lensCoverage(g.lens), '', 'how much of your view has mud or drops on it, 0 to 1'),
    guard: num(() => g.lensParams.guard, (v) => (g.lensParams.guard = v), 0, 1, '', 'how much is kept off the lens (your goggles raise it while they are on)'),
    splat: flag(() => false, (v) => v && g.debugLens('splat'), 'set to true: three splats of mud on the lens'),
    wipe: flag(() => false, (v) => v && g.debugLens('wipe'), 'set to true: wipe it (the first smears, the second clears)'),
    clear: flag(() => false, (v) => v && g.debugLens('clear'), 'set to true: clean it off'),
  }), 'the mud on your view on an open vehicle');
  const audio = group(() => ({ sound: flag(() => !g.audioHub.params.muted, (v) => (g.audioHub.params.muted = !v), 'all game sound') }));

  return group(() => ({
    vehicle: vehicles,
    girl: girls,
    girls: gAll,
    player,
    weather,
    farm,
    wildlife,
    cat,
    dog,
    fence,
    lane,
    neighbour,
    village,
    generator,
    spares,
    photos,
    waving,
    towRope,
    lens,
    kit,
    audio,
    tune: tuningTree(),
  }));
}
