import { describe, it, expect } from 'vitest';
import { readTank, gaugeLies, dipMessage, gaugeWord, DEFAULT_DIP_PARAMS as P } from '../src/vehicle/tankDip.js';
import { QuirkSet, DEFAULT_QUIRK_PARAMS } from '../src/vehicle/quirks.js';
import { AMY_TANK_DIP_LINES } from '../src/npc/tankDipLines.js';
import { VOICE_LINES as AMY_LINES } from '../src/npc/voiceLines.js';
import { CONTEXTS } from '../src/input/controlMap.js';
import { createRandom } from '../src/core/random.js';

const tank = (litres, noise = 0) => readTank({ litres, capacity: 12, reserve: 2, noise }, P);

describe('reading the stick', () => {
  it('says what is in the tank in words, and when it is down in the reserve', () => {
    expect(tank(0).text).toMatch(/Dry/);
    expect(tank(1).text).toMatch(/Barely wet/);
    expect(tank(3).text).toBe('About a quarter of a tank');
    expect(tank(6).text).toBe('About half a tank');
    expect(tank(12).text).toBe('Full to the neck');
    expect(tank(1.5).low).toBe(true);
    expect(tank(5).low).toBe(false);
  });

  it('is never out by more than the noise allows', () => {
    for (const noise of [-1, 1]) expect(Math.abs(tank(6, noise).share - 0.5)).toBeLessThanOrEqual(P.readNoise + 1e-9);
  });

  it('has no reserve to be down in on a tank with no tap', () => {
    expect(readTank({ litres: 0.5, capacity: 12, reserve: 0 }, P).low).toBe(false);
  });
});

describe('the gauge against the stick', () => {
  it('calls it a lie only when it is far enough off', () => {
    expect(gaugeLies(0.5, 0.45, P)).toBe(false);
    expect(gaugeLies(0.5, 0.1, P)).toBe(true);
  });

  it('shows a sticking gauge up: it reads half on a nearly dry tank', () => {
    const quirks = new QuirkSet(['fuelSticks'], DEFAULT_QUIRK_PARAMS, createRandom(3));
    quirks.stuckFuel = 0.5;
    const shown = quirks.dash({ fuelLevel: 0.08, temperature: 0.5, overheat: 0 }, 0.016).fuelLevel;
    expect(shown).toBe(0.5);
    const message = dipMessage(tank(0.96), shown, P);
    expect(message).toMatch(/^Dip: Barely wet/);
    expect(message).toMatch(/gauge says half\. Don't trust it/);
  });

  it('says the gauge agrees when it does, and nothing about it on a quad with no fuel gauge', () => {
    expect(dipMessage(tank(6), 0.5, P)).toMatch(/gauge agrees/);
    expect(dipMessage(tank(6), null, P)).toBe('Dip: About half a tank');
    expect(dipMessage(tank(1.5), null, P)).toMatch(/down in the reserve/);
  });

  it('names the gauge reading with the stick\'s words', () => {
    expect(gaugeWord(0.5)).toBe('half');
    expect(gaugeWord(0.05)).toBe('empty');
    expect(gaugeWord(1)).toBe('full');
  });
});

describe('the key and the lines', () => {
  it('has U on foot, for the tank dip, and the riding diff lock keeps it', () => {
    expect(CONTEXTS.foot.keys.some(([k, , what]) => k === 'KeyU' && /Dip the tank/.test(what))).toBe(true);
    expect(CONTEXTS.ride.keys.some(([k, , what]) => k === 'KeyU' && /Diff lock/.test(what))).toBe(true);
  });

  it('gives Amy a line for each thing she finds, all in the main set', () => {
    for (const key of ['tankDipLow', 'tankDipLies', 'tankDipFine']) {
      expect(AMY_TANK_DIP_LINES[key].lines.length).toBeGreaterThan(0);
      expect(AMY_LINES[key], key).toBeDefined();
    }
  });
});
