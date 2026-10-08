import { describe, it, expect } from 'vitest';
import { CrankAttempt, DEFAULT_CRANK_ATTEMPT_PARAMS as P } from '../src/npc/crankAttempt.js';
import { CrankHandle, DEFAULT_CRANK_PARAMS } from '../src/vehicle/crankHandle.js';

function fakeQuad({ kick = 0 } = {}) {
  const crank = new CrankHandle({ ...DEFAULT_CRANK_PARAMS, kickChance: kick }, () => 0);
  const q = {
    crank,
    choke: 0,
    helperPull: false,
    helperGrip: 'along',
    engine: { isRunning: false, ignitionOn: false, temperature: 0.2, pullLeft: 0, setIgnition(v) { this.ignitionOn = v; } },
  };
  return q;
}

/** Plays the quad's side of a swing: the pull comes when she lets go of the cord, and it catches on the swing number `catchOn`. */
function run(a, q, seconds, { catchOn = Infinity, dt = 0.1 } = {}) {
  const events = [];
  let held = false;
  let pulls = 0;
  for (let t = 0; t < seconds && !a.done; t += dt) {
    events.push(...a.update(dt));
    if (held && !q.helperPull) {
      pulls++;
      if (q.crank.swing(q.helperGrip) === 'kick') q.crank.hurt = DEFAULT_CRANK_PARAMS.hurtSeconds;
      else if (pulls >= catchOn) q.engine.isRunning = true;
    }
    held = q.helperPull;
    q.crank.update(dt);
  }
  return events;
}

describe('swinging the handle', () => {
  it('turns the key, chokes it from cold and swings until it catches', () => {
    const q = fakeQuad();
    const a = new CrankAttempt(q, 'amy', { random: () => 0.5 });
    const events = run(a, q, 60, { catchOn: 3 });
    expect(events).toContain('keyOn');
    expect(events).toContain('swing');
    expect(events).toContain('caught');
    expect(q.engine.ignitionOn).toBe(true);
    expect(q.choke).toBeLessThanOrEqual(0.3); // put on from cold, then eased back once it ran
    expect(a.done).toBe(true);
    expect(a.result).toBe('running');
    expect(q.helperPull).toBe(false);
  });

  it('gives up after her swings and switches the key off', () => {
    const q = fakeQuad();
    const a = new CrankAttempt(q, 'amy', { random: () => 0.5 });
    const events = run(a, q, 200);
    expect(a.result).toBe('gaveUp');
    expect(events).toContain('gaveUp');
    expect(q.engine.ignitionOn).toBe(false);
  });

  it('Amy holds it with her thumb alongside and is never kicked; Jess wraps it round', () => {
    const amy = fakeQuad({ kick: 1 });
    new CrankAttempt(amy, 'amy');
    expect(amy.helperGrip).toBe('along');
    const jess = fakeQuad({ kick: 1 });
    new CrankAttempt(jess, 'jess');
    expect(jess.helperGrip).toBe('round');
    const events = run(new CrankAttempt(amy, 'amy', { random: () => 0.5 }), amy, 200);
    expect(events).not.toContain('kick');
  });

  it('Jess is kicked back, says so once, and waits for her hand before swinging again', () => {
    const q = fakeQuad({ kick: 1 });
    const a = new CrankAttempt(q, 'jess', { random: () => 0.5 });
    const events = run(a, q, 12);
    const kicks = events.filter((e) => e === 'kick').length;
    expect(kicks).toBeGreaterThanOrEqual(2);
    expect(kicks).toBeLessThanOrEqual(a.swings); // once per kick-back, and at least four seconds of nursing it between swings
    expect(a.swings).toBeLessThanOrEqual(3);
  });

  it('stops pulling if she is called off', () => {
    const q = fakeQuad();
    const a = new CrankAttempt(q, 'amy', { random: () => 0.5 });
    run(a, q, 1.5);
    a.abandon();
    expect(q.helperPull).toBe(false);
    expect(a.done).toBe(true);
  });

  it('holds a proper swing for amy', () => {
    for (let i = 0; i < 20; i++) {
      const q = fakeQuad();
      const a = new CrankAttempt(q, 'amy', { random: Math.random });
      a.update(P.keyDelay + 0.01);
      expect(a.timer).toBeGreaterThanOrEqual(P.holdMin - 0.001);
      expect(a.timer).toBeLessThanOrEqual(P.holdMax + 0.001);
    }
  });
});
