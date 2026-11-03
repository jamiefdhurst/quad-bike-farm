import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { HutHost } from '../src/world/hutHost.js';
import { hutShape } from '../src/world/hut.js';
import { LAYOUT } from '../src/world/layout.js';
import { DEFAULT_HUT_PARAMS as P } from '../src/world/hut.js';
import { validFeedback } from '../src/interaction/feedback.js';

// The hut as the player meets it: what each prompt says (an E action is a string so the HUD puts the key on it, a refusal is plain text), what
// happens after the hold at the kettle, and what a girl does when she is asked up. A stand-in game, since game.js is never built in tests.
function girl(id, { free = true, near = true } = {}) {
  const log = { goRest: vi.fn(() => true), said: [], held: [], released: [], left: 0 };
  return {
    character: { id },
    name: id === 'amy' ? 'Amy' : 'Jess',
    root: { position: new THREE.Vector3(near ? -60 : 100, 16, near ? 190 : 0) },
    availability: () => ({ free }),
    voice: { say: (k) => log.said.push(k) },
    hold: (...a) => log.held.push(a),
    release: (k) => log.released.push(k),
    goRest: log.goRest,
    isResting: false,
    leaveRest: () => log.left++,
    log,
  };
}

function setup({ girls = [girl('amy')] } = {}) {
  const items = [];
  const toasts = [];
  const notes = [];
  const favour = [];
  const shape = hutShape(LAYOUT);
  const game = {
    scene: new THREE.Scene(),
    interaction: { add: (i) => items.push(i) },
    hud: { toast: (t) => toasts.push(t) },
    achievements: { note: (k) => notes.push(k) },
    favour: { add: (id, n) => favour.push([id, n]), mood: () => 'favoured' },
    audioHub: {},
    handsFull: false,
    player: { isRiding: false, position: new THREE.Vector3(-60, 16, 190) },
    companions: girls,
    weather: { rain: 0, temperature: 10 },
    daylight: { darkness: 0 },
    wind: { x: 0, z: 0 },
    world: {
      hutShape: shape,
      heightAt: () => 15.9,
      props: {
        hut: {
          group: new THREE.Group(),
          parts: { ground: 15.9, chimneyY: 4, kettle: new THREE.Group(), stoveDoor: { material: {} }, glass: {}, mug: {}, topLeaf: {} },
        },
      },
    },
  };
  const host = new HutHost(game);
  host.audio = { light: vi.fn(), pour: vi.fn(), crackle: vi.fn(), latch: vi.fn() };
  return { host, game, items, toasts, notes, favour, shape };
}

describe("the shepherd's hut stove", () => {
  it('registers four things to use, each with a valid feedback and a prompt', () => {
    const { items } = setup();
    expect(items).toHaveLength(4);
    for (const i of items) {
      expect(validFeedback(i.feedback), 'feedback').toBe(true);
      expect(i.prompt).toBeTypeOf('function');
    }
  });

  it('offers to light a cold stove and then to put a log on, as E actions', () => {
    const { items, host } = setup();
    const stove = items[0];
    expect(stove.isAvailable()).toBe(true);
    expect(stove.prompt()).toBe('Light the stove');
    stove.interact();
    expect(host.stove.burning).toBe(true);
    expect(host.audio.light).toHaveBeenCalled();
    expect(stove.prompt()).toBe('Put a log on the stove');
    host.stove.fuel = P.maxSeconds; // full: nothing to do
    expect(stove.isAvailable()).toBe(false);
  });

  it('toasts the lighting and ticks the bucket list, but not when a girl does it', () => {
    const { host, toasts, notes } = setup();
    host.light('her');
    expect(notes).not.toContain('hutLit');
    host.stove.reset();
    host.light('you');
    expect(notes).toContain('hutLit');
    expect(toasts.length).toBe(2);
  });
});

