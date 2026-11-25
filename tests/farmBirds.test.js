import { describe, it, expect } from 'vitest';
import { birdsDue, chorusSeason, songSpots, FarmBirds, SINGERS, DEFAULT_FARM_BIRD_PARAMS, FARM_BIRD_PARAM_RANGES } from '../src/world/farmBirds.js';
import { createRandom } from '../src/core/random.js';
import { boundary, gap } from '../src/world/fieldPlan.js';

// The farm's birds by day (#124): the dawn chorus and the rooks at dusk. Nothing here makes a sound.
const sun = { sunrise: 7.25, sunset: 17.25 }; // an October day's
const april = { month: 3 };

describe('which birds are due', () => {
  it('has the chorus from about half an hour before sunrise to two hours after, and the rooks in the hour before sunset, neither at midday or midnight', () => {
    expect(birdsDue(sun.sunrise - 0.5, sun, april).chorus).toBe(1);
    expect(birdsDue(sun.sunrise, sun, april).chorus).toBe(1);
    expect(birdsDue(sun.sunrise + 0.75, sun, april).chorus).toBe(1);
    expect(birdsDue(sun.sunrise + 1.5, sun, april).chorus).toBeGreaterThan(0); // thinning to the odd song
    expect(birdsDue(sun.sunrise + 1.5, sun, april).chorus).toBeLessThan(0.5);
    expect(birdsDue(sun.sunrise + 2, sun, april).chorus).toBe(0);
    expect(birdsDue(sun.sunrise - 1, sun, april).chorus).toBe(0);
    expect(birdsDue(sun.sunset - 0.5, sun, april).rooks).toBe(1);
    expect(birdsDue(sun.sunset - 1, sun, april).rooks).toBe(0);
    expect(birdsDue(sun.sunset + 0.1, sun, april).rooks).toBe(0);
    for (const hour of [12, 24, 0]) expect(birdsDue(hour, sun, april)).toEqual({ chorus: 0, rooks: 0 });
    expect(birdsDue(sun.sunset - 0.5, sun, april).chorus).toBe(0);
    expect(birdsDue(sun.sunrise, sun, april).rooks).toBe(0);
  });

  it('follows the day\'s own sunrise and sunset, so a summer dawn comes early', () => {
    const june = { sunrise: 4.75, sunset: 21.5 };
    expect(birdsDue(4.5, june, { month: 5 }).chorus).toBe(1);
    expect(birdsDue(7.25, june, { month: 5 }).chorus).toBe(0);
    expect(birdsDue(21, june, { month: 5 }).rooks).toBe(1);
  });

  it('is thickest in spring, thinner in the winter and the late-summer moult, and quieter in the rain', () => {
    expect(chorusSeason(3)).toBe(1);
    expect(chorusSeason(11)).toBeLessThan(1);
    expect(chorusSeason(7)).toBeLessThan(chorusSeason(11));
    const dry = birdsDue(sun.sunrise, sun, april);
    const wet = birdsDue(sun.sunrise, sun, { month: 3, rain: 1 });
    expect(wet.chorus).toBeLessThan(dry.chorus * 0.5);
    expect(wet.rooks).toBe(0);
    expect(birdsDue(sun.sunset - 0.5, sun, { month: 3, rain: 1 }).rooks).toBe(0.5);
  });
});

describe('where they sing from', () => {
  const hedges = [boundary(-60, 0, 60, 0, [gap(52.5, 6)])]; // the gap is 52.5 m along, at x -7.5, where a spot would be
  const inGap = (h, s) => h.gaps.some((g) => Math.abs(s - g.at) < g.half);

  it('takes a spot every 15 m along a hedge, none in a gap, and every tree', () => {
    const s = songSpots(hedges, inGap, [[5, 30]]);
    const along = s.filter((p) => p.z === 0);
    expect(along.length).toBe(7); // 120 m: 8 spots, the one at the gap left out
    expect(along.some((p) => Math.abs(p.x + 7.5) < 3)).toBe(false);
    expect(s).toContainEqual({ x: 5, z: 30 });
  });
});

const spotsRound = (n = 40, r = 60) => Array.from({ length: n }, (_, i) => ({ x: Math.cos(i) * r * (0.3 + (i % 5) / 5), z: Math.sin(i) * r * (0.3 + (i % 5) / 5) }));
const run = (birds, seconds, due, you = { x: 0, z: 0 }, dt = 0.1) => {
  const events = [];
  let most = 0;
  for (let t = 0; t < seconds; t += dt) {
    events.push(...birds.update(dt, due, you));
    most = Math.max(most, birds.sounding());
  }
  return { events, most };
};

