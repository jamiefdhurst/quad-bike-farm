import { describe, it, expect } from 'vitest';
import { browOf, browAt, mouthAt, heightField, frontmostZ, onSurface, FACE } from '../src/npc/faceShape.js';
import { Face, wantedFace, channelsFor, moodFace, FACE_POSES, FACE_CHANNELS, REACTION_FACES, FACE_PICKS, pickFace, DEFAULT_FACE_PARAMS } from '../src/npc/faceExpression.js';
import { REACTIONS } from '../src/npc/reactions.js';

// A face that is a gentle dome, highest in the middle, as hers is round the mouth.
const dome = (x, y) => 0.33 - 2 * x * x - 0.5 * (y - 0.16) ** 2;
// A painted brow on her left: an arch from x 0.08 (inner) to 0.22, highest at 0.13, 0.03 tall.
const browStroke = () => {
  const pts = [];
  for (let x = 0.08; x <= 0.2201; x += 0.01) {
    const y = 0.46 - 2 * (x - 0.13) ** 2;
    pts.push([x, y + 0.012, 0.2], [x, y - 0.012, 0.2]);
  }
  return pts;
};
const ys = (positions) => positions.map((p) => p[1]);
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

describe('the face surface', () => {
  it('finds the frontmost triangle a ray along z hits, and none off the edge', () => {
    const near = [[-1, -1, 0.5], [1, -1, 0.5], [0, 1, 0.5]];
    const far = [[-1, -1, 0.1], [1, -1, 0.1], [0, 1, 0.1]];
    expect(frontmostZ([far, near], 0, 0)).toBeCloseTo(0.5);
    expect(frontmostZ([far, near], 5, 5)).toBeNull();
  });

  it('reads back a sampled height field between its samples, filling misses from along the row', () => {
    const f = heightField((x, y) => (x > 0.9 ? null : x + y), 0, 1, 0, 1, 10, 10);
    expect(f(0.35, 0.45)).toBeCloseTo(0.8, 5);
    expect(f(1, 0.5)).toBeCloseTo(0.9 + 0.5, 5);
  });

  it('lays a point off the surface along its normal', () => {
    const [x, y, z] = onSurface(() => 0.3, 0.1, 0.2, 0.01);
    expect([x, y, z]).toEqual([0.1, 0.2, expect.closeTo(0.31, 6)]);
  });
});

describe('brows', () => {
  it('follows the painted stroke, inner end towards her middle', () => {
    const b = browOf(browStroke());
    expect(b.side).toBe(1);
    expect(b.inner).toBeCloseTo(0.08, 2);
    expect(b.outer).toBeCloseTo(0.22, 2);
    expect(b.line(0.13)).toBeCloseTo(0.46, 2);
    expect(b.line(0.22)).toBeLessThan(b.line(0.13));
    const mirrored = browOf(browStroke().map(([x, y, z]) => [-x, y, z]));
    expect(mirrored.side).toBe(-1);
    expect(mirrored.inner).toBeCloseTo(-0.08, 2);
  });

  it('lies on the face, raised and lowered whole, and knitted down and in at the inner end', () => {
    const b = browOf(browStroke());
    const rest = browAt(b, {}, dome).positions;
    for (const [x, y, z] of rest) expect(z).toBeGreaterThan(dome(x, y));
    const up = browAt(b, { lift: 1 }, dome).positions;
    const down = browAt(b, { lift: -1 }, dome).positions;
    expect(mean(ys(up)) - mean(ys(rest))).toBeGreaterThan(FACE.browLift * 0.6);
    expect(mean(ys(down))).toBeLessThan(mean(ys(rest)));
    const knit = browAt(b, { knit: 1 }, dome).positions;
    const n = FACE.browColumns;
    // The inner end (column 0) comes down and towards her nose; the outer end hardly moves.
    expect(knit[0][1]).toBeLessThan(rest[0][1] - FACE.browKnit * 0.8);
    expect(knit[0][0]).toBeLessThan(rest[0][0]);
    expect(Math.abs(knit[n - 1][1] - rest[n - 1][1])).toBeLessThan(0.002);
  });
});

