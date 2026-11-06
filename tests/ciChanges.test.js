import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isProse, needsChecks, READ_BY_TESTS } from '../tools/ciChanges.mjs';

describe('which pull requests need the tests', () => {
  it('skips them for prose alone', () => {
    expect(needsChecks(['docs/decisions/process.md', 'docs/tidy.md', 'README.md'])).toBe(false);
    expect(needsChecks(['.claude/commands/test.md', '.claude/settings.json'])).toBe(false);
  });

  it('runs them as soon as anything else changes', () => {
    expect(needsChecks(['docs/tidy.md', 'src/game.js'])).toBe(true);
    expect(needsChecks(['.github/workflows/test.yml'])).toBe(true);
    expect(needsChecks(['public/audio/engine-bank.json'])).toBe(true);
    expect(needsChecks(['package-lock.json'])).toBe(true);
  });

  it('runs them for prose a test reads, and when the list of files is empty', () => {
    expect(needsChecks(['docs/glossary.md'])).toBe(true);
    expect(needsChecks(['docs/game.md', 'docs/tidy.md'])).toBe(true);
    expect(needsChecks([])).toBe(true);
    expect(needsChecks(['', '  '])).toBe(true);
  });

  // A new test that reads a Markdown file must add it to READ_BY_TESTS, or a PR changing only that file would merge untested.
  it('counts every Markdown file named in the tests as code', () => {
    const files = [];
    const walk = (dir) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.js') && !p.endsWith('ciChanges.test.js')) files.push(p);
      }
    };
    walk(join(import.meta.dirname));
    const named = new Set();
    for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/['"`]((?:\.claude\/)?[\w./-]+\.md)['"`]/g)) named.add(m[1]);
    expect(named.size).toBeGreaterThan(0);
    for (const path of named) expect(isProse(path), `${path} is read by a test: add it to READ_BY_TESTS`).toBe(false);
    for (const path of READ_BY_TESTS) expect(named.has(path), `${path} is in READ_BY_TESTS but no test names it`).toBe(true);
  });
});
