import { describe, it, expect } from 'vitest';
import { VoiceChunks, chunkOf, bankFiles } from '../src/audio/voiceChunks.js';

const decoder = () => {
  const calls = [];
  return { calls, decode: (i) => { calls.push(i); return Promise.resolve(`buffer ${i}`); } };
};

describe('voice files decoded as they are needed', () => {
  it('decodes a file the first time it is wanted, and not again', async () => {
    const d = decoder();
    const c = new VoiceChunks(10, d.decode);
    expect(c.ready(3)).toBe(null);
    expect(await c.get(3)).toBe('buffer 3');
    expect(c.ready(3)).toBe('buffer 3');
    await c.get(3);
    expect(d.calls).toEqual([3]);
  });

  it('decodes once even when asked twice while it is still decoding', async () => {
    const d = decoder();
    const c = new VoiceChunks(10, d.decode);
    await Promise.all([c.get(1), c.get(1)]);
    expect(d.calls).toEqual([1]);
  });

  it('keeps only the most recently used files', async () => {
    const d = decoder();
    const c = new VoiceChunks(10, d.decode, 2);
    await c.get(0);
    await c.get(1);
    c.ready(0); // used again, so 1 is now the oldest
    await c.get(2);
    expect(c.ready(1)).toBe(null);
    expect(c.ready(0)).toBe('buffer 0');
    expect(c.ready(2)).toBe('buffer 2');
  });

  it('can try again after a file fails to decode', async () => {
    let fail = true;
    const c = new VoiceChunks(1, () => (fail ? Promise.reject(new Error('bad')) : Promise.resolve('ok')));
    await expect(c.get(0)).rejects.toThrow('bad');
    fail = false;
    expect(await c.get(0)).toBe('ok');
  });

  it('reads old one-file banks as well as split ones', () => {
    expect(bankFiles({ file: 'audio/a.mp3' })).toEqual(['audio/a.mp3']);
    expect(bankFiles({ files: ['audio/a-000.mp3', 'audio/a-001.mp3'] })).toHaveLength(2);
    expect(chunkOf({ start: 1, dur: 2 })).toBe(0);
    expect(chunkOf({ file: 4, start: 1, dur: 2 })).toBe(4);
  });
});