describe('the kettle', () => {
  it('says why you cannot pour yet in plain text, and offers the hold once it has boiled', () => {
    const { items, host, game } = setup();
    const kettle = items[1];
    expect(kettle.prompt()).toEqual({ text: 'The kettle is cold: light the stove first' });
    host.stove.light();
    host.stove.update(P.warmUp * P.warmAt + 1);
    expect(kettle.prompt()).toEqual({ text: 'The kettle is coming up to the boil' });
    host.stove.kettle = 1;
    expect(kettle.prompt()).toEqual({ action: 'Pour a mug of tea', hold: true });
    game.handsFull = true;
    expect(kettle.prompt()).toEqual({ text: 'Put down what you are holding to pour a mug of tea' });
    expect(kettle.hold(0.1)).toBe(false);
  });

  it('pours a mug after the hold: a toast, the bucket list, and a girl sat there says so', () => {
    const sat = girl('amy');
    const { items, host, toasts, notes } = setup({ girls: [sat] });
    host.stove.light();
    host.stove.heat = 1;
    host.stove.kettle = 1;
    sat.isResting = true;
    sat.restPhase = 'sat';
    sat.restSpot = host.spots[0];
    host.stay.begin('amy', 'offer', [0]);
    const kettle = items[1];
    let n = 0;
    while (n < 100 && !toasts.length) {
      expect(kettle.hold(0.1)).toBe(true);
      n++;
    }
    expect(n).toBeGreaterThan(P.pourSeconds * 10 - 2);
    expect(toasts[0]).toMatch(/mug of tea/);
    expect(notes).toContain('hutTea');
    expect(sat.log.said).toEqual(['hutTea']);
    expect(host.stay.sessions.get('amy').teaBefore).toBe(0); // she was not yet "sitting" for the stay's own count
  });

  it('starts the pour again from the top if you let go', () => {
    const { items, host } = setup();
    host.stove.light();
    host.stove.kettle = 1;
    items[1].hold(P.pourSeconds * 0.8);
    expect(host.stove.pour).toBeGreaterThan(0);
    host.update(0.016); // the frame it was held in
    expect(host.stove.pour).toBeGreaterThan(0);
    host.update(0.016); // a frame with no hold
    expect(host.stove.pour).toBe(0);
  });
});

describe('asking a girl up to the hut', () => {
  it('shows the doorway prompt with her name only when a free girl is near, and sends her up the steps', () => {
    const amy = girl('amy');
    const far = girl('jess', { near: false });
    const { items, host, game } = setup({ girls: [amy, far] });
    const door = items[2];
    expect(door.isAvailable()).toBe(true);
    expect(door.prompt()).toBe('Sit in the hut with Amy');
    door.interact();
    expect(amy.log.held).toEqual([['hut', "sitting in the shepherd's hut"]]);
    expect(amy.log.said).toEqual(['hutYes']);
    const [spot, opts] = amy.log.goRest.mock.calls[0];
    expect(spot.via.length).toBeGreaterThan(1);
    expect(spot.stand).toBeTruthy();
    expect(opts.stay).toBe(Infinity);
    expect(door.isAvailable()).toBe(false); // she is on her way
    game.companions = [];
    expect(host.hutGirl()).toBe(null);
  });

  it('is not offered with a busy girl, with you riding, or with both places taken', () => {
    const busy = girl('amy', { free: false });
    const { items, game } = setup({ girls: [busy] });
    expect(items[2].isAvailable()).toBe(false);
    const { items: i2, game: g2, host } = setup({ girls: [girl('amy')] });
    g2.player.isRiding = true;
    expect(i2[2].isAvailable()).toBe(false);
    g2.player.isRiding = false;
    host.stay.begin('x', 'offer', [0]);
    host.stay.begin('y', 'offer', [1]);
    expect(host.hutGirl()).toBe(null);
    void game;
  });

  it('takes a girl who cannot go back out of the stay, and lets a finished one go with her favour', () => {
    const amy = girl('amy');
    amy.log.goRest.mockReturnValue(false);
    const { host, favour, notes } = setup({ girls: [amy] });
    expect(host.ask(amy)).toBe(true);
    expect(amy.log.released).toEqual(['hut']);
    expect(host.stay.sessions.size).toBe(0);
    host.stay.begin('amy', 'offer', [0]);
    host.handleEvent({ type: 'end', girl: 'amy', why: 'done', teaWith: true });
    expect(favour).toEqual([['amy', host.stay.p.favour + host.stay.p.romanceFavour + host.stay.p.teaFavour]]);
    expect(notes).toContain('hutSat');
    expect(amy.log.left).toBe(0); // she was not sat
  });

  it('turns the chooser offers into a go for the girl who took it', () => {
    const amy = girl('amy');
    const { host } = setup({ girls: [amy] });
    host.stove.reset();
    const offers = host.offers();
    expect(offers.map((o) => o.key)).toEqual(['hut']);
    host.take(offers[0]);
    expect(amy.log.said).toEqual(['hutOffer']);
    expect(host.offers()).toEqual([]); // she is on her way
  });
});

