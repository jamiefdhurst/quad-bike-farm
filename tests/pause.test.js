import { describe, it, expect } from 'vitest';
import { overlayPauses } from '../src/core/pause.js';

describe('pausing behind the start card', () => {
  it('pauses while the card is up', () => {
    expect(overlayPauses([])).toBe(true);
  });

  it('runs once you are playing', () => {
    expect(overlayPauses(['hidden'])).toBe(false);
  });

  it('keeps running under the tuning panel, the console hint and the toolbox', () => {
    expect(overlayPauses(['tuning'])).toBe(false);
    expect(overlayPauses(['workshop'])).toBe(false);
  });

  it('runs when a script has hidden the overlay by hand', () => {
    expect(overlayPauses([], 'none')).toBe(false);
  });
});
