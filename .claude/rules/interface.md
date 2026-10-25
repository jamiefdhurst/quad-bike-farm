---
paths:
  - "src/**/*.css"
  - "src/hud/**"
  - "src/ui/**"
  - "src/faq/**"
  - "src/photos/**"
  - "src/workshop/**"
---

# Interfaces: one look, one behaviour

Every screen and message belongs to the same game. docs/decisions/process.md, "Pulling the game together (#417)". #413 builds the shared tokens and the close-up frame and moves the existing screens onto them; until it lands, match the closest existing screen and add no new colours or fonts you don't need.

## Look

- Colours, type, spacing, radii and shadows come from the shared tokens file, never written loose in a stylesheet. A board with its own character (chalk, cork, newsprint, the notebook's paper) is a named surface in the tokens, not a set of loose colours.
- New text in the game's own voice: plain British English, short, the glossary's names (`docs/glossary.md`).

## Close-up screens

The chalkboard, cork board, ads, bench, spares shelf, notebook, logbook, map, FAQ, toolbox panel and any new one use the shared frame: the same size rules, title, hint line at the bottom, and the same behaviour: the pointer is freed, the game pauses or not by the same rule, `B` and `Esc` close it, `E` acts, and a girl nearby reacts the same way. A new screen uses the frame module rather than building its own.

## Messages

- **A prompt** for what you can do now (`controls.md`).
- **A toast** only for what you couldn't see happen, or why something didn't work ("The tank is empty"). Short, one sentence, no instructions a prompt already gives.
- **A girl's line** when she would really say it (`voice-lines.md`), not a toast in her name.
- **Nothing** when the world already shows it: the thing moving, a sound, a light coming on.