describe('the dawn chorus', () => {
  it('sings from spots near you, never more than six at once, blackbirds, robins and wrens all', () => {
    const far = { x: 500, z: 500 };
    const birds = new FarmBirds({ spots: [...spotsRound(), far], random: createRandom(4) });
    const { events, most } = run(birds, 120, { chorus: 1, rooks: 0 });
    const songs = events.filter((e) => e.kind === 'song');
    expect(songs.length).toBeGreaterThan(60);
    expect(most).toBeLessThanOrEqual(DEFAULT_FARM_BIRD_PARAMS.maxVoices);
    expect(most).toBeGreaterThanOrEqual(4); // thick at first light
    for (const s of songs) expect(Math.hypot(s.x, s.z)).toBeLessThanOrEqual(DEFAULT_FARM_BIRD_PARAMS.singerReach);
    expect(new Set(songs.map((s) => s.species))).toEqual(new Set(Object.keys(SINGERS)));
  });

  it('thins to the odd song as it fades, and sings nothing at midday or where there is no hedge or tree in reach', () => {
    const thick = run(new FarmBirds({ spots: spotsRound(), random: createRandom(5) }), 120, { chorus: 1, rooks: 0 }).events.length;
    const thin = run(new FarmBirds({ spots: spotsRound(), random: createRandom(5) }), 120, { chorus: 0.1, rooks: 0 }).events.length;
    expect(thin).toBeLessThan(thick / 4);
    expect(thin).toBeGreaterThan(0);
    expect(run(new FarmBirds({ spots: spotsRound(), random: createRandom(5) }), 120, { chorus: 0, rooks: 0 }).events).toEqual([]);
    expect(run(new FarmBirds({ spots: spotsRound(), random: createRandom(5) }), 60, { chorus: 1, rooks: 0 }, { x: 900, z: 0 }).events).toEqual([]);
  });

  it('sings at midday for a minute and a half when started by hand, then stops', () => {
    const birds = new FarmBirds({ spots: spotsRound(), random: createRandom(6) });
    expect(birds.force('chorus')).toBe(true);
    expect(run(birds, 80, { chorus: 0, rooks: 0 }).events.length).toBeGreaterThan(30);
    run(birds, 20, { chorus: 0, rooks: 0 });
    expect(run(birds, 60, { chorus: 0, rooks: 0 }).events).toEqual([]);
    expect(birds.force('owl')).toBe(false);
  });
});

describe('rooks going over at dusk', () => {
  it('sends a flock now and then, each crossing the sky in one direction with its caws in order along it', () => {
    const birds = new FarmBirds({ spots: [], random: createRandom(7) });
    const flocks = run(birds, 3600, { chorus: 0, rooks: 1 }).events.filter((e) => e.kind === 'flock');
    expect(flocks.length).toBeGreaterThanOrEqual(10); // about one every 200 s
    expect(flocks.length).toBeLessThanOrEqual(30);
    for (const f of flocks) {
      expect(f.caws.length).toBeGreaterThanOrEqual(8);
      const dx = Math.cos(f.heading);
      const dz = Math.sin(f.heading);
      const along = f.caws.map((c) => c.x * dx + c.z * dz);
      for (let i = 1; i < f.caws.length; i++) {
        expect(f.caws[i].at).toBeGreaterThan(f.caws[i - 1].at);
        expect(along[i]).toBeGreaterThan(along[i - 1] - 17); // onward, give or take the flock's spread
      }
      expect(along[along.length - 1] - along[0]).toBeGreaterThan(120);
      const across = f.caws.map((c) => Math.abs(-c.x * dz + c.z * dx));
      expect(Math.min(...across)).toBeLessThan(70); // it passes near you
      expect(f.height).toBeGreaterThanOrEqual(30);
    }
  });

  it('sends none outside the evening, and one at once when sent over by hand', () => {
    const birds = new FarmBirds({ spots: [], random: createRandom(8) });
    expect(run(birds, 1200, { chorus: 0, rooks: 0 }).events).toEqual([]);
    birds.force('rooks');
    const once = run(birds, 600, { chorus: 0, rooks: 0 }).events;
    expect(once.length).toBe(1);
    expect(once[0].kind).toBe('flock');
  });

  it('waits for room among the voices rather than going over six', () => {
    const birds = new FarmBirds({ spots: spotsRound(), random: createRandom(9), params: { ...DEFAULT_FARM_BIRD_PARAMS, rookEvery: 20 } });
    const { most } = run(birds, 600, { chorus: 1, rooks: 1 });
    expect(most).toBeLessThanOrEqual(DEFAULT_FARM_BIRD_PARAMS.maxVoices);
  });
});

describe('its tunables', () => {
  it('has a range for each, with the default inside it', () => {
    expect(Object.keys(FARM_BIRD_PARAM_RANGES).sort()).toEqual(Object.keys(DEFAULT_FARM_BIRD_PARAMS).sort());
    for (const [k, [lo, hi]] of Object.entries(FARM_BIRD_PARAM_RANGES)) {
      expect(DEFAULT_FARM_BIRD_PARAMS[k]).toBeGreaterThanOrEqual(lo);
      expect(DEFAULT_FARM_BIRD_PARAMS[k]).toBeLessThanOrEqual(hi);
    }
  });
});
