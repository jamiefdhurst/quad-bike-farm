# Quad Bike Farm

A small first-person browser game: three quad bikes (two farm four-strokes and a two-stroke sport quad) with properly temperamental single-cylinder engines, a muddy track round a British field, and your girlfriend, who'll hop on the back if you ask.

Three.js, Rapier physics, Web Audio. Desktop, keyboard and mouse.

## Running it

```sh
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173), click the page to lock the mouse, and you're in. Press `H` to show or hide the controls.

Other scripts:

- `npm test` runs the engine and fuel tests with Vitest.
- `npm run build` makes a production build in `dist/`, and `npm run preview` serves it.

## Controls

**On foot**

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` | Move |
| Mouse | Look |
| `Shift` | Jog |
| `E` | Interact with whatever you're looking at: ride the quad, or talk to her |
| `K` `R` `Q` `Z` `F` | While looking at a quad: ignition, starter, choke and fuel tap, without getting on |
| Hold `E` | Holding the jerry can: pour into the quad you're looking at, or refill the can at the petrol tank |
| `G` | Put the jerry can down |

**On the quad**

| Key | Action |
| --- | --- |
| `K` | Ignition on / off |
| `R` (hold) | Crank the starter |
| `Q` / `Z` | Choke more / less, in 10% steps. Hold to keep stepping |
| `W` | Throttle |
| `S` | Brake. Hold it at a standstill to reverse |
| `A` / `D` | Steer |
| `E` | Get off. Above walking pace you jump off and the quad carries on by itself at the same speed and steering until it crashes, tips, stalls or runs dry. To stop a runaway, look at it and press `K`, or catch it once it's below a jog (3 m/s) to get back on. |
| `B` | Looking at a parked quad with a pillion seat and nobody on it: sit on the back. Wait there and one of the girls comes over and drives you (see Companions) |
| `C` (hold) or middle mouse | Look back over your shoulder |
| `V` (hold) | Lean in and look closely at the dash, and the pod if one's fitted |
| `F` | Fuel tap: ON, RESERVE, OFF |
| `T` | Right the quad if it's tipped over |
| Mouse | Look around from the seat |

**Talking to her**

Look at her and press `E`. Pick an option with the number keys, or scroll to highlight and click. `E` closes the menu.

**Other**

