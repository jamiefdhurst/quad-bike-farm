import { describe, it, expect } from 'vitest';
import { Bag, Programme, STATIONS, shares, nextStationId, stationById } from '../src/audio/radioStation.js';
import { createRandom } from '../src/core/random.js';

const lib = () => ({
  music: Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, seconds: 100 + i * 10 })),
  talk: ['ident', 'link', 'news', 'weather', 'farming', 'phonein', 'traffic'].flatMap((kind) =>
    Array.from({ length: 5 }, (_, i) => ({ id: `${kind}${i}`, kind, seconds: 10 + i })),
  ),
});

describe('the stations', () => {
  it('step round and come back to the first', () => {
    let id = STATIONS[0].id;
    const seen = [];
    for (let i = 0; i < STATIONS.length; i++) {
      seen.push(id);
      id = nextStationId(id);
    }
    expect(new Set(seen).size).toBe(STATIONS.length);
    expect(id).toBe(STATIONS[0].id);
    expect(stationById('nonsense').id).toBe(STATIONS[0].id);
  });

  it('are two, an easy one and a rock one', () => {
    expect(STATIONS.map((s) => s.id)).toEqual(['dale', 'quarry']);
  });
});

describe('a shuffled bag', () => {
  it('plays every item once a lap', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const bag = new Bag(items, createRandom(1), 2);
    const lap = Array.from({ length: 5 }, () => bag.next());
    expect([...lap].sort()).toEqual(items);
  });

  it('does not repeat one of the last few at the start of the next lap', () => {
    for (let seed = 1; seed < 60; seed++) {
      const bag = new Bag(['a', 'b', 'c', 'd', 'e', 'f'], createRandom(seed), 3);
      const run = Array.from({ length: 36 }, () => bag.next());
      for (let i = 6; i < run.length; i++) expect(run.slice(Math.max(0, i - 3), i)).not.toContain(run[i]);
    }
  });

  it('gives null from an empty bag', () => {
    expect(new Bag([], createRandom(1)).next()).toBeNull();
  });
});

describe('a programme', () => {
  it('is the same every time for a station, and runs on without gaps in its plan', () => {
    const a = new Programme(STATIONS[0], lib());
    const b = new Programme(STATIONS[0], lib());
    expect(a.between(0, 3000).map((s) => s.item.id)).toEqual(b.between(0, 3000).map((s) => s.item.id));
    const slots = a.between(0, 3000);
    for (let i = 1; i < slots.length; i++) expect(slots[i].start).toBeGreaterThanOrEqual(slots[i - 1].end);
    expect(slots[0].start).toBe(0);
  });

  it('is a different running order on each station', () => {
    const a = new Programme(STATIONS[0], lib()).between(0, 2000).map((s) => s.item.id);
    const b = new Programme(STATIONS[1], lib()).between(0, 2000).map((s) => s.item.id);
    expect(a).not.toEqual(b);
  });

  it('puts a song, then two or three talk items, round and round', () => {
    const slots = new Programme(STATIONS[0], lib()).between(0, 6000);
    const kinds = slots.map((s) => (s.kind === 'music' ? 'M' : 't')).join('');
    expect(kinds).toMatch(/^(Mt{2,3})+/);
    expect(kinds).not.toMatch(/MM/);
  });

  it('is mostly music by time, with real talk', () => {
    const s = shares(new Programme(STATIONS[0], lib()).between(0, 6000));
    expect(s.music).toBeGreaterThan(s.talk);
    expect(s.talk).toBeGreaterThan(0);
    expect(s.silence).toBe(0);
  });

  it('does not play a song again until the others have gone round', () => {
    const songs = new Programme(STATIONS[0], lib()).between(0, 20000).filter((s) => s.kind === 'music').map((s) => s.item.id);
    for (let i = 3; i < songs.length; i++) expect(songs.slice(i - 3, i)).not.toContain(songs[i]);
  });

  it('shuffles in a good many different talk items', () => {
    const talk = new Programme(STATIONS[0], lib()).between(0, 20000).filter((s) => s.kind !== 'music').map((s) => s.item.id);
    expect(new Set(talk).size).toBeGreaterThan(20);
  });

  it('says what is on at a time, and what comes next', () => {
    const p = new Programme(STATIONS[1], lib());
    const now = p.at(500);
    expect(now.start).toBeLessThanOrEqual(500);
    expect(now.end).toBeGreaterThan(500);
    expect(p.between(500, 520)[0]).toBe(now);
  });

  it('waits in silence when it has nothing yet, and starts as soon as there is something', () => {
    const p = new Programme(STATIONS[0], { music: [], talk: [] });
    expect(p.at(5).kind).toBe('silence');
    p.setLibrary(lib(), 5);
    expect(p.at(5).kind).not.toBe('silence');
    expect(p.at(5).start).toBe(5);
    expect(p.between(5, 400).some((s) => s.kind === 'music')).toBe(true);
  });

  it('keeps what is on air when a song is added, and plays the new one in time', () => {
    const p = new Programme(STATIONS[0], lib());
    const before = p.at(300);
    const l = lib();
    l.music.push({ id: 'mine', seconds: 90 });
    p.setLibrary(l, 300);
    expect(p.at(300)).toBe(before);
    const heard = p.between(300, 40000).filter((s) => s.kind === 'music').map((s) => s.item.id);
    expect(heard).toContain('mine');
  });
});
