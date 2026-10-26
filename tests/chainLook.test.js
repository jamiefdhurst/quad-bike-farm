import { describe, it, expect, beforeAll } from 'vitest';
import { Faults, DEFAULT_FAULT_PARAMS } from '../src/vehicle/faults.js';
import { CHAIN_LOOK, chainLoop, chainWear, hookFor, linkPlaces, loopLength, sagOf, shownWear, sprocketOutline, teethFor, tangents } from '../src/vehicle/chainShape.js';
import { buildAllModels } from './helpers/vehicleModels.js';

// The chain and sprockets you can see wear (#48): the shapes (pure), what a quad's faults say about them, and that the four chain-driven
// models carry a drive that follows it.

const front = { z: -0.125, y: 0.3, r: 0.03 };
const rear = { z: -0.6, y: 0.3, r: 0.06 };
const driveOf = (model) => model.getObjectByName('chainDrive')?.userData.drive;
const lowest = (pts) => Math.min(...pts.map((p) => p.y));
const faults = () => {
  const f = new Faults({ ...DEFAULT_FAULT_PARAMS }, () => 0.5);
  f.hasChain = true;
  return f;
};

describe('the shape of the chain', () => {
  it('has teeth to suit the circle its rollers sit on', () => {
    expect(teethFor(0.035)).toBe(17);
    expect(teethFor(0.09)).toBe(44);
    expect(teethFor(0.001)).toBe(8);
  });

  it('runs along the outer tangents of the two sprockets', () => {
    const t = tangents(front, rear);
    for (const n of [t.upper, t.lower]) {
      expect(Math.hypot(n.z, n.y)).toBeCloseTo(1, 6);
      // the contact points on the two circles are joined by a line square to the normal
      const a = { z: front.z + front.r * n.z, y: front.y + front.r * n.y };
      const b = { z: rear.z + rear.r * n.z, y: rear.y + rear.r * n.y };
      expect((b.z - a.z) * n.z + (b.y - a.y) * n.y).toBeCloseTo(0, 6);
    }
    expect(t.upper.y).toBeGreaterThan(0);
    expect(t.lower.y).toBeLessThan(0);
  });

  it('hangs lower the slacker it is, the lower run first', () => {
    const snug = chainLoop(front, rear, { slack: 0 });
    const loose = chainLoop(front, rear, { slack: 0.6 });
    const worst = chainLoop(front, rear, { slack: 1 });
    expect(lowest(loose)).toBeLessThan(lowest(snug));
    expect(lowest(worst)).toBeLessThan(lowest(loose));
    const topY = (pts) => Math.max(...pts.filter((p) => p.z > -0.5 && p.z < -0.2).map((p) => p.y));
    expect(topY(snug)).toBeGreaterThan(topY(worst) - 1e-9);
    expect(sagOf(0.5, 0.2, true)).toBe(0); // the top run holds until the chain is properly loose
    expect(sagOf(0.5, 1, true)).toBeGreaterThan(0.02);
    expect(sagOf(0.5, 1, false)).toBeGreaterThan(sagOf(0.5, 1, true));
  });

  it('keeps the chain round both sprockets at the radius its rollers sit at', () => {
    const loop = chainLoop(front, rear, { slack: 0 });
    const onRear = loop.filter((p) => Math.abs(Math.hypot(p.z - rear.z, p.y - rear.y) - rear.r) < 1e-6);
    const onFront = loop.filter((p) => Math.abs(Math.hypot(p.z - front.z, p.y - front.y) - front.r) < 1e-6);
    expect(onRear.length).toBeGreaterThan(10);
    expect(onFront.length).toBeGreaterThan(5);
    // nothing of a snug chain is inside either circle
    for (const p of loop) {
      expect(Math.hypot(p.z - rear.z, p.y - rear.y)).toBeGreaterThan(rear.r - 1e-6);
      expect(Math.hypot(p.z - front.z, p.y - front.y)).toBeGreaterThan(front.r - 1e-6);
    }
  });

  it('lets a chain that has come off hang below the front sprocket, still wrapped round the rear', () => {
    const off = chainLoop(front, rear, { slack: 1, off: true });
    expect(lowest(off)).toBeLessThan(front.y - front.r - CHAIN_LOOK.looseDrop + 1e-6);
    const nearFront = off.filter((p) => Math.hypot(p.z - front.z, p.y - front.y) < front.r - 0.002);
    expect(nearFront.length).toBe(0); // it is not on the sprocket
    expect(off.some((p) => Math.abs(Math.hypot(p.z - rear.z, p.y - rear.y) - rear.r) < 1e-6)).toBe(true);
  });

  it('spaces a whole number of links evenly round it, about a pitch apart', () => {
    for (const slack of [0, 0.5, 1]) {
      const loop = chainLoop(front, rear, { slack });
      const { places, pitch } = linkPlaces(loop);
      expect(places.length).toBe(Math.round(loopLength(loop) / CHAIN_LOOK.pitch));
      expect(Math.abs(pitch - CHAIN_LOOK.pitch)).toBeLessThan(CHAIN_LOOK.pitch * 0.05);
      const gap = Math.hypot(places[1].z - places[0].z, places[1].y - places[0].y);
      expect(gap).toBeLessThanOrEqual(pitch + 1e-9);
      expect(gap).toBeGreaterThan(pitch * 0.9);
    }
  });
});

