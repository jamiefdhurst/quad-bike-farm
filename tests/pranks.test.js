import { describe, it, expect } from 'vitest';
import { Pranks, DEFAULT_PRANK_PARAMS as P } from '../src/npc/pranks.js';
import { CHARACTERS } from '../src/npc/characters.js';

const always = () => 0; // dice always say yes, and pick the first of anything

const quad = (o = {}) => ({ id: 'red', x: 50, z: 0, taken: false, running: false, tap: 'on', choke: 0, temperature: 0.8, ...o });
const ctx = (o = {}) => ({
  you: { x: 0, z: 0, riding: null },
  girls: [{ id: 'jess', free: true, mood: 'even' }, { id: 'amy', free: true, mood: 'even' }],
  quads: [quad()],
  items: { can: { x: 0, z: 0, held: false, home: { x: 0, z: 0 } }, toolbox: { x: 0, z: 0, held: true, home: { x: 0, z: 0 } } },
  spots: [{ x: 30, z: 0 }],
  ...o,
});
// Runs until something happens (or gives up), taking the first prank offered each second (as a chooser that always says yes).
function run(pranks, c, seconds = 2000) {
  for (let t = 0; t < seconds; t++) {
    pranks.update(1, c);
    const offer = pranks.offers(c)[0];
    if (offer) return pranks.take(offer).prank;
  }
  return null;
}
const make = (params = {}, random = always) => new Pranks({ ...P, ...params }, random);

