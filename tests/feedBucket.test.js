import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FeedBucket, FeedBin, DEFAULT_FEED_BUCKET_PARAMS, FEED_BUCKET_PARAM_RANGES } from '../src/items/feedBucket.js';

const scene = new THREE.Scene();
const world = { heightAt: () => 0.5 };

describe('the feed bucket', () => {
  it('every tunable has a range', () => {
    expect(Object.keys(FEED_BUCKET_PARAM_RANGES).sort()).toEqual(Object.keys(DEFAULT_FEED_BUCKET_PARAMS).sort());
  });

  it('starts empty on the ground and fills in fillSeconds', () => {
    const b = new FeedBucket({ scene, world, position: { x: 1, z: 2 }, yaw: 0.3 });
    expect(b.empty).toBe(true);
    expect(b.held).toBe(false);
    expect(b.model.position.y).toBeCloseTo(0.505, 3);
    for (let t = 0; t < DEFAULT_FEED_BUCKET_PARAMS.fillSeconds + 0.2; t += 0.1) b.fill(0.1);
    expect(b.full).toBe(true);
    expect(b.fill(0.1)).toBe(false);
  });

  it('shows the feed rise with the level, and nothing when empty', () => {
    const b = new FeedBucket({ scene, world, position: { x: 0, z: 0 } });
    expect(b.level.visible).toBe(false);
    b.setFeed(0.5);
    const half = b.level.position.y;
    b.setFeed(1);
    expect(b.level.visible).toBe(true);
    expect(b.level.position.y).toBeGreaterThan(half);
    b.use(2);
    expect(b.feed).toBe(0);
  });

  it('is carried by the camera and put down where it is told', () => {
    const b = new FeedBucket({ scene, world, position: { x: 0, z: 0 } });
    const camera = new THREE.PerspectiveCamera();
    b.pickUp(camera);
    expect(b.held).toBe(true);
    expect(b.model.parent).toBe(camera);
    b.putDown({ x: 4, z: 5 }, 1);
    expect(b.held).toBe(false);
    expect(b.model.parent).toBe(scene);
    expect(b.model.position.x).toBe(4);
  });

  it('has a bin with something to look at', () => {
    const bin = new FeedBin({ scene, world, position: { x: 3, z: 3 } });
    expect(bin.proxy.parent).toBe(bin.model);
  });
});
