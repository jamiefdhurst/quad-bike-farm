import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { buildSteeringWheel, spokeAngles, rimArcs, wheelGrips, WHEEL_STYLES } from '../src/vehicle/detail/steeringWheel.js';
import { buildSeat, seatDims, SEAT_KINDS } from '../src/vehicle/detail/seats.js';
import { beltRun, ribbonGeometry, buildSeatBelt } from '../src/vehicle/detail/belts.js';
import { knobGeometry, KNOB_KINDS, buildLever, buildHandbrake, buildPedal, pedalLayout } from '../src/vehicle/detail/cabControls.js';
import { switchRow, buildToggle, buildRocker, buildPullKnob, buildRotaryKnob, buildLampLens, buildGaugeBezel, buildVent, buildGlovebox } from '../src/vehicle/detail/switchgear.js';
import { buildMirror, mirrorOffset, MIRROR_KINDS } from '../src/vehicle/detail/mirrors.js';
import { reflectorProfile, lensFlutes, LAMP_KINDS, buildLamp } from '../src/vehicle/detail/lamps.js';
import { buildDoorHandle, HANDLE_KINDS, buildGrabHandle, buildBonnetCatch, buildHinge, grilleBars, buildGrille, buildWiper, sealPath, buildWindowSeal } from '../src/vehicle/detail/fittings.js';
import { TRIM_KINDS, trimPattern, trimMaterial } from '../src/vehicle/detail/trim.js';
import { buildRoadWheel, ROAD_WHEEL_KINDS, faceOpenings, alloySpokes } from '../src/vehicle/detail/roadWheels.js';
import { touchPoints, packTouch, findTouchPoints, MAX_TOUCH, TOUCH_ROLES } from '../src/vehicle/detail/touchWear.js';

// The cab and interior kit (TODO 340). Builders are checked for their named parts and their size; layouts for their numbers.

function fakeCanvas() {
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => ({ addColorStop() {} })), set: (t, k, v) => ((t[k] = v), true) });
  return { width: 0, height: 0, getContext: () => ctx, style: {} };
}
beforeAll(() => vi.stubGlobal('document', { createElement: () => fakeCanvas() }));

const box = (o) => new THREE.Box3().setFromObject(o);
const named = (o, n) => o.getObjectByName(n);

describe('steering wheels', () => {
  it('lays out two, three and four spokes, and refuses others', () => {
    expect(spokeAngles(2)).toEqual([Math.PI / 2, -Math.PI / 2]);
    expect(spokeAngles(3)).toContain(Math.PI); // a T: one straight down
    expect(spokeAngles(4)).toHaveLength(4);
    expect(() => spokeAngles(5)).toThrow();
  });

  it('a worn rim is split round where the hands go, covering the whole circle', () => {
    const arcs = rimArcs(true);
    expect(arcs.filter((a) => a.worn)).toHaveLength(2);
    expect(arcs.reduce((n, a) => n + (a.to - a.from), 0)).toBeCloseTo(Math.PI * 2);
    for (const a of arcs.filter((x) => x.worn)) expect(Math.abs(Math.sin((a.from + a.to) / 2))).toBeCloseTo(1); // at nine and three
  });

  it.each(Object.keys(WHEEL_STYLES))('%s: builds its rim, spokes and boss to its radius, with the grips on the rim', (style) => {
    const w = buildSteeringWheel({ r: 0.19, style, worn: true });
    for (const n of ['wheelRim', 'wheelRimWorn', 'wheelSpokes', 'wheelBoss']) expect(named(w, n), n).toBeTruthy();
    const b = box(w);
    expect(b.max.x).toBeLessThan(0.19 + 0.03);
    expect(b.max.x).toBeGreaterThan(0.19);
    expect(w.userData.grips).toEqual(wheelGrips(0.19));
  });
});

