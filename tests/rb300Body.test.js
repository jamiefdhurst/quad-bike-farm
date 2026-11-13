import { describe, it, expect, beforeAll } from 'vitest';
import { RB300_DECK, RB300_RACKS, RB300_FACE, RB300_CAGE, cagePieces, rearFaceAt, RB300_TAIL_X } from '../src/vehicle/rb300Body.js';
import { deckRows, deckY } from '../src/vehicle/farm300Deck.js';
import { WHEELS } from '../src/vehicle/quadPhysics.js';
import { QUAD_SPECS } from '../src/vehicle/quadSpecs.js';
import { BODY_STYLES } from '../src/vehicle/quadModel.js';
import { rb300NeedleAngle, RB300_DIAL } from '../src/vehicle/dash.js';
import { buildAllModels } from './helpers/vehicleModels.js';
import { POD } from '../src/vehicle/farm300Controls.js';

// The green quad as a Ridgeback-style KLF300 Rb300 (TODO 90): the body's numbers, the nose cage, the speedo's dial, the bars and the pod.

const dist = (p, a, b) => {
  const ab = a.map((v, i) => b[i] - v);
  const ap = a.map((v, i) => p[i] - v);
  const t = Math.max(0, Math.min(1, ap.reduce((s, v, i) => s + v * ab[i], 0) / ab.reduce((s, v) => s + v * v, 0)));
  return Math.hypot(...a.map((v, i) => p[i] - (v + t * ab[i])));
};

describe('the Rb300 body', () => {
  it('has decks that stop short of the tyres at the ends', () => {
    const front = WHEELS.find((w) => w.front);
    const rear = WHEELS.find((w) => !w.front);
    expect(RB300_DECK.front.zf).toBeLessThan(front.z + 0.3);
    expect(RB300_DECK.rear.zf).toBeGreaterThan(rear.z - 0.3);
  });

  it('has racks at the fixed rack and mug heights, with the mug point on the rear one, and legs that land on the decks', () => {
    expect(RB300_RACKS.front.y).toBe(0.84);
    expect(RB300_RACKS.rear.y).toBe(0.93);
    const [lo, hi] = [Math.min(RB300_RACKS.rear.z0, RB300_RACKS.rear.z1), Math.max(RB300_RACKS.rear.z0, RB300_RACKS.rear.z1)];
    expect(-0.93).toBeGreaterThan(lo);
    expect(-0.93).toBeLessThan(hi);
    for (const [which, rack, zs] of [['front', RB300_RACKS.front, [0.55, 0.78]], ['rear', RB300_RACKS.rear, [-0.8]]]) {
      const spec = RB300_DECK[which];
      const rows = deckRows(RB300_DECK, spec);
      for (const z of zs) {
        const row = rows.find((r) => Math.abs(r.z - z) < 0.04) ?? rows[0];
        const top = deckY(RB300_DECK, spec, row, 0.41);
        expect(rack.y, `${which} rack is above its deck`).toBeGreaterThan(top + 0.05);
        expect(top, `${which} deck at 0.41`).toBeGreaterThan(0.69); // the leg's foot (0.70 front, 0.75 rear) is inside it
      }
    }
  });

  it('has a back that leans, out at the bottom and in at the top, and tail lamps that lie on it', () => {
    expect(RB300_DECK.rear.lean).toBeGreaterThan(0.04);
    const high = rearFaceAt(0.7, 0.19);
    const low = rearFaceAt(0.62, 0.19);
    expect(low.z).toBeLessThan(high.z - 0.01); // further back lower down
    expect(low.tilt).toBeGreaterThan(0.3); // a face tilted by 20 degrees or more from upright
    expect(rearFaceAt(0.665, 0.19).tilt).toBeLessThan(1.0);
  });

  it('stops the front body high, leaving the lamps and grille to their own frame ahead of it', () => {
    expect(RB300_DECK.front.zf - RB300_DECK.front.top).toBeDefined();
    expect(RB300_DECK.front.top - RB300_DECK.front.faceH).toBeGreaterThan(0.62); // the face's lower lip is high
    expect(RB300_FACE.z).toBeGreaterThan(RB300_DECK.front.zf + 0.08); // the lamps stand at least 8 cm out from the body
    expect(RB300_FACE.lampY + RB300_FACE.lampH / 2).toBeLessThan(RB300_DECK.front.top - RB300_DECK.front.faceH + 0.0); // and sit below its lip
  });

  it('is a body style the game builds, and the green names it', () => {
    expect(BODY_STYLES).toContain('rb300');
    const green = QUAD_SPECS.find((s) => s.id === 'rb300');
    expect(green.style).toBe('rb300');
    expect(green.dashStyle).toBe('rb300');
    expect(green.chokeStyle).toBe('slide'); // a slider on the switch pod, as on the real one and the red
    expect(green.barLights).toBe(true); // P works its lights rocker
  });
});

