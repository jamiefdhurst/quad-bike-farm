import { describe, it, expect } from 'vitest';
import { Lessons, makeJudge, DEFAULT_LESSON_PARAMS, DRILLS, BAD_WHYS, drillsFor } from '../src/npc/lessons.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';

const P = { ...DEFAULT_LESSON_PARAMS };
const base = { running: true, stalled: false, gear: 1, pedal: 0, clutch: 0, throttle: 0, speed: 0, climb: 0, revs: 0.1 };

/** Feeds a judge a list of [seconds, sample changes] steps and returns the first result it gives. */
function run(drill, steps) {
  const judge = makeJudge(drill, P);
  let s = { ...base };
  for (const [secs, change] of steps) {
    const was = s.running;
    s = { ...s, ...change };
    for (let t = 0; t < secs; t += 0.1) {
      const r = judge.step(0.1, { ...s, stalled: t === 0 && was && !s.running });
      if (r) return r;
    }
  }
  return null;
}

describe('pulling away', () => {
  const stopped = [1, { pedal: 1 }];
  it('is good when you ease away', () => {
    expect(run('pullAway', [stopped, [1, { pedal: 0.5, clutch: 0.5, throttle: 0.2, speed: 0.2 }], [1, { pedal: 0, clutch: 1, speed: 3, throttle: 0.2 }]])).toEqual({ result: 'good' });
  });
  it('is bad when you rev it', () => {
    expect(run('pullAway', [stopped, [1, { pedal: 0.5, clutch: 0.5, throttle: 0.9, revs: 0.8 }], [1, { pedal: 0, clutch: 1, speed: 3 }]])?.why).toBe('revved');
  });
  it('is bad when you stall', () => {
    expect(run('pullAway', [stopped, [0.5, { pedal: 0, clutch: 1 }], [0.2, { running: false }]])?.why).toBe('stalled');
  });
  it('is bad when you ride the clutch too long', () => {
    expect(run('pullAway', [stopped, [4, { pedal: 0.4, clutch: 0.4, speed: 0.2 }], [1, { clutch: 1, pedal: 0, speed: 3 }]])?.why).toBe('slipped');
  });
});

describe('the hill', () => {
  it('only starts on a hill', () => {
    expect(run('hillClutch', [[1, { pedal: 1 }], [1, { pedal: 0, clutch: 1, speed: 3 }]])).toBe(null);
  });
  it('is good when you pull away up it', () => {
    expect(run('hillClutch', [[1, { pedal: 1, climb: 0.15 }], [1, { pedal: 0.4, clutch: 0.4, speed: 0.2, throttle: 0.4 }], [1, { pedal: 0, clutch: 1, speed: 3 }]])).toEqual({ result: 'good' });
  });
  it('is bad when you roll back', () => {
    expect(run('hillClutch', [[1, { pedal: 1, climb: 0.15 }], [1, { pedal: 0.4, clutch: 0.4 }], [1, { speed: -1 }]])?.why).toBe('rolled');
  });
});

describe('the bank', () => {
  const cruise = { gear: 3, speed: 8, climb: 0 };
  it('is good when you change down before it', () => {
    expect(run('changeDown', [[5, cruise], [1, { gear: 2 }], [1, { climb: 0.15, gear: 2, speed: 7 }], [6, { speed: 6 }]])).toEqual({ result: 'good' });
  });
  it('is bad when you stay in a high gear', () => {
    expect(run('changeDown', [[5, cruise], [1, { climb: 0.15 }], [6, { speed: 4 }]])?.why).toBe('noChange');
  });
  it('is bad when you change down too late', () => {
    expect(run('changeDown', [[5, cruise], [3, { climb: 0.15, speed: 6 }], [0.1, { gear: 2 }], [4, {}]])?.why).toBe('late');
  });
  it('is bad when it lugs to a stop', () => {
    expect(run('changeDown', [[5, cruise], [1, { climb: 0.15 }], [6, { speed: 0.5 }]])?.why).toBe('lugged');
  });
});

