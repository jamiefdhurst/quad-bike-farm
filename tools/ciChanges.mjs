// Which of the Unit and Smoke jobs a pull request's changed files need (.github/workflows/test.yml, #636, #1182). A PR that only changes prose
// (Markdown, and the instructions in .claude/) can't change what the tests or the build see, so Test passes without them. Prose a test
// reads is code here: tests/ciChanges.test.js finds every Markdown path named in tests/ and fails until it is in READ_BY_TESTS.
// The smoke test plays the game, so it is needed only when a change can reach the game: prose, prose a test reads and the tests themselves can't (#1182).
//   gh api --paginate repos/<owner>/<repo>/pulls/<n>/files --jq '.[].filename' | node tools/ciChanges.mjs    prints code=true|false and smoke=true|false

/** Markdown files the unit tests read, so a change to one still runs them. */
export const READ_BY_TESTS = [
  'docs/glossary.md', 'docs/game.md', 'docs/farm-plan.md',
  '.claude/commands/todo.md', '.claude/commands/tidy.md', '.claude/commands/perf.md', '.claude/commands/recheck.md', '.claude/commands/test.md', 'CLAUDE.md',
];

/** Whether a path is prose nothing in CI reads. */
export function isProse(path) {
  if (READ_BY_TESTS.includes(path)) return false;
  return path.endsWith('.md') || path.startsWith('.claude/');
}

/** Whether a path can't change the running game: prose, prose a test reads, or a test. */
export function cantReachGame(path) {
  return isProse(path) || READ_BY_TESTS.includes(path) || path.startsWith('tests/');
}

const listOf = (paths) => paths.map((p) => p.trim()).filter(Boolean);

/** Whether any of the changed paths needs the tests. No paths at all (the file list failed to load) runs them, to be safe. */
export function needsChecks(paths) {
  const list = listOf(paths);
  return !list.length || !list.every(isProse);
}

/** Whether any of the changed paths needs the smoke test. No paths at all runs it, as above. */
export function needsSmoke(paths) {
  const list = listOf(paths);
  return !list.length || !list.every(cantReachGame);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('node:fs');
  const paths = readFileSync(0, 'utf8').split('\n');
  console.log(`code=${needsChecks(paths)}\nsmoke=${needsSmoke(paths)}`);
}
