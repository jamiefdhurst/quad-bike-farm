import { describe, it, expect } from 'vitest';
import { warnSymbol, glyphLetter } from '../src/vehicle/dashParts.js';

// A canvas context that accepts any call, and records the drawing calls made.
function stubContext() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k === 'calls' ? calls : k in t ? t[k] : () => { calls.push(k); }),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  return ctx;
}

describe('dash symbols', () => {
  const KINDS = ['glow', 'charge', 'oil', 'choke', 'park', 'belt', 'beam', 'lights', 'fuel', 'temp', '4wd', 'lock'];

  it('draws every kind, lit or dull, scaled or not, without throwing', () => {
    for (const kind of KINDS) {
      for (const lit of [true, false]) {
        expect(() => warnSymbol(stubContext(), kind, 10, 10, '#f00', lit)).not.toThrow();
        expect(() => warnSymbol(stubContext(), kind, 10, 10, '#f00', lit, 0.5, false)).not.toThrow();
      }
    }
  });

  it('draws something for each of the new kinds', () => {
    for (const kind of ['fuel', 'temp', '4wd', 'lock']) {
      const ctx = stubContext();
      warnSymbol(ctx, kind, 0, 0, '#fff', true, 1, false);
      expect(ctx.calls.length).toBeGreaterThan(3);
    }
  });

  it('draws a lit-up letter', () => {
    expect(() => glyphLetter(stubContext(), 5, 5, '#0f0', 'N', true)).not.toThrow();
  });
});
