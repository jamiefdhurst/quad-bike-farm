---
description: Have a fresh Opus subagent review this session's work against its issue and the game's rules, then act on what it finds
argument-hint: "[what to look at; default: everything this session changed] [--report: list the findings, fix nothing]"
---

`/todo` runs this itself before the pull request opens (its step 8: when the issue is labelled `🌾 world` or `🏍️ vehicles`, or the diff is over 150 lines, and not with `--solo`), so what it finds is fixed on the branch instead of filed after the merge (#1178). Jamie can still run it by hand at any time, part-way through or at the end of a piece of work, to have it looked at by someone who wasn't there. The reviewer is a fresh Opus subagent: it sees only the brief and what it reads for itself, so it isn't anchored on how this session reasoned. Run it even when this session is on Opus, as the fresh context is the point (unlike "Before you stop" in `.claude/commands/todo.md`, which is skipped there). Jamie asked for this subagent, so launch it without asking him.

`$ARGUMENTS` can narrow what is looked at ("the gate's latch", "the last two commits"). `--report` anywhere in it means list the findings and fix nothing.

1. **Write the brief.** The reviewer can't see this conversation, so give it:
   - **What the work is:** the issue's number, title and link, or what Jamie asked for in a line if there is no issue.
   - **Where it is:** the worktree's absolute path (`tools/worktree.sh path <n>`), the branch, and the PR number if one is open. The change is `git diff origin/main...HEAD` plus anything uncommitted (`git status --short`); say which.
   - **The pack:** the path `node tools/reviewPack.mjs <n> --worktree <path>` prints, made after the list is up to date. It holds the issue and its comments, `.scratch/issue-check-<n>.md` with its ticks and evidence, the branch's commits and changed files, the `.claude/rules/` files for them and the "Where things stand" summaries, so the reviewer reads one file once rather than fetching each (#1010).
   - **What Jamie has settled** this session, in his words where you can (his numbered answers, a `Jamie agreed:` line), so the reviewer doesn't reopen it.
   - **What you checked:** each command you ran (`npm test`, `npm run smoke`, a look) and its result, trimmed to the summary lines, and which commit it ran on.
   - **What you're unsure of.** Say it plainly: a doubt left out of the brief is one the review won't look at.
2. **Launch the reviewer** with the Agent tool: `subagent_type: "general-purpose"`, `model: "opus"`. Not a fork, which keeps this session's model and context. Its prompt is the brief, then the instructions below as they are.
3. **Weigh what comes back.** The reviewer can be wrong too, so check each finding against the code before acting on it: open the file, run the command. Each one is agreed, or disagreed with the evidence that shows why.
4. **Act on it**, unless `--report` was given:
   - **An agreed `fix`:** fix it now in the worktree, with a test that fails without the fix where it is logic. Run `npm test` (and `npm run smoke` if it touches `game.js` or the frame), update the line and its evidence in `.scratch/issue-check-<n>.md` if a tick changes, and commit with a message written for a player, staging files by name.
   - **A `nit`:** do the ones that take a minute; say which you left.
   - **An `ask`:** after the fixes, put them to Jamie as a numbered list, a recommendation and its reason with each. A finding that a line of the issue was done another way is an `ask` and makes it a `[~]` line, as `/todo` step 7 says.
   - **If no PR is open yet** (the run `/todo` makes before opening it), fix on the branch and carry on with `/todo` step 9; the `ask`s go to Jamie in the same stop as its step 7 questions.
   - **If the PR is open and not merged,** turn its auto-merge off before the first fix (`gh pr merge --disable-auto <pr>`), so it can't merge between pushes. When the fixes are pushed: `node tools/issueCheck.mjs post <n>` again if the list changed, `gh pr merge --auto --merge`, and `node tools/waitMerged.mjs <pr>` in the background as `/todo` step 10 says.
   - **If it has already merged,** file each agreed `fix` as a `🐛 bug` issue (what is wrong, the evidence, the fix, a **Where it fits** and a **Done when**; `node tools/issueLint.mjs --file <draft>` passes before filing). Fix a small one now in this session, from its own worktree and PR as `/todo` would; leave a bigger one for `/todo`.
   - **One more round at most,** and only when a fix ran to more than a few lines: send the reviewer the first round's findings and the diff of the fixes alone. Never loop until it's clean.
5. **Leave a count.** Post one line on the issue (`gh issue comment <n> --body '...'`), in exactly this form, the numbers being this round's findings of each kind and the fixes you agreed with, and the model id the item was built on (this session's, from your system prompt), as plain text, not in backticks:
   ```
   Recheck count: <f> fix, <a> ask, <n> nit; <g> fixes agreed; built on <model id>.
   ```
   `tools/recheckRate.mjs` totals these by model to show whether the recheck still pays (#1178). With no issue, there is nowhere to post it: skip it.
6. **Tell Jamie**, briefly: how many findings and of what kind, each fix with its commit, each one you disagreed with and why, the asks, and what the reviewer couldn't check. Then carry on with what the session was doing, such as the next step of `/todo`.

## The reviewer's instructions

Pass these on as they are, after the brief.

- **Read first:** the pack, once. It has the issue and its comments, the list, the `.claude/rules/` files for the changed files and the "Where things stand" summaries, so don't fetch those again; `CLAUDE.md` is already in your context. With no pack (no issue), read the rules file for each area the diff touches (`CLAUDE.md` lists them) and those areas' summaries in `docs/decisions/`. Then the diff and the code round it, not the whole codebase.
- **Keep it cheap** (#1010). Every request reads your whole context again, so batch your reads: several `sed -n` or `grep` in one Bash call, or calls side by side, and the diff a few files at a time rather than one by one. Open no images: a look is Jamie's to judge. Once a finding has its evidence, move on. Stop at about 40 requests and put what you didn't reach under what you couldn't check.
- **Check, in this order:**
  1. **The issue.** Every line is done as it says, all of it: a list of cases means every case, and a phrase like "for its size" is part of the job. Each tick's evidence exists and shows what it claims (open the file, find the test, run the command). Nothing the issue didn't ask for has crept in.
  2. **Correctness.** Bugs in the change: a wrong condition, state that isn't reset, something the farm should remember that the save drops (`captureVehicle`/`restoreVehicle`, `captureGirls`/`restoreGirls`), a per-frame update outside `this.guard.run`, a throw when a girl or vehicle isn't there, a value in the wrong units or along the wrong axis (Y up, a vehicle's forward is +Z), random farm character drawn from `this.seed` rather than a `this.farmSeed` stream.
  3. **Tests.** The changed logic has a test that would fail if it broke. Where you doubt one, prove it: make a throwaway change in the worktree, run that test, revert, and check `git status` is as you found it. No sound in tests.
  4. **The finishing list** in `CLAUDE.md`: tunables in `DEFAULT_*_PARAMS` with ranges and in `TUNE_CATEGORIES`, the debug panel and console, a `scene` for anything judged by eye or ear, the FAQ, `src/hud/controls.js`, names from `docs/glossary.md`, `docs/game.md`, the section in `docs/decisions/`, ASSETS.md, the voice banks.
  5. **Prose.** British English, no em dashes, the girls call the player only "you", commit messages written for a player, no AI attribution anywhere.
- **Run** `npm test` in the worktree if the brief's run is older than the last change. Not the smoke test or a headless browser unless a finding turns on it.
- **Never** edit files beyond a throwaway you revert, commit, push, comment on GitHub, change labels, or decide what is Jamie's (a look, a feel, scope, a line of the issue changed). Never write to the main checkout's `.scratch/`: a worktree's `.scratch` is a link to it, so copy anything a tool would write there before running it, put it back after, and check with `cmp` (#851).
- **Report** each finding like this, most serious first:
  ```
  1. [fix] src/world/gate.js:84: the latch never resets after the gate is shut by a girl
     evidence: the lines quoted, or the command and its output
     fix: what to change
  ```
  `fix` is wrong in a way the issue, `CLAUDE.md` or the rules already settle. `ask` is Jamie's call: give the question and a recommendation in place of the fix. `nit` is small and optional. Then a few lines on what you checked and found right, and what you couldn't check. If nothing is wrong, say "Nothing to fix" rather than padding the list.
