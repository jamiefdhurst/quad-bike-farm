// Checks that an issue is ready to be started, before /todo reads it and before /idea files it (#774). Sessions stalled or finished short when an
// issue left part of the job to be guessed: a question left in the body, no scale for something that has to hold at a size, a path that isn't there,
// a console line that doesn't run, work handed to an issue that doesn't take it, or more lines than one session holds well.
//
//   node tools/issueLint.mjs <n>              one open issue
//   node tools/issueLint.mjs --all            every open issue not held back, then a count by problem
//   node tools/issueLint.mjs --file <path>    a draft; Title: and Labels: (comma separated) lines at its top stand for what GitHub would hold
//
// One line per problem, saying what to do; exits 1 if there is any.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requirements } from './issueCheck.mjs';

/** More lines of work than this and one session doesn't hold them well (#681 has 49). */
export const MAX_WORK = 12;

/** Labels of issues that are kept but not worked, so `--all` leaves them out (the same four `tools/nextTodo.mjs` skips). */
export const HELD_BACK = ['❓ question', '🧪 testing', '💤 later', '🤦‍♂️ wontfix'];

const tidy = (s) => s.replace(/\s+/g, ' ').trim();
const headingOf = (raw) => /^(#{1,6})\s+(.*)$/.exec(raw);
const headingText = (h) => tidy(h[2]).replace(/[*_`]/g, '');
const isFence = (raw) => /^\s*(```|~~~)/.test(raw);

/** The body without the sections whose heading matches `drop` (and their sub-sections). */
export function without(body = '', drop) {
  const out = [];
  let fenced = false;
  let skipFrom = 0;
  for (const raw of (body ?? '').split('\n')) {
    if (isFence(raw)) {
      fenced = !fenced;
      if (!skipFrom) out.push(raw);
      continue;
    }
    const h = fenced ? null : headingOf(raw);
    if (h) {
      const level = h[1].length;
      if (skipFrom && level > skipFrom) continue;
      skipFrom = drop.test(headingText(h)) ? level : 0;
    }
    if (!skipFrom) out.push(raw);
  }
  return out.join('\n');
}

/** What is under the first heading that matches `re`, up to the next heading of its level or above; null if there is none. */
export function section(body = '', re) {
  const out = [];
  let fenced = false;
  let level = 0;
  for (const raw of (body ?? '').split('\n')) {
    if (isFence(raw)) fenced = !fenced;
    const h = fenced || isFence(raw) ? null : headingOf(raw);
    if (h) {
      if (level && h[1].length <= level) break;
      if (!level && re.test(headingText(h))) {
        level = h[1].length;
        continue;
      }
    }
    if (level) out.push(raw);
  }
  return level ? out.join('\n') : null;
}

/** Questions still in the body: they are asked of Jamie before the issue is filed, and answered under "Settled with Jamie". */
export function questionsLeft(body = '') {
  const left = /^\s*(?:#{1,6}\s+)?\**\s*questions? to settle first\b/im.test(body ?? '');
  return left ? ['still has a "Questions to settle first" section: ask Jamie now, then move the answers under "Settled with Jamie" and drop the section'] : [];
}

/** Lines of its own work: what `requirements()` gives, without Done when, the Looks like list and the standard for what you'll see (#774). */
export function ownWork(body = '', title = '') {
  return requirements(without(body, /^(done when|looks like|the standard for anything you'll see)\b/i), title);
}

export function tooBig(body = '', title = '') {
  const n = ownWork(body, title).length;
  return n > MAX_WORK
    ? [`has ${n} lines of its own work, more than ${MAX_WORK}: split it into issues of at most ${MAX_WORK}, the later ones with "Depends on:" the earlier`]
    : [];
}

// A line shows how it will be known to be done if it names a test, a command or a scene, or says it is looked at or heard.
const SHOWS = /`[^`]+`|\btests?\b|\bscene\b|\bby (eye|ear)\b/i;

export function doneWhen(body = '') {
  const text = section(body, /^done when\b/i);
  if (text === null) return ['has no "Done when" section: add one, a line for each way it will be known to be finished'];
  // A line with lines under it is one thing to show: the lines under it say what it is made of, so only the ones at the left are held to this.
  const top = text.split('\n').filter((l) => /^(?:[-*+]|\d+\.)\s/.test(l));
  const lines = top.length ? requirements(top.join('\n'), '') : requirements(text, '');
  if (!lines.length) return ['"Done when" has no lines: say how it will be known to be finished'];
  return lines.filter((l) => !SHOWS.test(l)).map((l) => `"Done when" line names no test, command, scene or "by eye": ${l}`);
}

/** The size it has to hold at, for work in the world or about speed (a length, a count, a load or frame budget), or "none" and why. */
export function scale(body = '', labels = []) {
  if (!labels.some((l) => ['🌾 world', '🚀 performance'].includes(l))) return [];
  const m = /^[\s>*_-]*scale:\**\s*(.*)$/im.exec(body ?? '');
  const ask = 'add a "Scale:" line: the size it has to hold at on the plan (a length, a count, a load or frame budget), or "none" and why';
  if (!m || !tidy(m[1])) return [`is labelled for the world or performance and has no Scale: line: ${ask}`];
  if (/^none\b/i.test(tidy(m[1])) && tidy(m[1]).split(' ').length < 4) return [`Scale: says "none" without why: ${ask}`];
  return [];
}

const PATH = /^(?:src|tests|tools|docs|\.claude)\/\S*$/;
const backticked = (line) => [...line.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);

/** Paths under src/, tests/, tools/, docs/ or .claude/ in backticks that aren't there, unless their line says they are new. `exists` is given the path. */
export function missingPaths(body = '', exists = existsSync) {
  const found = [];
  for (const line of (without(body, /^(what is there now|already done)\b/i) ?? '').split('\n')) {
    if (/\b(new|creates?|created)\b/i.test(line)) continue;
    for (const token of backticked(line)) {
      const first = token.split(/\s+/)[0].replace(/[#:]\S*$/, '').replace(/[.,;)]+$/, '');
      if (PATH.test(first) && !/[<*{…]|\.\.\./.test(first) && !exists(first)) found.push(first);
    }
  }
  return [...new Set(found)].map((p) => `names ${p}, which isn't there: fix the path, or say on its line that it is new`);
}

/** Backticked lines that might be console lines; `consolePath.sh` says which of them are, and whether they run. */
export function consoleLines(body = '') {
  const lines = [];
  for (const line of without(body, /^(what is there now|already done)\b/i).split('\n')) {
    for (const token of backticked(line)) {
      const t = tidy(token);
      if (t.length > 80 || /[<>{}…]|\.\.\.|^\/|(^|\s)(src|tests|tools|docs|\.claude)\//.test(t)) continue;
      lines.push(t);
    }
  }
  return [...new Set(lines)];
}

/** Console lines that `verdict(line)` gives a reason for (`tools/consolePath.sh` said NO); lines it skips or passes are fine. */
export function consoleProblems(body = '', verdict = () => undefined) {
  return consoleLines(body).flatMap((l) => {
    const why = verdict(l);
    return why === undefined ? [] : [`console line \`${l}\` doesn't run (${why || 'no such path'}): try it with tools/consolePath.sh and fix it`];
  });
}

const HANDS = [
  /#(\d+)\s+(?:adds|will add|does|will do|builds|will build|handles|will handle|covers|turns|provides|fixes|will fix)\b/gi,
  /\b(?:left|leave|leaves|saved|kept|held)\s+for\s+#(\d+)/gi,
  /\bfor\s+#(\d+)\s+to\s+\w+/gi,
];

/** Work handed to another open issue that doesn't name this one. `lookup(n)` gives { body, title } of an open issue, or nothing if it is closed. */
export function handsOff(body = '', self, lookup = () => undefined) {
  if (!self) return [];
  const text = without(body, /^(what is there now|already done|settled with jamie)\b/i).split('\n').filter((l) => !/^\s*(depends on|builds on|was todo)/i.test(l)).join('\n');
  const named = new Set();
  for (const re of HANDS) for (const m of text.matchAll(re)) named.add(Number(m[1]));
  named.delete(self);
  return [...named].sort((a, b) => a - b).flatMap((n) => {
    const other = lookup(n);
    if (!other || new RegExp(`#${self}(?!\\d)`).test(`${other.title ?? ''}\n${other.body ?? ''}`)) return [];
    return [`hands work to #${n}, which doesn't name #${self}: add a line to #${n} that takes it (or do it here)`];
  });
}

/** Every check on one issue ({ number, title, body, labels: [names] }): [{ check, text }]. */
export function lint(issue, { exists = existsSync, verdict = () => undefined, lookup = () => undefined } = {}) {
  const { number, title = '', body = '' } = issue;
  const labels = (issue.labels ?? []).map((l) => l.name ?? l);
  const tag = (check, list) => list.map((text) => ({ check, text }));
  return [
    ...tag('questions', questionsLeft(body)),
    ...tag('size', tooBig(body, title)),
    ...tag('done-when', doneWhen(body)),
    ...tag('scale', scale(body, labels)),
    ...tag('path', missingPaths(body, exists)),
    ...tag('console', consoleProblems(body, verdict)),
    ...tag('hands-off', handsOff(body, number, lookup)),
  ];
}

/** Runs the candidate lines through `tools/consolePath.sh` in one go (it starts the test runner, so once for everything) and gives back a verdict function. */
export function consoleVerdicts(lines, root = resolve(import.meta.dirname, '..')) {
  if (!lines.length) return () => undefined;
  let out;
  try {
    out = execFileSync('sh', ['tools/consolePath.sh', ...lines], { cwd: root, encoding: 'utf8', env: { ...process.env, CONSOLE_KNOWN_ONLY: '1' } });
  } catch (e) {
    out = e.stdout ?? ''; // grep exits 1 when every line was skipped
  }
  const results = out.split('\n').filter((l) => /^NO\s/.test(l)).map((l) => l.replace(/^NO\s+/, ''));
  return (line) => {
    const hit = results.find((r) => r.startsWith(`${line}: `));
    return hit?.slice(line.length + 2).trim();
  };
}

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/** A draft file: `Title:` and `Labels:` lines at its top are the issue's title and labels, the rest its body. */
export function readDraft(text = '') {
  const lines = text.split('\n');
  const issue = { number: undefined, title: '', labels: [], body: '' };
  let i = 0;
  for (; i < lines.length; i++) {
    const m = /^(title|labels):\s*(.*)$/i.exec(lines[i]);
    if (!m) break;
    if (m[1].toLowerCase() === 'title') issue.title = m[2].trim();
    else issue.labels = m[2].split(',').map((s) => ({ name: s.trim() })).filter((l) => l.name);
  }
  issue.body = lines.slice(i).join('\n').replace(/^\n+/, '');
  return issue;
}

function main(args) {
  let issues;
  let open;
  const lookupFrom = (map) => (n) => map.get(n);
  if (args[0] === '--all') {
    const all = JSON.parse(gh('issue', 'list', '--state', 'open', '--limit', '1000', '--json', 'number,title,body,labels'));
    open = new Map(all.map((i) => [i.number, i]));
    issues = all.filter((i) => !i.labels.some((l) => HELD_BACK.includes(l.name)));
  } else if (args[0] === '--file' && args[1]) {
    issues = [readDraft(readFileSync(args[1], 'utf8'))];
    open = new Map();
  } else if (/^\d+$/.test(args[0] ?? '')) {
    issues = [{ number: Number(args[0]), ...JSON.parse(gh('issue', 'view', args[0], '--json', 'title,body,labels')) }];
    open = new Map();
  } else {
    console.error('usage: node tools/issueLint.mjs <issue> | --all | --file <path>');
    process.exit(2);
  }
  const cache = new Map();
  const lookup = args[0] === '--all' ? lookupFrom(open) : (n) => {
    if (!cache.has(n)) {
      try {
        const o = JSON.parse(gh('issue', 'view', String(n), '--json', 'state,title,body'));
        cache.set(n, o.state === 'OPEN' ? o : undefined);
      } catch {
        cache.set(n, undefined);
      }
    }
    return cache.get(n);
  };
  const verdict = consoleVerdicts([...new Set(issues.flatMap((i) => consoleLines(i.body)))]);
  const counts = {};
  let bad = 0;
  for (const issue of issues) {
    const found = lint(issue, { verdict, lookup });
    for (const f of found) {
      counts[f.check] = (counts[f.check] ?? 0) + 1;
      console.log(`${issue.number ? `#${issue.number}` : 'draft'}: ${f.text}`);
    }
    if (found.length) bad++;
  }
  if (args[0] === '--all') {
    console.log(`\n${bad} of ${issues.length} issues have a problem.`);
    for (const [check, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${check}: ${n}`);
  } else if (!bad) console.log('ok: ready to start');
  process.exit(bad ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
