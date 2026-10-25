// Says at the start of a Claude Code session when a check-up is due (the SessionStart hook in .claude/settings.json): the last `/tidy check`
// (docs/tidy.md) or `/perf check` (docs/perf-checks.md) more than a week ago. Check-ups stay manual, by Jamie's choice; this only reminds.
// Prints nothing when none is due. docs/decisions/process.md, "Check-up reminders (#428)".
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DUE_AFTER_DAYS = 7;

/** The date of a log's last entry ("- 2026-10-25, abc123: ..."), or null. */
export function lastDate(text) {
  const dates = [...text.matchAll(/^- (\d{4}-\d{2}-\d{2})\b/gm)].map((m) => m[1]);
  return dates.length ? dates[dates.length - 1] : null;
}

/** One line per check-up that is due: [{ name, days }] for those last done more than `after` days before `today` (or never). */
export function due(logs, today, after = DUE_AFTER_DAYS) {
  const out = [];
  for (const [name, text] of Object.entries(logs)) {
    const last = text == null ? null : lastDate(text);
    const days = last ? Math.floor((Date.parse(today) - Date.parse(last)) / 86400000) : Infinity;
    if (days > after) out.push({ name, days });
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const read = (p) => (existsSync(resolve(root, p)) ? readFileSync(resolve(root, p), 'utf8') : null);
  const today = new Date().toISOString().slice(0, 10);
  const list = due({ '/tidy check': read('docs/tidy.md'), '/perf check': read('docs/perf-checks.md') }, today);
  if (list.length) {
    const text = list.map((d) => `${d.name} is due (${Number.isFinite(d.days) ? `last run ${d.days} days ago` : 'never run'})`).join('; ');
    console.log(JSON.stringify({
      systemMessage: `Check-up reminder: ${text}.`,
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: `For Jamie only: ${text}. Don't run a check-up unless he asks.` },
    }));
  }
}
