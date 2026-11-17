import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { layoutNew, FIELDS_PLAN, FIXED_NAMES } from '../src/world/layoutNew.js';
import {
  FIELD_NAMES, FIELD_TRAITS, DEALT_KINDS, dealFieldNames, usableFieldNames, namedLayout, fieldLabel, fieldPhrase, describeFieldNames,
} from '../src/world/fieldNames.js';
import { createRandom } from '../src/core/random.js';
import { FIELD_KINDS } from '../src/world/fieldPlan.js';
import { createFields } from '../src/world/fields.js';
import { farmMapFeatures } from '../src/hud/farmMap.js';
import { Track } from '../src/world/track.js';
import { openFarm, writeSave, readSave, SAVE_KEY } from '../src/farm/farmSave.js';

// What the new farm's fields are called (#814): a list by kind, dealt to each farm from its seed, kept in its save.
const two = layoutNew(LAYOUT);
const dealable = two.fields.filter((f) => !f.fixed && DEALT_KINDS.includes(f.kind));
const seeds = Array.from({ length: 300 }, (_, i) => 1 + i * 7919);
const byName = Object.fromEntries(FIELD_NAMES.map((n) => [n.name, n]));
const deal = (seed) => namedLayout(two, seed).dealtFieldNames;

const memoryStorage = () => {
  const m = {};
  return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, removeItem: (k) => { delete m[k]; } };
};

describe('the list of names', () => {
  it('has about sixty, each unique, each for kinds a plan has and needing only traits that exist', () => {
    expect(FIELD_NAMES.length).toBeGreaterThanOrEqual(60);
    expect(FIELD_NAMES.length).toBeLessThanOrEqual(75);
    expect(new Set(FIELD_NAMES.map((n) => n.name)).size).toBe(FIELD_NAMES.length);
    for (const n of FIELD_NAMES) {
      expect(n.name, n.name).toMatch(/^[A-Z][A-Za-z]+( [A-Z]?[A-Za-z]+)*$/);
      expect(n.kinds.length, n.name).toBeGreaterThan(0);
      for (const k of n.kinds) expect(FIELD_KINDS, `${n.name} ${k}`).toContain(k);
      for (const t of n.needs) expect(FIELD_TRAITS, `${n.name} ${t}`).toContain(t);
    }
  });
  it('has the issue\'s own examples under the kinds it gives them', () => {
    const kindsOf = (name) => byName[name].kinds;
    for (const a of ['Top Field', 'Long Piece', 'Broad Close', 'Far Field', 'Lane Field', 'Ten Acre', 'Middle Piece']) expect(kindsOf(a), a).toContain('arable');
    for (const a of ['Brook Meadow', 'Long Meadow']) expect(kindsOf(a), a).toContain('pasture');
    expect(kindsOf('Hay Meadow')).toContain('hay');
    for (const a of ['Hill Pasture', 'High Rough', 'Fell Side']) expect(kindsOf(a), a).toContain('rough');
  });
  it('asks for water for anything with brook, water, river or pond in it, and for height for the hill, fell and moor', () => {
    for (const n of FIELD_NAMES) {
      if (/Brook|Water|River/.test(n.name)) expect(n.needs, n.name).toContain('water');
      if (/Pond/.test(n.name)) expect(n.needs, n.name).toContain('pond');
      if (/Hill|Fell|Moor|High|Heather/.test(n.name)) expect(n.needs, n.name).toContain('high');
      if (/Wood/.test(n.name)) expect(n.needs, n.name).toContain('wood');
      if (/Pit/.test(n.name)) expect(n.needs, n.name).toContain('pit');
      if (/^(Long )/.test(n.name) || /Long Acre/.test(n.name)) expect(n.needs, n.name).toContain('long');
    }
  });
  it('has plenty of names with no need for every kind that is dealt, so no field runs out', () => {
    for (const kind of DEALT_KINDS) {
      const generic = FIELD_NAMES.filter((n) => n.kinds.includes(kind) && !n.needs.length);
      const fields = dealable.filter((f) => f.kind === kind).length;
      expect(generic.length, kind).toBeGreaterThanOrEqual(fields + 2);
    }
  });
});

describe('what is named', () => {
  it('is every field but the wood, the pit, Home Ground, the farmstead and the drive, which keep their names', () => {
    expect(FIXED_NAMES.sort()).toEqual(['drive', 'farmstead', 'home', 'pit', 'wood']);
    expect(dealable.map((f) => f.name).sort()).toEqual(['brook', 'far', 'hay', 'hill', 'lanefield', 'ley', 'longpiece', 'north', 'sheep', 'south', 'top', 'wet']);
    for (const f of two.fields.filter((x) => x.fixed)) expect(namedLayout(two, 5).fields.find((x) => x.name === f.name).label).toBe(FIELDS_PLAN.find((x) => x.name === f.name).label);
  });
});

