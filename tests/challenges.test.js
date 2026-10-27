import { describe, it, expect } from 'vitest';
import {
  Challenges, ColdStartRun, CleanWatch, CHALLENGE_KINDS, DEFAULT_CHALLENGE_PARAMS as P, CHALLENGE_PARAM_RANGES,
  bayPlaces, judgeLineUp, headingGap, formatChallenge,
} from '../src/world/challenges.js';
import { LAYOUT } from '../src/world/layout.js';
import { Track } from '../src/world/track.js';
import { spawnKeepOut, spawnBlocked } from '../src/world/spawns.js';
import { AMY_CHALLENGE_LINES, JESS_CHALLENGE_LINES, CHALLENGE_LINE_KEYS } from '../src/npc/challengeLines.js';

const bays = bayPlaces(LAYOUT.lineUp);
const parkedIn = (bay, i, extra = {}) => ({ id: `q${i}`, x: bay.x, z: bay.z, yaw: bay.yaw, speed: 0, occupied: false, ...extra });

describe('the bays', () => {
  it('are side by side across the row, spacing apart, all facing the same way', () => {
    expect(bays).toHaveLength(LAYOUT.lineUp.bays);
    for (let i = 1; i < bays.length; i++) expect(Math.hypot(bays[i].x - bays[i - 1].x, bays[i].z - bays[i - 1].z)).toBeCloseTo(LAYOUT.lineUp.spacing);
    expect(new Set(bays.map((b) => b.yaw)).size).toBe(1);
  });

  it('are centred on the layout point', () => {
    const mx = bays.reduce((a, b) => a + b.x, 0) / bays.length;
    const mz = bays.reduce((a, b) => a + b.z, 0) / bays.length;
    expect(mx).toBeCloseTo(LAYOUT.lineUp.x);
    expect(mz).toBeCloseTo(LAYOUT.lineUp.z);
  });

  it('are clear of the farm furniture and the track', () => {
    const track = new Track(LAYOUT.trackPoints);
    const keepOut = spawnKeepOut(LAYOUT);
    const l = LAYOUT.lineUp;
    const fx = Math.sin(l.yaw);
    const fz = Math.cos(l.yaw);
    for (const b of bays) {
      for (const a of [-l.length / 2, 0, l.length / 2]) {
        const hit = spawnBlocked(keepOut, b.x + fx * a, b.z + fz * a, { track, trackHalfWidth: LAYOUT.trackHalfWidth });
        expect(hit, `${b.x},${b.z}`).toBe(null);
      }
    }
  });
});

describe('the sleepers', () => {
  const l = LAYOUT.lineUp;

  it('are spaced about 3 m apart, so slightly uneven parking still scores well', () => {
    expect(l.spacing).toBeGreaterThanOrEqual(3);
  });

  it('lie by the south hedge, inside it, with room for a quad at each and the field gate clear', () => {
    const noseEnd = l.z + (l.length / 2) * Math.cos(l.yaw);
    const hedgeFace = LAYOUT.fieldHalf - LAYOUT.hedgeThickness / 2;
    expect(noseEnd).toBeLessThan(hedgeFace - 0.8);
    expect(hedgeFace - noseEnd).toBeLessThan(3);
    for (const b of bays) expect(Math.abs(b.x - LAYOUT.gate.x)).toBeGreaterThan(LAYOUT.gate.width / 2 + 2.6);
  });

  it('keep the barn doors clear and the bale trailer well away', () => {
    const doors = { x: LAYOUT.barn.x + LAYOUT.barn.halfX, z: LAYOUT.barn.z };
    for (const b of bays) {
      expect(Math.hypot(b.x - doors.x, b.z - doors.z)).toBeGreaterThan(12);
      expect(Math.hypot(b.x - LAYOUT.trailer.x, b.z - LAYOUT.trailer.z)).toBeGreaterThan(8);
    }
  });
});

