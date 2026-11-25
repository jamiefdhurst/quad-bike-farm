import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// tools/worktree.sh against a throwaway repository, so no real worktree is touched (#1191).
const script = resolve('tools/worktree.sh');
const root = realpathSync(mkdtempSync(join(tmpdir(), 'worktree-test-')));
const main = join(root, 'farm');
mkdirSync(main);
spawnSync('git', ['init', '-q'], { cwd: main });
const run = (...args) => spawnSync('sh', [script, ...args], { cwd: main, encoding: 'utf8' });

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('tools/worktree.sh', () => {
  it('refuses to start an issue that already has a worktree, and changes nothing', () => {
    const dir = join(root, 'farm-worktrees', 'issue-5');
    mkdirSync(dir, { recursive: true });
    const r = run('start', '5');
    expect(r.status).toBe(1);
    expect(r.stdout).toBe('');
    expect(r.stderr.trim()).toBe(`issue-5 already has a worktree at ${dir}: another session may be working it`);
    const list = spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd: main, encoding: 'utf8' }).stdout;
    expect(list.match(/^worktree /gm)).toHaveLength(1);
  });

  it('still prints the path, for a session finding its own', () => {
    expect(run('path', '5').stdout.trim()).toBe(join(root, 'farm-worktrees', 'issue-5'));
  });
});
