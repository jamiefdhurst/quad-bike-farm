// A vehicle's engine sound plays only its own engine's pinks, not those of a hot one parked beside it (#861).
import { describe, it, expect } from 'vitest';
import { EngineAudio } from '../src/audio/engineAudio.js';
import { DEFAULT_AUDIO_PARAMS } from '../src/audio/audioParams.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';

const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** A running engine, warm, with its metal at `metalC`. */
function engine(metalC) {
  const e = new EngineModel({ ...DEFAULT_ENGINE_PARAMS }, { random: seeded(3) });
  e.setTemperature(1);
  e.setIgnition(true);
  for (let t = 0; t < 10 && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, choke: 0.3 });
  e.metalC = metalC;
  return e;
}

/** One vehicle's sound, with its worklet stood in for: what it is sent is kept. */
function sound(hub) {
  const a = new EngineAudio(hub, { ...DEFAULT_AUDIO_PARAMS });
  a.sent = [];
  a.node = { port: { postMessage: (m) => a.sent.push(m) } };
  a.panner = {};
  a.path = { update() {} };
  a.attach = () => true;
  return a;
}

const pinksSent = (a) => a.sent.flatMap((m) => m.events ?? []).filter((ev) => ev.type === 'pink').length;

describe('whose pinks a vehicle\'s sound plays', () => {
  it('gets its own engine\'s, and none from a hot one beside it', () => {
    const hub = { ready: true, ctx: { currentTime: 0 }, params: { latency: 0.05 }, listenerPosition: { x: 0, y: 0, z: 0 }, banks: {} };
    const hot = engine(DEFAULT_ENGINE_PARAMS.pinkFromC + 40);
    const cool = engine(DEFAULT_ENGINE_PARAMS.warmC);
    const hotSound = sound(hub);
    const coolSound = sound(hub);
    let pinked = 0;
    for (let t = 0; t < 10; t += 0.1) {
      hot.metalC = DEFAULT_ENGINE_PARAMS.pinkFromC + 40;
      hot.update(0.1, { throttle: 1, driveLoad: 1 });
      cool.update(0.1, { throttle: 1, driveLoad: 1 });
      pinked += hot.events.filter((ev) => ev.type === 'pink').length;
      // Side by side, each sound is given its own engine, as each vehicle's unit does (quadUnit.js).
      hotSound.update(0.1, hot, { x: 0, y: 0, z: 1 });
      coolSound.update(0.1, cool, { x: 1.5, y: 0, z: 1 });
    }
    expect(pinked).toBeGreaterThan(10);
    expect(pinksSent(hotSound)).toBe(pinked);
    expect(pinksSent(coolSound)).toBe(0);
    expect(cool.pink).toBe(0);
  });
});
