import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { QUAD_SPECS, EXTRA_SPECS, TRACTOR_SPEC } from '../src/vehicle/quadSpecs.js';
import { AUDIO_PARAM_RANGES } from '../src/audio/audioParams.js';

describe('engine banks', () => {
  it('every quad names a bank that is listed, loads in the hub and exists on disk', () => {
    for (const spec of [...QUAD_SPECS, ...EXTRA_SPECS, TRACTOR_SPEC]) {
      const bank = spec.audio?.recBank;
      if (!bank) continue;
      expect(AUDIO_PARAM_RANGES.recBank, spec.id).toContain(bank);
      expect(existsSync(`public/audio/${bank}.json`), spec.id).toBe(true);
    }
  });

  it('every bank is valid JSON with finite numbers, or the browser refuses it and the quad falls back to the synth', () => {
    for (const name of AUDIO_PARAM_RANGES.recBank) {
      const bank = JSON.parse(readFileSync(`public/audio/${name}.json`, 'utf8'));
      for (const g of bank.grains) {
        for (const key of ['start', 'dur', 'tail', 'rpm', 'rms']) expect(Number.isFinite(g[key]), `${name} ${key}`).toBe(true);
        expect(g.dur, name).toBeGreaterThan(0);
      }
    }
  });

  it('gives the tractor its own bank', () => {
    expect(TRACTOR_SPEC.audio.recBank).toBe('engine-bank-tractor');
  });

  it("cuts the tractor's idle into whole, matching cycles to be played in order, so its tickover stays even", () => {
    const bank = JSON.parse(readFileSync('public/audio/engine-bank-tractor.json', 'utf8'));
    expect(bank.readThrough).toBe(true);
    const idle = bank.grains.filter((g) => g.kind === 'idle' && g.ok !== false);
    expect(idle.length).toBeGreaterThan(100);
    // A four-cylinder at about 1,000 rpm: every grain one 0.12 s cycle, none a beat short or long (0.09 or 0.15 s).
    for (const g of idle) {
      expect(g.dur).toBeGreaterThan(0.105);
      expect(g.dur).toBeLessThan(0.135);
    }
  });

  it("gives the kids' quad its own bank", () => {
    expect(EXTRA_SPECS.find((s) => s.id === 'kids').audio.recBank).toBe('engine-bank-50');
  });
});
