---
paths:
  - "src/faq/**"
  - "src/start/**"
  - "index.html"
  - "faq.html"
  - "src/hud/controls.js"
---

## The FAQ and the start screen

The start screen (`index.html`, `src/start/startScreen.js`, the logo in `src/start/logo.js`) links to `faq.html`, the how-to page for a player, which should always be the best place to learn the game. Half of it is generated from the game's data so it can't go stale: the controls (`src/hud/controls.js`), each vehicle's facts (`src/faq/facts.js`, from its spec), the girls (`characters.js`), the bucket list (`achievements.js`) and "Recently changed" (the commit messages, via `vite.config.js`; `src/faq/changes.js` drops housekeeping ones). The other half is hand-written in `src/faq/faqContent.js`.

- Every item that changes what a player sees or does updates the FAQ: add the questions a player would ask about it ("How do I...", "Why won't...") with answers, and fix any existing answer it makes wrong (search `faqContent.js` for the feature's words). Better one more question than a longer answer.
- A new vehicle needs a `VEHICLE_NOTES` entry and a new girl a `GIRL_NOTES` entry; `tests/faq.test.js` fails until they have one. If a vehicle fact the page shows is wrong, fix `facts.js` rather than the note.
- Mark anything the game deliberately hides (a secret, a hidden mechanic, a romance beat) `spoiler: true` so it folds away. Give useful short answers a `tip` (under 140 characters, never a spoiler): the start screen shows them.
- When Jamie asks how something works, or something turns out to be confusing, add it to the FAQ as well as answering.
- The page is for a player: what to do and what happens, not file names or tuning numbers (those go in "For tinkerers" if anywhere). Same prose rules as the rest: British English, no em dashes, the player is "you".
- The logo is drawn in code. Keep "by Jamie Hurst" on it.

