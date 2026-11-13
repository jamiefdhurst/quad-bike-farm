import { describe, it, expect } from 'vitest';
import { MAKERS, MAKER_FOR, REAL_NAMES, WARNING_LINES, DEALER, decalLayout, decalText, chassisNumber, drawDecal } from '../src/vehicle/detail/decals.js';
import { QUAD_SPECS, EXTRA_SPECS, PLOVER_SPEC, HARTLEY_SPEC, YAK_SPEC, TOR_SPEC, CRAG_SPEC, FINCH_SPEC, GRIFFIN_SPEC, VAUCLAIR_SPEC } from '../src/vehicle/quadSpecs.js';

const real = (s) => REAL_NAMES.some((n) => s.toLowerCase().includes(n));

describe('decals', () => {
  it('no maker, dealer or printed line carries a real name', () => {
    for (const m of Object.values(MAKERS)) expect(real(m.name), m.name).toBe(false);
    for (const s of [...WARNING_LINES, ...Object.values(DEALER)]) expect(real(s), s).toBe(false);
    for (const maker of Object.keys(MAKERS)) {
      for (const kind of ['badge', 'chassis']) for (const t of decalText(decalLayout(kind, { maker, model: 'Workhorse 350' }))) expect(real(t), t).toBe(false);
    }
  });

  it('every vehicle with a maker names one that exists', () => {
    const ids = new Set([...QUAD_SPECS, ...EXTRA_SPECS, PLOVER_SPEC, HARTLEY_SPEC, YAK_SPEC, TOR_SPEC, CRAG_SPEC, FINCH_SPEC, GRIFFIN_SPEC, VAUCLAIR_SPEC].map((s) => s.id));
    for (const [id, maker] of Object.entries(MAKER_FOR)) {
      expect(ids.has(id), id).toBe(true);
      expect(MAKERS[maker], maker).toBeTruthy();
    }
  });

  it('every kind lays out on its canvas', () => {
    for (const [kind, opts] of [['badge', { maker: 'kestrel' }], ['badge', { maker: 'tamura', model: 'Bruin' }], ['stripes', { colours: ['#fff', '#c00'], text: 'Sport' }], ['warning', {}], ['chassis', { maker: 'hartley', seed: 4 }], ['number', { text: 23 }], ['dealer', {}]]) {
      const l = decalLayout(kind, opts);
      expect(l.ops.length, kind).toBeGreaterThan(0);
      for (const o of l.ops) {
        if (o.op === 'rect') expect(o.x + o.w, kind).toBeLessThanOrEqual(l.w + 1e-9);
        if (o.op === 'text') {
          expect(o.y, kind).toBeGreaterThan(0);
          expect(o.y, kind).toBeLessThan(l.h);
        }
      }
    }
    expect(() => decalLayout('badge', { maker: 'honda' })).toThrow();
    expect(() => decalLayout('tattoo')).toThrow();
  });

  it('a chassis number is the same for the same seed and starts with the maker', () => {
    expect(chassisNumber('hartley', 7)).toBe(chassisNumber('hartley', 7));
    expect(chassisNumber('hartley', 7)).not.toBe(chassisNumber('hartley', 8));
    expect(chassisNumber('moorland', 3)).toMatch(/^MOO[A-Z]{2}\d{3}-\d{6}$/);
  });

  it('draws with any 2D context', () => {
    const calls = [];
    const g = new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === 'measureText' ? (s) => ({ width: s.length * 30 }) : (...a) => calls.push(k)), set: (t, k, v) => ((t[k] = v), true) });
    drawDecal(g, decalLayout('warning'));
    expect(calls).toContain('fillText');
  });
});
