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

  it('is an open plaid\'s ground too: the polo down her front covers her body there, and at her arms the plaid does', () => {
    expect(bodyColours({ colors, polo: '#d9661f', style: { kind: 'plaid', plaid, plaidOpen: true } }).shirt).toBe(plaid[0]);
  });

  it("is the second polo's colour, and the shirt's under a shirt and tie, polo under it or not", () => {
    expect(bodyColours({ colors, polo: '#d9661f', style: { kind: 'doublePolo', over: '#111111' } }).shirt).toBe('#111111');
    expect(bodyColours({ colors, polo: '#d9661f', style: { kind: 'shirtTie', shirt: '#dfe8f2', shirtOverPolo: true } }).shirt).toBe('#dfe8f2');
    expect(bodyColours({ colors, style: { kind: 'shirtTie', shirt: '#dfe8f2' } }).shirt).toBe('#dfe8f2');
  });

  it("is her polo's colour in just her polo", () => {
    expect(bodyColours({ colors, polo: '#d9661f', style: { kind: 'polo' } }).shirt).toBe('#d9661f');
  });
});
