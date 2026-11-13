// Every vehicle's id is its in-game model name, typed and read the same everywhere (#589). A version 1 save names them by the old ids
// (red, tractor, landrover ...), so it is converted as it is read; the console takes only the new ones.
import { describe, it, expect } from 'vitest';
import * as specModule from '../src/vehicle/quadSpecs.js';
import { VEHICLE_NAMES } from '../src/vehicle/names.js';
import { RUSTY_ID } from '../src/vehicle/barnFind.js';
import { migrateSave, readSave, openFarm, SAVE_KEY, SAVE_VERSION, OLD_VEHICLE_IDS } from '../src/farm/farmSave.js';
import { buildCommands } from '../src/console/commands.js';
import { Shell, group, value, resolve } from '../src/console/shell.js';
import { buildGameTree } from '../src/console/gameTree.js';
import { VEHICLE_VERBS } from '../src/console/gameHost.js';

const allSpecs = Object.values(specModule).flatMap((v) => (Array.isArray(v) ? v : [v])).filter((s) => s && typeof s === 'object' && typeof s.id === 'string' && 'bodyColor' in s);
const KEPT = ['plover', RUSTY_ID]; // the two ids that were already model names
const NEW_IDS = [...Object.values(OLD_VEHICLE_IDS), ...KEPT];
const OLD_IDS = Object.keys(OLD_VEHICLE_IDS);

describe('vehicle ids', () => {
  it('has every spec id and every names.js key in the table of model names, once each', () => {
    expect(allSpecs.length).toBeGreaterThanOrEqual(19);
    for (const s of allSpecs) expect(NEW_IDS, `spec ${s.id}`).toContain(s.id);
    for (const id of Object.keys(VEHICLE_NAMES)) expect(NEW_IDS, `names.js ${id}`).toContain(id);
    expect(new Set(NEW_IDS).size).toBe(NEW_IDS.length);
    expect(NEW_IDS.length).toBe(20);
  });

  it('leaves no old id in use', () => {
    const now = new Set([...allSpecs.map((s) => s.id), ...Object.keys(VEHICLE_NAMES), RUSTY_ID]);
    for (const old of OLD_IDS) expect(now.has(old), old).toBe(false);
  });
});

/** A version 1 save with every old id in every place the save names a vehicle. */
function oldSave() {
  const vehicles = Object.fromEntries([...OLD_IDS, ...KEPT].map((id, i) => [id, { hours: 10 + i, odo: 100 + i, fuel: { litres: i }, faults: { started: {} } }]));
  return {
    version: 1,
    day: 7,
    farmSeed: 99,
    fleet: [...OLD_IDS],
    market: { purse: 5, bought: OLD_IDS.map((specId) => ({ specId, price: 1 })), sold: [...OLD_IDS], ledger: OLD_IDS.map((specId) => ({ deal: 'bought', specId })) },
    vehicles,
    pods: Object.fromEntries(OLD_IDS.map((id) => [id, 'analogue'])),
    batteries: Object.fromEntries(OLD_IDS.map((id) => [id, { where: 'loose' }])),
    road: Object.fromEntries(OLD_IDS.map((id) => [id, [{ day: 1, bhp: 9 }]])),
    girls: { favour: { amy: 1 }, opinions: { amy: Object.fromEntries(OLD_IDS.map((id) => [id, { hill: 5 }])), jess: {} } },
    bucket: [...OLD_IDS.map((id) => `ride-${id}`), 'barn-find', 'ride-plover'],
    records: { bests: { lap: { who: 'amy', value: 3, quad: 'Farm 300', day: 2 } }, byQuad: { lap: Object.fromEntries(OLD_IDS.map((id) => [id, { who: 'amy', value: 3, day: 2 }])) } },
    mot: { last: { landrover: { day: 3, passed: true, fails: [] } }, certificate: { landrover: 9 }, history: [{ day: 3, specId: 'landrover200', passed: false, fails: ['brakes'] }] },
    stories: ['The red quad rolled.'], // prose is left as written
  };
}

