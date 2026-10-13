import { describe, it, expect } from 'vitest';
import { FireSit, DEFAULT_FIRE_SIT_PARAMS as P, FIRE_SIT_PARAM_RANGES } from '../src/npc/fireSit.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';

const girls = [{ id: 'amy', free: true, distance: 30 }, { id: 'jess', free: true, distance: 30 }];
const ctx = (o = {}) => ({ blazing: true, seats: 4, rain: 0, darkness: 0, girls, ...o });

describe('sitting round the fire', () => {
  it('has a range for every tunable and a kind in the chooser', () => {
    for (const k of Object.keys(P)) expect(FIRE_SIT_PARAM_RANGES[k], k).toBeTruthy();
    expect(OFFER_KINDS.fire).toBeTruthy();
  });

  it('is offered only to a free girl, near enough, with the fire blazing, a seat free and dry weather', () => {
    const f = new FireSit({ ...P });
    expect(f.offers(ctx()).map((o) => o.girl)).toEqual(['amy', 'jess']);
    expect(f.offers(ctx({ blazing: false }))).toEqual([]);
    expect(f.offers(ctx({ seats: 0 }))).toEqual([]);
    expect(f.offers(ctx({ rain: 0.5 }))).toEqual([]);
    expect(f.offers(ctx({ girls: [{ id: 'amy', free: false, distance: 5 }, { id: 'jess', free: true, distance: 500 }] }))).toEqual([]);
  });

  it('is keener as it gets dark', () => {
    const f = new FireSit({ ...P });
    expect(f.offers(ctx({ darkness: 1 }))[0].weight).toBeGreaterThan(f.offers(ctx({ darkness: 0 }))[0].weight);
  });

  it('gives each girl her own log', () => {
    const f = new FireSit({ ...P });
    const a = f.begin('amy', 'offer', f.seatsLeft(4));
    const j = f.begin('jess', 'offer', f.seatsLeft(4));
    expect(a.seat).not.toBe(j.seat);
    expect(f.begin('amy', 'asked', f.seatsLeft(4))).toBeNull();
    expect(f.seatsLeft(4)).toHaveLength(2);
    expect(f.offers(ctx()).map((o) => o.girl)).toEqual([]);
  });

  it('walks, sits, speaks and ends', () => {
    const f = new FireSit({ ...P });
    f.begin('amy', 'offer', f.seatsLeft(4));
    const says = [];
    const state = { amy: { free: true, seated: false, youNear: true, favoured: true } };
    f.update(1, { blazing: true, girls: state });
    expect(f.sitting('amy')).toBe(false);
    state.amy.seated = true;
    says.push(...f.update(1, { blazing: true, girls: state }));
    expect(f.sitting('amy')).toBe(true);
    let end;
    for (let i = 0; i < P.sitSeconds + 5 && !end; i++) {
      const ev = f.update(1, { blazing: true, girls: state });
      says.push(...ev);
      end = ev.find((e) => e.type === 'end');
    }
    expect(says.filter((e) => e.type === 'say').map((e) => e.line)).toEqual(['fireSit', 'fireWarm', 'fireRomance', 'fireDone']);
    expect(end).toEqual({ type: 'end', girl: 'amy', why: 'done' });
    expect(f.active).toBe(false);
    expect(f.offers(ctx()).map((o) => o.girl)).toEqual(['jess']); // amy has had her sit for now
  });

  it('only says the quiet one to the girl you are near and have favoured', () => {
    const f = new FireSit({ ...P });
    f.begin('amy', 'offer', f.seatsLeft(4));
    const lines = [];
    for (let i = 0; i < P.sitSeconds + 5; i++) {
      lines.push(...f.update(1, { blazing: true, girls: { amy: { free: true, seated: true, youNear: false, favoured: true } } }).filter((e) => e.type === 'say').map((e) => e.line));
    }
    expect(lines).not.toContain('fireRomance');
  });

  it('gets up and says so when the fire dies', () => {
    const f = new FireSit({ ...P });
    f.begin('jess', 'offer', f.seatsLeft(4));
    const g = { jess: { free: true, seated: true } };
    f.update(1, { blazing: true, girls: g });
    const ev = f.update(1, { blazing: false, girls: g });
    expect(ev.map((e) => e.line ?? e.why)).toEqual(['fireOut', 'out']);
  });

  it('gives up if she cannot get there, or is lost', () => {
    const f = new FireSit({ ...P });
    f.begin('amy', 'offer', f.seatsLeft(4));
    expect(f.update(P.goTimeout + 1, { blazing: true, girls: { amy: { free: true, seated: false } } })).toEqual([{ type: 'end', girl: 'amy', why: 'lost' }]);
    f.begin('jess', 'offer', f.seatsLeft(4));
    expect(f.update(1, { blazing: true, girls: {} })).toEqual([{ type: 'end', girl: 'jess', why: 'lost' }]);
  });
});
