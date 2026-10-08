// The bell's sound: one strike made once (world/bell.js bellStrike) and played at the bell, louder or softer by how hard the
// clapper hit and a touch higher or lower each time, through a panner at the bell.

import { bellStrike } from '../world/bell.js';

export class BellAudio {
  constructor(hub, params, position) {
    this.hub = hub;
    this.p = params;
    this.position = position;
    this.out = null;
  }

  /** Builds the panner and the strike the first time it's needed, once the sound has started. */
  attach() {
    const hub = this.hub;
    if (this.out || !hub.ready) return !!this.out;
    const ctx = hub.ctx;
    this.panner = ctx.createPanner();
    this.panner.panningModel = 'HRTF';
    this.panner.distanceModel = 'inverse';
    this.panner.maxDistance = 600;
    const { x, y, z } = this.position;
    if (this.panner.positionX) {
      this.panner.positionX.value = x;
      this.panner.positionY.value = y;
      this.panner.positionZ.value = z;
    } else this.panner.setPosition(x, y, z);
    this.out = ctx.createGain();
    this.out.connect(this.panner).connect(hub.master);
    return true;
  }

  /** One strike, `strength` 0 to 1. */
  strike(strength) {
    if (!this.attach()) return;
    const ctx = this.hub.ctx;
    const p = this.p;
    if (!this.buffer || this.builtFor !== `${p.pitch}/${p.ringSeconds}`) {
      const samples = bellStrike(ctx.sampleRate, p);
      this.buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      this.buffer.copyToChannel(samples, 0);
      this.builtFor = `${p.pitch}/${p.ringSeconds}`;
    }
    this.panner.refDistance = p.refDistance;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = 0.99 + Math.random() * 0.02;
    const gain = ctx.createGain();
    gain.gain.value = p.volume * (0.35 + 0.65 * strength);
    src.connect(gain).connect(this.out);
    src.start();
  }
}
