# Engine sounds for the vehicles: shortlist (2026-10-07)

**Picked by Jamie (idles):** mini moto the Derbi GPR 50, ATC the Piaggio Ape, UTV the Gator, Land Rover the Jeep rumbling idle, the green the Yamaha Ténéré 250 (revs maybe the Honda ATV), the yellow the Yamaha DT 125 with its revving left out, two-stroke revs the Honda CR85. The moto, ATC and UTV are built (docs/decisions/sound.md, "The mini moto's, ATC's and UTV's own sounds"), and the green and yellow ("The green's and yellow's own sounds"; the CR85 went to the yellow, and the orange keeps its old sound). The Tor's or Crag's is in its TODO item.

Candidates for the mini moto, the ATC, the diesel UTV (TODO 2), the Tor or Crag (TODO 15), and alternatives for the four-stroke quads (red, blue, green; TODO 31) and the two-stroke quads (yellow, orange; TODO 32). Shopped for on Freesound, CC0 only (each licence checked on the sound's page). To be picked by ear.

What makes a recording usable for a bank (see `tools/slice_engine_audio.py`): a close, steady idle with a clear firing rhythm; revs that rise steadily, ideally onboard; and a start and a stop as one-shots. Drive-bys are hard to use because of Doppler and the changing distance. Times below are seconds into the clip. "Firing" is pulses a second, measured from the envelope, so a rough guide only.

Working files are in `.scratch/shop/` (untracked): HQ previews in `raw2/<id>.mp3` and `.wav`, the searches in `r2/`, details in `r2/info*.txt`, and `timeline.py` (level and firing rate per second). As before, use the HQ MP3 previews, linked from each sound's page.

Freesound has very little CC0 for any of these. Nothing turned up for pit bike, minimoto, ATC or three-wheeler ATV, Mule, Gator UTV, Kubota or Series Land Rover, so several picks are stand-ins, and they're marked as such.

## 1. Mini moto (50cc two-stroke, pull-start)

- **Pick: Derbi GPR 50 with a race kit**, ahnoj, https://freesound.org/s/127592/ (68 s). A real 50cc two-stroke, raspy. Keys, start about 11 s, blips and rides off 13 to 22 s, comes back 28 to 53 s with its idle (a burst every 63 ms) between blips at 32.5 to 35, 41 to 44 and 51 to 54 s. The engine is off from about 54.5 s. Partly at a distance.
- **Alt: a two-stroke strimmer.** A stand-in, but an honest one: real minimotos use the same kind of 40 to 50cc pull-start engine. Weed Eater, DK77, https://freesound.org/s/322182/ (23 s): close, steady, clear rhythm at about 145 to 155 firings a second (around 9,000 rpm). For the pull-start: brushcutter pull start, prpl.jlyfsh, https://freesound.org/s/625642/ (10 s, quiet), or weed-eater start and stop, LiezelDippenaar, https://freesound.org/s/707540/ (7 s).
- **Alt: Honda CR85 onboard** (see 6). Cleaner than anything else here, but an 85 and deeper. It's my pick for the orange, so only use it here if the orange gets something else.
- Spare: a Simson 50cc moped that won't catch, https://freesound.org/s/378350/ (5 s), from the last shortlist.

## 2. ATC (worn-out two-stroke, pull-start only, lumpy smoky idle)

- **Pick: Vespa PX 200 with a rusted exhaust, onboard**, druki, https://freesound.org/s/158891/ (304 s). A 200cc two-stroke single, about the ATC's size, recorded with the recorder strapped to the rider's leg. The rusted hole makes it rough rather than a clean Vespa. Starter at the start, switch-off at the end, and several styles of riding between. Its level jumps about a lot, so listen for wind and handling noise.
- **Alt: a 1938 98cc Express SL 102 light motorbike**, AchimEngels, https://freesound.org/s/168847/ (103 s). Very close and clean, and full of character: the fuel tap, flooding the carb, two tries that don't catch (0 to 20 s), catches at about 21 s, a slow lumpy idle (23 to 30 s and 41 to 47 s, firing about 23 to 29 a second), two throttle openings (48 to 60 s), steady running (61 to 97 s), then stopped with the decompression lever. Small and thin for an ATC, and no riding.
- **Alt: Yamaha DT 125**, kristian321, https://freesound.org/s/175964/ (34 s). Trail-bike two-stroke: start 0 to 4 s, idle 4 to 15 s, revs 15 to 18 s, then further away.
- Start one-shot: **snowmobile start, cough and spit, pull away fast**, kyles, https://freesound.org/s/450950/ (18 s). Snowmobiles are usually pull-start two-strokes, and this one coughs. Kyles also recorded the quarry ATV and the tractor.
- Curiosities: a Trabant (two-stroke twin, smoky and rattly), blukotek, https://freesound.org/s/412819/ (36 s); a Piaggio Ape idling, nikitralala, https://freesound.org/s/239927/ (77 s), which really is a two-stroke three-wheeler, but recorded in a busy street.

## 3. Diesel UTV (Mule or Gator style, not the tractor)

- **Pick for idle: a Gator idling, recorded on the vehicle**, videog, https://freesound.org/s/149193/ (14 s). The title says tractor, the description says Gator. Its harmonics are spaced 8.07 Hz with a strong 24.2 Hz peak: three cylinders at about 970 rpm, which is what a diesel Gator or Mule has (a small three-cylinder Yanmar or Kubota). Only 14 s, and idle only. The tractor also idles at about 980 rpm, so whether it sounds different from the tractor depends on timbre: listen for that.
- **Pick for revs: a Bobcat at work**, cognito perceptu, https://freesound.org/s/174237/ (198 s). A small loader's diesel switching between idle (firing about 40 a second) and working revs (about 77), with a clear rhythm much of the time. 168 to 183 s is the loudest and steadiest. Hydraulics and logs being dumped in the background.
- **Alt: Land Rover diesel**, D.jones, https://freesound.org/s/521892/ (27 s). Start at 0 to 1 s, clean idle 1 to 9 s (four cylinders at about 1,100 rpm), revs 10 to 15 s, then drives off. Short but clean.
- **Alt: a 90s Land Rover on a game drive, onboard**, selcukartut, https://freesound.org/s/504674/ (241 s). Four minutes of onboard driving at an even level, so revs under load. Probably a Tdi diesel. Road and body noise throughout.
- **Start one-shot: cold start of an old Ford Transit diesel**, Mullumbimby, https://freesound.org/s/622829/ (31 s). Turns over reluctantly (0 to 4 s), catches, clattery idle with belt screech (6 to 26 s), drives off.
- Also looked at: a small diesel generator, https://freesound.org/s/516759/ (clean start and stop, but one speed for three minutes); Citroën Jumpy start, idle, rev, stop, https://freesound.org/s/500193/; Peugeot 3008, too modern and smooth; an Isuzu truck and a dually pickup, too big.

## 4. Land Rover (old petrol)

- **Pick: Land Rover starts and drives at 35 mph over grassy terrain**, craigsmith, https://freesound.org/s/675226/ (57 s). An actual Land Rover, from the old effects library craigsmith uploads, so probably a Series petrol, though it doesn't say. Starting and catching 0 to 11 s, pulls away through the gears 12 to 20 s, steady acceleration 21 to 37 s (four cylinders at about 2,250 to 2,700 rpm), slower 38 to 46 s, fades out from 47 s. The level stays even, so it's following or onboard. No long clean idle.
- **Alt: a 1965 Jeep CJ5 warming up**, deleted_user_1995570, https://freesound.org/s/234902/ (70 s). The same class of machine, an old four-cylinder petrol 4x4. Close warm-up with blips 0 to 22 s, then drives away and fades.
- **Alt: a 1976 Mini Cooper**, Dokuta_Gerovv, https://freesound.org/s/686742/ (27 s). A British four-cylinder petrol of the right era, lighter than a 2.25. Revs 2 to 8 s, clean idle 9 to 18 s (about 1,300 rpm), revs 19 to 26 s. Close.
- Idle loops: Jeep rumbling idle, craigsmith, https://freesound.org/s/438105/ (idle 3 to 27 s, pulls away and keeps running 28 to 45 s, stops at 56 s); old Jeep idling and sputtering, https://freesound.org/s/438107/ (68 s loop); Army Jeep slow idle, https://freesound.org/s/438106/ (42 s loop).
- For the crank handle: car crank, idle, car doors, craigsmith, https://freesound.org/s/438033/ (62 s, interior, "old car with crank": starts, idles, stops, starts again with trouble). Also a Ford stake bed truck crank start, idle, revs, off, D.jones, https://freesound.org/s/521857/ (19 s).
- For driving under load: Jeep onboard over dirt and rock, kyles, https://freesound.org/s/451044/ (98 s). Engine not stated.

## 5. Four-stroke quads (red, blue, green)

- **Pick: Honda ATV start and drive off**, kyles, https://freesound.org/s/450136/ (42 s). Start 1 to 2 s, idle 2 to 9 s (clear rhythm at 11 to 12 a second, about 1,400 rpm), then pulls away 10 to 37 s with a clear rhythm the whole way from 20 to 59 a second (about 2,400 to 7,000 rpm), getting further away from about 30 s. The cleanest rev sweep found. Not in use yet; kyles's quarry ATV is.
- **Alt: Yamaha Ténéré 250 enduro idle**, Singular_Estudio, https://freesound.org/s/510231/ (61 s). Studio-close (shotgun mic, 96 kHz original). Idle 0 to 25 s (clear rhythm, about 14 to 15 a second), blips 26 to 38 s, idle 40 to 60 s. A motorbike, but the green already idles on a CRF250, and this is the cleanest four-stroke single idle found.
- **Alt: ATV foley and drive in the woods**, CS279, https://freesound.org/s/315967/ (118 s). Riding at an even level throughout (30 to 45 a second, about 3,600 to 5,400 rpm), idle at 104 to 108 s. Reverberant.
- **Alt: quad ride in the desert, onboard**, monosfera, https://freesound.org/s/851632/ (28 s). Short.
- Also: Suzuki DRZ400, Flares.fr, https://freesound.org/s/671044/ (idle 10 to 20 s, blips 22 to 46 s, the rest distant passes); ATV engine idle, mickyman5000, https://freesound.org/s/340669/ (6 s loop).

## 6. Two-stroke quads (yellow, orange)

- **Pick: Honda CR85, onboard at full speed**, Olympia_94, https://freesound.org/s/704792/ (100 s). Onboard and clean, with a clear rhythm almost throughout. Revs climb 14 to 27 s (firing about 85 to 155 a second, so about 5,000 to 9,300 rpm), held high 30 to 43 s and 47 to 59 s (about 10,000 to 12,000 rpm), come off 60 to 73 s, then quieter low revs to the end. A good fit for the orange, which revs to 11,500. No start.
- **Alt: Yamaha DT 125** (see 2), for a two-stroke idle.
- **Alt: kyles's snowmobiles**, two-stroke twins: start and pull away, https://freesound.org/s/450950/ (18 s), and a sequence with sharp revs close by, https://freesound.org/s/452098/ (78 s, partly passes).
- Rejected: Suzuki RM125 (https://freesound.org/s/193490/) and a vintage 125 race bike (https://freesound.org/s/193494/) from the same uploader, both hard-clipped (7% of samples at full scale); a motocross race recorded from the crowd (https://freesound.org/s/363253/).
