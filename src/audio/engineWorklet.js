// AudioWorklet engine synthesiser. Runs on the audio thread, so it must stay
// self-contained (no imports).
//
// Signal path, loosely modelled on a real single:
//
//   exhaust pulses ─┐
//   overrun pops ───┼─▶ exhaust pipe (delay-line resonator) ─▶ silencer resonances ─▶ tone ─▶ ┐
//   compression ────┘                                                                         ├─▶ soft clip ─▶ out
//   intake honk, valve tick, gear whine ─────────────────────────────────────────────────────┤
//   starter motor, solenoid, relay clicks ───────────────────────────────────────────────────┘
//
// The pipe and silencer resonate at fixed frequencies whatever the rpm. As
// revs rise the pulses arrive faster but excite the same resonances, which is
// what makes it sound like an engine rather than a sped-up recording.

const TWO_PI = Math.PI * 2;

class Biquad {
  constructor() {
    this.b0 = 1;
    this.b1 = 0;
    this.b2 = 0;
    this.a1 = 0;
    this.a2 = 0;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }

  set(type, freq, q, sr) {
    const w = (TWO_PI * Math.min(freq, sr * 0.45)) / sr;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    const a0 = 1 + alpha;
    if (type === 'lowpass') {
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = (1 - cos) / 2;
    } else if (type === 'highpass') {
      b0 = (1 + cos) / 2;
      b1 = -(1 + cos);
      b2 = (1 + cos) / 2;
    } else {
      // Band-pass with 0 dB peak.
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Recorded engine: every firing pulse plays one real recorded pulse ("grain")
 * cut from CC0 recordings by tools/slice_engine_audio.py. The grain recorded
 * nearest the current rpm is chosen and resampled so it lasts exactly one
 * engine cycle. Idle grains come from one quad, higher revs from a rev sweep
 * of another, blended across a band of rpm. Cranking is a looped recording.
 */
class RecordedEngine {
  constructor(bank) {
    this.data = bank.data;
    const sr = sampleRate;
    this.sourceGain = bank.sourceGain;
    this.crankRpm = bank.crankRpm;
    this.byKind = {};
    let prev = null;
    for (const g of bank.grains) {
      const grain = {
        start: Math.round(g.start * sr),
        len: Math.round(g.dur * sr),
        tail: Math.max(Math.round((g.tail ?? 0) * sr), Math.round(0.001 * sr)),
        rpm: g.rpm,
        rms: g.rms ?? 0,
        kind: g.kind,
        gain: bank.sourceGain[g.src] ?? 1,
        next: null, // the grain straight after this one in the recording, if it survived the cut
      };
      // Grains are stored in recording order; link ones that follow on without a gap.
      if (prev && Math.abs(prev.start + prev.len - grain.start) <= 2) prev.next = grain;
      prev = grain;
      // Pulses that failed the slicer's checks can be read through but never start a grain.
      if (g.ok !== false) (this.byKind[g.kind] ??= []).push(grain);
    }
    this.skip = { low: 0, high: 0 }; // pulses still covered by the last multi-cycle grain on each layer
    this.cursor = { low: null, high: null }; // last recorded grain played on each layer
    for (const k in this.byKind) this.byKind[k].sort((a, b) => a.rpm - b.rpm);
    // Typical loudness of each kind, for evening out unusually loud or quiet grains.
    this.medianRms = {};
    for (const [k, list] of Object.entries(this.byKind)) {
      const sorted = list.map((g) => g.rms).sort((a, b) => a - b);
      this.medianRms[k] = sorted[Math.floor(sorted.length / 2)] || 1;
    }
    this.levelling = 0.5;
    this.oneshots = {};
    for (const [name, o] of Object.entries(bank.oneshots)) {
      this.oneshots[name] = { start: Math.round(o.start * sr), len: Math.round(o.dur * sr) };
    }
    this.voices = [];
    this.overlap = 0.05;
    this.minGrain = 0.032 * sampleRate;
    this.follow = 0.08;
    this.last = null;
    this.crankVoice = null;
    this.crankSpeed = 0;
  }

  /**
   * Picks the next grain for a layer. If the grain that followed the last one in
   * the recording is close enough in rpm, carry on with it, so steady revs read
   * straight through the recording instead of jumping between unrelated moments.
   */
  pickFor(layer, kinds, rpm) {
    const next = this.cursor[layer]?.next;
    if (next && kinds.includes(next.kind) && Math.abs(Math.log(next.rpm / rpm)) < this.follow) return next;
    return this.pick(kinds, rpm);
  }

  /** One of the grains recorded closest to `rpm`, avoiding an immediate repeat. */
  pick(kinds, rpm) {
    const pool = [];
    for (const k of kinds) if (this.byKind[k]) pool.push(...this.byKind[k]);
    if (!pool.length) return null;
    pool.sort((a, b) => Math.abs(Math.log(a.rpm / rpm)) - Math.abs(Math.log(b.rpm / rpm)));
    const near = pool.slice(0, 8).filter((g) => g !== this.last);
    const g = near[Math.floor(Math.random() * near.length)] ?? pool[0];
    this.last = g;
    return g;
  }

  /**
   * Plays a grain on a layer. Any grain still sounding on that layer fades out
   * over a few milliseconds, so consecutive pulses crossfade in the quiet gap
   * before each thump instead of stacking or cutting off.
   */
  playGrain(g, rpm, gain, layer, period, attackGain = 1) {
    if (!g || gain <= 0.0005) return;
    const cycle = period > 0 ? period * sampleRate : (120 / rpm) * sampleRate;
    // At higher revs, play several consecutive recorded firings as one grain:
    // fewer joins, and the stretch between them is real continuous engine.
    let cycles = Math.max(1, Math.min(6, Math.round(this.minGrain / cycle)));
    let len = g.len;
    let last = g;
    let used = 1;
    while (used < cycles && last.next) {
      last = last.next;
      len += last.len;
      used++;
    }
    cycles = used;
    this.skip[layer] = cycles - 1;
    this.cursor[layer] = last;
    // Stretch it to last until the pulse after these is due, plus a little extra
    // so a late pulse crossfades over it instead of finding silence.
    const target = cycle * cycles * (1 + this.overlap);
    // Very low idles need grains stretched further than high revs need them squeezed.
    const rate = Math.min(1.5, Math.max(0.45, len / target));
    // Crossfade a little longer at higher revs, where the material is denser.
    const xfade = Math.max(0.003 * sampleRate, Math.min(0.007 * sampleRate, cycle * 0.3));
    for (const v of this.voices) {
      if (v.layer === layer && !v.releaseLeft) v.releaseLeft = v.releaseLen = xfade;
    }
    this.voices.push({
      layer,
      pos: 0,
      start: g.start,
      len: len + last.tail,
      rate,
      gain: gain * g.gain * this.levelFor(g),
      fadeIn: 0.0005 * sampleRate,
      fadeOut: last.tail,
      // Below 1, the opening thump is held down while the rest of the cycle plays on.
      attackGain,
      attackLen: g.len * 0.3,
    });
  }

  /** Pulls a grain's loudness part of the way toward its kind's typical level. */
  levelFor(g) {
    if (!g.rms || !this.levelling) return 1;
    const f = Math.pow(this.medianRms[g.kind] / g.rms, this.levelling);
    return Math.min(2, Math.max(0.5, f));
  }

  playOneshot(name, gain, delaySamples = 0) {
    const o = this.oneshots[name];
    if (!o) return;
    this.voices.push({ pos: -delaySamples, start: o.start, len: o.len, rate: 1, gain, fadeIn: 0.002 * sampleRate, fadeOut: 0.01 * sampleRate });
  }

  trigger(ev, p, rpmNow, throttle) {
    this.overlap = p.recOverlap;
    this.minGrain = (p.recMinGrainMs / 1000) * sampleRate;
    this.levelling = p.recLevelling;
    this.follow = p.recFollow;
    const rpm = Math.max(rpmNow, 400);
    const loud = p.recVolume * (1 + p.recThrottleLoudness * throttle);
    switch (ev.type) {
      case 'fire':
      case 'sputter':
      case 'misfire': {
        // A misfire loses its bang, but the engine keeps turning: the rest of the cycle still sounds.
        const misfire = ev.type === 'misfire';
        const typeGain = misfire ? p.recMisfireBody : ev.type === 'sputter' ? 0.5 : 1;
        const attack = misfire ? p.recMisfireAttack / Math.max(0.01, p.recMisfireBody) : 1;
        const gain = (misfire ? 1 : ev.strength) * typeGain * loud;
        const w = smoothstep(p.recBlendLo, p.recBlendHi, rpm);
        // Pick grains by the rpm this cycle actually runs at.
        const cycleRpm = ev.period > 0 ? 120 / ev.period : rpm;
        const idleKinds = p.recIdleSource === 'rev' ? ['idle2'] : ['idle'];
        if (w < 0.999) {
          if (this.skip.low > 0) this.skip.low--;
          else this.playGrain(this.pickFor('low', idleKinds, cycleRpm), rpm, gain * (1 - w), 'low', ev.period, attack);
        }
        if (w > 0.001) {
          if (this.skip.high > 0) {
            this.skip.high--;
          } else {
            // The more throttle, the more likely a grain comes from revs rising rather than falling back.
            const rising = Math.random() < smoothstep(0.08, 0.45, throttle);
            const kinds = rising ? ['accel', 'idle3', 'idle2'] : ['decel', 'idle3', 'idle2'];
            this.playGrain(this.pickFor('high', kinds, cycleRpm), rpm, gain * w * p.recRevGain, 'high', ev.period, attack);
          }
        } else {
          this.skip.high = 0;
        }
        return true;
      }
      case 'compression':
      case 'cough':
        return true; // covered by the crank loop and the shutdown recording
      case 'starterOn': {
        this.playOneshot('starterEngage', p.recStarterVolume);
        const engage = this.oneshots.starterEngage;
        this.crankVoice = { pos: -(engage ? engage.len - 0.01 * sampleRate : 0), gain: 0, target: p.recStarterVolume };
        return true;
      }
      case 'starterOff':
      case 'caught':
        if (this.crankVoice) this.crankVoice.target = 0;
        for (const v of this.voices) if (v.start === this.oneshots.starterEngage?.start) v.release = true;
        return ev.type === 'caught';
      case 'stalled':
      case 'shutdown':
        this.playOneshot('shutdown', p.recShutdownVolume);
        return true;
      default:
        return false;
    }
  }

  /** Next output sample. */
  sample(state) {
    const d = this.data;
    let s = 0;
    for (let k = this.voices.length - 1; k >= 0; k--) {
      const v = this.voices[k];
      const pos = v.pos;
      v.pos += v.rate;
      if (pos < 0) continue;
      if (pos >= v.len - 1) {
        this.voices.splice(k, 1);
        continue;
      }
      const i = Math.floor(pos);
      const f = pos - i;
      const x = d[v.start + i] * (1 - f) + d[v.start + i + 1] * f;
      let w = Math.min(1, pos / v.fadeIn, (v.len - pos) / v.fadeOut);
      if (v.attackGain !== 1 && pos < v.attackLen) {
        const k = pos / v.attackLen;
        w *= v.attackGain + (1 - v.attackGain) * k * k * (3 - 2 * k);
      }
      if (v.release) {
        v.releaseGain = (v.releaseGain ?? 1) * 0.9993;
        w *= v.releaseGain;
      }
      if (v.releaseLeft) {
        // Crossfading out under the next grain (equal-power curve).
        w *= Math.sin((Math.PI / 2) * (v.releaseLeft / v.releaseLen));
        if (--v.releaseLeft <= 0) {
          this.voices.splice(k, 1);
          continue;
        }
      }
      s += x * v.gain * w;
    }

    // Starter loop, crossfaded at its seam, playing faster or slower with the cranking speed.
    const cv = this.crankVoice;
    const loop = this.oneshots.crankLoop;
    if (cv && loop) {
      this.crankSpeed += ((state.cranking ? state.rpm : 0) - this.crankSpeed) * 0.0001;
      cv.gain += (cv.target - cv.gain) * (cv.target > cv.gain ? 0.004 : 0.0015);
      if (cv.pos < 0) {
        cv.pos += 1;
        cv.gain = 0;
      } else if (cv.gain > 0.0005 || cv.target > 0) {
        const rate = Math.min(1.3, Math.max(0.6, this.crankSpeed / this.crankRpm || 1));
        const xf = Math.floor(0.03 * sampleRate);
        const len = loop.len;
        const i = Math.floor(cv.pos);
        let x = d[loop.start + i];
        if (i > len - xf) {
          const k = (i - (len - xf)) / xf;
          x = x * (1 - k) + d[loop.start + (i - (len - xf))] * k;
        }
        s += x * cv.gain;
        cv.pos += rate;
        if (cv.pos >= len) cv.pos -= len - xf;
      } else {
        this.crankVoice = null;
      }
    }
    return s;
  }
}

class EngineProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.p = null;
    this.queue = []; // scheduled events, sorted by sample time
    this.active = []; // sounding exhaust events
    this.state = { rpm: 0, throttle: 0, roughness: 0, running: false, cranking: false };
    this.rpm = 0;
    this.throttle = 0;

    // Exhaust pipe: feedback delay line.
    this.pipe = new Float32Array(8192);
    this.pipeIdx = 0;
    this.pipeLp = 0;

    this.muffA = new Biquad();
    this.muffB = new Biquad();
    this.tone = new Biquad();
    this.dcBlock = new Biquad();
    this.intakeBp = new Biquad();
    this.tickHp = new Biquad();
    this.brushBp = new Biquad();
    this.gearBp = new Biquad();
    this.dcBlock.set('highpass', 28, 0.7, sampleRate);
    this.tickHp.set('highpass', 3500, 0.7, sampleRate);
    this.brushBp.set('bandpass', 3200, 2.5, sampleRate);
    this.gearBp.set('bandpass', 1300, 2.5, sampleRate);
    this.clatterBp = new Biquad();
    this.clatterBp.set('bandpass', 2200, 0.8, sampleRate);

    this.gearPhase = 0;
    this.starterPhase = 0;
    this.crankPhase = 0;
    this.starterGain = 0;
    this.starterSpeed = 0; // crank rpm as the starter sees it
    this.starterDip = 0;
    this.blockCount = 0;

    this.port.onmessage = (e) => this.onMessage(e.data);
  }

  onMessage(msg) {
    if (msg.params) {
      this.p = msg.params;
      this.updateFilters();
    }
    if (msg.state) this.state = msg.state;
    if (msg.bank) this.recorded = new RecordedEngine(msg.bank);
    if (msg.events) {
      for (const ev of msg.events) {
        ev.sample = Math.max(currentFrame, Math.round(ev.time * sampleRate));
        this.queue.push(ev);
      }
      this.queue.sort((a, b) => a.sample - b.sample);
    }
  }

  updateFilters() {
    const p = this.p;
    this.muffA.set('bandpass', p.mufflerFreqA, p.mufflerQA, sampleRate);
    this.muffB.set('bandpass', p.mufflerFreqB, p.mufflerQB, sampleRate);
    this.intakeBp.set('bandpass', p.intakeFreq, 1.6, sampleRate);
  }

  // Event handling -----------------------------------------------------------

  get useRecorded() {
    return !!this.recorded && this.p.engineSound === 'recorded';
  }

  trigger(ev) {
    const p = this.p;
    if (ev.type === 'state') {
      // Timed control changes, used for offline rendering.
      this.state = ev.state;
      return;
    }
    if (this.useRecorded && this.recorded.trigger(ev, p, this.rpm, this.throttle)) return;
    const sr = sampleRate;
    const rpm = Math.max(this.rpm, 150);
    const cycle = ((60 * (this.state.revsPerCycle ?? 2)) / rpm) * sr; // samples per firing cycle
    const throttle = this.throttle;
    // Pulses overlap more as revs rise; scale each one down so loudness grows
    // with revs and throttle without the sum running away.
    const density = Math.min(1, Math.pow(p.densityRefRpm / rpm, p.densityComp));
    const pressure = (p.pulseBase + p.throttlePressure * throttle) * density;
    switch (ev.type) {
      case 'fire':
      case 'sputter': {
        // No two combustion events are quite the same, even in a healthy engine.
        const vary = 1 + (Math.random() - 0.5) * p.combustionJitter;
        const amp = ev.strength * pressure * vary * (ev.type === 'sputter' ? 0.6 : 1);
        // Harder pulses under load rasp more.
        this.addExhaust(amp, cycle, 1, p.turbulence * (1 + p.turbulenceThrottle * throttle));
        // Intake honk half a cycle later, and valve ticks.
        this.addIntake(amp, cycle * 0.5);
        this.addTick(cycle * 0.27);
        this.addTick(cycle * 0.73);
        // Unburnt fuel popping in the pipe on a closed throttle at high revs.
        if (throttle < 0.05 && this.rpm > p.popMinRpm && Math.random() < p.popChance * (this.rpm / 8000)) {
          this.active.push({ kind: 'pop', age: -Math.round((0.006 + Math.random() * 0.02) * sr), amp: p.popVolume * (0.5 + Math.random()) });
        }
        break;
      }
      case 'misfire':
        this.addExhaust(0.12 * pressure, cycle, 0.3, p.turbulence * 2);
        if (Math.random() < p.popChance * 2) this.active.push({ kind: 'pop', age: -Math.round(0.01 * sr), amp: p.popVolume * 0.6 });
        break;
      case 'compression':
        // Air pushed through with no combustion: a breathy whoosh.
        this.addExhaust(ev.strength * 0.35, cycle, 0.15, 3);
        if (this.state.cranking) this.starterDip = 1;
        break;
      case 'cough':
        this.addExhaust(ev.strength, (120 / 500) * sr, 1, p.turbulence * 1.6);
        break;
      case 'starterOn':
        this.active.push({ kind: 'clunk', age: 0, amp: p.solenoidVolume });
        break;
      case 'starterOff':
      case 'ignitionOn':
      case 'ignitionOff':
        this.active.push({ kind: 'click', age: 0, amp: p.solenoidVolume * 0.45 });
        if (ev.type === 'ignitionOn') this.active.push({ kind: 'pump', age: 0, amp: 0.012 });
        break;
      default:
    }
  }

  addExhaust(amp, cycleSamples, blow, turbulence) {
    const sr = sampleRate;
    // The exhaust valve is open for roughly a third of the cycle.
    const open = Math.min(cycleSamples * 0.33, 0.06 * sr);
    this.active.push({ kind: 'exhaust', age: 0, amp, open, blow, turbulence, life: Math.max(open, 0.012 * sr) });
  }

  addIntake(amp, delay) {
    this.active.push({ kind: 'intake', age: -Math.round(delay), amp: amp * this.p.intakeVolume * (0.25 + this.throttle) });
  }

  addTick(delay) {
    this.active.push({ kind: 'tick', age: -Math.round(delay), amp: this.p.valveTickVolume });
  }

  // Synthesis ----------------------------------------------------------------

  process(_inputs, outputs) {
    const out = outputs[0][0];
    if (!out) return true;
    const p = this.p;
    if (!p) {
      out.fill(0);
      return true;
    }
    const sr = sampleRate;
    const n = out.length;
    const st = this.state;
    if (this.useRecorded) return this.processRecorded(out, n, st);

    // Smooth control values once per block.
    this.rpm += (st.rpm - this.rpm) * 0.25;
    this.throttle += (st.throttle - this.throttle) * 0.2;
    const rpmNorm = Math.min(1, this.rpm / 8500);
    if ((this.blockCount++ & 7) === 0) {
      this.tone.set('lowpass', p.toneBase + p.toneRpm * this.rpm + p.toneThrottle * this.throttle, 0.75, sr);
    }

    const pipeDelay = Math.min(8000, Math.max(8, Math.round(((2 * p.pipeLength) / 343) * sr)));
    const reflection = -p.pipeReflection;
    const damp = p.pipeDamping;
    const blowRise = 0.0004 * sr;
    const blowTau = p.blowdownMs * 0.001 * sr;
    const gearHz = (this.rpm / 60) * p.gearTeeth;
    const gearAmp = st.running ? p.gearWhineVolume * rpmNorm : 0;

    // Starter target: follows the engine's crank speed, sagging after each compression stroke.
    const starterTarget = st.cranking ? 1 : 0;
    const crankRpm = st.cranking ? st.rpm : 0;

    for (let i = 0; i < n; i++) {
      const frame = currentFrame + i;
      while (this.queue.length && this.queue[0].sample <= frame) this.trigger(this.queue.shift());

      // Exhaust excitation and the extras.
      let exc = 0;
      let dry = 0;
      for (let k = this.active.length - 1; k >= 0; k--) {
        const e = this.active[k];
        const a = e.age++;
        if (a < 0) continue;
        let v = 0;
        let done = false;
        switch (e.kind) {
          case 'exhaust': {
            // Sharp blowdown as the valve cracks open, then a falling flow.
            const blow = (1 - Math.exp(-a / blowRise)) * Math.exp(-a / blowTau);
            const t = a / e.open;
            const flow = t < 1 ? (1 - t) * (1 - t) * 0.35 : 0;
            const noise = Math.random() * 2 - 1;
            v = e.amp * (e.blow * blow + flow + noise * e.turbulence * (0.5 * blow + flow) * 0.5);
            exc += v;
            done = a > e.life && a > 8 * blowTau;
            break;
          }
          case 'pop': {
            const env = Math.exp(-a / (0.003 * sr));
            exc += e.amp * (Math.random() * 2 - 1) * env * 2 + e.amp * env;
            done = a > 0.03 * sr;
            break;
          }
          case 'intake': {
            const env = Math.exp(-a / (0.006 * sr));
            this.intakeIn = (this.intakeIn || 0) + (Math.random() * 2 - 1) * e.amp * env;
            done = a > 0.04 * sr;
            break;
          }
          case 'tick': {
            const env = Math.exp(-a / (0.00025 * sr));
            this.tickIn = (this.tickIn || 0) + (Math.random() * 2 - 1) * e.amp * env;
            done = a > 0.004 * sr;
            break;
          }
          case 'clunk': {
            const env = Math.exp(-a / (0.035 * sr));
            dry += e.amp * (Math.sin((TWO_PI * 85 * a) / sr) * env + (a < 0.003 * sr ? (Math.random() * 2 - 1) * 0.6 : 0));
            done = a > 0.25 * sr;
            break;
          }
          case 'click': {
            const env = Math.exp(-a / (0.0015 * sr));
            dry += e.amp * (Math.random() * 2 - 1) * env;
            done = a > 0.02 * sr;
            break;
          }
          case 'pump': {
            const env = Math.min(1, a / (0.04 * sr)) * (a < 0.7 * sr ? 1 : Math.max(0, 1 - (a - 0.7 * sr) / (0.2 * sr)));
            dry += e.amp * env * (Math.sin((TWO_PI * 1450 * a) / sr) + 0.3 * (Math.random() * 2 - 1));
            done = a > 0.9 * sr;
            break;
          }
          default:
            done = true;
        }
        if (done) this.active.splice(k, 1);
      }

      // Exhaust pipe: what comes back from the open end, inverted and dulled.
      const idx = this.pipeIdx;
      const back = this.pipe[(idx - pipeDelay + 8192) & 8191];
      this.pipeLp += damp * (back - this.pipeLp);
      const pipeOut = exc + reflection * this.pipeLp;
      this.pipe[idx] = pipeOut;
      this.pipeIdx = (idx + 1) & 8191;

      // Silencer: two fixed resonances blended with the pipe sound, then a load-dependent tone filter.
      const silenced =
        pipeOut * p.mufflerDirect + this.muffA.run(pipeOut) * p.mufflerGainA + this.muffB.run(pipeOut) * p.mufflerGainB;
      let s = this.tone.run(silenced) * p.exhaustVolume;

      // Intake honk and valve ticks.
      s += this.intakeBp.run(this.intakeIn || 0);
      s += this.tickHp.run(this.tickIn || 0);
      this.intakeIn = 0;
      this.tickIn = 0;

      // Mechanical clatter bed: valvetrain and piston noise, louder with revs.
      if (st.running) s += this.clatterBp.run(Math.random() * 2 - 1) * p.mechVolume * (0.3 + rpmNorm);

      // Primary gear whine, faint.
      this.gearPhase += (TWO_PI * gearHz) / sr;
      if (this.gearPhase > TWO_PI) this.gearPhase -= TWO_PI;
      s += Math.sin(this.gearPhase) * gearAmp;

      // Starter motor.
      this.starterGain += (starterTarget - this.starterGain) * (starterTarget ? 0.0015 : 0.0004);
      this.starterDip *= 1 - 1 / (0.09 * sr);
      const targetSpeed = crankRpm > 0 ? crankRpm * (1 - p.starterDip * this.starterDip) : 0;
      this.starterSpeed += (targetSpeed - this.starterSpeed) * (targetSpeed > this.starterSpeed ? 0.0008 : 0.0002);
      if (this.starterGain > 0.0005) {
        const motorHz = (this.starterSpeed / 60) * p.starterRatio;
        this.starterPhase += (TWO_PI * motorHz) / sr;
        if (this.starterPhase > TWO_PI * 1000) this.starterPhase -= TWO_PI * 1000;
        this.crankPhase += (TWO_PI * (this.starterSpeed / 60) * p.starterGearTeeth) / sr;
        if (this.crankPhase > TWO_PI * 1000) this.crankPhase -= TWO_PI * 1000;
        const ph = this.starterPhase;
        // Armature whine with commutator ripple, brush hiss and gear mesh rattle.
        const whine =
          (Math.sin(ph) * 0.5 + Math.sin(2 * ph) * 0.3 + Math.sin(3 * ph) * 0.18 + Math.sin(7 * ph) * 0.1) *
          (1 + 0.4 * Math.sin(p.commutatorSegments * ph));
        const brush = this.brushBp.run(Math.random() * 2 - 1) * p.starterBrush;
        const mesh = this.gearBp.run((Math.random() * 2 - 1) * (0.5 + 0.5 * Math.sin(this.crankPhase))) * p.starterMesh;
        const speedNorm = Math.min(1.2, this.starterSpeed / 300);
        s += this.starterGain * p.starterVolume * (whine * 0.35 * speedNorm + brush * speedNorm + mesh);
      }

      s += dry;
      s = this.dcBlock.run(s);
      out[i] = Math.tanh(s * p.drive) / Math.max(1, Math.tanh(p.drive));
    }
    return true;
  }

  /** Recorded-engine path: grains and loops, plus the synthesised relay clicks. */
  processRecorded(out, n, st) {
    const p = this.p;
    const sr = sampleRate;
    this.rpm += (st.rpm - this.rpm) * 0.25;
    this.throttle += (st.throttle - this.throttle) * 0.2;
    if ((this.blockCount++ & 7) === 0) {
      this.tone.set('lowpass', p.recToneClosed + (p.recToneOpen - p.recToneClosed) * this.throttle, 0.7, sr);
    }
    for (let i = 0; i < n; i++) {
      const frame = currentFrame + i;
      while (this.queue.length && this.queue[0].sample <= frame) this.trigger(this.queue.shift());
      let dry = 0;
      for (let k = this.active.length - 1; k >= 0; k--) {
        const e = this.active[k];
        const a = e.age++;
        if (a < 0) continue;
        let done = true;
        if (e.kind === 'click') {
          dry += e.amp * (Math.random() * 2 - 1) * Math.exp(-a / (0.0015 * sr));
          done = a > 0.02 * sr;
        } else if (e.kind === 'pump') {
          const env = Math.min(1, a / (0.04 * sr)) * (a < 0.7 * sr ? 1 : Math.max(0, 1 - (a - 0.7 * sr) / (0.2 * sr)));
          dry += e.amp * env * (Math.sin((TWO_PI * 1450 * a) / sr) + 0.3 * (Math.random() * 2 - 1));
          done = a > 0.9 * sr;
        }
        if (done) this.active.splice(k, 1);
      }
      const s = this.tone.run(this.recorded.sample(st)) + dry;
      out[i] = Math.tanh(s);
    }
    return true;
  }
}

registerProcessor('engine-processor', EngineProcessor);
