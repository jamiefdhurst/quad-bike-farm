import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
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
const two = layoutNew(LAYOUT, RAW_LAYOUT);
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
  it('is every field but the wood, the pit, Home Ground, the farmstead, the drive and the green lane, which keep their names', () => {
    expect(FIXED_NAMES.sort()).toEqual(['drive', 'farmstead', 'home', 'lane', 'pit', 'wood']);
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
  it('keeps each good name a save has and deals only the fields it has none for, out of the names left', () => {
    const good = deal(8);
    const keys = dealable.map((f) => f.name);
    const some = Object.fromEntries(keys.slice(0, 7).map((k) => [k, good[k]]));
    const again = namedLayout(two, 8, some).dealtFieldNames;
    for (const k of keys.slice(0, 7)) expect(again[k], k).toBe(good[k]);
    expect(new Set(Object.values(again)).size).toBe(keys.length);
    for (const f of dealable) {
      const n = byName[again[f.name]];
      expect(n.kinds, f.name).toContain(f.kind);
      for (const t of n.needs) expect(f.traits, `${f.name} ${n.name}`).toContain(t);
    }
    // A field added since the save was written is the only one dealt: none of the others is renamed, and a name a save has is never dealt to another.
    const wider = { ...two, fields: [...two.fields, { name: 'extra', kind: 'pasture', traits: [], points: [[0, 0], [1, 0], [1, 1]] }] };
    const grown = namedLayout(wider, 8, good).dealtFieldNames;
    for (const k of keys) expect(grown[k], k).toBe(good[k]);
    expect(Object.values(good)).not.toContain(grown.extra);
  });
  it('drops a damaged name but keeps the rest: missing, the wrong kind of thing, blank, too long or repeated', () => {
    const good = deal(8);
    const keys = dealable.map((f) => f.name);
    for (const saved of [null, 'Top Field', []]) expect(usableFieldNames(saved, dealable), JSON.stringify(saved)).toEqual({});
    for (const bad of [undefined, '', 7, 'x'.repeat(41), good.north]) {
      const kept = usableFieldNames({ ...good, top: bad }, dealable);
      expect(Object.keys(kept), String(bad)).toEqual(keys.filter((k) => k !== 'top'));
      expect(namedLayout(two, 8, { ...good, top: bad }).dealtFieldNames.top, String(bad)).toBeTruthy();
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
  it('is never said by a girl: she says the place if it is one of its own, otherwise the kind of field and the crop on the stubble', () => {
    expect(fieldPhrase('top', 'arable', 'barley')).toBe('the barley field');
    expect(fieldPhrase('top', 'arable')).toBe('the field');
    expect(fieldPhrase('pit', 'rough')).toBe('the pit');
    expect(fieldPhrase('hill', 'rough')).toBe('the hill');
    expect(fieldPhrase('sheep', 'pasture')).toBe('the sheep field');
    expect(fieldPhrase('brook', 'pasture')).toBe('the meadow');
    expect(fieldPhrase('wood', 'wood')).toBe('the wood');
    expect(fieldPhrase('farmstead', 'yard')).toBe('the yard');
    expect(fieldPhrase('drive', 'lane')).toBe('the drive');
    for (const f of two.fields) {
      const said = fieldPhrase(f.name, f.kind);
      expect(said, f.name).toMatch(/^the [a-z ]+$/);
      for (const n of FIELD_NAMES) expect(said, f.name).not.toBe(n.name);
    }
    for (const kind of FIELD_KINDS) expect(fieldPhrase('x', kind), kind).toMatch(/^the [a-z ]+$/);
  });
});

describe('names that read well together', () => {
  const many = Array.from({ length: 2000 }, (_, i) => 3 + i * 104729);
  it('never start two names on one farm with the same word, on 2,000 farms, and every farm deals', () => {
    for (const seed of many) {
      const words = Object.values(deal(seed)).map((n) => n.split(' ')[0]);
      expect(new Set(words).size, `${seed} ${words}`).toBe(words.length);
    }
  });
  it('leaves a kept name\'s first word to it: a field dealt beside a kept "Long Piece" is not another Long', () => {
    for (const seed of many.slice(0, 300)) {
      const names = namedLayout(two, seed, { south: 'Long Piece' }).dealtFieldNames;
      expect(Object.entries(names).filter(([, n]) => n.startsWith('Long ')).map(([k]) => k), `${seed}`).toEqual(['south']);
    }
  });
  it('gives "Sheep Field" only to the sheep field', () => {
    let given = 0;
    for (const seed of many) {
      for (const [key, name] of Object.entries(deal(seed))) {
        if (name === 'Sheep Field') {
          expect(key, `${seed}`).toBe('sheep');
          given++;
        }
      }
    }
    expect(given).toBeGreaterThan(100);
    expect(byName['Sheep Field'].needs).toEqual(['sheep']);
    expect(two.fields.find((f) => f.name === 'sheep').traits).toContain('sheep');
  });
});
