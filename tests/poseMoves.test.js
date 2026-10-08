import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  BONES, MOVES, SEAT_POSES, STANDING_IDLES, EMPTY_POSE, DEFAULT_IDLE_POSE_PARAMS,
  mirrorPose, addPose, sampleMove, shareOf, idlePose, StandingIdles,
} from '../src/npc/poseMoves.js';
import { moveMethods, DEFAULT_MOVE_PARAMS } from '../src/npc/companionMoves.js';
import { CHARACTERS } from '../src/npc/characters.js';

const FRAMES = ['hips', 'chest', 'seat'];

/** Every pose the module defines, with where it came from. */
function allPoses() {
  const out = [];
  for (const [name, move] of Object.entries(MOVES)) move.keys.forEach((k, i) => k.pose && out.push([`${name} key ${i}`, k.pose]));
  for (const [name, pose] of Object.entries(SEAT_POSES)) out.push([`seat ${name}`, pose]);
  for (const [name, idle] of Object.entries(STANDING_IDLES)) {
    out.push([`idle ${name}`, idle.hold]);
    if (idle.wave) out.push([`idle ${name} wave`, { bones: idle.wave.bones }]);
  }
  return out;
}

describe('pose data', () => {
  it('only turns bones the rig knows, and puts hands in frames it knows', () => {
    for (const [where, pose] of allPoses()) {
      for (const bone of Object.keys(pose.bones ?? {})) expect(BONES, where).toContain(bone);
      for (const [side, h] of Object.entries(pose.hands ?? {})) {
        expect(['left', 'right'], where).toContain(side);
        expect(FRAMES, where).toContain(h.frame);
        expect(h.at).toHaveLength(3);
        expect(h.pole).toHaveLength(3);
        if (h.fingers) expect(h.palm, where).toHaveLength(3);
      }
    }
  });

  it('runs every move from stood (all nothing) to sat (over, sat and facing the seat), with no lift left at either end', () => {
    for (const [name, move] of Object.entries(MOVES)) {
      const keys = move.keys;
      expect(keys[0].t, name).toBe(0);
      expect(keys.at(-1).t, name).toBe(1);
      for (let i = 1; i < keys.length; i++) expect(keys[i].t, name).toBeGreaterThan(keys[i - 1].t);
      const start = sampleMove(move, 0);
      const end = sampleMove(move, 1);
      for (const k of ['over', 'along', 'lift', 'sit', 'turn', 'twist', 'spread']) expect(start[k], `${name} ${k}`).toBe(0);
      expect(end.over).toBe(1);
      expect(end.sit).toBe(1);
      expect(end.turn).toBe(1);
      expect(end.lift).toBe(0);
      expect(end.twist).toBe(0);
      expect(Object.values(end.pose.bones).flat().every((v) => v === 0), name).toBe(true);
      expect(DEFAULT_MOVE_PARAMS[`${move.liftFrom}Lift`], name).toBeGreaterThan(0);
    }
  });

  it("never takes her hips back the way they came or unsits her on the way on", () => {
    for (const [name, move] of Object.entries(MOVES)) {
      let last = sampleMove(move, 0);
      for (let t = 0.01; t <= 1; t += 0.01) {
        const f = sampleMove(move, t);
        expect(f.over, name).toBeGreaterThanOrEqual(last.over - 1e-9);
        expect(f.sit, name).toBeGreaterThanOrEqual(last.sit - 1e-9);
        last = f;
      }
    }
  });

  it('gives each girl ways of standing about that exist', () => {
    for (const c of CHARACTERS) {
      expect(c.idles.length, c.id).toBeGreaterThan(1);
      for (const n of c.idles) expect(STANDING_IDLES[n], `${c.id} ${n}`).toBeDefined();
    }
  });
});

describe('mirrorPose', () => {
  it('swaps left and right, turns about up and forward the other way, and moves hands across', () => {
    const m = mirrorPose({
      bones: { LeftUpLeg: [0.1, 0.2, 0.3], Spine: [0.4, 0.5, 0.6] },
      hands: { left: { frame: 'seat', at: [0.2, 0.1, 0.3], pole: [0.5, 0, 0], fingers: [1, 0, 0], palm: [0, 1, 0], w: 0.5 } },
    });
    expect(m.bones.RightUpLeg).toEqual([0.1, -0.2, -0.3]);
    expect(m.bones.Spine).toEqual([0.4, -0.5, -0.6]);
    expect(m.bones.LeftUpLeg).toBeUndefined();
    expect(m.hands.right).toEqual({ frame: 'seat', at: [-0.2, 0.1, 0.3], pole: [-0.5, 0, 0], fingers: [-1, 0, 0], palm: [-0, 1, 0], w: 0.5 });
    expect(m.hands.left).toBeUndefined();
  });

  it('mirrors a move sampled from the right', () => {
    const left = sampleMove(MOVES.legOver, 0.6, 1);
    const right = sampleMove(MOVES.legOver, 0.6, -1);
    expect(right.over).toBe(left.over);
    expect(right.pose.bones.LeftUpLeg[2]).toBeCloseTo(-left.pose.bones.RightUpLeg[2]);
    expect(right.pose.hands.left.at[0]).toBeCloseTo(-left.pose.hands.right.at[0]);
  });
});

