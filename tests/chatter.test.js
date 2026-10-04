import { describe, it, expect } from 'vitest';
import { Chatter } from '../src/npc/chatter.js';
import { VOICE_LINES } from '../src/npc/voiceLines.js';

function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LINES = {
  rough: { cooldown: 10, lines: ['a', 'b', 'c', 'd'] },
  fast: { cooldown: 10, lines: ['x', 'y'] },
  ack: { cooldown: 0, lines: ['ok'] },
};

describe('chatter', () => {
  it('keeps quiet for the gap after speaking', () => {
    const c = new Chatter(LINES, { random: seededRandom(1), minGap: 6 });
    expect(c.pick('rough')).not.toBeNull();
    c.update(3);
    expect(c.pick('fast')).toBeNull();
    c.update(3.1);
    expect(c.pick('fast')).not.toBeNull();
  });

  it('waits out a situation’s cooldown', () => {
    const c = new Chatter(LINES, { random: seededRandom(2), minGap: 1 });
    c.pick('rough');
    c.update(5);
    expect(c.pick('rough')).toBeNull();
    c.update(5.1);
    expect(c.pick('rough')).not.toBeNull();
  });

  it('always answers when asked, even mid-gap', () => {
    const c = new Chatter(LINES, { random: seededRandom(3), minGap: 6 });
    c.pick('rough');
    expect(c.pick('ack', { force: true })).toBe('ok');
  });

  it('does not repeat a line until about half the others have been used', () => {
    const c = new Chatter(LINES, { random: seededRandom(4), minGap: 0 });
    const picks = [];
    for (let i = 0; i < 40; i++) {
      c.update(11);
      picks.push(c.pick('rough'));
    }
    for (let i = 1; i < picks.length; i++) {
      expect(picks[i]).not.toBe(picks[i - 1]);
      if (i > 1) expect(picks[i]).not.toBe(picks[i - 2]);
    }
    expect(new Set(picks).size).toBe(4);
  });

  it('reacts straight after a line has finished, without the quiet gap', () => {
    const c = new Chatter(LINES, { random: seededRandom(6), minGap: 6 });
    c.pick('rough');
    c.holdFor(2);
    c.update(1);
    expect(c.pick('fast', { urgent: true })).toBeNull(); // still talking
    c.update(1.1);
    expect(c.pick('fast', { urgent: true })).not.toBeNull();
  });

  it('says nothing unprompted with chattiness at zero', () => {
    const c = new Chatter(LINES, { random: seededRandom(5), chattiness: 0 });
    expect(c.pick('rough')).toBeNull();
    expect(c.pick('ack', { force: true })).toBe('ok');
  });

  it('every situation has lines that are text or a known sound', () => {
    const sounds = ['sigh', 'hmm', 'laugh', 'yawn', 'hum', 'gasp', 'oh'];
    for (const [name, entry] of Object.entries(VOICE_LINES)) {
      expect(entry.lines.length, name).toBeGreaterThan(0);
      for (const line of entry.lines) {
        if (typeof line === 'string') expect(line.length).toBeGreaterThan(0);
        else expect(sounds).toContain(line.sound);
      }
    }
  });
});
