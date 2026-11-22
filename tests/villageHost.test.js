import { describe, it, expect, vi } from 'vitest';
import { VillageHost } from '../src/world/villageHost.js';
import { Spares } from '../src/workshop/spares.js';
import { Market } from '../src/farm/classifieds.js';
import { MotHost } from '../src/world/motHost.js';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { villageShape } from '../src/world/village.js';

// The village's counters as the player meets them: what the prompt says (an E action carries the key, a refusal is plain text), what the toast
// says after a purchase, and that a purchase makes its noise and a refusal does not. A stand-in game, since game.js is never built in tests.
function setup({ purse = 100 } = {}) {
  const items = [];
  const market = new Market();
  market.purse = purse;
  const toasts = [];
  const proxy = (id) => ({ id, mesh: { id } });
  const game = {
    interaction: { add: (i) => items.push(i) },
    market,
    spares: new Spares(),
    sparesShelf: { paintCrates: () => {} },
    hud: { toast: (t) => toasts.push(t) },
    handsFull: false,
    player: { isRiding: false },
    can: { held: false },
    companions: [],
    favour: { add: () => {} },
    camera: { position: { x: 150, y: 2, z: 186 } },
    audioHub: {},
    world: { props: { village: { pumpProxies: [], partProxies: ['plug', 'tube', 'belt', 'tyreQuad'].map(proxy), shopProxies: ['sweets', 'pasty'].map(proxy) } } },
  };
  const host = new VillageHost(game);
  host.coins.chinkAt = vi.fn();
  const at = (id) => items.find((i) => i.target.id === id);
  return { host, game, at, toasts };
}

describe('the garage rack and the shop counter', () => {
  it('shows what you can buy as an E action (a string, so the HUD puts the key on it)', () => {
    const { at } = setup();
    for (const id of ['plug', 'tube', 'belt', 'tyreQuad', 'sweets', 'pasty']) {
      const p = at(id).prompt();
      expect(typeof p, id).toBe('string');
      expect(p, id).toMatch(/^Buy /);
    }
  });

  it('shows a refusal as plain text, with no key', () => {
    const { at, game } = setup({ purse: 0 });
    expect(at('plug').prompt()).toHaveProperty('text');
    expect(at('sweets').prompt()).toHaveProperty('text');
    game.market.purse = 100;
    game.spares.counts.plug = 8;
    expect(at('plug').prompt()).toHaveProperty('text');
  });

  it('says what was bought, its price, the rack count and what is left, and chinks', () => {
    const { at, game, toasts, host } = setup();
    const before = game.spares.count('plug');
    at('plug').interact();
    expect(game.spares.count('plug')).toBe(before + 1);
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatch(/^Bought a spark plug for £6\b/);
    expect(toasts[0]).toContain(`barn's rack`);
    expect(toasts[0]).toContain(`(${before + 1} there)`);
    expect(toasts[0]).toContain(`£${game.market.purse} in the tin`);
    expect(host.coins.chinkAt).toHaveBeenCalledTimes(1);
  });

  it('chinks where you stand, not at the tin', () => {
    const { at, host, game } = setup();
    at('pasty').interact();
    expect(host.coins.chinkAt).toHaveBeenCalledWith(game.camera.position, expect.any(Number));
  });

  it('buys nothing and makes no noise when the tin or the rack says no, and says why', () => {
    const { at, game, toasts, host } = setup({ purse: 2 });
    at('plug').interact();
    expect(game.market.purse).toBe(2);
    expect(toasts[0]).toBeTruthy();
    expect(toasts[0]).not.toMatch(/^Bought/);
    expect(host.coins.chinkAt).not.toHaveBeenCalled();
  });

  it('the shop toast also says it was bought', () => {
    const { at, toasts } = setup();
    at('sweets').interact();
    expect(toasts[0]).toMatch(/^Bought a bag of sweets/);
  });
});

// The same counters and places on the new farm (#688), where the village is across the lane, the shop on the street's south side facing north and the garage on the
// lane facing south: the stand-in game has the new farm's real shape, so where a console line puts you is checked against where things really are.
describe('the village on the new farm (#688)', () => {
  const two = LAYOUT;
  const shape = villageShape(two);

  function onNewFarm() {
    const put = [];
    const game = {
      interaction: { add: () => {} },
      market: new Market(),
      audioHub: {},
      player: { isRiding: false, moveTo: (p) => put.push(p) },
      world: { groundHeightAt: () => 3, props: { village: { shape, pumpProxies: [], partProxies: [], shopProxies: [] } } },
    };
    return { host: new VillageHost(game), put };
  }
  const inside = (r, p, m = 0) => p.x > r.minX - m && p.x < r.maxX + m && p.z > r.minZ - m && p.z < r.maxZ + m;

  it('is active, and describes itself by name', () => {
    const { host } = onNewFarm();
    expect(host.active).toBe(true);
    expect(host.describe()).toMatch(/^Nether Thornby: 20 mph/);
  });

  it('puts you in the pub\'s car park, on the street side of the shop and at the pumps', () => {
    const { host, put } = onNewFarm();
    expect(host.debugGoTo('pub')).toBe(true);
    expect(inside(shape.carPark, put.at(-1))).toBe(true);
    host.debugGoTo('shop');
    const shop = put.at(-1);
    expect(shop.z).toBeLessThan(shape.shop.outer.minZ); // the shop is on the south side with its front to the north: you stand in front of it, between it and the street
    expect(shop.z).toBeGreaterThan(shape.roadAt(shop.x, shop.z).at.z);
    expect(Math.abs(shop.x - shape.shop.x)).toBeLessThan(shape.shop.halfX);
    host.debugGoTo('garage');
    const pumps = two.village.garage.pumps;
    expect(put.at(-1).z).toBeGreaterThan(pumps.z);
    expect(inside(shape.forecourt, put.at(-1))).toBe(true);
  });

  it('puts you at the parts rack in front of the garage, which faces south, on the forecourt side', () => {
    const { host, put } = onNewFarm();
    host.debugGoTo('parts');
    const p = put.at(-1);
    expect(p.z).toBeGreaterThan(shape.garage.outer.maxZ);
    expect(p.z).toBeLessThan(shape.garage.outer.maxZ + 2.5);
    expect(Math.abs(p.x - shape.garage.x)).toBeLessThan(2);
  });

  it('puts you in front of the MOT clipboard on the forecourt, not behind the garage', () => {
    const at = { x: shape.garage.x + 5.4, y: 1.5, z: shape.garage.outer.maxZ + 0.3 };
    const stand = MotHost.prototype.stand.call({ props: { shape, motProxy: { mesh: { getWorldPosition: (v) => v.set(at.x, at.y, at.z) } } } });
    expect(stand.z).toBeGreaterThan(shape.garage.outer.maxZ);
    expect(Math.hypot(stand.x - at.x, stand.z - at.z)).toBeLessThan(2);
  });

  it('has the girls\' pub stop in the car park', () => {
    expect(inside(shape.carPark, shape.pubStop)).toBe(true);
  });
});
