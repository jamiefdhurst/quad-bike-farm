import { describe, it, expect } from 'vitest';
import { PhotoCam, DEFAULT_PHOTO_MODE_PARAMS, pngSize, pngName } from '../src/photos/photoMode.js';

const flat = () => 0;
const none = { forward: 0, right: 0, up: 0 };

function cam() {
  const c = new PhotoCam({ ...DEFAULT_PHOTO_MODE_PARAMS });
  c.place({ x: 0, y: 1.7, z: 0 }, 0, 0, 70);
  return c;
}

describe('photo mode camera', () => {
  it('flies forward along where it looks', () => {
    const c = cam();
    c.step(1, { ...none, forward: 1 }, { x: 0, y: 0 }, 0, false, flat);
    expect(c.pos.z).toBeCloseTo(-DEFAULT_PHOTO_MODE_PARAMS.speed, 5);
    expect(c.pos.y).toBeCloseTo(1.7, 5);
  });

  it('is faster with shift', () => {
    const c = cam();
    c.step(0.5, { ...none, forward: 1 }, { x: 0, y: 0 }, 0, true, flat);
    expect(c.pos.z).toBeCloseTo(-DEFAULT_PHOTO_MODE_PARAMS.fastSpeed * 0.5, 5);
  });

  it('stays on its leash', () => {
    const c = cam();
    for (let i = 0; i < 200; i++) c.step(0.1, { ...none, forward: 1 }, { x: 0, y: 0 }, 0, true, flat);
    expect(Math.hypot(c.pos.x, c.pos.z)).toBeCloseTo(DEFAULT_PHOTO_MODE_PARAMS.leash, 5);
  });

  it('keeps above the ground and under the ceiling', () => {
    const c = cam();
    const hill = (x) => x * 0.1;
    for (let i = 0; i < 100; i++) c.step(0.1, { ...none, up: -1 }, { x: 0, y: 0 }, 0, false, hill);
    expect(c.pos.y).toBeCloseTo(DEFAULT_PHOTO_MODE_PARAMS.floor, 5);
    for (let i = 0; i < 400; i++) c.step(0.1, { ...none, up: 1 }, { x: 0, y: 0 }, 0, true, flat);
    expect(c.pos.y).toBeCloseTo(DEFAULT_PHOTO_MODE_PARAMS.ceiling, 5);
  });

  it('cannot look past straight up or down', () => {
    const c = cam();
    c.step(0.1, none, { x: 0, y: -100 }, 0, false, flat);
    expect(c.pitch).toBeLessThan(Math.PI / 2);
    c.step(0.1, none, { x: 0, y: 100 }, 0, false, flat);
    expect(c.pitch).toBeGreaterThan(-Math.PI / 2);
  });

  it('zooms with the wheel within its limits', () => {
    const c = cam();
    for (let i = 0; i < 50; i++) c.step(0.1, none, { x: 0, y: 0 }, -1, false, flat);
    expect(c.fov).toBe(DEFAULT_PHOTO_MODE_PARAMS.fovMin);
    for (let i = 0; i < 50; i++) c.step(0.1, none, { x: 0, y: 0 }, 1, false, flat);
    expect(c.fov).toBe(DEFAULT_PHOTO_MODE_PARAMS.fovMax);
  });
});

describe('the saved picture', () => {
  it('keeps the screen shape and never grows the canvas', () => {
    expect(pngSize(2560, 1440, 1920)).toEqual({ w: 1920, h: 1080 });
    expect(pngSize(1280, 720, 1920)).toEqual({ w: 1280, h: 720 });
  });
  it('is named for the day and the time', () => {
    expect(pngName(3, '07:45', 2)).toBe('farm-day3-0745-2.png');
  });
});
