import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';

describe('the workbench', () => {
  const b = LAYOUT.bench;
  const spots = { toolbox: LAYOUT.toolbox, leads: LAYOUT.benchLeads };
  const notebook = { x: b.x + 0.9, z: b.z + 0.05 }; // where Amy's logbook lies (workshop/notebook.js)

  it('has a place on top for the toolbox and one for the jump leads', () => {
    for (const s of Object.values(spots)) {
      expect(Math.abs(s.x - b.x)).toBeLessThan(b.length / 2 - 0.2);
      expect(Math.abs(s.z - b.z)).toBeLessThan(b.depth / 2);
    }
    expect(LAYOUT.toolbox.lift).toBe(b.height);
  });

  it('keeps the two places, and the logbook, apart', () => {
    expect(Math.abs(spots.toolbox.x - spots.leads.x)).toBeGreaterThan(0.25 + 0.2); // half a toolbox and a coil of leads
    expect(Math.abs(spots.toolbox.x - notebook.x)).toBeGreaterThan(0.5);
    expect(Math.abs(spots.leads.x - notebook.x)).toBeGreaterThan(0.5);
  });
});