| Key | Action |
| --- | --- |
| `H` | Show or hide the controls |
| `M` | Mute |
| `` ` `` | Tuning panel |

## The quads

- **Red quad**: Honda-style farm quad. Soft and steady, with a low warm idle around 1,150 rpm. Racks, round headlights, a pillion seat.
- **Blue quad**: Yamaha-style farm quad. Idles higher (about 1,450 rpm warm), revs harder and higher, needs more choke from cold and runs lumpier until it's warm, warms a bit quicker and pulls a little harder. It has a brush guard, square headlights, railed racks and a grey seat. Its idle comes from a different recorded machine, so it sounds different too.
- **Yellow quad**: a two-stroke sport quad, Blaster-style. It fires every revolution, so it buzzes rather than thumps, and ring-dings at idle. It's weak low down, then comes on hard around 6,000 rpm and revs past 10,000. It has almost no engine braking, and it slowly loads up its plug if you leave it idling (blip the throttle to clear it). It trails blue-white oil smoke. It's lighter and quicker, with an expansion-chamber exhaust, motocross bars, nerf bars and a race number plate. She can squeeze onto a slim pad at the back. It sounds like a two-stroke dirt bike.

- **Green quad**: a Kawasaki-style farm workhorse, older and heavier. A big lazy four-stroke that idles low and lumpy (it idles on a Honda CRF250 recording, a different machine again), revs slowly but pulls hard low down, takes an age to warm up, wants plenty of choke, runs rougher than the others and engine-brakes hard. Slower at the top (about 33 mph), with a bigger tank. Boxy bodywork, a single round headlight in a nacelle on the bars, flat mesh racks, a winch, mudflaps and a tan seat.
- **Orange quad**: a Suzuki LT250R-style two-stroke race quad. Lighter and lower than the yellow, revs to 11,500 and comes on harder still around 7,000, rear-wheel drive, barely any engine braking, and smokes like a chimney. A big "22" number plate, long flat fenders, wide nerf bars and a fat expansion chamber. Single race seat, so she can't ride on the back (she can still start or drive it). It idles on a Honda CRM250 recording, so it sounds different from the yellow.

All five are automatics and all start cold. Through the CVT the red tops out at 6,200 rpm and the blue at 6,800 (the yellow revs past 10,000), but the engine works against the ground: it bogs a little as you pull away, cruises nearer 5,700 flat out, labours lower up hills and through mud, flares when the wheels spin or leave the ground, and engine-brakes on a closed throttle with the revs rising with speed downhill. Try climbing the steep bank by the yard on a stone-cold engine with the choke out and it will probably stall. Each quad has its own character, the same every game: how it idles, how rough it runs and how it shakes. The red is the smooth one; the blue idles fast and keen with a quicker buzz; the yellow ring-dings and buzzes through the bars more than the body; the green idles slow and lumpy with a big slow heave like a tractor; the orange hunts nervously and shakes harsh and hard. Where each quad is parked, where the jerry can has been left, and each quad's exact warm idle, roughness and starting fuel vary a little every game, picked from ranges in `src/vehicle/quadSpecs.js`:

| | `idleRange` (rpm) | `roughnessRange` | `fuelRange` (litres) | Body shake at idle |
| --- | --- | --- | --- | --- |
| Red | 1,050 to 1,150 | 0.04 to 0.12 | 2.5 to 11 of 12 | 2 mm, gentle |
| Blue | 1,400 to 1,550 | 0.20 to 0.30 | 1.2 to 8 of 11 | 3.5 mm, quick |
| Yellow | 1,500 to 1,800 | 0.35 to 0.50 | 1.5 to 8 of 9 | 3 mm, buzzy bars |
| Green | 800 to 900 | 0.55 to 0.70 | 3 to 13 of 14 | 12 mm, slow heave |
| Orange | 2,000 to 2,300 | 0.75 to 0.90 | 1.5 to 7.5 of 8 | 10 mm, harsh |

Running wears an engine and makes it rougher still, all the way to fully rough if you keep at it (about half an hour of hard riding). Past about 0.8 (its build roughness plus wear), it turns erratic: it stumbles through runs of misfires, losing nearly all its power for a moment and nearly dying, catches again sometimes with a bang and a puff of smoke, flares up at idle, and won't hold a steady tickover. Fully worn, that's a stumble every two or three seconds and it dies on you now and then, and the girls will tell you it needs looking at. A service from the toolbox brings it back to its own character.

**Mechanical sympathy.** Revving an engine hard before it has warmed up wears it several times faster, and the game keeps count of who was riding each quad while it wore: you, Amy or Jess. Amy tells Jess off when she's thrashing a cold engine, and tells you to go easy when you are (Jess cheers you on). Stood by a worn quad, a girl says who she reckons has been caning it, and she's right, because it comes from the real tally. A service wipes the slate.

The idle and roughness are printed in the console and shown in the tuning panel.

She starts beside a random quad in the yard. The others are parked in the yard at any angle, sometimes facing the other way, or (40% each) left somewhere else on the farm: by the field gate, the paddock, the straw bales, the west hedge, out past the far bend, at the bottom of the track or in the middle of the field. The console says where each one is. The browser console prints the layout's seed; add `?seed=<number>` to the URL to get the same layout again.

Everything below applies to any of them.

## Starting a cold engine

The engine starts stone cold and won't fire without choke.

1. Walk up to the quad and press `E` to get on.
2. Hold `Q` to pull the choke to 100%. The yellow lever on the left handlebar moves.
3. Turn the fuel tap ON with `F`. The quads are parked with it OFF; forget and it'll start, run for a few seconds on what's in the carburettor, then stumble and die.
4. Press `K` for ignition. The green IGN light comes on and the blue TEMP light shows the engine is cold.
5. Hold `R` to crank. It should catch within a couple of seconds and settle into a high, lumpy idle. The whole bike shakes.
6. Let it warm. With the choke left on, the idle creeps up as it warms. Ease the choke off with `Z`, a notch or two at a time. Too early and it stumbles and dies. Too late and it starts to hunt, runs rich and eventually floods and stalls.
7. Once it's warm (TEMP light out, a couple of minutes) it idles low and steady with no choke.

Things to know:

- A warm engine with lots of choke is hard to start.
- Braking hard from speed while it's still cold can stall it. Roll off early and brake gently until it's warm.
- If you flood it, take the choke off and crank with the throttle held open (`W` + `R`) to clear it.
- The bike keeps idling when you get off, and you can watch and hear it shake from outside. With nobody on it, it also jolts over the ground as it moves, harder the faster it goes, so a quad driving itself round in circles visibly bounces. Riding it, the shake is as it always was.

## Mud

The track and especially its puddles are slippery: grip drops from 2.2 on grass to 0.7 on the track and 0.42 in a puddle (all scaled by tyre pressure). The yellow quad is rear-wheel drive and spins its back wheels if you give it everything in the mud; the four-wheel-drive farm quads only slip in puddles. Tyres throw clumps and puddles splash, wheels leave ruts that fade over a couple of minutes, and the quads get muddier the more you ride, dark and wet at first and drying lighter. To wash one, pick up the hose on its reel at the south end of the petrol tank (`E`; it reaches 25 m), and hold `E` at a quad: the wheels come clean first, then the bodywork, over about 8 seconds for a filthy one, leaving the paint wet and shiny until it dries. `G` puts the hose back. Mind where you point it if she's about. Each quad's Mud folder in the tuning panel has the spray and rut settings, and "Mud on it" cleans it off.

The weather's different every game, but mostly sunny (about 70% of games, with sunny intervals another 15%); only now and then is it overcast, drizzly, raining or foggy (the console says which; `?weather=rain` and so on forces one, and the seed repeats it). Showers come and go during a game, more on a showery day: the sky darkens and the mist thickens as rain comes in, rain streaks past you with its own patter, and the wind pushes the exhaust smoke harder. Rain wets the ground, which darkens and dries slowly after: wet grass and especially wet mud are slipperier, and the bogs are worse. The girls have something to say about the day, and about the rain coming and going.

There are three bogs: two on the track and one in the low ground of the field, dark churned patches with a wet shine. Go into one slowly, or stop in it, and the mud drags you down and grips the wheels: keep the throttle on and they churn and dig you in, and once you're sunk past halfway it holds you against anything the tyres can do. Charge it with a run-up and you'll get through, much slower than you went in. Stuck but not too deep, rock it: forwards, backwards, forwards, and each change of direction works it a little looser. Too deep for that, use the green quad's winch: look at the green and press `X` to take the hook off it, walk the cable (30 m of it) to the stuck quad and press `E` on it to hook on, then hold `X` near the green (its remote is on a lead) or sitting on it to wind in. It pulls the stuck quad out towards the green. `E` on the hooked quad unhooks it, `X` while carrying the hook puts it back. The girls steer round the bogs on their own drives, but following you they'll go where you go; stuck, one gives up, gets off and shouts for help, and one on the back of yours will tell you what she thinks.

## Tinkering

Pick up the red toolbox from the workbench in the barn (`E`), take it to a quad that's switched off and press `E` to get the spanners out. The panel has five adjustments, each with its current and stock values and a note on the trade-off:

- **Idle screw**: the warm idle, within safe limits.
- **Carb mixture**: leaner pulls a bit harder and uses less fuel but runs rougher; richer is easier from cold but smokier and thirstier, and fully rich slowly fouls the plug.
- **Throttle stop (speed limiter)**: farm quads come with it screwed in. Each turn out adds about 7% top speed (fully off is about +20%: the red goes from 35 to 42 mph), plus a few more revs and more fuel.
- **Clutch springs**: softer bites sooner, stiffer later; it always bites above the idle.
- **Tyre pressures**: softer grips better (especially in mud) but bounces more.

**Silencer off** (`X`) is a separate job: the quad gets a lot louder and a more open, rasping tone, about 8% more power, and it crackles and bangs far more when you shut the throttle at speed. `X` again puts it back. Jess loves it; Amy covers her ears and tells you to turn it off.

**Pods** (`Y`, `U`, `O`): at a switched-off quad the panel says which pod is on it and which are in the toolbox. `Y` fits the analogue pod and `U` the digital one (each takes about three seconds, and the quad must have none already); `O` takes the one that's there off, back into the toolbox. To move a pod you take it off one quad and fit it to another.

"Back to stock" puts everything back exactly, silencer included. Engines also wear as they run (faster when worked hard), getting rougher: a lumpy, hunting idle and a lot more shake. The panel says how it's running, and **Service it** (`V`) clears the wear and leaves it as sweet as that quad gets. Changes last for the game. `G` puts the toolbox down; you can't ride while carrying it. She has opinions about all of this.

## Fuel

Each quad has a fuel tank and a fuel tap, and a fuel gauge on the loan quad's and the blue's LCD or on a pod. Taps start OFF. How much is in each tank varies every game (see `fuelRange` above); the blue can start below its reserve, so it'll only run on RESERVE until it's filled.

- A full tank lasts roughly 25 minutes of hard riding, and much longer at idle.
- The tap has three positions. On **ON** it can't reach the last couple of litres, so when it starts to cough and stumble, flick it to **RESERVE** with `F` and head for fuel. **OFF** shuts the fuel off; the engine runs on what's in the carburettor for a moment, then dies.
- If it runs completely dry, it stalls and won't restart until it has fuel.
- To refuel: find the red jerry can (it's left somewhere around the yard, the paddock or the gate) and pick it up with `E` (it holds 20 litres). Look at a quad and hold `E` to pour, with a glug. Refill the can by holding `E` at the green petrol tank. `G` puts the can down. You can't ride holding the can, so put it down first.

**Two-stroke oil.** The yellow and orange run on pre-mix, about 50:1 oil in the petrol. By the petrol tank there's a second, yellow jerry can of pre-mix and a bottle of two-stroke oil: hold `E` on the bottle with a can in your hands to add oil to it. Refilling any can at the tank adds plain petrol, so it thins the mix, and the prompts tell you what's in the can you're holding. Nothing tells you what's in a quad's tank except how it behaves. Straight petrol in a two-stroke and it runs hot (the temperature needle climbs into the red), then it starts to lose power and run raggedly (nipping up), and in the end it seizes solid and won't turn over, not even on the pull cord. Flat out takes a couple of minutes; idling takes far longer. Take the toolbox to it and press `F` ("Strip it down") to free it, which leaves it worn until you service it. Too much oil, or any pre-mix in the red, blue or green, smokes like a bonfire and slowly fouls the plug. Amy says so if you pour the wrong can nearby, and reads what's gone wrong when it goes; Jess blames the quad.

**The barn.** The big doors are always open, and you can walk or ride straight in. Inside there's a concrete floor, two straw bales, a workbench along the north wall with the toolbox and a pegboard of tools, and a bare bulb that comes on in the gloom. Under the roof no rain falls, the light is dimmer, and rain on the tin drums loudly (you can hear a little of it from the doorway); an engine inside booms and echoes, and so does anything you hear from in there. A quad parked inside takes no mud, and a warm engine switched off in there cools two and a half times slower and never goes fully stone cold, so it starts better the next morning than one left in the yard. The tuning panel has a "Barn" folder for the sound, and the engine's "barn" settings for the warmth.

**Faults that develop.** Quads go wrong over time, separately from wear, and nothing tells you: you feel and hear it. A slow puncture starts while a quad's being ridden and gets worse over a couple of minutes: the bars pull towards the soft tyre (less for a rear one) and it drags a little. A slipping drive belt comes from riding hard: the revs flare as soon as you open the throttle and it hardly goes. A sticking throttle cable gets worse in stages: first the throttle lingers for a moment after you let go, then for longer and longer, and after about seven minutes' running it sticks open for good, staying wherever you last opened it (you can still open it further) until you switch off. A girl driving a quad that has stuck switches it off herself. A dirty carb makes it hunt, run rough and lose power, worse and worse the longer it runs. They happen to any quad the girls ride too, about one every ten to twenty minutes of riding across the lot. At the toolbox panel, `T` pumps and patches the tyres, `R` swaps the belt, `L` oils the cable and `C` cleans the carb; each does its job if there is one and otherwise just says everything's fine, so it doesn't give a fault away. Amy notices sooner and says what it is; Jess notices late and blames the quad.

**The hayloft.** Just inside the barn doors a ladder leads up to a plank loft over the front of the barn, above the doorway (quads drive in underneath). Look at the ladder and press `E` and you climb it (about 2.5 seconds); do the same at the top to come down. Up there you can walk right up to the hay door in the end wall, a window at head height looking out over the yard, hay is stacked down both sides where the roof comes low, and there's a stack of hay: look at it and press `E` to duck into it and hide. While you're hidden the girls can't find you, so they stop offering rides and asking favours, and call for you now and then ("Where have you gone?") until one finds you and you come up (or press any key to come out yourself). The loft's open edge has a rail, with a gap at the ladder. On a fine day a bored girl might climb up and sit on the hay bale at the edge; she finds you at once if you're hiding while she's up there, and Jess, up there while you stand below near her, now and then tips straw on your head (Amy tells her off). The tuning panel has a "Hayloft" folder.

**The workbench.** The toolbox lives on the bench in the barn (if it's not there, the bench won't work). Drive a quad into the yellow-painted bay in front of it, switch it off, look at the bench and press `E`. `1` to `4` pick a job: change the spark plug, clean the carb, fix a tyre, or top up the two-stroke oil (yellow and orange only). Each job is a short list of steps: `E` taps a step, and on a hold step you keep `E` down until it's done. Some holds have a green band on the meter: let go inside it. Too soon and it's loose, too long and it's over-done, and either leaves the job botched, so it looks done but the fault comes back a little, the plug is still fouled, or the oil mix is off. The plug job lets you look at the old plug, which tells you how the engine's been running. `G` steps away. The toolbox's `T`, `R`, `L` and `C` in the yard are now rough fixes that leave a mild fault behind; the bench gets rid of it. The girls watch from wherever they are: Amy helps and tells you when you've slipped, Jess heckles.

**Heat.** The air-cooled quads (red, blue, yellow, green) get too hot idling for ages on a sunny day, or crawling through mud with the throttle open: after about four minutes in full sun the needle climbs into the red and the engine starts pinking (a metallic rattle), runs rough and loses power. Riding along at a decent speed blows it away, as does a dull or wet day. The water-cooled orange has a radiator fan that cuts in and out with its own whirr, and never gets that hot. Switch off a quad you've thrashed and it ticks as the metal cools, slower and slower. It also starts differently while it's hot: the carb boils its fuel, so it starts rich, a choke makes it worse, and holding the throttle open while you crank helps. Amy tells you when it's pinking and when it's ticking; Jess is cheerful about both.

**Popping and running on.** Shut the throttle at speed and an engine that's lean, worn or running hot crackles and bangs in the pipe: the two-strokes (yellow and orange) a lot, a healthy four-stroke hardly ever, and more as it wears. Under heavy cloud or rain you can see a small orange flash at the tail pipe with each bang; in sun you can't. Switch off an engine that's hot, worn or lean and it may chug on unevenly for a few more beats before it dies; switch the key back on and it just carries on.

## The dashes

Each quad's own dash is close to the real machine it's modelled on, which for most of them means very little:

- **Red** (after a Honda Foreman): a rectangular 0 to 45 mph speedo with an hour meter and an odometer, three lamps (R, N, OIL °C) and the key. No rev counter, fuel or temperature gauge.
- **Blue** (after a Yamaha Grizzly): a grey-green LCD in a charcoal pod: fuel and temperature bars, a gear letter (H, R or N), big speed digits, a clock and a bottom line that shows trip, odometer and hours four seconds each. N, R, TEMP and FUEL lamps either side. No rev counter.
- **Loan quad** (after a newer Yamaha Kodiak): the same idea, wider and glossier, with a crisper LCD, a gear column and a fuel sweep.
- **Green** (after a Kawasaki Bayou): a small cover on top of the headlight nacelle with N and R lamps and the key. Nothing else.
- **Yellow** (after a Yamaha Blaster): the back of a headlamp shell on the bars with one red lamp that lights with the ignition, and the key.
- **Orange** (after a Suzuki LT250R): bare race bars and a RUN / OFF kill switch with its lanyard on the left bar.
- **Kids' quad**: a key switch and nothing else.

To make up for it there are **two accessory pods**, and there's only one of each: an older **analogue** pod (a cream speedo and rev counter with drum counters, small fuel and temperature dials, four lamps) and a new **digital** one (amber on black: a bar-graph rev counter, speed, fuel and temperature blocks, gear letter, clock and a line cycling odometer, trip and hours). Each shows everything for whichever quad it's fitted to, with its rev counter's red band starting at that quad's own redline. Each game they start in the toolbox or on a random quad (the console says where), and you move them with the toolbox (see above). The K key still turns the key on every quad; the dashes go dark with the ignition off or the battery flat.

Every quad starts each game with some hours and miles on it (the Blaster and the loan quad low, the green's well into four figures), and they add up as you run and ride.

The fuel tap's position isn't on any dash now: look at the tap itself.

## Riding with her

There are two of them, each starting beside her own quad in the yard. **Amy** (blonde, navy polo) is the one you know. **Jess** (black hair, burgundy polo) is cheekier: she winds you up, is braver behind the bars, gets bored sooner and is more likely to take a quad off on her own, and she usually enjoys being left on a runaway. Each has her own voice and lines. They don't interact with each other, except that each leaves alone a quad the other is busy with, and one waits for the other to finish before chattering. Their names, looks and personalities are in `src/npc/characters.js` (Jess's lines in `src/npc/jessLines.js`). They're both after you, and it shows: they bicker. Standing about together near you, they have a go at each other now and then; talk to one with the other close by and the other chips in; ride past one with the other on your back and they shout at each other; come back from a ride and the one left behind has something to say; one watches the other drive and heckles; one gets stuck and the other enjoys it; and sharing a quad, they squabble about the driving. Amy is sweet with an edge, Jess is cheeky and competitive. Their exchanges are in `src/npc/banterLines.js`. They can share a quad, one driving and one on the back: ask one to get on the back of the quad the other is driving (she pulls up to let her on), or to drive the quad the other is sitting on the back of, and now and then a bored one hops on the back of her friend's quad as it sets off. With her friend aboard the driver goes round bigger loops for a minute and a half to over three minutes, then both get off. With both seats taken there's no room for you. A third place is the front rack, on the red, blue and green: with you on the back and one girl driving, ask the other from her wheel to "Sit on the front" of that quad (or now and then a bored one hops on as it sets off). You can also ask either girl to "Sit on the front" of any of those three while it's parked with nobody on it, then climb on and ride off with her up there; she stays on until you ask her to get off. She sits side by side with nothing to hold, legs hanging over the nose, the driver pulls up for her, and the extra weight takes a little steering lock off. When the driver's done and stops, she gets off at the front. Everything below applies to both.

Look at one of them and press `E` to open her wheel. Move the mouse towards a slice and click (or press its number). The first ring has a slice for each quad she could do something with, in its colour, plus anything that isn't about a particular quad (answering her when she's asked to get off, getting off the one she's on, or stopping while she's driving); a quad's slice opens a second ring of what she could do with it. Right-click (or Backspace) goes back a ring; `E` closes it. Riding on the back while she drives, `E` opens a one-ring wheel for the ride. The options:

- **Get on the red / blue / yellow quad**: she walks over and sits on the pillion seat. Get on and ride; she stays on. Asking her onto the other quad while she's sitting on one, she gets off and walks over.
- **Start the red / blue / yellow quad**: she walks to its handlebars, turns the key, checks the fuel tap (usually), puts the choke on if it's cold (usually), and cranks in short goes, talking herself through it. If it catches she eases the choke off as it warms, then leaves it to you; after four goes she gives up and switches it off. Get on while she's at it and she stops.
- **Take me for a ride on the red / blue quad**: she gets on the front, starts it and waits for you to get on the back (look at the quad and press `E`). She drives bigger loops and keeps going while you're aboard. Press `E` on the back to talk to her: stop here, slow down, go a bit faster, let me off, or let me drive (she gets off, you slide forward, and she hops on the back). You can also get on the back whenever she's driving and going slowly.
- **Sitting on the back by yourself**: look at a parked quad and press `B`. If nobody's driving it, after 6 to 25 seconds a free girl (usually the nearer) walks over, says so, gets on the front, starts it and drives you about in big loops. Unlike a ride you asked for, this is her idea and it lasts as long as one of her drives (a minute to two and a half): she gets bored, pulls up and gets off without waiting for you to say stop, leaving you on the back. Nobody offers again for a while: 45 seconds to 2 minutes after Amy's ride, 25 to 70 seconds after Jess's (hers also last a bit less, 45 to 110 seconds). If you get off before she's got on, she gives up after 25 seconds. You can still talk to her with `E` and ask her to stop or let you off. On the back by yourself, `E` gets you off.
- **Follow me on the red / blue / yellow quad**: she gets on that one, starts it and waits for you to set off on another, then follows about 8 m behind at your pace, up to about 25 mph (less if she's feeling careful, more if confident). Get too far ahead and she shouts after you; stop and she pulls up behind you and waits. Get off your quad and she waits a while (30 to 90 seconds; Jess less), then gives up on you: either she goes off for a drive on her own (more likely the more confident she is) or she pulls up and gets off or moves to the back, as after any drive. Talk to her to finish sooner.
- **Drive the red / blue / yellow quad**: she gets on the front, starts it like the learner she is, and potters round a loop near where she started for about a minute. How she drives depends on how she feels that day: careful (creeping, shaky, lots of stops, quick to get scared) or confident, and the more confident the bolder: at the very top she'll do up to about 28 mph in big loops out across the field for three minutes or more, picking her way slowly out of the yard and among parked quads and only opening it up with room around her. A fright makes her more careful next time while a good go builds her confidence. She then stops, bored or scared, and gets off or hops on the back. While she drives you can ask her to stop and get off or move onto the back. Get on and she shuffles back; if her quad is too fast to climb onto, press `E` on it to ask her to stop and let you on.
- **Stand next to the red / blue quad**: she gets off if she's on, or walks over if she isn't, and stands beside it facing it.

The wheel only offers what makes sense: no "get on" while she's already on, no "stand next to it" while she's already there. She stays put on the pillion when you get off until you ask her to get down. Jump off at speed with her on the back and she'll let you know what she thinks.

**Teaching them.** Each girl is better or worse at four things: starting, the choke, cornering and mud. Amy corners better, Jess is better in mud, and both start fairly unsure about the choke. Where she's weak she makes the mistake more often (forgets the tap or choke, goes into corners too hot and yanks the bars, gives up in a bog sooner) and says so herself ("I always forget the choke"). Riding on the back while she drives, `E` has a "Coach her" slice whenever there's something to coach: "Choke off now" while the engine's warm and the choke's still on, "Short bursts on the starter" while she's cranking or after a stall, "Ease off into the corners" in a turn or after a yank, "Keep it going through the mud" when she's stuck or sinking. Advice at the right moment teaches her that skill a good step and pleases her a little; the same advice again within 25 seconds is nagging, which teaches nothing and annoys her; advice at the wrong moment puzzles her. She also improves very slowly on her own by getting it right. As she improves her lines change from "I'm no good at it" to "I think I'm getting it" to "I've got this", and she starts doing it before you can say. Skills last for the game only. The tuning panel has "Skills (live)" with each level and a "Skills" folder with the numbers.

**Favours.** After the first few minutes, a girl who's stood about near you (you on foot) now and then asks for something, with a line to say so: "Could you give my quad a wash?" (when her favourite quad is properly muddy), "Take me over to the straw bales" (she has to be on the back of your quad when you stop near them: ask her onto the back from her wheel, and the bales are the straw ones out in the field) or "Fetch the jerry can" (bring it to within a few metres of her, in your hands or put down). Each girl has at most one request open and asks no more than every 4 minutes or so. Nothing on the screen tells you; if you forget, talk to her and she reminds you. Do it and she thanks you and likes you noticeably more (it counts like a lot of rides towards who you favour), and the favoured one may crow about it if her friend's close. If you leave it six minutes it lapses: she likes you a bit less, remembers for ten minutes, says so the next time you talk to her, and is more likely to say no if you ask her to do something with a quad. Doing a later favour for her clears it. The tuning panel has a "Favours asked" folder.

**Places to be.** On a sunny or sunny-intervals day with the ground dry, a bored girl sometimes decides to go and sit somewhere instead of waiting at a quad: on top of one of the straw bales out in the field, or on the paddock fence. She says so on the way, sits for one to three minutes, now and then says something about it, and gets down by herself. When the rain gets going (a few seconds to about 20 after it sets in), any girl who's about, even one sat on a bale, runs for the barn and sits on one of the bales inside, looking out at the yard; once it's been dry for 15 to 45 seconds she comes out again. Two girls don't take the same place. Talk to her and she gets down first ("Hang on") and then the wheel opens; one sat out can still be asked to drive you about, or offer you a ride when you sit on the back of a quad. The tuning panel has a "Places" folder.

**Batteries.** Every quad has a battery you can't see a gauge for. Leaving the ignition on with the engine off drains it (flat in about eight minutes), cranking drains it faster, and running charges it (flat to full in about ten minutes). Below about 60% the starter turns more slowly and a start is less likely to catch; below 25% it only clicks, once per press; below 10% the dash goes dark. The girls notice and say so ("it's turning over really slowly", "the battery's flat"), and so do they when you're the one struggling near them. To get going again:

- **Pull-start (`P`, yellow and orange only).** Look at the quad (or sit on it), have the ignition on, hold `P` to draw the cord and let go to yank. Holding for about half a second to a second is a proper pull; too short is weak, too long is a botched yank. A pull turns it over for about a second and a bit, works with no battery at all, and needs the choke and a cold engine's usual coaxing. Jess, faced with a flat one, will have a go at the cord herself (Amy gives up and hands it to you).
- **Knacks.** The green is stubborn when cold: blip the throttle twice, then crank, or it just turns over. The blue floods if you leave the choke on once it's warming, so ease it off early. The girls know and will tell you.
- **Jump leads.** Pick them up from the ground by the hose (`E`), look at the flat quad and press `E` to clamp the first end, then at a quad with its engine running and `E` again. The running quad charges the flat one, about 6% a second, while they're joined; the leads only stretch about 4.5 metres, so park them nose to nose, and they come off if they're pulled too far. `E` on a clamped quad takes them off; `G` puts them down.

On the back she holds on round your waist (look down and you'll see her hands), leans with you into corners, lurches forward under hard braking, and looks about or over your shoulder. Hold `C` or the middle mouse button to look back at her. Left alone on a quad she holds the rails (or the strap on the yellow).

She talks, now and then, with captions at the bottom of the screen:

- Riding pillion she reacts to the ride: "Oh, this is fun!" on a smooth run, "This is a bit rough." over bumps, "Careful!" when you go too fast, a gasp when you brake hard, and something when it stalls or runs out of petrol.
- If you crank a quad near her for a while without it starting, she has a guess at why: the choke if it's cold, flooding if it's rich, the fuel tap if the carburettor is dry.
- Left waiting she sighs, hums, yawns and asks if you're going. Ride off without her and she'll shout after you.
- Sat on the back of a parked quad, every few minutes she asks if she can get off; the menu then has "Yes, hop off" and "No, stay there" (she grumbles and stays). If you don't answer, after several minutes she lets herself off. On the back by her own choice (after one of her drives, or bored), she gets bored of it sooner and gets off. On a long ride together she sometimes asks if you can stop soon.
- Jump off and leave her on a quad driving itself and she's either terrified or having the time of her life (40% of the time), and tells you about it afterwards. Hating it, after 8 to 18 seconds she climbs onto the front and either stops it, switches it off and gets down, or drives it about herself.
- She speaks up the further away you are, and shouts some things (being left behind, a quad riding itself), which carry twice as far.
- She comments when the seat is shaking hard, and has a favourite quad each game.
- Left standing about, sooner or later she does something on her own: wanders off for a look round (sometimes a long one), gets on a quad to wait, has a go at starting one, or takes one for a drive. When is never the same: usually somewhere between half a minute and a minute and a half, but anywhere from a few seconds over ten to a few minutes, and sooner when she's restless (which comes and goes). What she does is reshuffled each time, and the more confident a driver she's become, the more often she goes for a drive. Turn this off with `ownMind` in the Companion folder.
- She answers when you ask her something.

Their lines are recorded offline with Chatterbox, a text-to-speech engine that copies a voice from a short reference recording and can be made more or less emotional: each kind of situation has a feel (calm, chatty, cross, excited or scared), so a fright sounds frightened. Amy's reference is the Piper "cori" voice she had before, Jess's is a LibriVox reader. Every line is checked with a speech recogniser and recorded again if it doesn't come out right; a few of Amy's short shouts that Chatterbox can't manage are recorded with Piper instead, and anything still wrong is left to the browser's voice. Lines play from where she is, like her sighs, hums and laughs, which are real recordings (Jess's a shade quicker and higher). After changing the lines in `src/npc/voiceLines.js` or `src/npc/jessLines.js`, re-record them with `tools/generate_companion_voice.py --character amy` (or `jess`; usage at the top of the script). Until then, a new line uses the browser's speech, but only with a voice known to be a woman's (Flo or Shelley on a Mac, Google UK English Female in Chrome, Sonia or Libby in Edge); with none of those she just shows the caption. Her figure (bust, waist, hips) can be adjusted live in the Companion folder of the tuning panel. How chatty she is, her volume, speech rate and pitch, captions and the thresholds she reacts to are in the Companion folder of the tuning panel. The lines are in `src/npc/voiceLines.js`.

## Tuning panel

Press `` ` `` to open it. It releases the mouse so you can use the panel; click the game to carry on. Each quad has its own folder (Engine, Vibration, Audio, Smoke, Vehicle), alongside Sound, Player, Companion and Sky. The live engine readouts (state, rpm, mixture, roughness, fouling) and the shortcuts (warm or cool the engine, clear a flood) follow the quad you're on or looking at. There's also a shortcut to put both quads back in the yard and one to copy every value as JSON.

