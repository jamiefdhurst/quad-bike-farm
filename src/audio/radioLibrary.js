// The radio's files: which songs and talk items each station has (public/audio/radio/talk.json, music.json and extra.json, written by
// tools/generate_radio_talk.py and tools/build_radio_music.py), and the decoded audio of the ones on air now. A song is about two
// minutes and decodes to tens of megabytes, so only what is playing or about to is kept; songs you add from a folder in the game are
// kept for the session (radioStation.js shuffles them in with the station's own).

/** One station's library from the manifests and the songs added in the game: { music, talk }. Pure. */
export function stationLibrary(stationId, manifests, locals = []) {
  const mine = (list) => (list ?? []).filter((x) => x.station === stationId);
  return {
    music: [...mine(manifests.music), ...mine(manifests.extra), ...mine(locals)],
    talk: mine(manifests.talk),
  };
}

/** The ids to keep decoded: whatever is on air in these slots (the ones to evict are the rest). */
export function idsInUse(slots) {
  return new Set(slots.filter((s) => s.item).map((s) => s.item.id));
}

const AUDIO_FILES = /\.(mp3|wav|flac|m4a|ogg)$/i;

/** Of the files picked in a folder dialog, the ones that are music. */
export function musicFiles(files) {
  return [...files].filter((f) => AUDIO_FILES.test(f.name) || /^audio\//.test(f.type));
}

export class RadioLibrary {
  constructor(hub) {
    this.hub = hub;
    this.manifests = { talk: [], music: [], extra: [] };
    this.locals = []; // { id, station, title, artist, seconds }, with the decoded audio in `held`
    this.held = new Map(); // id -> AudioBuffer, for the songs added in the game
    this.buffers = new Map(); // id -> AudioBuffer, for what is on air
    this.loading = new Map(); // id -> promise
    this.failed = new Set();
    this.revision = 0; // goes up when what a station has changes
    this.started = false;
    this.localCount = 0;
  }

  /** Fetches the manifests, once the audio context exists. */
  ensure() {
    if (this.started || !this.hub.ctx) return;
    this.started = true;
    const base = import.meta.env?.BASE_URL ?? '/';
    this.base = base;
    const get = (name, key) =>
      fetch(`${base}audio/radio/${name}.json`)
        .then((r) => (r.ok ? r.json() : {}))
        .then((j) => {
          this.manifests[key] = j[key === 'talk' ? 'talk' : 'tracks'] ?? [];
          this.revision++;
        })
        .catch(() => {});
    get('talk', 'talk');
    get('music', 'music');
    get('extra', 'extra');
  }

  library(stationId) {
    return stationLibrary(stationId, this.manifests, this.locals);
  }

  /** The decoded audio of an item if it is ready; otherwise starts getting it and gives null. */
  buffer(item) {
    if (!item) return null;
    const have = this.held.get(item.id) ?? this.buffers.get(item.id);
    if (have) return have;
    if (this.loading.has(item.id) || this.failed.has(item.id) || !this.hub.ctx || !item.file) return null;
    const ctx = this.hub.ctx;
    const p = fetch(this.base + item.file)
      .then((r) => r.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((b) => this.buffers.set(item.id, b))
      .catch(() => this.failed.add(item.id))
      .finally(() => this.loading.delete(item.id));
    this.loading.set(item.id, p);
    return null;
  }

  /** Lets go of every decoded item that is not in `keep` (a Set of ids). */
  evict(keep) {
    for (const id of [...this.buffers.keys()]) if (!keep.has(id)) this.buffers.delete(id);
  }

  /** Adds songs picked in the game to a station for the rest of the session; resolves to how many played. */
  async addLocal(stationId, files) {
    const ctx = this.hub.ctx;
    if (!ctx) return 0;
    let added = 0;
    for (const f of musicFiles(files)) {
      try {
        const buf = await ctx.decodeAudioData(await f.arrayBuffer());
        const id = `local-${this.localCount++}`;
        this.held.set(id, buf);
        this.locals.push({ id, station: stationId, title: f.name.replace(AUDIO_FILES, ''), artist: '', seconds: buf.duration });
        added++;
      } catch {
        // not something the browser can play
      }
    }
    if (added) this.revision++;
    return added;
  }
}
