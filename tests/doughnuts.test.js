import { describe, it, expect } from 'vitest';
import { doughnutControl, ringPoints, DoughnutWatch, DEFAULT_DOUGHNUT_PARAMS as P } from '../src/npc/doughnuts.js';
import { HerDrive } from '../src/npc/herDriving.js';
import { DEFAULT_COMPANION_PARAMS } from '../src/npc/companionParams.js';
import { AMY_DOUGHNUT_LINES, JESS_DOUGHNUT_LINES } from '../src/npc/doughnutLines.js';
import { boredOdds, BORED_NORM } from '../src/npc/boredom.js';
import { choose } from '../src/npc/chooser.js';

describe('going round a circle', () => {
  // A little kinematic quad: forward at `v`, turning at up to v / minRadius.
  function spin(dir, start, { v = 6, minRadius = 3, seconds = 40 } = {}) {
    const centre = { x: 0, z: 0 };
    let { x, z, yaw } = start;
    let worst = 0;
    for (let t = 0; t < seconds; t += 0.05) {
      const k = doughnutControl({ x, z }, yaw, centre, P.radius, dir, P);
      yaw += k.steer * (v / minRadius) * 0.05 * (dir > 0 ? 1 : 1);
      x += Math.sin(yaw) * v * 0.05;
      z += Math.cos(yaw) * v * 0.05;
      if (t > 15) worst = Math.max(worst, Math.abs(Math.hypot(x, z) - P.radius));
    }
    return worst;
  }

  it('settles into the circle, going round either way, from a start on it, outside it or inside it', () => {
    for (const dir of [1, -1]) {
      for (const start of [{ x: 0, z: P.radius, yaw: dir * Math.PI / 2 }, { x: 9, z: 0, yaw: Math.PI }, { x: 0.5, z: 1, yaw: 0.3 }]) {
        expect(spin(dir, start), `dir ${dir} from ${JSON.stringify(start)}`).toBeLessThan(2);
      }
    }
  });

  it('holds the throttle she is told to', () => {
    expect(doughnutControl({ x: 5, z: 0 }, 0, { x: 0, z: 0 }, 5, 1, P).throttle).toBe(P.throttle);
  });

  it('a ring of points all the radius from the middle', () => {
    for (const pt of ringPoints({ x: 3, z: -2 }, 7, 8)) expect(Math.hypot(pt.x - 3, pt.z + 2)).toBeCloseTo(7, 5);
  });
});

describe('her doughnut drive', () => {
  function spinner(extra = {}) {
    const d = Object.create(HerDrive.prototype);
    Object.assign(d, {
      p: { ...DEFAULT_COMPANION_PARAMS, keepRidingAfter: 0 }, // always pulls up
      random: () => 0.5,
      quad: { position: { x: 20, z: 0 }, yaw: 0, forwardSpeed: 0, churn: 0 },
      doughnut: { centre: { x: 0, z: 0 }, radius: 5, dir: 1, seconds: 10, p: { ...P }, spinning: false, t: 0 },
      events: [],
      controls: { throttle: 0, brake: 0, steer: 0, reverse: false },
      integral: 0,
      stopped: null,
      ...extra,
    });
    d.stop = (r) => (d.stopped = r);
    return d;
  }

  it('drives to the circle gently, then spins, tearing the ground up, and stops when her time is up', () => {
    const d = spinner();
    d.driveDoughnut(0.1, 0);
    expect(d.doughnut.spinning).toBe(false);
    expect(d.controls.throttle).toBeGreaterThan(0);
    expect(d.quad.churn).toBe(0);
    d.quad.position = { x: 5, z: 0 };
    d.driveDoughnut(0.1, 3);
    expect(d.doughnut.spinning).toBe(true);
    expect(d.events).toContain('doughnuts');
    expect(d.controls.throttle).toBe(P.throttle);
    expect(d.quad.churn).toBe(P.churn);
    d.driveDoughnut(11, 3);
    expect(d.stopped).toBe('bored');
    expect(d.quad.churn).toBe(0);
  });
});

describe('watching', () => {
  const girls = (o = {}) => [{ id: 'jess', free: false, distance: 0 }, { id: 'amy', free: true, distance: 10, ...o }];
  it('Amy disapproves now and then while Jess spins, if she can see it', () => {
    const w = new DoughnutWatch({ ...P }, () => 0);
    expect(w.update(1, { spinner: 'jess', girls: girls() })).toEqual([{ type: 'watch', girl: 'amy' }]);
    expect(w.update(5, { spinner: 'jess', girls: girls() })).toEqual([]);
    expect(w.update(P.watchGap, { spinner: 'jess', girls: girls() })).toEqual([{ type: 'watch', girl: 'amy' }]);
    expect(new DoughnutWatch({ ...P }, () => 0).update(1, { spinner: 'jess', girls: girls({ distance: 90 }) })).toEqual([]);
    expect(new DoughnutWatch({ ...P }, () => 0).update(1, { spinner: 'jess', girls: girls({ free: false }) })).toEqual([]);
  });

  it('then has a go, if the dice say so, a few seconds after Jess stops', () => {
    const w = new DoughnutWatch({ ...P }, () => 0);
    w.update(1, { spinner: 'jess', girls: girls() });
    expect(w.update(1, { spinner: null, girls: girls() })).toEqual([]);
    const events = w.update(P.joinAfter, { spinner: null, girls: girls() });
    expect(events).toEqual([{ type: 'join', girl: 'amy' }]);
    expect(w.update(10, { spinner: null, girls: girls() })).toEqual([]); // only once
    const no = new DoughnutWatch({ ...P }, () => 0.99);
    no.update(1, { spinner: 'jess', girls: girls() });
    no.update(1, { spinner: null, girls: girls() });
    expect(no.update(P.joinAfter, { spinner: null, girls: girls() })).toEqual([]);
  });
});

/** What the chooser picks for a girl bored through and through, offered these (her odds as weights, no whim). */
const pickOf = (p, kinds) => {
  const odds = boredOdds(p);
  const offers = kinds.map((key) => ({ key, weight: odds[key] / BORED_NORM })).filter((o) => o.weight > 0);
  return choose({ purpose: 1, excitement: 0.5 }, offers, { ...p, chooseWhim: 0, chooseMin: 0 }).pick?.key;
};

describe('deciding to', () => {
  it('only a girl with a chance for it picks it, and only when there is room', () => {
    const base = { boredMountChance: 0, boredStartChance: 0, boredDriveChance: 0, boredDoughnutChance: 1 };
    expect(pickOf(base, ['doughnuts', 'wander'])).toBe('doughnuts');
    expect(pickOf(base, ['wander'])).toBe('wander');
    expect(pickOf({ ...base, boredDoughnutChance: 0 }, ['doughnuts', 'wander'])).toBe('wander');
  });

  it('has lines for deciding, spinning, watching and joining', () => {
    for (const k of ['selfDoughnuts', 'doughnutSpin', 'doughnutWatch', 'doughnutJoin']) {
      expect(AMY_DOUGHNUT_LINES[k].lines.length, k).toBeGreaterThan(0);
      expect(JESS_DOUGHNUT_LINES[k].length, k).toBeGreaterThan(0);
    }
  });
});
