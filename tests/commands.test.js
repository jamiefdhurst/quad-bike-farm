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
