import { describe, it, expect } from 'vitest';
import { ramSound, whineSamples, strainSamples, hissSamples, crackSamples, RAM_SOUND } from '../src/audio/splitAudio.js';
import { DEFAULT_SOUND_PARAMS as S, SOUND_PARAM_RANGES } from '../src/audio/audioParams.js';
import { LogSplitter, DEFAULT_SPLITTER_PARAMS as P } from '../src/items/logSplitter.js';

const out = { powered: true, dir: 1, pressing: false, gnarled: false };

describe('the ram\'s sound', () => {
  it('whines while the ram moves out, and strains as well while it pushes into the round', () => {
    expect(ramSound(out)).toEqual({ whine: S.splitterWhineVolume, whineRate: 1, strain: 0, strainRate: 1, hiss: 0 });
    const pressing = ramSound({ ...out, pressing: true });
    expect(pressing.whine).toBe(S.splitterWhineVolume);
    expect(pressing.strain).toBe(S.splitterStrainVolume);
    expect(pressing.whineRate).toBe(RAM_SOUND.pressRate); // the pump labours
    expect(pressing.hiss).toBe(0);
  });

  it('strains louder and lower in a gnarled round', () => {
    const plain = ramSound({ ...out, pressing: true });
    const gnarled = ramSound({ ...out, pressing: true, gnarled: true });
    expect(gnarled.strain).toBeGreaterThan(plain.strain);
    expect(gnarled.strainRate).toBeLessThan(plain.strainRate);
    expect(gnarled.whineRate).toBeLessThan(plain.whineRate);
  });

  it('hisses once as the ram starts back, and whines more lightly on the way home', () => {
    const back = { ...out, dir: -1 };
    const first = ramSound(back, 1);
    expect(first.hiss).toBe(S.splitterHissVolume);
    expect(first.whine).toBeCloseTo(S.splitterWhineVolume * RAM_SOUND.returnWhine);
    expect(first.strain).toBe(0);
    expect(ramSound(back, 0).hiss).toBe(S.splitterHissVolume); // from standing, as when you let go at the end of the stroke
    expect(ramSound(back, -1).hiss).toBe(0); // and not again while it keeps coming back
  });

  it('is silent with the engine off or the ram still', () => {
    for (const s of [{ ...out, powered: false }, { ...out, powered: false, dir: -1 }, { ...out, pressing: true, powered: false }, { ...out, dir: 0 }]) {
      expect(ramSound(s, 1)).toEqual({ whine: 0, whineRate: 1, strain: 0, strainRate: 1, hiss: 0 });
    }
  });

  it('follows the Sound tuning\'s three volumes, each with a range', () => {
    const v = { splitterWhineVolume: 1, splitterStrainVolume: 0.2, splitterHissVolume: 0 };
    expect(ramSound({ ...out, pressing: true }, 0, v)).toMatchObject({ whine: 1, strain: 0.2 });
    expect(ramSound({ ...out, dir: -1 }, 1, v).hiss).toBe(0);
    for (const k of Object.keys(v)) expect(SOUND_PARAM_RANGES[k]).toEqual([0, 2, 0.01]);
  });

  it('reads the splitter as it works: out, into the round, the split, and back', () => {
    const sp = new LogSplitter({ ...P });
    sp.putOn(true);
    const heard = [];
    let was = 0;
    const step = (push) => {
      sp.update(0.05, { push, powered: true });
      const s = ramSound({ powered: true, dir: sp.dir, pressing: sp.pressing, gnarled: !!sp.round?.gnarled }, was);
      was = sp.dir;
      heard.push(s);
    };
    for (let t = 0; t < 10; t += 0.05) step(true);
    for (let t = 0; t < 5; t += 0.05) step(false);
    expect(heard.some((s) => s.whine > 0 && s.strain === 0)).toBe(true); // out to the round
    expect(heard.some((s) => s.strain > S.splitterStrainVolume)).toBe(true); // in the gnarled round
    expect(heard.filter((s) => s.hiss > 0)).toHaveLength(1); // once, as it starts back
    expect(heard.at(-1).whine).toBe(0); // home and still
  });
});

describe('the ram\'s samples', () => {
  const rate = 8000;
  for (const [name, make] of [['whine', whineSamples], ['strain', strainSamples], ['hiss', hissSamples], ['crack', crackSamples]]) {
    it(`makes the ${name} the same every time, finite and in range`, () => {
      const a = make(rate);
      expect(Array.from(a)).toEqual(Array.from(make(rate)));
      const peak = a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      expect(Number.isFinite(peak)).toBe(true);
      expect(peak).toBeGreaterThan(0.05);
      expect(peak).toBeLessThan(1.5);
    });
  }

  it('makes the whine and strain one second long, ending where they began so they loop without a click', () => {
    for (const make of [whineSamples, strainSamples]) {
      const a = make(rate);
      expect(a.length).toBe(rate);
      const jump = Math.abs(a[0] - a[a.length - 1]);
      const typical = a.slice(1).reduce((sum, v, i) => sum + Math.abs(v - a[i]), 0) / (a.length - 1);
      expect(jump).toBeLessThan(typical * 4);
    }
  });
});
