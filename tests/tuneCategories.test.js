import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TUNE_CATEGORIES, categoryOf, sortTuneGroups, OTHER_CATEGORY } from '../src/debug/tuneCategories.js';

const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const registered = new Set();
for (const file of walk('src').filter((f) => f.endsWith('.js'))) {
  for (const m of readFileSync(file, 'utf8').matchAll(/registerTuning\('((?:[^'\\]|\\.)*)'/g)) registered.add(m[1].replace(/\\'/g, "'"));
}

describe('tune tab categories', () => {
  it('lists every group the game registers', () => {
    expect(registered.size).toBeGreaterThan(50);
    const missing = [...registered].filter((n) => categoryOf(n) === OTHER_CATEGORY);
    expect(missing, `add these to src/debug/tuneCategories.js: ${missing.join(', ')}`).toEqual([]);
  });

  it('lists nothing twice, or that no longer exists', () => {
    const all = Object.values(TUNE_CATEGORIES).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(all.filter((n) => !registered.has(n))).toEqual([]);
  });

  it('sorts by category then name', () => {
    const sorted = sortTuneGroups([{ name: 'Racing' }, { name: 'Tyres' }, { name: 'Zzz' }, { name: 'Dust' }, { name: 'Handbrake' }]).map((g) => g.name);
    expect(sorted).toEqual(['Handbrake', 'Tyres', 'Dust', 'Racing', 'Zzz']);
  });
});