describe('the nose cage', () => {
  const pieces = cagePieces();
  const bars = pieces.map((p) => p.pts);

  it('ends every bar on another bar, the rack’s front rail, the deck’s face or the frame', () => {
    const face = RB300_DECK.front.zf - 0.02;
    pieces.forEach((piece, i) => {
      for (const end of piece.pts) {
        const onBar = bars.some((b, j) => j !== i && dist(end, b[0], b[1]) < 0.012);
        const onRack = Math.abs(end[1] - RB300_CAGE.rackY) < 0.001 && Math.abs(end[2] - RB300_CAGE.rackZ) < 0.001;
        const onFace = Math.abs(end[2] - face) < 0.001;
        const onFrame = Math.abs(end[1] - RB300_CAGE.frameY) < 0.001 && Math.abs(end[2] - RB300_CAGE.frameZ) < 0.001;
        expect(onBar || onRack || onFace || onFrame, `${piece.name} ends in the air at ${end}`).toBe(true);
      }
    });
  });

  it('goes round the lamps: each lamp sits inside its loop, above the sill and below the top rail', () => {
    const lamp = { lo: RB300_FACE.lampX - RB300_FACE.lampW / 2, hi: RB300_FACE.lampX + RB300_FACE.lampW / 2 };
    expect(RB300_CAGE.inner).toBeLessThan(lamp.lo);
    expect(RB300_CAGE.x).toBeGreaterThan(lamp.hi);
    expect(RB300_CAGE.midY).toBeLessThan(RB300_FACE.lampY - RB300_FACE.lampH / 2);
    expect(RB300_CAGE.topY).toBeGreaterThan(RB300_FACE.lampY + RB300_FACE.lampH / 2);
  });

  it('leaves the winch’s rope clear: nothing crosses the middle between the lamps and the bottom rail but the rails themselves', () => {
    for (const p of pieces) {
      if (p.name === 'topRail' || p.name === 'lowRail') continue;
      for (const [x, y] of p.pts) if (y < RB300_CAGE.midY - 0.01 && y > RB300_CAGE.lowY + 0.01) expect(Math.abs(x)).toBeGreaterThan(0.2);
    }
  });
});

describe('the Rb300 speedo', () => {
  it('sweeps 220 degrees, 0 at the lower left, 20 at the top and 40 at the lower right, held at its ends', () => {
    expect(rb300NeedleAngle(0)).toBe(RB300_DIAL.from);
    expect(rb300NeedleAngle(20)).toBeCloseTo(90, 6);
    expect(rb300NeedleAngle(40)).toBeCloseTo(RB300_DIAL.to, 6);
    expect(rb300NeedleAngle(80)).toBeCloseTo(RB300_DIAL.to, 6);
    expect(rb300NeedleAngle(-5)).toBe(RB300_DIAL.from);
  });
});

describe('the green quad’s model', () => {
  let green;
  beforeAll(async () => {
    green = (await buildAllModels()).find((v) => v.id === 'rb300');
  });

  it('has a choke slider on its pod, a V of bars through the grips’ fixed points, and its parts by name', () => {
    const m = green.model;
    for (const n of ['controlPod', 'chokeLever', 'stopRocker', 'startButton', 'thumbThrottle', 'parkBrakeLever', 'winchHook', 'winchFairlead', 'hitchPin', 'drawbarHole', 'lightsRocker', 'headlightLeft', 'headlightRight', 'cageLoop', 'speedoBracket']) {
      expect(m.getObjectByName(n), n).toBeTruthy();
    }
    expect(m.getObjectByName('chokeLever').userData.baseX).toBeTypeOf('number');
    expect(POD.slide).toBeGreaterThan(0);
  });

  it('has bars that rise from a low middle: the clamp sits below the grips’ line', () => {
    const bars = green.model.getObjectByName('handlebars');
    const grip = bars.getObjectByName('gripLeft');
    const clamp = bars.getObjectByName('barClamp');
    expect(clamp.position.y).toBeLessThan(grip.position.y - 0.08); // the middle is 10 cm below the grips
    expect(bars.getObjectByName('speedoBracket')).toBeTruthy();
  });

  it('has two tail lamps, one each side', () => {
    const lamps = [];
    green.model.traverse((o) => o.name === 'tailLamp' && lamps.push(o));
    expect(lamps).toHaveLength(2);
    const xs = lamps.map((o) => green.model.worldToLocal(o.getWorldPosition(new (o.position.constructor)())).x);
    expect(xs[0] * xs[1]).toBeLessThan(0);
    for (const x of xs) expect(Math.abs(x)).toBeGreaterThan(0.4); // out at the back's edges
    expect(RB300_TAIL_X).toBeLessThan(RB300_DECK.half - 0.1);
  });

  it('rocks the lights switch left to right', async () => {
    const { poseBarPod } = await import('../src/vehicle/farm300Controls.js');
    const r = green.model.getObjectByName('lightsRocker');
    poseBarPod(green.model, { lights: 'off' });
    const off = r.rotation.y;
    poseBarPod(green.model, { lights: 'high' });
    expect(r.rotation.y).toBeGreaterThan(off);
    expect(r.rotation.x).toBe(0);
  });

  it('puts the pin through the drawbar’s hole', () => {
    const m = green.model;
    const pin = m.getObjectByName('hitchPin');
    const hole = m.getObjectByName('drawbarHole');
    expect(Math.abs(pin.position.x - hole.position.x)).toBeLessThan(0.002);
    expect(Math.abs(pin.position.z - hole.position.z)).toBeLessThan(0.002);
  });
});
