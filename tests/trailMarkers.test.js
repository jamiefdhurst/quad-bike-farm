import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { POST_BAND, DISC_RADIUS, MARKER } from '../src/world/trailProps.js';
import { buildWorldModels } from './helpers/worldModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';

describe('the Fern Trail way-markers', () => {
  it('keep the arrow disc inside the post, not hanging off its edges', () => {
    expect(DISC_RADIUS * 2).toBeLessThan(POST_BAND);
  });
});

describe('the marker at the trail\'s start', () => {
  let sign;
  beforeAll(async () => {
    sign = (await buildWorldModels()).models.find((m) => m.name === 'trailSign').group;
  });

  it('is one post about 1.2 m tall, with a band the disc fits inside and a plate no longer than a hand', () => {
    const top = new THREE.Box3().setFromObject(sign).max.y - sign.position.y;
    expect(top).toBeGreaterThan(1.15);
    expect(top).toBeLessThan(1.35);
    expect(MARKER.band.h).toBe(POST_BAND);
    expect(MARKER.plate.w).toBeLessThanOrEqual(0.2);
    expect(MARKER.plate.w).toBeLessThan(MARKER.w);
  });

  it('keeps the lettering and its plate inside the face, above the band and the plate', () => {
    const [from, to] = MARKER.name.box;
    expect(from).toBeGreaterThanOrEqual(0);
    expect(to * MARKER.h).toBeLessThan(MARKER.band.y - MARKER.band.h / 2); // lower edge of the name is above the band's lower edge's top
    expect(MARKER.plate.y + MARKER.plate.h / 2).toBeLessThan(MARKER.band.y - MARKER.band.h / 2);
    expect(MARKER.plate.y - MARKER.plate.h / 2).toBeGreaterThan(0);
    expect(MARKER.plate.h).toBeLessThan(MARKER.h);
  });

  it('has no two faces fighting over a plane', () => {
    expect(coplanarOverlaps(sign, { textured: true })).toEqual([]);
  });
});
