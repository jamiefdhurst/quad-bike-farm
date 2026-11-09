import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { undefinedNames } from './helpers/undefinedNames.js';

// The few names the game's code gets from outside the page: what an audio worklet is given, and what Vite writes in at build time.
const KNOWN = {
  'audio/engineWorklet.js': ['sampleRate', 'currentFrame', 'AudioWorkletProcessor', 'registerProcessor'],
  'faq/faq.js': ['__GIT_LOG__'],
  'start/startScreen.js': ['__GIT_LOG_HASHES__', '__FAQ_TIPS__'],
};

const SRC = `${resolve('src')}/`;
const sourceFiles = () => readdirSync(SRC, { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => join(SRC, f));

describe('undefined names', () => {
  it('finds a name nothing declares, and leaves out comments and what it is told is known', () => {
    const fixture = resolve('tests/fixtures/undefinedName.js');
    expect(undefinedNames([fixture]).map((n) => n.name).sort()).toEqual(['ALLOWED_NAME', 'GHOST_NAME']);
    expect(undefinedNames([fixture], { known: { [fixture]: ['ALLOWED_NAME'] } }).map((n) => n.name)).toEqual(['GHOST_NAME']);
  });

  it('are none in src, so a line left behind by a move fails here and not only when it runs', () => {
    expect(undefinedNames(sourceFiles(), { known: KNOWN, root: SRC })).toEqual([]);
  }, 120000);
});
