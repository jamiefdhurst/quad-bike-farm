import { describe, it, expect } from 'vitest';
import { CompanionVoice } from '../src/npc/companionVoice.js';

const unit = (params) => ({
  engine: { dieselSoak: 0, fuelWater: 0, battery: 1, terminals: 0, knack: null, fouling: 0, rich: 0, temperature: 0.2, params: { batteryWeakBelow: 0.2, terminalsSlowFrom: 0.5, ...params } },
  quad: { fuel: { bowlLevel: 1 }, choke: 0 },
});

describe('which "it won\'t start" remark she makes', () => {
  it('blames a missing choke only where there is one to pull', () => {
    expect(CompanionVoice.prototype.crankHint(unit({}))).toBe('crankStruggleCold');
    expect(CompanionVoice.prototype.crankHint(unit({ injected: true }))).toBe('crankStruggle');
  });
});
