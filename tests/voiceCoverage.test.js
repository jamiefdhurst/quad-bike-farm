import { describe, it, expect } from 'vitest';
import { spokenLines, unrecordedLines } from '../src/audio/voiceCoverage.js';

const amy = { id: 'amy', lines: { hello: { lines: ['Hi.', 'Hello.', () => 'computed'] }, bye: { lines: ['Hi.', 'Bye.'] } } };
const banter = [{ lines: [['amy', 'Oi.'], ['jess', 'Not me.']] }];

describe('lines with no recording', () => {
  it('gathers each written line once with the situations it is said in, skipping computed ones and the other girl', () => {
    expect(spokenLines(amy, banter)).toEqual({ 'Hi.': ['hello', 'bye'], 'Hello.': ['hello'], 'Bye.': ['bye'], 'Oi.': ['banter'] });
  });

  it('lists the ones missing from the bank', () => {
    const clips = { 'Hi.': {}, 'Bye.': {} };
    expect(unrecordedLines(amy, clips, banter).map((l) => l.text)).toEqual(['Hello.', 'Oi.']);
    expect(unrecordedLines(amy, { 'Hi.': 1, 'Hello.': 1, 'Bye.': 1, 'Oi.': 1 }, banter)).toEqual([]);
  });

  it('counts everything as missing with no bank', () => {
    expect(unrecordedLines(amy, undefined, banter)).toHaveLength(4);
  });
});
