import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildAllGirls } from './helpers/girlModels.js';
import { dealPonytail, BAND_COLOURS, tailRadius, tailPath, buildTail, swingStep, STILL, TAIL, DEFAULT_PONYTAIL_PARAMS, PONYTAIL_PARAM_RANGES, hangShare, bendTail, tipIntoHead } from '../src/npc/ponytail.js';
import { completeStyle, describeOutfit } from '../src/npc/outfits.js';
import { CHARACTERS } from '../src/npc/characters.js';
import { createRandom } from '../src/core/random.js';

const girl = (id) => CHARACTERS.find((c) => c.id === id);

describe('dealing a ponytail', () => {
  it('ties Amy\'s hair back about a third of the time and Jess\'s about one day in seven', () => {
    const share = (id) => {
      const random = createRandom(11);
      let n = 0;
      for (let i = 0; i < 4000; i++) if (dealPonytail(random, girl(id).ponytailChance).ponytail) n++;
      return n / 4000;
    };
    expect(share('amy')).toBeCloseTo(0.35, 1);
    expect(share('jess')).toBeCloseTo(0.15, 1);
  });

  it('draws the same randoms whatever the chance, so one girl\'s deal never moves the other\'s', () => {
    for (const chance of [0, 0.35, 1]) {
      const a = createRandom(5);
      dealPonytail(a, chance);
      const b = createRandom(5);
      b();
      b();
      expect(a()).toBe(b());
    }
  });

  it('mostly gives a black band, now and then a colour', () => {
    const random = createRandom(3);
    let black = 0;
    for (let i = 0; i < 3000; i++) {
      const { band } = dealPonytail(random, 1);
      expect(BAND_COLOURS).toContain(band);
      if (band === '#151515') black++;
    }
    expect(black / 3000).toBeGreaterThan(0.4);
    expect(black / 3000).toBeLessThan(0.65);
  });

  it('is off unless dealt, and the panel and console say when it is on', () => {
    expect(completeStyle({}).ponytail).toBe(false);
    expect(describeOutfit({ kind: 'polo' })).toBe('her polo');
    expect(describeOutfit({ kind: 'polo', ponytail: true })).toBe('her polo, her hair in a ponytail');
  });
});

describe('the tail\'s shape', () => {
  it('is gathered thin under the band, thick just past it and tapers to a thin end', () => {
    expect(tailRadius(0)).toBeCloseTo(TAIL.gathered, 4);
    expect(tailRadius(0.16)).toBeCloseTo(TAIL.full, 4);
    expect(tailRadius(1)).toBeCloseTo(TAIL.end, 4);
    for (let u = 0.2; u < 0.95; u += 0.1) expect(tailRadius(u + 0.05)).toBeLessThan(tailRadius(u));
    expect(tailRadius(1.02)).toBeCloseTo(TAIL.end, 4);
  });

  it('keeps most of its thickness half way down, thinning near its end (#1243)', () => {
    expect(TAIL.full).toBeGreaterThanOrEqual(0.03);
    expect(tailRadius(0.58)).toBeGreaterThan(TAIL.full * 0.65);
    expect(tailRadius(0.9)).toBeLessThan(TAIL.full * 0.5);
  });

  it('rises back out of the band before it falls, and ends the drop below it', () => {
    const path = tailPath(0.3);
    expect(Math.max(...path.map((p) => p[1]))).toBeGreaterThan(0.004);
    expect(path[3][2]).toBeGreaterThan(0);
    expect(path.at(-1)[1]).toBeCloseTo(-0.3, 5);
  });

  it('lies on her back rather than through it', () => {
    // A back 3 cm behind the band from 6 cm down, leaning out further lower down.
    const backAt = (d) => (d < 0.06 ? null : 0.03 + 0.1 * (d - 0.06));
    const path = tailPath(0.3, backAt);
    path.forEach(([, y, z], i) => {
      const b = backAt(-y);
      if (b != null) expect(z).toBeGreaterThanOrEqual(b + tailRadius(i / TAIL.rings) * TAIL.deep + TAIL.clear - 1e-9);
    });
    // And without one in the way, it hangs close in: no further back than where it leaves the band.
    expect(tailPath(0.3).at(-1)[2]).toBeLessThan(0.01);
  });

  it('builds the tail, its wisps and a band round it from closed tubes', () => {
    const { hair, band } = buildTail(0.3, () => null);
    for (const part of [hair, band]) {
      expect(part.points.length).toBe(part.shade.length);
      for (const t of part.tris) for (const i of t) expect(i).toBeLessThan(part.points.length);
      for (const p of part.points) for (const x of p) expect(Number.isFinite(x)).toBe(true);
    }
    // The wisps run on past the end of the tail.
    expect(Math.min(...hair.points.map((p) => p[1]))).toBeLessThan(-0.31);
    // The band sits within a few centimetres of where the tail leaves her head, and fits round it there.
    expect(Math.max(...band.points.map((p) => Math.hypot(...p)))).toBeLessThan(0.04);
    expect(Math.max(...band.points.map((p) => Math.abs(p[0])))).toBeGreaterThan(tailRadius(0.03) * TAIL.wide);
  });
});