describe('judging the line-up', () => {
  it('gives full marks for every bay filled dead centre and straight', () => {
    const r = judgeLineUp(bays, bays.map(parkedIn), P);
    expect(r).toMatchObject({ score: 100, inBays: bays.length, ok: true });
  });

  it('marks a quad down for sitting off the middle or crooked', () => {
    const tidy = judgeLineUp(bays, bays.map((b, i) => parkedIn(b, i)), P).score;
    const off = judgeLineUp(bays, bays.map((b, i) => parkedIn(b, i, i === 0 ? { x: b.x + 0.5 } : {})), P).score;
    const crooked = judgeLineUp(bays, bays.map((b, i) => parkedIn(b, i, i === 0 ? { yaw: b.yaw + 0.3 } : {})), P).score;
    expect(off).toBeLessThan(tidy);
    expect(crooked).toBeLessThan(tidy);
    expect(off).toBeGreaterThan(70);
  });

  it('scores a quad pointing the other way no heading marks', () => {
    const r = judgeLineUp(bays, bays.map((b, i) => parkedIn(b, i, i === 0 ? { yaw: b.yaw + Math.PI } : {})), P);
    expect(r.score).toBe(Math.round(100 - (100 / bays.length) * P.headWeight));
  });

  it('does not count a moving quad, one with someone on it, or one outside the reach', () => {
    const quads = [parkedIn(bays[0], 0), parkedIn(bays[1], 1, { speed: 3 }), parkedIn(bays[2], 2, { occupied: true }), parkedIn(bays[3], 3, { x: bays[3].x + 5 })];
    const r = judgeLineUp(bays, quads, P);
    expect(r.inBays).toBe(1);
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/Only 1/);
  });

  it('puts a quad in one bay only', () => {
    const r = judgeLineUp(bays, [parkedIn(bays[0], 0)], { ...P, lineUpMin: 1 });
    expect(r.inBays).toBe(1);
  });

  it('wants lineUpMin quads before it will judge', () => {
    expect(judgeLineUp(bays, bays.slice(0, P.lineUpMin - 1).map(parkedIn), P).ok).toBe(false);
    expect(judgeLineUp(bays, bays.slice(0, P.lineUpMin).map(parkedIn), P).ok).toBe(true);
  });

  it('measures the smallest angle between headings', () => {
    expect(headingGap(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(0.2);
    expect(headingGap(0, Math.PI)).toBeCloseTo(Math.PI);
  });
});

describe('the cold start', () => {
  it('will not start with too few cold quads', () => {
    const run = new ColdStartRun(P);
    expect(run.start(['a'])).toBe(false);
    expect(run.active).toBe(false);
  });

  it('is done the moment the last cold quad has run, even if the first has stopped since', () => {
    const run = new ColdStartRun(P);
    expect(run.start(['a', 'b', 'c'])).toBe(true);
    expect(run.update(10, ['a'])).toBe(null);
    expect(run.update(10, ['b'])).toBe(null);
    expect(run.update(5, ['c'])).toBe('done');
    expect(run.time).toBe(25);
    expect(run.active).toBe(false);
  });

  it('is out when the limit passes', () => {
    const run = new ColdStartRun({ ...P, coldLimit: 60 });
    run.start(['a', 'b']);
    expect(run.update(59, ['a'])).toBe(null);
    expect(run.update(2, [])).toBe('out');
    expect(run.left.size).toBe(1);
    expect(run.update(1, ['b'])).toBe(null);
  });

  it('can be called off', () => {
    const run = new ColdStartRun(P);
    run.start(['a', 'b']);
    run.cancel();
    expect(run.update(1, ['a', 'b'])).toBe(null);
  });
});

describe('a clean climb', () => {
  it('is spoiled by a stall or a tip and cleared for the next run', () => {
    const w = new CleanWatch();
    expect(w.update({ running: true, tipped: false })).toBe(true);
    expect(w.update({ running: false, tipped: false })).toBe(false);
    expect(w.update({ running: true, tipped: false })).toBe(false);
    w.reset();
    expect(w.update({ running: true, tipped: true })).toBe(false);
  });
});

describe('the challenge bests', () => {
  it('keeps the lower time and the higher score, and ignores ties and junk', () => {
    const c = new Challenges(3);
    expect(c.submit('coldStart', 200).best).toBe(true);
    expect(c.submit('coldStart', 250).best).toBe(false);
    expect(c.submit('coldStart', 200).best).toBe(false);
    expect(c.submit('coldStart', 150)).toMatchObject({ best: true, previous: { value: 200 } });
    expect(c.submit('lineUp', 60).best).toBe(true);
    expect(c.submit('lineUp', 40).best).toBe(false);
    expect(c.submit('lineUp', 90).best).toBe(true);
    expect(c.submit('nonsense', 1).best).toBe(false);
    expect(c.submit('lineUp', 0).best).toBe(false);
  });

  it('marks one set today, after the first day', () => {
    const c = new Challenges(4);
    c.submit('cleanClimb', 50);
    expect(c.lines().find((l) => l.kind === 'cleanClimb').text).toContain('(today)');
    c.day = 5;
    expect(c.lines().find((l) => l.kind === 'cleanClimb').today).toBe(false);
    expect(new Challenges(1).lines().every((l) => !l.today)).toBe(true);
  });

  it('round-trips through the save and ignores junk', () => {
    const c = new Challenges(2);
    c.submit('lineUp', 77);
    c.submit('coldStart', 180);
    const d = new Challenges(9);
    d.restore(JSON.parse(JSON.stringify(c.toJSON())));
    expect(d.bests).toEqual(c.bests);
    const e = new Challenges(1);
    e.restore({ bests: { lineUp: 'x', coldStart: { value: -3 }, other: { value: 4 } } });
    expect(e.bests).toEqual({});
    e.restore(undefined);
    expect(e.bests).toEqual({});
  });

  it('writes a score and a time for the board', () => {
    expect(formatChallenge('lineUp', 87.2)).toBe('87 / 100');
    expect(formatChallenge('coldStart', 125)).toBe('2:05.0');
  });

  it('has a range for every tunable', () => {
    for (const k of Object.keys(P)) {
      const [min, max] = CHALLENGE_PARAM_RANGES[k];
      expect(P[k], k).toBeGreaterThanOrEqual(min);
      expect(P[k], k).toBeLessThanOrEqual(max);
    }
    expect(Object.keys(CHALLENGE_KINDS)).toEqual(['coldStart', 'lineUp', 'cleanClimb']);
  });
});

describe('what the girls say', () => {
  it('has lines for each outcome, with no dashes', () => {
    for (const k of CHALLENGE_LINE_KEYS) {
      expect(AMY_CHALLENGE_LINES[k].lines.length, k).toBeGreaterThan(0);
      expect(JESS_CHALLENGE_LINES[k].length, k).toBeGreaterThan(0);
      for (const l of [...AMY_CHALLENGE_LINES[k].lines, ...JESS_CHALLENGE_LINES[k]]) expect(l, l).not.toMatch(/—|–/);
    }
  });
});