describe('smooth changes', () => {
  const cruise = { gear: 2, speed: 8, pedal: 0 };
  it('is good when the change is clean', () => {
    expect(run('smooth', [[1, cruise], [0.5, { pedal: 1, speed: 7.8 }], [0.5, { pedal: 0, gear: 3, speed: 7.6 }], [1.5, {}]])).toEqual({ result: 'good' });
  });
  it('is bad when you lose speed', () => {
    expect(run('smooth', [[1, cruise], [0.2, { pedal: 1 }], [0.5, { speed: 5 }], [0.5, { pedal: 0, gear: 3 }], [1.5, {}]])?.why).toBe('jerky');
  });
  it('is bad when it over-revs', () => {
    expect(run('smooth', [[1, cruise], [0.5, { pedal: 1 }], [0.5, { pedal: 0, gear: 1, revs: 0.95 }], [1.5, {}]])?.why).toBe('overrev');
  });
  it('is not a change if the gear stays put', () => {
    expect(run('smooth', [[1, cruise], [0.5, { pedal: 1 }], [0.5, { pedal: 0 }], [3, {}]])).toBe(null);
  });
});

describe('stopping', () => {
  it('is good when you stop with it running', () => {
    expect(run('stopping', [[1, { speed: 6 }], [1, { speed: 3 }], [1, { speed: 0 }]])).toEqual({ result: 'good' });
  });
  it('is bad when it stalls on the way', () => {
    expect(run('stopping', [[1, { speed: 6 }], [1, { speed: 1 }], [0.2, { running: false, speed: 0.5 }]])?.why).toBe('stalled');
  });
  it('does not count a stop from a crawl', () => {
    expect(run('stopping', [[1, { speed: 1.5 }], [1, { speed: 0 }]])).toBe(null);
  });
});

describe('faster', () => {
  it('is good when you reach the speed in time', () => {
    expect(run('faster', [[0.5, { throttle: 1 }], [3, { speed: 12, throttle: 1 }]])).toEqual({ result: 'good' });
  });
  it('is slow when you do not', () => {
    expect(run('faster', [[0.5, { throttle: 1 }], [9, { speed: 7, throttle: 1 }]])?.why).toBe('slow');
  });
  it('is slow when you ease off', () => {
    expect(run('faster', [[0.5, { throttle: 1 }], [3, { speed: 5, throttle: 0.1 }]])?.why).toBe('slow');
  });
});

