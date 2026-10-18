---
description: Work through one GitHub issue, start to finish, as a pull request that merges itself when CI passes
argument-hint: "[issue number; default: the next one]"
---

Work on GitHub issue $ARGUMENTS. If no number is given, take the next one: the lowest-numbered open issue labelled `🔜 next`, or if none is, the lowest-numbered open issue that isn't labelled `❓ question` or `🤦‍♂️ wontfix` and has no open PR yet (`gh pr list --search "<n> in:body"`):

```
gh issue list --state open --label "🔜 next" --json number,title --jq 'sort_by(.number) | .[0]'
gh issue list --state open --limit 500 --json number,title,labels --jq '[.[] | select(all(.labels[].name; . != "❓ question" and . != "🤦‍♂️ wontfix"))] | sort_by(.number) | .[0:5]'
```

Other sessions work in this checkout at the same time, so every item gets its own worktree and branch. Never switch branch in the main checkout, and never commit to main.

1. **Read it.** `gh issue view <n> --comments`. Then only the code and the DECISIONS.md sections it touches; don't read the whole codebase. The body ends "Was TODO <old number>" for items moved from the README: DECISIONS and the code call it by that number.
2. **Ask if it needs it.** If anything is genuinely undecided, ask Jamie now: a short numbered list of questions, each with your recommendation, then stop and wait. If it's clear, say in two or three lines what you're going to do and carry on without waiting. Write what was settled as a comment on the issue (`gh issue comment`) as well as in DECISIONS.md.
3. **Make the worktree.** `tools/worktree.sh start <n>` prints its path. Do all the work there: absolute paths for every edit and command (the shell's directory resets to the main checkout), your own dev server from it (`npx vite --port 5180`) for any headless check, and the voice recording run from it so the banks land in its `public/audio`. `node_modules` and `.scratch` are links to the main checkout's; if the item changes `package.json`, delete the link and `npm ci`.
4. **Build it**, following CLAUDE.md: pure logic with unit tests where possible, tunables with ranges, the girls' lines in the voice files (re-record in the background if you add any, wait for it, and commit the banks on the branch before the PR is merged; see CLAUDE.md "Voice lines").
5. **Check it cheaply.** `npm test` in the worktree, and at most one short headless check if it's visual or only shows in the running game.
6. **Finish the docs** as CLAUDE.md says: the FAQ's answers in `src/faq/faqContent.js`, `docs/` if the item changes something a page there describes, a section in DECISIONS.md (headed with the issue number, and its old TODO number if it had one), and ASSETS.md for any asset.
7. **Commit and open the PR.** Commit in sensible chunks on the branch, with messages written for a player (they become the FAQ's "Recently changed"), staging your own files by name. Before pushing, `git fetch origin && git rebase origin/main`; if the voice banks conflict, take main's and rebuild yours with `--bank-only`. Then:
   ```
   git push -u origin HEAD
   gh pr create --title "<what changed, for a player>" --body "Closes #<n>. <what it does and why>" --label "<each of the issue's labels>"
   gh pr merge --auto --merge
   ```
   The PR carries the issue's labels: its type label decides the release's version bump (`✨ feature` minor, anything else patch). Add `💥 breaking` only if an old farm save won't load or loses something (major). No AI attribution anywhere, and no Testing or Known limitation sections in the body.
8. **Watch CI.** `gh pr checks --watch --fail-fast`. If Test fails, read the log (`gh run view <run id> --log-failed`), fix it in the worktree, commit, push and watch again. It merges itself once Test passes; confirm with `gh pr view --json state,mergedAt`. Don't stop while it's red, and never merge it by hand past a failing check.
9. **Clean up.** Once merged: `tools/worktree.sh finish <n>`. The issue closes from the PR's "Closes #n". A merge that changes what ships makes a release on its own (`.github/workflows/release.yml`); check it appeared with `gh release list --limit 1`, and if the Release run failed, say so.
10. **Tell Jamie** in a few lines what changed, what you checked and what you didn't, with the PR link and the release version.

One issue per session. When it's done, stop; Jamie will start a fresh session for the next one. Ideas that come up on the way go to `/idea` (or a line at the end of your summary), not into this PR.
