---
description: Turn an idea, or a brainstorm on a theme, into GitHub issues once Jamie has said yes or no to each
argument-hint: "[an idea, or a theme to brainstorm]"
---

Jamie's idea or theme: $ARGUMENTS

1. **Check what's already there.** Search the open and closed issues for the idea's words (`gh issue list --state all --search "<words>" --limit 20`), read `docs/decisions/ideas-turned-down.md`, and grep `docs/decisions/` for whether it was already built or left out on purpose. Read only enough of the code to know what exists and what the idea would build on.
2. **Draft.** If Jamie gave one idea, write it up as one issue. If he gave a theme, come up with a handful (four to eight), each one distinct and buildable as a single PR; split anything bigger, or mark it "Big: split before starting". Each one has:
   - a short title, written as what changes for the player ("Asleep on the back");
   - a body in the TODO list's style: what happens in the game, the girls' parts, and a "Why:" line if it isn't obvious; what it builds on (issue numbers, modules); what it depends on;
   - its labels from `.github/settings.yml`: one type (`✨ feature`, `⚡ enhancement`, `🐛 bug`, `🔨 task`) and the areas it touches.
   Follow CLAUDE.md and the "Ideas turned down" rules: new characters are women on the girls' model, the girls call the player "you", British English, no em dashes.
3. **Ask.** Show them as a numbered list (title, two or three lines, labels), flag any that overlap an existing issue or a turned-down idea, and give your recommendation for each. Then stop and wait. Jamie answers in a matching numbered list: yes, no, or a change.
4. **File the yeses.** `gh issue create --title ... --body ... --label ... --label ...` for each yes (with his changes), in the order he'd want them done. If he says one should go first, add `🔜 next`.
5. **Record the noes.** Add each no to `docs/decisions/ideas-turned-down.md` with one line on why (his reason if he gave one), so it isn't offered again. Commit that on its own branch through a PR, as `/todo` does (a docs-only PR doesn't make a release), or alongside the next item's PR if one is open.
6. **Report** the new issue numbers and links, and what was turned down.
