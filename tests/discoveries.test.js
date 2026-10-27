import { describe, it, expect } from 'vitest';
import { Discoveries, DISCOVERIES, stallDiscovery, prankDiscovery } from '../src/achievements/discoveries.js';
import { paginate } from '../src/achievements/pages.js';
import { PRANKSTERS } from '../src/npc/pranks.js';

describe('things I\'ve learnt', () => {
  it('writes a thing down once, and says so only the first time', () => {
    const d = new Discoveries();
    const heard = [];
    d.onLearn((x) => heard.push(x.id));
    expect(d.learn('reserve')).toBe(true);
    expect(d.learn('reserve')).toBe(false);
    expect(d.learn('not-a-thing')).toBe(false);
    expect(heard).toEqual(['reserve']);
  });

  it('shows what is not learnt yet as ??? with a nudge, and what is as the full line', () => {
    const d = new Discoveries();
    d.learn('chokeFlood');
    const [first, second] = d.entries();
    expect(first.name).toBe(DISCOVERIES[0].text);
    expect(first.hint).toBe('');
    expect(second.name).toBe('???');
    expect(second.hint).toBe(DISCOVERIES[1].hint);
    expect(d.score()).toEqual({ count: 1, totalCount: DISCOVERIES.length });
  });

  it('keeps what it learnt, quietly, and drops ids no longer on the list', () => {
    const a = new Discoveries();
    a.learn('flood');
    a.learn('wax');
    const b = new Discoveries();
    let heard = 0;
    b.onLearn(() => heard++);
    b.restore([...a.toJSON(), 'not-a-thing']);
    expect(b.toJSON().sort()).toEqual(['flood', 'wax']);
    expect(heard).toBe(0);
    b.restore(undefined);
    expect(b.toJSON()).toHaveLength(2);
  });

  it('has unique ids, no em dashes, and a hint that does not give the answer away', () => {
    expect(new Set(DISCOVERIES.map((d) => d.id)).size).toBe(DISCOVERIES.length);
    for (const d of DISCOVERIES) {
      expect(d.text + d.hint).not.toContain('—');
      expect(d.hint.length).toBeGreaterThan(0);
    }
  });

  it('lays out on notebook pages with every line kept once', () => {
    const entries = new Discoveries().entries();
    const pages = paginate(entries, 7);
    for (const p of pages) expect(p.lines.length).toBeLessThanOrEqual(7);
    expect(pages.flatMap((p) => p.lines.filter((l) => l.entry).map((l) => l.entry.id))).toEqual(entries.map((e) => e.id));
  });

  it('turns a stall into the lesson, with the choke deciding which kind of flood', () => {
    expect(stallDiscovery('flooded', 1)).toBe('chokeFlood');
    expect(stallDiscovery('flooded', 0)).toBe('flood');
    expect(stallDiscovery('noFuel')).toBe('reserve');
    expect(stallDiscovery('lowRpm')).toBeNull();
    expect(stallDiscovery('runOn')).toBeNull();
    const ids = new Set(DISCOVERIES.map((d) => d.id));
    for (const reason of ['noFuel', 'battery', 'overheated', 'seized', 'water', 'fuelWater', 'wax']) expect(ids.has(stallDiscovery(reason))).toBe(true);
  });

  it('has a lesson for every prank each girl can play', () => {
    const ids = new Set(DISCOVERIES.map((d) => d.id));
    for (const [girl, kinds] of Object.entries(PRANKSTERS)) for (const kind of kinds) expect(ids.has(prankDiscovery({ girl, kind }))).toBe(true);
  });
});
