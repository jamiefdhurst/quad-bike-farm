import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import * as SPECS from '../src/vehicle/quadSpecs.js';
import { QUAD_SPECS, EXTRA_SPECS, PLOVER_SPEC, HARTLEY_SPEC, YAK_SPEC, TOR_SPEC } from '../src/vehicle/quadSpecs.js';
import { AUDIO_PARAM_RANGES, DEFAULT_AUDIO_PARAMS } from '../src/audio/audioParams.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';

describe('engine banks', () => {
  it('every vehicle names a bank that is listed, loads in the hub and exists on disk', () => {
    // Every spec quadSpecs.js exports, so a new vehicle is checked without being added here. The hub's BANK_NAMES (which banks
    // load while the game loads) is read from its source: engineAudio.js imports the worklet by URL, which only Vite understands.
    const specs = Object.values(SPECS).flatMap((v) => (Array.isArray(v) ? v : [v])).filter((s) => s?.id && s?.audio);
    const hub = JSON.parse(readFileSync('src/audio/engineAudio.js', 'utf8').match(/const BANK_NAMES = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
    expect(specs.length).toBeGreaterThan(12);
    for (const spec of specs) {
      const bank = spec.audio.recBank;
      if (!bank) continue;
      expect(AUDIO_PARAM_RANGES.recBank, spec.id).toContain(bank);
      expect(hub, `${spec.id}: ${bank} in BANK_NAMES`).toContain(bank);
      expect(existsSync(`public/audio/${bank}.json`), spec.id).toBe(true);
    }
  });

  it("every vehicle's bank has the pulse model for how it plays its idle, so its revs rise in pitch (#855)", () => {
    // tools/engine-bank-model.mjs writes it; slicing a bank again writes its JSON afresh without it, so re-run the tool after.
    const specs = Object.values(SPECS).flatMap((v) => (Array.isArray(v) ? v : [v])).filter((s) => s?.id && s?.audio);
    for (const spec of specs) {
      const audio = { ...DEFAULT_AUDIO_PARAMS, ...spec.audio };
      const key = `${{ rev: 'idle2', third: 'idle3' }[audio.recIdleSource] ?? 'idle'}/${Math.max(1, Math.round(audio.pulseSplit ?? 1))}`;
      const m = JSON.parse(readFileSync(`public/audio/${audio.recBank}.json`, 'utf8')).model?.[key];
      expect(m, `${spec.id}: model ${key} in ${audio.recBank} (node tools/engine-bank-model.mjs ${audio.recBank})`).toBeTruthy();
      expect(m.peaks.length, spec.id).toBeLessThanOrEqual(12);
      for (const pk of m.peaks) for (const k of ['f', 'q', 'g']) expect(Number.isFinite(pk[k]), `${spec.id} ${k}`).toBe(true);
      expect(m.burst, spec.id).toBeGreaterThan(0.005);
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

  it('takes each kind of idle from one recording, or picking by rpm swaps between machines as the revs change', () => {
    // The tractor's idle once mixed two recordings: from about 1,100 rpm up it played the boomier one nearly all the time.
    for (const name of AUDIO_PARAM_RANGES.recBank) {
      const bank = JSON.parse(readFileSync(`public/audio/${name}.json`, 'utf8'));
      const sources = {};
      for (const g of bank.grains) if (g.kind.startsWith('idle')) (sources[g.kind] ??= new Set()).add(g.src);
      for (const [kind, srcs] of Object.entries(sources)) expect([...srcs], `${name} ${kind}`).toHaveLength(1);
    }
  });

  it("cuts the green's revs along their rise, so nearly every firing is usable and each is about as long as the next", () => {
    // Its rev firings were cut where the exhaust went quietest, which wandered: two thirds failed the checks, those left were
    // picked one at a time from all over the recording, which stuttered, and 63% were more than 15% off the one before.
    const bank = JSON.parse(readFileSync('public/audio/engine-bank-green.json', 'utf8'));
    const revs = bank.grains.filter((g) => g.kind === 'accel');
    expect(revs.filter((g) => g.ok !== false).length / revs.length).toBeGreaterThan(0.95);
    let uneven = 0;
    for (let i = 1; i < revs.length; i++) if (Math.abs(Math.log(revs[i].dur / revs[i - 1].dur)) > 0.15) uneven++;
    expect(uneven / revs.length).toBeLessThan(0.15);
  });

  it('gives the tractor its own bank', () => {
    expect(HARTLEY_SPEC.audio.recBank).toBe('engine-bank-tractor');
  });

  it("cuts the tractor's idle into whole, matching cycles to be played in order, so its tickover stays even", () => {
    // engine-bank-tractor has 637891's 4.4 s of steady running; engine-bank-tractor-eq 637890's 15 s, EQ'd.
    for (const [name, least] of [['engine-bank-tractor', 30], ['engine-bank-tractor-eq', 100]]) {
      const dir = name.endsWith('-eq') ? 'source/audio' : 'public/audio'; // the EQ'd one is kept out of the download
      const bank = JSON.parse(readFileSync(`${dir}/${name}.json`, 'utf8'));
      expect(bank.readThrough).toBe(true);
      const idle = bank.grains.filter((g) => g.kind === 'idle' && g.ok !== false);
      expect(idle.length, name).toBeGreaterThan(least);
      // A four-cylinder at about 1,000 rpm: every grain one 0.12 s cycle, none a beat short or long (0.09 or 0.15 s).
      for (const g of idle) {
        expect(g.dur).toBeGreaterThan(0.105);
        expect(g.dur).toBeLessThan(0.135);
      }
    }
  });

  it("gives the kids' quad its own bank", () => {
    expect(EXTRA_SPECS.find((s) => s.id === 'asp').audio.recBank).toBe('engine-bank-50');
  });

  it('gives the green and the yellow their own banks, the yellow blending into real rev firings as it revs', () => {
    for (const [id, bank] of [['rb300', 'engine-bank-green'], ['hornet', 'engine-bank-yellow']]) {
      const spec = QUAD_SPECS.find((s) => s.id === id);
      expect(spec.audio.recBank, id).toBe(bank);
      // The green builds its revs from its idle alone, steady, as Jamie chose (#854); the yellow keeps its blend.
      if (id === 'rb300') expect([spec.audio.pulseRevLo, spec.audio.pulseRevHi], id).toEqual([0, 0]);
      else expect(spec.audio.pulseRevHi, id).toBeGreaterThan(spec.audio.pulseRevLo);
      const grains = JSON.parse(readFileSync(`public/audio/${bank}.json`, 'utf8')).grains.filter((g) => g.ok !== false);
      expect(grains.filter((g) => g.kind === 'idle').length, id).toBeGreaterThan(100);
      expect(grains.filter((g) => g.kind === 'accel').length, id).toBeGreaterThan(100);
    }
  });

  it("gives the old bike a bank of its own, with a kick and a run-down, idling about where its engine does", () => {
    expect(PLOVER_SPEC.audio.recBank).toBe('engine-bank-plover');
    const bank = JSON.parse(readFileSync('public/audio/engine-bank-plover.json', 'utf8'));
    expect(bank.oneshots.handCrank).toBeTruthy(); // the kickstart's swing
    expect(bank.oneshots.shutdown).toBeTruthy();
    const grains = bank.grains.filter((g) => g.ok !== false);
    expect(grains.filter((g) => g.kind === 'idle').length).toBeGreaterThan(100);
    expect(grains.filter((g) => g.kind === 'accel').length).toBeGreaterThan(100);
    // A two-stroke fires every turn, so the bank's rpm (120 / pulse length) is twice the engine's: its idle sits near the recording's.
    const idle = grains.filter((g) => g.kind === 'idle').map((g) => g.rpm / 2).sort((a, b) => a - b);
    const median = idle[Math.floor(idle.length / 2)];
    expect(median).toBeGreaterThan(PLOVER_SPEC.idleRange[0] * 0.9);
    expect(median).toBeLessThan(PLOVER_SPEC.idleRange[1] * 1.2);
  });

  it('gives the mini moto, the T185 and the UTV their own banks', () => {
    expect(EXTRA_SPECS.find((s) => s.id === 'tz65').audio.recBank).toBe('engine-bank-moto');
    expect(EXTRA_SPECS.find((s) => s.id === 't185').audio.recBank).toBe('engine-bank-atc');
    expect(YAK_SPEC.audio.recBank).toBe('engine-bank-utv');
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

  it("cuts the Tor's Model T idle into whole cycles, in order, each split into its four firings as it plays", () => {
    const bank = JSON.parse(readFileSync('public/audio/engine-bank-tor.json', 'utf8'));
    expect(bank.readThrough).toBe(true);
    const idle = bank.grains.filter((g) => g.kind === 'idle');
    expect(idle.length).toBeGreaterThan(150); // 30 s of it
    expect(idle.every((g) => g.slice === undefined)).toBe(true); // whole cycles, cut into firings by the worklet (pulseSplit)
    expect(TOR_SPEC.engine.cylinders).toBe(4);
    expect(TOR_SPEC.audio.pulseSplit).toBe(TOR_SPEC.engine.cylinders);
    // A whole cycle's rpm (120 / its length) is the engine's: the Model T measured at 836, faster than the Tor's idle, so each
    // firing is drawn out to fit (tests/landRover.test.js).
    const ok = idle.filter((g) => g.ok !== false).map((g) => g.rpm).sort((a, b) => a - b);
    const median = ok[Math.floor(ok.length / 2)];
    expect(Math.abs(median / 836 - 1)).toBeLessThan(0.05);
  });

  // #858: the girls' cars, yours and the Tor each idle on a CC0 recording of their own, picked by ear on the review page (#857).
  it('gives the Finch, the Griffin, the Vauclair and the Tor each its own bank, cut from one recording, played every firing', () => {
    const four = [SPECS.FINCH_SPEC, SPECS.GRIFFIN_SPEC, SPECS.VAUCLAIR_SPEC, TOR_SPEC];
    const banks = four.map((s) => s.audio.recBank);
    expect(banks).toEqual(['engine-bank-finch', 'engine-bank-griffin', 'engine-bank-vauclair', 'engine-bank-tor']);
    const others = Object.values(SPECS).flatMap((v) => (Array.isArray(v) ? v : [v])).filter((s) => s?.audio && !four.includes(s));
    expect(others.filter((s) => banks.includes(s.audio.recBank)).map((s) => s.id)).toEqual([]);
    for (const spec of four) {
      const bank = JSON.parse(readFileSync(`public/audio/${spec.audio.recBank}.json`, 'utf8'));
      expect(new Set(bank.grains.map((g) => g.src)), spec.id).toEqual(new Set(['src']));
      expect(Object.keys(bank.oneshots).sort(), spec.id).toEqual(expect.arrayContaining(['crankLoop', 'shutdown', 'starterEngage']));
      expect(bank.oneshots.stall, spec.id).toBeUndefined(); // a stall runs down as the key does
      expect(spec.audio.pulseDivide ?? DEFAULT_AUDIO_PARAMS.pulseDivide, spec.id).toBe(1);
      expect(spec.audio.pulseSplit, spec.id).toBe(spec.engine.cylinders);
    }
  });

  // The moto's Derbi bangs every other turn at idle (two slices a lump), the T185's Ape about every third (three).
  for (const [name, n, idleRange] of [['engine-bank-moto', 2, [1800, 2200]], ['engine-bank-atc', 3, [1300, 1800]]]) {
    it(`cuts ${name}'s lumpy two-stroke idle into ${n} slices a lump, in order, with the bang in the first`, () => {
      const dir = name.endsWith('-eq') ? 'source/audio' : 'public/audio'; // the EQ'd one is kept out of the download
      const bank = JSON.parse(readFileSync(`${dir}/${name}.json`, 'utf8'));
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

  it("takes the T185's whining idle firings out of use, and leaves the Plover's always tonal idle alone", () => {
    // The Ape recording the T185 idles on whines at 3.2 to 3.6 kHz in a few stretches, worst at 32.9 to 33.0 s of the bank, heard
    // whenever one of their firings was picked. The slicer's whine check (tools/slice_engine_audio.py, #852) marks a firing whose
    // tonal peak stands 5.5 dB over its recording's median, so the Plover, whose whistle is there all through, loses none.
    const t185 = EXTRA_SPECS.find((s) => s.id === 't185');
    const atc = JSON.parse(readFileSync(`public/audio/${t185.audio.recBank}.json`, 'utf8'));
    const whining = atc.grains.filter((g) => g.kind === 'idle' && g.start >= 32.9 && g.start <= 33.0);
    expect(whining.length).toBeGreaterThan(1);
    for (const g of whining) expect(g.ok, `T185 idle at ${g.start.toFixed(3)} s`).toBe(false);
    const idle = atc.grains.filter((g) => g.kind === 'idle');
    expect(idle.filter((g) => g.ok === false).length).toBeGreaterThan(50); // 65 of its 1215 were found whining
    expect(idle.filter((g) => g.ok !== false).length).toBeGreaterThan(1100);
    // The Plover's usable idle firings are all it had before the check (the rest fail the slicer's older checks).
    const plover = JSON.parse(readFileSync(`public/audio/${PLOVER_SPEC.audio.recBank}.json`, 'utf8'));
    expect(plover.grains.filter((g) => g.kind === 'idle' && g.ok !== false)).toHaveLength(171);
  });
});

describe('idles cut into firings (pulseSplit)', () => {
  const specs = Object.values(SPECS).flatMap((v) => (Array.isArray(v) ? v : [v])).filter((s) => s?.id && s?.audio);

  it('fires the engine as many times a cycle as its idle cycles are cut into, or most of each cycle is silence', () => {
    // The Yak and Crag said one cylinder: cut into three and four, each cycle played its first firing and then nothing (#853).
    const cut = specs.filter((s) => (s.audio.pulseSplit ?? 1) > 1);
    expect(cut.length).toBeGreaterThanOrEqual(5);
    for (const spec of cut) expect(spec.engine.cylinders ?? DEFAULT_ENGINE_PARAMS.cylinders, spec.id).toBe(spec.audio.pulseSplit);
  });

  it('builds the cars\' and the diesels\' revs from their idle alone, every firing played, with no rev recording', () => {
    const want = { finch: 4, griffin: 4, vauclair: 4, crag: 4, yak: 3 };
    for (const [id, split] of Object.entries(want)) {
      const a = specs.find((s) => s.id === id).audio;
      expect(a.pulseSplit, id).toBe(split);
      expect(a.pulseDivide ?? 1, id).toBe(1);
      expect([a.pulseRevLo ?? 0, a.pulseRevHi ?? 0], id).toEqual([0, 0]);
    }
    // The Griffin 3 dB under the 1.1 it had, about the Finch's, so its boomiest firings stay out of the soft clipper.
    expect(specs.find((s) => s.id === 'griffin').audio.recVolume).toBeCloseTo(1.1 * 10 ** (-3 / 20), 2);
  });
});
