import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';

const random = () => 0.5;
const fights = (group) => coplanarOverlaps(group, { gap: 0.003, minArea: 2e-5, textured: true }).map((f) => `${f.a}/${f.b} ${'xyz'[f.axis]}${f.dir > 0 ? '+' : '-'} at ${f.at.map((v) => v.toFixed(2))} area ${f.area.toFixed(4)}`);

describe('the excavator', () => {
  it('has no two faces on one plane, which flicker as alpha fighting', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildExcavator, excavatorMaterials } = await import('../src/world/excavatorModel.js');
    const { group } = buildExcavator(excavatorMaterials(random));
    expect(fights(group)).toEqual([]);
  });
});

describe('the container', () => {
  it('has no two faces on one plane, which flicker as alpha fighting', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildContainer, containerMaterials } = await import('../src/world/containerModel.js');
    const { group } = buildContainer(containerMaterials(random), random);
    expect(fights(group)).toEqual([]);
  });
});

describe('the site cabin', () => {
  it('has no two faces on one plane, which flicker as alpha fighting', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildCabin, cabinMaterials } = await import('../src/world/siteCabinModel.js');
    const { group } = buildCabin(cabinMaterials(random));
    expect(fights(group)).toEqual([]);
  });
});

const distToSegment = (p, a, b) => {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};

describe('the excavator joins up', () => {
  it('has every boom, stick and bucket pin on both of the parts it joins, and the bucket resting on the ground', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildExcavator, excavatorMaterials } = await import('../src/world/excavatorModel.js');
    const { joints, links, bucketTip } = buildExcavator(excavatorMaterials(random));
    const at = Object.fromEntries(joints.map((j) => [j.name, j.at]));
    const reach = (name, link) => distToSegment(at[name], links.find((l) => l.name === link).a, links.find((l) => l.name === link).b) - links.find((l) => l.name === link).halfH;
    expect(reach('boomFoot', 'boom1')).toBeLessThan(0.02);
    expect(reach('boomBend', 'boom1')).toBeLessThan(0.02);
    expect(reach('boomBend', 'boom2')).toBeLessThan(0.02);
    expect(reach('elbow', 'boom2')).toBeLessThan(0.02);
    expect(reach('elbow', 'stick')).toBeLessThan(0.02);
    expect(reach('bucketPin', 'stick')).toBeLessThan(0.02);
    expect(bucketTip[1]).toBeGreaterThan(0);
    expect(bucketTip[1]).toBeLessThan(0.1);
  });

  it('is a handful of draw calls, with its colliders round it', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildExcavator, excavatorMaterials } = await import('../src/world/excavatorModel.js');
    const { group, boxes } = buildExcavator(excavatorMaterials(random));
    expect(group.children.length).toBeLessThanOrEqual(12);
    const bounds = new THREE.Box3().setFromObject(group);
    for (const [x, y, z, hx, hy, hz] of boxes) {
      expect(x - hx).toBeGreaterThanOrEqual(bounds.min.x - 0.01);
      expect(x + hx).toBeLessThanOrEqual(bounds.max.x + 0.01);
      expect(y - hy).toBeGreaterThanOrEqual(bounds.min.y - 0.01);
      expect(y + hy).toBeLessThanOrEqual(bounds.max.y + 0.01);
      expect(Math.abs(z) + hz).toBeLessThanOrEqual(Math.max(bounds.max.z, -bounds.min.z) + 0.01);
    }
  });
});

describe('the container', () => {
  it('has corrugated sides that a dent pushes in, and doors on the +x end with one leaf standing open', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { corrugatedGeometry, dentGeometry, buildContainer, containerMaterials, CONTAINER } = await import('../src/world/containerModel.js');
    const flat = corrugatedGeometry(2, 1, { crest: 1, steps: 8 });
    const dented = dentGeometry(corrugatedGeometry(2, 1, { crest: 1, steps: 8 }), 1, 0.5, 0.6, 0.05, -1);
    const frontest = (g) => Math.max(...Array.from({ length: g.attributes.position.count }, (_, i) => g.attributes.position.getZ(i)));
    expect(frontest(flat)).toBeCloseTo(0.04, 3); // the crests stand 4 cm out
    const zs = (g, i) => g.attributes.position.getZ(i);
    let pushed = 0;
    for (let i = 0; i < flat.attributes.position.count; i++) if (zs(flat, i) - zs(dented, i) > 0.04) pushed++;
    expect(pushed).toBeGreaterThan(0);
    const { boxes, leaves } = buildContainer(containerMaterials(random), random);
    expect(leaves).toHaveLength(2);
    expect(leaves.filter((open) => Math.abs(open) > 0.5)).toHaveLength(1);
    expect(boxes[0][3]).toBeCloseTo(CONTAINER.length / 2, 1);
  });
});

