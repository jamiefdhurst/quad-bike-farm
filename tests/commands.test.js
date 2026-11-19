import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The second opinion before a stop lives in one section of /todo, and /tidy and /perf point at it (#876).
const read = (path) => readFileSync(join(import.meta.dirname, '..', path), 'utf8');
const hint = (text) => text.match(/^argument-hint: (.*)$/m)?.[1] ?? '';
const COMMANDS = ['.claude/commands/todo.md', '.claude/commands/tidy.md', '.claude/commands/perf.md'];

describe('the second opinion before a stop', () => {
  it('has its section in /todo', () => {
    expect(read('.claude/commands/todo.md')).toMatch(/^## Before you stop$/m);
  });

  for (const path of COMMANDS) {
    it(`${path} takes --solo and points at the section`, () => {
      const text = read(path);
      expect(hint(text), 'the argument-hint names --solo').toContain('--solo');
      expect(text, 'it points at "Before you stop"').toContain('"Before you stop"');
    });
  }
});

// The reviewers read one pack, batch their reads, open no images and stop at a budget, as they were costing more than they found (#1010).
describe('keeping the reviewers cheap', () => {
  const beforeYouStop = read('.claude/commands/todo.md').split(/^## Before you stop$/m)[1] ?? '';
  const recheck = read('.claude/commands/recheck.md');
  for (const [name, text] of [['"Before you stop"', beforeYouStop], ['/recheck', recheck]]) {
    it(`${name} hands over the pack, a request budget and no images`, () => {
      expect(text, 'the pack').toContain('tools/reviewPack.mjs');
      expect(text, 'a budget').toMatch(/stop at about \d+ requests/i);
      expect(text, 'no images').toMatch(/open no images/i);
      expect(text, 'batched reads').toMatch(/batch (its|your) reads/);
    });
  }

  it('tells every session to batch what it reads', () => {
    expect(read('CLAUDE.md')).toMatch(/\*\*Batch what you read\.\*\*/);
  });
});
