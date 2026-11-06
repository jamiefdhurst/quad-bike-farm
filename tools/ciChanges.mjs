// Whether a pull request's changed files need the Unit and Smoke jobs (.github/workflows/test.yml, #636). A PR that only changes prose
// (Markdown, and the instructions in .claude/) can't change what the tests or the build see, so Test passes without them. Prose a test
// reads is code here: tests/ciChanges.test.js finds every Markdown path named in tests/ and fails until it is in READ_BY_TESTS.
//   gh api --paginate repos/<owner>/<repo>/pulls/<n>/files --jq '.[].filename' | node tools/ciChanges.mjs    prints code=true or code=false

/** Markdown files the unit tests read, so a change to one still runs them. */
export const READ_BY_TESTS = ['docs/glossary.md', 'docs/game.md'];

/** Whether a path is prose nothing in CI reads. */
export function isProse(path) {
  if (READ_BY_TESTS.includes(path)) return false;
  return path.endsWith('.md') || path.startsWith('.claude/');
}

/** Whether any of the changed paths needs the tests. No paths at all (the file list failed to load) runs them, to be safe. */
export function needsChecks(paths) {
  const list = paths.map((p) => p.trim()).filter(Boolean);
  return !list.length || !list.every(isProse);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('node:fs');
  console.log(`code=${needsChecks(readFileSync(0, 'utf8').split('\n'))}`);
}
