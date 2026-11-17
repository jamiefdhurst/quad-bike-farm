import { describe, it, expect } from 'vitest';
import { GeneratorAudio } from '../src/audio/generatorAudio.js';
import { DEFAULT_SOUND_PARAMS, SOUND_PARAM_RANGES } from '../src/audio/audioParams.js';

/** A hub that records what the generator's chain does, with no audio context behind it. */
function stubHub(params) {
  const gain = { connect: (n) => n, gain: { value: -1, targets: [], setTargetAtTime(v) { this.targets.push(v); } } };
  const node = () => ({ connect: (n) => n, disconnect() {}, frequency: { value: 0, setTargetAtTime() {} } });
  const ctx = {
    currentTime: 0,
    createPanner: () => ({ ...node(), positionX: { value: 0 }, positionY: { value: 0 }, positionZ: { value: 0 } }),
    createBiquadFilter: node,
    createGain: () => gain,
  };
  return { gain, hub: { ctx, params, master: {}, listenerPosition: { x: 0, y: 0, z: 0 }, paused: false, ready: true } };
}

describe("the generator's level", () => {
  it('is a tunable in the Sound group with a range, and is quieter than the 0.9 it was hard-wired at', () => {
    expect(SOUND_PARAM_RANGES.generatorVolume).toBeDefined();
    expect(DEFAULT_SOUND_PARAMS.generatorVolume).toBeGreaterThan(0);
    expect(DEFAULT_SOUND_PARAMS.generatorVolume).toBeLessThan(0.9);
  });

  it('is read from the Sound tuning, when the set is built and as it runs', () => {
    const { hub, gain } = stubHub({ ...DEFAULT_SOUND_PARAMS, generatorVolume: 0.3 });
    const audio = new GeneratorAudio(hub);
    audio.build({ x: 0, y: 0, z: 0 });
    expect(gain.gain.value).toBeCloseTo(0.3);
    hub.params.generatorVolume = 0.6;
    audio.update({ x: 0, y: 0, z: 0 }, 0);
    expect(gain.gain.targets.at(-1)).toBeCloseTo(0.6);
  });

  it('is a little quieter again with the barn wall between you and it', () => {
    const { hub, gain } = stubHub({ ...DEFAULT_SOUND_PARAMS });
    const audio = new GeneratorAudio(hub);
    audio.build({ x: 0, y: 0, z: 0 });
    audio.update({ x: 0, y: 0, z: 0 }, 0);
    const outside = gain.gain.targets.at(-1);
    audio.update({ x: 0, y: 0, z: 0 }, 1);
    expect(gain.gain.targets.at(-1)).toBeLessThan(outside);
  });
});
