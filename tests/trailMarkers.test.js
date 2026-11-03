import { describe, it, expect } from 'vitest';
import { POST_BAND, DISC_RADIUS } from '../src/world/trailProps.js';

describe('the Fern Trail way-markers', () => {
  it('keep the arrow disc inside the post, not hanging off its edges', () => {
    expect(DISC_RADIUS * 2).toBeLessThan(POST_BAND);
  });
});
