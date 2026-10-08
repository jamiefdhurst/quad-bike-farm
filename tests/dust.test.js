import { describe, it, expect } from 'vitest';
import { DEFAULT_DUST_PARAMS as DP, dustLevel, inCloud, dustExposure } from '../src/world/dust.js';
import { AirFilter, DEFAULT_FILTER_PARAMS as FP } from '../src/vehicle/airFilter.js';
import { HerDrive } from '../src/npc/herDriving.js';
import { DEFAULT_COMPANION_PARAMS } from '../src/npc/companionParams.js';

describe('dust off the stubble', () => {
  it('needs dry stubble and speed', () => {
    expect(dustLevel(DP, 1, 0, DP.fullSpeed)).toBe(1);
    expect(dustLevel(DP, 0, 0, 15)).toBe(0); // grass, tarmac
    expect(dustLevel(DP, 1, 0, DP.minSpeed)).toBe(0); // crawling
    expect(dustLevel(DP, 1, 0, -DP.fullSpeed)).toBe(1); // reversing raises it too
    expect(dustLevel(DP, 1, DP.maxWet, 10)).toBe(0); // damp ground doesn't
    expect(dustLevel(DP, 1, DP.maxWet / 2, 10)).toBeCloseTo(0.5, 5);
    const mid = dustLevel(DP, 1, 0, (DP.minSpeed + DP.fullSpeed) / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it('hangs behind a quad, within its length and widening', () => {
    const q = { x: 0, z: 0, yaw: 0, dust: 1 }; // heading +z, so the cloud trails to -z
    expect(inCloud({ x: 0, z: -6 }, q, DP)).toBe(true);
    expect(inCloud({ x: 0, z: 6 }, q, DP)).toBe(false); // in front
    expect(inCloud({ x: 0, z: -DP.cloudLength - 3 }, q, DP)).toBe(false);
    expect(inCloud({ x: 3, z: -2 }, q, DP)).toBe(false);
    expect(inCloud({ x: 3, z: -14 }, q, DP)).toBe(true); // wider further back
  });

  it('gives the thickest cloud a point is in, never counting the quad itself', () => {
    const lead = { x: 0, z: 0, yaw: 0, dust: 0.6 };
    const clear = { x: 20, z: 0, yaw: 0, dust: 0.9 };
    expect(dustExposure({ x: 0, z: -5 }, [lead, clear], DP)).toBe(0.6);
    expect(dustExposure({ x: 0, z: -5 }, [lead, { ...lead, dust: 0.9 }], DP)).toBe(0.9);
    expect(dustExposure({ x: 0, z: -0.5 }, [lead], DP, lead)).toBe(0);
    expect(dustExposure({ x: 0, z: -5 }, [{ ...lead, dust: 0 }], DP)).toBe(0);
  });

  it('clogs the air filter several times faster than mud', () => {
    const mud = new AirFilter();
    const dust = new AirFilter();
    for (let t = 0; t < 30; t += 0.1) {
      mud.update(0.1, { running: true, speed: 8, mud: 1 });
      dust.update(0.1, { running: true, speed: 8, dust: 1 });
    }
    expect(dust.clog).toBeGreaterThanOrEqual(mud.clog * 3);
    expect(dust.clog).toBeCloseTo(30 * FP.dustRate, 5);
    // Stood still in it, or with the engine off, it doesn't.
    const still = new AirFilter();
    still.update(10, { running: true, speed: 0, dust: 1 });
    still.update(10, { running: false, speed: 8, dust: 1 });
    expect(still.clog).toBe(0);
  });
});

describe('following through dust', () => {
  const follower = (over = {}) => {
    const d = Object.create(HerDrive.prototype);
    d.p = { ...DEFAULT_COMPANION_PARAMS, driveSpeedMaxBase: DEFAULT_COMPANION_PARAMS.driveSpeedMax, ...over };
    d.events = [];
    return d;
  };
  const lead = (dust) => ({ position: { x: 0, z: 0 }, yaw: 0, forwardSpeed: 6, dust });
  const behind = (d, dust, z) => {
    d.follow = () => lead(dust);
    return d.followTarget({ x: 0, z });
  };

  it('drops Amy well back and tucks Jess in, and says so once', () => {
    const p = DEFAULT_COMPANION_PARAMS;
    const amy = follower();
    expect(behind(amy, 0.8, -30).point.z).toBeCloseTo(-p.followGap * p.followDustGap, 5);
    expect(amy.events).toEqual(['followDust']);
    behind(amy, 0.8, -30);
    expect(amy.events).toEqual(['followDust']);
    const jess = follower({ followDustGap: 0.6 });
    expect(behind(jess, 0.8, -30).point.z).toBeCloseTo(-p.followGap * 0.6, 5);
  });

  it('keeps her usual gap behind a quad that is not dusty, and speaks of the next cloud too', () => {
    const p = DEFAULT_COMPANION_PARAMS;
    const amy = follower();
    expect(behind(amy, 0.1, -30).point.z).toBeCloseTo(-p.followGap, 5);
    expect(amy.events).toEqual([]);
    behind(amy, 0.8, -30);
    behind(amy, 0, -30);
    behind(amy, 0.8, -30);
    expect(amy.events).toEqual(['followDust', 'followDust']);
  });

  it('coughs when she is close behind it', () => {
    const jess = follower({ followDustGap: 0.6 });
    behind(jess, 0.8, -6);
    expect(jess.events).toContain('dustCough');
    const amy = follower();
    behind(amy, 0.8, -25);
    expect(amy.events).not.toContain('dustCough');
  });
});
