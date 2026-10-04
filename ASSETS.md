# Assets

Every external asset is CC0 1.0 (public domain). All were downloaded from Poly Pizza as GLB files and live in `public/models/`.

| File | Asset | Author | Source | Licence |
| --- | --- | --- | --- | --- |
| `companion.glb` | Animated Woman (Idle, Walking, Sitting, SitIdle and others) | Quaternius | https://poly.pizza/m/9kF7eTDbhO | CC0 1.0 |
| `barn.glb` | Barn | Quaternius | https://poly.pizza/m/vSqQNA7ez6 | CC0 1.0 |
| `tree-oak-a.glb` | Tree | Quaternius | https://poly.pizza/m/qZtx0AHhcy | CC0 1.0 |
| `tree-oak-b.glb` | Tree | Quaternius | https://poly.pizza/m/aVOxaHRPWe | CC0 1.0 |
| `fence.glb` | Fence | Quaternius | https://poly.pizza/m/e02PFKKhbr | CC0 1.0 |
| `hedge.glb` | Hedge | Quaternius | https://poly.pizza/m/df8uCl1YpK | CC0 1.0 |
| `bush.glb` | Bush | Quaternius | https://poly.pizza/m/ooG6CkLyE8 | CC0 1.0 |

Quaternius: https://quaternius.com

## Modifications

- `companion.glb` is recoloured at load time (navy polo, green wellies) by swapping entries in its palette texture, and gets a collar, polo placket and welly shafts built from primitives and attached to her bones. See `src/npc/outfit.js`. The file itself is unchanged.

## Built in code

These have no external source:

- **Quad bike**: primitives in `src/vehicle/quadModel.js`. No CC0 quad or ATV model was available; Poly Pizza only had CC-BY motorbikes and buggies. The model is one group with named parts (`body`, `handlebars`, `wheel_fl` / `wheel_fr` / `wheel_rl` / `wheel_rr`, `seat`, `pillionSeat`) so it can be swapped for a real model later.
- **Round bales** (straw and black-wrapped silage) and the **five-bar field gate**: primitives in `src/world/props.js`, with canvas-drawn straw textures.
- **Terrain, track, grass tufts, distant trees and sky**: generated in `src/world/`.
- **All audio**: synthesised at runtime with Web Audio in `src/audio/`. There are no audio files.
