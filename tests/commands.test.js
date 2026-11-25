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

// /todo rechecks an item before its pull request opens, so the reviewer's findings are fixed on the branch rather than filed after the merge (#1178).
describe('the recheck before the PR', () => {
  const todo = read('.claude/commands/todo.md');
  const step = todo.match(/^\d+\. \*\*Recheck it before the PR\*\*.*$/m)?.[0] ?? '';
  const stepNumber = (title) => Number(todo.match(new RegExp(`^(\\d+)\\. \\*\\*${title}`, 'm'))?.[1]);

  it('is a step of /todo between answering the issue and opening the PR', () => {
    expect(step, 'todo.md has the step').not.toBe('');
    expect(stepNumber('Recheck it before the PR')).toBe(stepNumber('Answer the issue') + 1);
    expect(stepNumber('Commit and open the PR')).toBe(stepNumber('Recheck it before the PR') + 1);
    expect(step, 'it runs /recheck').toContain('.claude/commands/recheck.md');
  });

  it('names both conditions and --solo', () => {
    expect(step, 'the world label').toContain('`🌾 world`');
    expect(step, 'the vehicles label').toContain('`🏍️ vehicles`');
    expect(step, 'the size of the diff').toMatch(/git diff --shortstat origin\/main\.\.\..*more than 150 changed lines/);
    expect(step, '--solo skips it').toContain('--solo');
    expect(hint(todo), 'the argument-hint says --solo skips it').toMatch(/--solo:[^\]]*recheck/);
  });

  it('fixes before the list is posted, asks in step 7\'s stop, and leaves a count', () => {
    expect(step).toMatch(/fix.*before `node tools\/issueCheck\.mjs post`/);
    expect(step).toMatch(/`ask`.*same stop as step 7's/);
    expect(step).toMatch(/count line/);
  });

  it('/recheck gives the count line in the form tools/recheckRate.mjs reads, and says /todo runs it', async () => {
    const { COUNT_FORM } = await import('../tools/recheckRate.mjs');
    const recheck = read('.claude/commands/recheck.md');
    expect(recheck).toContain(COUNT_FORM);
    expect(recheck).toMatch(/`\/todo` runs this itself before the pull request opens/);
    expect(recheck, 'still run by hand').toMatch(/Jamie can still run it by hand at any time/);
    expect(recheck, 'keeps the after-merge branch').toMatch(/\*\*If it has already merged,\*\*/);
  });
});

// A merged item's lines go into the walk for its place, never a testing issue of its own (#1179).
describe('the walk after a merge', () => {
  const todo = read('.claude/commands/todo.md');
  const step = todo.slice(todo.search(/^\d+\. \*\*Ask for testing if it needs it\.\*\*/m), todo.search(/^\d+\. \*\*Tell Jamie\*\*/m));

  it('is the step of /todo before telling Jamie, and adds to the walk with tools/walkIssue.mjs', () => {
    expect(step, 'todo.md has the step').not.toBe('');
    expect(step).toContain('node tools/walkIssue.mjs add <n> --pr <PR link> --lines');
    expect(step).toContain('Never open a "Try: ..." issue of its own');
  });

  it('keeps the rule that only eyes and ears go in', () => {
    expect(step).toMatch(/A walk is for eyes and ears only/);
    expect(step).toMatch(/never for what a test could assert/);
  });

  it('/test works a place\'s walk and closes it when every line is ticked', () => {
    const test = read('.claude/commands/test.md');
    expect(test).toMatch(/\*\*A place\*\*.*works its walk/);
    expect(test).toMatch(/Close the walk as soon as every line is ticked/);
  });
});
