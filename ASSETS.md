# Assets

Every external asset is CC0 1.0 (public domain). Models come from Poly Pizza and live in `public/models/`; engine recordings come from Freesound and are cut into `public/audio/`.

## Models

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

## Audio

`public/audio/engine-bank.wav` and `engine-bank.json` are cut from these recordings by `tools/slice_engine_audio.py`, using Freesound's high-quality MP3 previews:

| Used for | Recording | Author | Source | Licence |
| --- | --- | --- | --- | --- |
| Idle pulses, starter, shutdown | Quad Bike_ATV Engine.wav | Alex Fitzwater (Alex_hears_things) | https://freesound.org/people/Alex_hears_things/sounds/379915/ | CC0 1.0 |
| The blue quad's idle | ATV Revving engine.mp3 | SomeoneCool15 | https://freesound.org/people/SomeoneCool15/sounds/419091/ | CC0 1.0 |
| Revs from about 2,000 to 7,000 rpm (both four-strokes) | Single Cylinder Motorcycle (Honda CRF250) | richwise | https://freesound.org/people/richwise/sounds/361407/ | CC0 1.0 |

`public/audio/engine-bank-2t.wav` and `engine-bank-2t.json` (the yellow two-stroke) are cut from:

| Used for | Recording | Author | Source | Licence |
| --- | --- | --- | --- | --- |
| Idle pulses | motorcycle dirt bike motocross start idle, rev, stop, kick start, false start, drive off pull away pull up stop.wav | kyles | https://freesound.org/people/kyles/sounds/450034/ | CC0 1.0 |
| Pulses from about 3,000 to 8,500 rpm | motorbike crm 250 cc onboard ride pullaway.wav | martian | https://freesound.org/people/martian/sounds/148868/ | CC0 1.0 |
| Starter and shutdown | Quad Bike_ATV Engine.wav (as above) | Alex Fitzwater | https://freesound.org/people/Alex_hears_things/sounds/379915/ | CC0 1.0 |

The original WAV of the first recording (96 kHz / 24-bit) needs a free Freesound login to download. To use it, convert it to 44.1 kHz mono 16-bit and rerun the slicer.

## Modifications

- `companion.glb` is recoloured at load time (navy polo, green wellies) by swapping entries in its palette texture, and gets a collar, polo placket and welly shafts built from primitives and attached to her bones. See `src/npc/outfit.js`. The file itself is unchanged.

## Built in code

These have no external source:

- **Quad bike**: primitives in `src/vehicle/quadModel.js`. No CC0 quad or ATV model was available; Poly Pizza only had CC-BY motorbikes and buggies. The model is one group with named parts (`body`, `handlebars`, `wheel_fl` / `wheel_fr` / `wheel_rl` / `wheel_rr`, `seat`, `pillionSeat`) so it can be swapped for a real model later.
- **Round bales** (straw and black-wrapped silage) and the **five-bar field gate**: primitives in `src/world/props.js`, with canvas-drawn straw textures.
- **Jerry can** and **petrol tank**: primitives in `src/items/`.
- **Quad body styles** (utility, utility with brush guard, two-stroke sport): all primitives in `src/vehicle/quadModel.js`.
- **Dashes**: drawn on canvas in `src/vehicle/dash.js`.
- **Terrain, track, grass tufts, distant trees and sky**: generated in `src/world/`.
- **Synthesised engine sound** (selectable in the tuning panel), relay clicks, fuel pump, pouring and wind: synthesised at runtime in `src/audio/`.
