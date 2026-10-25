import { describe, it, expect, vi } from 'vitest';
import { VillageHost } from '../src/world/villageHost.js';
import { Spares } from '../src/workshop/spares.js';
import { Market } from '../src/farm/classifieds.js';

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
