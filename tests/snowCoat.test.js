import { describe, it, expect } from 'vitest';
import { DEFAULT_SNOW_COAT_PARAMS as P, SNOW_COAT_PARAM_RANGES, SnowLook, topsCover, vehicleSnowAfter, coatable, coatMaterial, snowUniforms } from '../src/world/snowCoat.js';

describe('topsCover', () => {
  it('whitens roofs sooner than the ground and caps at 1', () => {
    expect(topsCover(0.2)).toBeGreaterThan(0.2);
    expect(topsCover(0)).toBe(0);
    expect(topsCover(1)).toBe(1);
  });
});

describe('SnowLook', () => {
  it('follows the ground cover and shows damp only while it is falling', () => {
    const look = new SnowLook(P);
    look.update(1, 0.8);
    expect(look.tops).toBe(topsCover(0.8));
    expect(look.wet).toBe(0);
    let cover = 0.8;
    for (let i = 0; i < 200; i++) look.update(1, (cover -= 0.0025)); // a mild day's melt
    expect(look.wet).toBeGreaterThan(0.5);
    for (let i = 0; i < 400; i++) look.update(1, cover); // then it holds still
    expect(look.wet).toBe(0);
  });
  it('is not damp on the first frame or when there is no snow', () => {
    const look = new SnowLook(P);
    look.update(1, 0.5);
    expect(look.wet).toBe(0);
    for (let i = 0; i < 50; i++) look.update(1, 0);
    expect(look.wet).toBe(0);
  });
});

describe('vehicleSnowAfter', () => {
  const still = { snow: 0.8, cover: 0.6, speed: 0, indoors: false };
  it('settles while it snows, up to what the tops hold', () => {
    let v = 0;
    for (let i = 0; i < 400; i++) v = vehicleSnowAfter(v, 1, still, P);
    expect(v).toBeCloseTo(topsCover(0.6), 5);
  });
  it('slides off as it moves and not when it is still', () => {
    const settled = topsCover(0.6);
    expect(vehicleSnowAfter(settled, 1, { ...still, snow: 0, speed: 0 }, P)).toBe(settled);
    expect(vehicleSnowAfter(settled, 1, { ...still, snow: 0, speed: 6 }, P)).toBeLessThan(settled);
    let v = settled;
    for (let i = 0; i < 20; i++) v = vehicleSnowAfter(v, 1, { ...still, snow: 0, speed: 6 }, P);
    expect(v).toBe(0);
  });
  it('gains none indoors, and thaws', () => {
    expect(vehicleSnowAfter(0.5, 10, { ...still, indoors: true }, P)).toBeLessThan(0.5);
    expect(vehicleSnowAfter(0, 10, { ...still, indoors: true }, P)).toBe(0);
  });
  it('follows the snow away when it melts', () => {
    expect(vehicleSnowAfter(0.9, 1, { snow: 0, cover: 0.1, speed: 0, indoors: false }, P)).toBeCloseTo(topsCover(0.1), 5);
  });
});

describe('coatable', () => {
  const ok = { kind: 'standard' };
  it('takes lit opaque static meshes', () => {
    expect(coatable(ok)).toBe(true);
    expect(coatable({ kind: 'lambert' })).toBe(true);
  });
  it('leaves out glass, lamps, the girls, indoors, the ground and unlit materials', () => {
    for (const bad of [{ transparent: true }, { emissive: true }, { skinned: true }, { indoors: true }, { owned: true }, { kind: 'other' }]) {
      expect(coatable({ ...ok, ...bad })).toBe(false);
    }
  });
});

describe('coatMaterial', () => {
  const shader = () => ({
    uniforms: {},
    vertexShader: '#include <common>\nvoid main() {\n#include <project_vertex>\n}',
    fragmentShader: '#include <common>\nvoid main() {\n#include <normal_fragment_maps>\n}',
  });
  const material = (extra = {}) => ({ isMeshStandardMaterial: true, userData: {}, onBeforeCompile() {}, customProgramCacheKey: () => 'base', ...extra });

  it('adds the snow to the shader once, after an earlier patch', () => {
    const m = material();
    let priorRan = false;
    m.onBeforeCompile = () => (priorRan = true);
    const u = snowUniforms(P);
    expect(coatMaterial(m, u, P)).toBe(true);
    expect(coatMaterial(m, u, P)).toBe(false);
    const s = shader();
    m.onBeforeCompile(s, null);
    expect(priorRan).toBe(true);
    expect(s.uniforms.uSnowTops).toBe(u.uSnowTops);
    expect(s.vertexShader).toContain('vSnowPos');
    expect(s.fragmentShader).toContain('roughnessFactor');
    expect(m.customProgramCacheKey()).toBe('base|snowstandard');
  });
  it('leaves the shader alone if the includes are not there, and unlit materials alone', () => {
    const m = material();
    coatMaterial(m, snowUniforms(P), P);
    const s = { uniforms: {}, vertexShader: 'void main() {}', fragmentShader: 'void main() {}' };
    m.onBeforeCompile(s, null);
    expect(s.fragmentShader).toBe('void main() {}');
    expect(coatMaterial({ userData: {} }, snowUniforms(P), P)).toBe(false);
  });
  it('has no roughness lines for a Lambert material', () => {
    const m = material({ isMeshStandardMaterial: false, isMeshLambertMaterial: true });
    coatMaterial(m, snowUniforms(P), P);
    const s = shader();
    m.onBeforeCompile(s, null);
    expect(s.fragmentShader).not.toContain('roughnessFactor');
  });
});

describe('ranges', () => {
  it('cover every parameter, with the default inside', () => {
    for (const [k, v] of Object.entries(P)) {
      const [min, max] = SNOW_COAT_PARAM_RANGES[k];
      expect(v).toBeGreaterThanOrEqual(min);
      expect(v).toBeLessThanOrEqual(max);
    }
  });
});