## How it's put together

```
src/
  main.js, game.js     bootstrap and the main loop
  core/                input, tuning registry
  engine/              engine model (pure logic, no Three.js) and its parameters
  vibration/           pulse-driven vibration model (pure logic) and parameters
  effects/             exhaust smoke
  audio/               procedural Web Audio engine sound
  vehicle/             quad model, Rapier vehicle, drivetrain, dash styles, fuel; quadSpecs.js defines the quads
  items/               jerry cans, oil bottle and petrol tank
  player/              walking and seated first-person player
  npc/                 state machine, character rig, companion behaviour, her voice lines
  interaction/         look-at interaction and the context menu
  hud/                 crosshair, prompts, notes for carried items, help
  world/               terrain, track, sky, props, layout
  debug/               lil-gui tuning panel
tests/                 engine state machine and fuel tests
tools/                 slice_engine_audio.py, cuts recordings into engine pulses (Python, numpy)
public/audio/          the cut engine recordings
```

**Engine model** (`src/engine/engineModel.js`). A state machine (off, ignition, cranking, running, stalled) driven by one idea: mixture. Mixture is the enrichment the choke supplies minus the enrichment a cold engine needs. It decides whether the engine catches, where it idles, how rough it runs and how much power it makes. Running rich fouls the plug, and a fully fouled plug stalls it. Temperature rises while running and falls slowly when off. Each power stroke is emitted as a firing pulse with its own timing and strength jitter, and both the vibration and the audio play those same pulses. That's why a rough engine sounds and feels lumpy together.

