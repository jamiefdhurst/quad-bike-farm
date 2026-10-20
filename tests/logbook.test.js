import { describe, it, expect } from 'vitest';
import { Logbook, entryText, startingCandidates, startingEntries, shortName, formatEntry, formatClock, DEFAULT_LOGBOOK_PARAMS as P } from '../src/workshop/logbook.js';
import { WALK_FINDINGS } from '../src/npc/walkRound.js';
import { PLUG_KINDS, JOB_KINDS } from '../src/workshop/benchJobs.js';
import { QUIRK_KINDS } from '../src/vehicle/quirks.js';
import { createRandom } from '../src/core/random.js';

describe('entryText', () => {
  it('has words for every walk-round finding, plug reading and bench job', () => {
    for (const finding of WALK_FINDINGS) expect(entryText({ kind: 'walk', finding })).toBeTruthy();
    for (const reading of PLUG_KINDS) expect(entryText({ kind: 'plug', reading })).toBeTruthy();
    for (const job of JOB_KINDS) expect(entryText({ kind: 'job', job })).toBeTruthy();
    for (const quirk of QUIRK_KINDS) expect(entryText({ kind: 'quirk', quirk })).toBeTruthy();
    for (const fault of ['puncture', 'belt', 'cable', 'carb']) expect(entryText({ kind: 'fault', fault })).toBeTruthy();
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

  it('writes down what a vehicle was bought or sold for', () => {
    const b = new Logbook();
    expect(b.write({ quad: 'Red', what: { kind: 'deal', deal: 'sold', price: 420 }, by: 'you' }).text).toBe('sold for £420');
    expect(b.write({ quad: 'Tractor', what: { kind: 'deal', deal: 'bought', price: 1900 } }).text).toBe('bought for £1900');
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
    expect(shortName('Tamura Bruin 660')).toBe('Bruin 660');
    expect(shortName('Kestrel Farm 300')).toBe('Farm 300');
    expect(shortName('Hartley 35')).toBe('Hartley 35');
    expect(shortName('Tractor')).toBe('Tractor'); // no maker to drop
  });

  it('formats the clock and an entry', () => {
    expect(formatClock(605)).toBe('10:05');
    expect(formatEntry({ time: 5, quad: 'Red', text: 'tyre soft', by: null })).toBe('0:05  Red, tyre soft.');
  });
});

describe('the book before the game', () => {
  const history = { faults: [{ kind: 'belt', level: 0.5 }], tinker: { limiter: 2, mixture: 0 }, lastRider: 'jess' };
  const blue = { name: 'Blue quad', history, quirks: ['brakeSqueal', 'tapStiff'] };

  it('lists only what is true of the vehicle', () => {
    const c = startingCandidates(blue).map((e) => entryText(e.what));
    expect(c.sort()).toEqual(['belt slipping', 'brakes squeal', 'fuel tap stiff', 'out with Jess', 'throttle stop wound out'].sort());
    expect(startingCandidates({ name: 'Red quad', history: { faults: [], tinker: null, lastRider: null } })).toEqual([]);
  });

  it('keeps between the minimum and maximum, never more than there is, and is the same for the same seed', () => {
    const all = [blue, { ...blue, name: 'Green quad' }].flatMap(startingCandidates);
    const P2 = { ...P, startKnows: 1, startMin: 2, startMax: 3 };
    for (let seed = 1; seed < 30; seed++) {
      const n = startingEntries(all, createRandom(seed), P2).length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(3);
    }
    expect(startingEntries(all.slice(0, 1), createRandom(1), P2).length).toBe(1);
    expect(startingEntries(all, createRandom(7), P2)).toEqual(startingEntries(all, createRandom(7), P2));
  });

  it('writes down nothing when she knows nothing, and at most one note about who had a quad out', () => {
    const all = [blue, { ...blue, name: 'Green quad' }, { ...blue, name: 'Red quad' }].flatMap(startingCandidates);
    expect(startingEntries(all, createRandom(3), { ...P, startKnows: 0 })).toEqual([]);
    for (let seed = 1; seed < 30; seed++) {
      const riders = startingEntries(all, createRandom(seed), { ...P, startKnows: 1, startMin: 20, startMax: 20 }).filter((e) => e.what.kind === 'rider');
      expect(riders.length).toBeLessThanOrEqual(1);
    }
  });

  it('shows them as yesterday, and a new entry about the same thing is still written', () => {
    const b = new Logbook({ ...P });
    b.seed([{ quad: 'Blue', what: { kind: 'fault', fault: 'belt' } }]);
    expect(b.lines()).toEqual(['Yesterday  Blue, belt slipping.']);
    expect(b.write({ quad: 'Blue', what: { kind: 'walk', finding: 'walkBelt' } })).not.toBeNull();
  });
});
