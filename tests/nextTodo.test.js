import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ALONGSIDE, AREAS, BATCH_SIZE, NOT_BATCHED, batch, batchLabels, checkBatch, byMilestone, currentPhase, dependsOn, eligible, goesWith, unbatchable } from '../tools/nextTodo.mjs';

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

// `/todo batch` takes up to four small issues that belong together, as one PR (#1180).
describe('which issues a batch takes', () => {
  const MAP = '1 · The new map';
  const bug = (number, extra = {}) => issue(number, MAP, { labels: ['🐛 bug', '🌾 world'], ...extra });
  const take = (issues, opts) => batch(eligible(issues, issues.map((i) => i.number), [], opts)).map((i) => i.number);

  it('starts from the next eligible issue and takes up to three more in its milestone that share an area label', () => {
    const issues = [bug(1122), bug(1123), bug(1124), bug(1125), bug(1126)];
    expect(take(issues)).toEqual([1122, 1123, 1124, 1125]);
    expect(BATCH_SIZE).toBe(4);
  });

  it('takes bugs and enhancements alike, but not a feature or a task', () => {
    const issues = [
      bug(10), bug(11, { labels: ['⚡ enhancement', '🌾 world'] }), bug(12, { labels: ['✨ feature', '🌾 world'] }), bug(13, { labels: ['🔨 task', '🌾 world'] }),
    ];
    expect(take(issues)).toEqual([10, 11]);
    expect(unbatchable(issues[2])).toEqual(['not a 🐛 bug or ⚡ enhancement']);
  });

  it('leaves out one in another milestone, or with no area label in common', () => {
    const issues = [bug(10), bug(11, { milestone: '2 · The farmstead' }), bug(12, { labels: ['🐛 bug', '👭 girls'] }), bug(13, { labels: ['🐛 bug', '👭 girls', '🌾 world'] })];
    expect(take(issues)).toEqual([10, 13]);
    expect(goesWith(issues[0], issues[1])).toEqual(['in 2 · The farmstead, not 1 · The new map']);
    expect(goesWith(issues[0], issues[2])).toEqual(['no area label in common with #10']);
  });

  it('starts no batch before milestone 1, without a milestone, or from an issue of more than 12 lines', () => {
    const big = Array.from({ length: 13 }, (_, k) => `- line ${k}`).join('\n');
    const issues = [bug(5, { milestone: '0 · Foundations' }), bug(6, { milestone: null, labels: ['🐛 bug', '🌾 world', '🔜 next'] }), bug(7, { body: big }), bug(8), bug(9)];
    expect(take(issues)).toEqual([8, 9]);
    expect(unbatchable(issues[0])).toEqual(['in 0 · Foundations, before milestone 1']);
    expect(unbatchable(issues[2])).toEqual(['13 lines of work, more than 12']);
  });

  it('skips what /todo skips: held back, with a PR, or waiting on an open issue', () => {
    const issues = [bug(10), bug(11, { labels: ['🐛 bug', '🌾 world', '💤 later'] }), bug(12, { body: 'Depends on: #10' }), bug(13), bug(14)];
    expect(batch(eligible(issues, issues.map((i) => i.number), [13])).map((i) => i.number)).toEqual([10, 14]);
  });

  it('leaves performance and cohesion issues to /perf and /tidy', () => {
    const issues = [bug(10, { labels: ['⚡ enhancement', '🌾 world', '🚀 performance'] }), bug(11, { labels: ['🐛 bug', '🌾 world', '🧩 cohesion'] }), bug(12)];
    expect(take(issues)).toEqual([12]);
    expect(unbatchable(issues[0])).toEqual(['labelled 🚀 performance, which /perf works alone']);
  });

  it('is empty when nothing can start one', () => {
    expect(take([issue(1, MAP, { labels: ['✨ feature', '🌾 world'] })])).toEqual([]);
  });

  it('gives the PR every area label and one type label, a bug if any of them is one', () => {
    expect(batchLabels([bug(1, { labels: ['⚡ enhancement', '🌾 world'] }), bug(2, { labels: ['🐛 bug', '🌾 world', '🔊 sound'] })])).toEqual(['🐛 bug', '🌾 world', '🔊 sound']);
    expect(batchLabels([bug(1, { labels: ['⚡ enhancement', '👭 girls'] })])).toEqual(['⚡ enhancement', '👭 girls']);
  });

  it('checks the ones Jamie names: eligible, going with the first, at most four, none twice', () => {
    const issues = [bug(10), bug(11), bug(12, { labels: ['✨ feature', '🌾 world'] }), bug(13, { labels: ['🐛 bug', '👭 girls'] }), bug(14), bug(15)];
    const ordered = eligible(issues, issues.map((i) => i.number), [11]);
    expect(checkBatch([10, 14], issues, ordered)).toEqual([]);
    expect(checkBatch([10, 11, 12, 13, 99], issues, ordered)).toEqual([
      [0, ['5 issues, more than 4']],
      [11, ['not eligible']],
      [12, ['not a 🐛 bug or ⚡ enhancement']],
      [13, ['no area label in common with #10']],
      [99, ['not an open issue']],
    ]);
    expect(checkBatch([10, 10], issues, ordered)).toEqual([[0, ['an issue named twice']]]);
  });

  it('knows every area label in .github/settings.yml, and the file has no other', () => {
    const yml = readFileSync('.github/settings.yml', 'utf8');
    for (const a of AREAS) expect(yml).toContain(`name: "${a}"`);
    // The area group runs from "Which part of the game" to the 🔜 next label; performance and cohesion sit in it but are worked by /perf and /tidy.
    const group = yml.split('# Which part of the game.')[1].split('name: "🔜 next"')[0];
    const names = [...group.matchAll(/name: "([^"]+)"/g)].map((m) => m[1]);
    expect(names.filter((n) => !NOT_BATCHED.includes(n))).toEqual(AREAS);
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
