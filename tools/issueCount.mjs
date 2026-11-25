// The issues by milestone, week by week (#1181). The open total mixes the plan with the wish list: between 9 and 24 November 2026 about
// sixteen issues a day were opened and eight closed. This prints, for each open milestone, how many are open, how many were opened and closed
// in the week, and where the opened ones came from, so the number to watch is what is left in the current phase.
//
//   node tools/issueCount.mjs              the last 7 days: a line for each open milestone, then no milestone, then all
//   node tools/issueCount.mjs --weeks 4    the trend: open at the end of each week, and opened and closed in each, oldest first
//   node tools/issueCount.mjs --phase      only the current phase's line (the earliest open milestone with an open issue), for /todo's report
//
// An issue counts in the milestone it is in now, so one moved in the week reads as if it had always been there.

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { byMilestone, currentPhase } from './nextTodo.mjs';

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

/** Where an opened issue came from, in the order it is decided: the first that matches. */
export const ORIGINS = ['recheck', 'walk', 'split', 'new'];
const START = String.raw`(?:^|[.!?(]\s*)`; // a marker opens a line or a sentence, so "came from (a recheck" in prose doesn't count
const FROM = {
  // "Found by `/recheck` of #690", "From the recheck of #912", "A recheck of #691 (PR #1068) found", "found by the #691 recheck"
  recheck: new RegExp(String.raw`${START}(?:found|from|filed)\b[^\n.]{0,40}\brecheck|\b(?:a|the) \`?\/?recheck\`? of #\d+|#\d+(?:'s)? recheck\b`, 'im'),
  // "Found on Jamie's walk of Hollow Wood", "From Jamie's walk of the barn", "Found testing #1153", "Found in play"
  walk: new RegExp(String.raw`${START}(?:found|from)\b[^\n.]{0,40}(?:\bwalks?\b|\btesting #\d+|\bin play\b)|\bJamie's walks? (?:of|round|along)\b`, 'im'),
  // "Split out of #222", "Split from #815", "Part of the split of #681"
  split: /\bsplit (?:out )?(?:of|from|off) #\d+|\bpart of the split of #\d+/i,
};

/** 'recheck', 'walk', 'split' or 'new', read from the words the commands file an issue with. */
export function origin(body = '') {
  return ORIGINS.find((o) => FROM[o]?.test(body ?? '')) ?? 'new';
}

/** The end of each week, oldest first: `weeks` of them, the last at `now`. */
export function weekEnds(now, weeks = 1) {
  return Array.from({ length: weeks }, (_, k) => new Date(now.getTime() - (weeks - 1 - k) * WEEK));
}

const time = (iso) => (iso ? new Date(iso).getTime() : null);
const isOpenAt = (i, t) => time(i.createdAt) <= t && (i.closedAt == null || time(i.closedAt) > t);
const inWeek = (iso, end) => iso != null && time(iso) > end - WEEK && time(iso) <= end;
const NONE = 'No milestone';
const ALL = 'All';

/**
 * A row for each open milestone in run order, then "No milestone" (if any issue counted has none), then "All".
 * `issues` are { number, body, milestone: title or null, createdAt, closedAt: ISO or null }: every open issue, and every one opened or
 * closed in the weeks counted. `milestones` are the open milestones' titles. Each row has, for each week, oldest first: `open` at its end,
 * `opened` in it by origin (with `total`) and `closed` in it; `openBefore` is the count a week before the first end.
 */
export function count(issues, milestones, { now = new Date(), weeks = 1 } = {}) {
  const ends = weekEnds(now, weeks).map((d) => d.getTime());
  const row = (title, list) => ({
    milestone: title,
    openBefore: list.filter((i) => isOpenAt(i, ends[0] - WEEK)).length,
    open: ends.map((t) => list.filter((i) => isOpenAt(i, t)).length),
    opened: ends.map((t) => {
      const by = Object.fromEntries(ORIGINS.map((o) => [o, 0]));
      for (const i of list.filter((x) => inWeek(x.createdAt, t))) by[origin(i.body)]++;
      return { total: ORIGINS.reduce((n, o) => n + by[o], 0), ...by };
    }),
    closed: ends.map((t) => list.filter((i) => inWeek(i.closedAt, t)).length),
  });
  const rows = [...milestones].sort(byMilestone).map((m) => row(m, issues.filter((i) => i.milestone === m)));
  const none = issues.filter((i) => !i.milestone);
  if (none.length) rows.push(row(NONE, none));
  rows.push(row(ALL, issues));
  return rows;
}

