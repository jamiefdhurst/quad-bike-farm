import { describe, it, expect } from 'vitest';
import { PodRack, TOOLBOX, POD_KINDS } from '../src/vehicle/pods.js';
import { createRandom } from '../src/core/random.js';

const IDS = ['red', 'blue', 'green', 'yellow'];

describe('PodRack', () => {
  it('never puts two pods on one quad, and is repeatable from a seed', () => {
    for (let seed = 1; seed < 300; seed++) {
      const a = new PodRack(IDS).place(createRandom(seed));
      const b = new PodRack(IDS).place(createRandom(seed));
      expect(a).toEqual(b);
      if (a.analogue !== TOOLBOX) expect(a.analogue).not.toBe(a.digital);
      for (const k of POD_KINDS) expect([TOOLBOX, ...IDS]).toContain(a[k]);
    }
  });

  it('starts every option about equally often', () => {
    const counts = {};
    const random = createRandom(7);
    for (let i = 0; i < 5000; i++) {
      const r = new PodRack(IDS).place(random);
      counts[r.analogue] = (counts[r.analogue] ?? 0) + 1;
    }
    for (const where of [TOOLBOX, ...IDS]) expect(counts[where] / 5000).toBeGreaterThan(0.15);
  });

  it('fits from the toolbox only to a bare quad, and takes off into the toolbox', () => {
    const rack = new PodRack(IDS);
    expect(rack.fit('analogue', 'red')).toBe(true);
    expect(rack.podOn('red')).toBe('analogue');
    expect(rack.fit('digital', 'red')).toBe(false); // red already has one
    expect(rack.fit('analogue', 'blue')).toBe(false); // it's not in the toolbox
    expect(rack.takeOff('red')).toBe('analogue');
    expect(rack.inToolbox('analogue')).toBe(true);
    expect(rack.takeOff('red')).toBe(null);
    expect(rack.fit('digital', 'nope')).toBe(false);
  });

  it('works with a single quad', () => {
    for (let seed = 1; seed < 50; seed++) {
      const r = new PodRack(['red']).place(createRandom(seed));
      expect(r.analogue === 'red' && r.digital === 'red').toBe(false);
    }
  });
});

describe('PodRack.allow', () => {
  it('lets a quad added later take a pod without changing where they started', () => {
    const rack = new PodRack(IDS);
    const before = { ...rack.place(createRandom(3)) };
    rack.allow('rusty');
    expect(rack.at).toEqual(before);
    expect(rack.podOn('rusty')).toBe(null);
    for (const kind of POD_KINDS) rack.at[kind] = TOOLBOX;
    expect(rack.fit('analogue', 'rusty')).toBe(true);
    expect(rack.podOn('rusty')).toBe('analogue');
  });

  it('lets a vehicle added after the pods were dealt (the tractor) take one', () => {
    const rack = new PodRack(IDS);
    expect(rack.fit('digital', 'tractor')).toBe(false);
    rack.allow('tractor');
    expect(rack.fit('digital', 'tractor')).toBe(true);
    expect(rack.podOn('tractor')).toBe('digital');
  });
});
