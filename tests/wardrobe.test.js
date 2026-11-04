import { describe, it, expect } from 'vitest';
import { wardrobeLook, styleFor, describeLook, LOOK_COUNT, OUTFIT_LOOKS, LAYERS } from '../src/debug/wardrobe.js';
import { OUTFIT_KINDS } from '../src/npc/outfits.js';
import { wardrobe } from '../src/debug/sceneSetups.js';

describe('the wardrobe looks', () => {
  it('has every layer for every outfit, in order, and wraps', () => {
    expect(LOOK_COUNT).toBe(OUTFIT_LOOKS.length * LAYERS.length);
    expect(wardrobeLook(0).number).toBe(1);
    expect(wardrobeLook(0).layer).toBe(LAYERS[0]);
    expect(wardrobeLook(LAYERS.length).outfit).toBe(OUTFIT_LOOKS[1]);
    expect(wardrobeLook(LOOK_COUNT).number).toBe(1);
    expect(wardrobeLook(-1).number).toBe(LOOK_COUNT);
  });
  it('shows every outfit kind the girls can be dealt', () => {
    expect(new Set(OUTFIT_LOOKS.map((o) => o.style.kind))).toEqual(new Set(Object.keys(OUTFIT_KINDS)));
  });
  it('keeps Amy to her polo for the crop-top', () => {
    const crop = OUTFIT_LOOKS.find((o) => o.style.kind === 'cropTop');
    const look = { outfit: crop, layer: LAYERS[0], number: 1 };
    expect(styleFor(look, 'jess', () => true).kind).toBe('cropTop');
    expect(styleFor(look, 'amy', () => true).kind).toBe('polo');
    expect(styleFor(look, 'jess', () => false).kind).toBe('polo');
    expect(describeLook(look)).toMatch(/look 1 of \d+: the crop-top/);
  });
});

/** A stand-in game: records what each girl was dressed in. */
function standIn() {
  const worn = { jumper: {}, coat: {} };
  const rack = (kind) => ({
    list: [{ id: `${kind}L` }, { id: `${kind}R` }],
    colourOf: (id) => `#${id}`,
    hung: (girl) => delete worn[kind][girl],
    dressed: (girl, id) => (worn[kind][girl] = id),
    hoodHeld: {},
    clock: 0,
  });
  const girl = (id) => ({
    name: id,
    fsm: { is: () => true },
    character: { id, outfitOdds: id === 'jess' ? { cropTop: 1 } : {} },
    outfit: { style: {} },
    root: { position: { set() {} }, rotation: {} },
    holds: {},
    hold(k) { this.holds[k] = true; },
    setStyle(s) { this.style = s; },
    setJumper(c) { this.jumper = c; },
    setCoat(c) { this.coat = c; },
    setHood(u) { this.hood = u; },
  });
  const g = {
    companions: [girl('amy'), girl('jess')],
    jumpers: rack('jumper'),
    coats: rack('coat'),
    world: { heightAt: () => 0, layout: { yard: { x: 5, z: 7 } } },
    settleGirl: () => {},
    showRack: () => {},
  };
  const said = [];
  return { g, worn, said, say: (l) => said.push(l) };
}

describe('the wardrobe scene', () => {
  it('dresses both girls in the same look and moves on to the next each time', () => {
    const { g, worn, said, say } = standIn();
    const first = wardrobe(g, say);
    expect(first[0]).toMatch(/look 1 of/);
    expect(said).toEqual(['tp me 5 7 0']); // from the yard's own spot, not the player's position (which lags a tp)
    expect(g.companions.every((c) => c.style.kind === 'polo' && c.jumper === null && c.coat === null && c.holds.scene)).toBe(true);
    wardrobe(g, say); // a jumper
    expect(worn.jumper).toEqual({ amy: 'jumperL', jess: 'jumperR' });
    expect(g.companions[0].jumper).toBe('#jumperL');
    wardrobe(g, say);
    wardrobe(g, say); // coat, hood up
    expect(worn.jumper).toEqual({});
    expect(worn.coat).toEqual({ amy: 'coatL', jess: 'coatR' });
    expect(g.companions[1].hood).toBe(true);
    expect(g.coats.hoodHeld.amy.up).toBe(true);
    wardrobe(g, say);
    expect(worn.jumper.amy).toBe('jumperL');
  });
});
