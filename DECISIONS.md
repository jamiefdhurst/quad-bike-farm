# Decisions

A running log of choices made while building this, so later work starts from the same assumptions.

## Working agreement (2026-10-04)

- Built autonomously from the original brief.
- Local git repo on `main`, no remote.
- NPC code lives under `src/npc/` as a generic NPC behaviour state machine with a `Companion` built on it. The in-game label follows the brief.

## Stack

- Three.js + Vite, plain ES modules. Rapier (`@dimforge/rapier3d-compat`) for physics. lil-gui for tuning. Vitest for the engine tests.
- Fixed 60 Hz physics step with render interpolation for the bike and the walking player, so high refresh rate displays don't judder.
- Y is up. The quad's local forward axis is +Z.

## Assets

- No CC0 quad bike exists on Poly Pizza, Kenney or Quaternius (only CC-BY motorbikes and buggies), so the quad is built from primitives in `src/vehicle/quadModel.js` with named parts.
- Companion character: Quaternius "Animated Woman" (CC0). It ships Idle, Walking, Sitting and SitIdle clips, so no procedural sit pose was needed. The legs are spread procedurally on top of SitIdle so she straddles the pillion seat instead of sitting side-saddle.
- The only CC0 "hay" model is a sheaf, not a bale, so round bales (straw and black-wrapped silage) are built in code. Same for the five-bar field gate.
