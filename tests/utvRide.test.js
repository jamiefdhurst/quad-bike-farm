import { describe, it, expect } from 'vitest';
import { UtvRide, planSeats, DEFAULT_UTV_RIDE_PARAMS as P } from '../src/npc/utvRide.js';

const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const always = (v) => () => v;
const none = new Set();

const girl = (id, o = {}) => ({ id, free: true, seat: null, dist: 8, ...o });
const stopped = { active: true, riding: true, speed: 0, slide: false };

/** Steps for `seconds` and gathers every event. */
function run(ride, ctxOf, seconds, dt = 0.1) {
  const events = [];
  for (let t = 0; t < seconds; t += dt) events.push(...ride.update(dt, ctxOf()));
  return events;
}

describe('planSeats', () => {
  it('gives two girls the middle and the window, with a row over the middle when they squabble', () => {
    const rolls = [0, 0, 0.99]; // squabbles, Jess wins, the loser does not go in the bed
    const plan = planSeats(['amy', 'jess'], none, () => rolls.shift() ?? 0.99, P);
    expect(plan.squabble).toEqual({ winner: 'jess', loser: 'amy' });
    expect(plan.seats[0]).toEqual({ id: 'jess', seat: 'mid' });
    expect(plan.seats[1]).toEqual({ id: 'amy', seat: 'left' });
  });

  it('lets Amy win the row sometimes', () => {
    const rolls = [0, 0.9, 0.9]; // squabbles, Jess loses the toss, nobody goes in the bed
    const plan = planSeats(['amy', 'jess'], none, () => rolls.shift() ?? 0.99, P);
    expect(plan.squabble).toEqual({ winner: 'amy', loser: 'jess' });
    expect(plan.seats[0]).toEqual({ id: 'amy', seat: 'mid' });
  });

  it('sends the loser to the bed now and then, more often Jess than Amy', () => {
    const rolls = [0, 0.5, 0.01]; // squabbles, Jess wins, the loser's bed roll is lucky for the bed
    const plan = planSeats(['amy', 'jess'], none, () => rolls.shift() ?? 0.99, P);
    expect(plan.seats).toContainEqual({ id: 'amy', seat: 'bed' }); // 0.01 is under even Amy's tiny chance
    const rolls2 = [0, 0.9, 0.2]; // Amy wins, Jess loses and 0.2 is under jessBedLoseChance
    const plan2 = planSeats(['amy', 'jess'], none, () => rolls2.shift() ?? 0.99, P);
    expect(plan2.seats).toContainEqual({ id: 'jess', seat: 'bed' });
    expect(P.jessBedLoseChance).toBeGreaterThan(P.amyBedLoseChance);
  });

  it('puts a girl alone in the bed with her own chance, Jess far likelier than Amy', () => {
    expect(planSeats(['jess'], none, always(0.1), P).seats).toEqual([{ id: 'jess', seat: 'bed' }]);
    expect(planSeats(['amy'], none, always(0.1), P).seats).toEqual([{ id: 'amy', seat: 'mid' }]);
    expect(planSeats(['amy'], none, always(0.01), P).seats).toEqual([{ id: 'amy', seat: 'bed' }]);
  });

  it('takes what is left when seats are already taken, and nothing when there is nothing', () => {
    expect(planSeats(['amy'], new Set(['mid']), always(0.9), P).seats).toEqual([{ id: 'amy', seat: 'left' }]);
    expect(planSeats(['amy'], new Set(['mid', 'left']), always(0.9), P).seats).toEqual([{ id: 'amy', seat: 'bed' }]);
    expect(planSeats(['amy'], new Set(['mid', 'left', 'bed']), always(0.9), P).seats).toEqual([]);
  });

  it('never seats two girls in the same place', () => {
    const random = seeded(7);
    for (let i = 0; i < 300; i++) {
      const { seats } = planSeats(['amy', 'jess'], none, random, P);
      expect(new Set(seats.map((s) => s.seat)).size).toBe(seats.length);
      expect(new Set(seats.map((s) => s.id)).size).toBe(seats.length);
    }
  });
});

