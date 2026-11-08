---
paths:
  - "src/world/**"
  - "src/items/**"
  - "src/workshop/**"
  - "src/effects/**"
---

# Making a new thing look right the first time

## Definition of done

The line to check before opening a PR for anything you'll see. Jamie keeps getting plain boxes.

- The issue's **Looks like** list is in the PR, every feature ticked, each one something you saw in the shot.
- The bare-block test (`tests/bareBlocks.test.js`) passes with nothing added to a `KNOWN_` list. It fails a solid box of 1.5 m or more on every side wherever it hides (a big group, a merged mesh), a few boxes, too few triangles for the surface, and a large plain-colour model. To put a new thing under it, build it in `buildWorldModels` (`tests/helpers/worldModels.js`) with `add(kind, name, builder, call)`, where `builder` is the exported function or class itself and `call` makes the model with it. The test compares what the source exports (every `build...` function of `items`, `workshop` and `world`, every class of `items` and `workshop`) with what was actually called, so a builder that is named and not built fails. Only a thing with no model of its own goes in `NOT_MODELS`, with a line saying why.
- One look with `tools/shot.mjs`, two rounds at most.


New areas and items used to land as plain blocks, and Jamie had to ask for detail afterwards. These rules hold, in the style `docs/style.md` sets (era, wear, colour, light), for anything new you'll see in the world: a building, a yard, a prop, a thing you carry, a fixture. Vehicles have their own, stricter rules (`vehicle-detail.md`); the girls' clothes and figures are in docs/decisions/girls.md. docs/decisions/process.md, "Making new things look right (#383)".

## Before building

- **The issue's "Looks like" list is the brief.** It names the real thing and the 8 to 15 features you'd know it by. Copy it into your plan and tick each one off before the PR. If the issue has none, write one first from the real thing (a photo if Jamie can give one, or a careful description of a real British example) and add it to the issue with `gh issue comment`.
- **Build the look first**, as its own commit, before the mechanics: it's the part that gets cut when a session runs short.
- **Reuse the kits** before writing your own: `villageKit.js` (gabled shells, roofs with eaves and gutters, chimneys, sash and bay windows, doors, porches, dormers), `outbuildingProps.js` (`worldBox` with tiled UVs, corrugated, stone and block textures), `villageTextures.js` and `neighbourTextures.js` (brick, clay tile, paving, wood, paint, doors, signs, notices), and the vehicle detail kit in `src/vehicle/detail/` (bolts, cables, hoses, lamps, hinges, handles, grilles, decals), which works on anything. Add a new piece to a kit rather than to one building, so the next thing gets it free.

## How detailed

Work in three passes, like a real modeller, and don't stop after the first:

1. **Outline and size.** The real thing's proportions in metres (a door is about 2 m by 0.9 m, a pub sign about 1 m square on a post at 3 m). Get the silhouette right: roof pitch, overhangs, a lean-to, steps.
2. **Trim.** Everything that frames or edges the outline: frames round openings, cills, lintels, fascias, copings, plinths, gutters, posts and rails, rims and lips. Most of "looks like a block" is missing trim.
3. **Small detail.** The things that say someone lives or works there: signs and notices, a bin, a bucket, a hose, a light, a meter box, a doormat, weeds at the foot of a wall, stacked crates. A few in every area, placed where they'd really be.

And these, every time:

- **No visible object is one plain box.** Give it an edge: a bevel, a frame, a lid, a lip, a split into two parts. Something that is truly a box (a crate) gets its planks or battens.
- **No flat single colour on a large surface.** Use a canvas texture with variation (the kits have them), or at least two tones. Rust and dirt go in the texture, not as a separate tint.
- **Nothing floats and nothing has a see-through gap.** Stand things on the ground at the ground's height there (`terrainHeight`), overlap pieces where they meet, and embed attached parts a few millimetres so they don't flicker.
- **Lettering is readable** and on flat faces, never a real brand's name.
- Spend the detail where you'll see it from: walking past and riding by, not the roof's far side or underneath. Name the set piece in `farDetail.js` (`world.md`) so the detail costs nothing far away.

## Checking the look

One look per new thing, two rounds at most. A unit test can't tell a shop from a block, so this is the exception to CLAUDE.md's "no screenshot rounds".

- Shoot it in the running game with the overlay cleared and the HUD hidden: four sides and one close-up of the main face (the largest side), in daylight. `node tools/shot.mjs --name <group.name>` (or `--at <place>`) does it: it starts its own dev server, clears the overlay and checks it is gone, hides the HUD, sets daylight, hides whatever stands between the camera and the target for each shot (never the ground or the sky; it prints what it hid and puts it back, and `--keep` leaves it all in), and writes four sides, a close-up of the main face (the largest side, square on, framed whole) and a contact sheet to `.scratch/shots/<name>/` (`--fov` crops in on lettering; the top of the file lists the rest). Open the shots at full size; the sheet is for choosing which. Attach them to the testing issue if there is one.
- Look at each shot at full size, and crop the original for anything small (never judge detail from a shrunken contact sheet), against the "Looks like" list. Fix what's missing or wrong and take one more round if you must, then stop.
- Say in the PR summary to Jamie what you looked at, and put anything you couldn't judge (it reads right at dusk, it looks right from the lane) on the item's testing issue.

## Light and size

- **Lit like the world.** Everything in the world uses a lit material (`MeshStandardMaterial` or the like). Only things that give light (a lamp's lens, fire, a screen) or the sky are unlit; an unlit material on anything else glows at night and in shade. #414 adds a test with the named exceptions.
- **The right size.** Build to real sizes: doors about 2 m by 0.9 m, a step about 18 cm, a bench or worktop about 0.9 m, a seat 0.45 m, things you carry their real size against the player's eye height and the girls' height. #414 adds a table of real sizes for the world (like the vehicles' `REAL_SIZES`) and a test; until then, check against a real example.

## Checked by a test, not by eye

Anything you build from boxes and planks gets two tests before the PR, because a look at one angle will not find these:

- **No alpha fighting.** Build it in a test the way `tests/hutModel.test.js` does and run `coplanarOverlaps` (`tests/helpers/coplanar.js`; pass `textured: true` when its own surfaces are textured) over it: no two faces of the same way may lie within 3 mm of one plane and overlap. The shepherd's hut shipped with 87 of them (its back, roof edge, door and window) because nothing ran this over it. Fix by moving a part a few millimetres into its neighbour or making it a little narrower, never by ignoring the pair.
- **You can get in.** If you can walk onto, into or up it (steps, a doorway, a floor you stand on), put its colliders in a Rapier world with the player's capsule and controller and walk in, as `tests/hutEntry.test.js` does. A capsule has a round bottom and does not autostep a tall riser or a tread narrower than itself.