describe('seats', () => {
  it('fits its pleats inside its width', () => {
    for (const kind of Object.keys(SEAT_KINDS)) {
      const d = seatDims(kind);
      expect(d.pleatXs).toHaveLength(d.pleats);
      for (const x of d.pleatXs) expect(Math.abs(x) + d.pleatW / 2).toBeLessThanOrEqual(d.width / 2);
    }
    expect(seatDims('bench', { width: 0.9 }).width).toBe(0.9);
    expect(() => seatDims('throne')).toThrow();
  });

  it.each(Object.keys(SEAT_KINDS))('%s: the cushion top is at the origin, the back stands behind', (kind) => {
    const seat = buildSeat(kind, { headrest: kind === 'bucket' });
    const c = box(named(seat, 'cushion'));
    const b = box(named(seat, 'back'));
    expect(c.max.y).toBeLessThan(0.07);
    expect(c.max.y).toBeGreaterThan(-0.05);
    expect(b.max.y).toBeGreaterThan(0.1);
    expect((b.min.z + b.max.z) / 2).toBeLessThan((c.min.z + c.max.z) / 2);
    expect(c.max.x - c.min.x).toBeLessThan(SEAT_KINDS[kind].width + 0.02);
  });
});

describe('seat belts', () => {
  const at = { top: [0.6, 1.4, -0.2], low: [0.62, 0.5, -0.25], buckle: [0.15, 0.62, -0.05], hip: [0.35, 0.55, 0] };

  it('runs from the shoulder mount and the sill to the buckle, over the person, not through them', () => {
    const { diagonal, lap } = beltRun(at);
    expect(diagonal[0]).toEqual(at.top);
    expect(diagonal.at(-1).map((v) => +v.toFixed(6))).toEqual(at.buckle);
    expect(lap[0]).toEqual(at.low);
    // Below the shoulder it lies across the front of the body, not through it.
    for (const p of diagonal.filter((q) => q[1] < at.hip[1] + 0.5 && q[1] > at.buckle[1] + 0.02)) expect(p[2]).toBeGreaterThan(at.hip[2]);
  });

  it('webbing is a flat strip of its width', () => {
    const g = ribbonGeometry([[0, 0, 0], [0, 1, 0]], 0.05, 0.003);
    g.computeBoundingBox();
    const s = g.boundingBox.getSize(new THREE.Vector3());
    expect(s.x).toBeCloseTo(0.05);
    expect(s.z).toBeCloseTo(0.003);
  });

  it('builds the stowed and worn belts as the belt poser expects, the worn one hidden', () => {
    const belt = buildSeatBelt('driver', at);
    expect(belt.name).toBe('belt_driver');
    expect(named(belt, 'stowed').visible).toBe(true);
    expect(named(belt, 'worn').visible).toBe(false);
    for (const n of ['beltReel', 'beltBuckle', 'beltLoop']) expect(named(belt, n), n).toBeTruthy();
    expect(named(buildSeatBelt('mid', { ...at, lapOnly: true }), 'beltLoop')).toBeFalsy();
  });
});

describe('levers and pedals', () => {
  it('every knob sits on y = 0 where it screws on', () => {
    for (const k of KNOB_KINDS) {
      const g = knobGeometry(k, 0.045);
      g.computeBoundingBox();
      expect(g.boundingBox.min.y, k).toBeGreaterThan(-0.01);
      expect(g.boundingBox.max.y, k).toBeGreaterThan(0.03);
    }
    expect(() => knobGeometry('skull')).toThrow();
  });

  it('a lever reaches its length with the knob on top, and its gaiter stays apart', () => {
    const { group, gaiter } = buildLever({ length: 0.3, knob: 'pear' });
    expect(box(group).max.y).toBeGreaterThan(0.3);
    expect(gaiter.name).toBe('gaiter');
    expect(buildLever({ gaiter: 0 }).gaiter).toBeNull();
  });

  it('builds each handbrake, the ratchet with its quadrant to place', () => {
    for (const k of ['centre', 'pistol', 'ratchet']) expect(box(buildHandbrake(k)).isEmpty(), k).toBe(false);
    expect(buildHandbrake('ratchet').userData.quadrant.name).toBe('handbrakeQuadrant');
    expect(() => buildHandbrake('rope')).toThrow();
  });

  it('a pedal hangs its pad below the pivot; pedals are spaced across the footwell', () => {
    expect(box(buildPedal('pad', { drop: 0.22 })).min.y).toBeLessThan(-0.2);
    expect(box(buildPedal('organ')).max.y).toBeGreaterThan(0.1);
    expect(pedalLayout(3, { x: -0.3, spacing: 0.08 })).toEqual([-0.38, -0.3, -0.22].map((v) => expect.closeTo(v)));
  });
});