describe('addPose and sampling', () => {
  it('adds bone turns by weight and keeps the first pose’s hands', () => {
    const a = { bones: { Spine: [0.1, 0, 0] }, hands: { left: { frame: 'hips', at: [0, 0, 0], pole: [1, 0, 0], w: 1 } } };
    const b = { bones: { Spine: [0.2, 0, 0], Head: [0, 0.4, 0] }, hands: { left: { frame: 'chest', at: [1, 1, 1], pole: [1, 0, 0], w: 1 }, right: { frame: 'chest', at: [1, 1, 1], pole: [1, 0, 0], w: 1 } } };
    const sum = addPose(a, b, 0.5);
    expect(sum.bones.Spine[0]).toBeCloseTo(0.2);
    expect(sum.bones.Head[1]).toBeCloseTo(0.2);
    expect(sum.hands.left.frame).toBe('hips');
    expect(sum.hands.right.w).toBeCloseTo(0.5);
  });

  it('eases between keys, landing on each key at its time', () => {
    const key = MOVES.legOver.keys[2];
    const f = sampleMove(MOVES.legOver, key.t);
    expect(f.over).toBeCloseTo(key.over);
    expect(f.pose.bones.RightUpLeg[2]).toBeCloseTo(key.pose.bones.RightUpLeg[2]);
    const mid = sampleMove(MOVES.legOver, (key.t + MOVES.legOver.keys[3].t) / 2);
    expect(mid.over).toBeCloseTo((key.over + MOVES.legOver.keys[3].over) / 2);
  });

  it('fades a hand in where it will be, rather than from nowhere', () => {
    const k1 = MOVES.legOver.keys[1];
    const f = sampleMove(MOVES.legOver, k1.t / 2);
    expect(f.pose.hands.right.at).toEqual(k1.pose.hands.right.at);
    expect(f.pose.hands.right.w).toBeGreaterThan(0);
    expect(f.pose.hands.right.w).toBeLessThan(k1.pose.hands.right.w);
  });

  it('shareOf is the share of a part-done span, and nothing when there was no span', () => {
    expect(shareOf(0.25, 0.5)).toBe(0.5);
    expect(shareOf(0.5, 0)).toBe(0);
    expect(shareOf(1, 0.5)).toBe(1);
  });
});

describe('StandingIdles', () => {
  const params = { ...DEFAULT_IDLE_POSE_PARAMS, idlePoseGapMin: 1, idlePoseGapMax: 1, idlePoseHoldMin: 3, idlePoseHoldMax: 3, idlePoseBlend: 0.5 };
  const run = (s, seconds, standing = true) => {
    let pose;
    for (let t = 0; t < seconds; t += 0.05) pose = s.update(0.05, standing);
    return pose;
  };

  it('waits, eases into one of her ways of standing, holds it, and eases out again', () => {
    const s = new StandingIdles(['hips', 'rock'], params, () => 0.3);
    expect(run(s, 0.9)).toBe(EMPTY_POSE);
    run(s, 0.8);
    expect(s.name).toBe('hips');
    expect(s.weight).toBe(1);
    run(s, 2.4);
    expect(s.weight).toBeLessThan(1);
    expect(s.weight).toBeGreaterThan(0);
    run(s, 0.6);
    expect(s.name).toBe(null);
  });

  it("doesn't do the same one twice running", () => {
    const s = new StandingIdles(['hips', 'rock'], params, () => 0);
    const seen = [];
    for (let t = 0; t < 20; t += 0.05) {
      s.update(0.05, true);
      if (s.name && s.name !== seen.at(-1)) seen.push(s.name);
    }
    expect(seen.slice(0, 4)).toEqual(['hips', 'rock', 'hips', 'rock']);
  });

  it('lets go quickly when she does something else, and waits a gap before the next', () => {
    const s = new StandingIdles(['folded'], params, () => 0.5);
    run(s, 2);
    expect(s.weight).toBe(1);
    run(s, 0.3, false);
    expect(s.name).toBe(null);
    expect(run(s, 0.5)).toBe(EMPTY_POSE);
  });

  it('keeps a quick one (a stretch) short', () => {
    const s = new StandingIdles(['stretch'], { ...params, idlePoseShortHold: 1 }, () => 0.5);
    run(s, 1.1);
    expect(s.name).toBe('stretch');
    run(s, 1.6);
    expect(s.name).toBe(null);
  });

  it('idlePose swings a wave about its hold', () => {
    const a = idlePose('rock', 0);
    const b = idlePose('rock', STANDING_IDLES.rock.wave.period / 4);
    expect(a.bones.Hips?.[0] ?? 0).toBeCloseTo(0);
    expect(b.bones.Hips[0]).toBeCloseTo(STANDING_IDLES.rock.wave.bones.Hips[0]);
    expect(idlePose('nonsense', 1)).toBe(EMPTY_POSE);
  });
});

