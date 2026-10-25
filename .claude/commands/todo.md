---
description: Work through one GitHub issue, start to finish, as a pull request that merges itself when CI passes
argument-hint: "[issue number; default: the next one]"
---

Work on GitHub issue $ARGUMENTS. If no number is given, take the next one: the lowest-numbered open issue labelled `🔜 next`, or if none is, the lowest-numbered open issue that isn't labelled `❓ question`, `🤦‍♂️ wontfix` or `🧪 testing` and has no open PR yet (`gh pr list --search "<n> in:body"`):

```
gh issue list --state open --label "🔜 next" --json number,title --jq 'sort_by(.number) | .[0]'
gh issue list --state open --limit 500 --json number,title,labels --jq '[.[] | select(all(.labels[].name; . != "❓ question" and . != "🤦‍♂️ wontfix" and . != "🧪 testing"))] | sort_by(.number) | .[0:5]'
```

Other sessions work in this checkout at the same time, so every item gets its own worktree and branch. Never switch branch in the main checkout, and never commit to main.

1. **Say which issue it is.** Before anything else, say its number, title and link: "Working on #260: Every frame throws since asleep-on-the-back (https://github.com/jamiefdhurst/quad-bike-sim/issues/260)".
   Then **read it.** `gh issue view <n> --comments`. Then the `.claude/rules/` files for the areas it touches (CLAUDE.md lists them; they don't load on their own in a worktree), the "Where things stand" summary of each `docs/decisions/` area it touches, and only the code and the sections it touches; don't read the whole codebase. The body ends "Was TODO <old number>" for items moved from the README: DECISIONS and the code call it by that number.
2. **Ask if it needs it.** If the item adds anything you'll see, read `.claude/rules/looks.md` and copy the issue's **Looks like** list into your plan (write one from the real thing and add it to the issue if it has none). If anything is genuinely undecided, ask Jamie now: a short numbered list of questions, each with your recommendation, then stop and wait. If it's clear, say in two or three lines what you're going to do and carry on without waiting. Write what was settled as a comment on the issue (`gh issue comment`) as well as in DECISIONS.md.
3. **Make the worktree.** `tools/worktree.sh start <n>` prints its path. Do all the work there: absolute paths for every edit and command (the shell's directory resets to the main checkout), your own dev server from it (`npx vite --port 5180`) for any headless check, and the voice recording run from it so the banks land in its `public/audio`. `node_modules` and `.scratch` are links to the main checkout's; if the item changes `package.json`, delete the link and `npm ci`.
4. **Build it**, the look first as its own commit if there's something new to see, then the rest, following CLAUDE.md: pure logic with unit tests where possible, tunables with ranges, the girls' lines in the voice files (re-record in the background if you add any, wait for it, and commit the banks on the branch before the PR is merged; see `.claude/rules/voice-lines.md`).
5. **Check it cheaply.** `npm test` in the worktree, `npm run smoke` if the item touches `game.js` or adds something to the frame, and at most one short headless check if it only shows in the running game. Anything new you'll see gets one look (two rounds at most) against its **Looks like** list, every feature ticked off (`.claude/rules/looks.md`, "Checking the look").
6. **Finish the docs** as CLAUDE.md says: the FAQ's answers in `src/faq/faqContent.js`, `docs/` if the item changes something a page there describes, a section at the end of the area's file in `docs/decisions/` and its summary line if the item changes how something stands (headed with the issue number, and its old TODO number if it had one: what was decided, why and any numbers measured, in about ten lines, without what wasn't checked), and ASSETS.md for any asset.
7. **Commit and open the PR.** Commit in sensible chunks on the branch, with messages written for a player (they become the FAQ's "Recently changed"), staging your own files by name. Before pushing, `git fetch origin && git rebase origin/main`; if the voice banks conflict, take main's and rebuild yours with `--bank-only`. Then:
   ```
   git push -u origin HEAD
   gh pr create --title "<what changed, for a player>" --body "Closes #<n>. <what it does and why>" --label "<each of the issue's labels>"
   gh pr merge --auto --merge
   ```
   The PR carries the issue's labels: exactly one type label, which decides the release's version bump (`✨ feature` minor, anything else patch), and `💥 breaking` on top only if an old farm save won't load or loses something (major). CLAUDE.md, "Versions and releases", says which; the required "Version label" check fails without one and says what the merge will release as. No AI attribution anywhere, and no Testing or Known limitation sections in the body.
8. **Watch CI.** `gh pr checks --watch --fail-fast`. If Test fails, read the log (`gh run view <run id> --log-failed`), fix it in the worktree, commit, push and watch again. It merges itself once Test passes; confirm with `gh pr view --json state,mergedAt`. Don't stop while it's red, and never merge it by hand past a failing check.
9. **Clean up.** Once merged: `tools/worktree.sh finish <n>`. The issue closes from the PR's "Closes #n". A merge that changes what ships makes a release on its own (`.github/workflows/release.yml`); the merge is the end of the item, so don't wait for the release.
10. **Ask for testing if it needs it.** If something you didn't check could be wrong in a way Jamie would want fixed, and only the running game can show it (how it looks, how it feels, a line by ear, what a girl does in play), open one testing issue for the item; otherwise none. Number tweaks and things the tests cover don't need one. At most one per item:
    ```
    gh issue create --title "Try: <the issue's title>" --label "🧪 testing" --label "<each of the issue's area labels>" --body "<body>"
    ```
    The body, short: `Try #<n>, merged in <PR link> (v<version>).`, then **Get there** (the quickest way: a "Make her do" button, a console command such as `girl amy tip`, a `to <place>`), **Try** (a checklist, `- [ ]`, one thing to do and see per line), **Right looks like** (what you expect, with any number worth eyeing), and **Not checked** (what the session couldn't see). No type label: it's not a change. The "not checked" list lives here now, not in DECISIONS.md.
11. **Tell Jamie** in a few lines what changed, what you checked and what you didn't, with the PR link, the version it releases as (from the Version label check's summary) and the testing issue's link if you opened one.

One issue per session. When it's done, stop; Jamie will start a fresh session for the next one. Ideas that come up on the way go to `/idea` (or a line at the end of your summary), not into this PR.
