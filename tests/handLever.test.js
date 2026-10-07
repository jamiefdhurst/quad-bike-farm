import { describe, it, expect } from 'vitest';
import { stepHand, HAND_THROTTLE_RATE } from '../src/vehicle/handLever.js';

describe('the hand throttle lever', () => {
  it('moves at its rate while a key is held, and stays put when neither is', () => {
    expect(stepHand(0.2, true, false, 1)).toBeCloseTo(0.2 + HAND_THROTTLE_RATE);
    expect(stepHand(0.5, false, true, 1)).toBeCloseTo(0.5 - HAND_THROTTLE_RATE);
    expect(stepHand(0.5, false, false, 1)).toBe(0.5);
    expect(stepHand(0.5, true, true, 1)).toBe(0.5);
  });

  it('stops at both ends', () => {
    expect(stepHand(0.95, true, false, 1)).toBe(1);
    expect(stepHand(0.05, false, true, 1)).toBe(0);
  });
});
