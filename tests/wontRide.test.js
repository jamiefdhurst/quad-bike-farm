import { describe, it, expect } from 'vitest';
import { FaultKnowledge, stillWrong, WONT_LINE, DEFAULT_WONT_PARAMS } from '../src/npc/wontRide.js';
import { WALK_FINDINGS } from '../src/npc/walkRound.js';
import { AMY_WALK_LINES } from '../src/npc/walkLines.js';
import { VOICE_LINES as AMY_LINES } from '../src/npc/voiceLines.js';
import { Faults } from '../src/vehicle/faults.js';
import { TyreSet } from '../src/vehicle/tyres.js';

const sound = () => ({ tyres: new TyreSet(), faults: new Faults() });

describe('stillWrong', () => {
  it('is false on a sound quad and true while the fault is there', () => {
    const q = sound();
    expect(WALK_FINDINGS.some((f) => stillWrong(f, q))).toBe(false);
    q.faults.leave('belt', 0.6);
    expect(stillWrong('walkBelt', q)).toBe(true);
    q.faults.leave('belt', 0.1);
    expect(stillWrong('walkBelt', q)).toBe(false);
  });

  it('sees a soft tyre until it is pumped up', () => {
    const q = sound();
    q.tyres.psi = [1.5, 4, 4, 4];
    expect(stillWrong('walkSoftTyre', q)).toBe(true);
    q.tyres.psi = [4, 4, 4, 4];
    expect(stillWrong('walkSoftTyre', q)).toBe(false);
  });
});

describe('FaultKnowledge', () => {
  it('blocks a quad she knows is faulty, and forgets once it is fixed', () => {
    const k = new FaultKnowledge(() => 0);
    const q = sound();
    q.faults.leave('carb', 0.8);
    k.learn('bruin', ['walkCarb']);
    expect(k.blocking('bruin', q)).toBe('walkCarb');
    expect(k.blocking('farm300', q)).toBe(null);
    q.faults.leave('carb', 0.05);
    expect(k.blocking('bruin', q)).toBe(null);
    q.faults.leave('carb', 0.8); // a new fault is a new thing she doesn't know yet
    expect(k.blocking('bruin', q)).toBe(null);
  });

  it('can be switched off', () => {
    const k = new FaultKnowledge(() => 0.5, { ...DEFAULT_WONT_PARAMS, amyWontRide: 0 });
    const q = sound();
    q.faults.leave('belt', 0.8);
    k.learn('bruin', ['walkBelt']);
    expect(k.blocking('bruin', q)).toBe(null);
  });

  it('ignores a finding that is not a fault', () => {
    const k = new FaultKnowledge(() => 0);
    k.learn('bruin', ['somethingElse']);
    expect(k.known.size).toBe(0);
  });
});

describe('refusal lines', () => {
  it('has a line for every finding, in Amy\'s main set', () => {
    for (const key of WALK_FINDINGS) {
      expect(AMY_WALK_LINES[WONT_LINE[key]].lines.length).toBeGreaterThan(0);
      expect(AMY_LINES[WONT_LINE[key]]).toBeDefined();
    }
  });
});
