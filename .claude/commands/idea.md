---
description: Turn an idea, or a brainstorm on a theme, into GitHub issues once Jamie has said yes or no to each
argument-hint: "[an idea, or a theme to brainstorm]"
---

Jamie's idea or theme: $ARGUMENTS

1. **Check it fits the game.** Read `docs/what-the-game-is.md` and, for anything you'll see, `docs/style.md`. Say which principle each idea serves; question one that serves none, ask how the girls come into one that leaves them out, ask whether the world could show what a new screen would, and ask what is unfinished before somewhere new.
2. **Check what's already there.** Search the open and closed issues for the idea's words (`gh issue list --state all --search "<words>" --limit 20`), read `docs/decisions/ideas-turned-down.md`, and grep `docs/decisions/` for whether it was already built or left out on purpose. Read only enough of the code to know what exists and what the idea would build on.
3. **Draft.** If Jamie gave one idea, write it up as one issue. If he gave a theme, come up with a handful (four to eight), each one distinct and buildable as a single PR; split anything bigger, or mark it "Big: split before starting". Each one has:
   - a short title, written as what changes for the player ("Asleep on the back");
   - a body in the TODO list's style: what happens in the game, the girls' parts, and a "Why:" line if it isn't obvious; what it builds on (issue numbers, modules); what it depends on;
   - if it adds anything you'll see (a building, a yard, a prop, a thing you carry, a vehicle part), a **Looks like** section: the real thing it's based on, and a list of the 8 to 15 features you'd know it by, outline to small detail (for a village shop: the fascia with its name, a display window in panes with goods behind, a step, the door with a bell and posters, an A-board, a newspaper rack, a bin, a light over the door). This is the brief the build is checked against (`.claude/rules/looks.md`), so be specific;
   - its labels from `.github/settings.yml`: one type (`✨ feature`, `⚡ enhancement`, `🐛 bug`, `🔨 task`) and the areas it touches, plus `🚀 performance` if it is about how fast the game runs or loads (`/perf` works those, with the numbers that show the problem in the body), or `🧩 cohesion` if it is about making the game consistent with itself (`/tidy` works those).
   Follow CLAUDE.md and the "Ideas turned down" rules: new characters are women on the girls' model, the girls call the player "you", British English, no em dashes.
4. **Ask.** Show them as a numbered list (title, two or three lines, labels), flag any that overlap an existing issue or a turned-down idea, and give your recommendation for each. Then stop and wait. Jamie answers in a matching numbered list: yes, no, or a change.
5. **File the yeses.** `gh issue create --title ... --body ... --label ... --label ...` for each yes (with his changes), in the order he'd want them done. If he says one should go first, add `🔜 next`.
6. **Record the noes.** Add each no to `docs/decisions/ideas-turned-down.md` with one line on why (his reason if he gave one), so it isn't offered again. Commit that on its own branch through a PR, as `/todo` does (a docs-only PR doesn't make a release), or alongside the next item's PR if one is open.
7. **Report** the new issue numbers and links, and what was turned down.
