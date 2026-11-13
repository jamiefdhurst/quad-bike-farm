// Holds a session to the whole of an issue (#736). A summary at the end shows what was done, not what wasn't, and "Closes #n" costs nothing, so issues
// were closing with parts undone. This lists every line of the issue, makes each one ticked with evidence or left with a reason, and fails a PR
// that would close an issue with any line missing, unticked or unproven.
//
//   node tools/issueCheck.mjs start <n>   writes .scratch/issue-check-<n>.md: every line of the issue, unticked (run again, it keeps your ticks)
//   node tools/issueCheck.mjs plan <n>    checks every line has a `plan:` note (where it goes, what will prove it) and posts the list, 0 done (#775)
//   node tools/issueCheck.mjs post <n>    checks that file against the issue and posts it as one comment there; prints "Closes #n" or "Part of #n"
//   node tools/issueCheck.mjs pr <pr>     the CI check (test.yml): fails if the PR would close an issue whose comment doesn't pass
//
// A plan is the first line under a line of the list, `→ plan: ...`; evidence for a tick is read only from the lines after it, so naming a file in the
// plan doesn't count as the line done (#775).
//
// A line is `- [x]` done, with evidence under it; `- [ ]` not done, with why; or `- [~]` done another way, with what was done instead and why (#745). A
// `[~]` line can't close the issue until its note starts "Jamie agreed:" with his words, so a changed line reaches him before the merge, not after.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MARK = '<!-- issue-check -->';

// Sections that say where or why rather than what to do. Anything else is work, and a bullet in it that isn't gets ticked as `context:`.
const NOT_WORK = /^(where it fits|questions?( to settle first)?|what is there now|settled with jamie|open issues for this area|findings|from the review|already done)\b/i;
const NOT_PROSE = /^(depends on:|builds on:|was todo\b|\||>|<!--|---)/i;

// Evidence names something that can be looked at: a file, an issue or PR, or anything in backticks (a test's name, a command).
const EVIDENCE = /^context:\s*\S|[\w./-]+\.(js|mjs|md|sh|ya?ml|json|html|svg|glsl|py)\b|#\d+|`[^`]+`/i;

const PLAN = /^plan:\s*\S/i;

const AGREED = /^jamie agreed:\s*\S/i;

const tidy = (s) => s.replace(/\s+/g, ' ').trim();