describe('dealing the names to a farm', () => {
  it('gives every field a name that suits its kind and what it is beside, on 300 farms', () => {
    for (const seed of seeds) {
      const names = deal(seed);
      for (const f of dealable) {
        const n = byName[names[f.name]];
        expect(n, `${seed} ${f.name}`).toBeTruthy();
        expect(n.kinds, `${seed} ${f.name} ${n.name}`).toContain(f.kind);
        for (const t of n.needs) expect(f.traits, `${seed} ${f.name} ${n.name} needs ${t}`).toContain(t);
      }
    }
  });
  it('never uses a name twice on one farm, nor one a fixed field has', () => {
    const fixed = two.fields.filter((f) => f.fixed).map((f) => f.label);
    for (const seed of seeds) {
      const names = Object.values(deal(seed));
      expect(new Set(names).size, `${seed}`).toBe(dealable.length);
      for (const f of fixed) expect(names, `${seed}`).not.toContain(f);
    }
  });
  it('keeps "Brook" and "Water" for the fields with water, and "Hill" and "Fell" for the high ones, wherever they are dealt', () => {
    const wet = new Set(['wet', 'brook', 'ley']);
    for (const seed of seeds) {
      for (const [key, name] of Object.entries(deal(seed))) {
        if (/Brook|Water|River|Pond/.test(name)) expect(wet.has(key), `${seed} ${key} ${name}`).toBe(true);
        if (/Hill|Fell|Moor/.test(name)) expect(['hill', 'far', 'wet'], `${seed} ${key} ${name}`).toContain(key);
      }
    }
  });
  it('is the same farm\'s same names every time, and another farm\'s own', () => {
    expect(deal(1234)).toEqual(deal(1234));
    const all = new Set(seeds.map((s) => JSON.stringify(deal(s))));
    expect(all.size).toBeGreaterThan(250);
  });
  it('is its own stream of the seed: asking for names moves no other part of the seed\'s random', () => {
    const r = createRandom(77);
    const first = [r(), r()];
    dealFieldNames(dealable, createRandom(77 ^ 0xf1e1d5));
    const again = createRandom(77);
    expect([again(), again()]).toEqual(first);
  });
  it('throws, not names it badly, for a field no name suits', () => {
    expect(() => dealFieldNames([{ name: 'x', kind: 'wood', traits: [] }], createRandom(1))).toThrow(/no field name left for x/);
  });
});

describe('kept by the save', () => {
  it('writes what the farm dealt, and the next load gets those names back whatever its seed', () => {
    const named = namedLayout(two, 4242);
    const storage = memoryStorage();
    writeSave(storage, { day: 3, farmSeed: 4242, fieldNames: named.dealtFieldNames });
    const f = openFarm({ search: '', storage });
    expect(f.continuing).toBe(true);
    const again = namedLayout(two, f.farmSeed, f.save.fieldNames);
    expect(again.dealtFieldNames).toEqual(named.dealtFieldNames);
    // The names are the save's, not the seed's: a changed list or stream still brings them back.
    expect(namedLayout(two, 99, named.dealtFieldNames).dealtFieldNames).toEqual(named.dealtFieldNames);
    expect(JSON.parse(storage.getItem(SAVE_KEY)).fieldNames).toEqual(named.dealtFieldNames);
    expect(readSave(storage).fieldNames).toEqual(named.dealtFieldNames);
  });
  it('deals a farm saved before names its names from its seed, as a new farm of that seed would have', () => {
    const storage = memoryStorage();
    writeSave(storage, { day: 9, farmSeed: 555 });
    const f = openFarm({ search: '', storage });
    expect(f.save.fieldNames).toBeUndefined();
    expect(namedLayout(two, f.farmSeed, f.save.fieldNames).dealtFieldNames).toEqual(deal(555));
  });
  it('deals again from the seed when what was kept is damaged: missing, the wrong kind of thing, blank or repeated', () => {
    const good = deal(8);
    const keys = dealable.map((f) => f.name);
    const bad = [
      null, 'Top Field', [], { ...good, top: undefined }, { ...good, top: '' }, { ...good, top: 7 }, { ...good, top: 'x'.repeat(41) },
      { ...good, top: good.north }, Object.fromEntries(keys.slice(1).map((k) => [k, good[k]])),
    ];
    for (const saved of bad) {
      expect(usableFieldNames(saved, dealable), JSON.stringify(saved)).toBeNull();
      expect(namedLayout(two, 8, saved).dealtFieldNames).toEqual(good);
    }
    expect(usableFieldNames(good, dealable)).toEqual(good);
    expect(usableFieldNames({ ...good, extra: 'Ghost Field' }, dealable)).toEqual(good);
  });
  it('leaves today\'s farm, which has no fields as data, as it is', () => {
    expect(namedLayout(LAYOUT, 5)).toBe(LAYOUT);
    expect(describeFieldNames(LAYOUT)).toBe('');
  });
});

describe('where the names are used', () => {
  const named = namedLayout(two, 31337);
  it('is on the map: every field is drawn with its name', () => {
    const fields = createFields(named);
    const features = farmMapFeatures(named, fields, new Track(named.trackPoints ?? undefined));
    const written = features.labels.filter((l) => l.kind === 'field').map((l) => l.text);
    for (const f of named.fields) expect(written, f.name).toContain(f.label);
    for (const f of dealable) expect(written, f.name).toContain(named.dealtFieldNames[f.name]);
  });
  it('is read for the chalkboard by fieldLabel, the key where there is none', () => {
    expect(fieldLabel(named, 'top')).toBe(named.dealtFieldNames.top);
    expect(fieldLabel(named, 'home')).toBe('Home Ground');
    expect(fieldLabel(named, 'nowhere')).toBe('nowhere');
    expect(fieldLabel(LAYOUT, 'top')).toBe('top');
  });
  it('is listed for the panel and the console, each with its key', () => {
    const line = describeFieldNames(named);
    expect(line).toMatch(/^the fields: /);
    for (const f of named.fields) expect(line).toContain(`${f.label} (${f.name})`);
  });
  it('is never said by a girl: she says the kind of field, and the crop on the stubble', () => {
    expect(fieldPhrase('arable', 'barley')).toBe('the barley field');
    expect(fieldPhrase('arable')).toBe('the field');
    for (const kind of FIELD_KINDS) {
      const said = fieldPhrase(kind);
      expect(said, kind).toMatch(/^the [a-z ]+$/);
      for (const n of FIELD_NAMES) expect(said, kind).not.toBe(n.name);
    }
  });
});
