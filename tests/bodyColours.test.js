import { describe, it, expect } from 'vitest';
import { bodyColours } from '../src/npc/outfit.js';

// The paint on her body under her top: where her body comes through every layer (her armpits), it should look like the outer one.

const colors = { shirt: '#d9661f', skin: '#e0b090' };
const plaid = ['#1e3d2a', '#14213a', '#c9b45a'];

describe("her body's paint under her top", () => {
  it("is a buttoned plaid's ground, over a polo or not, so the polo's colour doesn't show at her armpits", () => {
    expect(bodyColours({ colors, polo: '#d9661f', style: { kind: 'plaid', plaid, plaidOpen: false } }).shirt).toBe(plaid[0]);
    expect(bodyColours({ colors, style: { kind: 'plaid', plaid, plaidOpen: false } }).shirt).toBe(plaid[0]);
  });

  it("stays her polo's colour under an open plaid, where the polo shows down the front", () => {
    expect(bodyColours({ colors, polo: '#d9661f', style: { kind: 'plaid', plaid, plaidOpen: true } }).shirt).toBe('#d9661f');
  });
});
