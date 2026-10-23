---
paths:
  - "src/debug/**"
  - "src/console/**"
  - "tests/consoleShell.test.js"
---

## Debug panel

Backtick opens it. It has three tabs, each with a job; keep them that way, and keep each one ordered by what matters rather than by when it was added. Show what is worth tweaking or watching, not every internal number.

- **Vehicles** (`debugGui.js`, `vehicleDebug.js`): the picked vehicle (or whichever you're on). Order: actions, Running, Problems, Quirks, Tyres, how it was dealt, then every vehicle's own tuning. A new vehicle state goes in Running if you'd watch it and in Problems if it can go wrong; anything that can go wrong must be settable and clearable there, and "Put it right" must clear it (add it to `fixEverything`, with a test). A new quirk or fault is listed automatically from its kind list.
- **Girls** (`girlsTab.js`): one folder per girl: what she is doing, then "Why", then her actions in a closed "Make her do" folder (so both girls' details fit on screen at once), then favour and romance, then skills; shared things go in "Both girls and the farm". A new girl behaviour that can be started gets an action button (in "Make her do") for whoever does it, using a `forced` flag or request method on the module rather than waiting for chance. Per-girl state is per girl, not a list mixing both.
- **Tune** (`tuneCategories.js`): every `registerTuning` group needs a place in `TUNE_CATEGORIES`, in the category it belongs to (driving, engines, items, world, or one of the girls' three). A test fails until it is listed. Groups sort by category then name; don't rely on registration order.
- Actions live with the thing they act on (vehicle actions on Vehicles, girl actions on her folder), never in a separate pile.
- Buttons and settable values call the real game methods (as the in-game action does), so what you see in the panel is what the game does. Anything pure the buttons need goes in a tested module, not inline.
- Not persisted: no saved tabs, folders or values.
- The console (backslash, `src/console`) is the same state by typed path. A new vehicle state, girl value or world setting that goes in the panel goes in `gameTree.js` too (tuning groups appear on their own), and a new on-demand girl action goes in `src/debug/girlActions.js`, which both the Girls tab and `girl <name> <verb>` use. Commands are tested in `tests/consoleShell.test.js` against a stand-in host.

