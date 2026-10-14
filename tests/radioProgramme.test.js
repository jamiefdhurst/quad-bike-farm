import { describe, it, expect } from 'vitest';
import { buildCycle, shares, programmeEvents, segmentAt, PROGRAMME_SECONDS } from '../src/audio/radioProgramme.js';

describe('the radio programme', () => {
  it('fills the cycle exactly, and has more talk than music', () => {
    const c = buildCycle();
    expect(c[0].start).toBe(0);
    expect(c[c.length - 1].end).toBe(PROGRAMME_SECONDS);
    for (let i = 1; i < c.length; i++) expect(c[i].start).toBeCloseTo(c[i - 1].end, 6);
    const s = shares(c);
    expect(s.talk).toBeGreaterThan(s.music);
    expect(s.music).toBeGreaterThan(0);
    expect(s.jingle).toBeGreaterThan(0);
  });

  it('is the same every time, and repeats each lap', () => {
    const a = programmeEvents(12, 30);
    const b = programmeEvents(12, 30);
    expect(a).toEqual(b);
    const later = programmeEvents(12 + PROGRAMME_SECONDS, 30 + PROGRAMME_SECONDS);
    expect(later.length).toBe(a.length);
    later.forEach((e, i) => {
      expect(e.t - PROGRAMME_SECONDS).toBeCloseTo(a[i].t, 6);
      expect({ ...e, t: 0 }).toEqual({ ...a[i], t: 0 });
    });
  });

  it('gives events in order, inside the window asked for', () => {
    const ev = programmeEvents(100, 140);
    expect(ev.length).toBeGreaterThan(10);
    for (let i = 1; i < ev.length; i++) expect(ev[i].t).toBeGreaterThanOrEqual(ev[i - 1].t);
    expect(ev.every((e) => e.t >= 100 && e.t < 140)).toBe(true);
    expect(programmeEvents(5, 5)).toEqual([]);
  });

  it('plays a voice in talk, and a tune in music', () => {
    const talk = buildCycle().find((s) => s.kind === 'talk');
    const music = buildCycle().find((s) => s.kind === 'music');
    const t = programmeEvents(talk.start, talk.end).filter((e) => e.t < talk.end);
    expect(t.some((e) => e.kind === 'syllable' && e.f0 > 80 && e.f0 < 260)).toBe(true);
    const m = programmeEvents(music.start, music.end);
    for (const kind of ['lead', 'bass', 'kick']) expect(m.some((e) => e.kind === kind)).toBe(true);
    expect(segmentAt(music.start + 1).kind).toBe('music');
  });
});