**Drivetrain** (`src/vehicle/drivetrain.js`). An automatic: centrifugal clutch into a CVT. It turns engine rpm and power into drive force, and puts braking load back on the engine while the clutch is locked to a moving bike.

**Ride sounds and Doppler** (`src/audio/rideAudio.js`, `rideEvents.js`, `propagation.js`). Riding sounds like the ground: grass swish, grit on the track, squelch and splash at the puddles, suspension knocks and landing thuds, and wind for the rider that rises with speed. Each quad's sound reaches you through a delay line set to its distance over the speed of sound, so a quad driving past rises and falls in pitch (about 3% each way at 10 m/s) and sounds duller further away. Levels are in the Sound folder of the tuning panel.

**Engine sound** (`src/audio/engineWorklet.js`). Three engines, chosen in the tuning panel (Audio, `engineSound`):

- *pulse* (default): revs built from the idle recording. Every firing pulse from the engine model plays one real recorded idle firing at close to its own speed, cut off with a short crossfade when the next firing starts. As revs rise the firings simply come closer together, so the exhaust's character stays the same machine as idle, the way a real engine's does. On top, each firing gets louder with revs, and an EQ that follows the revs takes out some of the deep thump and lifts the mid-range rasp, as measured from real engines going from idle to high revs. Each quad revs on its own idle: the red on the main quad recording, the blue on the ATV recording, the yellow on the two-stroke motocross bike.

