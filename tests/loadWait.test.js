import { describe, expect, it } from 'vitest';
import { LOAD_TIMEOUT_MS, loadStepLines, waitForReady } from '../tools/frameBudgetRun.mjs';

// A stand-in page: waitForFunction times out, evaluate answers the two questions the timeout asks (what is there, and the steps seen).
const page = ({ got, steps = [] }) => ({
  waitForFunction: async () => { throw new Error('timed out'); },
  evaluate: async (fn) => (String(fn).includes('__loadSteps') ? steps : got),
});

describe('waiting for the game to load (#760)', () => {
  it('has one limit for the smoke test and the budget run, with room for a slow runner', () => {
    expect(LOAD_TIMEOUT_MS).toBe(300000);
  });

  it('says which of the game object, the companions and the Ready status were missing', async () => {
    const p = page({ got: { game: true, companions: false, status: 'Building world…', href: 'http://x/?smoke' }, steps: [[1.2, 'Loading models…'], [2.4, 'Building world…']] });
    const err = await waitForReady(p, { timeout: 1000 }).catch((e) => e);
    expect(err.message).toContain('still loading after 1 s');
    expect(err.message).toContain('missing: the companions, the Ready status (it says "Building world…")');
    expect(err.message).not.toContain('the game object');
    expect(err.message).toContain('Building world…');
  });

  it('names the game object when there is none, and the page when it has gone', async () => {
    const none = await waitForReady(page({ got: { game: false, companions: false, status: 'Loading…', href: 'h' } })).catch((e) => e);
    expect(none.message).toContain('missing: the game object, the companions, the Ready status');
    const gone = await waitForReady(page({ got: null })).catch((e) => e);
    expect(gone.message).toContain('missing: the page (gone)');
  });

  it('lists each loading step once, at the time it first showed', async () => {
    const lines = await loadStepLines(page({ steps: [[0.4, 'Loading…'], [1.5, 'Loading sounds… 1/8'], [1.9, 'Loading sounds… 2/8'], [2.1, 'Ready']] }));
    expect(lines).toEqual(['   0.4 s  Loading…', '   1.5 s  Loading sounds… 1/8', '   2.1 s  Ready']);
  });
});
