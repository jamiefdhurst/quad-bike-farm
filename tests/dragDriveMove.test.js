import { describe, it, expect, vi, afterEach } from 'vitest';
import { fakeCanvas } from './helpers/vehicleModels.js';
import * as THREE from 'three';
import { LAYOUT, RAW_LAYOUT, stripFrame, stripPoint, gravelStrip } from '../src/world/layout.js';
import { layoutNew, fromPlan, NOT_MOVED_YET, REPLACED, DRIVE_PLAN, GATEWAYS_PLAN } from '../src/world/layoutNew.js';
import { Drag, DEFAULT_DRAG_PARAMS as P, dragRoute } from '../src/npc/drag.js';
import { Records } from '../src/world/records.js';
import { Drive, Traffic, DEFAULT_TRAFFIC_PARAMS, visitPlaces } from '../src/world/traffic.js';
import { TrafficHost } from '../src/world/trafficHost.js';
import { buildDragStrip, conePlaces } from '../src/world/dragStrip.js';
import { outingSpots } from '../src/npc/outings.js';
import { spotsFor } from '../src/npc/spotNames.js';
import { spawnKeepOut } from '../src/world/spawns.js';
import { farmMapFeatures } from '../src/hud/farmMap.js';
import { createFields } from '../src/world/fields.js';
import { createRandom } from '../src/core/random.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';

// The drag races on the new farm run along the drive (#616): no gravel strip, the same run laid on the tarmac.
const two = layoutNew(LAYOUT, RAW_LAYOUT);
const s = two.dragStrip;
const road = two.road;
const runEnd = s.length + s.runOff;
const behind = P.gridBack + 10; // the girls' staging point

describe('where the new farm\'s strip is', () => {
  it('starts at plan (632, 345) and runs east, with the same fields as today\'s', () => {
    const [x, z] = fromPlan([632, 345]);
    expect(s).toMatchObject({ x, z, yaw: Math.PI / 2, length: 56, runOff: 8, width: 10, onDrive: true });
    for (const k of ['x', 'z', 'yaw', 'length', 'runOff', 'width']) expect(LAYOUT.dragStrip[k], k).toBeDefined();
    const a = stripPoint(s, 0, 0);
    const b = stripPoint(s, 10, 0);
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.z).toBeCloseTo(a.z);
  });

  it('lies on the drive\'s tarmac from the staging point to the end of the run-off, in both lanes', () => {
    for (let along = -behind; along <= runEnd; along += 1) {
      for (const across of [-P.laneOffset, 0, P.laneOffset]) {
        const p = stripPoint(s, along, across);
        expect(Math.abs(p.z - road.z), `${along},${across}`).toBeLessThan(road.halfWidth - 0.5);
        expect(p.x, `${along},${across}`).toBeGreaterThan(road.fromX);
        expect(p.x, `${along},${across}`).toBeLessThan(road.toX);
      }
    }
  });

  it('has no pothole, wash or gateway in its lanes, nor in the staging point\'s', () => {
    const inRun = (x, z, reach) => {
      const f = stripFrame(s, x, z);
      return f.along > -behind - reach && f.along < runEnd + reach && Math.abs(f.across) < P.laneOffset + 1 + reach;
    };
    for (const h of road.potholes) expect(inRun(h.x, h.z, h.r), `pothole at ${h.x}`).toBe(false);
    // A wash's mud and straw reach 4.5 m either side of its point along the drive, and about 3.5 m in from its gateway's side.
    for (const w of road.washes) {
      const f = stripFrame(s, w[0], w[1]);
      expect(f.along - 4.5 > runEnd || f.along + 4.5 < -behind, `wash at ${w[0]}`).toBe(true);
    }
    // A gateway's apron: 2.5 m either side of its line along the drive (the yard's is at 618, the fields' at 700).
    const [fromX] = fromPlan([DRIVE_PLAN.fromX, 0]);
    const gates = GATEWAYS_PLAN.filter((g) => (g.a === 'drive' || g.b === 'drive') && g.at[0] < 800);
    expect(gates.map((g) => g.at[0]).sort()).toEqual([618, 700, 700]);
    for (const g of gates) {
      const along = stripFrame(s, fromPlan(g.at)[0], s.z).along;
      expect(along - 2.5 > runEnd || along + 2.5 < -behind, `gateway at ${g.at[0]}`).toBe(true);
    }
    expect(fromX).toBeLessThan(s.x);
  });

  it('keeps the cattle grid and the sign well away', () => {
    expect(stripFrame(s, road.grid.x, road.z).along).toBeGreaterThan(runEnd + 100);
    expect(stripFrame(s, road.signSpot[0], road.signSpot[1]).along).toBeGreaterThan(runEnd + 100);
  });

  it('stands the start and finish cones on the verges, a pair at each line, not on the tarmac', () => {
    const cones = conePlaces(s);
    expect(cones.map((c) => c.kind).sort()).toEqual(['finish', 'finish', 'start', 'start']);
    for (const c of cones) {
      const off = Math.abs(c.z - road.z);
      expect(off, c.kind).toBeGreaterThan(road.halfWidth + 0.3);
      expect(off, c.kind).toBeLessThan(road.halfWidth + road.verge);
    }
    const group = buildDragStrip(new THREE.Scene(), () => 0, s);
    expect(group.children).toHaveLength(4); // no gravel
  });
});