/** The lines of an issue a session has to answer for: its bullets, or its lines of prose if it has none, or its title if it is empty. */
export function requirements(body = '', title = '') {
  const bullets = [];
  const prose = [];
  let fenced = false;
  let skipFrom = 0; // the level of the heading that started a section to leave out, or 0
  for (const raw of (body ?? '').split('\n')) {
    if (/^\s*(```|~~~)/.test(raw)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const heading = /^(#{1,6})\s+(.*)$/.exec(raw);
    if (heading) {
      const level = heading[1].length;
      if (skipFrom && level > skipFrom) continue; // a sub-heading of a section being left out
      skipFrom = NOT_WORK.test(tidy(heading[2])) ? level : 0;
      continue;
    }
    if (skipFrom) continue;
    const bullet = /^\s*(?:[-*+]|\d+\.)\s+(?:\[( |x|X)\]\s+)?(.*)$/.exec(raw);
    if (bullet) {
      if (bullet[1]?.toLowerCase() !== 'x' && tidy(bullet[2])) bullets.push(tidy(bullet[2])); // a line ticked in the issue was done by an earlier PR
    } else if (tidy(raw) && !NOT_PROSE.test(tidy(raw))) {
      prose.push(tidy(raw));
    }
  }
  const lines = bullets.length ? bullets : prose;
  if (lines.length) return [...new Set(lines)];
  return tidy(title) ? [tidy(title)] : [];
}

/**
 * The list as written in the file or the comment: [{ ticked, text, note }], with `note` the lines under each one and `differently` on a `[~]` line. A line
 * whose first note line starts `plan:` also has `plan` (that line) and `proof` (the lines after it).
 */
export function parseList(text = '') {
  const entries = [];
  const parts = new Map(); // each entry's note, a line at a time
  for (const raw of text.split('\n')) {
    const line = /^- \[( |x|X|~)\] (.*)$/.exec(raw);
    if (line) {
      entries.push({ ticked: /x/i.test(line[1]), text: tidy(line[2]), note: '', ...(line[1] === '~' ? { differently: true } : {}) });
      parts.set(entries[entries.length - 1], []);
    } else if (entries.length && /^\s+\S/.test(raw)) {
      const last = entries[entries.length - 1];
      const part = tidy(raw.replace(/^\s*→?/, ''));
      if (part) parts.get(last).push(part);
      last.note = tidy(`${last.note} ${part}`);
    }
  }
  for (const [entry, lines] of parts) if (PLAN.test(lines[0] ?? '')) Object.assign(entry, { plan: lines[0], proof: lines.slice(1).join(' ') });
  return entries;
}

/** The list as text, each line with its note under it (a plan on its own line, then what came after it). */
export function writeList(entries) {
  const note = (e) => (e.plan === undefined ? e.note : `${e.plan}${e.proof ? `\n  ${e.proof}` : ''}`);
  return `${entries.map((e) => `- [${e.differently ? '~' : e.ticked ? 'x' : ' '}] ${e.text}\n  → ${note(e)}`).join('\n')}\n`;
}

/** The issue's lines as a list, keeping what is already written for any that are still there, and any lines the session added. */
export function refresh(required, entries = []) {
  const has = new Map(entries.map((e) => [e.text, e]));
  const fresh = required.map((text) => has.get(text) ?? { ticked: false, text, note: '' });
  return [...fresh, ...entries.filter((e) => !required.includes(e.text))];
}

/**
 * Whether a list answers the issue: `missing` lines of the issue it dropped, `unproven` ticked lines with no evidence, `noReason` unticked lines with no
 * reason, `undone` unticked lines, `unagreed` lines done another way that Jamie hasn't agreed. `valid` means it can be posted; `complete` means the PR can
 * say "Closes".
 */
export function judge(required, entries) {
  const texts = new Set(entries.map((e) => e.text));
  const missing = required.filter((r) => !texts.has(r));
  const unproven = entries.filter((e) => e.ticked && !EVIDENCE.test(e.plan === undefined ? e.note : e.proof)).map((e) => e.text);
  const noReason = entries.filter((e) => !e.ticked && !tidy(e.note)).map((e) => e.text);
  const undone = entries.filter((e) => !e.ticked && !e.differently).map((e) => e.text);
  const unagreed = entries.filter((e) => e.differently && !AGREED.test(e.note)).map((e) => e.text);
  const valid = !missing.length && !unproven.length && !noReason.length;
  return { missing, unproven, noReason, undone, unagreed, valid, complete: valid && !undone.length && !unagreed.length };
}

/** The lines of a list with no `plan:` note, or a plan with nothing after the word (#775). */
export function unplanned(entries) {
  return entries.filter((e) => !PLAN.test(e.plan ?? e.note)).map((e) => e.text);
}

/** What is wrong with a list, one line each, for a session to act on. */
export function problems({ missing, unproven, noReason }) {
  return [
    ...missing.map((t) => `not on the list: ${t}`),
    ...unproven.map((t) => `ticked with nothing to show for it (name a file, a test in backticks or a command, or start "context:" if there is nothing to do): ${t}`),
    ...noReason.map((t) => `not ticked and no reason given: ${t}`),
  ];
}

/** The comment on the issue: how many lines are done, then the list. */
export function commentBody(entries) {
  const done = entries.filter((e) => e.ticked).length;
  const other = entries.filter((e) => e.differently);
  const agreed = other.filter((e) => AGREED.test(e.note)).length;
  const differently = other.length ? ` ${other.length} done differently: ${agreed} agreed by Jamie, ${other.length - agreed} waiting for him.` : '';
  return `${MARK}\n**Checked against the issue:** ${done} of ${entries.length} lines done.${differently}\n\n${writeList(entries)}`;
}

/** The latest list posted on an issue, from `gh issue view --json comments`. */
export function postedComment(comments = []) {
  return [...comments].reverse().find((c) => c.body?.includes(MARK)) ?? null;
}

/** Whether a PR can close this issue ({ number, title, body, labels, comments }, as `gh issue view --json` gives them): { ok, say }. */
export function canClose(issue) {
  const { number } = issue;
  if (issue.labels?.some((l) => l.name === '🧪 testing')) return { ok: true, say: `#${number}: a testing issue, ticked in /test` };
  const again = `Run \`node tools/issueCheck.mjs start ${number}\`, answer every line, \`node tools/issueCheck.mjs post ${number}\`, then re-run this check (\`gh run rerun <run id> --failed\`).`;
  const posted = postedComment(issue.comments);
  if (!posted) return { ok: false, say: `#${number}: this PR would close it, but no one has checked it line by line. ${again}` };
  const verdict = judge(requirements(issue.body, issue.title), parseList(posted.body));
  if (verdict.complete) return { ok: true, say: `#${number}: every line done` };
  const list = [
    ...problems(verdict),
    ...verdict.undone.filter((t) => !verdict.noReason.includes(t)).map((t) => `not done: ${t}`),
    ...verdict.unagreed.filter((t) => !verdict.noReason.includes(t)).map((t) => `done another way, and Jamie hasn't agreed: ${t}`),
  ];
  const partly = verdict.undone.length || verdict.unagreed.length ? ' If those lines can\'t be settled in this PR, it says "Part of" rather than "Closes", and the issue stays open. On a yes from Jamie, start a `[~]` line\'s note "Jamie agreed:" with his words.' : '';
  return { ok: false, say: `#${number}: this PR would close it with lines unanswered:\n${list.map((l) => `  - ${l}`).join('\n')}\n${again}${partly}` };
}

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' });
const readIssue = (n) => ({ number: Number(n), ...JSON.parse(gh('issue', 'view', String(n), '--json', 'title,body,labels,comments')) });
const listFile = (n) => resolve('.scratch', `issue-check-${n}.md`);

function start(n) {
  const issue = readIssue(n);
  const file = listFile(n);
  const had = existsSync(file) ? parseList(readFileSync(file, 'utf8')) : [];
  const entries = refresh(requirements(issue.body, issue.title), had);
  mkdirSync(resolve('.scratch'), { recursive: true });
  writeFileSync(file, writeList(entries));
  console.log(`${entries.length} lines to answer in ${file}\nTick each with where it is (a file, a test in backticks, a command), leave it with why it can't be done, or mark it [~] with what you did instead and ask Jamie.`);
}

/** The issue and its list from the file, or exit saying what to run. */
function load(n) {
  const issue = readIssue(n);
  const file = listFile(n);
  if (!existsSync(file)) {
    console.error(`no list at ${file}: run node tools/issueCheck.mjs start ${n}`);
    process.exit(1);
  }
  const entries = parseList(readFileSync(file, 'utf8'));
  return { issue, entries, verdict: judge(requirements(issue.body, issue.title), entries) };
}

/** Posts the list as the issue's check comment, or updates the one already there. */
function send(issue, entries) {
  const id = postedComment(issue.comments)?.url?.split('#issuecomment-')[1];
  if (id) gh('api', '-X', 'PATCH', `repos/{owner}/{repo}/issues/comments/${id}`, '-f', `body=${commentBody(entries)}`);
  else gh('api', '-X', 'POST', `repos/{owner}/{repo}/issues/${issue.number}/comments`, '-f', `body=${commentBody(entries)}`);
}

function plan(n) {
  const { issue, entries, verdict } = load(n);
  const lacking = unplanned(entries);
  const list = [...(verdict.missing.length ? [`run node tools/issueCheck.mjs start ${n} again: ${verdict.missing.length} line(s) of the issue aren't on the list`] : []),
    ...lacking.map((t) => `no plan (start the note "plan:", say where it goes and what will prove it, or ask Jamie if you can't): ${t}`)];
  if (list.length) {
    console.error(`Not posted:\n${list.map((l) => `  - ${l}`).join('\n')}`);
    process.exit(1);
  }
  send(issue, entries);
  console.log(`Planned all ${entries.length} lines of #${n} and posted the list, ${entries.filter((e) => e.ticked).length} done.`);
}

function post(n) {
  const { issue, entries, verdict } = load(n);
  if (!verdict.valid) {
    console.error(`Not posted:\n${problems(verdict).map((l) => `  - ${l}`).join('\n')}`);
    process.exit(1);
  }
  send(issue, entries);
  if (verdict.complete) console.log(`Closes #${n}`);
  else {
    console.log(`Part of #${n}`);
    if (verdict.undone.length) console.log(`Not done, and the issue stays open:\n${verdict.undone.map((t) => `  - ${t}`).join('\n')}`);
    if (verdict.unagreed.length) console.log(`Done another way, so ask Jamie. On a yes, start the note "Jamie agreed:" with his words and post again:\n${verdict.unagreed.map((t) => `  - ${t}`).join('\n')}`);
  }
}

function pr(n) {
  const { closingIssuesReferences: closes } = JSON.parse(gh('pr', 'view', String(n), '--json', 'closingIssuesReferences'));
  if (!closes.length) {
    console.log('This PR closes no issue.');
    return;
  }
  const results = closes.map((c) => canClose(readIssue(c.number)));
  for (const r of results) console.log(r.say);
  if (results.some((r) => !r.ok)) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const commands = { start, plan, post, pr };
  const [command, n] = process.argv.slice(2);
  if (!commands[command] || !/^\d+$/.test(n ?? '')) {
    console.error('usage: node tools/issueCheck.mjs start|plan|post <issue> or pr <pr>');
    process.exit(2);
  }
  commands[command](n);
}
