---
description: Work one cohesion issue, or check what has drifted from the game's rules since the last tidy and fix or file it
argument-hint: "[issue number; default: the next 🧩 cohesion issue; 'check' for a check-up]"
---

Cohesion work on $ARGUMENTS: keeping the game pulled together, so it has one way to use things, one look, one name for each thing and one level of detail. It runs alongside feature work, in its own session. `/todo` takes issues in number order, cohesion ones included; this takes `🧩 cohesion` issues first.

- **A number** works that issue.
- **Nothing** takes the next cohesion issue: the lowest-numbered open one labelled `🧩 cohesion` and `🔜 next`, else the lowest-numbered open `🧩 cohesion` issue not labelled `💤 later` with no open PR (`gh pr list --search "<n> in:body"`). If there is none, do the check-up.
- **`check`** does the check-up.

```
gh issue list --state open --label "🧩 cohesion" --json number,title,labels --jq 'sort_by(.number) | .[] | "\(.number) \(.title) \([.labels[].name] | join(","))"'
```

The rules are the yardstick; read them all first: `.claude/rules/controls.md` (keys, prompts, feedback, names), `.claude/rules/interface.md` (tokens, the close-up frame, messages), `.claude/rules/debug-panel.md` (four tabs, the console mirroring them), `.claude/rules/looks.md` (detail, light, size), `docs/glossary.md`, and "Where things stand" in `docs/decisions/process.md`.

## Working an issue

Follow `/todo` (`.claude/commands/todo.md`) for everything not said here. The extra steps:

1. **Audit before moving anything.** List what breaks the rule, where, and what it becomes, as a comment on the issue. When it changes what Jamie presses, sees or reads in play (a key, a prompt, a screen's behaviour, a name), stop and ask him to approve the list; a code or panel tidy that doesn't change play can go ahead.
2. **Move the outliers** in small commits, each saying what changed for the player.
3. **Add the test that keeps it there**, as the issue says. A cohesion fix without a test that fails on the next drift is half done.
4. **Update the rule** to what was built, and the FAQ, `docs/game.md`, `src/hud/controls.js` and the glossary wherever a key, a name or a behaviour changed.
5. **A testing issue** for anything Jamie should feel in play (new keys, a screen that behaves differently).

## The check-up

1. **Since when.** The last tidy is the last line of `docs/tidy.md` (a date and a commit). Read `git log --oneline <commit>..origin/main` and the diff's file list.
2. **Look for drift** in what changed, against each rule:
   - new or changed key bindings (`src/core/input.js`, `game.js`'s key handling) against `controls.md`; an interactable with no prompt, or no sound or visible change;
   - new top-level folders or loose buttons in the debug panel or console, buttons in the wrong tab, actions written as flags;
   - colours, fonts or sizes written loose in a stylesheet; a close-up screen not using the frame; new toasts against the message rule;
   - names in prompts, toasts, the girls' lines, the FAQ and the console against `docs/glossary.md`, and new things with no entry;
   - new visible things against `looks.md` (bare blocks, unlit materials, wrong sizes);
   - **docs that no longer match**: for each player-facing commit since the last tidy, does the FAQ (`src/faq/faqContent.js`), `docs/game.md` and `src/hud/controls.js` say what the game now does?
3. **Fix the small drift** (a stray button, a loose colour, a wrong name, a missing FAQ line, a missing prompt) in one PR from a worktree, labelled `🔨 task` and `🧩 cohesion`, as `/todo` does.
4. **Propose issues for the rest**, as `/idea` does (labels `🧩 cohesion` and the area), and ask Jamie before filing.
5. **Record it.** Add a line to the end of `docs/tidy.md`: the date, the commit you checked up to, and in a few words what was fixed and filed. It goes in the same PR.
6. Tell Jamie in a few lines: what had drifted, what you fixed, what you propose.
