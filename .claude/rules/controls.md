---
paths:
  - "src/core/input.js"
  - "src/hud/**"
  - "src/items/**"
  - "src/workshop/**"
  - "src/game.js"
---

# Controls: one way to use things

Anything you can use, pick up, hook, switch or talk to follows one rule, so the game feels like one game. docs/decisions/process.md, "Pulling the game together (#417)". #416 audits every binding against this and moves the ones that break it; until it lands, follow the rule for anything new and don't copy an outlier.

## The rule

Each context has its own key map, and within a context a key means one thing: **on foot**, **riding** (driving any vehicle), **on the back** (a girl driving), **a close-up screen** (a board, the bench, a shelf, the map) and **photo mode**.

- `E` (press) uses what you're looking at: pick up, open, read, talk, switch on or off, hook on or off, ring, sit.
- Hold `E` does anything that takes time: pour, fill, wash, fork, bleed, strap, tip out. The prompt says "hold".
- `G` puts down what you hold.
- `B` leaves, backs out or cancels: get off, close a screen, go back a step.
- Riding, the vehicle's own controls keep their keys (`K` key, `R` crank, `O` pull-start, `P` lights, the choke, gears, 4WD, the horn), and kit worked from the seat (the winch's `X`) is a vehicle control.
- A new act fits one of these. If none fits, it's a decision: ask Jamie, don't take a free letter.

## Every act

- **A prompt.** Everything you can use shows the prompt (`hud.setPrompt`) when you look at it: the key, "hold" if it is one, and what it does, using the glossary's name for the thing ("E  Pick up the jerry can"). Once #416 lands, add it to the interactables registry rather than to `game.js`'s prompt code.
- **Feedback.** It makes a sound and shows a change, and a girl reacts where she'd notice. A toast is not feedback for something you can see happen (`interface.md`).
- **Listed.** The key goes in `src/hud/controls.js` (the help and the FAQ read it) and the FAQ answers how to do it (`faq.md`).
- **Names** come from `docs/glossary.md`: one name for each place, thing and job, in prompts, toasts, the girls' lines, the FAQ, the guide, the console and the panel. A new thing gets its entry there first.
