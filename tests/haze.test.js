import { describe, it, expect } from 'vitest';
import { Haze, hazeOutput, DEFAULT_HAZE_PARAMS as P } from '../src/world/haze.js';
import { AMY_SMOKE_LINES, JESS_SMOKE_LINES } from '../src/npc/smokeLines.js';

const yard = { x: 0, z: 0 };
const engine = (o = {}) => ({ x: 3, z: 3, running: true, throttle: 0, twoStroke: false, diesel: false, ...o });
const FOG = 0.3;
const OVERCAST = 1;
const run = (h, ctx, seconds) => {
  const events = [];
  for (let t = 0; t < seconds; t += 0.5) events.push(...h.update(0.5, ctx));
  return events;
};
const ctx = (o = {}) => ({ wind: FOG, rain: 0, engines: [engine(), engine({ x: -3 })], girls: [], ...o });

describe('smoke haze in the yard', () => {
  it('only running engines in the yard feed it, more on the throttle, more from a two-stroke or a diesel', () => {
    expect(hazeOutput(engine({ running: false }), yard, P)).toBe(0);
    expect(hazeOutput(engine({ x: 200 }), yard, P)).toBe(0);
    expect(hazeOutput(engine({ throttle: 1 }), yard, P)).toBeGreaterThan(hazeOutput(engine(), yard, P));
    expect(hazeOutput(engine({ twoStroke: true }), yard, P)).toBeGreaterThan(hazeOutput(engine(), yard, P));
    expect(hazeOutput(engine({ diesel: true }), yard, P)).toBeGreaterThan(hazeOutput(engine(), yard, P));
  });

  it('builds over a couple of minutes of idling on a foggy day, and you can see it', () => {
    const h = new Haze(yard);
    run(h, ctx(), 150);
    expect(h.visible).toBe(true);
    expect(h.level).toBeGreaterThan(0.6);
  });

  it('the same idling on an ordinary overcast day never gets thick, because the wind takes it', () => {
    const h = new Haze(yard);
    run(h, ctx({ wind: OVERCAST }), 600);
    expect(h.level).toBeLessThan(P.coughAt);
  });

  it('lingers in still air after the engines go off, and rain clears it faster', () => {
    const still = new Haze(yard);
    const wet = new Haze(yard);
    for (const h of [still, wet]) run(h, ctx(), 150);
    run(still, ctx({ engines: [] }), 60);
    run(wet, ctx({ engines: [], rain: 1 }), 60);
    expect(still.level).toBeGreaterThan(0.3);
    expect(wet.level).toBeLessThan(still.level * 0.6);
  });

  it('a girl stood about in thick haze coughs once it has caught her, then not again for a while', () => {
    const h = new Haze(yard);
    const girls = [{ id: 'amy', x: 5, z: 0, free: true }];
    const events = run(h, ctx({ girls }), 400);
    expect(events.filter((e) => e.girl === 'amy').length).toBeGreaterThan(0);
    expect(events.length).toBeLessThanOrEqual(Math.ceil(400 / P.coughGap));
  });

  it('a girl riding, or well away from the yard, does not cough', () => {
    const h = new Haze(yard);
    const girls = [{ id: 'amy', x: 5, z: 0, free: false }, { id: 'jess', x: 300, z: 0, free: true }];
    expect(run(h, ctx({ girls }), 300)).toEqual([]);
  });

  it('both girls have a line for it', () => {
    expect(AMY_SMOKE_LINES.hazeCough.lines.length).toBeGreaterThan(0);
    expect(JESS_SMOKE_LINES.hazeCough.length).toBeGreaterThan(0);
  });
});
