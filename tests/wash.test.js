import { describe, it, expect } from 'vitest';
import { createMudState, washMud, updateMudBuildUp } from '../src/effects/mudBuildUp.js';
import { DEFAULT_MUD_PARAMS } from '../src/effects/quadMud.js';

describe('washing the mud off', () => {
  it('takes the wheels off quickest and the bodywork steadily, leaving it wet and shiny', () => {
    const s = { ...createMudState(), body: 0.8, wheels: 1, wet: 0 };
    washMud(s, 1, DEFAULT_MUD_PARAMS);
    expect(s.wheels).toBeLessThan(s.body + 0.2);
    expect(s.body).toBeLessThan(0.8);
    expect(s.washed).toBe(1);
    for (let i = 0; i < 10; i++) washMud(s, 1, DEFAULT_MUD_PARAMS);
    expect(s.body).toBe(0);
    expect(s.wheels).toBe(0);
  });

  it('dries off after a while', () => {
    const s = { ...createMudState(), washed: 1 };
    for (let i = 0; i < DEFAULT_MUD_PARAMS.washDryTime * 2; i++) updateMudBuildUp(s, 1, [], 0, 0, DEFAULT_MUD_PARAMS);
    expect(s.washed).toBe(0);
  });
});
