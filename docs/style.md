# How the game looks

The style every model, texture, light and screen is built to, so the farm, the village and whatever comes next look like one place whoever builds them. `.claude/rules/looks.md` says how detailed things are; this says what they look like. Drafted from what is built and settled with Jamie (#428).

## When and where

- **Now, in lowland England.** A present-day working farm with machinery from every decade since the 1970s: a Series III and a 200TDi, quads from the 2000s to now, a tractor that has seen a lot, the girls' small hatchbacks. Phones, hi-vis, plastic feed sacks and wheelie bins exist.
- **The farm's own kit is used and worn.** Paint faded and rubbed through at the edges, mud in the corners, bodges and spare parts. Only the loan quad is near new. The village is kept a little better than the farm, but still lived in: tired paint, weeds at the foot of walls. It is a real working village, a little tired, not a picture-postcard street.

## Shape and surface

- **Realistic, not stylised.** Real proportions and sizes (`looks.md`, and the vehicles' `REAL_SIZES`), no cartoon shapes, no exaggerated scale for readability.
- **Procedural textures with variation.** Every large surface has grain, weathering or pattern from a canvas texture (the kits in `villageTextures.js`, `neighbourTextures.js`, `outbuildingProps.js`); wear comes from the geometry's edges and nooks, not painted on.
- **Lettering** is made up but believable: made-up makers on the machines, hand-painted farm signs, proper British road signs and shop fascias.

## Colour and light

- **Muted, natural colour.** Grass greens and hedgerow browns, stone and brick, weathered timber, the machines' faded reds, greens and blues. Bright colour is for what is bright in real life: a new quad's plastics, hi-vis, signs, the girls' clothes.
- **Soft British daylight.** Mostly a bright overcast or broken cloud, the sun low in the south-west in the afternoon, shadows soft. Dusk is long and gold to blue; night is properly dark and lit only by real lights.
- **Everything is lit by the world.** Nothing glows unless it gives light (`looks.md`).

## Screens

- **Things you'd hold.** The close-up screens look like the real thing they show: chalk on the board, photos pinned to cork, the ads as newsprint, Amy's notebook on paper, the map in an Ordnance Survey style, inside the shared frame (`.claude/rules/interface.md`).
- **The HUD is quiet.** Small, plain, out of the way, in the shared type and colours.

## The girls and people

- Built on one realistic model, each with her own figure and height; clothes are real farm and casual wear dealt by the day and the weather, getting muddy and wet. Other people (the neighbour, the post van's driver, villagers) are women on the same model, dressed for who they are.
