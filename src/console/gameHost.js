// What the console's commands need from the game: where things are, putting them somewhere else, the vehicle verbs, the girls' actions
// and the weather. Everything calls the same methods the debug panel and the game itself use.
import { girlActions } from '../debug/girlActions.js';
import { fixEverything, startWarm, switchOff } from '../debug/vehicleDebug.js';
import { WEATHER_KINDS } from '../world/weather.js';

const DEG = 180 / Math.PI;
const norm = (deg) => ((deg % 360) + 360) % 360;
const round = (v, n = 1) => Math.round(v * 10 ** n) / 10 ** n;

export const VEHICLE_VERBS = [
  { name: 'start', help: 'running and warm, fuel on (no cranking)' },
  { name: 'stop', help: 'ignition off, fuel tap off' },
  { name: 'warm', help: 'engine up to temperature' },
  { name: 'cool', help: 'engine stone cold' },
  { name: 'fill', help: 'fill the tank' },
  { name: 'load', help: 'winch it onto the bale trailer (ramps down at once; not the tractor, UTV or Land Rovers)' },
  { name: 'unload', help: 'pay it back down the trailer\'s ramps' },
  { name: 'fix', help: 'put right: faults, plug, filter, wear, scuffing, seizure, water (quirks stay)' },
];

/** @param {import('../game.js').Game} g @param {{ copy: (text: string) => void }} io */
export function createHost(g, { copy = () => {} } = {}) {
  const unitOf = (id) => g.units.find((u) => u.id === id);
  const girlOf = (id) => g.companions.find((c) => c.character.id === id);
  const items = {
    'petrol-can': g.petrolCan,
    'premix-can': g.premixCan,
    'diesel-can': g.dieselCan,
    toolbox: g.toolbox,
    'oil-bottle': g.oilBottle,
    'coolant-bottle': g.coolantBottle,
    'feed-bucket': g.feedBucket,
    leads: g.leads,
  };
  const itemNames = Object.keys(items).filter((k) => items[k]);
  const ground = (x, z) => g.world.heightAt(x, z);

  // Where each girl and item was at the start, for `reset`.
  const home = {};
  for (const c of g.companions) home[c.character.id] = { x: c.root.position.x, z: c.root.position.z, heading: c.heading };
  for (const k of itemNames) home[k] = { x: items[k].model.position.x, z: items[k].model.position.z, heading: items[k].model.rotation.y };

  const layout = g.world.layout;
  const places = () => {
    const spots = {
      start: { x: layout.spawn.player.x, z: layout.spawn.player.z },
      yard: layout.yard,
      barn: layout.barn,
      bell: layout.bell,
      ramp: layout.jumpRamp,
      dragstrip: layout.dragStrip,
      dutchbarn: layout.dutchBarn,
      fieldshed: layout.fieldShed,
      muckheap: layout.muckHeap,
      animals: layout.farmAnimals ? { x: layout.farmAnimals.pen.maxX + 2.5, z: (layout.farmAnimals.pen.minZ + layout.farmAnimals.sty.maxZ) / 2 } : null,
      trough: layout.trough,
      road: layout.road?.pad,
      ford: layout.hill ? { x: layout.hill.lane.x, z: layout.hill.stream.z } : null,
      wood: layout.woods ? { x: layout.woods.gate.x, z: layout.woods.leadIn[1][1] } : null,
      fern: layout.woods?.trail ? { x: layout.woods.trail.entrance.x, z: layout.woods.trail.entrance.z } : null,
      hollowrun: layout.woods ? { x: layout.woods.circuit.points[0][0], z: layout.woods.circuit.points[0][1] } : null,
      river: layout.hill?.river ? { x: layout.hill.river.crossing.x, z: layout.hill.stream.z + layout.hill.river.halfWidth + 8 } : null,
      pit: g.world.fields.quarry ? (() => { const r = g.world.fields.quarry.roadPoints.find((p) => p.t > 0.02); return r ? { x: r.x, z: r.z } : null; })() : null,
      pitwall: g.world.fields.quarry ? { x: g.pitGates[0].x - g.pitGates[0].tx * 4, z: g.pitGates[0].z - g.pitGates[0].tz * 4 } : null,
      hut: g.world.hutShape?.footOfSteps ?? null, // the foot of its steps, not inside it
      pasture: layout.hill ? { x: (layout.hill.pasture.minX + layout.hill.pasture.maxX) / 2, z: (layout.hill.pasture.minZ + layout.hill.pasture.maxZ) / 2 } : null,
    };
    return Object.fromEntries(Object.entries(spots).filter(([, p]) => p && Number.isFinite(p.x) && Number.isFinite(p.z)).map(([k, p]) => [k, { x: p.x, z: p.z }]));
  };

  const riding = () => (g.player.isRiding ? g.riddenUnit : null);

  const host = {
    vehicleVerbs: VEHICLE_VERBS,

    vehicles: () => g.units.map((u) => ({ id: u.id, name: u.name, summary: `${u.engine.state}, ${round(u.quad.speed * 2.237)} mph` })),
    girls: () => g.companions.map((c) => c.character.id),
    things: () => ['me', ...g.units.map((u) => u.id), ...g.companions.map((c) => c.character.id), ...itemNames],
    places,
    girlState: (id) => girlOf(id).state,

    locate(thing) {
      if (thing === 'me') {
        const r = riding();
        if (r) return { x: r.quad.position.x, y: r.quad.position.y, z: r.quad.position.z, heading: norm(r.quad.yaw * DEG) };
        const p = g.player.position;
        return { x: p.x, y: p.y, z: p.z, heading: norm((g.player.yaw + Math.PI) * DEG) };
      }
      const u = unitOf(thing);
      if (u) return { x: u.quad.position.x, y: u.quad.position.y, z: u.quad.position.z, heading: norm(u.quad.yaw * DEG) };
      const c = girlOf(thing);
      if (c) return { x: c.root.position.x, y: c.root.position.y, z: c.root.position.z, heading: norm(c.heading * DEG) };
      const item = items[thing];
      if (item) return { x: item.model.position.x, y: item.model.position.y, z: item.model.position.z, heading: norm(item.model.rotation.y * DEG) };
      return null;
    },

    put(thing, { x, z, heading }) {
      const here = host.locate(thing);
      const rad = heading === undefined ? undefined : (heading / DEG);
      if (thing === 'me') {
        if (riding()) throw new Error('you are on a vehicle: get off first (or tp the vehicle itself)');
        const y = g.player.flying ? Math.max(here.y, ground(x, z) + 0.5) : ground(x, z) + 0.5;
        g.player.moveTo({ x, y, z });
        if (rad !== undefined) g.player.yaw = rad - Math.PI;
      } else if (unitOf(thing)) {
        const q = unitOf(thing).quad;
        if (q.rider || q.driver) throw new Error(`${thing} has someone on it: they would go too, so get them off first`);
        q.placeAt(x, z, rad ?? q.yaw);
      } else if (girlOf(thing)) {
        const c = girlOf(thing);
        const a = c.availability({ asked: true });
    if (!a.free) throw new Error(`${c.name} is busy (${a.why}). Call her back with the bell, or wait until she is stood about`);
        c.root.position.set(x, ground(x, z), z);
        if (rad !== undefined) {
          c.heading = rad;
          c.root.rotation.y = rad;
        }
      } else if (items[thing]) {
        items[thing].putDown({ x, z }, rad ?? items[thing].model.rotation.y);
      }
      // Say where it was sent rather than where it reads as now: a vehicle's body only moves on the next physics step.
      return `${thing} is at x ${round(x)}, z ${round(z)}, heading ${Math.round(norm(heading ?? here.heading))}°`;
    },

    resetThing(thing) {
      const u = unitOf(thing);
      if (u) {
        if (u.quad.rider || u.quad.driver) throw new Error(`${thing} has someone on it`);
        u.resetToSpawn(g.world);
        return `${thing} is back where it started`;
      }
      if (thing === 'me') {
        const s = g.world.spawn.player;
        return host.put('me', { x: s.x, z: s.z, heading: norm((s.yaw + Math.PI) * DEG) });
      }
      return host.put(thing, home[thing]);
    },

    vehicleVerb(id, verb) {
      const u = unitOf(id);
      switch (verb) {
        case 'start': startWarm(u); break;
        case 'stop': switchOff(u); break;
        case 'warm': u.engine.setTemperature(1); break;
        case 'cool': u.engine.setTemperature(0); break;
        case 'fill': u.quad.fuel.litres = u.quad.fuel.params.tankCapacity; break;
        case 'fix': fixEverything(u); break;
        case 'load': return `${id}: ${g.debugLoad(u)}`;
        case 'unload': return `${id}: ${g.debugUnload(u)}`;
        default: throw new Error(`no such thing as ${verb}`);
      }
      return `${id}: ${verb}`;
    },

    girlVerbs: (id) => girlActions(g).forGirl(id),
    girlVerb(id, verb, vehicleId) {
      girlActions(g).find(id, verb).run(id, vehicleId ? unitOf(vehicleId) : undefined);
    },

    weatherKinds: () => Object.keys(WEATHER_KINDS),
    weatherNow: () => `${g.weather.name}, ${g.weather.temperature} °C (${g.weather.band}), rain ${round(g.weather.rain, 2)}, ground wetness ${round(g.weather.wet, 2)}, snow cover ${round(g.weather.cover, 2)}`,
    setWeather(kind) {
      g.setWeatherKind(kind);
      return host.weatherNow();
    },

    dump(text) {
      copy(text);
    },

    farmText: () => g.farmText(),
    farmSave: () => g.saveFarm(),
    farmJson: () => JSON.stringify(g.captureFarm(), null, 2),
    farmWipe: () => g.wipeFarm(),
    farmEndDay: () => {
      g.callItADay({ force: true });
      return g.farm.seeded ? 'a seeded game does not carry on to another day' : `fading to black: day ${g.farm.day + 1} loads next`;
    },
    farmLoad: (json) => g.loadFarmJson(json),

    errors: () => g.guard.summary(),
    clearErrors: () => g.guard.clear(),

    perf() {
      const r = g.renderer;
      return { ...g.frameStats.summary(), stages: g.frameBreakdown.summary().map((x) => ({ name: x.name, ms: x.ms })), slowestFeatures: g.guard.slowest(5), longFrameCauses: g.stutters.log.lines(), heapMb: g.stutters.heap.used / 1048576, allocMbPerSecond: g.stutters.heap.allocMbPerSecond, ...r.info.render, width: r.domElement.width, height: r.domElement.height, pixelRatio: r.getPixelRatio(), maxFps: g.graphics.maxFps };
    },
  };
  return host;
}
