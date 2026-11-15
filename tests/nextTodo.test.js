import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ALONGSIDE, byMilestone, currentPhase, dependsOn, eligible } from '../tools/nextTodo.mjs';

const issue = (number, milestone, extra = {}) => ({ number, title: `t${number}`, body: '', labels: [], milestone, ...extra });
const order = (issues, open, pr, opts) => eligible(issues, open ?? issues.map((i) => i.number), pr, opts).map((i) => i.number);

describe('which issue /todo takes next', () => {
  it('reads the numbers on a Depends on line, and none without one', () => {
    expect(dependsOn('Words.\n\nDepends on: #662, #661, #360')).toEqual([662, 661, 360]);
    expect(dependsOn('Mentions #5 but depends on nothing')).toEqual([]);
    expect(dependsOn(undefined)).toEqual([]);
  });

  it('takes the earliest milestone in run order, then the lowest number', () => {
    const issues = [
      issue(700, '13 · Ready for players'), issue(681, '1 · The new map'), issue(662, '0 · Foundations'), issue(661, '0 · Foundations'),
      issue(117, '6 · Engines and sound'), issue(118, '10 · What the girls wear'),
    ];
    expect(order(issues)).toEqual([661, 662, 681, 117, 118, 700]);
  });

  it('sorts milestones by the number they start with, so 10 comes after 9', () => {
    expect(['13 · c', '10 · b', '9 · a', '2 · z', 'No number'].sort(byMilestone)).toEqual(['2 · z', '9 · a', '10 · b', '13 · c', 'No number']);
  });

  it('puts a 🔜 next issue first, wherever it sits', () => {
    const issues = [issue(661, '0 · Foundations'), issue(117, '6 · Engines and sound', { labels: ['🔜 next'] }), issue(5, null, { labels: ['🔜 next'] })];
    expect(order(issues)).toEqual([5, 117, 661]);
  });

  it('skips held-back issues and ones with a PR', () => {
    const issues = ['❓ question', '🤦‍♂️ wontfix', '🧪 testing', '💤 later'].map((l, n) => issue(10 + n, '0 · Foundations', { labels: [l] }));
    issues.push(issue(20, '0 · Foundations'), issue(21, '0 · Foundations'));
    expect(order(issues, undefined, [20])).toEqual([21]);
  });

  it('waits for an issue whose dependencies are still open', () => {
    const issues = [issue(681, '1 · The new map', { body: 'Depends on: #662, #661' }), issue(661, '0 · Foundations'), issue(662, '0 · Foundations', { body: 'Depends on: #661' })];
    expect(order(issues)).toEqual([661]);
    // With 661 and 662 closed (not in the open list), 681 is free.
    expect(order([issues[0]], [681])).toEqual([681]);
  });

  it('gives alongside only the alongside milestones, earliest first, and never an issue without a milestone', () => {
    const issues = [
      issue(300, null), issue(118, '9 · How the girls move'), issue(117, '9 · How the girls move'), issue(852, '6 · Engines and sound'),
      issue(661, '1 · The new map'), issue(700, '13 · Ready for players'),
    ];
    expect(order(issues)).toEqual([661, 852, 117, 118, 700]);
    expect(order(issues, undefined, [], { alongside: true })).toEqual([852, 117, 118]);
    const next = [issue(661, '1 · The new map', { labels: ['🔜 next'] }), issue(118, '9 · How the girls move')];
    expect(order(next, undefined, [], { alongside: true })).toEqual([118]);
  });

  it('gives /tidy and /perf only their label, in the current phase or an alongside milestone', () => {
    const tidy = { labels: ['🧩 cohesion'] };
    const issues = [
      issue(126, '0 · Foundations', tidy), issue(412, '5 · Pulled together', tidy), issue(300, "11 · The girls' days", tidy),
      issue(661, '0 · Foundations'), issue(175, '13 · Ready for players', { labels: ['🚀 performance'] }),
    ];
    expect(currentPhase(issues)).toBe('0 · Foundations');
    expect(order(issues, undefined, [], { label: '🧩 cohesion' })).toEqual([126, 300]);
    expect(order(issues, undefined, [], { label: '🚀 performance' })).toEqual([]);
    // Once Foundations is done, the next phase is current and its cohesion issues come up.
    const later = issues.filter((i) => i.milestone !== '0 · Foundations');
    expect(currentPhase(later)).toBe('5 · Pulled together');
    expect(order(later, undefined, [], { label: '🧩 cohesion' })).toEqual([412, 300]);
    // With the map's phases done, an alongside milestone is current, and Ready for players still waits.
    const after = later.filter((i) => i.milestone !== '5 · Pulled together');
    expect(currentPhase(after)).toBe("11 · The girls' days");
    expect(order(after, undefined, [], { label: '🚀 performance' })).toEqual([]);
  });

  it('keeps a labelled issue waiting on its Depends on line', () => {
    const tidy = { labels: ['🧩 cohesion'] };
    const issues = [issue(130, '0 · Foundations', { ...tidy, body: 'Depends on: #661' }), issue(661, '0 · Foundations')];
    expect(order(issues, undefined, [], { label: '🧩 cohesion' })).toEqual([]);
  });
});

describe('the milestones', () => {
  const titles = ['0 · Foundations', '1 · The new map', '2 · The farmstead', '3 · Crops', '4 · The vehicles', '5 · Pulled together', ...ALONGSIDE, '13 · Ready for players'];

  it('are in .github/settings.yml, each open or closed, in the order the plan runs them', () => {
    const yml = readFileSync('.github/settings.yml', 'utf8');
    const found = [...yml.matchAll(/^ {2}- title: "?([^"\n]+?)"?\s*$/gm)].map((m) => m[1]);
    expect(found).toEqual(titles);
    const states = [...yml.matchAll(/^ {4}state: (\w+)$/gm)].map((m) => m[1]);
    expect(states).toHaveLength(titles.length);
    for (const s of states) expect(['open', 'closed']).toContain(s);
    expect([...found].sort(byMilestone)).toEqual(found);
  });

  it('keep the alongside ones together, after the map\'s phases and before Ready for players', () => {
    expect(ALONGSIDE.map((t) => Number(/^\d+/.exec(t)[0]))).toEqual([6, 7, 8, 9, 10, 11, 12]);
  });

  it('each has a section in docs/farm-plan.md', () => {
    const plan = readFileSync('docs/farm-plan.md', 'utf8');
    for (const t of titles) expect(plan).toContain(`### ${t}`);
  });
});
