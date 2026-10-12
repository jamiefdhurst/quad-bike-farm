import { describe, it, expect } from 'vitest';
import { DEFAULT_PHOTO_PARAMS as P, inFrame, photoReaction, isBlank, clockText, PhotoWall } from '../src/photos/photos.js';
import { createRandom } from '../src/core/random.js';

const shot = (n) => ({ data: `data:image/jpeg;base64,${n}`, day: 1, time: '10:00', girls: ['amy'] });

describe('inFrame', () => {
  it('counts a girl ahead and near, not behind or far', () => {
    expect(inFrame({ x: 0, z: 0, yaw: 0 }, { x: 0, z: 5 })).toBe(true);
    expect(inFrame({ x: 0, z: 0, yaw: 0 }, { x: 0, z: -5 })).toBe(false);
    expect(inFrame({ x: 0, z: 0, yaw: 0 }, { x: 0, z: P.frameRange + 1 })).toBe(false);
    expect(inFrame({ x: 0, z: 0, yaw: 0 }, { x: 5, z: 0.5 })).toBe(false);
  });
  it('follows the way you face', () => {
    expect(inFrame({ x: 0, z: 0, yaw: Math.PI / 2 }, { x: 5, z: 0 })).toBe(true);
  });
});

describe('photoReaction', () => {
  const amy = { pose: 1, face: 0.15, palm: 0.3 };
  it('gives each reaction by weight', () => {
    expect(photoReaction({ pose: 1, face: 0, palm: 0 }, 'even', () => 0.9)).toBe('pose');
    expect(photoReaction({ pose: 0, face: 1, palm: 0 }, 'even', () => 0.1)).toBe('face');
    expect(photoReaction({ pose: 0, face: 0, palm: 1 }, 'even', () => 0.5)).toBe('palm');
  });
  it('puts it away more when she feels neglected', () => {
    const r = createRandom(7);
    const count = (mood) => Array.from({ length: 400 }, () => photoReaction(amy, mood, r)).filter((x) => x === 'palm').length;
    expect(count('neglected')).toBeGreaterThan(count('favoured') * 3);
  });
  it('falls back to a pose with no weights', () => {
    expect(photoReaction({}, 'even')).toBe('pose');
  });
});

describe('isBlank', () => {
  it('is blank for one flat colour and not for a mix', () => {
    const flat = new Uint8ClampedArray(400).fill(120);
    expect(isBlank(flat, 10)).toBe(true);
    const mixed = new Uint8ClampedArray(400);
    for (let i = 0; i < 400; i++) mixed[i] = (i >> 2) % 2 ? 250 : 5;
    expect(isBlank(mixed, 10)).toBe(false);
  });
});

describe('clockText', () => {
  it('formats hours', () => expect(clockText(14.25)).toBe('14:15'));
});

describe('PhotoWall', () => {
  it('pins shots inside the cork and keeps the newest when full', () => {
    const w = new PhotoWall({ ...P, maxKept: 3 });
    const r = createRandom(3);
    for (let i = 0; i < 5; i++) w.add(shot(i), r);
    expect(w.photos).toHaveLength(3);
    expect(w.photos[0].data.endsWith('2')).toBe(true);
    for (const ph of w.photos) {
      expect(ph.x).toBeGreaterThan(0);
      expect(ph.x).toBeLessThan(1);
      expect(Math.abs(ph.tilt)).toBeLessThanOrEqual(P.tiltMax);
    }
  });
  it('is the same wall for the same random stream', () => {
    const a = new PhotoWall();
    const b = new PhotoWall();
    a.add(shot(1), createRandom(5));
    b.add(shot(1), createRandom(5));
    expect(a.toJSON()).toEqual(b.toJSON());
  });
  it('cools down between shots', () => {
    const w = new PhotoWall();
    expect(w.cooling).toBe(0);
    w.add(shot(1), createRandom(1));
    expect(w.cooling).toBeCloseTo(P.cooldown);
    w.update(P.cooldown + 0.1);
    expect(w.cooling).toBe(0);
  });
  it('round-trips through the save and drops junk', () => {
    const w = new PhotoWall();
    w.add(shot(1), createRandom(1));
    w.add(shot(2), createRandom(2));
    const saved = JSON.parse(JSON.stringify(w.toJSON()));
    const w2 = new PhotoWall();
    w2.restore([...saved, { data: 'javascript:1', x: 0.5, y: 0.5 }, null, { data: 'data:image/jpeg;base64,x' }]);
    expect(w2.toJSON()).toEqual(w.toJSON());
    w2.restore(undefined);
    expect(w2.photos).toHaveLength(2);
  });
  it('spreads prints apart', () => {
    const w = new PhotoWall();
    const r = createRandom(11);
    for (let i = 0; i < 6; i++) w.add(shot(i), r);
    const minGap = Math.min(...w.photos.flatMap((a, i) => w.photos.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y))));
    expect(minGap).toBeGreaterThan(0.08);
  });
});

import { REACTIONS } from '../src/npc/reactions.js';
import { CHARACTERS } from '../src/npc/characters.js';
import { AMY_PHOTO_LINES, JESS_PHOTO_LINES } from '../src/npc/photoLines.js';

describe('the girls and the camera', () => {
  it('has the three reactions and their lines', () => {
    for (const r of ['pose', 'face', 'palm']) expect(REACTIONS[r]).toBeTruthy();
    for (const k of ['photoPose', 'photoFace', 'photoPutAway', 'photoWall']) {
      expect(AMY_PHOTO_LINES[k].lines.length).toBeGreaterThan(0);
      expect(JESS_PHOTO_LINES[k].length).toBeGreaterThan(0);
    }
  });
  it('has Amy put it away more than Jess, and Jess pull faces more than Amy', () => {
    const amy = CHARACTERS.find((c) => c.id === 'amy').params;
    const jess = CHARACTERS.find((c) => c.id === 'jess').params;
    expect(amy.photoPalm).toBeGreaterThan(jess.photoPalm);
    expect(jess.photoFace).toBeGreaterThan(amy.photoFace);
  });
});
