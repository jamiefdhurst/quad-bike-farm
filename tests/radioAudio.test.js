import { describe, it, expect } from 'vitest';
import { stationLibrary, idsInUse, musicFiles, RadioLibrary } from '../src/audio/radioLibrary.js';
import { RadioAudio, distortionCurve } from '../src/audio/radioAudio.js';

const manifests = {
  music: [
    { id: 'dale-00', station: 'dale', seconds: 120, file: 'audio/radio/music-dale-00.mp3', title: 'One' },
    { id: 'quarry-00', station: 'quarry', seconds: 130, file: 'audio/radio/music-quarry-00.mp3', title: 'Two' },
  ],
  extra: [{ id: 'x-dale-00', station: 'dale', seconds: 90, file: 'audio/radio/extra-dale-00.mp3', title: 'Mine' }],
  talk: [
    { id: 'dale-news-00', station: 'dale', kind: 'news', seconds: 14, file: 'audio/radio/dale-news-00.mp3' },
    { id: 'quarry-gig-00', station: 'quarry', kind: 'gig', seconds: 11, file: 'audio/radio/quarry-gig-00.mp3' },
  ],
};

describe('a station\'s library', () => {
  it('is its own songs, the ones dropped into the folder and the ones added in the game, and its own talk', () => {
    const local = [{ id: 'local-0', station: 'dale', seconds: 200, title: 'Added' }];
    const lib = stationLibrary('dale', manifests, local);
    expect(lib.music.map((m) => m.id)).toEqual(['dale-00', 'x-dale-00', 'local-0']);
    expect(lib.talk.map((t) => t.id)).toEqual(['dale-news-00']);
    expect(stationLibrary('quarry', manifests).music.map((m) => m.id)).toEqual(['quarry-00']);
  });

  it('copes with a manifest that has not loaded', () => {
    expect(stationLibrary('dale', { music: [], talk: [] })).toEqual({ music: [], talk: [] });
  });

  it('keeps decoded only what is on air', () => {
    const ids = idsInUse([{ item: { id: 'a' } }, { item: null }, { item: { id: 'b' } }]);
    expect([...ids].sort()).toEqual(['a', 'b']);
    const lib = new RadioLibrary({ ctx: null });
    lib.buffers.set('a', {});
    lib.buffers.set('c', {});
    lib.evict(new Set(['a']));
    expect([...lib.buffers.keys()]).toEqual(['a']);
  });

  it('takes the music from a picked folder and leaves the rest', () => {
    const files = [{ name: 'a.mp3', type: '' }, { name: 'notes.txt', type: 'text/plain' }, { name: 'b.FLAC', type: '' }, { name: 'c', type: 'audio/ogg' }];
    expect(musicFiles(files).map((f) => f.name)).toEqual(['a.mp3', 'b.FLAC', 'c']);
  });

  it('adds picked songs to a station, decoded and kept, and lets the programme know', async () => {
    const ctx = { decodeAudioData: async () => ({ duration: 33 }) };
    const lib = new RadioLibrary({ ctx });
    const file = (name) => ({ name, type: 'audio/mpeg', arrayBuffer: async () => new ArrayBuffer(8) });
    const before = lib.revision;
    expect(await lib.addLocal('quarry', [file('Big Riff.mp3'), { name: 'x.txt', type: 'text/plain' }])).toBe(1);
    expect(lib.revision).toBeGreaterThan(before);
    const added = lib.library('quarry').music[0];
    expect(added).toMatchObject({ title: 'Big Riff', seconds: 33 });
    expect(lib.buffer(added)).toEqual({ duration: 33 });
    lib.evict(new Set());
    expect(lib.buffer(added)).toEqual({ duration: 33 });
    expect(lib.library('dale').music).toEqual([]);
  });
});

describe('the radio audio', () => {
  const hub = { ctx: { currentTime: 42 }, ready: true };
  const audio = () => {
    const a = new RadioAudio(hub);
    a.library.manifests = manifests;
    a.library.revision = 1;
    return a;
  };

  it('has one programme a station, shared, that follows the library as it grows', () => {
    const a = audio();
    const p = a.programmeFor('dale', 42);
    expect(a.programmeFor('dale', 42)).toBe(p);
    expect(a.programmeFor('quarry', 42)).not.toBe(p);
    expect(p.at(42).item).not.toBeNull();
    a.library.manifests = { ...manifests, music: [...manifests.music, { id: 'dale-01', station: 'dale', seconds: 100, title: 'Three' }] };
    a.library.revision = 2;
    expect(a.programmeFor('dale', 42)).toBe(p);
    expect(p.library.music.map((m) => m.id)).toContain('dale-01');
  });

  it('says what is on, for the panel', () => {
    const a = audio();
    expect(a.nowPlaying('dale')).toBeNull();
    a.programmeFor('dale', 42);
    const now = a.nowPlaying('dale');
    expect(['music', 'news']).toContain(now.kind);
    expect(now.left).toBeGreaterThan(0);
  });

  it('shapes a cheap speaker\'s overload', () => {
    const clean = distortionCurve(0);
    const buzz = distortionCurve(1);
    expect(clean[512]).toBeCloseTo(0, 2);
    expect(buzz[1023]).toBeCloseTo(1, 3);
    expect(buzz[1023 - 100]).toBeGreaterThan(clean[1023 - 100]);
  });
});
