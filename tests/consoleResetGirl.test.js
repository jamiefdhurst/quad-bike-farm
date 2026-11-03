import { describe, it, expect } from 'vitest';
import { createHost } from '../src/console/gameHost.js';

// A stand-in game with one girl, enough for createHost to build and for `reset` to reach her.
const standIn = () => {
  const calls = [];
  const amy = { character: { id: 'amy' }, name: 'Amy', root: { position: { x: 3, z: 4 } }, heading: 1, params: { settleSeconds: 60 } };
  const g = {
    units: [],
    companions: [amy],
    world: { heightAt: () => 0, layout: {} },
    settleGirl: (c) => calls.push(c.character.id),
  };
  return { host: createHost(g), calls };
};

describe('reset a girl', () => {
  it('stops her where she is rather than only moving her, so a girl driving or sat on a quad is not left busy', () => {
    const { host, calls } = standIn();
    expect(host.resetThing('amy')).toBe('Amy stops and stands about (60 s) ready for the next thing');
    expect(calls).toEqual(['amy']);
  });
});
