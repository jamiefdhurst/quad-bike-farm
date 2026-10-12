import { describe, it, expect } from 'vitest';
import { Spares, DEFAULT_SPARES_PARAMS, SPARES_PARAM_RANGES, PART_IDS, jetShelfChange, partCount } from '../src/workshop/spares.js';
import { BenchJob, JOBS, jobPart, DEFAULT_BENCH_PARAMS } from '../src/workshop/benchJobs.js';

const shelf = (over = {}) => new Spares({ ...DEFAULT_SPARES_PARAMS, orderJitter: 0, ...over });

describe('the spares shelf', () => {
  it('starts with the counts in its params', () => {
    const s = shelf({ startPlug: 5, startPiston: 0 });
    expect(s.count('plug')).toBe(5);
    expect(s.has('piston')).toBe(false);
  });

  it('uses a part up and refuses when there is none', () => {
    const s = shelf({ startTube: 1 });
    expect(s.take('tube')).toBe(true);
    expect(s.take('tube')).toBe(false);
    expect(s.count('tube')).toBe(0);
  });

  it('every part has start, pack and a range for the debug panel', () => {
    for (const id of PART_IDS) {
      const k = id[0].toUpperCase() + id.slice(1);
      expect(DEFAULT_SPARES_PARAMS[`start${k}`]).toBeDefined();
      expect(DEFAULT_SPARES_PARAMS[`pack${k}`]).toBeGreaterThan(0);
      expect(SPARES_PARAM_RANGES[`start${k}`]).toBeDefined();
      expect(SPARES_PARAM_RANGES[`pack${k}`]).toBeDefined();
    }
  });

  it('an order waits its delay for a free lane, then asks for the post once', () => {
    const s = shelf({ orderDelay: 10 });
    expect(s.order('plug').ok).toBe(true);
    expect(s.update(5, true)).toBe(false);
    expect(s.update(6, false)).toBe(false); // due, but a visitor is about
    expect(s.update(0.1, true)).toBe(true);
    s.sentOff();
    expect(s.update(1, true)).toBe(false);
  });

  it('the wait is five minutes or so with the default params, a little either way', () => {
    const lo = new Spares({ ...DEFAULT_SPARES_PARAMS }, () => 0);
    const hi = new Spares({ ...DEFAULT_SPARES_PARAMS }, () => 1);
    lo.order('plug');
    hi.order('plug');
    expect(lo.due).toBe(240);
    expect(hi.due).toBe(300);
  });

  it('the parcel carries the order, and opening it restocks the shelf', () => {
    const s = shelf({ startPlug: 0, packPlug: 4 });
    s.order('plug');
    expect(s.deliver()).toBe(true);
    expect(s.hasParcel).toBe(true);
    expect(s.hasOrder).toBe(false);
    expect(s.count('plug')).toBe(0); // not until it is opened
    expect(s.collect()).toEqual({ plug: 4 });
    expect(s.count('plug')).toBe(4);
    expect(s.hasParcel).toBe(false);
  });

  it('a parcel that is not yours delivers nothing', () => {
    expect(shelf().deliver()).toBe(false);
  });

  it('will not order past what the shelf holds, counting what is on order', () => {
    const s = shelf({ startPlug: 5, packPlug: 4, maxOnShelf: 8 });
    expect(s.order('plug').ok).toBe(false);
    const t = shelf({ startPlug: 0, packPlug: 4, maxOnShelf: 8 });
    expect(t.order('plug').ok).toBe(true);
    expect(t.order('plug').ok).toBe(true);
    expect(t.order('plug').ok).toBe(false);
  });

  it('reports parts down to the last one, unless more are coming', () => {
    const s = shelf({ startPlug: 1, startTube: 0, startBelt: 4, startJet: 4, startPiston: 4 });
    expect(s.low().sort()).toEqual(['plug', 'tube']);
    s.order('tube');
    expect(s.low()).toEqual(['plug']);
  });

  it('is kept between days, and an order still in the post goes on', () => {
    const s = shelf({ startPlug: 2 });
    s.take('plug');
    s.order('belt');
    s.deliver();
    s.order('jet');
    const t = shelf();
    t.restore(JSON.parse(JSON.stringify(s.toJSON())));
    expect(t.count('plug')).toBe(1);
    expect(t.waiting.belt).toBe(2);
    expect(t.ordered.jet).toBe(2);
    expect(t.due).toBe(t.p.orderDelay);
  });

  it('ignores a bad save', () => {
    const t = shelf();
    t.restore({ counts: { plug: -3, tube: 'x' }, ordered: null });
    expect(t.count('plug')).toBe(DEFAULT_SPARES_PARAMS.startPlug);
    t.restore(undefined);
  });

  it('says a count in words', () => {
    expect(partCount('plug', 1)).toBe('1 spark plug');
    expect(partCount('tube', 3)).toBe('3 inner tubes');
  });
});

describe('the jet', () => {
  it('takes one for any size but stock, gives it back on going to stock, and costs nothing between sizes', () => {
    expect(jetShelfChange(0, 1)).toBe('take');
    expect(jetShelfChange(1, 2)).toBe(null);
    expect(jetShelfChange(-2, 0)).toBe('give');
    expect(jetShelfChange(0, 0)).toBe(null);
  });
});

describe('bench jobs and the shelf', () => {
  it('the plug, tyre and top end jobs name the part they use', () => {
    expect(jobPart('plug')).toBe('plug');
    expect(jobPart('tyre')).toBe('tube');
    expect(jobPart('topEnd')).toBe('piston');
    expect(jobPart('carb')).toBe(null);
  });

  it('a plug job stops at the fitting step with none left, and carries on once there is one', () => {
    const s = shelf({ startPlug: 0 });
    const job = new BenchJob('plug', DEFAULT_BENCH_PARAMS, s);
    job.press(); // the cap
    job.startHold();
    job.update(10); // undo the old plug
    job.press(); // look at it
    const at = job.index;
    expect(JOBS.plug.steps[at].part).toBe('plug');
    expect(job.press()).toEqual([{ type: 'noPart', part: 'plug' }]);
    expect(job.index).toBe(at);
    s.give('plug');
    job.press();
    expect(job.index).toBe(at + 1);
    expect(s.count('plug')).toBe(0);
  });

  it('a job with no shelf (the old tests, the debug panel) fits its part freely', () => {
    const job = new BenchJob('plug', DEFAULT_BENCH_PARAMS);
    job.press();
    job.startHold();
    job.update(10);
    job.press();
    job.press();
    expect(job.index).toBe(4);
  });
});
