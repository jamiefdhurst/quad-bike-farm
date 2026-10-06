# Brief: the dashes (README TODO 26)

Settled with Jamie on 2026-10-06. Build to this; if something here turns out not to work in the game, change as little as you can and note it in DECISIONS.md.

## The idea

Each quad's own dash becomes close to the real machine it's modelled on, which for most of them means much less than today: the red keeps a speedo, the blue and the loan quad keep an LCD, and the green, the two-strokes and the kids' quad have almost nothing. To make up for it there are **two accessory pods**, one analogue and one digital. Each shows everything (speed, revs, fuel, temperature, odometer, trip, hours and warning lamps) for whichever quad it's fitted to. There's only one of each, so you swap them between quads with the toolbox to see what's going on. That's not realistic (real meters don't carry their mileage with them) and that's fine.

Mockups for every dash and both pods are in `docs/briefs/dashes/` (open `index.html`). They're drawn in millimetres from the rider's seat and fix the layout, proportions, colours and lettering. They aren't artwork to trace: draw them in the game's own way (canvas faces on moulded pods, as `src/vehicle/dash.js` does now). `make_mockups.py` regenerates them.

Liberties are fine where the real thing would leave you blind in a way that isn't fun, but don't add instruments back to the stock dashes: that's what the pods are for.

## What every dash reads

`Quad.updateDash()` already passes `{ rpm, maxRpm, redline, speedMph, fuelLevel, reserveLevel, tap, temperature, overheat, coldBelow, ignition, tripMiles, reverse }`. Add:

- `hours`: engine running hours. Each quad starts the game with a random number from a new spec field `hoursRange` (suggested: red [600, 1500], blue [400, 1100], green [1800, 3500], yellow [150, 600], orange [100, 400], kids [30, 200], loan [2, 25]), and adds running time (engine state running) at real speed. Show tenths.
- `odoMiles`: total miles, starting from a random `odoRange` (suggested: roughly 2.5 times the hours in miles for the farm quads, 4 times for the sport quads, the loan [5, 60]).
- `tripMiles` stays as it is (since the start of the game).
- `neutral`: true when the ignition is on, it's not in reverse, the quad is stopped (under 0.3 m/s) and the clutch isn't biting (rpm below `clutchEngageRpm`). On these automatics that's "idling and going nowhere". It becomes a real neutral when the manual gearboxes arrive (TODO 52 and 60).
- Lamp rules for everyone: **R** lit in reverse. **TEMP** (or OIL °C) lit when `tempGaugeFraction(...) >= HOT_FROM` (`src/vehicle/tempGauge.js`). **FUEL** lit when `fuelLevel <= reserveLevel`. All lamps and displays dark with `ignition` false (the battery's dead or the key's off), as now.

The starting hours and odometer are the first bit of TODO 66 ("A history"); the rest of that item stays for later.

## The stock dashes

Style ids replace today's `classic`, `modern`, `sport`, `vintage` and `race`. Update `DASH_STYLES`, each spec's `dashStyle`, and the comment at the top of `dash.js`. The tests that check every spec names a known style must still pass.

### Red: `foreman` (after a Honda TRX400FW Foreman, about 1995 to 2000). Mockup `red.svg`

- A black moulded handlebar cover, about 165 mm wide at the bottom, narrowing slightly to the top.
- In its top window a rectangular analogue speedo, about 124 × 78 mm, black face:
  - a 0 to 45 mph arc across the upper right, white ticks every 5 with numbers, minor ticks between, "mph" small at the lower right; an orange-red needle pivoting low right of centre;
  - on the left, two mechanical counters with white digits on black and the last digit (tenths) inverted: **HOUR METER** above, **ODOMETER** below, each labelled in small caps;
  - "HONDA" in spaced bold capitals bottom left.
- Below the window, a small dark panel with three square lamps in a row: **R** amber, **N** green, **OIL °C** red; to their right the ignition key with O and I marked, turning with `K`.
- No rev counter, no fuel gauge, no temperature gauge. Today's red has all three; they go.

### Blue: `grizzly` (after a Yamaha Grizzly 660, 2002 to 2008). Mockup `blue.svg`

