import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Interaction } from '../src/interaction/interaction.js';

const box = (x, y, z, w, h, d) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d));
  m.position.set(x, y, z);
  m.updateMatrixWorld(true);
  return m;
};
// Looking down -z from the origin.
const prompt = () => 'Use it';
const feedback = 'own';
const player = { getViewRay: (ray) => ray.set(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)) };

describe('what you are looking at', () => {
  it('prefers the nearer thing', () => {
    const i = new Interaction();
    const far = i.add({ target: box(0, 0, -4, 1, 1, 1), prompt, feedback });
    const near = i.add({ target: box(0, 0, -2, 1, 1, 1), prompt, feedback });
    expect(i.update(player, 6)).toBe(near);
    expect(far).not.toBe(near);
  });

  it('lets a higher priority hit win over a nearer one (the toolbox behind the bench box)', () => {
    const i = new Interaction();
    const bench = i.add({ target: box(0, 0, -2, 3, 1, 1), prompt, feedback });
    const toolbox = i.add({ target: box(0, 0, -3, 0.5, 0.4, 0.3), priority: 1, prompt, feedback });
    expect(i.update(player, 6)).toBe(toolbox);
    expect(bench).not.toBe(toolbox);
  });

  it('can look for a person only, past a nearer thing', () => {
    const i = new Interaction();
    i.add({ target: box(0, 0, -2, 1, 1, 1), prompt, feedback });
    const her = i.add({ target: box(0, 0, -4, 1, 1, 1), person: {}, prompt, feedback });
    expect(i.update(player, 6, (x) => x.person)).toBe(her);
    expect(i.update(player, 6, () => false)).toBe(null);
  });

  it('refuses a thing that gives nothing back, so nothing can be used in silence', () => {
    const i = new Interaction();
    expect(() => i.add({ target: box(0, 0, -2, 1, 1, 1), prompt })).toThrow(/feedback/);
  });

  it('refuses a thing with no prompt, so nothing can be used without saying so', () => {
    const i = new Interaction();
    expect(() => i.add({ target: box(0, 0, -2, 1, 1, 1) })).toThrow(/prompt/);
  });
});
