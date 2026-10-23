---
paths:
  - "src/npc/**"
  - "tests/girlsMinds.test.js"
  - "tests/reactions.test.js"
  - "tests/availability.test.js"
  - "tests/needs.test.js"
  - "tests/chooser.test.js"
---

## The girls' minds

How the girls notice, react and decide has been rebuilt so each part lives in one place and everything new plugs into it rather than bringing its own timers and dice. Follow every part below for anything new the girls do; `tests/girlsMinds.test.js`, `tests/reactions.test.js`, `tests/availability.test.js`, `tests/needs.test.js` and `tests/chooser.test.js` check what they can. Read the summary at the top of `docs/decisions/girls.md` and the sections it names before changing any of it.

## What she decides to do (needs and the chooser)

What a girl does on her own follows from what she wants (`src/npc/needs.js`: warmth, company, excitement, rest, something to do) and is chosen in one place (`src/npc/chooser.js`, run by `updateMinds` in game.js every couple of seconds while she's free). Never give a new thing she does on her own its own timer and `random() < chance`.

- **A new thing she decides to do on her own** is an offer: give it an `OFFER_KINDS` entry (a label, the needs it satisfies and by how much, `urgent` if she should stop something idle for it), have its pure module return `offers(ctx)` (whether she could do it now: weather, distance, cooldowns, room; with a `weight` param for how keen she is) and `take(offer)` (what the old start did, returning the event), handle that event in a game.js method the update loop shares, and add the module to `offersFor` in game.js. The module's update keeps everything after she's started, and never starts it itself (each moved module has a test for that). A debug-panel force may still start it directly.
- **Something that should change what she wants** goes in `needsContext` in game.js (what moves the needs) or `Needs.update`, with its rate as a `need*` param. A new need goes in `NEEDS` with a label, and every offer that meets it says so.
- **A new boredom choice** is an entry in `boredOdds` and an offer in `boredOffers` on the companion.
- **How she goes about it** (`src/npc/intent.js`): give the offer kind a `pace` ('hurry', 'brisk' or 'dawdle') if it calls for one; have her say she's off to do it if it has no line yet; anything new that takes her from what she was doing for you (a new way of asking or calling her) calls `companion.interrupt()` first, as the wheel and the bell do.
- Personality is weights and rates in `characters.js` (Jess's restlessness, Amy's cold), not rules.
- **The two together** (`src/npc/pair.js`): going over to her friend and tagging along are offers; a new walk her friend may tag along on goes in `TAG_KINDS`. Stood together they face each other through `pairFacing` in the idle state, so anything new that turns a stood girl goes before it there or in `freeToTurn()`.
- The Girls tab's "Why" folder shows her needs (settable), what she chose and for what, and what she nearly chose: use it, and `Think now`, to see a new offer working rather than waiting for chance. Everything a girl decides to do with her free time is an offer now; the things left on their own clocks are reactions (to your rev, to being left on a quad, to falling out) and are listed in docs/decisions/girls.md ("Needs and a chooser (TODO 133): the rest moved"). A new reaction stays a reaction; a new choice is an offer.

## Is she free? (availability)

One answer, `companion.availability()` (`src/npc/availability.js`, pure, tested): `{ free, why, settled, held, canRemark }`. Never decide from `fsm.is('idle')` plus flags (a test fails on that in game.js).

- **Giving her something to do on her own** (a feature starting something): `c.availability().free`.
- **Something she'd only notice or remark on** (a smell, a quad going by): `c.availability().canRemark` (stood about or sat resting, and nothing holding both girls).
- **You asking her** (the wheel, the debug panel, the console): `c.availability({ asked: true })`; soft jobs give way and the farm's holds don't count. Say `why` when she's busy.
- **A feature checking its own girl mid-job**: pass `mine` (its job flag or hold key) so its own job doesn't count against her.
- **A new thing she does that should keep other features off her**: a feature that has her for a while calls `c.hold(key, why)` and `c.release(key)`; a flag on her goes in `JOBS` (soft if your asking should interrupt it). Something that holds both girls at once goes in `worldHold` (set in game.js).
- **A new state** gets a `STATE_WHY` entry (the test fails until it has one).
- The request methods' own `fsm.is('idle')` guards stay: they're what the state machine can do from where she is, not whether she's free.

## What she looks at (attention)

Decided in one place, `src/npc/attention.js` (pure, tested). Never turn her head or set `rig.lookTarget` from a feature.

- **Something happens that she would notice** (a sound, a crash, something worth turning to see): call `game.notice(kind, at, { key, strength })` where it happens. `kind` must be in `NOTICE_KINDS` (add it with its seconds, range, heard and interest, and its salience in `DEFAULT_NOTICE_PARAMS`, which is the "What catches the eye" tuning); the test fails for an unknown kind. Vehicle events (engine, horn, tipping, revving) come through `src/npc/noticeWatch.js`: add a new one there rather than calling notice from the vehicle.
- **A new state** (in `companion.js`, `companionDriving.js`, `companionHayRide.js`, `companionResting.js` or a new state file) has a `look`: `'free'` (whatever catches her eye), `'own'` (another poser has her head, as the pillion pose does, and gets attention's pick to turn it), or a function returning a focus `{ x, y, z, weight }` (`lookAtVehicle`, `lookAhead`). The test fails until it has one.
- **A sub-activity inside a state** (warming her hands while idle) calls `companion.attend(point, { weight, seconds })` while it's doing it.
- **Walking somewhere** needs nothing: from standing she looks at the target first (`lookLead`). A walk that mustn't pause puts `hurry: true` in the walking state's data.
- **Something new that pins her where she stands** (hands on something, a pose) adds itself to `freeToTurn()`, so she doesn't turn round to look mid-way through it.
- **A new way of waiting about that fits what's around her** goes in `WAITING_IDLES` (`src/npc/waiting.js`, with what it needs) and `STANDING_IDLES` (its pose); `pins` makes her face the thing and not turn round, `hands` keeps hands-up reactions off. Each girl's taste for it is her `waitTastes` in characters.js.
- **Someone or something she should keep an eye on all the time** (not a one-off event) goes in `attentionWorld` in `game.watchNotices`.

## How her body reacts (reactions)

A flinch, a step back, hands over her ears or her mouth, a cheer, turning away from smoke: `src/npc/reactions.js` (pure, tested) says which and when, `src/npc/companionReacting.js` poses it (the last rig poser, so it shows over anything else). Never pose a startle, a recoil or a gesture of surprise inside a feature.

- **A notice that should make her move**: add a rule to `NOTICE_REACTIONS` (which reaction, within how many metres, a chance or the name of her param holding it, `notOwn` for things she shouldn't react to on her own vehicle). Nothing else is needed: every notice is checked.
- **A feature that makes her react directly** (a line that goes with a jump back, smoke she breathed): call `companion.react(type, { from, strength })`, and fall back to something smaller if it returns false (she wasn't free to).
- **A new kind of reaction**: add it to `REACTIONS` (its timing and what it needs: `'any'`, `'feet'` or `'hands'`), its pose in `poseReacting`, check `mayReact` covers who may do it, and it gets a debug button for free from the list in `girlActions.js` (add it there). Look at it in a headless screenshot from in front of her (`.scratch/pp/reactshot.mjs`): IK targets are the wrists and the fingers reach on past them, so hands aimed at her middle cross.
- **Something new that occupies her hands** (holding, carrying, a pose with the hands on something) makes `mayReact` say no to `'hands'` reactions while it lasts.
- Per-girl differences go in her params (`reactEarsChance`, `reactCheerChance`, `reactCheerArms`, `reactFlinch` in `characters.js`), not in the rules.

