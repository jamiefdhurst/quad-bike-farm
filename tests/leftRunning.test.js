import { describe, it, expect } from 'vitest';
import { LeftRunning, leftRunningSituation, DEFAULT_LEFT_PARAMS as P } from '../src/npc/leftRunning.js';
import { AMY_LEFT_LINES, JESS_LEFT_LINES } from '../src/npc/leftRunningLines.js';
import { VOICE_LINES } from '../src/npc/voiceLines.js';

const on = (who) => ({ running: true, attended: true, who });
const idle = { running: true, attended: false, who: null };

describe('left running', () => {
  it('blames whoever last had it once it has idled long enough', () => {
    const l = new LeftRunning({ ...P });
    l.record('farm300', 1, on('amy'));
    l.record('farm300', 1, idle);
    expect(l.culprit('farm300')).toBe(null);
    l.record('farm300', P.askAfter, idle);
    expect(l.culprit('farm300')).toBe('amy');
  });

  it('the blame follows the last one at the controls, not the first', () => {
    const l = new LeftRunning({ ...P });
    l.record('farm300', 1, on('jess'));
    l.record('farm300', 1, on('you'));
    l.record('farm300', P.askAfter, idle);
    expect(l.culprit('farm300')).toBe('you');
  });

  it('a passenger alone keeps the last driver in the frame, and anyone on it stops the clock', () => {
    const l = new LeftRunning({ ...P });
    l.record('farm300', 1, on('amy'));
    l.record('farm300', P.askAfter, idle);
    l.record('farm300', 1, { running: true, attended: true, who: null });
    expect(l.culprit('farm300')).toBe(null);
    l.record('farm300', P.askAfter, idle);
    expect(l.culprit('farm300')).toBe('amy');
  });

  it('nothing is left if the engine is off, or nobody ever had it', () => {
    const l = new LeftRunning({ ...P });
    l.record('farm300', 1, on('amy'));
    l.record('farm300', P.askAfter * 2, { running: false, attended: false, who: null });
    expect(l.culprit('farm300')).toBe(null);
    l.record('rb300', P.askAfter * 2, idle);
    expect(l.culprit('rb300')).toBe(null);
  });

  it('counts each time somebody leaves one once, and says "again" from the third', () => {
    const l = new LeftRunning({ ...P });
    for (let i = 0; i < 3; i++) {
      l.record('farm300', 1, on('you'));
      l.record('farm300', P.askAfter, idle);
      l.record('farm300', P.askAfter, idle); // still the same stretch of idling
    }
    expect(l.times('you')).toBe(3);
    expect(l.times('amy')).toBe(0);
    expect(leftRunningSituation('you', 2, P)).toBe('leftRunningYou');
    expect(leftRunningSituation('you', 3, P)).toBe('leftRunningYouAgain');
    expect(leftRunningSituation('amy', 9, P)).toBe('leftRunningAmy');
    expect(leftRunningSituation('jess', 0, P)).toBe('leftRunningJess');
  });
});

describe('lines', () => {
  it('both girls have a line for each way it can go, and they are in the main banks', () => {
    for (const k of ['leftRunningYou', 'leftRunningYouAgain', 'leftRunningAmy', 'leftRunningJess']) {
      expect(AMY_LEFT_LINES[k].lines.length).toBeGreaterThan(0);
      expect(JESS_LEFT_LINES[k].length).toBeGreaterThan(0);
      expect(VOICE_LINES[k]).toBeDefined();
    }
  });
});
