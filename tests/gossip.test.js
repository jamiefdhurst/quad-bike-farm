import { describe, it, expect } from 'vitest';
import { GOSSIP_BANTER } from '../src/npc/gossipLines.js';
import { Gossip, DEFAULT_GOSSIP_PARAMS } from '../src/npc/gossip.js';

const exchanges = [{ when: 'gossip', lines: [['jess', 'one'], ['amy', 'two'], ['jess', 'three']] }];
const girls = [
  { id: 'amy', x: 0, z: 0, free: true },
  { id: 'jess', x: 2, z: 0, free: true },
];
const ctx = (over = {}) => ({ you: { x: 10, z: 0, onFoot: true, speed: 1.5 }, girls, loud: false, floorFree: true, ...over });
const make = () => new Gossip(exchanges, { ...DEFAULT_GOSSIP_PARAMS, startAfter: 0, chance: 1000 }, () => 0);

function run(g, seconds, c, said, cuts) {
  const out = [];
  for (let t = 0; t < seconds; t += 0.25) {
    out.push(...g.update(0.25, c, (who, text) => (said.push(who + ':' + text), 1), () => cuts.push(1)));
  }
  return out;
}

describe('gossip', () => {
  it('plays an exchange when you creep into earshot, once settled', () => {
    const g = make();
    const said = [];
    run(g, 1, ctx(), said, []);
    expect(said).toEqual([]); // not settled yet
    run(g, 12, ctx(), said, []);
    expect(said).toEqual(['jess:one', 'amy:two', 'jess:three']);
  });

  it('says nothing when you are too far, too near, running, or the engine is going', () => {
    for (const over of [{ you: { x: 40, z: 0, onFoot: true, speed: 1 } }, { you: { x: 4, z: 0, onFoot: true, speed: 1 } }, { you: { x: 10, z: 0, onFoot: true, speed: 4.4 } }, { loud: true }, { you: { x: 10, z: 0, onFoot: false, speed: 1 } }]) {
      const g = make();
      const said = [];
      run(g, 10, ctx(over), said, []);
      expect(said).toEqual([]);
    }
  });

  it('stops dead when you come too close, then the other girl covers for it', () => {
    const g = make();
    const said = [];
    const cuts = [];
    run(g, 3.5, ctx(), said, cuts);
    expect(said.length).toBeGreaterThan(0);
    const events = run(g, 3, ctx({ you: { x: 3, z: 0, onFoot: true, speed: 1.5 } }), said, cuts);
    expect(cuts.length).toBe(1);
    expect(said.length).toBeLessThan(3);
    const last = said[said.length - 1].split(':')[0];
    expect(events).toEqual([{ type: 'caught', girl: last === 'jess' ? 'amy' : 'jess' }]);
  });

  it('stays quiet afterwards for the cooldown, and uses every exchange before repeating', () => {
    const g = make();
    const said = [];
    run(g, 15, ctx(), said, []);
    const n = said.length;
    run(g, 60, ctx(), said, []);
    expect(said.length).toBe(n);
    run(g, DEFAULT_GOSSIP_PARAMS.cooldown + 20, ctx(), said, []);
    expect(said.length).toBe(n * 2);
  });

  it('gives up quietly if one of them goes off', () => {
    const g = make();
    const said = [];
    const cuts = [];
    run(g, 3.5, ctx(), said, cuts);
    const events = run(g, 3, ctx({ girls: [girls[0], { ...girls[1], free: false }] }), said, cuts);
    expect(events).toEqual([]);
    expect(g.busy).toBe(false);
  });

  it('never calls you he, she or they', () => {
    for (const e of GOSSIP_BANTER) for (const [, text] of e.lines) expect(text).not.toMatch(/\b(he|she|they|him|her)\b/i);
  });
});
