import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { reverseAllowed, chokeReach, pushDirection, localAlong, REVERSE_STYLES, CHOKE_STYLES, TAP_STYLES, DEFAULT_CONTROLS_PARAMS as P } from '../src/vehicle/controls.js';
import { QUAD_SPECS, EXTRA_SPECS } from '../src/vehicle/quadSpecs.js';
import { buildQuadModel, poseParkBrake } from '../src/vehicle/quadModel.js';

const still = { speed: 0, steering: false, braking: false };

describe('reverse', () => {
  it('has no reverse at all on the two-strokes', () => {
    expect(reverseAllowed('none', { ...still, braking: true, steering: true }).ok).toBe(false);
    expect(reverseAllowed('none', still).why).toMatch(/push/);
  });

  it('wants the bars turned for the red, and only while it is creeping', () => {
    expect(reverseAllowed('bars', still).ok).toBe(false);
    expect(reverseAllowed('bars', { ...still, steering: true }).ok).toBe(true);
    expect(reverseAllowed('bars', { ...still, steering: true, speed: P.barsMaxSpeed + 1 }).ok).toBe(false);
  });

  it('wants the brake held and the quad stopped for the button', () => {
    expect(reverseAllowed('button', still).ok).toBe(false);
    expect(reverseAllowed('button', { ...still, braking: true }).ok).toBe(true);
    expect(reverseAllowed('button', { ...still, braking: true, speed: 2 }).ok).toBe(false);
  });

  it('wants the green stopped, nothing else', () => {
    expect(reverseAllowed('knee', still).ok).toBe(true);
    expect(reverseAllowed('knee', { ...still, speed: 3 }).ok).toBe(false);
  });
});

describe('choke reach', () => {
  it('is always in reach, at full steering, for the thumb lever', () => {
    expect(chokeReach('thumb', 15)).toEqual({ ok: true, steer: 1 });
  });

  it('takes a hand off the bars for the knob and is out of reach at speed', () => {
    const slow = chokeReach('knob', 3);
    expect(slow.ok).toBe(true);
    expect(slow.steer).toBeLessThan(1);
    expect(chokeReach('knob', P.knobMaxSpeed + 1).ok).toBe(false);
  });

  it('only lets you reach the plunger when all but stopped, and costs most of your steering', () => {
    expect(chokeReach('plunger', 0.5).steer).toBeLessThan(chokeReach('knob', 0.5).steer);
    expect(chokeReach('plunger', 3)).toMatchObject({ ok: false });
    expect(chokeReach('plunger', 3).why).toMatch(/stop/);
  });

  it('is all in reach standing beside the quad', () => {
    expect(chokeReach('plunger', 0, false)).toEqual({ ok: true, steer: 1 });
  });
});

describe('pushing', () => {
  it('sends it away from you along its length, and backwards from the side', () => {
    expect(pushDirection(1.2)).toBe(-1); // at the nose: it rolls back
    expect(pushDirection(-1.2)).toBe(1); // at the tail: it rolls forward
    expect(pushDirection(0.1)).toBe(-1);
  });

  it('finds where you are along it from its heading', () => {
    expect(localAlong(0, 2, 0)).toBeCloseTo(2);
    expect(localAlong(2, 0, Math.PI / 2)).toBeCloseTo(2);
    expect(localAlong(2, 0, 0)).toBeCloseTo(0);
  });
});

// The dashes paint their faces on canvases; a context that swallows every call is enough to build a model in Node.
const ctx = new Proxy(function () {}, { get: (t, k) => (k === 'measureText' ? () => ({ width: 10 }) : ctx), apply: () => ctx, set: () => true });
const canvas = () => ({ width: 0, height: 0, getContext: () => ctx, style: {} });
let hadDocument;
beforeAll(() => {
  hadDocument = globalThis.document;
  globalThis.document = { createElement: canvas };
});
afterAll(() => {
  globalThis.document = hadDocument;
});

describe('the specs', () => {
  const all = [...QUAD_SPECS, ...EXTRA_SPECS];
  it('name controls that exist', () => {
    for (const s of all) {
      expect(REVERSE_STYLES, s.name).toContain(s.reverseStyle);
      expect(CHOKE_STYLES, s.name).toContain(s.chokeStyle);
      expect(TAP_STYLES, s.name).toContain(s.tapStyle);
    }
  });

  it('give the two-strokes no reverse and the five farm quads their own tap places', () => {
    for (const id of ['yellow', 'orange', 'kids']) expect(all.find((s) => s.id === id).reverseStyle).toBe('none');
    expect(new Set(QUAD_SPECS.map((s) => s.tapStyle)).size).toBe(QUAD_SPECS.length);
  });

  it('build a model with a choke and a tap in every combination', () => {
    for (const chokeStyle of CHOKE_STYLES) {
      for (const tapStyle of TAP_STYLES) {
        const m = buildQuadModel({ chokeStyle, tapStyle });
        expect(m.getObjectByName('chokeLever'), `${chokeStyle}`).toBeTruthy();
        expect(m.getObjectByName('fuelTap'), `${tapStyle}`).toBeTruthy();
      }
    }
  });
});

describe('the quads\' parking brake', () => {
  it('is the left brake lever, squeezed in and held by a red catch', () => {
    const m = buildQuadModel({ chokeStyle: 'thumb', tapStyle: TAP_STYLES[0] });
    const lever = m.getObjectByName('parkBrakeLever');
    const hold = m.getObjectByName('parkBrakeCatch');
    expect(lever).toBeTruthy();
    poseParkBrake(m, 0);
    expect(lever.rotation.y).toBe(0);
    expect(hold.visible).toBe(false);
    poseParkBrake(m, 1);
    expect(lever.rotation.y).toBeGreaterThan(0.1);
    expect(hold.visible).toBe(true);
  });
});
