---
description: Try one merged change with Jamie in the running game, fixing small things on the spot and filing bigger ones
argument-hint: "[testing issue number; default: the oldest]"
---

Work through testing issue $ARGUMENTS with Jamie. If no number is given, take the oldest open one:

```
gh issue list --state open --label "🧪 testing" --json number,title --jq 'sort_by(.number) | .[0]'
```

Jamie plays; you guide, watch for what goes wrong and fix it. Other sessions are building features at the same time, so the same rules hold: never commit to main or switch branch in the main checkout. Don't build anything new here; ideas go to `/idea` or a line at the end.

1. **Say which it is**: number, title and link, as `/todo` does. Read it (`gh issue view <n> --comments`), the issue it tests and that issue's section in `docs/decisions/` (`grep -rn '#<n>' docs/decisions`).
2. **Check Jamie has it.** The PR must have merged, and Jamie's main checkout must include it (`git -C <main checkout> merge-base --is-ancestor <merge commit> HEAD`). If it doesn't, ask Jamie to run `! git pull --ff-only` and restart the dev server.
3. **Go through the checklist one line at a time.** Before giving Jamie any console command or panel route, look it up in `src/console/gameTree.js` (groups are dotted paths: `farm.purse`, `village.parts`, `spares.plug`, `weather.time`) or run it headlessly through `game.console.shell.run`; never write one from memory. If a line fails on something a test could have asserted (a prompt, a toast, a sound, a refusal), the fix includes the test that would have caught it, and say so. For each line, give Jamie the quickest way there (the panel button or console command in the issue), say what right looks like, and wait for what Jamie saw. Tick the line in the issue as it passes (`gh issue edit <n> --body-file`).
4. **Something wrong and small** (a value, a pose, a line, a few lines of code, no question of what it should do): fix it in a worktree (`tools/worktree.sh start <testing issue>`), run `npm test` there, start its dev server (`npx vite --port 5180`) and have Jamie try the fix at `localhost:5180` before it goes in. Keep each fix as its own commit with a message written for a player. Open the PR when Jamie wants the fixes in, or when the checklist is done: `🐛 bug` plus the area labels, the body saying "Found testing #<n>" (not "Closes"), then auto-merge and watch the checks as `/todo` steps 7 to 9 say. A fix after that PR has merged starts a fresh worktree. Re-record any changed lines as `.claude/rules/voice-lines.md` says.
5. **Something wrong and bigger** (it needs design, a decision, or more than a short session): file it rather than fixing it: `gh issue create` with `🐛 bug` (or the right type) and the area labels, a body saying what Jamie did, what happened and what should have, and "Found testing #<n>". Ask Jamie whether it should be `🔜 next`.
6. **Close it when Jamie says it's done**, not before, with a comment: what passed, what was fixed (PR links) and what was filed (issue links). `gh issue close <n> --comment "<that>"`. If Jamie stops partway through, leave it open with a comment saying where you got to.
7. **Tell Jamie** in a few lines: what passed, what was fixed and merged, what was filed.

One testing issue per session.
