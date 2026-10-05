import { describe, it, expect } from 'vitest';
import { driveMood, pickConfidence, afterDrive, moodName } from '../src/npc/driveMood.js';
import { DEFAULT_COMPANION_PARAMS } from '../src/npc/companionParams.js';

const P = DEFAULT_COMPANION_PARAMS;

describe('her driving mood', () => {
  it('drives slower, shakier and pauses more when careful than when confident', () => {
    const careful = driveMood(P, 0);
    const confident = driveMood(P, 1);
    expect(careful.driveSpeedMax).toBeLessThan(P.driveSpeedMax);
    expect(confident.driveSpeedMax).toBeGreaterThan(P.driveSpeedMax);
    expect(careful.driveJerk).toBeGreaterThan(confident.driveJerk);
    expect(careful.drivePauseChance).toBeGreaterThan(confident.drivePauseChance);
    expect(careful.driveScaredChance).toBeGreaterThan(confident.driveScaredChance);
    expect(confident.driveForMax).toBeGreaterThan(careful.driveForMax);
    // Even confident, she stays well under her scare speed.
    expect(confident.driveSpeedMax).toBeLessThan(confident.driveScareSpeed);
  });

  it('keeps chances and throttle in range and leaves other params alone', () => {
    for (const c of [0, 0.5, 1]) {
      const m = driveMood(P, c);
      expect(m.driveScaredChance).toBeLessThanOrEqual(1);
      expect(m.drivePauseChance).toBeLessThanOrEqual(1);
      expect(m.driveMaxThrottle).toBeLessThanOrEqual(1);
      expect(m.walkSpeed).toBe(P.walkSpeed);
    }
  });

  it('varies each go around her usual confidence', () => {
    let lo = 1;
    let hi = 0;
    let seed = 3;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 200; i++) {
      const c = pickConfidence(0.5, 0.35, random);
      lo = Math.min(lo, c);
      hi = Math.max(hi, c);
    }
    expect(lo).toBeLessThan(0.25);
    expect(hi).toBeGreaterThan(0.75);
  });

  it('a fright knocks her confidence and a good go builds it', () => {
    expect(afterDrive(0.5, 'scared')).toBeLessThan(0.5);
    expect(afterDrive(0.5, 'bored')).toBeGreaterThan(0.5);
    expect(afterDrive(0.02, 'scared')).toBe(0);
    expect(afterDrive(0.98, 'bored')).toBe(1);
    expect(moodName(0.1)).toBe('careful');
    expect(moodName(0.9)).toBe('confident');
  });
});

describe('a bold driver', () => {
  it('is unchanged at middling confidence and goes up to about 29 mph at the top', () => {
    const mid = driveMood(P, 0.5);
    expect(mid.driveSpeedMax).toBeCloseTo(P.driveSpeedMax, 5);
    const top = driveMood(P, 1);
    expect(top.driveSpeedMax * 2.237).toBeGreaterThan(27);
    expect(top.driveSpeedMax * 2.237).toBeLessThan(31);
    expect(top.driveScareSpeed).toBeGreaterThan(top.driveSpeedMax + 2);
    expect(top.driveMaxThrottle).toBe(1);
    expect(top.driveLoopRadiusMax).toBeGreaterThan(25);
    expect(top.driveForMax).toBeGreaterThan(180);
  });

  it('saves the real speed for when she is really sure of herself', () => {
    const mph = (c) => driveMood(P, c).driveSpeedMax * 2.237;
    expect(mph(0.7)).toBeLessThan(15);
    expect(mph(0.85)).toBeGreaterThan(17);
    expect(mph(0.85)).toBeLessThan(23);
    expect(mph(0.6)).toBeLessThan(mph(0.7));
  });
});
