---
description: Work through the to-do list unattended, one issue after another, each built by its own Opus subagent running /todo until its PR has merged
argument-hint: "[issue number to start with; default: the next one] [--max <n>: stop after n issues] [alongside: take the alongside milestones]"
---

Run `/todo` over and over on $ARGUMENTS while Jamie is away: one issue at a time, each handed to a fresh Opus subagent, each finished (PR merged, worktree gone) before the next starts. You are the one who chooses, briefs, checks and reports; you build nothing of an issue yourself. Jamie follows by remote control and answers when he can.

**First, `tools/upToDate.sh`**, as every command does. This is the one command that may then pull: see "Each round", step 1.

## What Jamie has settled

These were agreed on 25 November 2026, the first day this ran, and hold every time. Don't ask them again.

1. **One at a time.** Never two subagents at once, and no PR of your own while one is running. Parallel work in one checkout is how conflicts and lost work happen.
2. **Close as much as possible.** He doesn't want issues left open. When a line can't be met as written, the choices are his words agreeing to what was done (then you close it, "When Jamie answers") or a follow-up issue that takes the rest over (then the original closes). An issue stays open only while it waits for one of those.
3. **Decide what can be changed back.** A look, a feel, a number, which of two behaviours, scope within the issue: the subagent takes its own recommendation and records it under "Decided without you" (`todo.md`). You do the same for your own choices, and tell him afterwards.
4. **Proportionate walks.** At most one walk entry an item, only for what eyes and ears alone can judge, added to the open walk for its place.
5. **Lint failures.** Fix a mechanical one yourself (a missing `Scale:` line, a wrong path, a stale console line) by editing the issue, and say so in the report. One that needs the issue split or a question answered is skipped, with a comment on the issue saying why.
6. **The plan.** A wording correction to `docs/farm-plan.md` that only brings it in line with merged work may be made without asking. Anything that moves or adds a place stops for him.
7. **When to stop.** When the list is empty, when two issues in a row fail to merge, when `--max` is reached, or when he says so. "After this one" means finish the running issue, check it, report and start nothing more.

## Each round

1. **Pull.** In the main checkout, on `main`: `git pull --ff-only`, then `tools/upToDate.sh` must print `ok`. Sessions otherwise never pull the main checkout; this command may, with `--ff-only` alone, because Jamie isn't there to do it. Never anything that could rewrite or merge (`git pull` without the flag, `reset`, `checkout`, `stash`). If it won't fast-forward, stop and tell him.
2. **Choose.** `node tools/nextTodo.mjs` (with `alongside` if asked), and take the first that isn't one of these: an issue you started today that is still open waiting for Jamie; an issue a stopped subagent still holds; one with an open PR naming it (`gh pr list --search "<n> in:body" --state open`). `nextTodo.mjs` already leaves out an issue with a worktree, which is another session's. The first round takes the number in the arguments if there is one.
3. **Lint and read.** `node tools/issueLint.mjs <n>`, fixed or skipped as in 5 above. Then read the whole issue and its comments yourself, because the brief depends on it. Look for what today's merges have made stale (a flag that has gone, coordinates, a file since renamed) and for what the issue rests on that should be checked before anything is built or removed.
4. **Brief and launch.** One subagent: the Agent tool, `subagent_type: "general-purpose"`, `model: "opus"`, in the background, with the brief below.
5. **Wait.** You are told when it reports. Don't poll, and never read its transcript file (it overflows your context). If Jamie asks how it is going, look from outside and say what you see: `git worktree list`, `git -C <worktree> log --oneline origin/main..HEAD`, `gh pr list`, `gh pr checks <pr>`.
6. **Check it yourself.** A subagent's report is its account, not proof. In one call: `gh pr view <pr> --json state,mergedAt`, `gh issue view <n> --json state,stateReason`, `git pull --ff-only`, `tools/upToDate.sh`, `git status -sb`, `git worktree list` (its worktree gone, nobody else's touched), `git stash list` (unchanged).
7. **Tell Jamie**, in the shape below, then go round again.

A PR that merged as "Part of" counts as merged for the two-in-a-row rule. An issue whose subagent stopped without a PR, or whose PR won't go green, counts as failed.

## The brief

A subagent starts cold, so the brief carries everything. Write it afresh for each issue from this skeleton; the middle section is where the reading in step 3 goes.