describe('pranks', () => {
  it('never plays one on its own: when is the chooser\'s', () => {
    const p = make({ firstDelay: 0, cooldown: 0 });
    for (let t = 0; t < 100; t++) expect(p.update(1, ctx()).filter((e) => e.type === 'start')).toEqual([]);
    expect(p.offers(ctx())[0]).toMatchObject({ key: 'prank', girl: 'jess', kind: 'tap', quad: 'red', weight: P.weight });
  });

  it('waits for the first delay and then the cooldown', () => {
    const p = make({ firstDelay: 100, cooldown: 300 });
    const first = run(p, ctx());
    expect(first).not.toBeNull();
    expect(p.clock).toBeGreaterThanOrEqual(100);
    p.cancel(first);
    const t = p.clock;
    expect(run(p, ctx())).not.toBeNull();
    expect(p.clock - t).toBeGreaterThanOrEqual(295);
  });

  it('never happens with you near the quads, or with you riding', () => {
    const near = ctx({ quads: [quad({ x: 5 })], items: { can: { x: 3, z: 0, held: false, home: { x: 3, z: 0 } }, toolbox: { x: 3, z: 0, held: true, home: { x: 0, z: 0 } } } });
    expect(run(make(), near, 1000)).toBeNull();
  });

  it('Jess turns the tap off on a quad that is on and parked, Amy hides things', () => {
    const jessOnly = ctx({ girls: [{ id: 'jess', free: true, mood: 'even' }], items: { can: { x: 0, z: 0, held: true, home: {} }, toolbox: { x: 0, z: 0, held: true, home: {} } } });
    expect(run(make(), jessOnly)).toMatchObject({ girl: 'jess', kind: 'tap', quad: 'red' });
    const amyOnly = ctx({ girls: [{ id: 'amy', free: true, mood: 'even' }], quads: [], items: { can: { x: 40, z: 0, held: false, home: {} }, toolbox: { x: 0, z: 0, held: true, home: {} } }, spots: [{ x: 10, z: 20 }, { x: 70, z: 0 }] });
    const hide = run(make(), amyOnly);
    expect(hide).toMatchObject({ girl: 'amy', kind: 'hideCan', item: 'can' });
    expect(hide.spot).toEqual({ x: 10, z: 20 }); // not right where you are is checked, and within reach of the can
  });

  it('only puts the choke on a warm engine', () => {
    const cold = ctx({ girls: [{ id: 'jess', free: true, mood: 'even' }], quads: [quad({ tap: 'off', temperature: 0.1 })] });
    expect(run(make(), cold, 1000)).toBeNull();
    const warm = ctx({ girls: [{ id: 'jess', free: true, mood: 'even' }], quads: [quad({ tap: 'off', temperature: 0.9 })] });
    expect(run(make(), warm)).toMatchObject({ kind: 'choke' });
  });

  it('leaves quads someone is on or has running alone', () => {
    const jess = [{ id: 'jess', free: true, mood: 'even' }];
    expect(run(make(), ctx({ girls: jess, quads: [quad({ taken: true })] }), 1000)).toBeNull();
    expect(run(make(), ctx({ girls: jess, quads: [quad({ running: true })] }), 1000)).toBeNull();
  });

  it('a favoured girl never pranks you; a neglected one is keener', () => {
    const jess = (mood) => ctx({ girls: [{ id: 'jess', free: true, mood }], items: { can: { x: 0, z: 0, held: true, home: {} }, toolbox: { x: 0, z: 0, held: true, home: {} } } });
    expect(run(make(), jess('favoured'), 1000)).toBeNull();
    const keen = (mood) => {
      const p = make({ firstDelay: 0, cooldown: 0 });
      p.update(1, jess(mood));
      return p.offers(jess(mood))[0].weight;
    };
    expect(keen('neglected')).toBeGreaterThan(keen('even'));
  });

  it('is found by sitting on the quad, and the culprit owns up once spoken to', () => {
    const p = make({ firstDelay: 0 });
    const c = ctx({ girls: [{ id: 'jess', free: true, mood: 'even' }], items: { can: { x: 0, z: 0, held: true, home: {} }, toolbox: { x: 0, z: 0, held: true, home: {} } } });
    const prank = run(p, c);
    p.apply(prank);
    const off = ctx({ ...c, quads: [quad({ tap: 'off' })], you: { x: 50, z: 0, riding: 'red' } });
    expect(p.update(1, off)).toEqual([]);
    const events = [];
    for (let t = 0; t < 4; t++) events.push(...p.update(1, off));
    expect(events.filter((e) => e.type === 'found')).toHaveLength(1);
    expect(p.unconfessed('jess')).toBe(prank);
    p.confess(prank);
    expect(p.unconfessed('jess')).toBeNull();
  });

  it('a hidden item is noticed gone from its place, put back after a while, and over once you pick it up', () => {
    const p = make({ firstDelay: 0, hideRestoreAfter: 100 });
    const amy = { girls: [{ id: 'amy', free: true, mood: 'even' }], quads: [], spots: [{ x: 10, z: 20 }] };
    const items = (o = {}) => ({ can: { x: 40, z: 0, held: false, home: { x: 40, z: 0 }, ...o }, toolbox: { x: 0, z: 0, held: true, home: {} } });
    const prank = run(p, ctx({ ...amy, items: items() }));
    p.apply(prank);
    const away = ctx({ ...amy, items: items({ x: 10, z: 20 }), you: { x: 0, z: 0, riding: null } });
    expect(p.update(1, away)).toEqual([]);
    const near = ctx({ ...amy, items: items({ x: 10, z: 20 }), you: { x: 38, z: 0, riding: null } });
    expect(p.update(1, near).map((e) => e.type)).toEqual(['found']);
    for (let t = 0; t < 98; t++) p.update(1, away);
    expect(p.update(1, away).map((e) => e.type)).toEqual(['restore', 'resolved']);
    // Picked up instead.
    const q = make({ firstDelay: 0 });
    const hidden = run(q, ctx({ ...amy, items: items() }));
    q.apply(hidden);
    expect(q.update(1, ctx({ ...amy, items: items({ held: true }) })).map((e) => e.type)).toEqual(['resolved']);
  });

  it('lapses if she never gets there', () => {
    const p = make({ firstDelay: 0, sneakGiveUp: 20 });
    const prank = run(p, ctx());
    const c = ctx();
    for (let t = 0; t < 25; t++) p.update(1, c);
    expect(p.active).not.toContain(prank);
  });

  it('gives both girls lines for giving themselves away, none talking about you as he, she or they', () => {
    for (const ch of Object.values(CHARACTERS)) {
      for (const s of ['prankGiggle', 'prankConfess']) {
        const lines = ch.lines[s].lines;
        expect(lines.length, `${ch.id} ${s}`).toBeGreaterThanOrEqual(3);
        for (const l of lines) if (typeof l === 'string') expect(l, l).not.toMatch(/\b(he|she|they)\b|—/i);
      }
    }
  });
});