describe('what the new farm does not lay for it', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('has no gravel strip, levelling or spawn spot, and today\'s farm keeps its own', () => {
    expect(gravelStrip(two)).toBeNull();
    expect(gravelStrip(LAYOUT)).toBe(LAYOUT.dragStrip);
    const group = buildDragStrip(new THREE.Scene(), () => 0, s);
    expect(group.children.every((c) => c.userData.kind)).toBe(true); // only cones
    expect(spawnKeepOut(two).map((k) => k.what)).not.toContain('the drag strip');
    expect(spawnKeepOut(LAYOUT).map((k) => k.what)).toContain('the drag strip');
  });

  it('keeps a gravel surface for today\'s strip, and keeps its low bog among the places a girl names', () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() }); // the gravel's texture draws on a canvas
    expect(buildDragStrip(new THREE.Scene(), () => 0, LAYOUT.dragStrip).children.length).toBeGreaterThan(4);
    for (const L of [LAYOUT, two]) expect(spotsFor(L).map((o) => o.name), L.newFarm ? 'new farm' : 'layout 1').toContain('in the low bog');
  });

  it('labels no drag strip on the new farm\'s map, which keeps its start and finish marks on the drive', () => {
    const on = (L) => farmMapFeatures(L, createFields(L), new Track(L.trackPoints));
    const f2 = on(two);
    expect(f2.labels.map((l) => l.text)).not.toContain('Drag strip');
    expect(f2.dragStrip).toBeNull();
    expect(f2.marks.filter((m) => Math.abs(m.z - road.z) < 1).map((m) => m.kind).sort()).toEqual(['finish', 'start']);
    expect(on(LAYOUT).labels.map((l) => l.text)).toContain('Drag strip');
  });

  it('does not level the ground under the drive for it', () => {
    const track = new Track(two.trackPoints);
    const withIt = createTerrainHeight(two, track);
    const without = createTerrainHeight({ ...two, dragStrip: undefined }, track);
    for (let along = -12; along <= runEnd + 8; along += 4) {
      for (const across of [-8, 0, 8]) {
        const p = stripPoint(s, along, across);
        expect(withIt.heightAt(p.x, p.z), `${along},${across}`).toBeCloseTo(without.heightAt(p.x, p.z), 6);
      }
    }
  });

  it('is no longer in the list of places at today\'s numbers, and the old numbers are gone', () => {
    expect(NOT_MOVED_YET.dragStrip).toBeUndefined();
    expect(REPLACED).toContain('dragStrip');
    expect(two.dragStrip).not.toEqual(LAYOUT.dragStrip);
    expect([s.x, s.z]).not.toEqual([LAYOUT.dragStrip.x, LAYOUT.dragStrip.z]);
  });
});

describe('what the girls call it', () => {
  it('says the drive for the outing and the spot', () => {
    const spots = outingSpots(two, null, stripPoint);
    expect(spots.map((o) => o.name)).toContain('the drive');
    expect(spots.map((o) => o.name)).not.toContain('the drag strip');
    expect(outingSpots(LAYOUT, null, stripPoint).map((o) => o.name)).toContain('the drag strip');
    const names = spotsFor(two).map((o) => o.name);
    expect(names).toContain('on the drive');
    expect(names).not.toContain('on the drag strip');
    expect(spotsFor(LAYOUT).map((o) => o.name)).toContain('on the drag strip');
  });
});

