// How often a recheck finds something worth fixing, by the model the item was built on (#1178). /todo rechecks an item before its pull
// request opens, and each recheck posts one count line on the issue (COUNT_FORM below). This reads those lines from the issues closed since a
// date and prints, for each model, the items rechecked and the agreed fixes per item, so the recheck can be narrowed once it stops paying.
//
//   node tools/recheckRate.mjs                       issues closed since 25 November 2026, when building moved to Opus
//   node tools/recheckRate.mjs --since 2026-11-09    from another date
//
// Its last line is `ask: ...` when Jamie should be asked whether to narrow the recheck (ASK_AFTER Opus items counted, and no answer yet).

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** The line a recheck posts on its issue, word for word but the numbers and the model id. */
export const COUNT_FORM = 'Recheck count: <f> fix, <a> ask, <n> nit; <g> fixes agreed; built on <model id>.';
const COUNT_LINE = /^`?Recheck count: (\d+) fix, (\d+) ask, (\d+) nit; (\d+) fix(?:es)? agreed; built on ([\w-]+(?:\.[\w-]+)*)\.?`?\s*$/gm;

/** Building moved to Opus on this day, so the rate is measured from it. */
export const DEFAULT_SINCE = '2026-11-25';
/** Opus items with a count before the rate is put to Jamie. */
export const ASK_AFTER = 20;
/** Under this many agreed fixes an item, narrowing the recheck to world and vehicle-model items is worth it (one in five). */
export const NARROW_BELOW = 0.2;
/** The decisions section that records Jamie's answer; once it exists the question isn't asked again. */
export const ANSWER_HEADING = '## Narrowing the recheck';

/** Every count line in a comment's text. */
export function countLines(text = '') {
  return [...text.matchAll(COUNT_LINE)].map((m) => ({ fix: +m[1], ask: +m[2], nit: +m[3], agreed: +m[4], model: m[5] }));
}

/** The family a model id belongs to: 'claude-opus-5-5' is Opus. */
export function family(model) {
  const name = /opus|sonnet|haiku|fable/i.exec(model)?.[0];
  return name ? name[0].toUpperCase() + name.slice(1).toLowerCase() : model;
}

/** Totals for each model family from issues ({ number, comments: [{ body }] }). An issue rechecked twice is one item, its counts added. */
export function tally(issues) {
  const byFamily = {};
  for (const issue of issues) {
    const lines = (issue.comments ?? []).flatMap((c) => countLines(c.body));
    if (!lines.length) continue;
    const name = family(lines.at(-1).model);
    const t = (byFamily[name] ??= { items: 0, fix: 0, ask: 0, nit: 0, agreed: 0 });
    t.items++;
    for (const l of lines) for (const k of ['fix', 'ask', 'nit', 'agreed']) t[k] += l[k];
  }
  for (const t of Object.values(byFamily)) t.rate = t.agreed / t.items;
  return byFamily;
}

/** The question for Jamie, or null: only once ASK_AFTER Opus items have a count and the decisions file has no answer. */
export function askLine(byFamily, decisionsText = '') {
  const opus = byFamily.Opus;
  if (!opus || opus.items < ASK_AFTER) return null;
  if (decisionsText.split('\n').some((l) => l.trim() === ANSWER_HEADING)) return null;
  const advice = opus.rate < NARROW_BELOW ? 'under one in five, so narrowing is recommended' : 'one in five or more, so keeping it is recommended';
  return `ask: ${opus.items} items built on Opus were rechecked, ${opus.agreed} agreed fixes, ${opus.rate.toFixed(2)} an item (${advice}). ` +
    `Narrow the recheck to world and vehicle-model items? Record the answer under "${ANSWER_HEADING.slice(3)}" in docs/decisions/process.md.`;
}

export function report(byFamily) {
  const rows = Object.entries(byFamily).sort((a, b) => b[1].items - a[1].items);
  if (!rows.length) return 'No recheck counts yet.';
  return rows.map(([name, t]) =>
    `${name}: ${t.items} items rechecked, ${t.agreed} agreed fixes (${t.rate.toFixed(2)} an item); found ${t.fix} fix, ${t.ask} ask, ${t.nit} nit`).join('\n');
}

function main(args) {
  const i = args.indexOf('--since');
  const since = i >= 0 ? args[i + 1] : DEFAULT_SINCE;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since ?? '')) {
    console.error('usage: node tools/recheckRate.mjs [--since YYYY-MM-DD]');
    process.exit(2);
  }
  const issues = JSON.parse(execFileSync('gh', ['issue', 'list', '--state', 'closed', '--search', `closed:>=${since}`, '--limit', '1000',
    '--json', 'number,comments', '--jq', '[.[] | {number, comments: [.comments[] | select(.body | test("Recheck count:")) | {body}]}]'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  const byFamily = tally(issues);
  console.log(`Rechecks on issues closed since ${since}:`);
  console.log(report(byFamily));
  const decisions = join(import.meta.dirname, '..', 'docs', 'decisions', 'process.md');
  const ask = askLine(byFamily, existsSync(decisions) ? readFileSync(decisions, 'utf8') : '');
  if (ask) console.log(ask);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
