import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CORNERS_PLAN, FIELDS_PLAN, OUTLINE_PLAN } from '../src/world/layoutNew.js';

// The plan's map page (docs/farm-plan-map.html) draws the farm from its own copy of the corners and fields. The code is the truth: this
// holds the page to it, so the plan and the game say the same thing (#995).
const page = readFileSync(new URL('../docs/farm-plan-map.html', import.meta.url), 'utf8');

/** A JavaScript literal assigned in the page's script (`const NAME = ...;`), evaluated on its own. */
function literal(name) {
  const m = page.match(new RegExp(`const ${name} = ([\\s\\S]*?);\\n`));
  if (!m) throw new Error(`no const ${name} in the map page`);
  return new Function(`return (${m[1]});`)();
}

const V = literal('V');
const F = literal('F');
const BOUND = literal('BOUND');

/** The page's id for a field where it differs from the code's key: the page's `lane` is the public road, and the farmstead is `stead`. */
const PAGE_ID = { lane: 'sunk', farmstead: 'stead' };

/** The drive is drawn on its own, not in `F`. */
function pageFields() {
  const out = Object.fromEntries(F.map(([id, , corners]) => [id, corners]));
  const drive = page.match(/pts\('([a-z0-9 ]+)'\), fill: 'var\(--m-grass\)' \}, fields\), 'drive'\)/);
  if (drive) out.drive = drive[1];
  return out;
}

describe('the plan map page matches the farm in the code', () => {
  it('has every corner the code has, at the same place, and no others', () => {
    expect(V).toEqual(CORNERS_PLAN);
  });

  it('has every field, on the same corners', () => {
    expect(pageFields()).toEqual(Object.fromEntries(FIELDS_PLAN.map((f) => [PAGE_ID[f.name] ?? f.name, f.corners])));
  });

  it('draws the walled fields walled', () => {
    // layoutNew.js `WALLED`
    const walled = F.filter(([, , , kind]) => kind === 'wall').map(([id]) => id).sort();
    expect(walled).toEqual(['hill', 'sheep']);
  });

  it('has the same outline', () => {
    expect(BOUND).toEqual(OUTLINE_PLAN);
  });
});
