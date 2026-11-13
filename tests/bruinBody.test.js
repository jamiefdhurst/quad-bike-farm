import { describe, it, expect } from 'vitest';
import { BRUIN_DECK, BRUIN_RACKS, BRUIN_BUMPER, bumperPoints, bruinLampOutline } from '../src/vehicle/bruinBody.js';
import { deckRows, deckY } from '../src/vehicle/farm300Deck.js';
import { WHEELS } from '../src/vehicle/quadPhysics.js';

describe('the Bruin body', () => {
  it('has decks that stop short of the tyres at the ends, so the front of the front tyre and the back of the rear one show', () => {
    const front = WHEELS.find((w) => w.front);
    const rear = WHEELS.find((w) => !w.front);
    expect(BRUIN_DECK.front.zf).toBeLessThan(front.z + 0.3);
    expect(BRUIN_DECK.rear.zf).toBeGreaterThan(rear.z - 0.3);
    expect(BRUIN_DECK.archR).toBeGreaterThan(0.3);
  });

  it('has racks whose legs land on the decks, and whose heights are the fixed rack and mug points', () => {
    expect(BRUIN_RACKS.front.y).toBe(0.84);
    expect(BRUIN_RACKS.rear.y).toBe(0.93);
    for (const [which, rack, zs] of [['front', BRUIN_RACKS.front, [0.55, 0.78]], ['rear', BRUIN_RACKS.rear, [-0.84]]]) {
      const spec = BRUIN_DECK[which];
      const rows = deckRows(BRUIN_DECK, spec);
      for (const z of zs) {
        const row = rows.find((r) => Math.abs(r.z - z) < 0.04) ?? rows[0];
        const top = deckY(BRUIN_DECK, spec, row, 0.41);
        expect(rack.y, `${which} rack is above its deck`).toBeGreaterThan(top + 0.05);
        expect(top, `${which} deck at 0.41`).toBeGreaterThan(0.69); // the leg's foot (0.70 front, 0.75 rear) is inside it
      }
    }
  });

  it('hangs the bumper from the rack and ends its wings on the fender faces', () => {
    const P = bumperPoints();
    const face = BRUIN_DECK.front.zf;
    for (const s of [P.left, P.right]) {
      expect(s.upper[1]).toBeLessThan(BRUIN_RACKS.front.y); // starts on the rack's rail
      expect(s.upper[2]).toBeLessThanOrEqual(BRUIN_RACKS.front.z1);
      expect(s.lower[1]).toBeCloseTo(BRUIN_BUMPER.y, 5);
      expect(Math.abs(s.wing[2] - face)).toBeLessThan(0.02); // the wing meets the face
      expect(Math.abs(s.wing[0])).toBeLessThan(BRUIN_DECK.half); // inside the fender's width
    }
  });
});

describe('the Bruin pod’s lights rocker', () => {
  it('goes top in for HI, level for LO and bottom in for OFF when there is no separate HI / LO rocker', async () => {
    const THREE = await import('three');
    const { poseBarPod, POD } = await import('../src/vehicle/farm300Controls.js');
    const model = new THREE.Group();
    for (const name of ['lightsRocker', 'stopRocker', 'startButton']) {
      const o = new THREE.Object3D();
      o.name = name;
      model.add(o);
    }
    const rocker = model.getObjectByName('lightsRocker');
    poseBarPod(model, { lights: 'high' });
    expect(rocker.rotation.x).toBeCloseTo(-POD.rock, 6);
    poseBarPod(model, { lights: 'low' });
    expect(rocker.rotation.x).toBe(0);
    poseBarPod(model, { lights: 'off' });
    expect(rocker.rotation.x).toBeCloseTo(POD.rock, 6);
  });
});

describe('the Bruin headlight surround', () => {
  it('is an almond: close round the lens at the inner end, pointing out and up, and clear of the bumper’s end blocks and the face’s roll', () => {
    const pts = bruinLampOutline();
    const us = pts.map((p) => p[0]);
    const vs = pts.map((p) => p[1]);
    expect(Math.min(...us)).toBeLessThan(-0.036); // it holds the 36 mm lens
    expect(Math.min(...us)).toBeGreaterThan(-0.06); // but only just, at the inner end
    expect(Math.max(...us)).toBeGreaterThan(0.12); // and reaches well out the other way
    const tip = pts.reduce((a, p) => (p[0] > a[0] ? p : a));
    expect(tip[1]).toBeGreaterThan(0.02); // to a point above the lens's middle
    expect(Math.max(...vs)).toBeLessThanOrEqual(0.055); // its top stays on the face's flat (the deck's roll starts at 0.63)
    const B = BRUIN_BUMPER;
    expect(0.58 + Math.min(...vs)).toBeGreaterThan(B.y + 0.03 + 0.005); // above the end blocks' tops (60 mm tall about the bar)
  });
});