- *recorded*: every firing pulse from the engine model plays one real recorded pulse, cut from CC0 recordings and resampled to last exactly one engine cycle. The four-strokes idle on quad recordings and rev on two recordings of ATVs being ridden (one driving away, one riding round a quarry), blended across 1,500 to 2,100 rpm. Both ATVs move about in front of the microphone, so the slicer takes the distance out of their loudness and levels it to rise with rpm instead. At higher revs each grain spans several real recorded firings, so there are fewer joins. The two-stroke uses its own bank, with idle from a two-stroke motocross bike and revs from a Honda CRM250 and a second two-stroke dirt bike. While the revs are steady, playback reads straight on through the recording rather than jumping between unrelated pulses. Because pulses still come from the engine model, a cold idle is still lumpy, misfires are still missing beats, and it stays in sync with the vibration and smoke. Cranking is a looped starter recording.
- *synth*: a pulse-driven exhaust synth with a simulated pipe and silencer.

To recut the recordings, see the instructions at the top of `tools/slice_engine_audio.py`.

**Exhaust smoke** (`src/effects/exhaustSmoke.js`). One soft puff per firing pulse, so you can see the beats at idle. White-grey vapour when cold, darker when rich or flooded, a burst when you snap the throttle open, and a light haze once warm. Tunable in the Smoke folder.

