---
description: Try one merged change with Jamie in the running game, fixing small things on the spot and filing bigger ones
argument-hint: "[testing issue number | an area | notes; default: the area with most open]"
---

Test with Jamie: $ARGUMENTS.

- **A number** works that testing issue.
- **An area** (a label such as `world`, `girls` or `vehicles`, or a place such as the barn or the village) works every open testing issue there in one session: read them all, then order their checklist lines along one route through the game so Jamie isn't sent back and forth, and work through it as below, ticking each issue's lines as they pass.
- **`notes`** takes Jamie's notes from playing (see "Play notes" below).
- **Nothing** takes the area with the most open testing issues.

```
gh issue list --state open --label "🧪 testing" --json number,title,labels --jq 'sort_by(.number) | .[] | "\(.number) \(.title) \([.labels[].name] | join(","))"'
```

Jamie plays; you guide, watch for what goes wrong and fix it. Other sessions are building features at the same time, so the same rules hold: never commit to main or switch branch in the main checkout. Don't build anything new here; ideas go to `/idea` or a line at the end.

1. **Say which it is**: number, title and link, as `/todo` does. Read it (`gh issue view <n> --comments`), the issue it tests and that issue's section in `docs/decisions/` (`grep -rn '#<n>' docs/decisions`).
2. **Check Jamie has it.** The PR must have merged, and Jamie's main checkout must include it (`git -C <main checkout> merge-base --is-ancestor <merge commit> HEAD`). If it doesn't, ask Jamie to run `! git pull --ff-only` and restart the dev server.
3. **Go through the checklist one line at a time.** Before giving Jamie any console command or panel route, check it with `tools/consolePath.sh <path>...` (groups are dotted paths: `lane.kids`, `village.parts`, `spares.plug`, `weather.time`; vehicle and girl paths are read from `src/console/gameTree.js`) and `tp` places in `src/console/gameHost.js`; never write one from memory or copy it from an issue body, and fix a wrong one in the issue. If a line fails on something a test could have asserted (a prompt, a toast, a sound, a refusal), the fix includes the test that would have caught it, and say so. For each line, give Jamie the quickest way there (the panel button or console command in the issue), say what right looks like, and wait for what Jamie saw. Tick the line in the issue as it passes (`gh issue edit <n> --body-file`).
4. **Something wrong and small** (a value, a pose, a line, a few lines of code, no question of what it should do): fix it in a worktree (`tools/worktree.sh start <testing issue>`), run `npm test` there, start its dev server (`npx vite --port 5180`) and have Jamie try the fix at `localhost:5180` before it goes in. Keep each fix as its own commit with a message written for a player. Open the PR when Jamie wants the fixes in, or when the checklist is done: `🐛 bug` plus the area labels, the body saying "Found testing #<n>" (not "Closes"), then auto-merge and watch the checks as `/todo` steps 7 to 9 say. A fix after that PR has merged starts a fresh worktree. Re-record any changed lines as `.claude/rules/voice-lines.md` says.
5. **Something wrong and bigger** (it needs design, a decision, or more than a short session): file it rather than fixing it: `gh issue create` with `🐛 bug` (or the right type) and the area labels, a body saying what Jamie did, what happened and what should have, and "Found testing #<n>". Ask Jamie whether it should be `🔜 next`.
6. **Close it as soon as every line is ticked**, without asking. Re-read the issue body (`gh issue view <n> --json body`) and check no `- [ ]` is left; a line that waits on another issue, or that Jamie skipped, is not ticked, so say so and leave the issue open. When none is left, `gh issue close <n> --comment "<that>"` straight away, with a comment: what passed, what was fixed (PR links; a PR still waiting to merge is fine, say so) and what was filed (issue links). If Jamie stops partway through, leave it open with a comment saying where you got to. Tell Jamie each time you close one.
7. **Tell Jamie** in a few lines: what passed, what was fixed and merged, what was filed.

## Play notes

Jamie plays often, and notes what jars as he goes. `/test notes` with the notes pasted (or a file) turns them into work:

1. **Sort each note**, one line each, into: it matches an open testing issue's line (tick or comment on it); an open issue already covers it (comment there with what Jamie saw); **small** (fix it here, as step 4); **bigger** (file it, as step 5); **drift** from the rules (`.claude/rules/controls.md`, `interface.md`, `looks.md`, `debug-panel.md`, `docs/glossary.md`, `docs/style.md`: file it as `🧩 cohesion`, or fix it if small); or **an idea** (to `/idea`). Where a note is unclear, ask.
2. **Show Jamie the sorted list** with what you'll do for each, as a numbered list, then carry on unless he changes any.
3. Work the small fixes as one PR ("Found in play" in the body), file the rest, and tell Jamie what was fixed, filed and commented, with links.

One testing issue, one area or one set of notes per session.
