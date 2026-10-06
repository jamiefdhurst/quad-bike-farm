import { describe, it, expect } from 'vitest';
import { Jumpers, DEFAULT_JUMPER_PARAMS, isJumperWeather, JUMPERS } from '../src/npc/jumpers.js';

const P = { ...DEFAULT_JUMPER_PARAMS, startAfter: 0, coldFor: 5, warmFor: 10, chance: 1 };
const rail = { x: 0, z: 0 };
const girl = (id, over = {}) => ({ id, free: true, x: 10, z: 0, ...over });
const cold = { warmth: 0.2, rain: 0 };
const warm = { warmth: 0.9, rain: 0 };

/** Steps for `secs` seconds and collects events. */
function run(j, secs, ctx) {
  const out = [];
  for (let t = 0; t < secs; t += 1) out.push(...j.update(1, ctx));
  return out;
}

describe('isJumperWeather', () => {
  it('is cold or wet, not sunny and dry', () => {
    expect(isJumperWeather(cold, P)).toBe(true);
    expect(isJumperWeather({ warmth: 0.9, rain: 0.6 }, P)).toBe(true);
    expect(isJumperWeather(warm, P)).toBe(false);
  });
});

describe('Jumpers', () => {
  it('sends nobody for a jumper on a warm day', () => {
    const j = new Jumpers({ ...P }, () => 0);
    expect(run(j, 60, { weather: warm, girls: [girl('amy')], rail })).toEqual([]);
  });

  it('waits until she has been cold a while', () => {
    const j = new Jumpers({ ...P }, () => 0);
    expect(run(j, 4, { weather: cold, girls: [girl('amy')], rail })).toEqual([]);
    expect(run(j, 3, { weather: cold, girls: [girl('amy')], rail })[0]).toMatchObject({ type: 'fetch', girl: 'amy' });
  });

  it('does not send a girl who is busy, or too far away', () => {
    const j = new Jumpers({ ...P }, () => 0);
    expect(run(j, 30, { weather: cold, girls: [girl('amy', { free: false }), girl('jess', { x: 900 })], rail })).toEqual([]);
  });

  it('gives each girl a different jumper and stops at two', () => {
    const j = new Jumpers({ ...P }, () => 0);
    const girls = [girl('amy'), girl('jess'), girl('third')];
    const fetches = run(j, 30, { weather: cold, girls, rail }).filter((e) => e.type === 'fetch');
    expect(fetches).toHaveLength(JUMPERS.length);
    expect(new Set(fetches.map((e) => e.jumper)).size).toBe(JUMPERS.length);
  });

  it('only asks once while she is on her way, and forgets it after the timeout', () => {
    const j = new Jumpers({ ...P, timeout: 20 }, () => 0);
    const ctx = { weather: cold, girls: [girl('amy')], rail };
    expect(run(j, 15, ctx).filter((e) => e.type === 'fetch')).toHaveLength(1);
    expect(run(j, 15, ctx).filter((e) => e.type === 'fetch').length).toBeGreaterThan(0);
  });

  it('puts it on, then hangs it up after a warm spell', () => {
    const j = new Jumpers({ ...P }, () => 0);
    run(j, 10, { weather: cold, girls: [girl('amy')], rail });
    j.dressed('amy', 'grey');
    expect(j.onRail().map((x) => x.id)).toEqual(['beige']);
    expect(run(j, 30, { weather: cold, girls: [girl('amy')], rail })).toEqual([]);
    const events = run(j, 15, { weather: warm, girls: [girl('amy')], rail });
    expect(events[0]).toMatchObject({ type: 'hang', girl: 'amy', jumper: 'grey' });
    j.hung('amy');
    expect(j.onRail()).toHaveLength(2);
  });

  it('a shower resets the warm spell', () => {
    const j = new Jumpers({ ...P }, () => 0);
    j.dressed('amy', 'grey');
    const ctx = (weather) => ({ weather, girls: [girl('amy')], rail });
    run(j, 8, ctx(warm));
    run(j, 1, ctx(cold));
    expect(run(j, 8, ctx(warm))).toEqual([]);
  });

  it('forced, fetches at once', () => {
    const j = new Jumpers({ ...P, startAfter: 999, coldFor: 999 }, () => 1);
    j.forced = true;
    expect(j.update(1, { weather: cold, girls: [girl('amy')], rail })[0]).toMatchObject({ type: 'fetch' });
  });
});

describe('jumper lines and outfit', () => {
  it('both girls have lines for putting one on and taking it off', async () => {
    const { AMY_JUMPER_LINES, JESS_JUMPER_LINES } = await import('../src/npc/jumperLines.js');
    for (const k of ['jumperOn', 'jumperOff']) {
      expect(AMY_JUMPER_LINES[k].lines.length).toBeGreaterThan(0);
      expect(JESS_JUMPER_LINES[k].length).toBeGreaterThan(0);
    }
  });

  it('withJumper adds and removes a jumper without touching the rest', async () => {
    const { OUTFITS, withJumper } = await import('../src/npc/outfit.js');
    const on = withJumper(OUTFITS.farmPolo, '#7b7d80');
    expect(on.jumper).toBe('#7b7d80');
    expect(on.collar).toBe(OUTFITS.farmPolo.collar);
    expect(withJumper(on, null).jumper).toBeUndefined();
    expect(OUTFITS.farmPolo.jumper).toBeUndefined();
  });
});

describe('asked for from the debug panel', () => {
  it('sends her whatever the weather, keeps it on, and takes it off when asked again', () => {
    const j = new Jumpers({ ...P, startAfter: 999, coldFor: 999, chance: 0 }, () => 1);
    const ctx = { weather: warm, girls: [girl('amy')], rail };
    expect(j.toggle('amy')).toBe('fetch');
    expect(j.update(1, ctx)[0]).toMatchObject({ type: 'fetch', girl: 'amy' });
    j.dressed('amy', 'grey');
    expect(run(j, 300, ctx)).toEqual([]); // warm, but she keeps it on: it was asked for
    expect(j.toggle('amy')).toBe('hang');
    expect(j.update(1, ctx)[0]).toMatchObject({ type: 'hang', girl: 'amy', jumper: 'grey' });
  });

  it('waits until she is free', () => {
    const j = new Jumpers({ ...P, startAfter: 999, chance: 0 }, () => 1);
    j.toggle('amy');
    expect(j.update(1, { weather: warm, girls: [girl('amy', { free: false })], rail })).toEqual([]);
    expect(j.update(1, { weather: warm, girls: [girl('amy')], rail })).toHaveLength(1);
  });
});
