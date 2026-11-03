import { describe, it, expect } from 'vitest';
import { Settled } from '../src/npc/settled.js';

describe('a girl told to stop', () => {
  it('stands about for the time given, then gets her own mind back as it was', () => {
    const s = new Settled();
    s.start(60, true);
    expect(s.step(30)).toBeNull();
    expect(s.step(29)).toBeNull();
    expect(s.step(2)).toEqual({ ownMind: true });
    expect(s.step(1)).toBeNull();
  });

  it('keeps an own mind that was already off off, even if told to stop twice', () => {
    const s = new Settled();
    s.start(10, false);
    s.start(10, false); // the second time her mind is already held off, so it must not remember that as the original
    expect(s.step(11)).toEqual({ ownMind: false });
    const t = new Settled();
    t.start(10, true);
    t.start(10, false);
    expect(t.step(11)).toEqual({ ownMind: true });
  });

  it('starts the wait over when told to stop again', () => {
    const s = new Settled();
    s.start(10, true);
    s.step(8);
    s.start(10, false);
    expect(s.step(8)).toBeNull();
    expect(s.step(3)).toEqual({ ownMind: true });
  });
});
