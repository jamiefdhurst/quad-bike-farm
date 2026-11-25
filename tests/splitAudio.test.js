import { describe, it, expect } from 'vitest';
import { ramSound, whineSamples, strainSamples, hissSamples, crackSamples, RAM_SOUND, SplitAudio } from '../src/audio/splitAudio.js';
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

// A stand-in audio context that counts what is made, started and stopped, and makes no sound.
function stubHub() {
  const made = { sources: [], started: 0, stopped: 0 };
  const param = () => ({ value: 0, setTargetAtTime(v) { this.value = v; } });
  const node = () => ({ connect: (n) => n });
  const ctx = {
    sampleRate: 8000,
    currentTime: 0,
    createPanner: () => ({ ...node(), positionX: param(), positionY: param(), positionZ: param() }),
    createGain: () => ({ ...node(), gain: param() }),
    createBuffer: () => ({ copyToChannel() {} }),
    createBufferSource: () => {
      const src = { ...node(), playbackRate: param(), loop: false, start: () => made.started++, stop: () => made.stopped++ };
      made.sources.push(src);
      return src;
    },
  };
  return { made, hub: { ready: true, ctx, master: node(), params: { ...S } } };
}

describe('SplitAudio.ram', () => {
  const at = () => ({ x: 1, y: 2, z: 3 });
  const still = { powered: true, dir: 0, pressing: false, gnarled: false };

  it('makes nothing while the ram is still, then starts the two loops once and follows them', () => {
    const { made, hub } = stubHub();
    const a = new SplitAudio(hub);
    a.ram(0.1, still, at);
    expect(made.sources).toHaveLength(0);
    for (let i = 0; i < 5; i++) a.ram(0.1, out, at);
    expect(made.sources.filter((s) => s.loop)).toHaveLength(2);
    expect(a.loops.whine.gain.gain.value).toBe(S.splitterWhineVolume);
    a.ram(0.1, { ...out, pressing: true }, at);
    expect(a.loops.strain.gain.gain.value).toBe(S.splitterStrainVolume);
  });

  it('hisses once as the ram starts back, and stops the loops after a second of quiet', () => {
    const { made, hub } = stubHub();
    const a = new SplitAudio(hub);
    a.ram(0.1, out, at);
    const before = made.sources.length;
    for (let i = 0; i < 5; i++) a.ram(0.1, { ...out, dir: -1 }, at);
    expect(made.sources.length - before).toBe(1); // the one hiss
    a.ram(0.1, still, at);
    expect(a.loops).not.toBeNull();
    for (let i = 0; i < 11; i++) a.ram(0.1, still, at);
    expect(a.loops).toBeNull();
    expect(made.stopped).toBe(2);
  });

  it('forgets which way the ram was going while the tractor is off, so it hisses again when it starts back', () => {
    const { made, hub } = stubHub();
    const a = new SplitAudio(hub);
    a.ram(0.1, { ...out, dir: -1 }, at);
    const n = made.sources.length;
    a.ram(0.1, { ...out, dir: -1, powered: false }, at);
    a.ram(0.1, { ...out, dir: -1 }, at);
    expect(made.sources.length - n).toBe(1);
  });
});
