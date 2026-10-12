import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { Charger, chargeStep, DEFAULT_CHARGER_PARAMS as P } from '../src/workshop/charger.js';
import { jumpTarget, DEFAULT_JUMP_LEAD_PARAMS } from '../src/items/jumpLeads.js';
import { BenchJob, JOBS, finishJob, jobAvailable } from '../src/workshop/benchJobs.js';
import { overnight } from '../src/farm/farmState.js';

const run = (e, seconds, controls = {}) => {
  for (let t = 0; t < seconds; t += 1 / 60) e.update(1 / 60, controls);
};

describe('battery charger', () => {
  it('takes a flat battery to full in about five minutes, easing off near the top', () => {
    const e = new EngineModel({}, { random: () => 0.5 });
    e.battery = 0;
    e.batteryOut = true;
    const c = new Charger();
    c.put('blue', e);
    let seconds = 0;
    let fullAt = null;
    while (e.battery < 0.999 && seconds < 900) {
      if (c.update(1, e) === 'full') fullAt = seconds;
      seconds++;
    }
    expect(fullAt).toBeGreaterThan(240);
    expect(fullAt).toBeLessThan(420);
    expect(chargeStep(0.95, 1, P)).toBeLessThan(chargeStep(0.5, 1, P));
  });
  it('does nothing with nothing on it, and says full once', () => {
    const c = new Charger();
    expect(c.update(10, null)).toBeNull();
    const e = new EngineModel({}, { random: () => 0.5 });
    e.battery = 0.97;
    c.put('x', e);
    let fulls = 0;
    for (let i = 0; i < 60; i++) if (c.update(1, e) === 'full') fulls++;
    expect(fulls).toBe(1);
    c.take();
    expect(c.busy).toBe(false);
  });
});

describe('a battery that is out of the vehicle', () => {
  it('has no dash, no click and no starter, and neither drains nor charges', () => {
    const e = new EngineModel({}, { random: () => 0.5 });
    e.battery = 0.8;
    e.batteryOut = true;
    e.setIgnition(true);
    expect(e.hasPower).toBe(false);
    const events = [];
    e.on?.('starterClick', () => events.push('click'));
    run(e, 120, { starter: true, choke: 1 });
    expect(e.battery).toBe(0.8);
    expect(e.state).not.toBe('cranking');
    expect(events).toEqual([]);
  });
  it('is cut off from the jump leads', () => {
    const live = { isRunning: true, battery: 1, batteryOut: false };
    const out = { isRunning: false, battery: 0, batteryOut: true };
    expect(jumpTarget(live, out)).toBeNull();
    expect(jumpTarget(out, live)).toBeNull();
    expect(jumpTarget(live, { isRunning: false, battery: 0 })).not.toBeNull();
  });
  it('is not drained overnight, and the save keeps it out', () => {
    const out = overnight({ engine: { battery: 0.4, batteryOut: true }, keyOn: true, running: false });
    expect(out.engine.battery).toBe(0.4);
    expect(out.engine.batteryOut).toBe(true);
  });
});

describe('the leads are no longer instant', () => {
  it('take over a minute to bring a flat battery to a start', () => {
    expect(DEFAULT_JUMP_LEAD_PARAMS.chargeRate * 60).toBeLessThan(1);
    expect((0.6 - 0) / DEFAULT_JUMP_LEAD_PARAMS.chargeRate).toBeGreaterThan(30);
  });
});

describe('the battery bench jobs', () => {
  const engine = (extra = {}) => ({ params: { strokes: 4, ...extra }, batteryOut: false });
  it('take it out when it is in and fit it when it is out', () => {
    expect(jobAvailable('chargeOn', engine())).toBe(true);
    expect(jobAvailable('chargeOff', engine())).toBe(false);
    const out = { ...engine(), batteryOut: true };
    expect(jobAvailable('chargeOn', out)).toBe(false);
    expect(jobAvailable('chargeOff', out)).toBe(true);
    expect(jobAvailable('chargeOn', engine({ noStarter: true }))).toBe(false);
  });
  it('call the game when they finish', () => {
    const calls = [];
    for (const kind of ['chargeOn', 'chargeOff']) {
      const job = new BenchJob(kind);
      for (let guard = 0; !job.done && guard < 20; guard++) {
        if (job.step.kind === 'press') job.press();
        else {
          job.startHold();
          job.update(5);
        }
      }
      expect(job.done).toBe(true);
      finishJob(job, { engine: { battery: 1 }, batteryOut: () => calls.push('out'), batteryIn: () => calls.push('in') });
    }
    expect(calls).toEqual(['out', 'in']);
    expect(JOBS.chargeOn.name).toBeTruthy();
  });
});

describe('which vehicles have a battery to lift out', () => {
  it('every one with a starter, small on a quad and big on the cars', async () => {
    const { hasBattery, batterySizeFor } = await import('../src/items/battery.js');
    expect(hasBattery({ engine: { params: {} } })).toBe(true);
    expect(hasBattery({ engine: { params: { noStarter: true } } })).toBe(false);
    expect(hasBattery({ engine: { params: {} }, barnFind: {} })).toBe(false);
    expect(batterySizeFor({ spec: {}, engine: { params: {} } })).toBe('small');
    expect(batterySizeFor({ spec: { car: true }, engine: { params: {} } })).toBe('big');
    expect(batterySizeFor({ spec: {}, quad: { tractor: true }, engine: { params: {} } })).toBe('big');
  });
});