describe('the warmth and the shelter of the hut', () => {
  it('is warm inside (and by the door) only once the stove is, and covered by its walls', () => {
    const { host, shape } = setup();
    const inside = shape.toWorld(0, 0);
    const out = shape.toWorld(0, 30);
    expect(host.inside(inside.x, inside.z)).toBe(true);
    expect(host.inside(out.x, out.z)).toBe(false);
    expect(host.warmsAt(inside.x, inside.z)).toBe(false);
    host.debugLight();
    expect(host.warmsAt(inside.x, inside.z)).toBe(true);
    expect(host.warmsAt(out.x, out.z)).toBe(false);
    host.debugPutOut();
    expect(host.warmsAt(inside.x, inside.z)).toBe(false);
    expect(host.describe()).toMatch(/^cold/);
  });

  it('burns on in the update, and says when it has burnt out if you are near', () => {
    const { host, toasts } = setup();
    host.stove.light();
    host.stove.fuel = 1;
    host.update(2);
    expect(toasts).toEqual(['The stove has burnt out']);
  });
});

describe("the shepherd's hut door", () => {
  it('prompts to shut it, then to open it, and wins over the doorway ask', () => {
    const { items, host } = setup();
    const door = items.find((i) => i.priority === 1);
    expect(door.prompt()).toBe('Shut the door');
    expect(door.feedback).toBe('latch');
    door.interact();
    expect(host.door.isOpen).toBe(false);
    expect(door.prompt()).toBe('Open the door');
  });

  it('blocks the doorway once shut and not while open', () => {
    const { items, host } = setup();
    const enabled = [];
    host.props.parts.doorCollider = { setEnabled: (v) => enabled.push(v) };
    items.find((i) => i.priority === 1).interact();
    host.update(5);
    expect(enabled.at(-1)).toBe(true);
    items.find((i) => i.priority === 1).interact();
    host.update(5);
    expect(enabled.at(-1)).toBe(false);
  });

  it('is opened by a girl going in, and shut behind her on leaving in rain once she is clear', () => {
    const amy = girl('amy', { near: false });
    const { host, game } = setup({ girls: [amy] });
    host.door.setOpen(false);
    host.handleEvent({ type: 'go', girl: 'amy', seat: 0, how: 'asked' });
    expect(host.door.isOpen).toBe(true);
    game.weather.rain = 0.8;
    host.handleEvent({ type: 'end', girl: 'amy', why: 'done' });
    expect(host.door.isOpen).toBe(true);
    host.update(0.1);
    expect(host.door.isOpen).toBe(false);
  });

  it('is left open behind her on a fine day', () => {
    const amy = girl('amy', { near: false });
    const { host } = setup({ girls: [amy] });
    host.handleEvent({ type: 'end', girl: 'amy', why: 'done' });
    host.update(0.1);
    expect(host.door.isOpen).toBe(true);
  });

  it('does not shut with a girl still at the doorway', () => {
    const amy = girl('amy', { near: true });
    const { host, game } = setup({ girls: [amy] });
    const d = host.doorPos();
    amy.root.position.set(d.x, 16, d.z);
    game.weather.rain = 0.8;
    host.handleEvent({ type: 'end', girl: 'amy', why: 'done' });
    host.update(0.1);
    expect(host.door.isOpen).toBe(true);
  });

  it('lets no stove heat out to a girl stood outside a shut door', () => {
    const { host, shape } = setup();
    host.stove.light();
    host.stove.heat = 1;
    const at = shape.toWorld(0.62, shape.halfLength + 0.8);
    host.door.setOpen(false);
    expect(host.warmsAt(at.x, at.z)).toBe(false);
  });
});