describe('a lesson', () => {
  const goodPull = [
    { ...base, pedal: 1 },
    { ...base, pedal: 0.5, clutch: 0.5, throttle: 0.2, speed: 0.2 },
    { ...base, pedal: 0, clutch: 1, speed: 3, throttle: 0.2 },
    { ...base, speed: 0, gear: 0, pedal: 1 }, // back to a stop for the next go
  ];
  function goes(lessons, samples, girls = ['amy']) {
    const events = [];
    for (const s of samples) for (let i = 0; i < 6; i++) events.push(...lessons.update(0.1, { girls, sample: s }));
    return events;
  }
  const settled = (l) => {
    for (let i = 0; i < 40; i++) l.update(0.1, { girls: ['amy'], sample: base });
  };

  it('offers only after you have been driving together a while, and only what is left to teach', () => {
    const l = new Lessons({ ...P });
    expect(l.offers({ girls: ['amy'] })).toEqual([]);
    for (let i = 0; i < 300; i++) l.update(0.1, { girls: ['amy'], sample: base });
    expect(l.offers({ girls: ['amy'] }).map((o) => o.girl)).toEqual(['amy']);
    expect(l.offers({ girls: ['jess'] })).toEqual([]);
    l.passed.amy = new Set(drillsFor('amy'));
    expect(l.offers({ girls: ['amy'] })).toEqual([]);
  });

  it('sets the first drill after a moment, and passes it after two clean goes in a row', () => {
    const l = new Lessons({ ...P });
    expect(l.start('amy')).toEqual({ type: 'begin', girl: 'amy', drill: 'pullAway' });
    const events = goes(l, [base, base, base, base, base, base, base, base, ...goodPull, ...goodPull, base, base, base, base, base, base, base]);
    expect(events.map((e) => e.type)).toEqual(['set', 'good', 'passed', 'set']);
    expect(l.active.drill).toBe('hillClutch');
    expect(l.passed.amy.has('pullAway')).toBe(true);
  });

  it('a bad go starts the count again', () => {
    const l = new Lessons({ ...P });
    l.start('amy');
    const stall = [{ ...base, pedal: 1 }, { ...base, pedal: 0, clutch: 1 }, { ...base, running: false }, { ...base, running: true }];
    const events = goes(l, [base, base, base, base, base, base, base, base, ...goodPull, ...stall, ...goodPull]);
    expect(events.map((e) => e.type + (e.why ? `:${e.why}` : ''))).toEqual(['set', 'good', 'bad:stalled', 'good']);
    expect(l.passed.amy.size).toBe(0);
  });

  it('gives up after too many bad goes in a row', () => {
    const l = new Lessons({ ...P, badMax: 2, setDelay: 0 });
    l.start('amy');
    const stall = [{ ...base, pedal: 1 }, { ...base, pedal: 0, clutch: 1 }, { ...base, running: false }, { ...base, running: true }];
    const events = goes(l, [base, base, ...stall, ...stall]);
    expect(events.at(-1)).toMatchObject({ type: 'end', why: 'gaveUp' });
    expect(l.active).toBe(null);
    expect(l.offers({ girls: ['amy'] })).toEqual([]);
  });

  it('nudges when nothing happens, then gives up', () => {
    const l = new Lessons({ ...P, setDelay: 0, nudgeEvery: 5, nudgeMax: 2 });
    l.start('amy');
    const events = [];
    for (let i = 0; i < 400; i++) events.push(...l.update(0.1, { girls: ['amy'], sample: base }));
    expect(events.map((e) => e.type)).toEqual(['set', 'nudge', 'nudge', 'end']);
  });

  it('is over when you stop driving with her on the back', () => {
    const l = new Lessons({ ...P });
    l.start('amy');
    settled(l);
    let events = [];
    for (let i = 0; i < 80; i++) events.push(...l.update(0.1, { girls: [], sample: null }));
    expect(events.at(-1)).toMatchObject({ type: 'end', why: 'left' });
  });

  it('graduates when the last drill is passed, and remembers it', () => {
    const l = new Lessons({ ...P, goodNeeded: 1, setDelay: 0 });
    l.passed.amy = new Set(drillsFor('amy').slice(0, -1));
    l.start('amy');
    expect(l.active.drill).toBe('stopping');
    const events = [];
    for (const s of [base, { ...base, speed: 6 }, { ...base, speed: 3 }, { ...base, speed: 0 }]) for (let i = 0; i < 10; i++) events.push(...l.update(0.1, { girls: ['amy'], sample: s }));
    expect(events.map((e) => e.type)).toEqual(['set', 'passed', 'graduated', 'end']);
    const saved = JSON.parse(JSON.stringify(l.capture()));
    const again = new Lessons({ ...P });
    again.restore(saved);
    expect(again.remaining('amy')).toEqual([]);
    expect(again.graduated.amy).toBe(true);
  });

  it('restores an old save with nothing in it, and ignores a drill that has gone or belongs to the other girl', () => {
    const l = new Lessons({ ...P });
    l.restore(undefined);
    l.restore({ amy: ['pullAway', 'nonsense', 'faster'], jess: 'junk' });
    expect([...l.passed.amy]).toEqual(['pullAway']);
    expect(l.passed.jess.size).toBe(0);
  });

  it('Jess teaches one lesson: faster', () => {
    expect(drillsFor('jess')).toEqual(['faster']);
    const l = new Lessons({ ...P });
    expect(l.start('jess').drill).toBe('faster');
  });
});

describe('the lesson content', () => {
  it('is an offer kind the chooser knows', () => {
    expect(OFFER_KINDS.lesson).toBeTruthy();
    expect(OFFER_KINDS.lesson.fromSeat).toBe(true);
  });
  it('names a teacher and a label for every drill', () => {
    for (const d of Object.values(DRILLS)) {
      expect(['amy', 'jess']).toContain(d.teacher);
      expect(d.label.length).toBeGreaterThan(0);
    }
    expect(BAD_WHYS).toContain('slow');
  });
});
