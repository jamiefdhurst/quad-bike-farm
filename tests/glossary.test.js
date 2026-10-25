import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// docs/glossary.md: a table of | Name | What it is | Not |. The variants in "Not" must not appear in what a player reads.
const root = join(import.meta.dirname, '..');
const rows = readFileSync(join(root, 'docs/glossary.md'), 'utf8')
  .split('\n')
  .filter((l) => l.startsWith('|') && !l.startsWith('| Name') && !l.startsWith('| ---'))
  .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
  .map(([name, what, not]) => ({ name, what, not: not.split(',').map((v) => v.trim()).filter(Boolean) }));

const files = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js') || p.endsWith('.css')) files.push(p);
  }
};
walk(join(root, 'src'));
files.push(join(root, 'docs/game.md'));
const text = files.map((f) => [f, readFileSync(f, 'utf8')]);

describe('the glossary', () => {
  it('has a name, a description and a variant for every row', () => {
    expect(rows.length).toBeGreaterThan(3);
    for (const r of rows) {
      expect(r.name).not.toBe('');
      expect(r.what).not.toBe('');
      expect(r.not.length).toBeGreaterThan(0);
    }
  });

  it('keeps every listed variant out of the game and docs/game.md', () => {
    const found = [];
    for (const r of rows) {
      for (const v of r.not) {
        // As listed, and with a capital: identifiers like towRope differ in the middle, so they are not caught.
        const re = new RegExp(`\\b(${v}|${v[0].toUpperCase()}${v.slice(1)})\\b`);
        for (const [f, t] of text) if (re.test(t)) found.push(`"${v}" (use "${r.name}") in ${f.slice(root.length + 1)}`);
      }
    }
    expect(found).toEqual([]);
  });
});
