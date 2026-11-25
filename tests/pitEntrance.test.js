import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { LAYOUT } from '../src/world/layout.js';
import { createFields } from '../src/world/fields.js';
import { createQuarry, dealtLayout } from '../src/world/quarry.js';
import { roadNetwork } from '../src/world/roads.js';
import { farmPlacements, placementBreaks, placementContext } from '../src/world/farmPlacement.js';
import { laneGateOf, laneReach, entrancePlan, spoilBankOf, bankRise, ENTRANCE, SIGN_WORDS, bellmouthHalf } from '../src/world/pitEntrance.js';
import { SET_PIECE_NAMES } from '../src/world/farDetail.js';
import { CAPSULE_RADIUS } from '../src/player/player.js';
import { DEFAULT_PLAYER_PARAMS } from '../src/player/playerParams.js';
import { DEFAULT_GATE_PARAMS } from '../src/world/gates.js';
import { headlessContext } from './helpers/worldModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';

// The Old Pit's lane entrance (#1002): the shut lane gate dressed, its bellmouth, blocks, barrier, signs, weeds, buddleia, hedge and litter, and the
// spoil bank inside the fence you see from the lane. Where each stands (pitEntrance.js), the bank in the ground (quarry.js), the model, and the gate
// still shut to a walking player whichever way round it they try.
const gate = laneGateOf(LAYOUT.quarry.gates);
const net = roadNetwork(LAYOUT);
const reach = laneReach(gate, (x, z) => net.onRoad('lane', x, z));
const plan = entrancePlan(gate, reach);
const f = plan.frame;

