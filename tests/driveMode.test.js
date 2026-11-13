import { describe, it, expect } from 'vitest';
import { DriveSwitch, driveEffects, StuckWatch, forgotReaction, DEFAULT_DRIVE_PARAMS as P, DRIVE_PARAM_RANGES } from '../src/vehicle/driveMode.js';
import { Traction, surfaceGrip } from '../src/vehicle/traction.js';
import { DEFAULT_VEHICLE_PARAMS } from '../src/vehicle/vehicleParams.js';
import { QUAD_SPECS, EXTRA_SPECS } from '../src/vehicle/quadSpecs.js';
import { AMY_FOUR_WD_LINES, JESS_FOUR_WD_LINES } from '../src/npc/fourWdLines.js';
import { VOICE_LINES } from '../src/npc/voiceLines.js';
import { JESS_LINES } from '../src/npc/jessLines.js';
import { CHARACTERS } from '../src/npc/characters.js';

describe('the 2WD / 4WD switch', () => {
  it('starts in 2WD, and G flips between 2WD and 4WD', () => {
    const d = new DriveSwitch();
    expect(d.mode).toBe('2wd');
    expect(d.frontDriven).toBe(false);
    expect(d.toggle()).toBe('4wd');
    expect(d.frontDriven).toBe(true);
    expect(d.toggle()).toBe('2wd');
  });

  it('has a diff lock only where the quad has one, which needs the fronts driven', () => {
    const plain = new DriveSwitch();
    expect(plain.toggleLock()).toBe('2wd');
    const blue = new DriveSwitch({ lock: true });
    expect(blue.toggleLock()).toBe('lock');
    expect(blue.frontDriven).toBe(true);
    expect(blue.locked).toBe(true);
    expect(blue.toggleLock()).toBe('4wd');
    blue.toggleLock();
    expect(blue.toggle()).toBe('2wd'); // the 2WD / 4WD switch takes the lock out with it
    expect(blue.locked).toBe(false);
  });

  it('is engaged by a girl without dropping a diff lock', () => {
    const blue = new DriveSwitch({ lock: true, mode: 'lock' });
    blue.engage4wd();
    expect(blue.mode).toBe('lock');
    const red = new DriveSwitch();
    red.engage4wd();
    expect(red.mode).toBe('4wd');
  });

  it('refuses a diff lock mode on a quad without one', () => {
    expect(new DriveSwitch({ mode: 'lock' }).mode).toBe('2wd');
  });
});

describe('what each mode does', () => {
  it('2WD drives the rear only and is lighter on the bars; 4WD and the lock are heavier', () => {
    const a = driveEffects('2wd');
    const b = driveEffects('4wd');
    const c = driveEffects('lock');
    expect(a.frontDriven).toBe(false);
    expect(b.frontDriven && c.frontDriven).toBe(true);
    expect(a.steerRate).toBeGreaterThan(b.steerRate);
    expect(b.steerRate).toBeGreaterThan(c.steerRate);
    expect(c.steerScale).toBeLessThan(1);
    expect(b.driveScale).toBeLessThan(a.driveScale); // the front driveline costs a little
    expect(c.gripScale).toBeGreaterThan(b.gripScale);
  });

  it('has a range for every tunable', () => {
    expect(Object.keys(DRIVE_PARAM_RANGES).sort()).toEqual(Object.keys(P).sort());
  });
});

describe('in the mud', () => {
  const FRONT = [true, true, false, false];
  const drive = (frontDriven, gripScale = 1) => {
    const p = DEFAULT_VEHICLE_PARAMS;
    const t = new Traction();
    t.gripScale = gripScale;
    const ws = FRONT.map((front, i) => ({ driven: !front || frontDriven, load: [350, 350, 900, 900][i], grip: surfaceGrip(p, 1, 0), contact: true }));
    for (let s = 0; s < 60; s++) t.update(1 / 60, 3000, ws, p);
    return t;
  };

  it('a quad in 2WD spins its back wheels where 4WD grips', () => {
    expect(drive(false).spin).toBeGreaterThan(0.2);
    expect(drive(true).spin).toBeLessThan(drive(false).spin);
  });

  it('the diff lock takes a bit more drive than 4WD alone', () => {
    expect(drive(true, P.lockGrip).putDown).toBeGreaterThanOrEqual(drive(true).putDown);
  });
});

describe('a girl who forgot', () => {
  const stuck = { is2wd: true, throttle: 0.8, mud: 0.9, speed: 0.3 };

  it('works out why after being held in the mud with the throttle open', () => {
    const w = new StuckWatch(P);
    let said = false;
    for (let t = 0; t < P.stuckSeconds + 1 && !said; t += 0.1) said = w.update(0.1, stuck);
    expect(said).toBe(true);
  });

  it('does not if she is moving, on dry ground, off the throttle or already in 4WD', () => {
    for (const over of [{ speed: 4 }, { mud: 0 }, { throttle: 0 }, { is2wd: false }]) {
      const w = new StuckWatch(P);
      let said = false;
      for (let t = 0; t < 20; t += 0.1) said = w.update(0.1, { ...stuck, ...over }) || said;
      expect(said, JSON.stringify(over)).toBe(false);
    }
  });

  it('has a quick bump forgiven: struggling only counts when it is kept up', () => {
    const w = new StuckWatch(P);
    for (let i = 0; i < 10; i++) {
      expect(w.update(0.1, stuck)).toBe(false);
      expect(w.update(0.3, { ...stuck, speed: 5 })).toBe(false);
    }
  });

  it('Amy tells Jess, and Jess tells Amy, and nobody tells anyone if she is alone', () => {
    expect(forgotReaction('jess', ['amy', 'jess'])).toEqual([{ girl: 'amy', situation: 'fourWdToldJess' }, { girl: 'jess', situation: 'fourWdOwn' }]);
    expect(forgotReaction('amy', ['amy', 'jess'])).toEqual([{ girl: 'jess', situation: 'fourWdToldAmy' }, { girl: 'amy', situation: 'fourWdOwn' }]);
    expect(forgotReaction('jess', ['jess'])).toEqual([{ girl: 'jess', situation: 'fourWdOwn' }]);
  });

  it('has lines for all of it, never calling you he, she or they', () => {
    for (const k of ['fourWdOwn', 'fourWdToldJess']) expect(AMY_FOUR_WD_LINES[k].lines.length, k).toBeGreaterThan(1);
    for (const k of ['fourWdOwn', 'fourWdToldAmy']) expect(JESS_FOUR_WD_LINES[k].length, k).toBeGreaterThan(1);
    expect(VOICE_LINES.fourWdToldJess).toBeTruthy();
    expect(JESS_LINES.fourWdToldAmy).toBeTruthy();
    for (const l of [...AMY_FOUR_WD_LINES.fourWdOwn.lines, ...AMY_FOUR_WD_LINES.fourWdToldJess.lines, ...Object.values(JESS_FOUR_WD_LINES).flat()]) expect(l).not.toMatch(/—/);
  });

  it('Amy is the likelier to remember', () => {
    const [amy, jess] = ['amy', 'jess'].map((id) => CHARACTERS.find((c) => c.id === id).params.remembers4wd);
    expect(amy).toBeGreaterThan(jess);
  });
});

describe('which quads have the switch', () => {
  it('the red and the blue, and only the blue has a diff lock', () => {
    const all = [...QUAD_SPECS, ...EXTRA_SPECS];
    expect(all.filter((s) => s.driveSwitch).map((s) => s.id).sort()).toEqual(['bruin', 'farm300']);
    expect(all.filter((s) => s.diffLock).map((s) => s.id)).toEqual(['bruin']);
  });
});
