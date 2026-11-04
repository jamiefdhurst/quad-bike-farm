import { describe, it, expect } from 'vitest';
import { DEFAULT_MUDDY_PARAMS as P, createMuddiness, updateMuddiness, noticing, markRemarked, cleanUp } from '../src/npc/muddiness.js';

const muddyQuad = (over = {}) => ({ pillion: true, wheels: 1, body: 1, speed: 9, puddle: 0, dust: 0, ...over });
const run = (s, secs, ctx) => {
  for (let t = 0; t < secs; t += 0.5) updateMuddiness(s, 0.5, ctx, P);
  return s;
};

describe('how muddy a girl is', () => {
  it('starts clean and stays clean on a clean quad', () => {
    const s = run(createMuddiness(), 60, { ride: muddyQuad({ wheels: 0, body: 0 }) });
    expect(s.mud).toBe(0);
  });

  it('gets muddy on a muddy quad, the pillion more than the rider', () => {
    const back = run(createMuddiness(), 30, { ride: muddyQuad() });
    const front = run(createMuddiness(), 30, { ride: muddyQuad({ pillion: false }) });
    expect(back.mud).toBeGreaterThan(0.3);
    expect(front.mud).toBeGreaterThan(0);
    expect(back.mud).toBeGreaterThan(front.mud * 1.5);
    expect(back.wet).toBeGreaterThan(0.5);
  });

  it('gets nothing when the quad is standing still, and more through puddles', () => {
    expect(run(createMuddiness(), 30, { ride: muddyQuad({ speed: 0 }) }).mud).toBe(0);
    const dry = run(createMuddiness(), 10, { ride: muddyQuad() });
    const splashed = run(createMuddiness(), 10, { ride: muddyQuad({ puddle: 1 }) });
    expect(splashed.mud).toBeGreaterThan(dry.mud);
  });

  it('takes dust in a cloud and loses it out of one', () => {
    const s = run(createMuddiness(), 20, { ride: muddyQuad({ wheels: 0, body: 0, dust: 1 }) });
    expect(s.dust).toBeGreaterThan(0.4);
    const before = s.dust;
    run(s, 20, { ride: null, walking: true });
    expect(s.dust).toBeLessThan(before);
  });

  it('dries and brushes off slowly, quicker on her feet', () => {
    const a = run(createMuddiness(), 20, { ride: muddyQuad() });
    const b = { ...a };
    run(a, P.dryTime + 100, { ride: null, walking: false });
    run(b, P.dryTime + 100, { ride: null, walking: true });
    expect(b.mud).toBeLessThan(a.mud);
    expect(a.mud).toBeGreaterThan(0);
  });

  it('wet mud stays on her until it has dried', () => {
    const s = createMuddiness();
    s.mud = 0.6;
    s.wet = 1;
    run(s, 5, { ride: null, walking: true });
    expect(s.mud).toBeGreaterThan(0.595);
  });

  it('comes off quickest with the hose, and leaves her wet', () => {
    const s = createMuddiness();
    s.mud = 0.8;
    s.dust = 0.8;
    run(s, 3, { ride: null, hosed: 1 });
    expect(s.mud).toBeLessThan(0.1);
    expect(s.dust).toBe(0);
    expect(s.wet).toBe(1);
  });

  it('notices once, then again only after she has been clean and the gap has passed', () => {
    const s = createMuddiness();
    expect(noticing(s, P)).toBeNull();
    s.mud = 0.5;
    expect(noticing(s, P)).toBe('mud');
    markRemarked(s, 'mud', P);
    expect(noticing(s, P)).toBeNull();
    s.sinceRemark = P.remarkGap + 1;
    expect(noticing(s, P)).toBeNull(); // still the same mud
    s.mud = 0;
    updateMuddiness(s, 0.1, { ride: null }, P);
    s.mud = 0.5;
    expect(noticing(s, P)).toBe('mud'); // clean in between, so it is news again
  });

  it('does not remark twice in quick succession', () => {
    const s = createMuddiness();
    s.mud = 0.5;
    s.dust = 0.9;
    markRemarked(s, noticing(s, P), P);
    expect(noticing(s, P)).toBeNull();
    s.sinceRemark = P.remarkGap;
    expect(noticing(s, P)).toBe('dust');
  });

  it('cleanUp puts her right', () => {
    const s = createMuddiness();
    s.mud = s.dust = s.wet = 1;
    cleanUp(s);
    expect([s.mud, s.dust, s.wet]).toEqual([0, 0, 0]);
  });
});

describe('what takes mud on her', () => {
  it('gives the wellies and the cloth the look, and leaves the small parts clean', async () => {
    const { mudKindOfPart } = await import('../src/effects/girlMud.js');
    expect(mudKindOfPart('leftWelly', false)).toBe('welly');
    expect(mudKindOfPart('rightWellyFoot', false)).toBe('welly');
    for (const n of ['polo', 'jumper', 'shorts', 'coat', 'plaid', 'cropTop']) expect(mudKindOfPart(n, true)).toBe('cloth');
    for (const n of ['poloPlacket', 'plaidButtons', 'poloLogo', 'tie', 'poloVee', 'cropGroove']) expect(mudKindOfPart(n, true)).toBeNull();
    expect(mudKindOfPart('ponytail', false)).toBeNull();
  });
});
