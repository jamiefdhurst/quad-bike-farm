// A girl asleep on the bales (dozing.js), made on the spot: each breath is soft noise, in for about 40% of 3.6 s with the band opening
// upward, then out with a low flutter (a sawtooth at about 28 Hz through a low band-pass: the snore). Only close by; `pitch` makes
// one girl's a little higher.

import { WildlifeAudio } from './wildlifeAudio.js';
import { BREATH_SECONDS } from '../npc/dozing.js';

export class SnoreAudio extends WildlifeAudio {
  constructor(hub, params = {}) {
    super(hub, { volume: 0.5, refDistance: 1.5, ...params });
    this.timers = {};
  }

  /** One breath at { x, y, z }. */
  breath({ x, y, z }, pitch = 1) {
    const o = this.out(x, y + 0.9, z, 0.5);
    if (!o) return;
    const { ctx, node } = o;
    const t = ctx.currentTime;
    const inLen = BREATH_SECONDS * 0.4;
    // In: breath noise, the band sliding up.
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(350 * pitch, t);
    bp.frequency.linearRampToValueAtTime(700 * pitch, t + inLen);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5, t + inLen * 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t + inLen);
    src.connect(bp).connect(g).connect(node);
    src.start(t);
    src.stop(t + inLen + 0.05);
    // Out: the snore, a flutter of low buzz with a puff of breath over it.
    const at = t + inLen;
    const outLen = BREATH_SECONDS - inLen - 0.3;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 28 * pitch;
    const low = ctx.createBiquadFilter();
    low.type = 'bandpass';
    low.frequency.value = 260 * pitch;
    low.Q.value = 1.2;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, at);
    og.gain.linearRampToValueAtTime(0.35, at + 0.15);
    og.gain.exponentialRampToValueAtTime(0.0001, at + outLen);
    osc.connect(low).connect(og).connect(node);
    osc.start(at);
    osc.stop(at + outLen + 0.05);
    const puff = ctx.createBufferSource();
    puff.buffer = this.noiseBuffer(ctx);
    puff.loop = true;
    const pb = ctx.createBiquadFilter();
    pb.type = 'bandpass';
    pb.frequency.value = 500 * pitch;
    pb.Q.value = 0.7;
    const pg = ctx.createGain();
    pg.gain.setValueAtTime(0.0001, at);
    pg.gain.linearRampToValueAtTime(0.25, at + 0.2);
    pg.gain.exponentialRampToValueAtTime(0.0001, at + outLen);
    puff.connect(pb).connect(pg).connect(node);
    puff.start(at);
    puff.stop(at + outLen + 0.05);
  }

  /** Each frame for each girl (`key`): a breath every few seconds while she's asleep and you're within `range` metres. */
  update(dt, key, at, asleep, range, pitch) {
    this.timers[key] = (this.timers[key] ?? 0) - dt;
    if (!asleep || this.timers[key] > 0) return;
    const l = this.hub.listenerPosition;
    if (l && Math.hypot(l.x - at.x, l.z - at.z) > range) return;
    this.timers[key] = BREATH_SECONDS;
    this.breath(at, pitch);
  }
}
