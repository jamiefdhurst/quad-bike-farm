import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';

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
});