describe('the mouth', () => {
  const corners = (m) => [m.positions[0], m.positions[FACE.mouthColumns - 1]];
  const middle = (m, row) => m.positions[row * FACE.mouthColumns + (FACE.mouthColumns - 1) / 2];

  it('has the same vertices whatever the pose, lip coloured outside and the inside within', () => {
    const rest = mouthAt({}, dome);
    const laugh = mouthAt(FACE_POSES.laugh, dome);
    expect(laugh.positions.length).toBe(rest.positions.length);
    expect(laugh.index).toEqual(rest.index);
    expect(rest.part.filter((p) => p === 'lip').length).toBe(4 * FACE.mouthColumns);
    expect(Math.max(...rest.index)).toBeLessThan(rest.positions.length);
  });

  it('sits between her nose and her chin, closed at rest and on the face', () => {
    const rest = mouthAt({}, dome);
    expect(middle(rest, 1)[1]).toBeCloseTo(FACE.mouthY, 3);
    // Closed: the upper lip's line meets the lower lip's.
    expect(middle(rest, 1)[1]).toBeCloseTo(middle(rest, 5)[1], 5);
    for (const [x, y, z] of rest.positions) expect(z).toBeGreaterThan(dome(x, y) - 1e-9);
  });

  it('turns its corners up in a smile and down in a scowl, the middle staying put', () => {
    const rest = mouthAt({}, dome);
    const smile = mouthAt({ curve: 1 }, dome);
    const scowl = mouthAt({ curve: -1 }, dome);
    expect(corners(smile)[0][1]).toBeGreaterThan(corners(rest)[0][1] + FACE.mouthCurve * 0.8);
    expect(corners(scowl)[1][1]).toBeLessThan(corners(rest)[1][1] - FACE.mouthCurve * 0.8);
    expect(middle(smile, 1)[1]).toBeCloseTo(middle(rest, 1)[1], 5);
  });

  it('stretches wide in a grimace, opens for a laugh, and shows teeth under the upper lip', () => {
    const rest = mouthAt({}, dome);
    const wide = mouthAt({ wide: 1 }, dome);
    expect(corners(wide)[1][0] - corners(wide)[0][0]).toBeCloseTo(corners(rest)[1][0] - corners(rest)[0][0] + 2 * FACE.mouthWide, 2); // near enough: laid along the curve of her face, the corners shift a little
    const open = mouthAt({ open: 1, teeth: 1 }, dome);
    const gap = middle(open, 2)[1] - middle(open, 4)[1];
    expect(gap).toBeCloseTo(FACE.mouthOpen, 3);
    // The teeth band runs down from under the upper lip a share of the gap.
    expect(middle(open, 2)[1] - middle(open, 3)[1]).toBeCloseTo(gap * FACE.teeth, 3);
  });
});

