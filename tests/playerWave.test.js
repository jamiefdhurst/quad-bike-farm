import { describe, it, expect } from 'vitest';
import { answerWave, DEFAULT_WAVE_PARAMS as P } from '../src/npc/playerWave.js';

const base = { distance: 10, state: 'idle', askable: true, canPullUp: false, canRemark: true, since: 99 };
const lo = () => 0;
const hi = () => 0.99;

describe('answerWave', () => {
  it('waves back when close and stood about', () => {
    expect(answerWave(base, P, 'amy', hi)).toEqual({ kind: 'waveBack', face: false });
  });
  it('has Jess pull a face too, sometimes', () => {
    expect(answerWave(base, P, 'jess', lo).face).toBe(true);
    expect(answerWave(base, P, 'jess', hi).face).toBe(false);
    expect(answerWave(base, P, 'amy', lo).face).toBe(false);
  });
  it('waves back while walking, not while busy', () => {
    expect(answerWave({ ...base, state: 'walking', canRemark: false }, P, 'amy')?.kind).toBe('waveBack');
    expect(answerWave({ ...base, state: 'seated', canRemark: false }, P, 'amy')).toBe(null);
  });
  it('calls a free girl over from further off', () => {
    expect(answerWave({ ...base, distance: 50 }, P, 'amy')?.kind).toBe('comeOver');
    expect(answerWave({ ...base, distance: 50, askable: false }, P, 'amy')).toBe(null);
  });
  it('ignores a wave from too far to see', () => {
    expect(answerWave({ ...base, distance: P.callRange + 1 }, P, 'amy')).toBe(null);
  });
  it('makes a driving girl pull up, if she is in a plain drive', () => {
    const d = { ...base, state: 'driving', distance: 12, canRemark: false };
    expect(answerWave({ ...d, canPullUp: true }, P, 'amy')?.kind).toBe('pullUp');
    expect(answerWave(d, P, 'amy')).toBe(null);
  });
  it('answers once in a while, not every press', () => {
    expect(answerWave({ ...base, since: 1 }, P, 'amy')).toBe(null);
  });
});