describe('the sprocket teeth', () => {
  const tipWidth = (hook) => {
    const o = sprocketOutline(0.06, teethFor(0.06), hook);
    const tips = o.filter(([, r]) => r > 0.06);
    return Math.abs(tips[1][0] - tips[0][0]);
  };

  it('start as stubby teeth and wear to thin fins leaning the way the sprocket turns', () => {
    expect(tipWidth(1)).toBeLessThan(tipWidth(0) * 0.6);
    const lean = (hook) => {
      const o = sprocketOutline(0.06, teethFor(0.06), hook);
      return (o[1][0] + o[2][0]) / 2 - (o[0][0] + o[3][0]) / 2;
    };
    expect(lean(0)).toBeCloseTo(0, 9);
    expect(lean(1)).toBeGreaterThan(0.01);
    const tip = (hook) => Math.max(...sprocketOutline(0.06, teethFor(0.06), hook).map(([, r]) => r));
    expect(tip(1)).toBeLessThan(tip(0)); // and a worn tooth is shorter
  });

  it('go round the sprocket once, in order', () => {
    const o = sprocketOutline(0.06, 40, 0.5);
    expect(o.length).toBe(160);
    for (let i = 1; i < o.length; i++) expect(o[i][0]).toBeGreaterThan(o[i - 1][0] - 1e-9);
    expect(o[o.length - 1][0]).toBeLessThan(2 * Math.PI + 1e-6);
  });

  it('hook from the slack once the chain is properly stretched', () => {
    expect(hookFor(0)).toBe(0);
    expect(hookFor(CHAIN_LOOK.hookFrom)).toBe(0);
    expect(hookFor(CHAIN_LOOK.hookTo)).toBe(1);
    expect(hookFor(0.6)).toBeGreaterThan(hookFor(0.5));
  });
});

describe('what the faults say', () => {
  it('is a snug oiled chain with no fault', () => {
    const w = chainWear(faults());
    expect(w).toEqual({ slack: 0, hook: 0, off: false, dry: 0 });
  });

  it('follows the slack, the oil and whether it has come off', () => {
    const f = faults();
    f.begin('chain');
    f.levels.chain = 0.9;
    f.kept.chainLube = 0;
    f.kept.chainOff = true;
    const w = chainWear(f);
    expect(w.slack).toBe(0.9);
    expect(w.hook).toBeGreaterThan(0.9);
    expect(w.off).toBe(true);
    expect(w.dry).toBeGreaterThan(0.9);
  });

  it('draws in steps, so it is only rebuilt a few times as the chain stretches', () => {
    const seen = new Set();
    for (let s = 0; s <= 1; s += 0.001) seen.add(shownWear({ slack: s, hook: hookFor(s), off: false, dry: 0 }).slack);
    expect(seen.size).toBeLessThanOrEqual(1 / CHAIN_LOOK.slackStep + 1);
  });
});

describe('the models', () => {
  let vehicles;
  beforeAll(async () => {
    vehicles = await buildAllModels();
  });

  it('carry a chain drive on each of the four with a chain, and on no car or tractor', () => {
    const withDrive = vehicles.filter((v) => driveOf(v.model)).map((v) => v.id);
    for (const id of ['yellow', 'moto', 'atc', 'plover']) expect(withDrive, id).toContain(id);
    for (const v of vehicles) if (v.spec.tractor || v.spec.landRover || v.spec.car || v.spec.utv) expect(driveOf(v.model), v.id).toBeUndefined();
  });

  it('draw a different chain, and different teeth, when it is stretched', () => {
    for (const id of ['yellow', 'moto', 'atc', 'plover']) {
      const drive = driveOf(vehicles.find((v) => v.id === id).model);
      drive.set({ slack: 0, hook: 0, off: false, dry: 0 });
      const snugChain = drive.chain.geometry;
      const snugTeeth = drive.rear.geometry;
      const snugLow = drive.chain.geometry.boundingBox ?? (drive.chain.geometry.computeBoundingBox(), drive.chain.geometry.boundingBox);
      const snugMin = snugLow.min.y;
      drive.set({ slack: 1, hook: 1, off: false, dry: 1 });
      expect(drive.chain.geometry, id).not.toBe(snugChain);
      expect(drive.rear.geometry, id).not.toBe(snugTeeth);
      drive.chain.geometry.computeBoundingBox();
      expect(drive.chain.geometry.boundingBox.min.y, id).toBeLessThan(snugMin);
      const rusty = drive.chain.material.color.r;
      const stretched = drive.chain.geometry;
      drive.set({ slack: 1, hook: 1, off: true, dry: 1 });
      expect(drive.chain.geometry, id).not.toBe(stretched);
      drive.set({ slack: 0, hook: 0, off: false, dry: 0 });
      expect(drive.chain.material.color.r, id).toBeLessThan(rusty); // oiled again, so dark
    }
  });

  it('only rebuild when what is drawn changes', () => {
    const drive = driveOf(vehicles.find((v) => v.id === 'moto').model);
    drive.set({ slack: 0.5, hook: hookFor(0.5), off: false, dry: 0.3 });
    const geo = drive.chain.geometry;
    drive.set({ slack: 0.51, hook: hookFor(0.51), off: false, dry: 0.3 });
    expect(drive.chain.geometry).toBe(geo);
    drive.set({ slack: 0.6, hook: hookFor(0.6), off: false, dry: 0.3 });
    expect(drive.chain.geometry).not.toBe(geo);
  });

  it('turn the sprockets with the rear wheel, the small one faster', () => {
    const drive = driveOf(vehicles.find((v) => v.id === 'atc').model);
    drive.spin(1);
    expect(drive.rear.rotation.x).toBe(1);
    expect(drive.front.rotation.x).toBeGreaterThan(1.5);
  });
});