describe('the move runner', () => {
  // A stand-in companion: her root in the world, where her hips are stood and sat, and a rig that only takes the clip blend.
  function girl(at, heading) {
    const g = {};
    Object.defineProperties(g, Object.getOwnPropertyDescriptors(moveMethods));
    Object.assign(g, {
      root: new THREE.Object3D(),
      heading,
      standHips: new THREE.Vector3(0, 0.85, 0),
      sitHips: new THREE.Vector3(0, 0.45, -0.1),
      moveParams: { ...DEFAULT_MOVE_PARAMS },
      rig: { mix: (a, b, w) => (g.sitWeight = w), poseSeat: null },
    });
    g.root.position.copy(at);
    g.root.rotation.y = heading;
    return g;
  }
  const seatEnd = () => ({ root: new THREE.Vector3(0, 0.55, -0.6), heading: 0 });
  const stand = { position: new THREE.Vector3(0.9, 0, -0.2), facing: -Math.PI / 2 };
  const hipsOf = (g, sit) => g.standHips.clone().lerp(g.sitHips, sit).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.heading).add(g.root.position);
  const runTo = (g, seconds) => {
    let done = false;
    for (let t = 0; t < seconds && !done; t += 1 / 30) done = g.stepMove(1 / 30);
    return done;
  };

  it('takes her from where she stood to sat on the seat, facing its way', () => {
    const g = girl(new THREE.Vector3(0.85, 0, -0.2), 0.3);
    g.beginMove({ kind: 'legOver', side: 1, dir: 1, duration: 1.8, seat: null, seatEnd, standEnd: () => stand });
    expect(runTo(g, 2)).toBe(true);
    expect(g.root.position.distanceTo(seatEnd().root)).toBeLessThan(1e-6);
    expect(g.heading).toBeCloseTo(0);
    expect(g.sitWeight).toBe(1);
  });

  it('keeps her over the footboard until her leg is over, then back onto the seat', () => {
    const g = girl(new THREE.Vector3(0.85, 0, -0.2), 0);
    g.beginMove({ kind: 'legOver', side: 1, dir: 1, duration: 1, seat: null, seatEnd, standEnd: () => stand });
    runTo(g, 0.4);
    const hips = hipsOf(g, g.moveFrame.sit);
    expect(hips.z).toBeCloseTo(-0.2, 1); // still beside the footboard, while she's gone a quarter of the way across
    expect(hips.x).toBeLessThan(0.85 - 0.1);
  });

  it('gets her off and stood where she steps down, facing the way she stands', () => {
    const g = girl(seatEnd().root, 0);
    g.beginMove({ kind: 'legOver', side: 1, dir: -1, duration: 1.4, seat: null, seatEnd, standEnd: () => stand });
    expect(runTo(g, 1.5)).toBe(true);
    expect(g.root.position.distanceTo(stand.position)).toBeLessThan(1e-6);
    expect(Math.cos(g.heading - stand.facing)).toBeCloseTo(1);
    expect(g.sitWeight).toBe(0);
  });

  it('runs a part-done climb on back from where she got to, without a jump', () => {
    const g = girl(new THREE.Vector3(0.85, 0, -0.2), 0);
    g.beginMove({ kind: 'legOver', side: 1, dir: 1, duration: 1.8, seat: null, seatEnd, standEnd: () => stand });
    runTo(g, 1.0);
    const k = g.moveK;
    expect(k).toBeGreaterThan(0.3);
    const before = hipsOf(g, g.moveFrame.sit);
    const heading = g.heading;
    g.beginMove({ kind: 'legOver', side: 1, dir: -1, from: k, duration: 1.4, seat: null, seatEnd, standEnd: () => stand });
    g.stepMove(1e-4);
    expect(hipsOf(g, g.moveFrame.sit).distanceTo(before)).toBeLessThan(0.01);
    expect(Math.cos(g.heading - heading)).toBeCloseTo(1, 3);
    expect(runTo(g, 2)).toBe(true);
    expect(g.root.position.distanceTo(stand.position)).toBeLessThan(1e-6);
  });

  it('turns her away from the seat on the way when there is somewhere to twist to, and back by the end', () => {
    const g = girl(new THREE.Vector3(0.85, 0, -0.2), 0);
    g.beginMove({ kind: 'hopOn', side: 1, dir: 1, duration: 1.8, seat: null, seatEnd, standEnd: () => stand, twistTo: Math.PI / 2 });
    runTo(g, 0.55);
    expect(g.heading).toBeGreaterThan(1.2);
    runTo(g, 2);
    expect(g.heading).toBeCloseTo(0);
  });
});
