// "Recently changed" on the FAQ page, from the commit messages (vite.config.js puts `git log` into the build). The commits are written
// for a player ("Let the girls share a quad"), so most read as a changelog as they are; housekeeping ones are left out. Pure.

// Commits about the docs, the TODO list, the debug tools or recording, which say nothing to a player.
const HOUSEKEEPING = [
  /\bTODO\b/, /\bDECISIONS(\.md)?\b/, /\bREADME\b/, /\bCLAUDE\.md\b/, /\bFAQ\b/, /^Merge\b/, /^Revert\b/,
  /^(Describe|Note|Mark|Trim|Correct|Reword|Write down|Record the girls)\b/, /\bdebug panel\b/i, /\btuning panel\b/i, /\bheadless\b/i,
];

/** Whether a commit subject says nothing to a player (the start screen's "New since last time" uses the same rule). */
export function isHousekeeping(subject) {
  return HOUSEKEEPING.some((re) => re.test(subject));
}

/** Lines of `date<TAB>subject` (newest first) into [{ date, items: [subject] }], housekeeping dropped, at most `limit` items. */
export function parseGitLog(text, { limit = 40 } = {}) {
  const days = [];
  let count = 0;
  for (const line of (text ?? '').split('\n')) {
    if (count >= limit) break;
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const date = line.slice(0, tab).trim();
    const subject = line.slice(tab + 1).trim();
    if (!subject || isHousekeeping(subject)) continue;
    const day = days[days.length - 1];
    if (day?.date === date) day.items.push(subject);
    else days.push({ date, items: [subject] });
    count++;
  }
  return days;
}

/** "2026-10-08" as "8 October 2026". */
export function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return months[m - 1] ? `${d} ${months[m - 1]} ${y}` : iso;
}
