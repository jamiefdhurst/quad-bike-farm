import { describe, it, expect, vi } from 'vitest';
import { Faults, DEFAULT_FAULT_PARAMS as FP } from '../src/vehicle/faults.js';
import { TyreSet, newTyres, DEFAULT_TYRE_PARAMS as TP } from '../src/vehicle/tyres.js';
import { Spares, DEFAULT_SPARES_PARAMS } from '../src/workshop/spares.js';
import { Workshop } from '../src/workshop/workshop.js';

const punctured = () => {
  const f = new Faults({ ...FP }, () => 0.3);
  f.begin('puncture');
  f.levels.puncture = 0.9;
  return f;
};

describe('plugging a puncture', () => {
  it('leaves a milder fault than a spare tube does, and caps it lower', () => {
    const tube = punctured();
    tube.fix('puncture', { rough: true });
    const plug = punctured();
    expect(plug.fix('puncture', { rough: true, plug: true })).toBe(true);
    expect(plug.levels.puncture).toBe(FP.plugFixLevel);
    expect(plug.caps.puncture).toBe(FP.plugFixCap);
    expect(plug.levels.puncture).toBeLessThan(tube.levels.puncture);
    expect(plug.caps.puncture).toBeLessThan(tube.caps.puncture);
  });

  it('is only for a puncture', () => {
    const f = new Faults({ ...FP }, () => 0.3);
    f.begin('belt');
    f.levels.belt = 0.9;
    f.fix('belt', { rough: true, plug: true });
    expect(f.levels.belt).toBe(FP.fieldFixLevel);
  });

  it('does nothing twice', () => {
    const f = punctured();
    f.fix('puncture', { rough: true, plug: true });
    expect(f.fix('puncture', { rough: true, plug: true })).toBe(false);
  });

  it('pumps the one tyre up to the plug pressure and never lets air out', () => {
    const t = new TyreSet(newTyres(4), TP);
    t.psi = [1.2, 3.8, 4, 4.5];
    t.topUp(0);
    t.topUp(1);
    t.topUp(3);
    expect(t.psi).toEqual([TP.plugPsi, 3.8, 4, 4.5]);
  });
});

describe('the plug kit in the toolbox', () => {
  const shelf = (over = {}) => new Spares({ ...DEFAULT_SPARES_PARAMS, ...over });

  it('starts full, is used up one at a time and is topped up in the morning', () => {
    const s = shelf();
    expect(s.count('strip')).toBe(DEFAULT_SPARES_PARAMS.startStrip);
    s.take('strip');
    s.take('strip');
    const next = shelf();
    next.restore(JSON.parse(JSON.stringify(s.toJSON())));
    expect(next.count('strip')).toBe(DEFAULT_SPARES_PARAMS.startStrip);
  });

  it('is not on the rack', async () => {
    const { PART_IDS } = await import('../src/workshop/spares.js');
    expect(PART_IDS).not.toContain('strip');
  });
});

describe('the toolbox button', () => {
  const host = (strips, tubes = 1) => {
    const f = punctured();
    f.tyre = 2;
    const tyres = new TyreSet(newTyres(4), TP);
    tyres.psi = [4, 4, 1, 4];
    const spares = shelf(strips, tubes);
    const toast = vi.fn();
    const ws = Object.create(Workshop.prototype);
    ws.unit = { quad: { faults: f, tyres, physics: { applyParams: vi.fn() } } };
    ws.game = { spares, hud: { toast }, companions: [], shed: null };
    ws.render = vi.fn();
    ws.pressureWhyNot = () => 'no compressor';
    ws.levelTyres = vi.fn();
    return { ws, f, tyres, spares, toast };
  };
  function shelf(strips, tubes) {
    return new Spares({ ...DEFAULT_SPARES_PARAMS, startStrip: strips, startTube: tubes });
  }

  it('uses a plug first, with no compressor, and mends only the punctured tyre', () => {
    const { ws, f, tyres, spares, toast } = host(2);
    ws.repair('puncture');
    expect(spares.count('strip')).toBe(1);
    expect(spares.count('tube')).toBe(1);
    expect(f.levels.puncture).toBe(FP.plugFixLevel);
    expect(tyres.psi[2]).toBe(TP.plugPsi);
    expect(ws.levelTyres).not.toHaveBeenCalled();
    expect(toast.mock.calls[0][0]).toContain('tyre plug');
    expect(toast.mock.calls[0][0]).toContain('1 tyre plug left');
  });

  it('falls back to a spare tube when the kit is empty', () => {
    const { ws, f, spares } = host(0);
    ws.repair('puncture');
    expect(spares.count('tube')).toBe(0);
    expect(f.levels.puncture).toBe(FP.fieldFixLevel);
  });
});
