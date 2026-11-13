import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { tinLevel, TIN_STEPS, ledgerText, Market } from '../src/farm/classifieds.js';

// The tin's label is drawn on a canvas; there is none in node, so stand one in.
vi.stubGlobal('document', {
  createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({ fillRect() {}, beginPath() {}, roundRect() {}, fill() {}, stroke() {}, strokeRect() {}, fillText() {}, moveTo() {}, lineTo() {} }, { set: () => true, get: (t, k) => t[k] ?? (() => {}) }) }),
});
const { buildTin, TIN } = await import('../src/world/moneyTin.js');

const boxOf = (o) => new THREE.Box3().setFromObject(o);

describe('the money tin model', () => {
  const tin = buildTin();

  it('is a biscuit tin: about a quarter of a metre long and under ten centimetres high with the lid on', () => {
    tin.setOpen(0);
    tin.group.updateMatrixWorld(true);
    const b = boxOf(tin.group).getSize(new THREE.Vector3());
    expect(b.z).toBeGreaterThan(0.24);
    expect(b.z).toBeLessThan(0.3);
    expect(b.y).toBeGreaterThan(0.07);
    expect(b.y).toBeLessThan(0.1);
  });

  it('has its lid shut over the body, the lid hinged on the back top edge', () => {
    tin.setOpen(0);
    tin.group.updateMatrixWorld(true);
    expect(tin.lid.position.y).toBeCloseTo(TIN.high, 5);
    expect(tin.lid.position.x).toBeCloseTo(-TIN.deep / 2, 5);
    const lid = boxOf(tin.lid);
    expect(lid.min.y).toBeGreaterThan(TIN.high - TIN.lip - 0.001);
  });

  it('opens the lid upright and a little past, over the back edge, clear of the front', () => {
    tin.setOpen(1);
    tin.group.updateMatrixWorld(true);
    const lid = boxOf(tin.lid);
    expect(lid.max.y).toBeGreaterThan(TIN.high + TIN.deep * 0.8);
    expect(lid.max.x).toBeLessThan(-TIN.deep / 2 + 0.02); // not forward of the hinge by more than the lid's thickness
    tin.setOpen(0);
  });

  it('shows more in the tin as it fills, and never nothing', () => {
    tin.setOpen(1);
    const counts = [0, 1, 2, 3, 4].map((level) => {
      tin.setLevel(level);
      let n = 0;
      tin.group.traverse((o) => {
        if (o.isMesh && o.visible) {
          let p = o;
          let visible = true;
          while (p) {
            if (!p.visible) visible = false;
            p = p.parent;
          }
          if (visible && tin.layers.some((l) => l.getObjectById(o.id))) n++;
        }
      });
      return n;
    });
    expect(counts[0]).toBeGreaterThan(0);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThan(counts[i - 1]);
  });

  it('keeps everything in the tin below the rim until it is piled over', () => {
    for (const level of [0, 1, 2, 3]) {
      tin.setLevel(level);
      tin.setOpen(1);
      tin.group.updateMatrixWorld(true);
      for (let i = 0; i <= level; i++) expect(boxOf(tin.layers[i]).max.y, `level ${level} layer ${i}`).toBeLessThanOrEqual(TIN.high + 0.001);
    }
    tin.setLevel(4);
    tin.group.updateMatrixWorld(true);
    expect(boxOf(tin.layers[4]).max.y).toBeGreaterThan(TIN.high); // the last step spills over the rim
  });

  it('hides the contents while the lid is shut, so the piled notes never show through it', () => {
    tin.setLevel(4);
    tin.setOpen(0);
    expect(tin.layers.every((l) => !l.visible)).toBe(true);
    tin.setOpen(0.5);
    expect(tin.layers.every((l) => l.visible)).toBe(true);
    tin.setOpen(0);
  });

  it('keeps its contents inside the walls', () => {
    tin.setLevel(4);
    tin.setOpen(0);
    tin.group.updateMatrixWorld(true);
    const body = new THREE.Box3(new THREE.Vector3(-TIN.deep / 2, 0, -TIN.long / 2), new THREE.Vector3(TIN.deep / 2, 1, TIN.long / 2));
    for (const l of tin.layers) expect(body.containsBox(boxOf(l))).toBe(true);
  });
});

describe('what the tin shows', () => {
  it('fills in steps with the balance', () => {
    expect(tinLevel(0)).toBe(0);
    expect(tinLevel(TIN_STEPS[0] - 1)).toBe(0);
    expect(tinLevel(TIN_STEPS[0])).toBe(1);
    expect(tinLevel(500)).toBe(2);
    expect(tinLevel(1500)).toBe(3);
    expect(tinLevel(99999)).toBe(4);
  });

  it('keeps the last five deals and words them with the in-game names', () => {
    const m = new Market();
    for (let i = 0; i < 7; i++) m.note(i + 1, i % 2 ? 'sold' : 'bought', 'hartley', 100 * (i + 1));
    expect(m.ledger).toHaveLength(5);
    expect(m.ledger[0].day).toBe(3);
    expect(ledgerText({ day: 4, deal: 'sold', specId: 'hornet', price: 1250 })).toBe('Day 4: sold the Tamura Hornet 200 for £1,250');
  });

  it('keeps the ledger in the save, ignoring anything that is not a deal', () => {
    const m = new Market();
    m.note(2, 'bought', 'farm300', 400);
    const back = new Market();
    back.restore(JSON.parse(JSON.stringify({ ...m.toJSON(), ledger: [...m.toJSON().ledger, { deal: 'stolen', specId: 'farm300', price: 1 }, { deal: 'sold', specId: 'griffin', price: 1 }] })));
    expect(back.ledger).toEqual([{ day: 2, deal: 'bought', specId: 'farm300', price: 400 }]);
  });

  it('knows which bought vehicles turned up this morning', () => {
    const m = new Market();
    m.bought = [{ specId: 'farm300', boughtDay: 3 }, { specId: 'bruin', boughtDay: 2 }, { specId: 'rb300' }];
    expect(m.arrivals(4).map((b) => b.specId)).toEqual(['farm300']);
  });
});