- A charcoal handlebar pod with a small brow, the LCD unit inset in the middle.
- A grey-green **positive** LCD (light background, near-black segments, faint ghost segments), about 112 × 62 mm. Not amber.
  - Top left: fuel bar, E, six segments, F. Top right: temperature bar, C, five segments, H. (The real one had a warning lamp only; the bar is our liberty.)
  - Left: the gear letter in a box: **H** normally, **R** in reverse, **N** when `neutral`.
  - Centre: big seven-segment speed with "MPH". Right of it a small clock (see Clock below).
  - Bottom line, under a rule: TRIP, ODO and HRS in turn, each shown for 4 seconds with its label.
- Round lamps in the pod either side: **N** and **R** on the left, **TEMP** and **FUEL** on the right.
- Two small rubber buttons under the LCD marked SELECT and RESET (decoration).
- No rev counter.

### Loan: `kodiak` (after a recent Yamaha Kodiak / Grizzly 700, 2016 on). Mockup `loan.svg`

- Same idea as the blue but newer and nicer: a wider, glossier black pod with a thin silver trim line along the top, a bigger LCD (about 152 × 66 mm) in a cooler, crisper grey.
  - Fuel as a sweep of eight segments across the top between E and F.
  - A gear column down the left, H L N R P, with the current one boxed and the rest ghosted (P never lights: it has no park).
  - Big speed with "mph", 4WD text and a clock top right, temperature as six stacked bars on the right with °C.
  - Bottom line: TRIP A, ODO and HRS in turn, 4 seconds each.
- Three rectangular buttons under the display. Lamps either side as on the blue.

### Green: `bayou` (after a Kawasaki KLF300 Bayou, about 1990 to 2004). Mockup `green.svg`

- The headlight nacelle stays as it is (body colour, KAWASAKI across the front).
- On top of the nacelle, where today's vintage dash sits, a small black cover with two square lamps, **N** green and **R** amber, and the ignition key.
- Nothing else. Today's chrome speedo, fuel and temperature gauges go. (The analogue pod is the obvious thing to fit here, and it often will be: see Pods.)

### Yellow: `blaster` (after a Yamaha Blaster, 1988 to 2002). Mockup `yellow.svg`

- The headlamp moves up onto the bars, in the middle, below the crossbar: a squarish black shell with a chrome rim showing over the top edge.
- On top of the shell, one small red-capped lamp, lit whenever the ignition is on (`ignition` true).
- The key in the back of the shell, turning with `K`.
- No instruments.

### Orange: `quadracer` (after a Suzuki LT250R, 1987 to 1992). Mockup `orange.svg`

- Bare motocross bars and the crossbar pad (in orange) as now; no headlamp, no instruments.
- A red kill switch block on the left bar marked RUN / OFF: the switch sits at RUN with the ignition on and OFF with it off. This is how you see the ignition state on the orange. A red tether lanyard hangs from it.

### Kids': `kidsKey` (after a Suzuki LT80 / LT-Z50). Mockup `kids.svg`

- A small black key switch below the bar clamp, the key turning with `K`. Nothing else.

## The pods

### Analogue pod. Mockup `pod-analogue.svg`

An older aftermarket meter on a black steel bracket plate, about 176 × 138 mm, on a short stem with a bar clamp. A cable runs down from the back.

- Two chrome-cupped dials with cream faces, about 68 mm across the face:
  - **Speedo**, 0 to 60 mph over 240° (ticks every 5, numbers every 10), red needle. Under the hub, two counters: the odometer (five digits and tenths) and the trip (four digits and tenths), labelled ODO and TRIP beside them.
  - **Rev counter**, 0 to 12 (× 1000 r/min) over 240°, with the red band starting at the **fitted quad's** `redline`, so it moves when you swap the pod. Under the hub, the hour counter, labelled HRS.
