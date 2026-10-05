// Her voice. Spoken lines are recorded offline with a British woman's voice
// (tools/generate_companion_voice.py, into public/audio/companion-voice.*), and
// sighs, hums, laughs and so on are real CC0 recordings (public/audio/companion.*).
// Both play from where her head is. A line with no recording yet falls back to
// the browser's speech synthesis, but only with a voice known to be a woman's.

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
// Browsers swap in their default voice (often a man's) when the chosen one
// isn't loaded or a network voice fails, so a voice is set explicitly every
// time and anything not on this list is never used.

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
    // Local voices first: network ones are the ones that fail and fall back.
    let voice = null;
    for (const local of [true, false]) {
      for (const name of PREFERRED_VOICES) {
        voice = voices.find((v) => v.name.startsWith(name) && v.localService === local);
        if (voice) break;
      }
      if (voice) break;
    }
    if (voice && voice !== this.voice) {
      this.voice = voice;
      console.info(`Browser voice for any unrecorded lines: ${voice.name} (${voice.lang})`);
    }
  }

  /** Speaks a line, cutting off anything she was still saying. Returns false if there's no suitable voice. */
  say(text, { volume = 1, rate = 1, pitch = 1 } = {}) {
    if (!this.synth || !this.voice) return false;
    this.synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = this.voice;
    u.lang = this.voice.lang;
    u.volume = Math.min(1, Math.max(0, volume));
    u.rate = rate;
    u.pitch = pitch;
    this.synth.speak(u);
    return true;
  }

  stop() {
    this.synth?.cancel();
  }

  /** Rough length of a spoken line, for captions and spacing. */
  static duration(text, rate = 1) {
    return (0.5 + text.split(/\s+/).length * 0.36) / rate;
  }
}

/** Her recorded lines and sounds, played through the AudioHub from her head. */
export class CompanionSounds {
  /** `voiceBank` is her recorded lines (public/audio/<voiceBank>.json); `rate` plays her sighs and laughs a shade faster and higher. */
  constructor(hub, { voiceBank = 'companion-voice', rate = 1 } = {}) {
    this.hub = hub;
    this.voiceBank = voiceBank;
    this.rate = rate;
    this.banks = {}; // 'sounds' (sighs, hums...) and 'voice' (spoken lines by text): { buffer, clips }
    this.loading = null;
    this.active = null; // { source, panner }
  }

  /** Loads both banks once the audio context exists. */
  ensure() {
    const ctx = this.hub.ctx;
    if (!ctx || this.loading) return;
    const base = import.meta.env?.BASE_URL ?? '/';
    const load = (name, file) =>
      fetch(`${base}audio/${file}.json`)
        .then((r) => r.json())
        .then(async (bank) => {
          const data = await (await fetch(base + bank.file)).arrayBuffer();
          this.banks[name] = { buffer: await ctx.decodeAudioData(data), clips: bank.clips };
        })
        .catch((err) => console.error(`Companion ${name} failed to load`, err));
    this.loading = Promise.all([load('sounds', 'companion'), load('voice', this.voiceBank)]);
  }

  /** Plays a random sound of a kind (sigh, hum...); returns its length in seconds, or 0. */
  play(kind, position, volume = 1, { rolloff = 1.2 } = {}, random = Math.random) {
    const list = this.banks.sounds?.clips[kind];
    if (!list?.length) return 0;
    return this.start(this.banks.sounds.buffer, list[Math.floor(random() * list.length)], position, volume, rolloff, this.rate);
  }

  /** Says a recorded line; returns its length in seconds, or 0 if it hasn't been recorded. */
  say(text, position, volume = 1, { rolloff = 1.2 } = {}) {
    const clip = this.banks.voice?.clips[text];
    return clip ? this.start(this.banks.voice.buffer, clip, position, volume, rolloff) : 0;
  }

  /** `rolloff` is how fast it fades with distance: lower carries further, as a shout does. */
  start(buffer, clip, position, volume, rolloff = 1.2, rate = 1) {
    const hub = this.hub;
    if (!hub.master) return 0;
    const ctx = hub.ctx;
    this.stop();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1.5;
    panner.rolloffFactor = rolloff;
    source.connect(gain).connect(panner).connect(hub.master);
    this.active = { source, panner };
    this.setPosition(position);
    source.start(0, clip.start, clip.dur); // in seconds of the recording, whatever the rate
    source.onended = () => {
      if (this.active?.source === source) this.active = null;
    };
    return clip.dur / rate;
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