describe('a drag race on the drive', () => {
  it('routes both girls down the drive in their lanes, and ends with a winner and a record', () => {
    const routes = [-1, 1].map((l) => dragRoute(s, l * P.laneOffset, P.gridBack));
    for (const r of routes) {
      expect(r).toHaveLength(3);
      for (const p of r) {
        expect(Math.abs(p.z - road.z)).toBeLessThan(road.halfWidth - 0.5);
        expect(p.x).toBeGreaterThan(road.fromX);
      }
      expect(r[0].x).toBeLessThan(r[1].x);
      expect(r[1].x).toBeLessThan(r[2].x);
    }
    expect(routes[0][2].z).not.toBeCloseTo(routes[1][2].z);

    const free = [{ id: 'amy', free: true }, { id: 'jess', free: true }];
    const ctx = (o = {}) => ({ girls: free, options: { amy: ['farm300'], jess: ['hornet'] }, claims: { amy: 'farm300', jess: 'hornet' }, busy: false, along: {}, length: s.length, you: { riding: 'rb300', still: true, stalled: false, throttle: 0, near: true, across: 1 }, ...o });
    const d = new Drag({ ...P, startAfter: 0 }, () => 0);
    d.forced = true;
    d.update(0.5, ctx());
    d.grid('jess');
    d.grid('you');
    d.update(0.5, ctx());
    for (let t = 0; t < P.countdown + 0.5; t += 0.25) d.update(0.25, ctx());
    expect(d.phase).toBe('race');
    const events = [...d.update(0.25, ctx({ along: { you: s.length + 0.5, jess: s.length - 10 } })), ...d.update(0.25, ctx({ along: { you: s.length + 5, jess: s.length + 1 } }))];
    const result = events.find((e) => e.type === 'result');
    expect(result.winner).toBeTruthy();
    const finish = events.find((e) => e.type === 'finish' && e.id === result.winner);
    const records = new Records(1);
    expect(records.submit('drag', result.winner, finish.time).record).toBe(true);
    expect(records.best('drag')).toMatchObject({ who: result.winner });
  });
});

describe('the lane\'s traffic while one is on', () => {
  const host = (active) => ({ g: { drag: { active }, world: { layout: two } } });
  const hold = (h) => TrafficHost.prototype.dragHold.call(h);

  it('is held only while a race is being set up or run, and only on the drive', () => {
    expect(hold(host(false))).toBeNull();
    const h = hold(host(true));
    expect(h.holdVisits).toBe(true);
    expect(h.blockers).toHaveLength(2);
    const alongs = h.blockers.map((b) => stripFrame(s, b.x, b.z).along).sort((a, b) => a - b);
    expect(alongs[0]).toBeLessThan(-behind);
    expect(alongs[1]).toBeGreaterThan(runEnd);
    for (const b of h.blockers) expect(Math.abs(b.z - road.z)).toBeLessThan(road.halfWidth);
    expect(hold({ g: { drag: { active: true }, world: { layout: LAYOUT } } })).toBeNull();
  });

  it('sets no visitor out while it is held, and one sets out when it is not', () => {
    const places = visitPlaces(LAYOUT);
    const make = () => new Traffic({ places, params: { ...DEFAULT_TRAFFIC_PARAMS, visitEvery: 1, firstVisit: 0, passEvery: 0 }, random: createRandom(3) });
    const held = make();
    for (let t = 0; t < 300; t += 0.5) held.update(0.5, { blockers: [], darkness: 0, holdVisits: true, swingSeconds: 1.8 });
    expect(held.visit).toBeNull();
    const free = make();
    for (let t = 0; t < 300 && !free.visit; t += 0.5) free.update(0.5, { blockers: [], darkness: 0, swingSeconds: 1.8 });
    expect(free.visit).not.toBeNull();
  });

  it('stops a visitor on the drive short of the run for as long as it is held, then lets it on', () => {
    const { blockers } = hold(host(true));
    const east = blockers.reduce((a, b) => (b.x > a.x ? b : a));
    const d = new Drive({ x: east.x + 40, z: road.z, yaw: -Math.PI / 2, speed: 8, cruise: 8 });
    d.go([{ x: s.x - 20, z: road.z }]);
    for (let t = 0; t < 200; t += 0.1) d.update(0.1, blockers); // far longer than it would wait for a person, then edge past
    expect(d.x).toBeGreaterThan(east.x);
    expect(d.speed).toBeLessThan(0.3);
    expect(d.held).toBe(true);
    for (let t = 0; t < 60 && !d.arrived; t += 0.1) d.update(0.1, []);
    expect(d.x).toBeLessThan(east.x);
  });
});