- Below, two small cream dials: **FUEL** (E to F, red reserve sector up to `reserveLevel`) on the left and **TEMP** (C to H with a blue cold zone to `coldZoneEnd(coldBelow)` and a red zone from `HOT_FROM`) on the right, using `tempGaugeFraction`.
- Between them, four chrome-ringed round lamps: **N** green, **R** amber, **TEMP** red, **FUEL** amber.
- Needles rest at zero with the ignition off; the counters keep their numbers (they're mechanical).

### Digital pod. Mockup `pod-digital.svg`

A brand-new aftermarket display in a slim black housing, about 172 × 92 mm, on a ball-and-arm mount, with two small buttons on the top edge. Amber on black, like the blue's current dash (reuse `buildModern`'s drawing where it helps).

- Across the top, a bar-graph rev counter of 30 bars rising to the right, 0 to 12 000 rpm, bars past the fitted quad's `redline` drawn red.
- Big speed digits with MPH in the middle. Fuel as six stacked blocks on the left, temperature as six on the right.
- Gear letter (N, R or blank when moving forwards) and a clock to the right of the speed.
- Bottom line: ODO, TRIP and HRS in turn, 4 seconds each.
- Four small warning labels under the display that light: N, R, TEMP, FUEL.
- Blank with the ignition off (faint ghost segments only), as the LCDs are now.

### Where they go on each quad

Each quad's bars get one mount point (`bars.userData.podMount`, an Object3D placed and angled for the rider), shown as the dashed blue box in each mockup:

- Red, blue, loan: on top of the stock pod, centred, tilted back like the dash.
- Green: on top of the nacelle, behind the two lamps.
- Yellow and orange: on the crossbar pad.
- Kids': on the bar clamp. The pod keeps its full size (cancel the quad's `scale`), so it looks comically big. That's intended.

It must not block the stock dash from the seated camera: check from the rider's eye on each quad.

### Fitting and swapping

- Only two pods exist. A quad holds at most one.
- Pods are fitted and taken off with the toolbox, at a quad that's switched off, from the toolbox panel (`src/workshop/workshop.js`): a short Pods section saying what's on this quad and what's in the toolbox, with keys to fit the analogue, fit the digital, or take off the one that's there (pick free keys; the panel's existing keys are T, R, L, C and the tuning keys). Each takes about 3 seconds, with a ratchet or clunk if there's one in the audio already; otherwise silent is fine.
- A pod taken off goes into the toolbox. To move a pod from one quad to another you take it off the first and fit it to the second.
- **At the start of each game** each pod is placed independently, at random, either in the toolbox or on one of the quads present that doesn't already have one, every option equally likely. Use the layout's seeded random so `?seed=` repeats it. The console says where each pod started.
- Keep where the pods are as pure logic in a new module (for example `src/vehicle/pods.js`: start placement from a random source, fit, take off, which pod is where) with a test in `tests/`, like `boredom.js` and `bog.js`. The pods' drawing goes in its own module (for example `src/vehicle/dashPod.js`, `buildPod('analogue' | 'digital')` returning `{ group, update(state) }` like `buildDash`).
- A fitted pod is fed the same state as the stock dash, every frame, from `Quad.updateDash()`.

### Clock

There's no time of day in the game yet. Show a clock that starts at a random morning time between 08:00 and 10:30 (seeded) and runs in real time. Both the LCDs and the digital pod show the same clock.

## Checking it

- Unit tests: pod placement (each pod lands in the toolbox or on a quad, never two on one quad, repeatable from a seed), fit and take-off rules, `neutral`, the lamp rules, hours and odometer accumulating. `npm test` passes.
- One headless run (see the headless-browser-checks memory): screenshots from the rider's eye of every stock dash with the ignition on, warm and idling, and of each pod fitted to the red, the yellow and the kids' quad. Look at each one against its mockup: legible at riding distance, nothing clipping the bars or the crossbar, the pod not hiding the stock dash.
- Say in the summary what wasn't checked by eye. Jamie (or the model that wrote this brief) will look at the screenshots before the item's marked done, so leave them in `.scratch/dashes/`.

## Docs when it's done

- README: rewrite "The dashes" for a player (what each quad has, the two pods, that you swap them with the toolbox), the toolbox section, and the help text in `src/hud/hud.js` for the pod keys.
- DECISIONS.md: a short section saying what was built and anything that differs from this brief.
- Mark TODO 26 **Done.**