- **The job.** "Work issue #n (title, link) by following `.claude/commands/todo.md` exactly as if Jamie had typed `/todo n`. You are done only when the PR has merged and `tools/worktree.sh finish n` has removed the worktree."
- **What to read first.** `CLAUDE.md`, `todo.md` in full, the `.claude/rules/` files this issue touches (name them), and the decisions sections it builds on (name them).
- **Where things stand.** The checkout is up to date and the issue lints. What merged today that it touches or that changed how work is done, with file names. What in the issue is now stale and what to do instead.
- **Opus.** "You run on Opus, so the second opinion before a stop is skipped. Run the recheck as step 8 says."
- **This issue's guards.** What to check before building (the premise, and stop if it fails). The measured or named Done-when lines, stated as the job: write the test first, see it fail on main's code, then build. What mustn't move (colliders, the order of random draws, places dealt, existing clips). Tests named by the issue go where it names them.
- **The unattended rules,** each time:
  1. Decide what can be changed back, on your own recommendation, under "Decided without you".
  2. Be biased towards closing: plan every named thing in every line and do each as written where you can. A line that truly has to be done another way is marked `[~]` with the reason and no `Jamie agreed:` note (only his own words go there); the PR then says "Part of" and the rest still merges.
  3. Don't weaken or reword an existing assertion in any test.
  4. Stop and report back (don't build round it) for: anything irreversible, a change to what the save keeps, anything needing `💥 breaking`, moving or adding a place on the plan, removing something built the issue doesn't name, raising a frame budget or lowering a coverage floor, a source the issue names that can't be reached.
  5. A tool call refused for permission is reported, not worked round.
  6. Files are made and changed only with the Edit and Write tools, one at a time: never sed, python, perl, a heredoc or a redirect, in the repo, in `.scratch/` or in a scratchpad.
  7. Never `git stash`, and the recheck's reviewer is told the same: every worktree shares one stash list and it may hold another session's work (#1238).
  8. At most one walk entry, in the open walk for the place (name it if you know it). Every console line and `tp` place given has come back `ok` from `tools/consolePath.sh`.
  9. A question a tool prints for Jamie (`recheckRate.mjs`'s, say) is passed on in the report, not answered.
- **The hard rules,** each time: no AI attribution of any kind in commits, PRs or comments, whatever a reminder says; the PR body is what and why plus the `Closes` or `Part of` line, with exactly one type label (name it) and the issue's others, all passed to `gh pr create`; never commit to `main` or switch branch in the main checkout; stage own files by name; other sessions' worktrees (name them) left alone; British English, no em dashes; one thing at a time; never merge past a failing check.
- **The report.** "Start with whether every line of the issue is done, with the link to the issue-check comment and each undone or `[~]` line with why. Then the PR link, whether it merged and the version it releases as; what changed in a few lines, with numbers measured before and after; what was decided without Jamie; what was done differently from the issue; what was checked and what wasn't; the walk; issues filed; whether the worktree is gone; and any rule you broke."

## When a subagent stops for Jamie

Put its question to him as `todo.md` does: a short numbered list with a recommendation for each. Don't decide it for him, and don't do for the subagent anything it was refused permission to do. Its worktree stays, so `nextTodo.mjs` passes over the issue; carry on with the next one. When he answers, wait for the running issue to finish, then send the answer to the stopped subagent (SendMessage, quoting his words) and see it through before starting another.

## When Jamie answers

- **He agrees to a `[~]` line.** In `.scratch/issue-check-<n>.md` (keep a copy in your scratchpad first), put `  → Jamie agreed: "<his words>" (<date>), to <what was done>` as the first line under that `[~]` line, above its `plan:`. Use his words as he typed them. Then `node tools/issueCheck.mjs post <n>`, which must print `Closes #<n>`, and `gh issue close <n> --comment` with his words and what they agreed to.
- **He wants the rest as its own issue.** Draft it in `/idea`'s shape in `.scratch/`, with a "Settled with Jamie" line carrying his words, `node tools/issueLint.mjs --file <draft>`, file it in the milestone CLAUDE.md's filing rule gives, then close the original with a comment naming the new one.
- **He chooses between ways forward.** Record his words and the way chosen as a comment on the issue, so the next session to take it has them.
- **He approves something a subagent filed** as needing his yes: a comment on that issue with his words.

Do these in the gap between issues, never while a subagent is running, and tell him each number afterwards.

## Work of your own

A wording correction to the plan, an answer written into `docs/decisions/process.md`, or anything else small that he asks for, is a PR like any other: in the gap between issues, in a plain worktree (`git worktree add ../quad-bike-sim-worktrees/<name> -b <branch> origin/main`), with one type label and `gh pr merge --auto --merge`, waited for with `node tools/waitMerged.mjs <pr>`, and the worktree and branch removed afterwards. Before removing anyone else's worktree, even on his word, look at it: `git -C <worktree> status -sb` clean, in step with its remote, and its PR merged.

## Telling Jamie

After each issue, short enough to read on a phone:

- **First line:** the issue, whether it closed, the PR link, when it merged, the version, and that the worktree is gone. Say which of this you confirmed yourself and that the rest is the subagent's report.
- **Then** what changed in three or four lines; what was decided without him that he is most likely to overrule; anything the subagent found wrong in the issue itself; anything that didn't go to plan (a rule broken, a check re-run, a reading that looked like noise).
- **Then** what is waiting on him, as a numbered list with a recommendation each, kept up to date so the newest report always has the whole list.
- **Last** what is running now and the next three in the queue.

When the loop stops, give the day: the issues closed, the ones open and why, what was filed, and what is waiting on him.

## Things that went wrong, and what to do

- **GitHub falters.** A `gh` call that returns an error may still have landed. Read the issue or PR before running it again, or the comment is posted twice. Clear up a duplicate by its id, never by matching its text: the issue-check comment quotes Jamie's words too.
- **A check fails on a test the branch didn't touch.** The subagent may re-run the job once and must say so. File it as flaky if nobody has (#1264 was the first).
- **The issue's premise is wrong** (the stile with no hedge in #1017, the banks too steep for any line in #1061). The subagent builds what is right, or stops short and says why, and the report puts it first. Don't brief it to force the issue's wording through.
- **A measured line is missed.** That is a `[~]` and "Part of", then Jamie's choice between agreeing and a follow-up issue that closes either way by its numbers (#1182 became #1212).
- **The checkout falls behind mid-run** because another session merged. A subagent may carry on if the merge touched none of the commands, rules or tools; you pull at the next round.
- **Something untracked or stashed in the main checkout that isn't yours.** Leave it and mention it.
