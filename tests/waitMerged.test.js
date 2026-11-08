import { describe, it, expect } from 'vitest';
import { latestChecks, verdict } from '../tools/waitMerged.mjs';

const run = (name, conclusion, startedAt = '2026-11-08T10:00:00Z', status = 'COMPLETED') => ({ name, conclusion, status, startedAt });
const pr = (extra) => ({ state: 'OPEN', mergeStateStatus: 'BLOCKED', autoMergeRequest: { mergeMethod: 'MERGE' }, statusCheckRollup: [], ...extra });

describe('waiting for a PR to merge', () => {
  it('is finished only once it has merged', () => {
    expect(verdict(pr({ state: 'MERGED', mergedAt: '2026-11-08T10:59:30Z' }))).toEqual({ done: true, ok: true, say: 'merged 2026-11-08T10:59:30Z' });
  });

  it('keeps waiting before any check has started, as just after a push', () => {
    expect(verdict(pr())).toMatchObject({ done: false });
  });

  it('keeps waiting while checks run, and after they pass until auto-merge merges it', () => {
    expect(verdict(pr({ statusCheckRollup: [run('Changes', 'SUCCESS'), run('Smoke', '', undefined, 'IN_PROGRESS')] }))).toMatchObject({ done: false, say: 'waiting on Smoke' });
    expect(verdict(pr({ statusCheckRollup: [run('Test', 'SUCCESS'), run('auto-merge', 'SKIPPED')] }))).toMatchObject({ done: false });
  });

  it('stops for a failed check, naming it', () => {
    const v = verdict(pr({ statusCheckRollup: [run('Smoke', 'FAILURE'), run('Test', 'FAILURE'), run('Changes', 'SUCCESS')] }));
    expect(v).toMatchObject({ done: true, ok: false });
    expect(v.say).toContain('Smoke, Test');
  });

  it('goes by the latest run of a check, not an older failure', () => {
    const rollup = [run('Version label', 'FAILURE', '2026-11-08T10:00:00Z'), run('Version label', 'SUCCESS', '2026-11-08T10:01:00Z')];
    expect(latestChecks(rollup)).toEqual([{ name: 'Version label', at: '2026-11-08T10:01:00Z', result: 'SUCCESS' }]);
    expect(verdict(pr({ statusCheckRollup: rollup }))).toMatchObject({ done: false });
  });

  it('stops for a closed PR, a conflict, or green checks with auto-merge off', () => {
    expect(verdict(pr({ state: 'CLOSED' }))).toMatchObject({ done: true, ok: false });
    expect(verdict(pr({ mergeStateStatus: 'DIRTY' }))).toMatchObject({ done: true, ok: false });
    expect(verdict(pr({ autoMergeRequest: null, statusCheckRollup: [run('Test', 'SUCCESS')] }))).toMatchObject({ done: true, ok: false });
  });
});
