import { describe, it, expect } from 'vitest';
import { AudioHub } from '../src/audio/engineAudio.js';

const fakeCtx = (state) => ({ state, suspended: 0, resumed: 0, suspend() { this.suspended++; this.state = 'suspended'; }, resume() { this.resumed++; this.state = 'running'; } });

describe('AudioHub pausing', () => {
  it('does not suspend the sound again while the card the click unlocked it from is still up', () => {
    const hub = new AudioHub();
    hub.ctx = fakeCtx('suspended');
    hub.unlock();
    expect(hub.ctx.state).toBe('running');
    hub.setPaused(true); // next frame: the card is still up, waiting for the pointer lock
    expect(hub.ctx.suspended).toBe(0);
    hub.setPaused(false); // locked: the game begins
    expect(hub.ctx.state).toBe('running');
  });

  it('suspends for a pause once the game has been played, and resumes after', () => {
    const hub = new AudioHub();
    hub.ctx = fakeCtx('running');
    hub.setPaused(false);
    hub.setPaused(true);
    expect(hub.ctx.state).toBe('suspended');
    hub.setPaused(false);
    expect(hub.ctx.state).toBe('running');
  });
});
