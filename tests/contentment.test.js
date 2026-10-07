import { describe, it, expect } from 'vitest';
import { Contentment } from '../src/npc/contentment.js';
import { DEFAULT_COMPANION_PARAMS as P } from '../src/npc/companionParams.js';
import { pickBoredChoice } from '../src/npc/boredom.js';
import { AMY_CONTENT_LINES, JESS_CONTENT_LINES } from '../src/npc/contentLines.js';
import { VOICE_LINES } from '../src/npc/voiceLines.js';
import { CHARACTERS } from '../src/npc/characters.js';

describe('liking them running', () => {
  it('her mood follows the share of quads running, rising faster than it falls', () => {
    const c = new Contentment();
    for (let i = 0; i < 100; i++) c.update(0.1, 1, P);
    expect(c.joy).toBeGreaterThan(0.7);
    const high = c.joy;
    c.update(5, 0, P);
    expect(c.joy).toBeLessThan(high);
    expect(c.joy).toBeGreaterThan(high * 0.5);
  });

  it('a stall dampens her, more if it was under her, and she gets over it', () => {
    const a = new Contentment();
    const b = new Contentment();
    a.stalled(false, P);
    b.stalled(true, P);
    expect(b.sad).toBeGreaterThan(a.sad);
    expect(a.sad).toBeGreaterThan(0);
    a.update(1000, 1, P);
    expect(a.sad).toBe(0);
    b.stalled(true, P);
    b.stalled(true, P);
    expect(b.sad).toBeLessThanOrEqual(1);
  });

  it('she is keener to start a quad the fewer are running, and slower to switch one off the happier she is', () => {
    const c = new Contentment();
    c.update(0.1, 0, P);
    const none = c.startUrge(P);
    c.update(0.1, 1, P);
    expect(c.startUrge(P)).toBeLessThan(none);
    expect(c.startUrge(P)).toBe(1);
    c.joy = 1;
    expect(c.keyOffFactor(P)).toBeCloseTo(1 - P.keyOffCut);
    c.joy = 0;
    expect(c.keyOffFactor(P)).toBe(1);
  });

  it('the bored choice weights starting by her urge', () => {
    const count = (urge) => {
      let n = 0;
      let i = 0;
      const random = () => ((i++ * 0.61803398875) % 1);
      for (let k = 0; k < 400; k++) if (pickBoredChoice({ ...P, boredWhim: 0 }, { can: { start: true, mount: true }, startUrge: urge }, random) === 'start') n++;
      return n;
    };
    expect(count(3)).toBeGreaterThan(count(1));
  });
});

describe('the seat buzz', () => {
  it('only shake above her level counts, and a harder shake counts for more up to a cap', () => {
    const c = new Contentment();
    c.feel(10, 'red', P.buzzFrom - 0.1, P);
    expect(c.buzz.red).toBeUndefined();
    c.feel(10, 'red', P.buzzFrom, P);
    c.feel(10, 'yellow', 1, P);
    c.feel(10, 'green', 99, P);
    expect(c.buzz.yellow).toBeGreaterThan(c.buzz.red);
    expect(c.buzz.green).toBe(10 * P.buzzCap);
  });

  it('her favourite moves to the quad that shakes her most, once it leads by enough', () => {
    const c = new Contentment();
    c.buzz = { red: 50, yellow: 60 };
    expect(c.favourite('red', P)).toBe('red');
    c.buzz.yellow = 50 + P.buzzSwitchLead;
    expect(c.favourite('red', P)).toBe('yellow');
    expect(c.favourite('red', P, (id) => id !== 'yellow')).toBe('red');
    expect(new Contentment().favourite('red', P)).toBe('red');
  });

  it('she says so once she has enjoyed it for long enough', () => {
    const c = new Contentment();
    expect(c.enjoyed('red', P)).toBe(false);
    c.feel(P.buzzSaysAfter, 'red', 1, P);
    expect(c.enjoyed('red', P)).toBe(true);
  });
});

describe('lines', () => {
  it('both girls have every new situation, in the main banks', () => {
    for (const k of Object.keys(AMY_CONTENT_LINES)) {
      expect(JESS_CONTENT_LINES[k]?.length).toBeGreaterThan(0);
      expect(VOICE_LINES[k]).toBeDefined();
    }
    expect(Object.keys(JESS_CONTENT_LINES).sort()).toEqual(Object.keys(AMY_CONTENT_LINES).sort());
  });

  it('Amy sits side-saddle more than Jess', () => {
    const chance = (id) => ({ ...P, ...CHARACTERS.find((c) => c.id === id).params }).sideSaddleChance;
    expect(chance('amy')).toBeGreaterThan(chance('jess'));
  });
});
