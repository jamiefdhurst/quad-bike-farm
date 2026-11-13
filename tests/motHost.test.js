import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MotHost } from '../src/world/motHost.js';
import { MotWear, MOT_PARAMS } from '../src/farm/mot.js';
import { Market } from '../src/farm/classifieds.js';

// The garage's clipboard as the player meets it: what the prompt says, what the money does, what the sheet and the girls say when the test is
// done, and what is refused and why. A stand-in game and a stand-in page, since game.js and the DOM are never built in tests.
const fakeEl = () => {
  const el = { style: {}, children: [], className: '', textContent: '', innerHTML: '', append() {}, replaceChildren() {} };
  el.querySelector = () => fakeEl();
  return el;
};

function setup({ purse = 100, x = 100, z = 50, yaw = Math.PI / 2, running = false } = {}) {
  const items = [];
  const market = new Market();
  market.purse = purse;
  const wear = new MotWear();
  const said = [];
  const noted = [];
  const unit = {
    spec: { id: 'tor', landRover: true },
    engine: { isRunning: running, coolantLeak: 0, silencerBlown: 0 },
    quad: {
      speed: 0,
      yaw,
      position: { x, z },
      motWear: wear,
      faults: { started: {}, levels: {} },
      brakes: { binding: false, heat: 0, wet: 0 },
      tyres: { tread: { front: 1, rear: 1 }, psi: [4, 4, 4, 4] },
    },
  };
  const girl = { root: { position: { x: 100, z: 45 } }, availability: () => ({ canRemark: true }), voice: { say: (k) => said.push(k) } };
  const game = {
    interaction: { add: (i) => items.push(i) },
    market,
    units: [unit],
    companions: [girl],
    player: { isRiding: false },
    farm: { day: 4 },
    notebook: { note: (u, what) => noted.push(what) },
    saveFarm: vi.fn(),
    villageHost: { chink: vi.fn() },
  };
  const mesh = { getWorldPosition: (v) => v.set(100, 1, 52) };
  const host = new MotHost(game, { motProxy: { mesh }, motBay: { x: 100, z: 50, yaw: Math.PI / 2 } });
  return { host, game, unit, wear, said, noted, clipboard: items[0] };
}

beforeEach(() => {
  vi.stubGlobal('document', { createElement: fakeEl, body: { appendChild() {} } });
});

describe('the clipboard', () => {
  it('offers the test as an E action with the price, to a Tor or Crag parked in the bay', () => {
    const { clipboard } = setup();
    expect(clipboard.prompt()).toEqual({ action: expect.stringMatching(/^Have .* MOT tested for £20$/) });
  });

  it('says why plain, with no key, when there is nothing in the bay, the engine is running or the tin is short', () => {
    expect(setup({ x: 90 }).clipboard.prompt()).toEqual({ info: expect.stringMatching(/Park a Tor or Crag/) });
    expect(setup({ running: true }).clipboard.prompt()).toEqual({ info: expect.stringMatching(/engine off/) });
    expect(setup({ purse: 5 }).clipboard.prompt()).toEqual({ info: 'You are £15 short' });
  });

  it('takes the money, then reads the vehicle when the time is up', () => {
    const { host, game, unit, wear, said, noted, clipboard } = setup();
    wear.horn = 0.9;
    clipboard.interact();
    expect(game.market.purse).toBe(80);
    expect(game.villageHost.chink).toHaveBeenCalled();
    expect(clipboard.prompt()).toEqual({ info: expect.stringMatching(/going over/) });
    host.update(MOT_PARAMS.testSeconds - 1);
    expect(host.log.last.tor).toBeUndefined();
    host.update(2);
    expect(host.log.failed('tor')).toBe(true);
    expect(noted[0]).toMatchObject({ kind: 'mot', passed: false, fails: ['horn'] });
    expect(said).toEqual(['motFail']);
    expect(game.saveFarm).toHaveBeenCalled();
    expect(unit.quad.motWear).toBe(wear);
  });

  it('passes a sound one, remembers the certificate and the girls say so', () => {
    const { host, said, game, clipboard } = setup();
    clipboard.interact();
    host.update(MOT_PARAMS.testSeconds + 1);
    expect(host.log.valid('tor', game.farm.day)).toBe(true);
    expect(said).toEqual(['motPass']);
  });

  it('gives the money back if the engine is started or the vehicle moves off mid-test', () => {
    const { host, game, unit, clipboard } = setup();
    clipboard.interact();
    unit.engine.isRunning = true;
    host.update(1);
    expect(game.market.purse).toBe(100);
    expect(host.run).toBeNull();
    clipboard.interact();
    unit.engine.isRunning = false;
    unit.quad.position.x = 120;
    host.update(1);
    expect(game.market.purse).toBe(100);
  });

  it('is not there to use while you are driving', () => {
    const { clipboard, game } = setup();
    game.player.isRiding = true;
    expect(clipboard.isAvailable()).toBe(false);
  });

  it('keeps its log through the farm save', () => {
    const { host } = setup();
    host.debugTest();
    const saved = JSON.parse(JSON.stringify(host.toJSON()));
    const other = setup().host;
    other.restore(saved);
    expect(other.log.last.tor.passed).toBe(true);
  });
});