describe('switchgear, mirrors and lamps', () => {
  it('a row of switches is centred', () => {
    const r = switchRow(4, 0.03);
    expect(r[0] + r[3]).toBeCloseTo(0);
    expect(r[1] - r[0]).toBeCloseTo(0.03);
  });

  it('every switch stands out of the panel face and names its moving part', () => {
    for (const [build, part] of [[buildToggle, 'toggleLever'], [buildRocker, 'rockerCap'], [buildPullKnob, 'pullKnob'], [buildGlovebox, 'gloveboxLid']]) {
      const s = build();
      expect(named(s, part), part).toBeTruthy();
      expect(box(s).max.z).toBeGreaterThan(0);
    }
    expect(buildRotaryKnob().name).toBe('rotaryKnob');
    expect(named(buildLampLens({ colour: 'Amber' }), 'lampLens')).toBeTruthy();
    expect(named(buildGaugeBezel(), 'gaugeGlass')).toBeTruthy();
    expect(named(buildVent({ round: true }), 'ventLouvres')).toBeTruthy();
  });

  it('every mirror has its glass where its offset says, facing back', () => {
    for (const kind of MIRROR_KINDS) {
      const m = buildMirror(kind, { side: 1 });
      const glass = box(named(m, 'mirrorGlass'));
      const [ox, oy] = mirrorOffset(kind, 1);
      expect((glass.min.x + glass.max.x) / 2, kind).toBeCloseTo(ox, 1);
      expect((glass.min.y + glass.max.y) / 2, kind).toBeCloseTo(oy, 1);
    }
    expect(mirrorOffset('door', -1)[0]).toBeLessThan(0);
  });

  it('a reflector deepens towards the bulb; a lens is fluted all over', () => {
    const p = reflectorProfile(0.09, 0.06);
    for (let i = 1; i < p.length; i++) {
      expect(p[i][0]).toBeGreaterThan(p[i - 1][0]);
      expect(p[i][1]).toBeGreaterThanOrEqual(p[i - 1][1]);
    }
    expect(p.at(-1)[1]).toBeCloseTo(0);
    expect(lensFlutes(3, 12)).toHaveLength(36);
  });

  it('every lamp has a lens for the light code to find', () => {
    for (const kind of LAMP_KINDS) {
      const l = buildLamp(kind);
      const lenses = [];
      l.traverse((o) => o.name.startsWith('lens') && lenses.push(o));
      expect(lenses.length, kind).toBeGreaterThan(0);
      expect(box(l).max.z, kind).toBeLessThan(0.03);
    }
  });
});

