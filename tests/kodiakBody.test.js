import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { KODIAK_DECK, KODIAK_LAMP } from '../src/vehicle/kodiakBody.js';
import { GRIZZLY_DECK } from '../src/vehicle/grizzlyBody.js';
import { flareGeometry } from '../src/vehicle/foremanDeck.js';
import { QUAD_SPECS, EXTRA_SPECS } from '../src/vehicle/quadSpecs.js';
import { BODY_STYLES } from '../src/vehicle/quadModel.js';
import { CHOKE_STYLES, TAP_STYLES } from '../src/vehicle/controls.js';
import { DASH_STYLES } from '../src/vehicle/dash.js';
import { MAKER_FOR } from '../src/vehicle/detail/decals.js';
import { measureModel, proportionErrors, REAL_SIZES, IN_PROPORTION } from '../src/vehicle/detail/realSizes.js';
import { buildAllModels } from './helpers/vehicleModels.js';

// The loan quad as a Yamaha Kodiak 450, the Tamura Ursa 450 (TODO 96): the blue's body machinery with its own flares, lamps, bumper, wheels and
// muffler, no choke (it is fuel injected), and nothing worn.

describe('the loan quad’s numbers', () => {
  it('keep the decks’ faces where the Grizzly’s are, so the shared grille, lamps, bumper and tail panel fit', () => {
    expect(KODIAK_DECK.front.zf).toBe(GRIZZLY_DECK.front.zf);
    expect(KODIAK_DECK.rear.zf).toBe(GRIZZLY_DECK.rear.zf);
  });

  it('make the flare’s strip and skirt two halves that meet along the edge, and nothing is lost', () => {
    const count = (g) => g.attributes.position.count;
    const all = flareGeometry('front', 0.62, 1, KODIAK_DECK, 'all');
    const strip = flareGeometry('front', 0.62, 1, KODIAK_DECK, 'strip');
    const skirt = flareGeometry('front', 0.62, 1, KODIAK_DECK, 'skirt');
    expect(count(strip)).toBeGreaterThan(0);
    expect(count(skirt)).toBeGreaterThan(0);
    expect(count(strip) + count(skirt)).toBeGreaterThanOrEqual(count(all) - 100);
  });

  it('put the lamps inside the fenders’ edges', () => {
    expect(KODIAK_LAMP.x + KODIAK_LAMP.r).toBeLessThan(KODIAK_DECK.half);
  });
});

describe('the loan quad’s spec', () => {
  const loan = EXTRA_SPECS.find((s) => s.id === 'loan');

  it('is a Kodiak-bodied, fuel injected quad with no choke, a lights switch and a Tamura badge', () => {
    expect(BODY_STYLES).toContain(loan.style);
    expect(loan.style).toBe('kodiak');
    expect(DASH_STYLES).toContain(loan.dashStyle);
    expect(CHOKE_STYLES).toContain(loan.chokeStyle);
    expect(TAP_STYLES).toContain(loan.tapStyle);
    expect(loan.chokeStyle).toBe('none');
    expect(loan.engine.injected).toBe(true);
    expect(loan.engine.coldIdleRpm).toBeGreaterThan(0);
    expect(MAKER_FOR.loan).toBe('tamura');
    expect(loan.bodyWear).toBe(0);
    expect(QUAD_SPECS.find((s) => s.id === 'blue').style).toBe('grizzly'); // and the blue keeps its own
  });
});

describe('the loan quad’s model', () => {
  let loan;
  beforeAll(async () => {
    loan = (await buildAllModels()).find((v) => v.id === 'loan');
  });

  it('has no choke lever anywhere, and keeps the lights rocker, the thumb throttle and the pod', () => {
    const m = loan.model;
    expect(m.getObjectByName('chokeLever')).toBeFalsy();
    for (const n of ['lightsRocker', 'thumbThrottle', 'controlPod', 'stopRocker', 'startButton', 'handlebars', 'dash', 'frontPanel', 'rearPanel', 'headlightLeft', 'headlightRight', 'exhaustTip', 'tankDecal', 'dealerDecal', 'tailLamp']) {
      expect(m.getObjectByName(n), n).toBeTruthy();
    }
  });

  it('has a black strip and a painted skirt on each fender, and black rims', () => {
    const m = loan.model;
    for (const tag of ['fl', 'fr', 'rl', 'rr']) {
      expect(m.getObjectByName(`flare_${tag}`), tag).toBeTruthy();
      expect(m.getObjectByName(`skirt_${tag}`), tag).toBeTruthy();
    }
    const strip = m.getObjectByName('flare_fl');
    const skirt = m.getObjectByName('skirt_fl');
    expect(strip.material).not.toBe(skirt.material);
    const c = strip.material.color;
    expect(Math.max(c.r, c.g, c.b)).toBeLessThan(0.2);
  });

  it('is in proportion to the real one on every measure', () => {
    expect(IN_PROPORTION).toContain('loan');
    const errors = proportionErrors(measureModel(loan.model, loan.layout), REAL_SIZES.loan);
    for (const [k, e] of Object.entries(errors)) expect(Math.abs(e), k).toBeLessThan(0.08);
  });

  it('keeps the rack and mug anchors at their fixed heights', () => {
    const at = (n) => loan.model.getObjectByName(n).getWorldPosition(new THREE.Vector3());
    expect(at('rackAnchor').y).toBeCloseTo(0.84, 3);
    expect(at('mugAnchor').y).toBeCloseTo(0.935, 3);
  });
});