const sum = (list) => list.reduce((n, x) => n + x, 0);
const signed = (n) => (n > 0 ? `up ${n}` : n < 0 ? `down ${-n}` : 'level');

/** Where the opened ones came from, leaving out the origins with none: "3 recheck, 2 walk, 7 new". */
export function origins(opened) {
  const parts = ORIGINS.filter((o) => opened[o]).map((o) => `${opened[o]} ${o}`);
  return parts.length ? parts.join(', ') : 'none';
}

/** One milestone's line. With one week: open, the change on the week, opened by origin, closed. With more: each week's numbers in turn. */
export function line(r) {
  const weeks = r.open.length;
  const total = ORIGINS.reduce((acc, o) => ({ ...acc, [o]: sum(r.opened.map((w) => w[o])) }), {});
  const opened = sum(r.opened.map((w) => w.total));
  if (weeks === 1) {
    return `${r.milestone}: ${r.open[0]} open (${signed(r.open[0] - r.openBefore)} on the week); ` +
      `${opened} opened (${origins(total)}), ${r.closed[0]} closed in the last 7 days`;
  }
  return `${r.milestone}: open ${r.open.join(', ')}; opened ${r.opened.map((w) => w.total).join(', ')} (${origins(total)}); ` +
    `closed ${r.closed.join(', ')}`;
}

const day = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** The whole report: a heading, then a line for each row. */
export function report(rows, { now = new Date(), weeks = 1 } = {}) {
  const head = weeks === 1
    ? `Issues by milestone, the 7 days to ${day(now)}:`
    : `Issues by milestone, the ${weeks} weeks to ${weekEnds(now, weeks).map(day).join(', ')}, oldest first:`;
  return [head, ...rows.map(line)].join('\n');
}

/** The current phase's line: the earliest open milestone that has an open issue (as /todo, /tidy and /perf read it). */
export function phaseLine(rows, issues, now = new Date()) {
  const open = issues.filter((i) => isOpenAt(i, now.getTime()));
  const phase = currentPhase(open);
  const r = rows.find((x) => x.milestone === phase);
  return r ? `Current phase, ${line(r)}` : 'No open milestone has an open issue.';
}

function main(args) {
  const at = args.indexOf('--weeks');
  const weeks = at >= 0 ? Number(args[at + 1]) : 1;
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) {
    console.error('usage: node tools/issueCount.mjs [--weeks <1 to 52>] [--phase]');
    process.exit(2);
  }
  const now = new Date();
  const since = new Date(now.getTime() - (weeks + 1) * WEEK).toISOString().slice(0, 10);
  const gh = (a) => JSON.parse(execFileSync('gh', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  const fields = ['--json', 'number,body,milestone,createdAt,closedAt', '--limit', '2000'];
  // Every open issue, and the closed ones that were opened or closed in the weeks counted (one before them too, for the week's change).
  const lists = [
    gh(['issue', 'list', '--state', 'open', ...fields]),
    gh(['issue', 'list', '--state', 'closed', '--search', `closed:>=${since}`, ...fields]),
  ];
  const seen = new Map();
  for (const i of lists.flat()) seen.set(i.number, { ...i, milestone: i.milestone?.title ?? null });
  const issues = [...seen.values()];
  const milestones = gh(['api', 'repos/{owner}/{repo}/milestones?state=open&per_page=100']).map((m) => m.title);
  const rows = count(issues, milestones, { now, weeks: args.includes('--phase') ? 1 : weeks });
  console.log(args.includes('--phase') ? phaseLine(rows, issues, now) : report(rows, { now, weeks }));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
