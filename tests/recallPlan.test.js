import { describe, it, expect } from 'vitest';
import { recallPlan, strandedOnVehicle, GROUNDED_PLANS } from '../src/npc/recallPlan.js';
import { STATE_WHY } from '../src/npc/availability.js';

// Every state a girl can be in has a first step that gets her down before she walks anywhere: the bug (issue #245) was that the bell
// walked her from the cab's seat (state onTrailer), leaving her parented to the car, floating and going nowhere.
const SEATED = ['seated', 'mounting', 'shuffling', 'dismounting', 'driving', 'boarding', 'onTrailer', 'sliding', 'resting'];

describe('recallPlan', () => {
  it('has a plan for every state she can be in', () => {
    for (const state of Object.keys(STATE_WHY)) expect(typeof recallPlan(state)).toBe('string');
  });
  it('never just walks a girl who is on a seat', () => {
    for (const state of SEATED) expect(GROUNDED_PLANS).not.toContain(recallPlan(state));
  });
  it('gets her down from a cab, the tractor arch or the trailer', () => {
    expect(recallPlan('onTrailer')).toBe('climbDown');
    expect(recallPlan('boarding')).toBe('afterBoarding');
  });
  it('stops a girl who is only walking over to board, and walks the rest', () => {
    expect(recallPlan('walking', 'board')).toBe('abortBoarding');
    expect(recallPlan('walking', 'stand')).toBe('walk');
    expect(recallPlan('idle')).toBe('walk');
  });
  it('pulls up a driving girl and gets a seated one off', () => {
    expect(recallPlan('driving')).toBe('stopDriving');
    expect(recallPlan('seated')).toBe('dismount');
  });
});

describe('strandedOnVehicle', () => {
  it('catches a girl stood or walking while parented to a vehicle', () => {
    expect(strandedOnVehicle('walking', false)).toBe(true);
    expect(strandedOnVehicle('idle', false)).toBe(true);
  });
  it('leaves girls on the ground, and on seats, alone', () => {
    expect(strandedOnVehicle('walking', true)).toBe(false);
    expect(strandedOnVehicle('onTrailer', false)).toBe(false);
    expect(strandedOnVehicle('seated', false)).toBe(false);
  });
});
