// The issues /todo takes next, in order (.claude/commands/todo.md; the phases are the milestones in .github/settings.yml).
//
//   node tools/nextTodo.mjs [alongside] [count]    prints the next few eligible issues, as "#n title (milestone)"

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const SKIP_LABELS = ['❓ question', '🤦‍♂️ wontfix', '🧪 testing', '💤 later'];
export const NEXT_LABEL = '🔜 next';
export const ALONGSIDE = 'Alongside';

/** The issue numbers on a body's "Depends on:" line ("Depends on: #662, #661"); none if it has no such line. */
export function dependsOn(body) {
  const line = /^\s*Depends on:(.*)$/im.exec(body ?? '');
  return line ? [...line[1].matchAll(/#(\d+)/g)].map((m) => Number(m[1])) : [];
}

/**
 * Open issues ({ number, title, body, labels: [names], milestone: title or null }) in the order /todo takes them.
 * `openNumbers` is every open issue's number (a dependency is met when it isn't in it); `withPr` the numbers with an open PR.
 * A `🔜 next` issue comes first (the lowest-numbered, in any milestone or none), then the earliest milestone by title, then number.
 * `alongside` takes only that milestone, `🔜 next` or not; otherwise it is left out, and an issue with no milestone is only picked by `🔜 next`.
 */
export function eligible(issues, openNumbers, withPr = [], { alongside = false } = {}) {
  const open = new Set(openNumbers);
  const pr = new Set(withPr);
  const ok = (i) =>
    !i.labels.some((l) => SKIP_LABELS.includes(l)) && !pr.has(i.number) && dependsOn(i.body).every((n) => !open.has(n));
  const inScope = (i) => i.milestone && (alongside ? i.milestone === ALONGSIDE : i.milestone !== ALONGSIDE);
  const byNumber = (a, b) => a.number - b.number;
  const next = issues.filter((i) => ok(i) && i.labels.includes(NEXT_LABEL) && (!alongside || inScope(i))).sort(byNumber);
  const rest = issues
    .filter((i) => ok(i) && inScope(i) && !i.labels.includes(NEXT_LABEL))
    .sort((a, b) => (a.milestone < b.milestone ? -1 : a.milestone > b.milestone ? 1 : byNumber(a, b)));
  return [...next, ...rest];
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const gh = (args) => JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  const raw = gh(['issue', 'list', '--state', 'open', '--limit', '1000', '--json', 'number,title,body,labels,milestone']);
  const issues = raw.map((i) => ({ ...i, labels: i.labels.map((l) => l.name), milestone: i.milestone?.title ?? null }));
  const withPr = gh(['pr', 'list', '--state', 'open', '--limit', '200', '--json', 'body,headRefName'])
    .flatMap((p) => [...`${p.body ?? ''} ${p.headRefName}`.matchAll(/(?:closes|fixes|resolves) #(\d+)|issue-(\d+)/gi)].map((m) => Number(m[1] ?? m[2])));
  const count = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 5);
  for (const i of eligible(issues, issues.map((x) => x.number), withPr, { alongside: process.argv.includes('alongside') }).slice(0, count)) {
    console.log(`#${i.number} ${i.title} (${i.milestone ?? 'no milestone'})`);
  }
}
