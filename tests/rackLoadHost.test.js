import { describe, it, expect, vi } from 'vitest';
import { RackHost } from '../src/items/rackHost.js';
import { normalisePrompt } from '../src/interaction/prompt.js';
import { RackLoad } from '../src/vehicle/rackLoad.js';

// A stand-in game with just what the rack's prompts and acts read: E on a rack with a can or the toolbox in your hands, then the tap and
// the hold that follow. The models and the quad are stubs; the wording, the keys and what the strap does to the quad are what is held here.
function setup() {
  const model = () => ({ userData: {}, getWorldPosition: (v) => v, traverse: (f) => f({ layers: { set: () => {} } }) });
  const toolbox = { held: false, pickUp: vi.fn(), putDown: vi.fn(), model: model() };
  const petrolCan = { held: false, pickUp: vi.fn(), putDown: vi.fn(), model: model() };
  const g = {
    toolbox,
    petrolCan,
    premixCan: { held: false },
    dieselCan: { held: false },
    teaMugs: {},
    handsFull: false,
    camera: {},
    audioHub: { useCue: vi.fn() },
    heldLoad: () => [toolbox, petrolCan].find((i) => i.held) ?? null,
  };
  const h = new RackHost(g);
  h.rackShowStrap = vi.fn();
  const quad = { mugAnchor: {}, rackLoad: { kg: 0, driveFactor: 1, brakeFactor: 1 } };
  const unit = { quad };
  const kit = {
    unit,
    quad,
    anchor: { remove: vi.fn() },
    hold: { load: vi.fn((item) => (item.held = false)) },
    rack: new RackLoad(h.params),
    strap: null,
  };
  h.kits.push(kit);
  return { h, g, kit, quad, unit, toolbox, petrolCan };
}

const shown = (p) => normalisePrompt(p);

describe('a load on a quad\'s rack', () => {
  it('offers to put what you hold on the rack, as an E action', () => {
    const { h, kit, petrolCan } = setup();
    petrolCan.held = true;
    expect(shown(h.rackPrompt(kit))).toMatchObject({ action: 'Put the jerry can on the rack' });
  });

  it('puts it on loose, and the quad carries the weight', () => {
    const { h, kit, quad, toolbox } = setup();
    toolbox.held = true;
    h.rackPress(kit);
    expect(kit.hold.load).toHaveBeenCalledWith(toolbox);
    expect(kit.rack.loaded).toBe(true);
    expect(kit.rack.strapped).toBe(false);
    expect(quad.rackLoad.kg).toBe(h.params.toolboxKg);
    expect(quad.rackLoad.driveFactor).toBeLessThan(1);
    expect(quad.rackLoad.brakeFactor).toBeLessThan(1);
  });

  it('says to hold E to strap a loose load, and a tap takes it off', () => {
    const { h, kit, petrolCan } = setup();
    petrolCan.held = true;
    h.rackPress(kit);
    const p = shown(h.rackPrompt(kit));
    expect(p).toMatchObject({ action: 'Strap the jerry can down', hold: true });
    expect(p.keys).toContainEqual(['E', 'Tap to take it off']);
    h.rackPress(kit);
    expect(kit.rack.release()).toBe('takeOff');
  });

  it('says to hold E to undo a strapped load, and a hold straps then unstraps it', () => {
    const { h, g, kit, petrolCan } = setup();
    petrolCan.held = true;
    h.rackPress(kit);
    h.rackPress(kit);
    let done = null;
    for (let t = 0; t < 3 && !done; t += 0.1) done = kit.rack.hold(0.1);
    h.rackDone(kit, done);
    expect(kit.rack.strapped).toBe(true);
    expect(h.rackShowStrap).toHaveBeenCalled();
    expect(g.audioHub.useCue).toHaveBeenCalledWith('latch');
    expect(shown(h.rackPrompt(kit))).toMatchObject({ action: 'Undo the strap and take the jerry can', hold: true });
    expect(h.rackSave(kit.unit)).toBe('petrolCan');
    h.rackPress(kit);
    done = null;
    for (let t = 0; t < 3 && !done; t += 0.1) done = kit.rack.hold(0.1);
    h.rackDone(kit, done);
    expect(petrolCan.pickUp).toHaveBeenCalled();
    expect(kit.rack.loaded).toBe(false);
    expect(kit.quad.rackLoad.kg).toBe(0);
  });

  it('gives a reason, not an act, when your hands are full or tea is on the rack', () => {
    const { h, g, kit, petrolCan, toolbox } = setup();
    petrolCan.held = true;
    h.rackPress(kit);
    g.handsFull = true;
    toolbox.held = true;
    expect(shown(h.rackPrompt(kit))).toMatchObject({ info: expect.stringContaining('on the rack') });
    h.rackPress(kit);
    expect(kit.rack.pressing).toBe(false);
    g.handsFull = false;
    g.teaMugs = { amy: { parent: kit.quad.mugAnchor } };
    expect(shown(h.rackPrompt(kit))).toMatchObject({ info: 'There is tea on the rack' });
  });

  it('keeps only a strapped load in the save', () => {
    const { h, kit, unit, petrolCan } = setup();
    petrolCan.held = true;
    h.rackPress(kit);
    expect(h.rackSave(unit)).toBe(null);
    kit.rack.strapped = true;
    expect(h.rackSave(unit)).toBe('petrolCan');
  });

  it('puts a loose load on and clears it from the debug panel', () => {
    const { h, quad, unit, petrolCan } = setup();
    expect(h.debugRack(unit, 'can')).toBe('jerry can on the rack');
    expect(h.rackSummary(unit)).toMatch(/jerry can, loose/);
    expect(h.debugRack(unit, 'toolbox')).toBe('the rack is taken');
    expect(h.debugRack(unit, 'strap')).toBe('strapped down');
    expect(h.rackSummary(unit)).toMatch(/strapped/);
    expect(h.debugRack(unit, 'clear')).toBe('rack cleared');
    expect(petrolCan.putDown).toHaveBeenCalled();
    expect(quad.rackLoad.kg).toBe(0);
  });
});