describe('UtvRide', () => {
  const sure = { ...P, boardChance: 1, bothChance: 1, squabbleChance: 1, jessBedChance: 0, amyBedChance: 0, jessBedLoseChance: 0, amyBedLoseChance: 0 };

  it('has a girl climb in after a stop, and both when they both come, the winner first', () => {
    const ride = new UtvRide({ ...sure }, always(0));
    const girls = [girl('amy'), girl('jess')];
    const events = run(ride, () => ({ ...stopped, girls }), 15);
    const boards = events.filter((e) => e.type === 'board');
    expect(boards.map((b) => [b.girl, b.seat])).toEqual([['jess', 'mid'], ['amy', 'left']]);
    expect(boards[0].squabble).toEqual({ winner: 'jess', loser: 'amy' });
    expect(boards[1].squabble).toBeNull();
  });

  it('does nothing while it is moving, with the engine off, or when nobody is about', () => {
    const ride = new UtvRide({ ...sure }, always(0));
    const girls = [girl('amy')];
    expect(run(ride, () => ({ ...stopped, speed: 5, girls }), 10)).toEqual([]);
    expect(run(ride, () => ({ ...stopped, active: false, girls }), 10)).toEqual([]);
    expect(run(ride, () => ({ ...stopped, girls: [girl('amy', { free: false }), girl('jess', { dist: 99 })] }), 10)).toEqual([]);
  });

  it('rolls a stop once', () => {
    const ride = new UtvRide({ ...P, boardChance: 0 }, always(0));
    const girls = [girl('amy')];
    run(ride, () => ({ ...stopped, girls }), 20);
    expect(ride.rolled).toBe(true);
    expect(ride.queue).toEqual([]);
  });

  it('has the other girl tell her off once she is in the bed, and not before she is up there', () => {
    const ride = new UtvRide({ ...P, tellMin: 1, tellMax: 1 }, always(0));
    const girls = [girl('amy'), girl('jess', { seat: 'bed' })];
    const events = run(ride, () => ({ ...stopped, active: false, girls }), 6);
    expect(events.filter((e) => e.type === 'bedTell')).toEqual([{ type: 'bedTell', girl: 'amy', target: 'jess' }]);
    expect(run(new UtvRide({ ...P }, always(0)), () => ({ ...stopped, girls: [girl('amy'), girl('jess', { seat: 'mid' })] }), 20).filter((e) => e.type === 'bedTell')).toEqual([]);
  });

  it('has her complain about the bouncing only when it is going', () => {
    const ride = new UtvRide({ ...P, bedShoutMin: 5, bedShoutMax: 5 }, always(0));
    const girls = [girl('jess', { seat: 'bed' })];
    expect(run(ride, () => ({ ...stopped, speed: 2, girls }), 20).filter((e) => e.type === 'bedShout')).toEqual([]);
    const shouts = run(ride, () => ({ ...stopped, speed: P.bedShoutSpeed + 2, girls }), 20).filter((e) => e.type === 'bedShout');
    expect(shouts.length).toBeGreaterThanOrEqual(3);
  });

  it('slides whoever is in the bed off when it is tipped up, and nobody in a seat', () => {
    const ride = new UtvRide({ ...P }, always(0));
    const girls = [girl('jess', { seat: 'bed' }), girl('amy', { seat: 'mid' })];
    const events = ride.update(0.1, { ...stopped, slide: true, girls });
    expect(events.filter((e) => e.type === 'slide')).toEqual([{ type: 'slide', girl: 'jess' }]);
  });

  it('has them climb out once you get off, unless you asked them in', () => {
    const ride = new UtvRide({ ...P }, always(0));
    ride.ask('amy');
    const girls = [girl('amy', { seat: 'mid' }), girl('jess', { seat: 'left' })];
    const events = run(ride, () => ({ ...stopped, active: false, riding: false, girls }), 3);
    expect([...new Set(events.filter((e) => e.type === 'leave').map((e) => e.girl))]).toEqual(['jess']);
    ride.dismiss('amy');
    expect(run(ride, () => ({ ...stopped, active: false, riding: false, girls }), 3).filter((e) => e.girl === 'amy' && e.type === 'leave').length).toBeGreaterThan(0);
  });

  it('gets bored and climbs out in the end, and clearing her forgets everything about her', () => {
    const ride = new UtvRide({ ...P, stayMin: 10, stayMax: 10 }, always(0));
    const girls = [girl('amy', { seat: 'left' })];
    const events = run(ride, () => ({ ...stopped, girls }), 12);
    expect(events.find((e) => e.type === 'leave')).toMatchObject({ girl: 'amy', bored: true });
    ride.clear('amy');
    expect(ride.girl('amy').aboardFor).toBe(0);
  });
});

describe('a parked UTV', () => {
  const parked = { active: false, riding: false, parked: true, speed: 0, slide: false };

  it('has a girl who is stood about get in by herself now and then, and stay put', () => {
    const ride = new UtvRide({ ...P }, always(0));
    const events = run(ride, () => ({ ...parked, girls: [girl('amy')] }), 1);
    const board = events.find((e) => e.type === 'board');
    expect(board).toMatchObject({ girl: 'amy' });
    expect(['mid', 'left', 'bed']).toContain(board.seat);
    const aboard = { ...parked, girls: [girl('amy', { seat: 'mid', free: false })] };
    expect(run(ride, () => aboard, 20).filter((e) => e.type === 'leave')).toEqual([]);
  });

  it('does nothing with a low chance, or when somebody is in it', () => {
    expect(run(new UtvRide({ ...P }, always(0.5)), () => ({ ...parked, girls: [girl('amy')] }), 60)).toEqual([]);
    expect(run(new UtvRide({ ...P }, always(0)), () => ({ ...parked, parked: false, girls: [girl('amy')] }), 2)).toEqual([]);
  });
});
