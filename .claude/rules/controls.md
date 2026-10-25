---
paths:
  - "src/core/input.js"
  - "src/hud/**"
  - "src/items/**"
  - "src/workshop/**"
  - "src/game.js"
---

# Controls: one way to use things

Anything you can use, pick up, hook, switch or talk to follows one rule, so the game feels like one game. docs/decisions/process.md, "Pulling the game together (#417)". #416 audited every binding against this (the audit and Jamie's answers are on the issue). The map is `src/input/controlMap.js`, held by `tests/controlMap.test.js`; entries with a fourth part (`wheel`, `photo`) are not in the game yet, and the pieces of #416 still to land move them. Until then follow the rule for anything new and don't copy an outlier.

## The rule

Each context has its own key map, and within a context a key means one thing: **on foot**, **riding** (driving any vehicle), **on the back** (a girl driving), **a close-up screen** (a board, the bench, a shelf, the map) and **photo mode**.

- `E` (press) uses a **thing** you're looking at: pick up, open, read, switch on or off, hook on or off, ring, sit, get off. `Enter` is for **people**: looking at a girl, from anywhere including the seat, it opens her wheel; looking at nobody it opens your own (races and the rest). Until #416's wheel piece lands `E` still talks to her on the back.
- Hold `E` does anything that takes time: pour, fill, wash, fork, bleed, strap, tip out. The prompt says "hold".
- `G` puts down what you hold.
- `B` backs out or cancels: close a screen, go back a step, leave photo mode. Getting off a vehicle is `E` (the key you got on with). Riding, `B` is the vehicle's reverse.
- Riding, the vehicle's own controls keep their keys (`K` key, `R` crank, `O` pull-start, `P` lights, the choke, gears, 4WD, the horn), and kit worked from the seat (the winch's `X`) is a vehicle control.
- `T` works a vehicle's or trailer's kit (tip, fold, drop a tailgate, right a tipped quad), from the seat or beside it. `J` hooks a trailer on from the seat; on foot it is `E` at the drawbar.
- A close-up screen is closed by `B` and `Esc` only. `E` acts on it, `G` does nothing there. Rows are picked with `W`/`S` or the arrows and pressed with `E`; a page turns with the arrows. No letter shortcuts.
- A new act fits one of these. If none fits, it's a decision: ask Jamie, don't take a free letter.

## Every act

- **A prompt.** Everything you can use shows the prompt (`hud.setPrompt`) when you look at it: the key, "hold" if it is one, and what it does, using the glossary's name for the thing ("E  Pick up the jerry can"). `Interaction.add` refuses a thing with no `prompt()`; `src/interaction/prompt.js` is the one shape (`{ action, hold, keys }` for an act, `{ info, keys }` for a reason you can't), and the HUD draws every prompt from it. Write new prompts in that shape; a string is an E action and `{ text }` a reason.
- **Feedback.** It makes a sound and shows a change, and a girl reacts where she'd notice. A toast is not feedback for something you can see happen (`interface.md`).
- **Listed.** The key goes in `src/hud/controls.js` (the help and the FAQ read it) and the FAQ answers how to do it (`faq.md`).
- **Names** come from `docs/glossary.md`: one name for each place, thing and job, in prompts, toasts, the girls' lines, the FAQ, the guide, the console and the panel. A new thing gets its entry there first, and `tests/glossary.test.js` fails on a variant it lists (a girl's line that has one needs re-recording: `voice-lines.md`).
- **The map.** A new key goes in `src/input/controlMap.js` in its context, with `src/input/keyMap.js` if it can be remapped.