**Vibration** (`src/vibration/vibrationModel.js`). Each firing pulse kicks a set of damped oscillators (body heave, pitch and roll, handlebars, rider's head) in a slightly random direction. Kicks are strongest at idle and with a rough engine, and fade as rpm rises. The bike body, handlebars, seated camera and anything sitting on the bike all move with it.

**Companion** (`src/npc/companion.js`). A small state machine (idle, walking, mounting, seated, dismounting). Requests are methods, and `getActions()` decides which ones the menu shows. To add a new request, add a method and an entry in `getActions()`, plus a state if it needs one.

**Quad models** (`src/vehicle/quadModel.js`, `src/vehicle/quadGeometry.js`). Procedural: fender shells swept round each wheel, lofted seats, tanks and hoods, bent-tube racks and frames, lathed tyres with lugs, and suspension arms and shocks posed from the physics wheel heights every frame. Static parts are merged per material.

**Quads** (`src/vehicle/quadSpecs.js`, `src/vehicle/quadUnit.js`). Each quad is a spec (name, colour and overrides for engine, vehicle, vibration, audio and smoke parameters) built into a `QuadUnit` that owns its engine model, physics, vibration, smoke and sound. To add a third, add a spec and a spawn point in the layout.

**Layout** (`src/world/layout.js`). Positions for the field, barn, gate, track control points and spawn points all live here.

**Parameters**. Every tunable number lives in a `*Params.js` file next to the code that uses it, with a range for the tuning panel.

Design decisions and their reasons are logged in [DECISIONS.md](DECISIONS.md). Asset sources and licences are in [ASSETS.md](ASSETS.md).

## TODO

1.  Mechanical sympathy. Jess thrashes engines cold and Amy tells her off. Wear is tracked by who caused it, so "who's been caning the orange?" has a real answer. **Done.** Hard revving on a cold engine wears it about five times faster; each quad keeps a tally of wear by rider (you, Amy, Jess), Amy tells off whoever's thrashing a cold one, and a girl stood by a worn quad names who has been caning it.
2.  Rev-offs. Blip the throttle near a girl sat on a running quad and she might blip back. Jess always does, and it escalates until something complains.
3.  They race each other. Bored and both free, they pick two quads and race round the track without you. The loser has excuses, and the result feeds their rivalry.
4.  Run-on. Switch off a hot, worn or lean engine and it chugs on unevenly for a few more beats before it dies. **Done.** Switched off hot, worn or lean, an engine may chug on unevenly for a few more beats before it dies.
5.  Warming their hands. On a cold or wet day, a girl stood by a running quad holds her hands over the engine. Leave one idling and they gather round it; switch it off and they complain.
6.  Hand on the throttle. Jess on the back reaches round and gives it a handful over your hand. Amy does it once, then apologises.
7.  Smoke and smell. Amy hates two-stroke smoke and coughs and waves it off downwind of the orange or yellow; Jess loves it. Following the orange, Amy hangs further back.
8.  Clogged air filter. Lots of mud and puddle-splashing slowly chokes the filter: it runs rich, smokes darker and loses power at the top end. Clean it at the toolbox.
9.  Who's that by ear. Hearing a quad out of sight, Amy can say which one it is and who's riding it ("That's Jess on the blue, she never lets it idle"), from real distance and engine state.
10. Naming the quads. Early in a game Jess gives each quad a nickname ("Grandad" for the green, "the wasp" for the yellow). The names stick in both girls' lines; Amy pretends not to use them, then does.
11. "That's my quad". Each girl claims one quad for the game and gets cross when someone else rides it. Jess borrows Amy's on purpose to wind her up.
12. Reading the dash for you. With no HUD, the girl on the back sometimes reads it out: "Your fuel's on the red", "It's still cold, go easy". Amy does it helpfully; Jess when it's too late.
13. Impatient follower. Following you and bored of your pace, Jess overtakes, goes ahead and waits for you, looking pleased with herself.
14. Follow the leader. Both girls go off together, one leading and one following (the same following that works for you). They swap round after a while and bicker about the pace.
15. Doughnuts. Bored, Jess spins doughnuts in the field, leaving rings of ruts and clods everywhere. Amy watches from the fence and disapproves, then has a go.
16. Tea on the rack. They bring out mugs and leave them on the racks. Ride off without looking and the mug falls off, and its owner lets you know.
17. Red diesel. A diesel bowser for the tractor stands by the petrol tank. Fill a quad from it by mistake (or watch Jess do it) and it runs worse and worse, smokes thick grey, then dies and won't restart until the tank and carb are drained at the toolbox.
18. Parking brakes, and rocking when you blip it. Each quad gets a parking brake, so you can rev it standing still. A sharp blip twists the quad on its springs like a real engine's torque does; a girl sat on it wobbles, and Jess does it on purpose to make Amy grab the rails.
19. Mechanical noise. Under the exhaust, each engine has its own mechanical sounds: the green's tappets tick, a cold four-stroke has piston slap that quietens as it warms, a worn one rattles its cam chain, and each starter whines differently. You can hear it warm up.
20. Talking to the quad. Each girl has a little routine when starting one. Jess pats the tank and talks to it by its nickname ("Come on, Grandad") and cheers when it catches. Amy apologises to it when it floods.
21. Warming it up for you. The girl you favour, seeing you heading for your usual quad, gets there first and starts it so it's warm when you arrive. The neglected one starts hers and pointedly doesn't start yours.
22. Talking about you. When they think you can't hear, they talk about you. Creep up quietly (on foot, engine off) and you catch some of it. Once they notice you they stop dead, and one goes red.
23. Nicking your quad. Get off for a moment with it running and Jess sometimes hops on and rides off with it, laughing. She brings it back eventually, muddier and with less fuel.
24. A tractor. An old diesel farm tractor in the yard, running on the red diesel from 44, with a clutch and a simple two- or three-speed manual gearbox. Starting it cold: turn the key to the glow plugs and wait for the light, then crank. It catches with a clatter and a cloud of black smoke, puffs black on every blip, and the flap on its upright exhaust lifts and rattles with each beat. It has a hand throttle, and you stop it with a pull-out stop knob, not the key (leave it on the key and the girls laugh at you). Its sound: kyles's old, throaty, rattly tractor recordings (Freesound 637890, 637891, 637892, CC0); see DECISIONS.md, "Engine sounds for the kids' quad and the tractor".
25. Manual quads. Once the tractor's gearbox works, retrofit a clutch and gears to a couple of the quads.
26. Hay ride. The tractor pulls a trailer of bales with the girls riding on top: they bounce, hold on, shriek over bumps and lie back in the sun on the straight bits. Corner too fast and one slides off into the mud.
27. On the mudguard. A girl rides on the tractor's big rear wheel arch beside you, holding the cab frame and shouting over the diesel.
28. Tractor to the rescue. A chain from the drawbar pulls out a quad sunk too deep for the green's winch, or tows a dead one back to the yard. The tractor barely notices.
29. Bale jump. The front loader moves bales into a ramp in the field. The girls take turns jumping it and rate each other's landings; Jess wants a ride in the bucket.
30. Jess and the tractor. Jess is desperate to drive it: she stalls it, kangaroos it and can't see over the bonnet. Amy won't go near it, until she has a go one day and is annoyingly good.
31. Smoke hanging in still air. On a calm or foggy day the exhaust smoke doesn't clear: after a lot of idling in the yard there's a blue haze over it, drifting slowly, and the girls cough and wave it away.
32. Showing off. On the two-strokes, a confident girl pulls a wheelie past you or skids to a stop beside you, and looks over to see if you saw. If you weren't looking, she does it again.
33. Neutral, and jumping out of gear. On the manual tractor and quads: a neutral light on the dash, a false neutral between gears when you're clumsy, and a worn gearbox that jumps out of gear under load on the bank.
34. Creeping in low. Set the tractor's hand throttle, put it in its lowest gear and get off, and it creeps across the field with nobody on it, the way farmers do. The girls walk alongside throwing bales onto the trailer, and someone has to run and catch it before the hedge.
35. Reading the plug. At the bench, pull the plug and look at it: black and sooty is rich, white is lean, tan is healthy, oily is a worn two-stroke. Amy is better at it than you.
36. Horns. The quads have weedy horns and the tractor a proper one. Beep at a girl and she beeps back; Jess creeps up behind Amy and beeps to make her jump.
37. L plates. Jess makes L plates for Amy and tapes them to her quad. Amy takes them off and they keep turning up again. Once Amy's a confident driver, she sticks them on Jess's tractor.
38. Lining them up. Bored in the yard, Amy moves the quads one by one into a neat row by the barn. Jess parks one crooked on purpose, and Amy straightens it.
39. A history. (The hour meters, odometers and their random starting readings come with 26.) Each game a quad turns up with some wear already on it, sometimes a fault already starting, and sometimes the last person's tinkering left in (throttle stop screwed out, mixture rich). The girls know some of it ("Jess had the yellow out yesterday").
40. Quirks. Each game every quad gets one to three quirks from a pool: a fuel gauge that reads high or sticks, a temperature needle stuck at cold, a choke that creeps back on with the shake, a stiff fuel tap, a split seat that soaks you after rain, a horn that works when it likes, brakes that pull left, a squealing brake, a flickering headlight. Nothing says which; a girl sometimes warns you if she knows.
41. Tyres. Mismatched brands, a bald rear, pressures not where they should be at the start, so grip and pull differ every game. The toolbox's pressure gauge is how you find out.
42. The day's temperature. A frosty morning or a mild one, picked with the weather. Cold days need more choke, take longer to warm up and drain batteries faster. Frost on the seats, and the girls in hats.
43. Different controls. Each quad has its own reverse: the red a lever you push down while turning the bars, the blue a button held with the brake, the green a lever by your left knee, and the two-strokes none at all, so you get off and push (the girls won't help). Chokes differ too: a thumb lever, a plunger on the carb under the tank, a pull knob, each with its own reach. (The dashes themselves are 26.)
44. More vehicles, left over from 20. A mini moto with a pull-start. A neighbour's beaten-up old three-wheeler ATC (a real tip-over risk), which we weren't doing. Each needs its own sound and characteristics.
