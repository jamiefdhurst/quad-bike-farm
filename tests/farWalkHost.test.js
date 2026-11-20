import { describe, it, expect } from 'vitest';
import { MindsHost } from '../src/npc/mindsHost.js';

// A stand-in game: a girl at the hill's foot, the hut a long way up, the barn near the yard.
function setup({ girlAt = { x: 0, z: 0 }, hut = { x: 0, z: 400 }, quads = [], yours = null } = {}) {
  const girl = {
    root: { position: { ...girlAt } },
    quads,
    log: [],
    selfEvents: [],
    canDrive: () => true,
    canRidePillion: () => true,
    requestMount(q, o) { this.log.push(['mount', q.id, o.seat]); },
    requestDrive(q) { this.log.push(['drive', q.id, this.outingTo]); },
  };
  const g = {
    companions: [girl],
    hutHost: { spots: [hut] },
    flaskSpot: null,
    fireSpots: [],
    world: { layout: { yard: { x: 0, z: 10 } }, fields: { route: (a, b) => [{ x: b.x, z: b.z }], hill: { waitSpot: { x: 0, z: 0 } } } },
  };
  const host = new MindsHost(g);
  return { host, girl, yours };
}

const quad = (id, x = 5, z = 0, o = {}) => ({ id, position: { x, z, distanceTo: (p) => Math.hypot(x - p.x, z - p.z) }, speed: 0, rider: null, ...o });
const offers = [{ key: 'hut', girl: 'amy', weight: 1, take: () => {} }, { key: 'tea', girl: 'amy', weight: 0.5, take: () => {} }];

describe('far is far in the running game', () => {
  it('puts the hut a long way off aside and offers one lift in its place, keeping the near tea', () => {
    const { host, girl } = setup({ quads: [quad('q1')] });
    const out = host.farWalkOffers(girl, null, offers);
    expect(out.map((o) => o.key).sort()).toEqual(['lift', 'tea']);
  });

  it('takes a quad of her own to the place when you are not close', () => {
    const { host, girl } = setup({ quads: [quad('q1')] });
    const lift = host.farWalkOffers(girl, null, offers).find((o) => o.key === 'lift');
    expect(lift.how).toBe('quad');
    lift.take();
    expect(girl.log).toEqual([['drive', 'q1', { name: 'where she was going', x: 0, z: 400 }]]);
  });

  it('asks you for a lift, onto the back of your stopped quad, when you are close', () => {
    const mine = quad('mine', 6, 0);
    const { host, girl } = setup({ quads: [] });
    const lift = host.farWalkOffers(girl, { quad: mine }, offers).find((o) => o.key === 'lift');
    expect(lift.how).toBe('ask');
    lift.take();
    expect(girl.selfEvents).toEqual(['join']);
    expect(girl.log).toEqual([['mount', 'mine', 'pillion']]);
  });

  it('stays put when there is no quad to take and you are not close: the far offer is just dropped', () => {
    const { host, girl } = setup({ quads: [] });
    expect(host.farWalkOffers(girl, null, offers).map((o) => o.key)).toEqual(['tea']);
  });

  it('leaves the offers alone when none is far', () => {
    const { host, girl } = setup({ hut: { x: 0, z: 100 }, quads: [quad('q1')] });
    expect(host.farWalkOffers(girl, null, offers)).toBe(offers);
  });

  it('counts the hut and flask ranges from the hill foot waiting point', () => {
    const { host, girl } = setup();
    expect(host.waitingAtFoot(girl)).toBe(true);
    girl.root.position.z = 60;
    expect(host.waitingAtFoot(girl)).toBe(false);
  });
});

describe('calling them in the running game', () => {
  const callGame = (girls) => {
    const said = [];
    const g = {
      player: { position: { x: 0, z: 0, distanceTo() {} } },
      companions: girls.map((x) => ({
        character: { id: x.id },
        root: { position: { x: x.at, z: 0, distanceTo: (p) => Math.abs(x.at - p.x) } },
        availability: () => ({ free: x.free ?? true }),
        interrupt() { said.push([x.id, 'interrupt']); },
        requestComeHere() { said.push([x.id, 'come']); },
        voice: { say: (k) => said.push([x.id, k]) },
      })),
      leaveRides() {},
      phoneAudio: { whistle: () => said.push(['whistle']) },
      hud: { toast: (t) => said.push(['toast', t]) },
    };
    return { host: new MindsHost(g), said };
  };

  it('whistles, brings the near girl and has the far one say where she is', () => {
    const { host, said } = callGame([{ id: 'amy', at: 30 }, { id: 'jess', at: 100 }]);
    host.callThem();
    expect(said).toContainEqual(['whistle']);
    expect(said).toContainEqual(['amy', 'come']);
    expect(said).toContainEqual(['amy', 'calledComing']);
    expect(said.find((s) => s[0] === 'jess' && s[1].startsWith('called_'))).toBeTruthy();
  });

  it('says nobody hears you when nobody does', () => {
    const { host, said } = callGame([{ id: 'amy', at: 900 }, { id: 'jess', at: 700 }]);
    host.callThem();
    expect(said).toContainEqual(['toast', 'nobody hears you']);
  });
});
