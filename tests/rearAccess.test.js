import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { seatTipTargets, easeSeatTips, pickRearSeat, rearDoor } from '../src/vehicle/rearAccess.js';
import { UtvMount } from '../src/vehicle/utvMount.js';
import { unscaleAnchors } from '../src/vehicle/unscaleAnchors.js';
import { buildCabModel, poseSeatTips, CAB_STAND, CRAG_REAR_STAND, CRAG_REAR_SEATS, CAB_SEATS, SEAT_TIP } from '../src/vehicle/cabModel.js';
import { SeatBelts, BELT_SEATS } from '../src/vehicle/seatBelts.js';
import { planSeats, DEFAULT_UTV_RIDE_PARAMS } from '../src/npc/utvRide.js';

const REAR = Object.keys(CRAG_REAR_SEATS);

describe('tipping the front seats', () => {
  it('tips the seat on the side someone is climbing past, unless somebody is sat in it', () => {
    expect(seatTipTargets(['left'], [])).toEqual({ left: 1, driver: 0 });
    expect(seatTipTargets(['left', 'driver'], ['driver'])).toEqual({ left: 1, driver: 0 });
    expect(seatTipTargets([], [])).toEqual({ left: 0, driver: 0 });
  });

  it('eases a backrest over and back at its speed, not in one jump', () => {
    const tips = { left: 0, driver: 0 };
    easeSeatTips(tips, { left: 1, driver: 0 }, 0.1, 2);
    expect(tips.left).toBeCloseTo(0.2, 6);
    for (let i = 0; i < 20; i++) easeSeatTips(tips, { left: 1, driver: 0 }, 0.1, 2);
    expect(tips.left).toBe(1);
    easeSeatTips(tips, { left: 0, driver: 0 }, 0.25, 2);
    expect(tips.left).toBeCloseTo(0.5, 6);
  });
});

describe('your seat in the back', () => {
  it('is the one nearest your door, then the middle, then the far one, or none when the back is full', () => {
    expect(pickRearSeat([], false)).toBe('rearLeft');
    expect(pickRearSeat([], true)).toBe('rearRight');
    expect(pickRearSeat(['rearLeft'], false)).toBe('rearMid');
    expect(pickRearSeat(['rearLeft', 'rearMid'], false)).toBe('rearRight');
    expect(pickRearSeat(REAR, false)).toBe(null);
  });

  it('is reached by the driver\'s door only for the right-hand seat with nobody at the wheel', () => {
    expect(rearDoor('rearRight', false)).toBe('driver');
    expect(rearDoor('rearRight', true)).toBe('left');
    expect(rearDoor('rearMid', false)).toBe('left');
  });
});

describe('the girls choosing the back', () => {
  const fixed = (...xs) => () => xs.shift() ?? 0.99;
  it('fill the front first and the back after', () => {
    const { seats } = planSeats(['amy'], new Set(['mid', 'left']), fixed(0.99, 0.99), DEFAULT_UTV_RIDE_PARAMS, REAR);
    expect(seats).toEqual([{ id: 'amy', seat: 'rearLeft' }]);
  });

  it('sit in the back by choice now and then', () => {
    // No squabble roll here (one girl): the bed's roll, then the back's.
    const { seats } = planSeats(['jess'], new Set(), fixed(0.99, 0.1), DEFAULT_UTV_RIDE_PARAMS, REAR);
    expect(seats[0].seat).toBe('rearLeft');
  });

  it('have no back to choose in a car without one', () => {
    const { seats } = planSeats(['jess'], new Set(['mid', 'left', 'bed']), fixed(0.99, 0.1), DEFAULT_UTV_RIDE_PARAMS, []); // (no bed in a Tor or Crag either)
    expect(seats).toEqual([]);
  });

  it('let the loser of a squabble over the middle go in the back', () => {
    // squabble roll, Jess wins, Amy doesn't sulk to the bed (none here: bed taken), does sulk to the back.
    const { seats, squabble } = planSeats(['jess', 'amy'], new Set(['bed']), fixed(0.1, 0.1, 0.05), DEFAULT_UTV_RIDE_PARAMS, REAR);
    expect(squabble.winner).toBe('jess');
    expect(seats).toEqual([{ id: 'jess', seat: 'mid' }, { id: 'amy', seat: 'rearLeft' }]);
  });
});

