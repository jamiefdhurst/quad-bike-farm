import { describe, it, expect } from 'vitest';
import { rowSlots, isTidy, stagePoint, assignSlots, nextJob, crookedSlot, parkRoute, nudgePose, DEFAULT_LINEUP_PARAMS as P } from '../src/npc/lineUp.js';

describe('lining them up', () => {
  it('lays slots evenly along the row, centred', () => {
    const s = rowSlots(3);
    expect(s.map((x) => x.z)).toEqual([P.rowZ - P.spacing, P.rowZ, P.rowZ + P.spacing]);
    expect(s.every((x) => x.x === P.rowX && x.yaw === P.yaw)).toBe(true);
  });

  it('counts a quad as tidy only when close and straight', () => {
    const slot = rowSlots(1)[0];
    expect(isTidy({ ...slot }, slot)).toBe(true);
    expect(isTidy({ x: slot.x, z: slot.z + 1.5, yaw: slot.yaw }, slot)).toBe(false);
    expect(isTidy({ ...slot, yaw: slot.yaw + 0.5 }, slot)).toBe(false);
  });

  it('puts the stage point in line with the slot, out in front of its nose', () => {
    const slot = { x: -50, z: 60, yaw: -Math.PI / 2 };
    const s = stagePoint(slot);
    expect(s.x).toBeCloseTo(-50 + P.stage);
    expect(s.z).toBeCloseTo(60);
    expect(parkRoute(slot)).toHaveLength(2);
  });

  it('lets a quad already in a slot keep it', () => {
    const slots = rowSlots(2);
    const quads = [{ x: 0, z: 0, yaw: 0 }, { ...slots[1] }];
    const got = assignSlots(quads, slots);
    expect(got[1]).toBe(slots[1]);
    expect(got[0]).toBe(slots[0]);
  });

  it('picks the nearest untidy quad, drives a far one and nudges a near one, and stops when all are in', () => {
    const slots = rowSlots(3);
    const quads = [{ ...slots[0] }, { x: -30, z: 70, yaw: 1 }, { x: slots[2].x, z: slots[2].z + 1.5, yaw: slots[2].yaw + 0.5 }];
    const near = nextJob(quads, { x: -49, z: 62 });
    expect(near.index).toBe(2);
    expect(near.mode).toBe('shove');
    const far = nextJob([quads[0], quads[1]], { x: -30, z: 70 });
    expect(far.index).toBe(1);
    expect(far.mode).toBe('drive');
    expect(nextJob(slots.map((s) => ({ ...s })), { x: 0, z: 0 })).toBeNull();
    expect(nextJob([], { x: 0, z: 0 })).toBeNull();
  });

  it('leaves a crooked one off its slot and turned', () => {
    const slot = rowSlots(1)[0];
    const c = crookedSlot(slot, P, () => 0.1);
    expect(isTidy(c, slot)).toBe(false);
    expect(Math.abs(c.yaw - slot.yaw)).toBeCloseTo(P.crookedYaw);
  });

  it('eases a nudge from one pose to the other, the short way round yaw', () => {
    const a = { x: 0, z: 0, yaw: 3 };
    const b = { x: 2, z: 0, yaw: -3 };
    expect(nudgePose(a, b, 0)).toEqual({ x: 0, z: 0, yaw: 3 });
    const mid = nudgePose(a, b, 0.5);
    expect(mid.x).toBeCloseTo(1);
    expect(Math.abs(mid.yaw)).toBeGreaterThan(3); // went through pi, not back through zero
    expect(nudgePose(a, b, 1).x).toBeCloseTo(2);
  });
});

describe('driving into the row', () => {
  it('stops on the slot after the stage point, and not before', async () => {
    const { HerDrive } = await import('../src/npc/herDriving.js');
    const { DEFAULT_COMPANION_PARAMS } = await import('../src/npc/companionParams.js');
    const slot = { x: 0, z: 0, yaw: 0 };
    const route = [{ x: 0, z: -7 }, { x: 0, z: 0 }];
    const quad = { engine: { isRunning: true, temperature: 1 }, choke: 0, position: { x: 0, z: -14 }, yaw: 0, forwardSpeed: 0 };
    const d = new HerDrive(quad, { params: { ...DEFAULT_COMPANION_PARAMS, parkArriveRadius: 0.5, parkStageRadius: 1.8 }, probe: () => Infinity, isClear: () => true, park: { route } });
    expect(d.plan()).toBe(true);
    expect(d.waypoints).toHaveLength(2);
    expect(slot.z).toBe(route[1].z);
  });
});

describe('the last leg into a slot', () => {
  it('measures how far along and off the line she is, and steers back towards it', async () => {
    const { slotOffsets, slotHeading } = await import('../src/npc/lineUp.js');
    const slot = { x: -50, z: 60, yaw: -Math.PI / 2 }; // nose to -x
    const o = slotOffsets({ x: -45, z: 60 }, slot);
    expect(o.along).toBeCloseTo(-5);
    expect(o.lateral).toBeCloseTo(0);
    // Further +z is to her right looking down -x? it is the side the heading is steered away from
    const off = slotOffsets({ x: -45, z: 61 }, slot);
    expect(Math.sign(slotHeading(slot.yaw, off.lateral) - slot.yaw)).toBe(-Math.sign(off.lateral));
    expect(slotHeading(slot.yaw, 0)).toBe(slot.yaw);
  });

  it('leaves a quad until the slot it wants is empty', () => {
    const slots = rowSlots(2);
    const quads = [{ x: slots[0].x + 5, z: slots[0].z, yaw: 0 }, { x: slots[1].x, z: slots[1].z + 1.2, yaw: slots[1].yaw }];
    // quad 1 is nearer her, but its slot is... its own: untidy and free, so it goes first
    expect(nextJob(quads, { x: slots[1].x, z: slots[1].z }).index).toBe(1);
  });
});
