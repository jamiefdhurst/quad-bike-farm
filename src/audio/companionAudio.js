// Her voice. Words go through the browser's speech synthesis with a British
// woman's voice if there is one (there are no CC0 recordings of lines like
// these, and shipping generated speech wouldn't be CC0 either). Sighs, hums,
// laughs and so on are real CC0 recordings (public/audio/companion.*), played
// from where her head is.

// Most natural first. Matched against the start of each voice's name.
const PREFERRED_VOICES = [
  'Google UK English Female',
  'Microsoft Sonia Online',
  'Microsoft Libby Online',
  'Microsoft Maisie Online',
  'Microsoft Hazel',
  'Microsoft Susan',
  'Serena',
  'Kate',
  'Stephanie',
  'Martha',
  'Flo (English (United Kingdom))',
  'Shelley (English (United Kingdom))',
  'Sandy (English (United Kingdom))',
];
const MALE_VOICES = /daniel|oliver|arthur|george|ryan|thomas|eddy|reed|rocko|grandpa|alfie|elliot|noah|male\b/i;

export class Speech {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voice = null;
    if (!this.synth) return;
    this.chooseVoice();
    this.synth.addEventListener?.('voiceschanged', () => this.chooseVoice());
  }

  get available() {
    return !!this.synth;
  }

  chooseVoice() {
    const voices = this.synth.getVoices();
    if (!voices.length) return;
    const british = voices.filter((v) => /^en[-_]GB/i.test(v.lang));
    let voice = null;
    for (const name of PREFERRED_VOICES) {
      voice = voices.find((v) => v.name.startsWith(name));
      if (voice) break;
    }
    voice ??= british.find((v) => !MALE_VOICES.test(v.name)) ?? british[0] ?? voices.find((v) => v.lang.startsWith('en'));
    if (voice && voice !== this.voice) {
      this.voice = voice;
      console.info(`Her voice: ${voice.name} (${voice.lang})`);
    }
  }

  /** Speaks a line, cutting off anything she was still saying. */
  say(text, { volume = 1, rate = 1, pitch = 1 } = {}) {
    if (!this.synth) return;
    this.synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) u.voice = this.voice;
    u.lang = this.voice?.lang ?? 'en-GB';
    u.volume = Math.min(1, Math.max(0, volume));
    u.rate = rate;
    u.pitch = pitch;
    this.synth.speak(u);
  }

  /** Rough length of a spoken line, for captions and spacing. */
  static duration(text, rate = 1) {
    return (0.5 + text.split(/\s+/).length * 0.36) / rate;
  }
}

/** Her recorded non-verbal sounds, played through the AudioHub. */
export class CompanionSounds {
  constructor(hub) {
    this.hub = hub;
    this.clips = null;
    this.buffer = null;
    this.loading = null;
    this.active = null; // { source, panner }
  }

  /** Loads the clips once the audio context exists. */
  ensure() {
    const ctx = this.hub.ctx;
    if (!ctx || this.loading) return;
    const base = import.meta.env?.BASE_URL ?? '/';
    this.loading = fetch(`${base}audio/companion.json`)
      .then((r) => r.json())
      .then(async (bank) => {
        const data = await (await fetch(base + bank.file)).arrayBuffer();
        this.buffer = await ctx.decodeAudioData(data);
        this.clips = bank.clips;
      })
      .catch((err) => console.error('Companion sounds failed to load', err));
  }

  /** Plays a random clip of a kind from `position`; returns its length in seconds, or 0. */
  play(kind, position, volume = 1, random = Math.random) {
    const hub = this.hub;
    const list = this.clips?.[kind];
    if (!list?.length || !hub.master) return 0;
    const ctx = hub.ctx;
    const clip = list[Math.floor(random() * list.length)];
    this.stop();
    const source = ctx.createBufferSource();
    source.buffer = this.buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1.5;
    panner.rolloffFactor = 1.2;
    source.connect(gain).connect(panner).connect(hub.master);
    this.active = { source, panner };
    this.setPosition(position);
    source.start(0, clip.start, clip.dur);
    source.onended = () => {
      if (this.active?.source === source) this.active = null;
    };
    return clip.dur;
  }

  /** Keeps a playing clip coming from her head as she moves. */
  setPosition(p) {
    const pn = this.active?.panner;
    if (!pn) return;
    const t = this.hub.ctx.currentTime;
    pn.positionX.setValueAtTime(p.x, t);
    pn.positionY.setValueAtTime(p.y, t);
    pn.positionZ.setValueAtTime(p.z, t);
  }

  stop() {
    if (!this.active) return;
    try {
      this.active.source.stop();
    } catch {
      // already stopped
    }
    this.active = null;
  }
}
