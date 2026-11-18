import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { fernGeometry, brambleGeometry, leafColour, plantMaterial, fernTexture, brambleLeafTexture, FERN_TRIANGLES, BRAMBLE_TRIANGLES } from '../src/world/woodPlants.js';
import { createRandom } from '../src/core/random.js';
import { vi } from 'vitest';
import { fakeCanvas } from './helpers/vehicleModels.js';

// The wood's ferns and brambles (#561, folded into #683): textured leaves that vary within a plant and turn in autumn from their tips in.
const triangles = (geo) => geo.attributes.position.count / 3;
const hue = ([r, g, b]) => new THREE.Color(r, g, b).getHSL({}).h;
const lightness = ([r, g, b]) => new THREE.Color(r, g, b).getHSL({}).l;

describe('a fern and a bramble clump', () => {
  it('stay under their triangle caps, there being thousands along the trail and the edge', () => {
    for (const autumn of [false, true]) {
      for (let seed = 1; seed < 8; seed++) {
        expect(triangles(fernGeometry(createRandom(seed), { autumn, turn: 0.5 }))).toBeLessThanOrEqual(FERN_TRIANGLES);
        expect(triangles(brambleGeometry(createRandom(seed), { autumn, turn: 0.5 }))).toBeLessThanOrEqual(BRAMBLE_TRIANGLES);
      }
    }
  });

  it('have the texture coordinates and the vertex colours a textured, tinted leaf needs, and light from above', () => {
    for (const geo of [fernGeometry(createRandom(2)), brambleGeometry(createRandom(2))]) {
      const n = geo.attributes.position.count;
      expect(geo.attributes.uv.count).toBe(n);
      expect(geo.attributes.color.count).toBe(n);
      for (let i = 0; i < n; i++) {
        expect(geo.attributes.uv.getX(i)).toBeGreaterThanOrEqual(0);
        expect(geo.attributes.uv.getX(i)).toBeLessThanOrEqual(1);
        expect(geo.attributes.uv.getY(i)).toBeGreaterThanOrEqual(0);
        expect(geo.attributes.uv.getY(i)).toBeLessThanOrEqual(1);
        expect(geo.attributes.normal.getY(i)).toBe(1);
      }
    }
  });

  it('use one lit, alpha-tested, double-sided material for every colour', () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const m = plantMaterial(fernTexture(createRandom(1)));
    expect(m.isMeshLambertMaterial).toBe(true);
    expect(m.vertexColors).toBe(true);
    expect(m.alphaTest).toBeGreaterThan(0);
    expect(m.side).toBe(THREE.DoubleSide);
    expect(plantMaterial(brambleLeafTexture(createRandom(1))).map).toBeTruthy();
  });
});

describe('the colour of a leaf', () => {
  const leaves = (autumn, t, turn, n = 400) => {
    const random = createRandom(9);
    return Array.from({ length: n }, () => leafColour(random, autumn, t, turn));
  };
  const spread = (list, f) => Math.max(...list.map(f)) - Math.min(...list.map(f));

  it('is a green that varies from leaf to leaf in summer, and no leaf is brown or yellow', () => {
    const list = leaves(false, 0.5, 0);
    expect(spread(list, lightness)).toBeGreaterThan(0.06);
    for (const c of list) {
      expect(hue(c)).toBeGreaterThan(0.2);
      expect(hue(c)).toBeLessThan(0.34);
    }
  });

  it('turns from the tip in in autumn: the heart of a plant stays greener than its tips', () => {
    const heart = leaves(true, 0.05, 0.5).map(hue);
    const tips = leaves(true, 0.95, 0.5).map(hue);
    const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    expect(mean(tips)).toBeLessThan(mean(heart) - 0.04);
  });

  it('makes a plant in autumn green, yellow, orange and brown at once, not one russet', () => {
    const geo = brambleGeometry(createRandom(4), { autumn: true, turn: 0.6 });
    const cols = [];
    for (let i = 0; i < geo.attributes.color.count; i += 6) cols.push([geo.attributes.color.getX(i), geo.attributes.color.getY(i), geo.attributes.color.getZ(i)]);
    const leafCols = cols.filter((c) => c[1] > 0.04 && lightness(c) > 0.12);
    const hues = leafCols.map(hue);
    expect(Math.max(...hues) - Math.min(...hues)).toBeGreaterThan(0.1);
    expect(hues.some((h) => h > 0.2)).toBe(true); // some still green
    expect(hues.some((h) => h < 0.12)).toBe(true); // some orange or brown
    const fern = fernGeometry(createRandom(4), { autumn: true, turn: 0.6 });
    const fh = [];
    for (let i = 0; i < fern.attributes.color.count; i += 6) fh.push(hue([fern.attributes.color.getX(i), fern.attributes.color.getY(i), fern.attributes.color.getZ(i)]));
    expect(Math.max(...fh) - Math.min(...fh)).toBeGreaterThan(0.1);
  });

  it('is the same every load from the same random stream', () => {
    expect(leafColour(createRandom(5), true, 0.7, 0.4)).toEqual(leafColour(createRandom(5), true, 0.7, 0.4));
  });
});
