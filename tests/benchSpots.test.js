import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { barnShape } from '../src/world/barn.js';
import { RACK_WIDTH } from '../src/workshop/sparesModel.js';

describe('the workbench', () => {
  const b = LAYOUT.bench;
  const spots = { toolbox: LAYOUT.toolbox, leads: LAYOUT.benchLeads, oil: LAYOUT.benchOil, pack: LAYOUT.benchPack };
  const notebook = { x: b.x + b.length / 2 - 0.7, z: b.z + 0.05 }; // where Amy's logbook lies (workshop/notebook.js)

  it('has a place on top for the toolbox, one for the jump leads and one for the oil bottle', () => {
    for (const s of Object.values(spots)) {
      expect(Math.abs(s.x - b.x)).toBeLessThan(b.length / 2 - 0.2);
      expect(Math.abs(s.z - b.z)).toBeLessThan(b.depth / 2);
    }
    expect(LAYOUT.toolbox.lift).toBe(b.height);
  });

  it('keeps the two places, and the logbook, apart', () => {
    expect(Math.abs(spots.toolbox.x - spots.leads.x)).toBeGreaterThan(0.25 + 0.2); // half a toolbox and a coil of leads
    expect(Math.abs(spots.toolbox.x - spots.oil.x)).toBeGreaterThan(0.25 + 0.1); // and the toolbox and a bottle
    expect(Math.abs(spots.leads.x - spots.oil.x)).toBeGreaterThan(0.2 + 0.1);
    expect(Math.abs(spots.oil.x - notebook.x)).toBeGreaterThan(0.4);
    expect(Math.abs(spots.toolbox.x - notebook.x)).toBeGreaterThan(0.5);
    expect(Math.abs(spots.leads.x - notebook.x)).toBeGreaterThan(0.5);
  });

  it('keeps the booster pack clear of the oil bottle, the leads, the charger and the logbook', () => {
    const p = spots.pack;
    expect(Math.abs(p.x - spots.oil.x)).toBeGreaterThan(0.12 + 0.05);
    expect(Math.abs(p.x - notebook.x)).toBeGreaterThan(0.12 + 0.2);
    expect(Math.abs(p.x - spots.leads.x)).toBeGreaterThan(0.12 + 0.2);
    expect(Math.abs(p.z - b.z)).toBeLessThan(b.depth / 2 - 0.06); // all of it on the top
    expect(p.x - 0.12).toBeGreaterThan(LAYOUT.toolbox.x + 0.25);
  });

  it('has the shed catalogue lying on the top at the front edge, clear of the toolbox, the oil bottle, the booster pack and the logbook, where you can grab it', () => {
    const c = LAYOUT.shed.catalogue; // a booklet 0.21 by 0.29 m, turned c.yaw
    const halfX = 0.105 * Math.cos(c.yaw) + 0.145 * Math.sin(c.yaw);
    const halfZ = 0.145 * Math.cos(c.yaw) + 0.105 * Math.sin(c.yaw);
    expect(c.x - halfX).toBeGreaterThan(b.x - b.length / 2);
    expect(c.x + halfX).toBeLessThan(b.x + b.length / 2);
    expect(c.z - halfZ).toBeGreaterThan(b.z - b.depth / 2);
    expect(c.z + halfZ).toBeLessThan(b.z + b.depth / 2); // all of it on the top, none hanging over the edge
    expect(c.z).toBeGreaterThan(b.z); // the front half, where you stand
    expect(c.x - halfX).toBeGreaterThan(LAYOUT.toolbox.x + 0.3);
    expect(spots.oil.x - c.x - halfX).toBeGreaterThan(0.06);
    expect(Math.abs(spots.pack.x - c.x) - halfX).toBeGreaterThan(0.12);
    expect(Math.abs(notebook.x - c.x) - halfX).toBeGreaterThan(0.2);
  });
});

describe('the money tin', () => {
  it('stands on a shelf on the north wall of the barn, in the corner away from the bench, the spares shelf and the weather station', () => {
    const t = LAYOUT.moneyTin;
    const inner = barnShape(LAYOUT).inner;
    expect(t.z).toBeCloseTo(inner.minZ, 5); // against the north wall's inner face
    expect(t.x).toBeGreaterThan(inner.minX + 0.6); // a plank 0.5 m long, clear of the west wall
    expect(t.x + 0.25).toBeLessThan(LAYOUT.bench.x - LAYOUT.bench.length / 2 - 1.2 - RACK_WIDTH / 2); // the spares rack (workshop/sparesShelf.js) is centred there, so this is its left edge
    expect(t.y).toBeGreaterThan(0.9); // above the bench and the bales, at hand height
    expect(t.y).toBeLessThan(1.4);
  });
});
