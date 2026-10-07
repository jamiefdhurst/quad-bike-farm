import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { QUAD_SPECS, EXTRA_SPECS, TRACTOR_SPEC, UTV_SPEC, LAND_ROVER_SPEC } from '../src/vehicle/quadSpecs.js';
import { AUDIO_PARAM_RANGES } from '../src/audio/audioParams.js';

describe('engine banks', () => {
  it('every quad names a bank that is listed, loads in the hub and exists on disk', () => {
    for (const spec of [...QUAD_SPECS, ...EXTRA_SPECS, TRACTOR_SPEC, UTV_SPEC, LAND_ROVER_SPEC]) {
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

  it('gives the green and the yellow their own banks, blending into real rev firings as they rev', () => {
    for (const [id, bank] of [['green', 'engine-bank-green'], ['yellow', 'engine-bank-yellow']]) {
      const spec = QUAD_SPECS.find((s) => s.id === id);
      expect(spec.audio.recBank, id).toBe(bank);
      expect(spec.audio.pulseRevHi, id).toBeGreaterThan(spec.audio.pulseRevLo);
      const grains = JSON.parse(readFileSync(`public/audio/${bank}.json`, 'utf8')).grains.filter((g) => g.ok !== false);
      expect(grains.filter((g) => g.kind === 'idle').length, id).toBeGreaterThan(100);
      expect(grains.filter((g) => g.kind === 'accel').length, id).toBeGreaterThan(100);
    }
  });

  it('gives the mini moto, the ATC and the UTV their own banks', () => {
    expect(EXTRA_SPECS.find((s) => s.id === 'moto').audio.recBank).toBe('engine-bank-moto');
    expect(EXTRA_SPECS.find((s) => s.id === 'atc').audio.recBank).toBe('engine-bank-atc');
    expect(UTV_SPEC.audio.recBank).toBe('engine-bank-utv');
  });

  it("cuts the UTV's Gator idle into whole cycles to be played in order, like the tractor's", () => {
    const bank = JSON.parse(readFileSync('public/audio/engine-bank-utv.json', 'utf8'));
    expect(bank.readThrough).toBe(true);
    const idle = bank.grains.filter((g) => g.kind === 'idle' && g.ok !== false);
    expect(idle.length).toBeGreaterThan(80);
    // One beat every 0.12 s or so: a three-cylinder at about 970 rpm.
    for (const g of idle) {
      expect(g.dur).toBeGreaterThan(0.11);
      expect(g.dur).toBeLessThan(0.135);
    }
  });

  it("cuts the Land Rover's Jeep idle into single beats from its steady stretch, in order, each lasting one of its engine's firings", () => {
    const bank = JSON.parse(readFileSync('public/audio/engine-bank-landy.json', 'utf8'));
    expect(bank.readThrough).toBe(true);
    const idle = bank.grains.filter((g) => g.kind === 'idle');
    idle.forEach((g, i) => expect(g.slice).toBe(i % 3)); // in groups of three, as the steady stretch repeats
    expect(idle.length).toBeGreaterThan(40);
    for (const g of idle.filter((g) => g.ok !== false)) {
      expect(g.dur).toBeGreaterThan(0.05);
      expect(g.dur).toBeLessThan(0.07);
    }
    expect(LAND_ROVER_SPEC.engine.cylinders).toBe(4);
    // The bank's rpm (120 / beat length) is four times the engine's: each beat plays near its own speed at the Land Rover's idle.
    const ok = idle.filter((g) => g.ok !== false).map((g) => g.rpm / 4).sort((a, b) => a - b);
    const median = ok[Math.floor(ok.length / 2)];
    expect(median).toBeGreaterThan(LAND_ROVER_SPEC.idleRange[0] * 0.85);
    expect(median).toBeLessThan(LAND_ROVER_SPEC.idleRange[1] * 1.1);
  });

  // The moto's Derbi bangs every other turn at idle (two slices a lump), the ATC's Ape about every third (three).
  for (const [name, n, idleRange] of [['engine-bank-moto', 2, [1800, 2200]], ['engine-bank-atc', 3, [1300, 1800]]]) {
    it(`cuts ${name}'s lumpy two-stroke idle into ${n} slices a lump, in order, with the bang in the first`, () => {
      const bank = JSON.parse(readFileSync(`public/audio/${name}.json`, 'utf8'));
      expect(bank.readThrough).toBe(true);
      const idle = bank.grains.filter((g) => g.kind === 'idle');
      idle.forEach((g, i) => expect(g.slice).toBe(i % n));
      const ok = idle.filter((g) => g.ok !== false);
      const meanRms = (k) => ok.filter((g) => g.slice === k).reduce((s, g) => s + g.rms, 0) / ok.filter((g) => g.slice === k).length;
      for (let k = 1; k < n; k++) expect(meanRms(0)).toBeGreaterThan(meanRms(k));
      // Each slice lasts about one turn at the vehicle's idle, so it plays near its own speed (a two-stroke fires every turn:
      // the bank's rpm, 120 / slice length, is twice the engine's).
      const sorted = ok.map((g) => g.rpm).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] / 2;
      expect(median).toBeGreaterThan(idleRange[0] * 0.9);
      expect(median).toBeLessThan(idleRange[1] * 1.15);
    });
  }
});
