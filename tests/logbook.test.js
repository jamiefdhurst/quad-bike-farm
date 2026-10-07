import { describe, it, expect } from 'vitest';
import { Logbook, entryText, shortName, formatEntry, formatClock, DEFAULT_LOGBOOK_PARAMS as P } from '../src/workshop/logbook.js';
import { WALK_FINDINGS } from '../src/npc/walkRound.js';
import { PLUG_KINDS, JOB_KINDS } from '../src/workshop/benchJobs.js';

describe('entryText', () => {
  it('has words for every walk-round finding, plug reading and bench job', () => {
    for (const finding of WALK_FINDINGS) expect(entryText({ kind: 'walk', finding })).toBeTruthy();
    for (const reading of PLUG_KINDS) expect(entryText({ kind: 'plug', reading })).toBeTruthy();
    for (const job of JOB_KINDS) expect(entryText({ kind: 'job', job })).toBeTruthy();
  });

  it('says so when a job was botched', () => {
    expect(entryText({ kind: 'job', job: 'carb', botched: true })).toBe('carb cleaned, not well');
  });

  it('ignores things it does not know', () => {
    expect(entryText({ kind: 'walk', finding: 'nonsense' })).toBeNull();
    expect(entryText({ kind: 'weather' })).toBeNull();
  });
});

describe('Logbook', () => {
  it('writes entries in order with the time they were written', () => {
    const b = new Logbook({ ...P });
    b.update(42);
    b.write({ quad: 'Blue', what: { kind: 'walk', finding: 'walkBelt' } });
    b.update(30);
    b.write({ quad: 'Green', what: { kind: 'plug', reading: 'rich' }, by: 'you' });
    expect(b.lines()).toEqual(['0:42  Blue, belt slipping.', '1:12  Green, plug black (you).']);
  });

  it('does not repeat the same thing about the same quad inside the repeat time, but does later or for another quad', () => {
    const b = new Logbook({ ...P, repeatSeconds: 100 });
    const belt = { kind: 'walk', finding: 'walkBelt' };
    expect(b.write({ quad: 'Blue', what: belt })).not.toBeNull();
    b.update(50);
    expect(b.write({ quad: 'Blue', what: belt })).toBeNull();
    expect(b.write({ quad: 'Red', what: belt })).not.toBeNull();
    b.update(60);
    expect(b.write({ quad: 'Blue', what: belt })).not.toBeNull();
  });

  it('drops the oldest entry when the page is full', () => {
    const b = new Logbook({ ...P, maxEntries: 2, repeatSeconds: 0 });
    b.write({ quad: 'A', what: { kind: 'oil' } });
    b.write({ quad: 'B', what: { kind: 'oil' } });
    b.write({ quad: 'C', what: { kind: 'oil' } });
    expect(b.entries.map((e) => e.quad)).toEqual(['B', 'C']);
  });

  it('writes nothing for an unknown thing', () => {
    const b = new Logbook({ ...P });
    expect(b.write({ quad: 'Blue', what: { kind: 'weather' } })).toBeNull();
    expect(b.entries).toEqual([]);
  });
});

describe('names and times', () => {
  it('shortens quad names for the notebook', () => {
    expect(shortName('Blue quad')).toBe('Blue');
    expect(shortName("Kids' quad")).toBe("Kids'");
    expect(shortName('Mini moto')).toBe('Mini moto');
  });

  it('formats the clock and an entry', () => {
    expect(formatClock(605)).toBe('10:05');
    expect(formatEntry({ time: 5, quad: 'Red', text: 'tyre soft', by: null })).toBe('0:05  Red, tyre soft.');
  });
});