describe('fittings, trim and road wheels', () => {
  it('builds every handle and fitting', () => {
    for (const k of HANDLE_KINDS) expect(box(buildDoorHandle(k)).max.z, k).toBeGreaterThan(0);
    for (const f of [buildGrabHandle(), buildBonnetCatch({ open: true }), buildHinge(), buildWiper(), buildWindowSeal()]) expect(box(f).isEmpty()).toBe(false);
    expect(() => buildDoorHandle('knocker')).toThrow();
  });

  it('a grille spaces its bars across the opening, mesh grilles stay inside it', () => {
    const bars = grilleBars('bars', 0.5, 0.2, 5);
    expect(bars[0]).toBeCloseTo(-0.2);
    expect(bars[4]).toBeCloseTo(0.2);
    const g = buildGrille({ w: 0.5, h: 0.2, kind: 'mesh' });
    expect(box(named(g, 'grilleBars')).max.x).toBeLessThanOrEqual(0.25 + 0.003);
  });

  it('a seal goes round its window', () => {
    const p = sealPath(0.6, 0.4, 0.04);
    expect(Math.max(...p.map((q) => q[0]))).toBeCloseTo(0.3);
    expect(Math.min(...p.map((q) => q[1]))).toBeCloseTo(-0.2);
  });

  it('every trim draws the same each time and has some texture to it', () => {
    for (const kind of Object.keys(TRIM_KINDS)) {
      const a = trimPattern(kind);
      expect(a).toEqual(trimPattern(kind));
      expect(Math.max(...a) - Math.min(...a), kind).toBeGreaterThan(10);
    }
    expect(trimMaterial('carpet', 0x333333).map).toBeTruthy();
    expect(() => trimPattern('velvet')).toThrow();
  });

  it('a steel wheel’s openings sit between its nuts; alloys lay out their spokes', () => {
    expect(faceOpenings(6, 0.1)).toHaveLength(6);
    expect(alloySpokes('star', 5)).toHaveLength(5);
    expect(alloySpokes('twin', 5).every((s) => s.split)).toBe(true);
    expect(alloySpokes('turbine', 4)).toHaveLength(12);
    expect(() => alloySpokes('wire')).toThrow();
  });

  it.each(ROAD_WHEEL_KINDS)('%s: stays inside the tyre’s bead', (kind) => {
    const w = buildRoadWheel(kind, { rimR: 0.165, width: 0.14 });
    const b = box(w);
    expect(b.max.y).toBeLessThan(0.165 * 1.06);
    expect(b.max.x - b.min.x).toBeLessThan(0.24);
  });
});

describe('touch wear', () => {
  it('wears a knob at its top, a pedal at its foot, both sides of a saddle and the door side of a cab seat', () => {
    const pts = touchPoints([
      { role: 'knob', box: { min: [0, 0, 0], max: [0.02, 0.3, 0.02] } },
      { role: 'pedal', box: { min: [0, -0.25, 0], max: [0.06, 0, 0.02] } },
      { role: 'seat', at: [0, 0.9, -0.2] },
      { role: 'seat', at: [-0.35, 0.6, 0] },
    ]);
    expect(pts[0].at[1]).toBeCloseTo(0.3);
    expect(pts[1].at[1]).toBeCloseTo(-0.25);
    expect(pts.slice(2, 4).map((p) => Math.sign(p.at[0]))).toEqual([-1, 1]);
    expect(pts[4].at[0]).toBeLessThan(-0.35);
    expect(pts[0].r).toBe(TOUCH_ROLES.knob.r);
  });

  it('packs at most MAX_TOUCH for the shader', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ at: [i, 0, 0], r: 0.1, amount: 0.5 }));
    const { centres, amounts, count } = packTouch(many);
    expect(count).toBe(MAX_TOUCH);
    expect(centres.length).toBe(MAX_TOUCH * 4);
    expect(centres[4]).toBe(1);
    expect(amounts[MAX_TOUCH - 1]).toBe(0.5);
  });

  it('finds them from a model’s named parts, in the body’s frame', () => {
    const model = new THREE.Group();
    const body = new THREE.Group();
    body.name = 'bodyRoot';
    body.position.y = -0.4;
    model.add(body);
    const lever = new THREE.Group();
    lever.name = 'gearLever';
    lever.position.set(0, 0.5, 0.2);
    lever.add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.02).translate(0, 0.15, 0)));
    body.add(lever);
    const seat = new THREE.Object3D();
    seat.name = 'riderAnchor';
    seat.position.set(-0.35, 0.6, 0);
    body.add(seat);
    model.userData.touchWear = [{ at: [0.4, 0.3, 0.5], r: 0.1, amount: 1 }];
    const pts = findTouchPoints(model, body);
    expect(pts[0].at).toEqual([0.4, 0.3, 0.5]); // the vehicle's own first
    const knob = pts.find((p) => p.r === TOUCH_ROLES.knob.r);
    expect(knob.at[1]).toBeCloseTo(0.8); // the lever's top, in the body's frame (not lowered by its -0.4)
    expect(pts.some((p) => p.r === TOUCH_ROLES.seat.r && p.at[0] < -0.5)).toBe(true);
  });
});