describe('where the lane entrance stands', () => {
  it('is the pit\'s shut lane gate at plan (885, 110), with the lane\'s tarmac about 17 m out', () => {
    expect(gate.id).toBe('pitlane');
    expect(reach).toBeGreaterThan(15);
    expect(reach).toBeLessThan(20);
    const on = f.at(reach + 0.2, 0);
    expect(net.onRoad('lane', on.x, on.z)).toBe(true);
  });
  it('splays the bellmouth from the width of the way at the gate to about 17 m across where it meets the lane', () => {
    const rows = plan.bellmouth.rows;
    const at = (u) => rows.reduce((best, r) => (Math.abs(r.u - u) < Math.abs(best.u - u) ? r : best));
    expect(at(0).right - at(0).left).toBeGreaterThan(5);
    expect(at(0).right - at(0).left).toBeLessThan(6.5);
    expect(at(reach).right - at(reach).left).toBeGreaterThan(16);
    expect(bellmouthHalf(reach, reach)).toBeCloseTo(ENTRANCE.hardcore + ENTRANCE.splay);
    expect(rows[rows.length - 1].u).toBeGreaterThan(reach); // a little under the lane's edge, so no grass shows between
  });
  it('stands the gate\'s posts on the fence\'s strainers at the gap\'s edges, the leaves 4.4 m together between them', () => {
    expect(plan.gateW).toBeCloseTo(4.4);
    for (const p of plan.posts) expect(Math.abs(p.v)).toBeCloseTo(gate.width / 2 + 0.05);
    expect(plan.leaves[0].hinge).toBeCloseTo(-2.2);
    expect(plan.leaves[1].hinge).toBeCloseTo(2.2);
  });
  it('puts the blocks across part of the way, the barrier\'s posts and the sign off it, and the puddles in the ruts', () => {
    expect(plan.blocks).toHaveLength(2);
    expect(Math.abs(plan.blocks[0].v)).toBeLessThan(ENTRANCE.hardcore); // across the near half of the way, just out from the gate
    for (const p of plan.barrier.posts) expect(Math.abs(f.toFrame(p.x, p.z).v)).toBeGreaterThan(bellmouthHalf(ENTRANCE.barrier.u, reach) + 0.3);
    expect(plan.sign.v).toBeGreaterThan(bellmouthHalf(plan.sign.u, reach) + 1);
    for (const p of plan.puddles) expect(Math.abs(Math.abs(p.v) - ENTRANCE.rut)).toBeLessThan(0.01);
  });
  it('puts the buddleia and weeds along the fence, the hedge either side of the bellmouth, and litter in the hedge', () => {
    for (const b of plan.buddleia) expect(Math.abs(b.u)).toBeLessThan(2.5);
    expect(plan.weeds.length).toBeGreaterThan(50);
    expect(plan.weeds.filter((w) => Math.abs(w.u) < 1).length).toBeGreaterThan(40);
    for (const h of plan.hedges) expect(Math.abs(f.toFrame(h.a.x, h.a.z).v)).toBeGreaterThan(bellmouthHalf(ENTRANCE.hedge.u, reach) + 3);
    const inHedge = plan.litter.filter((l) => Math.abs(l.u - ENTRANCE.hedge.u) < 1.5 && Math.abs(l.v) >= ENTRANCE.hedge.from && Math.abs(l.v) <= ENTRANCE.hedge.to);
    expect(inHedge.length).toBeGreaterThanOrEqual(4);
    expect(inHedge.some((l) => l.y > 0.5)).toBe(true); // snagged up in it, not only at its foot
  });
  it('washes chippings onto the lane\'s near half, and nothing else stands on its tarmac', () => {
    const onLane = plan.gravel.filter((g) => g.onLane);
    expect(onLane.length).toBeGreaterThan(40);
    for (const g of onLane) expect(net.onRoad('lane', g.x, g.z)).toBe(true);
    for (const g of onLane) expect(g.u - reach).toBeLessThan(ENTRANCE.splay);
  });
  it('lists every solid thing of the entrance with the farm\'s placements, and none breaks a rule', () => {
    const things = farmPlacements(LAYOUT).filter((t) => /pit's lane gate/.test(t.name));
    const names = new Set(things.map((t) => t.name));
    for (const n of ['a post of the pit\'s lane gate', 'a concrete block at the pit\'s lane gate', 'a post of the height barrier at the pit\'s lane gate', 'a post of the works sign at the pit\'s lane gate', 'the hedge at the pit\'s lane gate', 'a buddleia at the pit\'s lane gate']) {
      expect(names.has(n), n).toBe(true);
    }
    const ctx = placementContext(LAYOUT);
    const broken = things.flatMap((t) => placementBreaks(t, LAYOUT, ctx).map((b) => `${t.name}: ${b.rule} ${b.why}`));
    expect(broken).toEqual([]);
  });
  it('has the signs in British wording, with no real firm\'s name, and the old American one gone from the pit', () => {
    expect(SIGN_WORDS.operator).toBe('THORNBY SAND & GRAVEL LTD');
    expect(SIGN_WORDS.board).toEqual(['WORKS ENTRANCE', 'NO TIPPING']);
    expect(SIGN_WORDS.plate).toEqual(['PRIVATE LAND', 'NO ACCESS']);
    const src = path.resolve(__dirname, '../src');
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    const hits = walk(src).filter((p) => /\.js$/.test(p) && /TRESPASS/i.test(fs.readFileSync(p, 'utf8')));
    expect(hits).toEqual([]);
  });
});

describe('the spoil bank', () => {
  const quarries = [1, 3, 77, 1234, 9001].map((seed) => createQuarry(dealtLayout(LAYOUT, seed)));
  const crest = (q, v) => {
    let m = 0;
    for (let u = -24; u <= 0; u += 0.5) {
      const p = f.at(u, v);
      m = Math.max(m, q.bankAt(p.x, p.z));
    }
    return m;
  };
  it('stands about 4 m high along the lane side, 50 to 60 m from end to end', () => {
    for (const q of quarries) {
      const along = [];
      for (let v = -35; v <= 35; v += 0.5) along.push([v, crest(q, v)]);
      const high = Math.max(...along.map(([, h]) => h));
      expect(high).toBeGreaterThan(3.6);
      expect(high).toBeLessThan(4.6);
      const standing = along.filter(([, h]) => h > 0.05).map(([v]) => v);
      const length = Math.max(...standing) - Math.min(...standing);
      expect(length).toBeGreaterThanOrEqual(50);
      expect(length).toBeLessThanOrEqual(60);
    }
  });
  it('leaves a gap where the haul road comes out, however the farm\'s seed bends the road', () => {
    for (const q of quarries) {
      for (const p of q.roadPoints.filter((r) => r.t === 0)) expect(q.bankAt(p.x, p.z)).toBe(0);
      const gapped = [];
      for (let v = -20; v <= 20; v += 0.5) if (crest(q, v) < 0.3) gapped.push(v);
      expect(gapped.length * 0.5).toBeGreaterThan(6); // a gap a lorry could come through
    }
  });
  it('stays inside the fence, off the bellmouth, the lane and its verge, and clear of the pit\'s lip and its fence', () => {
    for (const q of quarries) {
      for (let v = -40; v <= 40; v += 1) {
        for (const u of [-2.9, -1, 0, 3, 10, reach, reach + 2.6]) {
          const p = f.at(u, v);
          expect(q.bankAt(p.x, p.z)).toBe(0);
        }
      }
      for (let i = 0; i < 90; i++) {
        const a = (i / 90) * Math.PI * 2;
        const p = q.frameAt(a, q.rimAt(a) + 12); // the lip fence, the dead trees and the scrub along the lip
        expect(q.bankAt(p.x, p.z)).toBe(0);
      }
    }
  });
  it('buries nothing the farm places: nothing solid stands where it rises', () => {
    const q = createQuarry(LAYOUT);
    const buried = farmPlacements(LAYOUT).filter((t) => t.solid && t.corners.some(([x, z]) => q.bankAt(x, z) > 0.05));
    expect(buried.map((t) => t.name)).toEqual([]);
  });
  it('has no step in it: along it every 5 cm it rises or falls no faster than its own flanks, through the gap and past the haul road\'s search box', () => {
    for (const q of quarries) {
      let worst = 0;
      for (let u = -18; u <= -8; u += 1) {
        let last = null;
        for (let v = -30; v <= 30; v += 0.05) {
          const p = f.at(u, v);
          const h = q.bankAt(p.x, p.z);
          if (last !== null) worst = Math.max(worst, Math.abs(h - last));
          last = h;
        }
      }
      expect(worst).toBeLessThan(0.08); // its steepest flank is about 1 in 1; the old search-box edge stepped 13 to 21 cm
    }
  });
  it('is nothing on a farm without a lane gate, and nothing outside its own box', () => {
    const bank = spoilBankOf(gate);
    expect(bankRise(null, gate.x, gate.z, () => 100, 2.7)).toBe(0);
    expect(bankRise(bank, bank.box.maxX + 1, gate.z, () => 100, 2.7)).toBe(0);
  });
});

describe('the lane entrance as a model', () => {
  let group;
  let boxes;
  let heights;
  beforeAll(async () => {
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => new Proxy({}, { get: (t, k) => (k === 'measureText' ? (s) => ({ width: String(s).length * 10 }) : () => ({ addColorStop() {} })) }), width: 0, height: 0 }) });
    const { buildPitEntrance } = await import('../src/world/quarryProps.js');
    boxes = [];
    const c = { ...headlessContext(), scene: new THREE.Scene(), fixedBox: (...b) => boxes.push(b) };
    heights = c.heights;
    group = buildPitEntrance(c);
  });
  it('is one set piece named for the far detail, with each of its parts', () => {
    expect(group.name).toBe('pitEntrance');
    expect(SET_PIECE_NAMES).toContain('pitEntrance');
    for (const name of ['bellmouth', 'pitEntrancePuddles', 'pitEntranceChippings', 'buddleia', 'litter', 'pitEntranceParts', 'pitEntrance-nettle', 'pitEntrance-dock', 'pitEntrance-parsley']) {
      expect(group.getObjectByName(name), name).toBeTruthy();
    }
    expect(group.userData.hedge?.isObject3D).toBe(true);
  });
  it('swaps its hedge for plain strips far off, as every other hedge, and builds it into the farm\'s hedge swaps', () => {
    expect(group.userData.hedgeSwap?.tiles.size).toBeGreaterThan(0);
    const src = fs.readFileSync(path.resolve(__dirname, '../src/world/props.js'), 'utf8');
    expect(src).toMatch(/hedgeSwaps: \[[^\]]*pitEntrance\?\.userData\.hedgeSwap/);
  });
  it('makes the barrier\'s beam solid at its height, over a 2.1 m clearance', () => {
    const beam = boxes.find(([, , , , hy, hz]) => hy === ENTRANCE.barrier.beam / 2 && hz === 0.06);
    expect(beam).toBeTruthy();
    expect(beam[3]).toBeGreaterThan(plan.barrier.span);
    const mid = f.at(ENTRANCE.barrier.u, 0);
    expect(beam[1] - beam[4] - heights.heightAt(mid.x, mid.z)).toBeGreaterThanOrEqual(ENTRANCE.barrier.clear - 0.01);
  });
  it('keeps #685\'s collider for the gate as it was: 0.4 m through, 1.8 m high, across the whole gap', () => {
    const g = boxes.find(([x, , z, hx, hy, hz]) => x === gate.x && z === gate.z && hx === 0.2 && hy === 0.9);
    expect(g).toBeTruthy();
    expect(g[5]).toBeCloseTo((gate.width - 0.4) / 2 + 0.3);
    expect(g[6]).toBeCloseTo(0);
  });
  it('lights everything by the world: nothing glows, and every big surface is textured', () => {
    const mats = new Set();
    group.traverse((o) => o.isMesh && mats.add(o.material)); // (the hedge is the farm's hedge model, lit as every hedge is)
    for (const m of mats) {
      expect(m.isMeshStandardMaterial || m.isMeshLambertMaterial, m.type).toBe(true);
      expect(m.emissive?.getHex() ?? 0).toBe(0);
    }
    const drape = group.getObjectByName('bellmouth');
    expect(drape.material.map).toBeTruthy();
  });
  it('gives the barrier\'s and the sign\'s reflective tape more back than white paint, and nothing that glows on its own', async () => {
    const { entranceMaterials, TAPE_GAIN } = await import('../src/world/entranceKit.js');
    const m = entranceMaterials(() => 0.5);
    for (const tape of [m.tape, m.tapeWhite]) {
      expect(tape.color.r).toBe(TAPE_GAIN);
      expect(TAPE_GAIN).toBeGreaterThan(1);
      expect(tape.emissive.getHex()).toBe(0);
    }
    const used = new Set();
    group.getObjectByName('pitEntranceParts').traverse((o) => o.isMesh && used.add(o.material));
    expect(used.has(m.tape) || [...used].some((x) => x.color?.r === TAPE_GAIN)).toBe(true);
  });
  it('fills the ruts\' puddles when the ground is wet and dries them when it is not, as the yard\'s', () => {
    const puddles = group.getObjectByName('pitEntrancePuddles');
    group.userData.setWet(1);
    expect(puddles.visible).toBe(true);
    expect(puddles.material.opacity).toBeGreaterThan(0.5);
    group.userData.setWet(0);
    expect(puddles.visible).toBe(false);
  });
  it('gives the chippings on the lane no collider: nothing solid stands on its tarmac', () => {
    for (const [x, , z] of boxes) expect(net.onRoad('lane', x, z), `${x}, ${z}`).toBe(false);
    expect(boxes.length).toBeGreaterThan(8); // the gate, two blocks, the barrier's and the sign's posts, the hedge
  });
  it('has no two faces fighting over a plane', () => {
    const parts = group.getObjectByName('pitEntranceParts');
    const fights = coplanarOverlaps(parts, { gap: 0.003, minArea: 2e-5, textured: true });
    expect(fights.map((x) => `${x.a}/${x.b} at plan (${f.toFrame(x.at[0], x.at[2]).u.toFixed(2)}, ${f.toFrame(x.at[0], x.at[2]).v.toFixed(2)}) y ${x.at[1].toFixed(2)} axis ${x.axis}`)).toEqual([]);
  });
  it('has none in the kit\'s pieces built square, the sign and the blocks too (the entrance turns them off the axes)', async () => {
    const { Parts } = await import('../src/world/parts.js');
    const kit = await import('../src/world/entranceKit.js');
    const mats = kit.entranceMaterials(() => 0.5);
    const p = new Parts();
    kit.addSignBoard(p, mats, new THREE.MeshStandardMaterial({ map: new THREE.Texture() }), ENTRANCE.sign, 0, 0.1);
    kit.addConcreteBlock(p, mats, 4, 0, 0, 0, 0);
    kit.addHeightBarrier(p, mats, 3, 0, 0.2);
    kit.addGatePost(p, mats, -4, 0, 0, 0);
    kit.addChainAndLock(p, mats, 0.92, 0.1);
    const fights = coplanarOverlaps(p.build(), { gap: 0.003, minArea: 2e-5, textured: true });
    expect(fights.map((x) => `${x.a}/${x.b} at ${x.at.map((n) => n.toFixed(2))} axis ${x.axis}`)).toEqual([]);
  });
});

