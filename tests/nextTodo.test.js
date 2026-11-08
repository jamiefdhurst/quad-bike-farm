import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dependsOn, eligible } from '../tools/nextTodo.mjs';

const issue = (number, milestone, extra = {}) => ({ number, title: `t${number}`, body: '', labels: [], milestone, ...extra });
const order = (issues, open, pr, opts) => eligible(issues, open ?? issues.map((i) => i.number), pr, opts).map((i) => i.number);

describe('which issue /todo takes next', () => {
  it('reads the numbers on a Depends on line, and none without one', () => {
    expect(dependsOn('Words.\n\nDepends on: #662, #661, #360')).toEqual([662, 661, 360]);
    expect(dependsOn('Mentions #5 but depends on nothing')).toEqual([]);
    expect(dependsOn(undefined)).toEqual([]);
  });

  it('takes the earliest milestone by title, then the lowest number', () => {
    const issues = [issue(700, '5 · Ready for players'), issue(681, '1 · The new map'), issue(662, '0 · Foundations'), issue(661, '0 · Foundations'), issue(117, 'Alongside')];
    expect(order(issues)).toEqual([661, 662, 681, 700]);
  });

  it('puts a 🔜 next issue first, wherever it sits', () => {
    const issues = [issue(661, '0 · Foundations'), issue(117, 'Alongside', { labels: ['🔜 next'] }), issue(5, null, { labels: ['🔜 next'] })];
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

  it('takes Alongside only when asked, and never an issue without a milestone', () => {
    const issues = [issue(300, null), issue(118, 'Alongside'), issue(117, 'Alongside'), issue(661, '0 · Foundations')];
    expect(order(issues)).toEqual([661]);
    expect(order(issues, undefined, [], { alongside: true })).toEqual([117, 118]);
    const next = [issue(661, '0 · Foundations', { labels: ['🔜 next'] }), issue(118, 'Alongside')];
    expect(order(next, undefined, [], { alongside: true })).toEqual([118]);
  });
});

describe('the milestones', () => {
  const titles = ['0 · Foundations', '1 · The new map', '2 · The farmstead', '3 · Crops', '4 · Pulled together', '5 · Ready for players', 'Alongside'];

  it('are in .github/settings.yml, open, in the order the plan runs them', () => {
    const yml = readFileSync('.github/settings.yml', 'utf8');
    const found = [...yml.matchAll(/^ {2}- title: "?([^"\n]+?)"?\s*$/gm)].map((m) => m[1]);
    expect(found).toEqual(titles);
    expect(yml.match(/state: open/g)?.length).toBeGreaterThanOrEqual(titles.length);
  });

  it('each has a section in docs/farm-plan.md', () => {
    const plan = readFileSync('docs/farm-plan.md', 'utf8');
    for (const t of titles) expect(plan).toContain(`### ${t}`);
  });
});
