// The sound of vehicles on the lane and the visitors' on the farm road: for each, a low engine drone (a sawtooth through a low-pass, a
// little rougher for a tractor) and a hiss of tyre noise that grows with speed, played from where it is through a panner. The pitch drops as
// it passes: the drone's frequency is shifted by the Doppler factor against the listener. Made when a vehicle appears, dropped when it goes.

import { dopplerFactor } from './propagation.js';

/** Hz of the drone at a cruise by kind, and how loud it is (0..1). */
export const DRONE = {
  van: { hz: 58, level: 0.5, rough: 0.3 },
  tor: { hz: 50, level: 0.55, rough: 0.5 },
  tractor: { hz: 34, level: 0.8, rough: 0.8 },
  utv: { hz: 66, level: 0.4, rough: 0.3 },
  post: { hz: 58, level: 0.5, rough: 0.3 },
  neighbour: { hz: 50, level: 0.55, rough: 0.5 },
  tuner: { hz: 58, level: 0.5, rough: 0.35 }, // the rolling road's Crag
};

/** The drone's pitch and loudness for a speed: it idles at a low note, climbs with speed to the cruise, and goes quiet when stood. */
export function droneFor(kind, speed, cruise = 14) {
  const d = DRONE[kind] ?? DRONE.van;
  const k = Math.min(1.3, speed / cruise);
  return { hz: d.hz * (0.75 + 0.5 * k), gain: d.level * (0.25 + 0.75 * Math.min(1, k)), tyre: Math.min(1, speed / 16) ** 1.5 };
}

export class TrafficAudio {
  constructor(hub, volume = 0.9) {
    this.hub = hub;
    this.volume = volume;
    this.voices = new Map();
    this.noise = null;
  }

  noiseBuffer(ctx) {
    if (this.noise) return this.noise;
    const n = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let seed = 7;
    for (let i = 0; i < n; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      d[i] = seed / 2147483648 - 1;
    }
    return (this.noise = buf);
  }

  make(kind) {
    const ctx = this.hub.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 7;
    panner.maxDistance = 600;
    out.connect(panner).connect(this.hub.master);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const drone = ctx.createGain();
    osc.connect(lp).connect(drone).connect(out);
    osc.start();
    const hiss = ctx.createBufferSource();
    hiss.buffer = this.noiseBuffer(ctx);
    hiss.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.5;
    const tyre = ctx.createGain();
    tyre.gain.value = 0;
    hiss.connect(bp).connect(tyre).connect(out);
    hiss.start();
    return { out, panner, osc, lp, drone, tyre, hiss, kind };
  }

  /**
   * `items`: [{ id, kind, x, y, z, vx, vz, speed }] for everything making a noise; `listener` { x, y, z, vx, vz }. Quiet when the hub isn't running.
   */
  update(items, listener) {
    const hub = this.hub;
    if (!hub.ready) return;
    const ctx = hub.ctx;
    const now = ctx.currentTime;
    const seen = new Set();
    for (const it of items) {
      seen.add(it.id);
      let v = this.voices.get(it.id);
      if (!v) {
        v = this.make(it.kind);
        this.voices.set(it.id, v);
      }
      const f = droneFor(it.kind, it.speed);
      const dop = dopplerFactor(listener, { x: listener.vx ?? 0, y: 0, z: listener.vz ?? 0 }, it, { x: it.vx, y: 0, z: it.vz });
      const rough = (DRONE[it.kind] ?? DRONE.van).rough;
      v.osc.frequency.setTargetAtTime(f.hz * dop, now, 0.05);
      v.lp.frequency.setTargetAtTime(220 + 260 * rough + it.speed * 14, now, 0.1);
      v.drone.gain.setTargetAtTime(f.gain * 0.5, now, 0.1);
      v.tyre.gain.setTargetAtTime(f.tyre * 0.22, now, 0.1);
      v.out.gain.setTargetAtTime(this.volume, now, 0.1);
      const p = v.panner;
      if (p.positionX) {
        p.positionX.setTargetAtTime(it.x, now, 0.05);
        p.positionY.setTargetAtTime(it.y, now, 0.05);
        p.positionZ.setTargetAtTime(it.z, now, 0.05);
      } else p.setPosition(it.x, it.y, it.z);
    }
    for (const [id, v] of this.voices) {
      if (seen.has(id)) continue;
      v.out.disconnect();
      v.osc.stop();
      v.hiss.stop();
      v.osc.disconnect();
      this.voices.delete(id);
    }
  }
}
