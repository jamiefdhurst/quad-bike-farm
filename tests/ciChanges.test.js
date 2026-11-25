import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { isProse, needsChecks, needsSmoke, READ_BY_TESTS } from '../tools/ciChanges.mjs';

describe('which pull requests need the tests', () => {
  it('skips them for prose alone', () => {
    expect(needsChecks(['docs/decisions/process.md', 'docs/tidy.md', 'README.md'])).toBe(false);
    expect(needsChecks(['.claude/commands/idea.md', '.claude/settings.json'])).toBe(false);
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

// The smoke test plays the game, so only a change that can reach the game runs it (#1182).
describe('which pull requests need the smoke test', () => {
  it('skips it for prose alone', () => {
    expect(needsSmoke(['docs/decisions/process.md', 'README.md'])).toBe(false);
    expect(needsSmoke(['.claude/rules/checking.md', '.claude/settings.json'])).toBe(false);
  });

  it('skips it for prose a test reads, though the unit tests still run', () => {
    for (const path of READ_BY_TESTS) {
      expect(needsSmoke([path]), path).toBe(false);
      expect(needsChecks([path]), path).toBe(true);
    }
  });

  it('skips it for a change to the tests alone, though the unit tests still run', () => {
    expect(needsSmoke(['tests/ciChanges.test.js'])).toBe(false);
    expect(needsSmoke(['tests/helpers/worldModels.js', 'tests/villageHost.test.js'])).toBe(false);
    expect(needsChecks(['tests/ciChanges.test.js'])).toBe(true);
  });

  it('skips it for a mix of those kinds', () => {
    expect(needsSmoke(['CLAUDE.md', 'docs/tidy.md', '.claude/commands/idea.md', 'tests/bareBlocks.test.js'])).toBe(false);
  });

  it('runs it as soon as anything that can reach the game changes', () => {
    expect(needsSmoke(['src/game.js'])).toBe(true);
    expect(needsSmoke(['tests/ciChanges.test.js', 'tools/smoke.mjs'])).toBe(true);
    expect(needsSmoke(['.github/workflows/test.yml'])).toBe(true);
    expect(needsSmoke(['public/audio/engine-bank.json'])).toBe(true);
    expect(needsSmoke(['package-lock.json'])).toBe(true);
    expect(needsSmoke(['index.html', 'docs/tidy.md'])).toBe(true);
    // A path that only looks like a test, outside tests/.
    expect(needsSmoke(['src/tests/thing.js'])).toBe(true);
  });

  it('runs it when the list of files is empty', () => {
    expect(needsSmoke([])).toBe(true);
    expect(needsSmoke(['', '  '])).toBe(true);
  });

  it('never skips the unit tests where it runs the smoke test', () => {
    const lists = [['src/game.js'], ['docs/tidy.md'], ['CLAUDE.md'], ['tests/a.test.js'], [], ['tools/x.mjs', 'README.md']];
    for (const l of lists) if (needsSmoke(l)) expect(needsChecks(l), l.join(', ')).toBe(true);
  });

  it('prints code= and smoke= for the workflow, one to a line', () => {
    const run = (input) => execFileSync(process.execPath, [join(import.meta.dirname, '../tools/ciChanges.mjs')], { input, encoding: 'utf8' });
    expect(run('tests/ciChanges.test.js\n')).toBe('code=true\nsmoke=false\n');
    expect(run('docs/tidy.md\n')).toBe('code=false\nsmoke=false\n');
    expect(run('src/game.js\ndocs/tidy.md\n')).toBe('code=true\nsmoke=true\n');
    expect(run('')).toBe('code=true\nsmoke=true\n');
  });
});
