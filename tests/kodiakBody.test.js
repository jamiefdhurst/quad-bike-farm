import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { KODIAK_DECK, KODIAK_LAMP, KODIAK_FACE, kodiakLampOutline } from '../src/vehicle/kodiakBody.js';
import { GRIZZLY_DECK } from '../src/vehicle/grizzlyBody.js';
import { flareGeometry } from '../src/vehicle/foremanDeck.js';
import { QUAD_SPECS, EXTRA_SPECS } from '../src/vehicle/quadSpecs.js';
import { BODY_STYLES } from '../src/vehicle/quadModel.js';
import { CHOKE_STYLES, TAP_STYLES } from '../src/vehicle/controls.js';
import { DASH_STYLES } from '../src/vehicle/dash.js';
import { MAKER_FOR } from '../src/vehicle/detail/decals.js';
import { measureModel, proportionErrors, REAL_SIZES, IN_PROPORTION } from '../src/vehicle/detail/realSizes.js';
import { spitPropensity } from '../src/engine/spitBack.js';
import { CarbIcing } from '../src/vehicle/carbIcing.js';
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
    const reach = Math.max(...kodiakLampOutline().map(([u]) => u));
    expect(KODIAK_FACE.lampX + reach, 'the surround ends inside the fender').toBeLessThan(KODIAK_DECK.half - 0.08);
    expect(KODIAK_LAMP.r).toBeGreaterThan(0.03);
    // The leaning face puts the grille and lamps forward of the face's top edge, by no more than the lean.
    expect(KODIAK_FACE.z - KODIAK_DECK.front.zf).toBeLessThanOrEqual(KODIAK_DECK.front.lean);
    expect(KODIAK_FACE.lampZ).toBeGreaterThan(KODIAK_DECK.front.zf);
  });
});

describe('the loan quad’s spec', () => {
  const loan = EXTRA_SPECS.find((s) => s.id === 'ursa');

  it('is a Kodiak-bodied, fuel injected quad with no choke, a lights switch and a Tamura badge', () => {
    expect(BODY_STYLES).toContain(loan.style);
    expect(loan.style).toBe('kodiak');
    expect(DASH_STYLES).toContain(loan.dashStyle);
    expect(CHOKE_STYLES).toContain(loan.chokeStyle);
    expect(TAP_STYLES).toContain(loan.tapStyle);
    expect(loan.chokeStyle).toBe('none');
    expect(loan.engine.injected).toBe(true);
    expect(loan.engine.coldIdleRpm).toBeGreaterThan(0);
    expect(MAKER_FOR.ursa).toBe('tamura');
    expect(loan.bodyWear).toBe(0);
    expect(QUAD_SPECS.find((s) => s.id === 'bruin').style).toBe('grizzly'); // and the blue keeps its own
  });
});

describe('the loan quad has no carb for the carb’s troubles', () => {
  const loan = EXTRA_SPECS.find((s) => s.id === 'ursa');

  it('has no fuel tap, so the dripping float and the sediment bowl cannot happen either', () => {
    expect(loan.fuel.noTap).toBe(true);
    expect(loan.fuel.startTap).toBe('on');
    expect(loan.tapStyle).toBe('none');
  });

  it('never spits back through a carb, however lean and cold, and a carb ice that is switched off never builds', () => {
    const p = { injected: true, spitBase: 0.8, spitLeanFrom: 0.1, spitLeanFull: 0.5, spitColdBelow: 0.5 };
    expect(spitPropensity({ lean: 1, temperature: 0 }, p)).toBe(0);
    expect(spitPropensity({ lean: 1, temperature: 0 }, { ...p, injected: false })).toBeGreaterThan(0.5);
    const ice = new CarbIcing(undefined, false);
    for (let i = 0; i < 600; i++) ice.update(0.1, { throttle: 0.4, temperature: 4, damp: 1, running: true, warm: 0 });
    expect(ice.ice).toBe(0);
  });
});

describe('the loan quad’s model', () => {
  let loan;
  beforeAll(async () => {
    loan = (await buildAllModels()).find((v) => v.id === 'ursa');
  });

  it('has no choke lever anywhere, and keeps the lights rocker, the thumb throttle and the pod', () => {
    const m = loan.model;
    expect(m.getObjectByName('chokeLever')).toBeFalsy();
    expect(m.getObjectByName('fuelTap')).toBeFalsy();
    expect(m.getObjectByName('fuelTapBody')).toBeFalsy();
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
    expect(IN_PROPORTION).toContain('ursa');
    const errors = proportionErrors(measureModel(loan.model, loan.layout), REAL_SIZES.ursa);
    for (const [k, e] of Object.entries(errors)) expect(Math.abs(e), k).toBeLessThan(0.08);
  });

  it('keeps the rack and mug anchors at their fixed heights', () => {
    const at = (n) => loan.model.getObjectByName(n).getWorldPosition(new THREE.Vector3());
    expect(at('rackAnchor').y).toBeCloseTo(0.84, 3);
    expect(at('mugAnchor').y).toBeCloseTo(0.935, 3);
  });
});