describe('the cabin walls', () => {
  it('are cut round their openings, leaving no wall across one and none missing beside it', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { cutWall } = await import('../src/world/siteCabinModel.js');
    const openings = [[-1.45, -0.35, 1.35, 2.2], [0.55, 1.45, 0.47, 2.5]];
    const pieces = [];
    cutWall(3.6, 0.47, 2.65, openings, (a, b, ya, yb) => pieces.push([a, b, ya, yb]));
    const area = pieces.reduce((s, [a, b, ya, yb]) => s + (b - a) * (yb - ya), 0);
    const hole = openings.reduce((s, [a, b, ya, yb]) => s + (b - a) * (yb - ya), 0);
    expect(area).toBeCloseTo(3.6 * 2.18 - hole, 5);
    for (const [a, b, ya, yb] of pieces) for (const [oa, ob, oya, oyb] of openings) expect(a < ob && b > oa && ya < oyb && yb > oya).toBe(false);
  });
});

describe('the drums, tyres and signs', () => {
  it('deal places with none overlapping another, or any already there', async () => {
    const { scatterClear } = await import('../src/world/quarryDebris.js');
    let n = 0;
    const rng = () => ((n = (n * 9301 + 49297) % 233280), n / 233280);
    const existing = [{ x: 0, z: 0, r: 0.75 }];
    const got = scatterClear(30, { pick: () => ({ x: (rng() - 0.5) * 8, z: (rng() - 0.5) * 8 }), radius: (i) => 0.3 + (i % 3) * 0.1, existing });
    expect(got.length).toBeGreaterThan(5);
    const all = [...existing, ...got];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(Math.hypot(all[i].x - all[j].x, all[i].z - all[j].z)).toBeGreaterThanOrEqual(all[i].r + all[j].r);
    expect(scatterClear(3, { pick: () => ({ x: 0, z: 0 }), radius: () => 0.3 })).toHaveLength(1); // the second and third land where the first is, every time
    expect(scatterClear(3, { pick: () => ({ x: 1, z: 1 }), radius: () => 0.3, ok: () => false })).toHaveLength(0);
  });

  it('are real sizes: a drum 88 cm tall and 59 cm across, a car tyre 62 cm across and 20 cm wide', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { drumGeometry, tyreGeometry } = await import('../src/world/quarryDebris.js');
    const size = (g) => new THREE.Box3().setFromBufferAttribute(g.attributes.position).getSize(new THREE.Vector3());
    const d = size(drumGeometry());
    expect(d.y).toBeCloseTo(0.88, 1);
    expect(d.x).toBeCloseTo(0.59, 1);
    const t = size(tyreGeometry());
    expect(t.x).toBeCloseTo(0.64, 1);
    expect(t.y).toBeCloseTo(0.2, 1);
  });

  it('put the lettering on the front of a sign and a plain galvanised grey on its back, in one mesh', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildSign } = await import('../src/world/quarryDebris.js');
    const { signTexture, SIGN_SIZE } = await import('../src/world/quarryTextures.js');
    const front = signTexture('DANGER', ['KEEP OUT']);
    const sign = buildSign(front, new THREE.MeshStandardMaterial());
    const board = sign.getObjectByName('quarrySignBoard');
    expect(board.material.map).toBe(front);
    expect(sign.children).toHaveLength(2); // the post and the board with its straps: two draw calls
    const lettered = (SIGN_SIZE.h - SIGN_SIZE.face) / SIGN_SIZE.h;
    const uv = board.geometry.getAttribute('uv');
    const normal = board.geometry.getAttribute('normal');
    const pos = board.geometry.getAttribute('position');
    const vs = (sign_) => {
      const out = [];
      for (let i = 0; i < uv.count; i++) if (normal.getZ(i) * sign_ > 0.99 && Math.abs(pos.getX(i)) > 0.2 && Math.abs(pos.getY(i) - 1.55) < 0.32) out.push(uv.getY(i));
      return out;
    };
    expect(Math.min(...vs(1))).toBeGreaterThanOrEqual(lettered - 1e-6); // the front reads the lettered part of the texture
    expect(Math.max(...vs(-1))).toBeLessThan(lettered); // the back reads the galvanised strip
    // The board stands clear of the post, held to it by straps, not sharing its plane.
    const post = new THREE.Box3().setFromObject(sign.children[0]);
    expect(new THREE.Box3().setFromBufferAttribute(pos).min.z).toBeLessThan(post.max.z + 0.05);
    let boardFace = Infinity;
    for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getY(i) - 1.55) < 0.3 && normal.getZ(i) < -0.99 && Math.abs(pos.getX(i)) > 0.2) boardFace = Math.min(boardFace, pos.getZ(i));
    expect(boardFace).toBeGreaterThan(post.max.z);
  });
});
