// The flock's bleats: one recording (public/audio/sheep-baa.wav, CC0), loaded the first time a sheep is near enough to be heard, and
// played from the sheep through a panner, each at her own pitch, a little duller the further off she is.

const HEARD_WITHIN = 130; // m beyond which a bleat isn't worth starting

export class SheepAudio {
  constructor(hub, params = {}) {
    this.hub = hub;
    this.p = { volume: 0.55, loudVolume: 0.9, refDistance: 5, ...params };
    this.buffer = null;
    this.loading = null;
  }

  async load() {
    const base = import.meta.env?.BASE_URL ?? '/';
    try {
      this.buffer = await this.hub.ctx.decodeAudioData(await (await fetch(`${base}audio/sheep-baa.wav`)).arrayBuffer());
    } catch (err) {
      console.warn('Sheep sound unavailable', err);
      this.buffer = false;
    }
  }

  /** One bleat from (x, y, z): `pitch` is the sheep's playback rate, `loud` when she is frightened. */
  bleat({ x, y, z, pitch = 1, loud = false }) {
    const hub = this.hub;
    if (!hub.ready || hub.paused || this.buffer === false) return;
    const l = hub.listenerPosition;
    const d = l ? Math.hypot(l.x - x, l.y - y, l.z - z) : 0;
    if (d > HEARD_WITHIN) return;
    if (!this.buffer) {
      this.loading ??= this.load();
      return;
    }
    const ctx = hub.ctx;
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = this.p.refDistance;
    panner.maxDistance = 400;
    if (panner.positionX) {
      panner.positionX.value = x;
      panner.positionY.value = y;
      panner.positionZ.value = z;
    } else panner.setPosition(x, y, z);
    // Air takes the top off a distant call.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = Math.max(1800, 9000 - d * 55);
    const gain = ctx.createGain();
    gain.gain.value = (loud ? this.p.loudVolume : this.p.volume) * (0.85 + Math.random() * 0.3);
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = pitch * (loud ? 1.08 : 1);
    src.connect(filter).connect(gain).connect(panner).connect(hub.master);
    src.onended = () => panner.disconnect();
    src.start();
  }
}
