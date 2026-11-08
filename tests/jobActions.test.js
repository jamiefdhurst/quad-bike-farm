import { describe, it, expect } from 'vitest';
import { jobActions } from '../src/debug/jobActions.js';
import { buttonText, BUTTON_MAX } from '../src/debug/buttonText.js';

/** A stand-in game: every method it is asked for is a spy that records its name, and every number reads as 0. */
function standIn(missing = []) {
  const calls = [];
  const spy = (path) =>
    new Proxy(function () {}, {
      get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : spy(`${path}.${String(k)}`)),
      apply: (_, __, args) => (calls.push(`${path}(${args.join(',')})`), 0),
    });
  const g = new Proxy({ serviceJob: { id: 'red', name: 'Red', kinds: ['oil'], left: new Set(['oil']) } }, {
    get: (t, k) => (k in t ? t[k] : missing.includes(k) ? undefined : spy(`g.${String(k)}`)),
  });
  return { g, calls };
}

describe('the farm\'s jobs', () => {
  it('lists the jobs this farm has and leaves out the ones it has not', () => {
    const all = jobActions(standIn().g).jobs.map((j) => j.id);
    expect(all).toEqual(['muck', 'hay', 'mow', 'spray', 'harrow', 'silage', 'logs', 'bonfire', 'stove', 'feed', 'service', 'mot', 'photos']);
    const bare = jobActions(standIn(['hay', 'mowGrid', 'spray', 'harrow', 'logStack']).g).jobs.map((j) => j.id);
    expect(bare).not.toContain('hay');
    expect(bare).not.toContain('mow');
    expect(bare).not.toContain('spray');
    expect(bare).not.toContain('harrow');
    expect(bare).not.toContain('logs');
  });
  it('has the hay job\'s stages and extras the panel had', () => {
    const hay = jobActions(standIn().g).find('hay');
    expect(hay.actions.map((a) => a.verb)).toEqual(['cut', 'bale', 'load', 'stack', 'done', 'regrow', 'lift-tracks', 'empty-stack']);
  });
  it('calls the game method behind each action', () => {
    const { g, calls } = standIn();
    const jobs = jobActions(g);
    jobs.find('hay').actions.find((a) => a.verb === 'cut').run();
    jobs.find('muck').actions.find((a) => a.verb === 'done').run();
    jobs.find('spray').actions.find((a) => a.verb === 'boom-out').run();
    jobs.find('harrow').actions.find((a) => a.verb === 'down').run();
    jobs.find('service').actions.find((a) => a.verb === 'done').run();
    expect(calls).toEqual(['g.debugHayStage(cut)', 'g.farmJobs.debugFinishMuck()', 'g.debugSpray(out)', 'g.debugHarrow(down)', 'g.farmJobs.debugFinishService()']);
  });
  it('finds a job whatever the case, and none for a made-up name', () => {
    const jobs = jobActions(standIn().g);
    expect(jobs.find('HAY').id).toBe('hay');
    expect(jobs.find('sheep')).toBeUndefined();
  });
  it('gives every action a console word that is one token and a button label that fits one line with no early colon', () => {
    for (const job of jobActions(standIn().g).jobs) {
      for (const a of job.actions) {
        expect(a.verb).toMatch(/^[a-z-]+$/);
        // The panel cuts a label at ": " (buttonText.js), so a colon inside would leave only the words before it on the button.
        expect(a.label, `${job.id} ${a.verb}`).not.toContain(': ');
        expect(buttonText(a.label).text.length, `${job.id} ${a.verb}`).toBeLessThanOrEqual(BUTTON_MAX);
      }
    }
  });
});