describe('the 200TDi\'s back bench', () => {
  let model;
  beforeAll(() => {
    const ctx = new Proxy({}, { get: (t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k.startsWith('create') ? () => ({ addColorStop() {} }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}), set: () => true });
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ctx, width: 0, height: 0 }) });
    model = buildCabModel({ variant: 'crag', dashStyle: 'crag' });
    model.updateMatrixWorld(true);
  });

  it('has a seat, your eyes and a belt for each of its three, and front backrests that tip', () => {
    for (const n of ['seatRearLeft', 'seatRearMid', 'seatRearRight', 'cameraRearLeft', 'cameraRearMid', 'cameraRearRight', 'belt_rearLeft', 'belt_rearMid', 'belt_rearRight', 'seatBack_left', 'seatBack_driver']) {
      expect(model.getObjectByName(n), n).toBeTruthy();
    }
    poseSeatTips(model, { left: 1, driver: 0.5 });
    expect(model.getObjectByName('seatBack_left').rotation.x).toBeCloseTo(SEAT_TIP, 6);
    expect(model.getObjectByName('seatBack_driver').rotation.x).toBeCloseTo(SEAT_TIP / 2, 6);
  });

  it('keeps whoever sits in it full size under the model\'s scale, and the seats themselves as built', () => {
    const scaled = new THREE.Group();
    scaled.scale.setScalar(1.15);
    scaled.add(model);
    unscaleAnchors(model, 1.15);
    scaled.updateMatrixWorld(true);
    for (const n of ['seatRearLeft', 'seatRearMid', 'seatRearRight', 'seatLeft', 'seatMid']) expect(model.getObjectByName(n).matrixWorld.getMaxScaleOnAxis(), n).toBeCloseTo(1, 6);
    expect(model.getObjectByName('seatBack_left').matrixWorld.getMaxScaleOnAxis()).toBeCloseTo(1.15, 6);
    model.removeFromParent();
  });

  it('sits its passengers under the roof: hips a little above the front\'s, eyes clear of the roof (1.72 inside)', () => {
    for (const seat of Object.values(CRAG_REAR_SEATS)) {
      expect(seat.y).toBeGreaterThanOrEqual(CAB_SEATS.mid.y);
      expect(seat.y + 0.69).toBeLessThan(1.72);
    }
  });

  it('is in the mount, reached by the passenger\'s door, or the driver\'s for the right-hand seat with nobody driving', () => {
    const quad = { model, yaw: 0, speed: 0, driver: null, rider: null };
    const mount = new UtvMount(quad, () => 0, { ...CAB_STAND, ...CRAG_REAR_STAND }, CRAG_REAR_SEATS);
    expect(mount.rearSlots.map((s) => s.name)).toEqual(REAR);
    expect(mount.slots.rearLeft.move).toBe('stepInBack');
    expect(mount.standPoint(1, mount.slots.rearRight).position.x).toBeLessThan(0); // the driver's side
    quad.driver = {};
    expect(mount.doorOf(mount.slots.rearRight)).toBe('left');
    expect(mount.standPoint(1, mount.slots.rearRight).position.x).toBeGreaterThan(0);
    // freeSlot is the front bench only; the back has its own.
    expect(mount.freeSlot(new THREE.Vector3(2, 0, 0)).rear).toBeFalsy();
    expect(mount.freeRearSlot(new THREE.Vector3(2, 0, 0)).rear).toBe(true);
  });

  it('has belts the girls do up and the dash knows about', () => {
    const belts = new SeatBelts(undefined, [...BELT_SEATS, ...REAR]);
    belts.update(3, { driver: 'you', rearMid: 'girl' }, true);
    expect(belts.worn().rearMid).toBe(true);
    expect(Object.keys(belts.worn())).toEqual([...BELT_SEATS, ...REAR]);
  });
});
