import { describe, it, expect } from 'vitest';
import * as specModule from '../src/vehicle/quadSpecs.js';
import { VEHICLE_NAMES, MAKER_NAMES, fullName, sayName, thePhrase, modelOnly } from '../src/vehicle/names.js';
import { MAKER_FOR } from '../src/vehicle/detail/decals.js';
import { CHARACTERS } from '../src/npc/characters.js';
import { BANTER } from '../src/npc/banterLines.js';
import { FAQ_SECTIONS, VEHICLE_NOTES } from '../src/faq/faqContent.js';
import { CONTROLS } from '../src/hud/controls.js';
import { QUAD_PHRASES } from '../src/npc/quadNames.js';

const specs = Object.values(specModule).flatMap((v) => (Array.isArray(v) ? v : [v])).filter((s) => s && typeof s.id === 'string' && 'bodyColor' in s);

// Real makes and models the game must never print or say (the made-up makers and models are in vehicle/names.js). "Ford" is left out: the ford is a place.
const REAL = /\b(honda|yamaha|kawasaki|suzuki|land[ -]?rover|landy|landies|defender|fiesta|corsa|vauxhall|opel|massey|ferguson|john deere|kubota|polaris|can-am|bombardier|grizzly|kodiak|blaster|quadracer|series iii|200 ?tdi|tdi)\b/i;
// A quad called by its paint: "the red quad", "the blue one". Red diesel, a red handle, a needle "in the red" and the like are not a vehicle.
const BY_COLOUR = /\b(red|blue|yellow|green|orange) (quad|one)s?\b|(?<!\b(?:in|on) )\bthe (red|blue|yellow|green|orange)\b(?! (diesel|stuff|box|handle|can|catch|lever|toolbox|lamp|zone|margin|reflectors|petrol|rocker|switch|band|bay|light|puddle))/i;

function strings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
  return out;
}

const spoken = () => {
  const out = [];
  for (const c of CHARACTERS) for (const e of Object.values(c.lines)) for (const l of e.lines) if (typeof l === 'string') out.push([c.id, l]);
  for (const e of BANTER) for (const [who, l] of e.lines) out.push([who, l]);
  return out;
};

describe('every vehicle has an in-game name', () => {
  it('has one for each spec, and none for anything else', () => {
    expect(Object.keys(VEHICLE_NAMES).sort()).toEqual(specs.map((s) => s.id).sort());
  });

  it('uses the maker on its badge', () => {
    for (const s of specs) expect(VEHICLE_NAMES[s.id].maker.toLowerCase(), s.id).toBe(MAKER_FOR[s.id]);
  });

  it('is never a real name, and a spec carries it', () => {
    for (const s of specs) {
      expect(REAL.test(fullName(s.id)), s.id).toBe(false);
      expect(s.name).toBe(fullName(s.id));
      expect(s.label).toBe(sayName(s.id));
    }
  });

  it('gives no two vehicles the same name', () => {
    expect(new Set(specs.map((s) => fullName(s.id))).size).toBe(specs.length);
  });

  it('says "the Farm 300" and drops the maker for a notebook', () => {
    expect(thePhrase('red')).toBe('the Farm 300');
    expect(QUAD_PHRASES.blue).toBe('the Bruin');
    expect(modelOnly('Kestrel Farm 300')).toBe('Farm 300');
    expect(MAKER_NAMES).toContain('Moorland');
  });
});

describe('nothing the player reads or hears names a real vehicle', () => {
  it('in the girls\' lines', () => {
    for (const [who, line] of spoken()) expect(REAL.test(line), `${who}: ${line}`).toBe(false);
  });

  it('in the FAQ', () => {
    for (const text of strings([FAQ_SECTIONS, VEHICLE_NOTES])) expect(REAL.test(text), text.slice(0, 120)).toBe(false);
  });

  it('in the controls help', () => {
    for (const text of strings(CONTROLS)) expect(REAL.test(text), text.slice(0, 120)).toBe(false);
  });
});

describe('the girls do not call a quad by its paint', () => {
  it('in what they say', () => {
    for (const [who, line] of spoken()) expect(BY_COLOUR.test(line), `${who}: ${line}`).toBe(false);
  });
});
