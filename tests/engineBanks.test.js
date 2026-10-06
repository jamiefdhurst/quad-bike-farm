import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { QUAD_SPECS, EXTRA_SPECS } from '../src/vehicle/quadSpecs.js';
import { AUDIO_PARAM_RANGES } from '../src/audio/audioParams.js';

describe('engine banks', () => {
  it('every quad names a bank that is listed, loads in the hub and exists on disk', () => {
    for (const spec of [...QUAD_SPECS, ...EXTRA_SPECS]) {
      const bank = spec.audio?.recBank;
      if (!bank) continue;
      expect(AUDIO_PARAM_RANGES.recBank, spec.id).toContain(bank);
      expect(existsSync(`public/audio/${bank}.json`), spec.id).toBe(true);
    }
  });

  it("gives the kids' quad its own bank", () => {
    expect(EXTRA_SPECS.find((s) => s.id === 'kids').audio.recBank).toBe('engine-bank-50');
  });
});
