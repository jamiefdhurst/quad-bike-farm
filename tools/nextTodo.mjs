// The issues /todo takes next, in order (.claude/commands/todo.md; the phases are the milestones in .github/settings.yml).
//
//   node tools/nextTodo.mjs [alongside] [count]    prints the next few eligible issues, as "#n title (milestone)"
//   node tools/nextTodo.mjs --label "🧩 cohesion"   the same for /tidy (or "🚀 performance" for /perf): only that label, and only
//                                                  the current phase or Alongside

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

/** The phase being worked: the earliest milestone by title, other than Alongside, that any open issue is in (null if none). */
export function currentPhase(issues) {
  const titles = issues.map((i) => i.milestone).filter((m) => m && m !== ALONGSIDE).sort();
  return titles[0] ?? null;
}

/**
 * Open issues ({ number, title, body, labels: [names], milestone: title or null }) in the order /todo takes them.
 * `openNumbers` is every open issue's number (a dependency is met when it isn't in it); `withPr` the numbers with an open PR.
 * A `🔜 next` issue comes first (the lowest-numbered, in any milestone or none), then the earliest milestone by title, then number.
 * `alongside` takes only that milestone, `🔜 next` or not; otherwise it is left out, and an issue with no milestone is only picked by `🔜 next`.
 * `label` (for /tidy and /perf) takes only issues with that label, in the current phase or Alongside: a later phase's issue waits for it.
 */
export function eligible(issues, openNumbers, withPr = [], { alongside = false, label = null } = {}) {
  if (label) {
    const phase = currentPhase(issues);
    const now = issues.filter((i) => i.labels.includes(label) && (i.milestone === ALONGSIDE || (i.milestone && i.milestone === phase)));
    const own = eligible(now, openNumbers, withPr);
    return [...own, ...eligible(now, openNumbers, withPr, { alongside: true }).filter((i) => !own.includes(i))];
  }
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
  const at = process.argv.indexOf('--label');
  const label = at > 0 ? process.argv[at + 1] : null;
  const opts = { alongside: process.argv.includes('alongside'), label };
  for (const i of eligible(issues, issues.map((x) => x.number), withPr, opts).slice(0, count)) {
    console.log(`#${i.number} ${i.title} (${i.milestone ?? 'no milestone'})`);
  }
}
