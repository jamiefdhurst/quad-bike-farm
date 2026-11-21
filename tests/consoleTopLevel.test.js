import { describe, it, expect } from 'vitest';
import { buildGameTree } from '../src/console/gameTree.js';

// The console's top level is meant to be `vehicle`, `girl`, `farm`, `you` and `tune` and nothing else (.claude/rules/debug-panel.md).
// Until #412 moves the rest under `farm` and `you`, this holds it where it is, so a new folder goes inside one rather than beside them.
// #412 shrinks this list; nothing else adds to it.
const WAITING_FOR_412 = [
  'girls', 'player', 'weather', 'wildlife', 'cat', 'dog', 'fence', 'lane', 'road', 'neighbour', 'river', 'pit', 'village', 'mot',
  'generator', 'lying', 'boosterPack', 'spares', 'photos', 'waving', 'towRope', 'lens', 'kit', 'audio',
];
const MEANT = ['vehicle', 'girl', 'farm', 'you', 'tune'];

describe('the console\'s top level', () => {
  it('has nothing new beside vehicle, girl, farm, you and tune: put it inside farm, or you', () => {
    const top = Object.keys(buildGameTree({ units: [], companions: [], weather: {} }, {}).children());
    const allowed = new Set([...MEANT, ...WAITING_FOR_412]);
    expect(top.filter((k) => !allowed.has(k))).toEqual([]);
  });

  it('lists nothing as waiting that is already gone, so the list only shrinks', () => {
    const top = new Set(Object.keys(buildGameTree({ units: [], companions: [], weather: {} }, {}).children()));
    expect(WAITING_FOR_412.filter((k) => !top.has(k))).toEqual([]);
  });
});
