import { describe, it, expect } from 'vitest';
import { DoorSounds } from '../src/vehicle/doorSounds.js';
import { doorSamples, DOOR_PROFILES } from '../src/audio/doorSamples.js';
import { DoorSwing } from '../src/vehicle/doorSwing.js';
import { Tailgate } from '../src/vehicle/tailgate.js';

const whats = (s) => s.take().map((e) => `${e.part}:${e.side}:${e.what}`);

describe('DoorSounds', () => {
  it('opens and shuts a door once each as the swing goes out and comes back', () => {
    const swing = new DoorSwing();
    const sounds = new DoorSounds('hatch');
    const heard = [];
    for (let i = 0; i < 600; i++) {
      const open = swing.update(1 / 60, { speed: 0, aboard: { right: i > 10 }, boarding: {} });
      sounds.update(1 / 60, { doors: open, speed: 0 });
      heard.push(...whats(sounds));
    }
    expect(heard).toEqual(['door:1:open', 'door:1:shut']);
  });

  it('keeps each side to its own door', () => {
    const sounds = new DoorSounds('hatch');
    sounds.update(0.016, { doors: { left: 0.5, right: 0 } });
    expect(whats(sounds)).toEqual(['door:-1:open']);
  });

  it('slams a door that shuts while the vehicle is moving, and pushes one that shuts at rest', () => {
    const sounds = new DoorSounds('hatch');
    sounds.update(0.016, { doors: { right: 0.9 } });
    sounds.update(0.016, { doors: { right: 0 }, speed: 3 });
    sounds.update(0.016, { doors: { right: 0.9 } });
    sounds.update(0.016, { doors: { right: 0 }, speed: 0 });
    expect(whats(sounds)).toEqual(['door:1:open', 'door:1:slam', 'door:1:open', 'door:1:shut']);
  });

  it('does not chatter while a door hovers between the thresholds', () => {
    const sounds = new DoorSounds('hatch');
    for (const v of [0.12, 0.08, 0.12, 0.07, 0.11]) sounds.update(0.016, { doors: { right: v } });
    expect(whats(sounds)).toEqual(['door:1:open']);
  });

  it('gives the Series tailgate a stop on its chains, and the hatch and the back door none', () => {
    for (const [rear, stops] of [['tailgate', true], ['backDoor', false], ['hatch', false]]) {
      const gate = new Tailgate();
      const sounds = new DoorSounds(rear);
      gate.toggle(0);
      const heard = [];
      for (let i = 0; i < 120; i++) {
        gate.update(1 / 60, { speed: 0 });
        sounds.update(1 / 60, { rear: gate.open });
        heard.push(...whats(sounds));
      }
      expect(heard.includes(`${rear}:0:stop`)).toBe(stops);
      expect(heard[0]).toBe(`${rear}:0:open`);
    }
  });

  it('slams a tailgate thrown shut by driving off', () => {
    const sounds = new DoorSounds('tailgate');
    sounds.update(0.016, { rear: 1 });
    sounds.take();
    sounds.update(0.016, { rear: 0, speed: 4 });
    expect(whats(sounds)).toEqual(['tailgate:0:slam']);
  });
});

describe('doorSamples', () => {
  for (const [name, prof] of Object.entries(DOOR_PROFILES)) {
    for (const what of ['open', 'shut', 'slam', 'stop']) {
      it(`makes a finite, audible ${what} for the ${name}, quieter than full scale`, () => {
        const s = doorSamples(44100, what, prof, 2);
        let peak = 0;
        for (const v of s) {
          expect(Number.isFinite(v)).toBe(true);
          peak = Math.max(peak, Math.abs(v));
        }
        expect(peak).toBeGreaterThan(0.2);
        expect(peak).toBeLessThanOrEqual(0.95 + 1e-6);
        expect(Math.abs(s[s.length - 1])).toBe(0);
      });
    }
  }

  it('is the same for the same seed and different for another', () => {
    const a = doorSamples(44100, 'shut', DOOR_PROFILES.car, 1);
    expect(doorSamples(44100, 'shut', DOOR_PROFILES.car, 1)).toEqual(a);
    expect(doorSamples(44100, 'shut', DOOR_PROFILES.car, 2)).not.toEqual(a);
  });

  it('makes a slam louder and longer than a push', () => {
    const rms = (s) => Math.sqrt(s.reduce((t, v) => t + v * v, 0) / s.length) * Math.sqrt(s.length);
    expect(rms(doorSamples(44100, 'slam', DOOR_PROFILES.landRover))).toBeGreaterThan(rms(doorSamples(44100, 'shut', DOOR_PROFILES.landRover)));
  });
});
