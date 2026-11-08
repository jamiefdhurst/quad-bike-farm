// Waits for a pull request to merge, so an item is never reported finished while its PR is still open (#727). `gh pr checks --watch`
// returns when the checks finish (or at once, before any have started), not when auto-merge has merged the PR.
//
//   node tools/waitMerged.mjs <pr>    polls every 20 s; prints "merged <time>" and exits 0, or says why it stopped and exits 1
//
// Run it in the background and wait for it to finish (/todo step 9).

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const BAD = ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE', 'ERROR'];
const OK = ['SUCCESS', 'NEUTRAL', 'SKIPPED'];

/** Each check by name, the latest run only (a label change re-runs "Version label"; an old failure is not the answer). */
export function latestChecks(rollup = []) {
  const byName = new Map();
  for (const c of rollup) {
    const name = c.name ?? c.context;
    const at = c.startedAt ?? c.createdAt ?? '';
    // A check run has a status and, once completed, a conclusion; a commit status has only a state.
    const running = c.status && c.status !== 'COMPLETED';
    const result = running ? 'PENDING' : c.conclusion || c.state || 'PENDING';
    const prev = byName.get(name);
    if (!prev || at >= prev.at) byName.set(name, { name, at, result });
  }
  return [...byName.values()];
}

/**
 * What the PR's state means for a session waiting on it ({ state, mergedAt, mergeStateStatus, autoMergeRequest, statusCheckRollup }, as
 * `gh pr view --json` gives it): { done: true, ok: true, say } once merged, { done: true, ok: false, say } when it needs the session
 * (a failed check, closed, a conflict, all green with no auto-merge), and { done: false, say } while there is nothing to do but wait.
 */
export function verdict(pr) {
  if (pr.state === 'MERGED') return { done: true, ok: true, say: `merged ${pr.mergedAt}` };
  if (pr.state === 'CLOSED') return { done: true, ok: false, say: 'the PR was closed without merging' };
  if (pr.mergeStateStatus === 'DIRTY') return { done: true, ok: false, say: 'the PR has a conflict with main: rebase on origin/main, push, and wait again' };
  const checks = latestChecks(pr.statusCheckRollup);
  const failed = checks.filter((c) => BAD.includes(c.result));
  if (failed.length) return { done: true, ok: false, say: `failed: ${failed.map((c) => c.name).join(', ')} (read the log, fix, push, and wait again)` };
  if (!checks.length) return { done: false, say: 'no checks have started yet' };
  const pending = checks.filter((c) => !OK.includes(c.result));
  if (pending.length) return { done: false, say: `waiting on ${pending.map((c) => c.name).join(', ')}` };
  if (!pr.autoMergeRequest) return { done: true, ok: false, say: 'every check passed but auto-merge is off: run gh pr merge --auto --merge' };
  return { done: false, say: 'checks passed, waiting for auto-merge' };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pr = process.argv[2];
  if (!pr) {
    console.error('usage: node tools/waitMerged.mjs <pr number>');
    process.exit(2);
  }
  const fields = 'state,mergedAt,mergeStateStatus,autoMergeRequest,statusCheckRollup';
  const giveUp = Date.now() + 45 * 60 * 1000;
  let last = '';
  for (;;) {
    let v;
    try {
      v = verdict(JSON.parse(execFileSync('gh', ['pr', 'view', pr, '--json', fields], { encoding: 'utf8' })));
    } catch (e) {
      v = { done: false, say: `couldn't read the PR (${e.message.split('\n')[0]}), trying again` };
    }
    if (v.say !== last) console.log(v.say);
    last = v.say;
    if (v.done) process.exit(v.ok ? 0 : 1);
    if (Date.now() > giveUp) {
      console.log('still not merged after 45 minutes: look at the PR, then run this again');
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 20000));
  }
}
