import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

// The game's makers and models are made up, so no real one is named anywhere a player, a girl or the next session reads, apart from the
// "After a ..." line at the top of a model's body file (#801). The list is in tools/realMakes.json so this file doesn't name them either.
const { makes } = JSON.parse(readFileSync('tools/realMakes.json', 'utf8'));
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NAMED = new RegExp(`(?<![A-Za-z])(${makes.map((m) => escape(m.word)).join('|')})(?![A-Za-z])`); // case-sensitive: "ford" is a place

const walk = (dir, ext) => (existsSync(dir) ? readdirSync(dir) : []).flatMap((f) => {
  const p = path.join(dir, f);
  return statSync(p).isDirectory() ? walk(p, ext) : ext.some((e) => p.endsWith(e)) ? [p] : [];
});

const AFTER = /^\/\/ After an? /;
const SELF = new Set(['tests/noRealMakes.test.js', 'tests/vehicleCodeNames.test.js', 'tests/vehicleNames.test.js']);

/** The `file:line` of every line naming a real make that isn't an "After a ..." line. */
export function namedLines(files, read = (f) => readFileSync(f, 'utf8')) {
  const bad = [];
  for (const f of files) {
    read(f).split('\n').forEach((line, i) => {
      if (AFTER.test(line)) return;
      const m = NAMED.exec(line);
      if (m) bad.push(`${f}:${i + 1} ${m[1]}`);
    });
  }
  return bad;
}

describe('no real make or model is named', () => {
  it('lists each with why', () => {
    for (const m of makes) expect(m.why, m.word).toMatch(/\S/);
  });

  it('is found by the list, in a comment and in an FAQ answer', () => {
    const [a, b] = [makes[0].word, makes[1].word];
    const planted = { 'src/a.js': `// A ${a} pulls it.\n// After a ${a} ${b}.`, 'src/faq/b.js': `a: \`The ${b} starts.\`` };
    expect(namedLines(Object.keys(planted), (f) => planted[f])).toEqual([`src/a.js:1 ${a}`, `src/faq/b.js:1 ${b}`]);
    expect(namedLines(['src/c.js'], () => `// After a ${a}.\nconst ford = 1; // the ford`)).toEqual([]);
  });

  it('is not in src, tests or the two pages a player reads, apart from "After a ..." lines', () => {
    // The rest of docs/ and .claude/ is held by the grep in #801, not here: a test that read it would run on every PR that only changes prose (#636).
    const files = [...walk('src', ['.js']), ...walk('tests', ['.js']), 'docs/glossary.md', 'docs/game.md'].filter((f) => !SELF.has(f));
    expect(namedLines(files)).toEqual([]);
  });
});
