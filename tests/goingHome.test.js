import { describe, it, expect } from 'vitest';
import { GoingHome, DEFAULT_GOING_HOME_PARAMS, GOING_HOME_PARAM_RANGES, leaveRoute } from '../src/npc/goingHome.js';
import { LAYOUT } from '../src/world/layout.js';
import { JESS_CAR_LINES, AMY_CAR_LINES } from '../src/npc/carLines.js';

const run = (gh, seconds, dt = 0.5) => {
  const out = [];
  for (let t = 0; t < seconds; t += dt) out.push(...gh.update(dt));
  return out;
};

describe('going home', () => {
  it('sends each girl off the way she gets there', () => {
    const gh = new GoingHome();
    const ev = gh.begin([{ id: 'amy', how: 'lift' }, { id: 'jess', how: 'drive' }]);
    expect(ev).toEqual([{ type: 'go', girl: 'amy', how: 'lift' }, { type: 'go', girl: 'jess', how: 'drive' }]);
    expect(gh.active).toBe(true);
    expect(gh.done).toBe(false);
  });

  it('is done, once, when everyone has gone', () => {
    const gh = new GoingHome();
    gh.begin([{ id: 'amy', how: 'drive' }, { id: 'jess', how: 'drive' }]);
    gh.gone('amy');
    expect(run(gh, 2)).toEqual([]);
    gh.gone('jess');
    expect(gh.update(0.5)).toEqual([{ type: 'done' }]);
    expect(gh.active).toBe(false);
    expect(run(gh, 5)).toEqual([]);
  });

  it('has nothing to wait for with no one going', () => {
    const gh = new GoingHome();
    gh.begin([]);
    expect(gh.update(0.1)).toEqual([{ type: 'done' }]);
  });

  it('has Amy tut once, a moment after Jess sets off, while Amy is still there', () => {
    const gh = new GoingHome();
    gh.begin([{ id: 'amy', how: 'drive' }, { id: 'jess', how: 'drive' }]);
    expect(run(gh, 10)).toEqual([]);
    gh.setOff('jess');
    expect(run(gh, gh.p.tutAfter - 1)).toEqual([]);
    expect(run(gh, 3)).toEqual([{ type: 'tut', girl: 'amy' }]);
    expect(run(gh, 10)).toEqual([]);
  });

  it('does not tut when Amy has already gone, or Jess was given a lift', () => {
    const gone = new GoingHome();
    gone.begin([{ id: 'amy', how: 'drive' }, { id: 'jess', how: 'drive' }]);
    gone.gone('amy');
    gone.setOff('jess');
    expect(run(gone, 10)).toEqual([]);
    const lift = new GoingHome();
    lift.begin([{ id: 'amy', how: 'drive' }, { id: 'jess', how: 'lift' }]);
    lift.setOff('jess');
    expect(run(lift, 10)).toEqual([]);
  });

  it('counts a girl who takes too long as gone', () => {
    const gh = new GoingHome();
    gh.begin([{ id: 'amy', how: 'drive' }, { id: 'jess', how: 'drive' }]);
    gh.gone('jess');
    const ev = run(gh, gh.p.giveUpAfter + 1);
    expect(ev).toEqual([{ type: 'giveUp', girl: 'amy' }, { type: 'done' }]);
  });

  it('says where each has got to', () => {
    const gh = new GoingHome();
    gh.begin([{ id: 'amy', how: 'lift' }, { id: 'jess', how: 'drive' }]);
    expect(gh.describe({ amy: 'Amy', jess: 'Jess' })).toBe('Amy: going to your car, Jess: walking to her car');
    gh.setOff('jess');
    gh.gone('amy');
    expect(gh.describe({ amy: 'Amy', jess: 'Jess' })).toBe('Amy: gone, Jess: driving off');
    expect(new GoingHome().describe()).toBe('nobody is going home');
  });
});

describe('the way out', () => {
  it('runs from in front of each car, through the big gate and away down the lane', () => {
    for (const slot of [LAYOUT.cars.finch, LAYOUT.cars.griffin]) {
      const route = leaveRoute(slot, LAYOUT);
      expect(route[0].x).toBeGreaterThan(slot.x); // heading south-east from the swung-round car
      expect(route[0].z).toBeGreaterThan(slot.z); // the car has been swung round to face the road, to the south
      const gate = route.findIndex((pt) => pt.x > LAYOUT.farm.maxX - 3 && Math.abs(pt.z - LAYOUT.road.z) < LAYOUT.road.gate.width / 2);
      expect(gate).toBeGreaterThan(0);
      const last = route[route.length - 1];
      expect(last.x).toBe(LAYOUT.publicLane.x);
      expect(last.z).toBe(DEFAULT_GOING_HOME_PARAMS.laneZ);
      expect(last.z).toBeLessThan(LAYOUT.publicLane.open.maxZ);
    }
  });

  it('keeps Jess faster than Amy on the way out', async () => {
    const { CarGo } = await import('../src/npc/carGo.js');
    const car = new CarGo();
    expect(car.driveFor('jess').speedMax).toBeGreaterThan(car.driveFor('amy').speedMax);
  });

  it('has a range for every tunable', () => {
    expect(Object.keys(GOING_HOME_PARAM_RANGES).sort()).toEqual(Object.keys(DEFAULT_GOING_HOME_PARAMS).sort());
  });

  it('has lines for leaving: both girls say they are off, Amy tuts at Jess, and a lift waits', () => {
    for (const k of ['carHome', 'liftHome']) {
      expect(AMY_CAR_LINES[k].lines.length).toBeGreaterThan(0);
      expect(JESS_CAR_LINES[k].length).toBeGreaterThan(0);
    }
    expect(AMY_CAR_LINES.carJessFast.lines.length).toBeGreaterThan(0);
  });
});
