import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { FLOORS, bytesByFile, checkShares, sharesOf, sourcePath, summaryMarkdown } from '../tools/smokeCoverage.mjs';
import { GIRL_ACTIONS_LEFT_OUT, PROMPTS_LEFT_OUT, VEHICLE_VERBS_LEFT_OUT } from '../tools/smokeActions.mjs';
import { VEHICLE_VERBS } from '../src/console/gameHost.js';
import { girlActions } from '../src/debug/girlActions.js';
import { SCENES } from '../src/debug/scenes.js';

const SRC = resolve('src');
const hostFiles = () => readdirSync(SRC, { recursive: true }).filter((f) => f.endsWith('Host.js')).map((f) => `src/${f}`).sort();

describe('what the smoke run reaches', () => {
  const MAP = '\n//# sourceMappingURL=data:application/json;base64,AAAA';
  const entry = (path, text, ranges) => ({ url: `http://localhost:5173/${path}?t=1`, text: text + MAP, ranges });

  it('counts the game\'s own files by their paths and leaves out everything else', () => {
    expect(sourcePath('http://localhost:5173/src/game.js?t=12')).toBe('src/game.js');
    expect(sourcePath('http://localhost:5173/node_modules/.vite/deps/three.js')).toBeNull();
    expect(sourcePath('http://localhost:5173/')).toBeNull();
    expect(sourcePath('not a url')).toBeNull();
  });

  it('measures the code, not the inline source map after it', () => {
    const text = 'x'.repeat(100);
    const bytes = bytesByFile([entry('src/game.js', text, [{ start: 0, end: 40 }, { start: 90, end: 500 }])]);
    expect(bytes['src/game.js']).toEqual({ covered: 50, total: 100 });
  });

  it('gives the share of all of src, of game.js and of each host file', () => {
    const bytes = bytesByFile([
      entry('src/game.js', 'x'.repeat(100), [{ start: 0, end: 50 }]),
      entry('src/npc/mindsHost.js', 'x'.repeat(100), [{ start: 0, end: 100 }]),
      entry('src/npc/other.js', 'x'.repeat(200), []),
    ]);
    const shares = Object.fromEntries(sharesOf(bytes, { all: 0, 'src/game.js': 0, hosts: {} }).map((s) => [s.name, s.share]));
    expect(shares).toEqual({ all: 37.5, 'src/game.js': 50, 'src/npc/mindsHost.js': 100 });
  });

  it('fails a share under its floor and says which, what it was and what to do', () => {
    const shares = [
      { name: 'all', label: 'all of src', share: 79.6 },
      { name: 'src/game.js', label: 'src/game.js', share: 55 },
      { name: 'src/npc/mindsHost.js', label: 'src/npc/mindsHost.js', share: 40, host: true },
    ];
    const floors = { all: 80, 'src/game.js': 50, hosts: { 'src/npc/mindsHost.js': 70 } };
    const { failures } = checkShares(shares, floors);
    expect(failures).toHaveLength(2);
    expect(failures[0]).toMatch(/all of src: the smoke run reached 79\.6% of it, under its floor of 80%/);
    expect(failures[0]).toMatch(/tools\/smokeActions\.mjs/);
    expect(failures[1]).toMatch(/src\/npc\/mindsHost\.js: the smoke run reached 40\.0%/);
    expect(checkShares(shares, { ...floors, all: 79 }).failures).toHaveLength(1);
  });

  it('fails a host file that has no floor', () => {
    const shares = [{ name: 'src/world/newHost.js', label: 'src/world/newHost.js', share: 90, host: true }];
    expect(checkShares(shares, { all: 0, 'src/game.js': 0, hosts: {} }).failures[0]).toMatch(/newHost\.js has no floor/);
  });

  it('prints each share beside its floor', () => {
    const { rows } = checkShares([{ name: 'all', label: 'all of src', share: 80.04 }], { all: 78, 'src/game.js': 0, hosts: {} });
    expect(summaryMarkdown(rows)).toContain('| all of src | 80.0% | 78% |');
  });

  it('has a floor for every host file in src, and none for a file that is gone', () => {
    expect(Object.keys(FLOORS.hosts).sort()).toEqual(hostFiles());
    expect(FLOORS.all).toBeGreaterThan(0);
    expect(FLOORS['src/game.js']).toBeGreaterThan(0);
    for (const [file, floor] of Object.entries(FLOORS.hosts)) expect(floor, file).toBeGreaterThan(0);
  });
});

describe('what the smoke test is given to do', () => {
  it('has lists that are not empty, so nothing is covered by running none of it', () => {
    expect(VEHICLE_VERBS.length).toBeGreaterThan(10);
    expect(SCENES.length).toBeGreaterThan(5);
    const actions = girlActions({ companions: [] }).all;
    expect(actions.length).toBeGreaterThan(50);
    expect(new Set(actions.map((a) => a.verb)).size).toBe(actions.length);
  });

  it('leaves out only things that exist, each with a reason', () => {
    for (const v of VEHICLE_VERBS_LEFT_OUT) expect(VEHICLE_VERBS.map((x) => x.name)).toContain(v);
    for (const v of GIRL_ACTIONS_LEFT_OUT) expect(girlActions({ companions: [] }).all.map((a) => a.verb)).toContain(v);
    for (const p of PROMPTS_LEFT_OUT) {
      expect(p.name).toMatch(/^\w+$/);
      expect(p.why.length).toBeGreaterThan(20);
    }
  });
});
