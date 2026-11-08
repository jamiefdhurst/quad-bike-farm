import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// game.js only gets smaller (#126): a part of the game goes out to a host of its own, and this number is lowered to match. Raising it
// means a new feature belongs in a module instead.
const MAX_LINES = 13271;

describe('game.js', () => {
  it('has not grown past its ceiling', () => {
    const lines = readFileSync(new URL('../src/game.js', import.meta.url), 'utf8').split('\n').length;
    expect(lines).toBeLessThanOrEqual(MAX_LINES);
  });
});
