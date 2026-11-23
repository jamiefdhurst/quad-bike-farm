import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { POST_BAND, DISC_RADIUS, MARKER, buildTrailSign } from '../src/world/trailProps.js';
import { fernMarkerSpot } from '../src/console/gameHost.js';
import { createWoods } from '../src/world/woods.js';
import { LAYOUT } from '../src/world/layout.js';
import { buildWorldModels, headlessContext } from './helpers/worldModels.js';
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
    expect(MARKER.h * (1 - to)).toBeGreaterThan(MARKER.band.y + MARKER.band.h / 2); // the name's lower edge, as a height above the ground, is above the band's top
    expect(MARKER.plate.y + MARKER.plate.h / 2).toBeLessThan(MARKER.band.y - MARKER.band.h / 2);
    expect(MARKER.plate.y - MARKER.plate.h / 2).toBeGreaterThan(0);
    expect(MARKER.plate.h).toBeLessThan(MARKER.h);
  });

  it('has no two faces fighting over a plane', () => {
    expect(coplanarOverlaps(sign, { textured: true })).toEqual([]);
  });

  it('has a cap whose base lies inside the post\'s top, not out past its faces', () => {
    const half = (b, a) => (b.max[a] - b.min[a]) / 2;
    // the marker is turned to face the lead-in, so turn it back to compare the sizes along the post's own axes
    const post = sign.children[0].children[0];
    const flat = (o) => {
      const keep = sign.rotation.y;
      sign.rotation.y = 0;
      sign.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(o);
      sign.rotation.y = keep;
      sign.updateMatrixWorld(true);
      return b;
    };
    const c = flat(sign.getObjectByName('trailSignCap'));
    const p = flat(post);
    expect(half(c, 'x')).toBeLessThanOrEqual(half(p, 'x') + 0.01);
    expect(half(c, 'z')).toBeLessThanOrEqual(half(p, 'z') + 0.01);
  });

  it('turns its collider with the post', () => {
    const boxes = [];
    const woods = createWoods(LAYOUT);
    buildTrailSign({ ...headlessContext(), fixedBox: (...a) => boxes.push(a) }, woods, new THREE.Group());
    expect(boxes).toHaveLength(1);
    expect(boxes[0][6]).not.toBe(0);
  });

  it('puts `tp me fern` in front of the post, clear of it', () => {
    const woods = createWoods(LAYOUT);
    const spot = fernMarkerSpot(woods);
    const { x, z } = woods.trail.entrance;
    expect(Math.hypot(spot.x - x, spot.z - z)).toBeGreaterThan(1);
    expect(Math.hypot(spot.x - x, spot.z - z)).toBeLessThan(2);
  });
});
