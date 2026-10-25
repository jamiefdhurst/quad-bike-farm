---
description: Work one performance issue with measurements before and after, or check how the game runs and propose what to fix next
argument-hint: "[issue number; default: the next 🚀 performance issue; 'check' for a check-up]"
---

Performance work on $ARGUMENTS. It runs alongside feature work, in its own session. `/todo` takes issues in number order, performance ones included; this takes `🚀 performance` issues first. The difference from `/todo` is that every change is measured before and after, the same way, and a change that doesn't move the numbers isn't shipped.

- **A number** works that issue.
- **Nothing** takes the next performance issue: the lowest-numbered open one labelled `🚀 performance` and `🔜 next`, else the lowest-numbered open `🚀 performance` issue with no open PR (`gh pr list --search "<n> in:body"`). If there is none, do the check-up.
- **`check`** does the check-up.

```
gh issue list --state open --label "🚀 performance" --json number,title,labels --jq 'sort_by(.number) | .[] | "\(.number) \(.title) \([.labels[].name] | join(","))"'
```

Read first: `docs/decisions/performance.md` ("Where things stand" and the sections it names), `.claude/rules/checking.md` (the tools) and `.claude/rules/world.md`. The tool is `tools/perf.mjs`: it builds and serves a checkout itself, loads it in Chrome on this Mac's GPU, and measures time to "Ready", then at five spots (spawn, yard, village street, wood gate, hilltop) the draw calls, triangles, ms a frame, the worst frame and the slowest features. Two runs take about 80 s. Draw calls and triangles are exact; ms and load time vary by up to about 1 ms and 0.2 s between runs, and the report calls anything inside that "same".

## Working an issue

Follow `/todo` (`.claude/commands/todo.md`) for everything not said here: say the issue first, read it, ask only real decisions up front, the worktree, tests, docs, the PR with the issue's labels, watching CI, cleaning up, and telling Jamie. The extra steps:

1. **Measure before touching anything.** From the worktree: `node tools/perf.mjs --main --out <worktree>/.perf/before.json`. That measures origin/main as it is now. Keep the numbers out of git (`.perf/` is ignored). If the issue is about loading, add `--steps`; if it's about a feature's or a function's cost, take a profile too (`--profile 10 --dev`; compare it only with another `--dev` profile).
2. **Say what you expect to move**, and by about how much, before building. If the before numbers show the problem isn't there (the issue guessed wrong), say so to Jamie with the numbers and stop rather than build it.
3. **Build the change** in small steps. After each step that should move something, measure the branch: `node tools/perf.mjs --out <worktree>/.perf/after.json`, then `node tools/perf.mjs --compare .perf/before.json .perf/after.json`. Keep a step only if its numbers moved the way you expected; undo one that didn't, and say so in the decisions section. Never trade a look away for speed without asking Jamie (a lower draw distance he'd notice, a missing shadow up close).
4. **Final measurement**: rebase on origin/main, then measure main and the branch again (`--main --runs 3` and `--runs 3`), so both sides are the same main.
5. **The PR body** has what changed and why, then the `--compare` table under "Before and after" (the table is the reason for the change, so it belongs). If a step made things worse elsewhere (a stutter for fewer draw calls), say so in a line.
6. **The decisions file** gets the section at the end of `docs/decisions/performance.md`: what was done, the before and after numbers for what moved, and what was tried and undone. Fix "Where things stand" if the frame time, load time or a budget moved. If a budget in `tools/frameBudget.mjs` should be tightened because there's now room, tighten it to about 8% over the new numbers, with a line saying so.
7. **A testing issue** only if the change could show in play (pop-in at a distance, a shadow that goes, a stutter the tool can't catch).

## The check-up

1. Measure main: `node tools/perf.mjs --main --runs 3 --steps --out .perf/main.json` from a worktree or the scratchpad (never build in the main checkout, which other sessions are editing). Read the table, the loading steps and the "Over budget" lines.
2. Find the biggest cost. In order: anything over a CI budget; the spot with the highest ms a frame and why (draw calls, triangles, or a feature in the slowest list; take `--profile 10 --dev` if it isn't obvious); the worst frame if it is over about 33 ms (a stutter); the loading step that takes longest.
3. Compare with the last check-up or performance section in `docs/decisions/performance.md` and say what has crept up since, and which merges did it (`git log --since`).
4. Check whether an open `🚀 performance` issue already covers it. If one does, say which and recommend `🔜 next` for it. If not, draft one as `/idea` does (title, what to change, the numbers that show it, what it builds on, labels `🔨 task` or `⚡ enhancement` plus `🚀 performance` and the area), and ask Jamie before filing.
5. **Record it**: a line at the end of `docs/perf-checks.md` with the date, the commit measured, the headline numbers and what you proposed, committed through a small PR (`📚 documentation`, `🚀 performance`) if nothing else is going in. The session-start reminder reads it.
6. Tell Jamie the numbers in a short table, what has crept up, and the one thing you'd do next.
