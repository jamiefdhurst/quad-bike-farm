// Her recorded lines come in files of about a minute each (tools/generate_companion_voice.py). A file is downloaded and decoded only when a line in
// it is first wanted, and only the few used most recently are kept decoded: the whole bank
// decoded at once was about a gigabyte of memory per girl. Pure: decoding is passed in, so this is tested without Web Audio.

export const VOICE_CHUNKS_KEPT = 6; // decoded files kept per girl (about 11 MB each at 48 kHz)

/** Which file a clip is in. Banks from before the split have one file and clips with no `file`. */
export const chunkOf = (clip) => clip.file ?? 0;

/** The bank's file list, old single-file banks included. */
export const bankFiles = (bank) => bank.files ?? (bank.file ? [bank.file] : []);

export class VoiceChunks {
  /** `decode(i)` returns a promise of file i decoded; `kept` is how many decoded files to hold on to. */
  constructor(count, decode, kept = VOICE_CHUNKS_KEPT) {
    this.count = count;
    this.decode = decode;
    this.kept = kept;
    this.decoded = new Map(); // file index -> decoded buffer, oldest use first
    this.pending = new Map(); // file index -> promise, while it decodes
  }

  /** The decoded file now if it's ready (and marks it just used), otherwise null. */
  ready(i) {
    const buf = this.decoded.get(i);
    if (!buf) return null;
    this.decoded.delete(i);
    this.decoded.set(i, buf);
    return buf;
  }

  /** A promise of the decoded file, starting the decode if it isn't under way. */
  get(i) {
    const now = this.ready(i);
    if (now) return Promise.resolve(now);
    if (!this.pending.has(i)) {
      const job = Promise.resolve(this.decode(i)).then((buf) => {
        this.pending.delete(i);
        this.decoded.set(i, buf);
        while (this.decoded.size > this.kept) this.decoded.delete(this.decoded.keys().next().value);
        return buf;
      }, (err) => {
        this.pending.delete(i);
        throw err;
      });
      this.pending.set(i, job);
    }
    return this.pending.get(i);
  }
}