// The gate in a real Rapier world with the pit's fence, the player's capsule walked at it from the lane every way round, as tests/hutEntry.test.js does.
const WALK = DEFAULT_PLAYER_PARAMS.walkSpeed;
const HALF_HEIGHT = 0.55;

describe('the lane gate still shut and solid, whichever way round you try', () => {
  let world;
  const build = async (skipGate = false) => {
    await RAPIER.init();
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => new Proxy({}, { get: (t, k) => (k === 'measureText' ? (s) => ({ width: String(s).length * 10 }) : () => ({ addColorStop() {} })) }), width: 0, height: 0 }) });
    world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(80, 0.5, 80).setTranslation(gate.x, -0.5, gate.z));
    const fixedBox = (x, y, z, hx, hy, hz, rotY = 0) => {
      if (skipGate && x === gate.x && z === gate.z && hx === 0.2) return null; // the throwaway: the gate's own collider left out
      return world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY)));
    };
    const { pitLaneGate } = await import('../src/world/props.js');
    const { buildPitBoundary } = await import('../src/world/quarryProps.js');
    const c = { ...headlessContext(), layout: LAYOUT, fields: createFields(LAYOUT), heights: { heightAt: () => 0 }, fixedBox, gateParams: { ...DEFAULT_GATE_PARAMS }, scene: new THREE.Scene() };
    const built = pitLaneGate(c);
    buildPitBoundary(c);
    world.step();
    return built;
  };
  const walk = (from, to, seconds = 16) => {
    const a = f.at(from[0], from[1]);
    const b = f.at(to[0], to[1]);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(a.x, 0.05 + HALF_HEIGHT + CAPSULE_RADIUS, a.z));
    const collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT, CAPSULE_RADIUS), body);
    const ctl = world.createCharacterController(0.03);
    ctl.setUp({ x: 0, y: 1, z: 0 });
    ctl.enableAutostep(0.35, 0.2, false);
    ctl.enableSnapToGround(0.4);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    let vy = 0;
    let grounded = false;
    for (let i = 0; i < seconds * 60; i++) {
      vy = grounded ? 0 : vy - DEFAULT_PLAYER_PARAMS.gravity / 60;
      ctl.computeColliderMovement(collider, { x: ((b.x - a.x) / len) * (WALK / 60), y: vy / 60, z: ((b.z - a.z) / len) * (WALK / 60) });
      const m = ctl.computedMovement();
      const t = body.translation();
      body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
      world.step();
      grounded = ctl.computedGrounded();
    }
    const end = body.translation();
    world.removeCharacterController(ctl);
    world.removeRigidBody(body);
    return f.toFrame(end.x, end.z);
  };
  // From the lane: straight at the gate, at each end of it by the posts, from the splay past each block, under the barrier, and along the fence's foot.
  const tries = [
    { name: 'straight at the gate', from: [12, 0], to: [-10, 0] },
    { name: 'at one post', from: [12, -2.4], to: [-10, -2.4] },
    { name: 'at the other post', from: [12, 2.4], to: [-10, 2.4] },
    { name: 'in through one side of the splay', from: [14, -7], to: [-8, -2] },
    { name: 'in through the other side of the splay', from: [14, 7], to: [-8, 2] },
    { name: 'past the near block', from: [6, 2.6], to: [-8, 0.3] },
    { name: 'past the far block, under the barrier', from: [13, -1], to: [-8, -1] },
    { name: 'along the fence\'s foot', from: [0.6, -12], to: [-3, 12] },
  ];
  it('is not a Gate: there is nothing to open', async () => {
    const built = await build();
    expect(built?.name).toBe('pitEntrance');
    expect(built.isOpen).toBeUndefined();
  });
  for (const t of tries) {
    it(`stops a walking player ${t.name}`, async () => {
      if (!world) await build();
      const end = walk(t.from, t.to);
      expect(end.u, `ended at u ${end.u.toFixed(2)}, v ${end.v.toFixed(2)}`).toBeGreaterThan(0); // still on the lane's side of the fence
    });
  }
  it('lets the player through with the gate\'s collider taken out, so the test can fail', async () => {
    await build(true);
    const end = walk([12, 0], [-10, 0]);
    expect(end.u).toBeLessThan(0);
  });
});
