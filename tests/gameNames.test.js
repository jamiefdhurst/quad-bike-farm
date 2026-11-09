import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { namesAskedOfGame, readGameNames } from './helpers/gameNames.js';

// Files where `g` is not the game, with why. The game's own `g` is a parameter or `this.g` in a host, and the debug and console code is handed it.
const LEFT_OUT = {
  'vehicle/quadLoad.js': '`g` is the ramp\'s geometry (footZ, rearZ, bedY)',
  'debug/tuneCategories.js': '`g` is a group of tuning values',
};

const SRC = `${resolve('src')}/`;
const sourceFiles = () => readdirSync(SRC, { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => join(SRC, f));
// Where a parameter called `g` or `game` is the game: the hosts, and the debug and console code that is handed it. Elsewhere `g` is a colour, a context, a geometry.
const paramsAreGame = (f) => /Host\.js$/.test(f) || /^(debug|console)\//.test(f);

describe('names asked of the game', () => {
  const fixture = resolve('tests/fixtures/gameNames.js');

  it('reads what the game gives and what is asked of it', () => {
    const { provides, asks } = readGameNames(readFileSync(fixture, 'utf8'));
    expect([...provides].sort()).toEqual(['count', 'farm', 'hud', 'init', 'paused', 'set', 'setFromAssign', 'showForced', 'toast']);
    expect([...new Set(asks.map((a) => a.name))].sort()).toEqual(
      ['alsoGone', 'arrowGhost', 'farm', 'ghostField', 'hud', 'neverSet', 'paused', 'renamedAway', 'setFromAssign', 'showForced', 'toast', 'useThis', 'vanished'],
    );
  });

  it('finds a name nothing gives the game, however it was asked', () => {
    expect(namesAskedOfGame([fixture], { gameFile: fixture }).map((a) => a.name).sort()).toEqual(
      ['alsoGone', 'arrowGhost', 'ghostField', 'neverSet', 'renamedAway', 'useThis', 'vanished'],
    );
  });

  it('are none in src, so a method renamed or moved fails here and not only when the line runs', () => {
    const found = namesAskedOfGame(sourceFiles(), { leftOut: LEFT_OUT, root: SRC, paramsAreGame });
    expect(found.map((a) => `${a.file}:${a.line} ${a.name}`)).toEqual([]);
  }, 120000);

  it('says why each file is left out, and that file exists', () => {
    const have = new Set(sourceFiles().map((f) => f.slice(SRC.length)));
    for (const [file, why] of Object.entries(LEFT_OUT)) {
      expect(have.has(file), file).toBe(true);
      expect(why.length, file).toBeGreaterThan(10);
    }
  });
});
