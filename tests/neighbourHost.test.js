import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { LAYOUT } from '../src/world/layout.js';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { headlessContext } from './helpers/worldModels.js';
import { buildNeighbourFarm } from '../src/world/neighbourFarmProps.js';
import { NeighbourHost } from '../src/world/neighbourHost.js';
import { createNeighbourFarm } from '../src/world/neighbourFarm.js';
import { neighbourOutfit, NEIGHBOUR_HEIGHT } from '../src/world/neighbourLook.js';

// The neighbour in the running game while she is out calling at the farm (#908): a stand-in game, since game.js is never built in tests.

function standIn(visit) {
  const props = { group: { visible: true }, setNight: () => {}, setAway: vi.fn() };
  const game = {
    seed: 7,
    world: { props: { neighbourFarm: props }, outbuildings: { neighbour: createNeighbourFarm(LAYOUT) }, groundHeightAt: () => 0 },
    audioHub: {},
    trafficHost: { traffic: { visit } },
    models: {},
    companions: [],
    player: { position: { x: 0, z: 0 }, isRiding: true },
    hud: { caption: () => {} },
  };
  return { host: new NeighbourHost(game), game, props };
}

describe('the neighbour while she is calling at the farm', () => {
  it('goes out when a neighbour\'s visit starts, taking her Tor, and is home when it has ended', () => {
    const { host, game, props } = standIn(null);
    host.rig = { root: { visible: true, position: { set: () => {} }, rotation: { set: () => {} } }, offsets: {}, lookTarget: { set: () => {} }, update: () => {} };
    host.syncAway();
    host.show(0.1);
    expect(host.rig.root.visible).toBe(true);
    expect(host.neighbour.away).toBe(false);
    expect(props.setAway).not.toHaveBeenCalled();

    game.trafficHost.traffic.visit = { kind: 'neighbour' };
    host.syncAway();
    expect(host.neighbour.away).toBe(true);
    expect(props.setAway).toHaveBeenLastCalledWith('tor', true);
    expect(host.describe()).toMatch(/out, calling at the farm/);
    expect(host.debugGreet()).toBe(false);
    host.show(0.1);
    expect(host.rig.root.visible).toBe(false);

    game.trafficHost.traffic.visit = null;
    host.syncAway();
    host.show(0.1);
    expect(host.rig.root.visible).toBe(true);
    expect(host.neighbour.away).toBe(false);
    expect(props.setAway).toHaveBeenLastCalledWith('tor', false);
    expect(host.describe()).not.toMatch(/calling at the farm/);
  });

  it('stays in her yard for the post van, which is somebody else', () => {
    const { host, props } = standIn({ kind: 'post' });
    host.syncAway();
    expect(host.neighbour.away).toBe(false);
    expect(props.setAway).not.toHaveBeenCalled();
  });
});

describe('her Tor in the yard', () => {
  let built;
  const colliders = [];
  beforeAll(() => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const c = headlessContext();
    c.fixedBox = () => {
      const col = { enabled: true, setEnabled(v) { this.enabled = v; } };
      colliders.push(col);
      return col;
    };
    built = buildNeighbourFarm(c);
  });

  it('lays the slab in four meshes of four different 16 m tiles (#1146)', () => {
    const slabs = [];
    built.group.traverse((o) => o.isMesh && o.material.map?.image?.width === 1024 && slabs.push(o)); // the only 1024 px maps are the slab's 16 m tiles
    expect(slabs).toHaveLength(4);
    expect(new Set(slabs.map((m) => m.material.map)).size).toBe(4);
  });

  it('is taken out of the yard with its collider while she is away, and nothing else is', () => {
    const tor = built.vehicles.find((v) => v.kind === 'tor');
    const others = built.vehicles.filter((v) => v.kind !== 'tor');
    built.setAway('tor', true);
    expect(tor.object.visible).toBe(false);
    expect(tor.collider.enabled).toBe(false);
    for (const v of others) {
      expect(v.object.visible).toBe(true);
      expect(v.collider.enabled).toBe(true);
    }
    built.setAway('tor', false);
    expect(tor.object.visible).toBe(true);
    expect(tor.collider.enabled).toBe(true);
  });
});

describe('one woman, in her yard and at the farm', () => {
  it('is dressed from one outfit and stands one height', () => {
    expect(neighbourOutfit()).toEqual(neighbourOutfit());
    expect(NEIGHBOUR_HEIGHT).toBeGreaterThan(1.5);
    // Both rigs are made where the game has the model, so the check is that each takes its outfit and height from neighbourLook.js and not its own.
    for (const file of ['src/world/neighbourHost.js', 'src/world/trafficView.js']) {
      const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      expect(src, file).toMatch(/neighbourOutfit\(\)/);
      expect(src, file).toMatch(/NEIGHBOUR_HEIGHT/);
    }
  });
});
