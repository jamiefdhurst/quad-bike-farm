import { describe, expect, it } from 'vitest';
import { voiceRoom } from '../src/npc/voiceRoom.js';
import { DEFAULT_COMPANION_PARAMS, COMPANION_PARAM_RANGES } from '../src/npc/companionParams.js';
import { DEFAULT_BARN_PARAMS } from '../src/world/barn.js';

const p = DEFAULT_COMPANION_PARAMS;
const room = (helmet, listenerIn, sourceIn) => voiceRoom({ helmet, listenerIn, sourceIn }, p, DEFAULT_BARN_PARAMS);

describe('voice under a helmet and in the barn', () => {
  it('muffles her with her helmet on and leaves her clear with it off', () => {
    expect(room(true, false, false).cutoff).toBe(p.voiceHelmetCutoff);
    expect(room(true, false, false).cutoff).toBeLessThan(room(false, false, false).cutoff);
    expect(room(false, false, false).cutoff).toBeGreaterThanOrEqual(20000);
  });

  it('rings in the barn with both of you inside, less through the doorway, and not at all with neither', () => {
    const both = room(false, true, true).send;
    const door = room(false, false, true).send;
    expect(both).toBe(DEFAULT_BARN_PARAMS.reverbWet);
    expect(door).toBeGreaterThan(0);
    expect(door).toBeLessThan(both);
    expect(room(false, true, false).send).toBe(door);
    expect(room(false, false, false).send).toBe(0);
  });

  it('keeps the helmet and the room apart', () => {
    expect(room(true, true, true).send).toBe(room(false, true, true).send);
  });

  it('has a tunable cutoff with a range that holds its default', () => {
    const [min, max] = COMPANION_PARAM_RANGES.voiceHelmetCutoff;
    expect(p.voiceHelmetCutoff).toBeGreaterThanOrEqual(min);
    expect(p.voiceHelmetCutoff).toBeLessThanOrEqual(max);
  });
});

describe('her sounds apply the room to the line playing', () => {
  const node = () => ({ connect: (n) => n ?? node(), gain: param(), frequency: param(), detune: param(), playbackRate: {}, positionX: param(), positionY: param(), positionZ: param(), start() {}, Q: {} });
  const param = () => ({ value: 0, setTargetAtTime(v) { this.value = v; }, setValueAtTime(v) { this.value = v; } });
  it('muffles a line already playing and sends it to the echo', async () => {
    const { CompanionSounds } = await import('../src/audio/companionAudio.js');
    const reverb = {};
    const hub = { master: {}, reverb, ctx: { currentTime: 0, createBufferSource: node, createGain: node, createPanner: node, createBiquadFilter: node } };
    const s = new CompanionSounds(hub);
    s.start({}, { start: 0, dur: 1 }, { x: 0, y: 0, z: 0 }, 1);
    s.setRoom(2500, 0.4);
    expect(s.active.muffle.frequency.value).toBe(2500);
    expect(s.active.send.gain.value).toBe(0.4);
    s.stop();
    s.setRoom(1000, 0.1);
    s.start({}, { start: 0, dur: 1 }, { x: 0, y: 0, z: 0 }, 1); // the next line starts already muffled
    expect(s.active.muffle.frequency.value).toBe(1000);
  });
});
