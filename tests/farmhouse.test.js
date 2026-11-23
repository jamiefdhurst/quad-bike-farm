import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { LAYOUT } from '../src/world/layout.js';
import { createNeighbourFarm, neighbourFarmShape } from '../src/world/neighbourFarm.js';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { modelStats } from './helpers/worldModels.js';

// Her farmhouse (#910): an upland house with a wing, a catslide over a scullery, a garden and trimmed windows. The shapes are the house's footprints
// as the rest of the world sees them; the model is checked for faces fighting on one plane and for windows that are lit or dark.
const S = neighbourFarmShape(LAYOUT);
const H = S.house;
const lcg = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
let built;

beforeAll(async () => {
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  const { buildFarmhouse } = await import('../src/world/neighbourFarmProps.js');
  built = buildFarmhouse(S, 0, { fixedBox: () => {}, random: lcg(7) });
  built.group.updateMatrixWorld(true);
});

describe('her farmhouse: the shape', () => {
  it('is a long low range of 14 to 16 m with a roof of about 35 degrees', () => {
    expect(H.outer.maxX - H.outer.minX).toBeGreaterThanOrEqual(14);
    expect(H.outer.maxX - H.outer.minX).toBeLessThanOrEqual(16);
    const pitch = (Math.atan2(H.ridge - H.wallHeight, H.halfZ) * 180) / Math.PI;
    expect(pitch).toBeGreaterThan(32);
    expect(pitch).toBeLessThan(38);
  });

  it('has a lower wing at one end and a lean-to at the back, each its own footprint, lower than the range', () => {
    expect(H.wing.ridge).toBeLessThan(H.ridge);
    expect(H.wing.outer.maxX).toBeLessThanOrEqual(H.outer.minX + 1e-6); // against the range's gable, not inside it
    expect(H.leanTo.outer.minZ).toBeCloseTo(H.outer.maxZ, 6); // against its back wall
    expect(H.leanTo.wallHeight).toBeLessThan(H.wallHeight);
    expect(H.door.x).not.toBeCloseTo(H.x, 0); // the door is off centre
  });

  it('has the wing, the lean-to and the garden in the yard: built at, sheltered at and kept clear of', () => {
    const nf = createNeighbourFarm(LAYOUT);
    for (const part of [H.wing, H.leanTo]) {
      expect(nf.builtAt(part.x, part.z)).toBe(true);
      expect(nf.covered(part.x, part.z)).toBe(true);
    }
    expect(nf.builtAt(H.garden.gate.x, H.garden.minZ + 2)).toBe(false); // the garden's lawn and path are not a building
    expect(H.garden.maxZ).toBeCloseTo(H.outer.minZ, 6); // it runs from its wall to the house's front
  });
});

describe('her farmhouse: the model', () => {
  it('has no faces fighting on one plane', () => {
    const fights = coplanarOverlaps(built.group, { gap: 0.003, minArea: 2e-5, textured: true });
    expect(fights.map((f) => `${f.axis}${f.dir > 0 ? '+' : '-'} at ${f.at.map((v) => v.toFixed(2)).join(',')} area ${f.area.toFixed(3)}`)).toEqual([]);
  });

  it('has some windows lit and some dark, drawn from the same two materials as before', () => {
    const count = (m) => { let n = 0; built.group.traverse((o) => { if (o.isMesh && o.material === m) n++; }); return n; };
    const glowing = count(built.glow);
    const dark = (() => { let n = 0; built.group.traverse((o) => { if (o.isMesh && o.material.map && o.material.emissive?.getHex() === 0 && o.material.metalness === 0.2 && o.material.roughness === 0.2) n++; }); return n; })();
    expect(glowing).toBeGreaterThan(2);
    expect(dark).toBeGreaterThan(2);
    expect(built.glow.emissiveMap).toBeTruthy();
  });

  it('is not a plain block: dozens of parts, textured nearly all over, the glow off by day', () => {
    const st = modelStats(built.group);
    expect(st.meshes).toBeGreaterThan(100);
    expect(st.textured).toBeGreaterThan(0.8);
    expect(built.glow.emissiveIntensity).toBe(0);
    expect(built.lampGlow.emissiveIntensity).toBe(0);
  });

  it('stands everything on the ground or on the house (nothing below the ground by more than the walls sink, nothing above the ridge by more than the stacks)', () => {
    const box = new THREE.Box3().setFromObject(built.group);
    expect(box.min.y).toBeGreaterThan(-0.5);
    expect(box.max.y).toBeLessThan(H.ridge + 2);
  });
});
