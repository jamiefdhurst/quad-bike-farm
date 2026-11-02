import { describe, it, expect } from 'vitest';
import { buildGameTree } from '../src/console/gameTree.js';

// The tree is built from thunks, so a bare stand-in game is enough to see where each path lives.
const rootOf = () => buildGameTree({ units: [], companions: [], weather: { snow: 0.2, cover: 0.4 } }, {}).children();

describe('the console tree', () => {
  it('has the snow settings under weather, where the docs and testing issues say they are', () => {
    const weather = rootOf().weather.children();
    expect(weather.snow.get()).toBe(0.2);
    expect(weather.snowCover.get()).toBe(0.4);
  });
});
