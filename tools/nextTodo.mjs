// The issues /todo takes next, in order (.claude/commands/todo.md; the phases are the milestones in .github/settings.yml).
//
//   node tools/nextTodo.mjs [alongside] [count]    prints the next few eligible issues, as "#n title (milestone)"
//   node tools/nextTodo.mjs --label "🧩 cohesion"   the same for /tidy (or "🚀 performance" for /perf): only that label, and only
//                                                  the current phase or the alongside milestones
//   node tools/nextTodo.mjs batch [alongside]      the next issue a batch can start from and up to three more that go with it (#1180), then the
//                                                  labels the PR carries; `batch 1122 1123` checks that the ones Jamie names can go together

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { MAX_WORK, ownWork } from './issueLint.mjs';

export const SKIP_LABELS = ['❓ question', '🤦‍♂️ wontfix', '🧪 testing', '💤 later'];
export const NEXT_LABEL = '🔜 next';
// Work that doesn't depend on where things are: phases of their own after the map's, which `/todo alongside` takes while those run.
export const ALONGSIDE = [
  '6 · Engines and sound', '7 · More from the vehicles', '8 · The workshop', '9 · How the girls move', '10 · What the girls wear',
  "11 · The girls' days", '12 · The world and you',
];
// What no phase waits on (#1181): after the alongside milestones and before Ready for players, and not one of them, so `/todo alongside`
// leaves it and plain `/todo` reaches it once 12 is done. It runs by its number like the rest; the name is here for the tests and the docs.
export const POLISH = '13 · Polish';
export const READY = '14 · Ready for players';

// Which part of the game an issue is about (the second group in .github/settings.yml). A batch shares one of these.
export const AREAS = ['👭 girls', '🏍️ vehicles', '⚙️ engine', '🌾 world', '🔊 sound', '🧰 items', '🖥️ interface'];
// A batch is only patch-bump work, so its one PR releases as the same version any of them would alone.
export const BATCH_TYPES = ['🐛 bug', '⚡ enhancement'];
export const BATCH_SIZE = 4;
// Worked by /perf (measured before and after) and /tidy (checked for drift), each in its own way, so never in a batch.
export const NOT_BATCHED = ['🚀 performance', '🧩 cohesion'];

/** Milestones in run order: by the number their title starts with (so 10 comes after 9), then by title; one without a number last. */
export function byMilestone(a, b) {
  const n = (t) => (/^\d+/.test(t) ? Number(/^\d+/.exec(t)[0]) : Infinity);
  return n(a) - n(b) || (a < b ? -1 : a > b ? 1 : 0);
}