describe('the tail bent to hang (#1243)', () => {
  it('keeps the band, the lift and its first centimetre on her head, and hangs from her chest lower down', () => {
    expect(hangShare(0.03)).toBe(0);
    expect(hangShare(0)).toBe(0);
    expect(hangShare(-TAIL.bendFrom)).toBe(0);
    expect(hangShare(-TAIL.bendTo)).toBe(1);
    expect(hangShare(-0.3)).toBe(1);
    expect(hangShare(-0.03)).toBeGreaterThan(0);
    expect(hangShare(-0.03)).toBeLessThan(1);
  });

  it('lets it tip in towards her head no further than intoHead, and out from it as far as it likes', () => {
    const about = (a) => {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
      return [q.x, q.y, q.z, q.w];
    };
    expect(tipIntoHead(about(0))).toBe(0);
    expect(tipIntoHead(about(-0.6))).toBe(0); // out behind her
    expect(tipIntoHead(about(TAIL.intoHead * 0.9))).toBe(0);
    expect(tipIntoHead(about(0.5))).toBeCloseTo(0.5 - TAIL.intoHead, 6); // her head down: in towards it
  });

  it('turns each point as far as its share, and keeps normals a unit long', () => {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    const rest = [0, 0, 0.1, 0, -0.2, 0.1, 0, -0.1, 0.1];
    const out = bendTail(rest, [0, 1, 0.5], [q.x, q.y, q.z, q.w], new Array(9));
    expect(out.slice(0, 3)).toEqual([0, 0, 0.1]);
    const turned = new THREE.Vector3(0, -0.2, 0.1).applyQuaternion(q);
    out.slice(3, 6).forEach((v, k) => expect(v).toBeCloseTo(turned.getComponent(k), 6));
    const n = bendTail([0, 0, 1], [0.5], [q.x, q.y, q.z, q.w], new Array(3), true);
    expect(Math.hypot(...n)).toBeCloseTo(1, 6);
  });
});

describe('the swing', () => {
  const run = (accel, seconds, s = { ...STILL }, p = DEFAULT_PONYTAIL_PARAMS) => {
    for (let t = 0; t < seconds; t += 1 / 60) s = swingStep(s, accel, 1 / 60, p);
    return s;
  };

  it('swings out behind her when her head is thrown forward, and settles once she is still', () => {
    const thrown = run([0, -6], 0.15);
    expect(thrown.pitch).toBeGreaterThan(0.02);
    const settled = run([0, 0], 4, thrown);
    expect(Math.abs(settled.pitch)).toBeLessThan(0.005);
    expect(Math.abs(settled.vPitch)).toBeLessThan(0.01);
  });

  it('swings to the side away from a sideways jolt', () => {
    expect(run([5, 0], 0.15).roll).toBeLessThan(-0.02);
    expect(run([-5, 0], 0.15).roll).toBeGreaterThan(0.02);
  });

  it('stops against her back, and never swings past its limit', () => {
    const into = run([0, 30], 1);
    expect(into.pitch).toBeGreaterThanOrEqual(-DEFAULT_PONYTAIL_PARAMS.intoBack - 1e-9);
    const out = run([0, -200], 1);
    expect(out.pitch).toBeLessThanOrEqual(DEFAULT_PONYTAIL_PARAMS.maxSwing + 1e-9);
    expect(Math.abs(run([200, 0], 1).roll)).toBeLessThanOrEqual(DEFAULT_PONYTAIL_PARAMS.maxSwing + 1e-9);
  });

  it('stays steady on a long frame', () => {
    const s = swingStep({ ...STILL, pitch: 0.3 }, [0, 0], 0.5);
    expect(Number.isFinite(s.pitch)).toBe(true);
    expect(Math.abs(s.pitch)).toBeLessThan(0.6);
  });

  it('has a range for every tunable', () => {
    for (const [k, v] of Object.entries(DEFAULT_PONYTAIL_PARAMS)) {
      const [lo, hi] = PONYTAIL_PARAM_RANGES[k];
      expect(v).toBeGreaterThanOrEqual(lo);
      expect(v).toBeLessThanOrEqual(hi);
    }
  });
});

