// "New since last time" on the start screen: what changed since the build you last played, from the commit messages (vite.config.js puts
// `git log` with hashes into the build as `__GIT_LOG_HASHES__`). The build you played is remembered by its newest commit's hash. Pure.

import { isHousekeeping } from '../faq/changes.js';

/** Lines of `hash<TAB>subject`, newest first, into [{ hash, subject }]. */
export function parseHashedLog(text) {
  const out = [];
  for (const line of (text ?? '').split('\n')) {
    const tab = line.indexOf('\t');
    if (tab > 0) out.push({ hash: line.slice(0, tab).trim(), subject: line.slice(tab + 1).trim() });
  }
  return out;
}

/**
 * What to show: `{ items, more }` (the newest `limit` player-facing subjects and how many more there are), or null when there is
 * nothing to say: a first visit (no `lastHash`), the same build, or nothing a player would notice. If the remembered build has dropped
 * off the end of the log, everything the log holds counts as new.
 */
export function newSince(logText, lastHash, { limit = 6 } = {}) {
  const commits = parseHashedLog(logText);
  if (!lastHash || !commits.length || commits[0].hash === lastHash) return null;
  const at = commits.findIndex((c) => c.hash === lastHash);
  const fresh = (at < 0 ? commits : commits.slice(0, at)).map((c) => c.subject).filter((s) => s && !isHousekeeping(s));
  if (!fresh.length) return null;
  return { items: fresh.slice(0, limit), more: Math.max(0, fresh.length - limit) };
}

/** The hash to remember as played: the newest commit in the log, or null without one. */
export function currentBuild(logText) {
  return parseHashedLog(logText)[0]?.hash ?? null;
}