/** The issue numbers on a body's "Depends on:" line ("Depends on: #662, #661"); none if it has no such line. */
export function dependsOn(body) {
  const line = /^\s*Depends on:(.*)$/im.exec(body ?? '');
  return line ? [...line[1].matchAll(/#(\d+)/g)].map((m) => Number(m[1])) : [];
}

/** The phase being worked: the earliest milestone in run order that any open issue is in (null if none). */
export function currentPhase(issues) {
  const titles = issues.map((i) => i.milestone).filter(Boolean).sort(byMilestone);
  return titles[0] ?? null;
}

/**
 * Open issues ({ number, title, body, labels: [names], milestone: title or null }) in the order /todo takes them.
 * `openNumbers` is every open issue's number (a dependency is met when it isn't in it); `withPr` the numbers with an open PR.
 * A `🔜 next` issue comes first (the lowest-numbered, in any milestone or none), then the earliest milestone in run order, then number.
 * `alongside` takes only the alongside milestones, `🔜 next` or not; an issue with no milestone is only picked by `🔜 next`.
 * `label` (for /tidy and /perf) takes only issues with that label, in the current phase or an alongside milestone: a later phase's waits.
 */
export function eligible(issues, openNumbers, withPr = [], { alongside = false, label = null } = {}) {
  if (label) {
    const phase = currentPhase(issues);
    const now = issues.filter((i) => i.labels.includes(label) && (ALONGSIDE.includes(i.milestone) || (i.milestone && i.milestone === phase)));
    return eligible(now, openNumbers, withPr);
  }
  const open = new Set(openNumbers);
  const pr = new Set(withPr);
  const ok = (i) =>
    !i.labels.some((l) => SKIP_LABELS.includes(l)) && !pr.has(i.number) && dependsOn(i.body).every((n) => !open.has(n));
  const inScope = (i) => i.milestone && (!alongside || ALONGSIDE.includes(i.milestone));
  const byNumber = (a, b) => a.number - b.number;
  const next = issues.filter((i) => ok(i) && i.labels.includes(NEXT_LABEL) && (!alongside || inScope(i))).sort(byNumber);
  const rest = issues
    .filter((i) => ok(i) && inScope(i) && !i.labels.includes(NEXT_LABEL))
    .sort((a, b) => byMilestone(a.milestone, b.milestone) || byNumber(a, b));
  return [...next, ...rest];
}

const milestoneNumber = (t) => (/^\d+/.test(t ?? '') ? Number(/^\d+/.exec(t)[0]) : null);

/**
 * Why an issue can't be in a batch ([] if it can): a bug or an enhancement, with an area label, in milestone 1 or later, and at most MAX_WORK lines of
 * its own work (settled with Jamie on #1180, 25 November 2026); not a performance or cohesion issue.
 */
export function unbatchable(i) {
  const why = [];
  if (!i.labels.some((l) => BATCH_TYPES.includes(l))) why.push(`not a ${BATCH_TYPES.join(' or ')}`);
  if (!i.labels.some((l) => AREAS.includes(l))) why.push('no area label');
  for (const l of i.labels.filter((x) => NOT_BATCHED.includes(x))) why.push(`labelled ${l}, which ${l === '🚀 performance' ? '/perf' : '/tidy'} works alone`);
  if (!(milestoneNumber(i.milestone) >= 1)) why.push(i.milestone ? `in ${i.milestone}, before milestone 1` : 'no milestone');
  const n = ownWork(i.body, i.title).length;
  if (n > MAX_WORK) why.push(`${n} lines of work, more than ${MAX_WORK}`);
  return why;
}

/** Whether `other` goes in a batch led by `lead`: the same milestone and an area label in common, as well as batchable itself. */
export function goesWith(lead, other) {
  const why = unbatchable(other);
  if (other.milestone && other.milestone !== lead.milestone) why.push(`in ${other.milestone}, not ${lead.milestone}`);
  if (!other.labels.some((l) => AREAS.includes(l) && lead.labels.includes(l))) why.push(`no area label in common with #${lead.number}`);
  return why;
}

/** A batch from issues in /todo's order (what `eligible` gives): the first batchable one, then up to three more that go with it, in the same order. */
export function batch(ordered, size = BATCH_SIZE) {
  const lead = ordered.find((i) => !unbatchable(i).length);
  if (!lead) return [];
  return [lead, ...ordered.filter((i) => i !== lead && !goesWith(lead, i).length).slice(0, size - 1)];
}

/**
 * Why the issues Jamie names (by number, in his order) can't be one batch: [[number, reasons]], empty if they can. `issues` is every open issue and
 * `ordered` the eligible ones; the first named leads.
 */
export function checkBatch(numbers, issues, ordered) {
  const problems = [];
  if (new Set(numbers).size < numbers.length) problems.push([0, ['an issue named twice']]);
  if (numbers.length > BATCH_SIZE) problems.push([0, [`${numbers.length} issues, more than ${BATCH_SIZE}`]]);
  const chosen = [...new Set(numbers)].map((n) => issues.find((i) => i.number === n) ?? null);
  chosen.forEach((i, k) => {
    const n = [...new Set(numbers)][k];
    if (!i) return problems.push([n, ['not an open issue']]);
    const why = [...(ordered.includes(i) ? [] : ['not eligible']), ...(k ? goesWith(chosen[0] ?? i, i) : unbatchable(i))];
    if (why.length) problems.push([n, why]);
  });
  return problems;
}

/** The labels a batch's PR carries: the area labels of every issue in it, and one type label, `🐛 bug` if any of them is one. */
export function batchLabels(issues) {
  const type = issues.some((i) => i.labels.includes('🐛 bug')) ? '🐛 bug' : '⚡ enhancement';
  const areas = AREAS.filter((a) => issues.some((i) => i.labels.includes(a)));
  return [type, ...areas];
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const gh = (args) => JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  const raw = gh(['issue', 'list', '--state', 'open', '--limit', '1000', '--json', 'number,title,body,labels,milestone']);
  const issues = raw.map((i) => ({ ...i, labels: i.labels.map((l) => l.name), milestone: i.milestone?.title ?? null }));
  const withPr = gh(['pr', 'list', '--state', 'open', '--limit', '200', '--json', 'body,headRefName'])
    // "Part of" too, so an issue of a batch PR that it won't close still counts as taken (#1180).
    .flatMap((p) => [...`${p.body ?? ''} ${p.headRefName}`.matchAll(/(?:closes|fixes|resolves|part of) #(\d+)|issue-(\d+)/gi)].map((m) => Number(m[1] ?? m[2])));
  const at = process.argv.indexOf('--label');
  const label = at > 0 ? process.argv[at + 1] : null;
  const opts = { alongside: process.argv.includes('alongside'), label };
  const ordered = eligible(issues, issues.map((x) => x.number), withPr, opts);
  const show = (i) => `#${i.number} ${i.title} (${i.milestone ?? 'no milestone'})`;
  const numbers = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
  if (process.argv.includes('batch')) {
    let chosen = batch(ordered);
    if (numbers.length) {
      // Ones Jamie names: each must be eligible and go with the first.
      const problems = checkBatch(numbers, issues, ordered);
      for (const [n, why] of problems) console.error(n ? `#${n} can't go in this batch: ${why.join('; ')}` : `not a batch: ${why.join('; ')}`);
      if (problems.length) process.exit(1);
      chosen = numbers.map((n) => issues.find((i) => i.number === n));
    }
    if (!chosen.length) {
      console.log('No batch: no eligible bug or enhancement with an area label in milestone 1 or later.');
      process.exit(0);
    }
    for (const i of chosen) console.log(show(i));
    console.log(`labels: ${batchLabels(chosen).map((l) => `--label "${l}"`).join(' ')}`);
  } else {
    for (const i of ordered.slice(0, numbers[0] ?? 5)) console.log(show(i));
  }
}