describe('her hair tied back as she turns her head (#1243)', () => {
  // Built with her texture's real paint, so her hair is found and pulled in as the game does it.
  let girls;
  beforeAll(async () => {
    girls = await buildAllGirls({ paint: true });
  }, 120000);

  // Each tied-back hair point, and the band, in her head bone's frame: on her head they stay put however it turns.
  const onHead = (rig) => {
    rig.root.updateMatrixWorld(true);
    const into = rig.bones.Head.matrixWorld.clone().invert();
    const out = [];
    for (const { mesh, points } of rig.hairTied) {
      mesh.skeleton.update();
      const p = new THREE.Vector3();
      for (const i of points) {
        mesh.getVertexPosition(i, p);
        out.push(p.applyMatrix4(mesh.matrixWorld).applyMatrix4(into).clone());
      }
    }
    out.push(rig.ponytail.pivot.getWorldPosition(new THREE.Vector3()).applyMatrix4(into));
    return out;
  };
  // Turned as the rig turns her head to look (characterRig.js applyLook): the neck takes 0.4 of it and the head 0.6.
  const turn = (rig, yaw, nod) => {
    rig.rotateAboutRootAxis(rig.bones.Neck, new THREE.Vector3(0, 1, 0), yaw * 0.4);
    rig.rotateAboutRootAxis(rig.bones.Head, new THREE.Vector3(0, 1, 0), yaw * 0.6);
    rig.rotateAboutRootAxis(rig.bones.Neck, new THREE.Vector3(1, 0, 0), nod * 0.4);
    rig.rotateAboutRootAxis(rig.bones.Head, new THREE.Vector3(1, 0, 0), nod * 0.6);
  };

  it('puts each tied-back point where it was aimed, on her scalp', async () => {
    const { refitOutfit, OUTFITS } = await import('../src/npc/outfit.js');
    for (const { id, rig } of girls) {
      const base = OUTFITS[CHARACTERS.find((c) => c.id === id).params.outfit];
      refitOutfit(rig, { ...base, style: { ...base.style, ponytail: true } });
      rig.root.updateMatrixWorld(true);
      const toRoot = rig.root.matrixWorld.clone().invert();
      let worst = 0;
      for (const { mesh, points, aimed } of rig.hairTied) {
        mesh.skeleton.update();
        const p = new THREE.Vector3();
        points.forEach((i, k) => {
          mesh.getVertexPosition(i, p).applyMatrix4(mesh.matrixWorld).applyMatrix4(toRoot);
          worst = Math.max(worst, p.distanceTo(new THREE.Vector3(...aimed[k])));
        });
      }
      expect(worst, id).toBeLessThan(0.001);
      refitOutfit(rig, base);
    }
  }, 120000);

  // Her skull and tied-back hair (every point of hers wholly on her head bone) in the head bone's frame, and how deep a point is inside
  // it: from their middle, against the radius of the one of them most nearly the same way.
  const skull = (rig) => {
    const into = rig.bones.Head.matrixWorld.clone().invert();
    const pts = [];
    rig.model.traverse((o) => {
      if (!o.isSkinnedMesh || rig.outfitParts.includes(o)) return;
      const head = o.skeleton.bones.findIndex((bone) => bone.name === 'Head');
      const { skinIndex, skinWeight, position } = o.geometry.attributes;
      const p = new THREE.Vector3();
      for (let i = 0; i < position.count; i++) {
        let w = 0;
        for (let k = 0; k < 4; k++) if (skinIndex.getComponent(i, k) === head) w += skinWeight.getComponent(i, k);
        if (w > 0.99) pts.push(o.getVertexPosition(i, p).applyMatrix4(o.matrixWorld).applyMatrix4(into).clone());
      }
    });
    const mid = pts.reduce((a, q) => a.add(q), new THREE.Vector3()).divideScalar(pts.length);
    const dirs = pts.map((q) => q.clone().sub(mid));
    const radii = dirs.map((d) => d.length());
    dirs.forEach((d) => d.normalize());
    return (q) => {
      const d = q.clone().sub(mid);
      const r = d.length();
      d.normalize();
      let best = -2;
      let at = 0;
      dirs.forEach((u, k) => {
        const c = u.dot(d);
        if (c > best) [best, at] = [c, k];
      });
      return radii[at] - r;
    };
  };
  // The band and the tail within 8 cm of it, as drawn, in the head bone's frame.
  const nearBand = (rig) => {
    const into = rig.bones.Head.matrixWorld.clone().invert();
    const band = rig.ponytail.pivot.getWorldPosition(new THREE.Vector3());
    const out = [];
    rig.ponytail.pivot.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      const p = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        if (p.distanceTo(band) < 0.08) out.push(p.clone().applyMatrix4(into));
      }
    });
    return out;
  };

  it('keeps the band and the root of the tail out of her skull as she turns her head and the tail hangs', async () => {
    const { refitOutfit, OUTFITS } = await import('../src/npc/outfit.js');
    for (const { id, rig } of girls) {
      const base = OUTFITS[CHARACTERS.find((c) => c.id === id).params.outfit];
      refitOutfit(rig, { ...base, style: { ...base.style, ponytail: true } });
      rig.root.updateMatrixWorld(true);
      const depth = skull(rig);
      const kept = [rig.bones.Neck.quaternion.clone(), rig.bones.Head.quaternion.clone()];
      for (const [yaw, nod] of [[0, 0], [Math.PI / 6, 0], [Math.PI / 3, 0], [-Math.PI / 3, 0], [0, 0.5], [Math.PI / 3, -0.3]]) {
        turn(rig, yaw, nod);
        for (let f = 0; f < 3; f++) rig.ponytail.swing.update(1 / 60); // as the rig runs it, after her head has turned
        rig.root.updateMatrixWorld(true);
        const worst = Math.max(...nearBand(rig).map(depth));
        expect(worst, `${id} turned ${yaw.toFixed(2)}, nodding ${nod}: metres inside her head`).toBeLessThan(0.003);
        rig.bones.Neck.quaternion.copy(kept[0]);
        rig.bones.Head.quaternion.copy(kept[1]);
      }
      refitOutfit(rig, base);
    }
  }, 120000);

  it('moves none of it off her head when she turns her head 60 degrees or nods', async () => {
    const { refitOutfit, OUTFITS } = await import('../src/npc/outfit.js');
    for (const { id, rig } of girls) {
      const { params } = CHARACTERS.find((c) => c.id === id);
      const base = OUTFITS[params.outfit];
      refitOutfit(rig, { ...base, style: { ...base.style, ponytail: true } });
      expect(rig.hairTied.length, id).toBeGreaterThan(0);
      const rest = onHead(rig);
      const kept = [rig.bones.Neck.quaternion.clone(), rig.bones.Head.quaternion.clone()];
      for (const [yaw, nod] of [[Math.PI / 3, 0], [-Math.PI / 3, 0], [0, 0.5], [Math.PI / 3, -0.3]]) {
        turn(rig, yaw, nod);
        const worst = Math.max(...onHead(rig).map((p, i) => p.distanceTo(rest[i])));
        expect(worst, `${id} turned ${yaw.toFixed(2)}, nodding ${nod}`).toBeLessThan(0.001);
        rig.bones.Neck.quaternion.copy(kept[0]);
        rig.bones.Head.quaternion.copy(kept[1]);
      }
      refitOutfit(rig, base);
    }
  }, 120000);

  it('gives her hair back its own skin weights when she lets it down', async () => {
    const { refitOutfit, OUTFITS } = await import('../src/npc/outfit.js');
    const { id, rig } = girls[0];
    const base = OUTFITS[CHARACTERS.find((c) => c.id === id).params.outfit];
    refitOutfit(rig, base);
    const meshes = [];
    rig.model.traverse((o) => o.isSkinnedMesh && !rig.outfitParts.includes(o) && meshes.push(o));
    const loose = meshes.map((m) => m.geometry.attributes.skinWeight.array.slice());
    refitOutfit(rig, { ...base, style: { ...base.style, ponytail: true } });
    expect(meshes.some((m, k) => m.geometry.attributes.skinWeight.array.some((w, i) => w !== loose[k][i]))).toBe(true);
    refitOutfit(rig, base);
    meshes.forEach((m, k) => expect([...m.geometry.attributes.skinWeight.array]).toEqual([...loose[k]]));
  }, 120000);
});