describe('a version 1 save', () => {
  it('comes back under the model names, with each vehicle keeping all it kept', () => {
    const old = oldSave();
    const now = migrateSave(old);
    expect(now.version).toBe(SAVE_VERSION);
    expect(Object.keys(now.vehicles).sort()).toEqual([...NEW_IDS].sort());
    for (const [oldId, newId] of Object.entries(OLD_VEHICLE_IDS)) expect(now.vehicles[newId], newId).toEqual(old.vehicles[oldId]);
    for (const id of KEPT) expect(now.vehicles[id]).toEqual(old.vehicles[id]);
    expect(now.fleet).toEqual(Object.values(OLD_VEHICLE_IDS));
  });

  it('is renamed in the cork board, pods, batteries, rolling road, opinions, achievements, records and MOT too', () => {
    const now = migrateSave(oldSave());
    const NEW = Object.values(OLD_VEHICLE_IDS);
    expect(now.market.bought.map((b) => b.specId)).toEqual(NEW);
    expect(now.market.sold).toEqual(NEW);
    expect(now.market.ledger.map((b) => b.specId)).toEqual(NEW);
    for (const key of ['pods', 'batteries', 'road']) expect(Object.keys(now[key]), key).toEqual(NEW);
    expect(Object.keys(now.girls.opinions.amy)).toEqual(NEW);
    expect(now.bucket).toEqual([...NEW.map((id) => `ride-${id}`), 'barn-find', 'ride-plover']);
    expect(Object.keys(now.records.byQuad.lap)).toEqual(NEW);
    expect(now.records.bests.lap.quad).toBe('Farm 300');
    expect(now.mot.last).toHaveProperty('tor');
    expect(now.mot.certificate).toHaveProperty('tor');
    expect(now.mot.history[0].specId).toBe('crag');
    expect(now.stories).toEqual(['The red quad rolled.']);
  });

  it('is converted when read, and leaves the one in storage as it was', () => {
    const old = oldSave();
    const stored = JSON.stringify(old);
    const storage = { getItem: (k) => (k === SAVE_KEY ? stored : null), setItem() {}, removeItem() {} };
    expect(Object.keys(readSave(storage).vehicles)).toContain('farm300');
    expect(openFarm({ storage }).save.fleet[0]).toBe('farm300');
    expect(JSON.parse(stored)).toEqual(old);
  });

  it('is not converted twice: a version 2 save is read as it is, and a part an old save never had stays missing', () => {
    const now = migrateSave(oldSave());
    expect(migrateSave(now)).toBe(now);
    const bare = migrateSave({ version: 1, day: 2, farmSeed: 1 });
    expect(Object.keys(bare).sort()).toEqual(['day', 'farmSeed', 'version']);
  });
});

describe('the console', () => {
  const ids = Object.keys(VEHICLE_NAMES).concat(RUSTY_ID);
  const host = {
    vehicleVerbs: VEHICLE_VERBS,
    vehicles: () => ids.map((id) => ({ id, name: id, summary: '' })),
    girls: () => ['amy', 'jess'],
    things: () => ['me', ...ids, 'amy', 'jess'],
    places: () => ({ barn: { x: 0, z: 0 } }),
    locate: () => ({ x: 0, y: 0, z: 0, heading: 0 }),
    put: (thing, spot) => `${thing} to ${spot.x}, ${spot.z}`,
    girlVerbs: () => [],
    vehicleVerb: (id, verb) => `${id}: ${verb}`,
    jobs: () => [],
    jobVerb: () => undefined,
  };
  const shell = () => new Shell({ root: group(() => ({ vehicle: group(() => ({ tor: group(() => ({ fuel: value({ get: () => 1 }) })) })) })), commands: buildCommands(new Proxy(host, { get: (t, k) => (k in t ? t[k] : () => undefined) })) });
  const errored = (line) => shell().run(line).find((o) => o.kind === 'error')?.text;

  it('takes the model names for tp, face and the vehicle verbs', () => {
    for (const id of ['tor', 'crag', 'farm300', 'finch', 'vauclair', 'hartley']) {
      expect(errored(`tp me to ${id}`), `tp me to ${id}`).toBeUndefined();
      expect(errored(`tp ${id} barn`), `tp ${id} barn`).toBeUndefined();
      expect(errored(`face ${id} 90`), `face ${id}`).toBeUndefined();
      expect(errored(`start ${id}`), `start ${id}`).toBeUndefined();
    }
  });

  it('refuses each old id, and the error lists the vehicles as well as the places', () => {
    for (const old of OLD_IDS) {
      expect(errored(`tp me to ${old}`), `tp me to ${old}`).toMatch(/not a place or a thing/);
      expect(errored(`tp ${old} barn`), `tp ${old} barn`).toMatch(/nothing called/);
      expect(errored(`face ${old} 90`), `face ${old}`).toMatch(/nothing called/);
      expect(errored(`start ${old}`), `start ${old}`).toMatch(/no vehicle/);
    }
    const said = errored('tp me to landrover');
    expect(said).toMatch(/Places: barn/);
    expect(said).toMatch(/Vehicles: .*\btor\b.*\bcrag\b/);
  });

  it('has a vehicle.<id> folder for each model name and none for an old id', () => {
    const tree = buildGameTree({ units: ids.map((id) => ({ id, name: id })), companions: [], weather: {} }, {});
    for (const id of ids) expect(resolve(tree, `vehicle.${id}`).error, id).toBeUndefined();
    for (const old of OLD_IDS) expect(resolve(tree, `vehicle.${old}`).error, old).toMatch(/no "/);
  });
});