describe('her expression', () => {
  it('has a face for every reaction it names, and every pose uses only known channels', () => {
    for (const [reaction, pose] of Object.entries(REACTION_FACES)) {
      expect(REACTIONS[reaction], reaction).toBeTruthy();
      expect(FACE_POSES[pose], pose).toBeTruthy();
    }
    for (const pose of Object.values(FACE_POSES)) for (const ch of Object.keys(pose)) expect(FACE_CHANNELS).toContain(ch);
    expect(FACE_PICKS).toEqual(['auto', 'rest', 'smile', 'grimace', 'laugh', 'scowl', 'surprised']);
  });

  it('rests near her face as it is in an even mood, smiles in a high one and scowls in a low one', () => {
    expect(moodFace(0.1).weight).toBe(0);
    expect(moodFace(0.9)).toEqual({ pose: 'smile', weight: expect.any(Number) });
    expect(moodFace(0.9).weight).toBeGreaterThan(0.3);
    expect(moodFace(1).weight).toBeCloseTo(DEFAULT_FACE_PARAMS.faceMoodMost);
    expect(moodFace(-0.9).pose).toBe('scowl');
  });

  it('puts a picked face over a laugh, a laugh over a reaction, and a reaction over her mood', () => {
    const flinch = { type: 'flinch', weight: 1 };
    expect(wantedFace({ mood: 0.9, reaction: flinch }).over.pose).toBe('grimace');
    expect(wantedFace({ reaction: flinch, laughing: true }).over.pose).toBe('laugh');
    expect(wantedFace({ laughing: true, held: 'scowl' }).over.pose).toBe('scowl');
    expect(wantedFace({ reaction: { type: 'gasp', weight: 0.5 } }).over).toEqual({ pose: 'surprised', weight: 0.5 });
    // A reaction with no face of its own leaves her mood's.
    expect(wantedFace({ mood: 0.9, reaction: { type: 'nothing', weight: 1 } }).over).toBeNull();
  });

  it('lays a reaction over her resting face by its weight', () => {
    const ch = channelsFor({ pose: 'smile', weight: 1, over: { pose: 'scowl', weight: 0.5 } });
    expect(ch.curve).toBeCloseTo(0.5 * FACE_POSES.smile.curve + 0.5 * FACE_POSES.scowl.curve);
  });

  it('eases into a pose over about 0.2 s and back out', () => {
    const f = new Face();
    const step = (seconds, ctx) => {
      for (let t = 0; t < seconds - 1e-9; t += 0.01) f.update(0.01, ctx);
      return f.ch.curve;
    };
    expect(step(0.05, { laughing: true })).toBeLessThan(0.8 * FACE_POSES.laugh.curve);
    expect(step(0.15, { laughing: true })).toBeGreaterThan(0.9 * FACE_POSES.laugh.curve);
    expect(step(0.2, {})).toBeLessThan(0.1 * FACE_POSES.laugh.curve);
  });

  it('holds a face picked in the debug panel, and lets it go on auto', () => {
    const f = new Face();
    pickFace(f, 'grimace');
    for (let i = 0; i < 50; i++) f.update(0.02, { mood: 0.9 });
    expect(f.ch.teeth).toBeCloseTo(1, 2);
    expect(f.describe()).toBe('grimace, held');
    pickFace(f, 'auto');
    for (let i = 0; i < 50; i++) f.update(0.02, {});
    expect(f.describe()).toBe('at rest');
  });
});

describe('her face in play (Companion.updateFace)', () => {
  it('follows her mood, a reaction and a laugh, and lays it on her brows and mouth', async () => {
    const { Companion } = await import('../src/npc/companion.js');
    const make = (over = {}) => {
      const laid = [];
      const c = { mood: { value: 0 }, reaction: null, laughLeft: 0, expression: new Face(), faceParts: { setFace: (ch) => laid.push({ ...ch }) }, ...over };
      return { c, laid, step: (seconds) => { for (let t = 0; t < seconds; t += 0.05) Companion.prototype.updateFace.call(c, 0.05); } };
    };
    const happy = make({ mood: { value: 0.95 } });
    happy.step(1);
    expect(happy.laid.at(-1).curve).toBeGreaterThan(0.3);
    const flinching = make({ reaction: { type: 'flinch', t: 0.3 } });
    flinching.step(0.3);
    expect(flinching.c.expression.want.over.pose).toBe('grimace');
    expect(flinching.laid.at(-1).teeth).toBeGreaterThan(0.5);
    const laughing = make({ laughLeft: 2 });
    laughing.step(1);
    expect(laughing.laid.at(-1).open).toBeGreaterThan(0.9);
    expect(laughing.laid.at(-1).headBack).toBeGreaterThan(0.9);
  });
});
