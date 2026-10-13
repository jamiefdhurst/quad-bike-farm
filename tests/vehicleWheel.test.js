import { describe, it, expect } from 'vitest';
import { vehicleOptions, wheelChildren } from '../src/npc/vehicleWheel.js';

const base = {
  name: 'Corsa', inside: false, idle: true, busy: null, moving: false, youDriving: false, girlDriving: false, seatFree: true, hasBack: false,
  backFree: false, mayDrive: true, ownerName: 'Jess', canDrive: true, driveFree: true, running: false, untouched: true,
};
const by = (f, key) => vehicleOptions({ ...base, ...f }).find((o) => o.key === key);

describe('the wheel for a car', () => {
  it('lets her drive with you and her friend sat in it', () => {
    const f = { untouched: false, driveFree: true, seatFree: false };
    expect(by(f, 'drive').why).toBeNull();
    expect(by(f, 'start').why).toBe('someone\'s in it');
  });
  it('does not let her drive with someone at the wheel', () => {
    expect(by({ youDriving: true }, 'drive').why).toBe('you\'re driving it');
    expect(by({ girlDriving: true }, 'drive').why).toBe('someone\'s driving it');
  });
  it('greys everything with her reason when she is busy', () => {
    const o = vehicleOptions({ ...base, idle: false, busy: 'she\'s walking' });
    expect(o.map((x) => x.why)).toEqual(['she\'s walking', 'she\'s walking', 'she\'s walking']);
  });
  it('says whose car it is for the other girl', () => {
    expect(by({ mayDrive: false, ownerName: 'Amy' }, 'drive').why).toBe('it\'s Amy\'s');
  });
  it('offers only getting out when she is inside', () => {
    expect(vehicleOptions({ ...base, inside: true })).toEqual([{ key: 'out', label: 'Get out of the Corsa', why: null }]);
  });
  it('adds the back bench when there is one, greyed when full', () => {
    expect(by({ hasBack: true, backFree: false }, 'back').why).toBe('the back is full');
    expect(by({ hasBack: true, backFree: true }, 'back').why).toBeNull();
  });
  it('turns options into wheel entries: greyed ones cannot run', () => {
    const ran = [];
    const c = wheelChildren(vehicleOptions({ ...base, running: true }), (k) => ran.push(k));
    expect(c.find((x) => x.label === 'Start it')).toMatchObject({ disabled: true, hint: 'it\'s running' });
    c.find((x) => x.label === 'Drive it').run();
    expect(ran).toEqual(['drive']);
  });
});
