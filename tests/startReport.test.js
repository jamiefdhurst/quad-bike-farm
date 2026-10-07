import { describe, it, expect } from 'vitest';
import { describeVehicle } from '../src/debug/startReport.js';

const base = {
  name: 'Blue quad', where: 'by the paddock', plate: 3, idle: 1090, top: 6810, redline: 6500, roughness: 0.073, litres: 8.34, tap: 'off',
  hours: 1043.21, odo: 2310.5, trip: 0, pod: 'analogue', wear: 0.2134, faults: [], tinker: null, lastRider: 'jess', quirks: [], wornGear: null, hand: null,
};

describe('describeVehicle', () => {
  it('gives one line per fact, with the name and place first', () => {
    const lines = describeVehicle(base).split('\n');
    expect(lines[0]).toBe('Blue quad (by the paddock)');
    expect(lines.find((l) => l.includes('engine'))).toContain('idle 1090 rpm, top 6810 rpm (redline 6500), roughness 0.07, 8.3 L, tap off');
    expect(lines.find((l) => l.includes('meters'))).toContain('1043.2 h, 2310.5 mi, trip 0.0, pod: analogue, plate 3');
    expect(lines.find((l) => l.includes('last out'))).toContain('jess');
    expect(lines.find((l) => l.includes('faults'))).toContain('none');
    expect(lines.find((l) => l.includes('tinkered'))).toContain('no');
    expect(lines.find((l) => l.includes('quirks'))).toContain('none');
    expect(describeVehicle(base)).not.toContain('gearbox');
    expect(describeVehicle(base)).not.toContain('hand throttle');
  });

  it('lists faults, tinkering, quirks, a worn gear and the hand throttle', () => {
    const text = describeVehicle({
      ...base,
      faults: [{ kind: 'belt', level: 0.3 }, { kind: 'puncture', level: 0.55 }],
      tinker: { limiter: 2, mixture: 1 },
      quirks: ['tapStiff', 'hornFlaky'],
      wornGear: { gear: 3, wear: 0.41 },
      hand: 0.27,
      pod: null,
      lastRider: null,
    });
    expect(text).toContain('belt 0.30, puncture 0.55');
    expect(text).toContain('throttle stop out 2 turns, mixture 1 click rich');
    expect(text).toContain('tapStiff, hornFlaky');
    expect(text).toContain('jumps out of gear 3 (worn 0.41)');
    expect(text).toContain('hand throttle: 0.27');
    expect(text).toContain('pod: none');
    expect(text).toContain('last out: nobody');
  });

  it('says so for a vehicle with no history dealt', () => {
    const text = describeVehicle({ ...base, hasHistory: false });
    expect(text).toContain('no history dealt');
    expect(text).not.toContain('last out');
  });
});
