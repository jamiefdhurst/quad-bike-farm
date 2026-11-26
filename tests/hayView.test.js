import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { HayView, tuftSpots } from '../src/world/hayView.js';
import { Haymaking, CUT, BALED } from '../src/world/haymaking.js';
import { maskLayout, fillMask } from '../src/world/hayMask.js';
import { createRandom } from '../src/core/random.js';

const scales = (rect) => tuftSpots(rect, () => 0, createRandom(7)).map((m) => new THREE.Vector3().setFromMatrixScale(m));

describe('the long grass on a big meadow', () => {
  it('stands wider but no taller than on a small one', () => {
    const small = scales({ minX: 0, maxX: 30, minZ: 0, maxZ: 30 });
    const big = scales({ minX: 0, maxX: 250, minZ: 0, maxZ: 250 }); // over the tuft cap, so thinned
    const tallest = (list) => Math.max(...list.map((v) => v.y));
    const widest = (list) => Math.max(...list.map((v) => v.x));
    expect(widest(big)).toBeGreaterThan(widest(small) * 1.5);
    expect(tallest(big)).toBeLessThanOrEqual(1.3 * 1.25 + 1e-6); // the base size and the stretch alone, not grown with the width
    expect(tallest(big)).toBeLessThan(tallest(small) * 1.1);
  });
});

describe('the hay view\'s picture of the cells (#1071)', () => {
  const rect = { minX: 40.3, maxX: 71.6, minZ: 50, maxZ: 67.1 };
  /** The view's picture alone: the bales' materials want a canvas, and the picture's three methods use nothing else of the view. */
  const pictureOf = (hay) => {
    const view = Object.create(HayView.prototype);
    view.hay = hay;
    view.patch = null;
    view.buildMask();
    return view;
  };
  const whole = (hay) => {
    const l = maskLayout(hay.rect);
    const data = new Uint8Array(l.cols * l.rows * 4);
    fillMask(data, l, hay);
    return data;
  };

  it('is drawn whole, fade and all, when the view is built', () => {
    const hay = new Haymaking({ rect });
    hay.state[3] = CUT;
    const view = pictureOf(hay);
    expect(view.maskData).toEqual(whole(hay));
    expect(view.maskTexture.version).toBeGreaterThan(0);
  });

  it('repaint(cells) redraws those cells and sends the picture to the card, without working the fade out again', () => {
    const hay = new Haymaking({ rect });
    const view = pictureOf(hay);
    const fade = whole(hay);
    for (let o = 3; o < view.maskData.length; o += 4) view.maskData[o] = 7; // a fade only buildMask's own pass would put right
    const cells = [0, hay.cols + 4, hay.cells - 1];
    for (const i of cells) hay.state[i] = CUT;
    hay.state[hay.cols * 2 + 6] = CUT; // changed but not handed over: it waits for a full redraw
    const sent = view.maskTexture.version;
    view.repaint(cells);
    expect(view.maskTexture.version).toBe(sent + 1);
    const rgb = (data) => data.filter((_, o) => o % 4 !== 3);
    expect(rgb(view.maskData)).not.toEqual(rgb(whole(hay)));
    view.repaint([]);
    expect(view.maskTexture.version).toBe(sent + 1); // nothing changed, nothing sent
    view.repaint(); // no cells named: every colour
    expect(view.maskTexture.version).toBe(sent + 2);
    expect(rgb(view.maskData)).toEqual(rgb(whole(hay)));
    hay.state.fill(BALED);
    view.refresh();
    expect(rgb(view.maskData)).toEqual(rgb(whole(hay)));
    for (let o = 3; o < view.maskData.length; o += 4) if (view.maskData[o] !== 7) throw new Error(`the fade was worked out again at texel ${(o - 3) / 4}`);
    expect(fade.some((v, o) => o % 4 === 3 && v !== 7)).toBe(true);
  });
});
