import { describe, it, expect } from 'vitest';
import { HutStay, DEFAULT_HUT_STAY_PARAMS as P, HUT_STAY_PARAM_RANGES, coldness, wantsFire } from '../src/npc/hutStay.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';
import { AMY_HUT_LINES, JESS_HUT_LINES } from '../src/npc/hutLines.js';

const girls = [{ id: 'amy', free: true, distance: 60 }, { id: 'jess', free: true, distance: 60 }];
const ctx = (o = {}) => ({ seats: 2, rain: 0, cold: 0, darkness: 0, stoveWarm: true, girls, ...o });
const live = (o = {}) => ({ rain: 0, cold: 0, darkness: 0, burning: true, fuel: 800, canStoke: true, girls: {}, ...o });

describe('a stay in the shepherd\'s hut', () => {
  it('has a range for every tunable, a kind in the chooser and every line it says for both girls', () => {
    for (const k of Object.keys(P)) expect(HUT_STAY_PARAM_RANGES[k], k).toBeTruthy();
    expect(OFFER_KINDS.hut).toBeTruthy();
    for (const key of ['hutOffer', 'hutYes', 'hutSit', 'hutLight', 'hutWarm', 'hutRain', 'hutTea', 'hutRomance', 'hutDone']) {
      expect(AMY_HUT_LINES[key], key).toBeTruthy();
      expect(JESS_HUT_LINES[key], key).toBeTruthy();
    }
  });

  it('counts cold from 12 degrees down and wants a fire when wet, cold or dark', () => {
    expect(coldness(15)).toBe(0);
    expect(coldness(0)).toBe(1);
    expect(coldness(6)).toBeCloseTo(0.5, 6);
    expect(wantsFire({ rain: 0, cold: 0, darkness: 0 })).toBe(false);
    expect(wantsFire({ rain: 0.5, cold: 0, darkness: 0 })).toBe(true);
    expect(wantsFire({ rain: 0, cold: 0.5, darkness: 0 })).toBe(true);
    expect(wantsFire({ rain: 0, cold: 0, darkness: 0.9 })).toBe(true);
  });

  it('is offered to a free girl near enough, with a seat free', () => {
    const h = new HutStay({ ...P });
    expect(h.offers(ctx()).map((o) => o.girl)).toEqual(['amy', 'jess']);
    expect(h.offers(ctx({ seats: 0 }))).toEqual([]);
    expect(h.offers(ctx({ girls: [{ id: 'amy', free: false, distance: 5 }, { id: 'jess', free: true, distance: 500 }] }))).toEqual([]);
  });

  it('is keener in the rain, the cold and the dark, and shy of an unlit stove on a mild bright day', () => {
    const h = new HutStay({ ...P });
    const base = h.offers(ctx())[0].weight;
    expect(h.offers(ctx({ rain: 1 }))[0].weight).toBeGreaterThan(base);
    expect(h.offers(ctx({ cold: 1 }))[0].weight).toBeGreaterThan(base);
    expect(h.offers(ctx({ darkness: 1 }))[0].weight).toBeGreaterThan(base);
    expect(h.offers(ctx({ stoveWarm: false }))[0].weight).toBeLessThan(base);
    expect(h.offers(ctx({ stoveWarm: false, rain: 1 }))[0].weight).toBeGreaterThan(base); // it will be lit for her
  });

  it('gives each girl her own place on the bunk', () => {
    const h = new HutStay({ ...P });
    const a = h.begin('amy', 'offer', h.seatsLeft(2));
    const j = h.begin('jess', 'offer', h.seatsLeft(2));
    expect(a.seat).not.toBe(j.seat);
    expect(h.begin('amy', 'asked', h.seatsLeft(2))).toBeNull();
    expect(h.seatsLeft(2)).toEqual([]);
    expect(h.begin('jess', 'asked', h.seatsLeft(2))).toBeNull();
  });

  it('goes up, sits, speaks, and has had enough', () => {
    const h = new HutStay({ ...P });
    h.begin('amy', 'offer', h.seatsLeft(2));
    const state = { amy: { free: true, seated: false, youNear: true, favoured: true } };
    h.update(1, live({ girls: state }));
    expect(h.sitting('amy')).toBe(false);
    state.amy.seated = true;
    const events = h.update(1, live({ girls: state }));
    expect(h.sitting('amy')).toBe(true);
    expect(events.map((e) => e.line)).toEqual(['hutSit']); // the stove was already going: nothing to light
    let end;
    for (let i = 0; i < P.sitSeconds + 5 && !end; i++) {
      const ev = h.update(1, live({ girls: state }));
      events.push(...ev);
      end = ev.find((e) => e.type === 'end');
    }
    expect(events.filter((e) => e.type === 'say').map((e) => e.line)).toEqual(['hutSit', 'hutWarm', 'hutRomance', 'hutDone']);
    expect(end).toMatchObject({ type: 'end', girl: 'amy', why: 'done', teaWith: false });
    expect(h.active).toBe(false);
    expect(h.offers(ctx()).map((o) => o.girl)).toEqual(['jess']); // she has had her stay for now
  });

  it('lights a cold stove when she sits down in weather that wants a fire, or when she was asked, and not on a mild bright day', () => {
    const seated = { amy: { free: true, seated: true, youNear: false, favoured: false } };
    const lights = (how, extra) => {
      const h = new HutStay({ ...P });
      h.begin('amy', how, [0]);
      return h.update(1, live({ burning: false, girls: seated, ...extra })).filter((e) => e.type === 'light').length;
    };
    expect(lights('offer', { rain: 0.6 })).toBe(1);
    expect(lights('offer', { cold: 0.8 })).toBe(1);
    expect(lights('offer', { darkness: 0.9 })).toBe(1);
    expect(lights('asked', {})).toBe(1);
    expect(lights('offer', {})).toBe(0);
  });

  it('puts a log on when the stove runs low in weather that wants it, and says the rain line in the rain', () => {
    const h = new HutStay({ ...P });
    h.begin('amy', 'offer', [0]);
    const state = { amy: { free: true, seated: true, youNear: false, favoured: false } };
    h.update(1, live({ girls: state }));
    expect(h.update(1, live({ girls: state, rain: 0.8, fuel: P.stokeBelow - 1 })).some((e) => e.type === 'stoke')).toBe(true);
    expect(h.update(1, live({ girls: state, rain: 0.8, fuel: P.stokeBelow - 1, canStoke: false })).some((e) => e.type === 'stoke')).toBe(false);
    expect(h.update(1, live({ girls: state, fuel: P.stokeBelow - 1 })).some((e) => e.type === 'stoke')).toBe(false); // mild: she lets it go
    const says = [];
    for (let i = 0; i < P.sitSeconds * 0.4; i++) says.push(...h.update(1, live({ girls: state, rain: 0.8 })));
    expect(says.filter((e) => e.type === 'say').map((e) => e.line)).toEqual(['hutRain']);
  });

  it('only says the quiet one to the girl you are near and have favoured', () => {
    const lines = (favoured, youNear) => {
      const h = new HutStay({ ...P });
      h.begin('amy', 'offer', [0]);
      const state = { amy: { free: true, seated: true, youNear, favoured } };
      const out = [];
      for (let i = 0; i < P.sitSeconds + 2; i++) out.push(...h.update(1, live({ girls: state })));
      return out.filter((e) => e.type === 'say').map((e) => e.line);
    };
    expect(lines(true, true)).toContain('hutRomance');
    expect(lines(true, false)).not.toContain('hutRomance');
    expect(lines(false, true)).not.toContain('hutRomance');
  });

  it('remembers tea made while she was sat there, and drops a girl who never gets there', () => {
    const h = new HutStay({ ...P });
    h.begin('amy', 'offer', [0]);
    const state = { amy: { free: true, seated: true, youNear: false, favoured: false } };
    h.update(1, live({ girls: state }));
    h.noteTea();
    let end;
    for (let i = 0; i < P.sitSeconds + 2 && !end; i++) end = h.update(1, live({ girls: state })).find((e) => e.type === 'end');
    expect(end.teaWith).toBe(true);
    const lost = new HutStay({ ...P });
    lost.begin('jess', 'offer', [0]);
    const ev = [];
    for (let i = 0; i < P.goTimeout + 2; i++) ev.push(...lost.update(1, live({ girls: { jess: { free: true, seated: false, youNear: false, favoured: false } } })));
    expect(ev.find((e) => e.type === 'end')).toMatchObject({ girl: 'jess', why: 'lost' });
    expect(lost.offers(ctx()).map((o) => o.girl)).toContain('jess'); // no cooldown for a stay that never happened
    expect(new HutStay({ ...P }).update(1, live({ girls: {} }))).toEqual([]);
  });
});
