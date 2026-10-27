// The controls, in one place: the in-game help (H) and the FAQ page both read this, so they can't drift apart.
// Each line is HTML; keys go in <kbd>.

export const CONTROLS = [
  {
    title: 'On foot',
    lines: [
      `<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move, mouse to look, <kbd>Shift</kbd> jog`,
      `<kbd>E</kbd> interact with what you're looking at (at the hooks inside the barn door: put your helmet or goggles on, or hang them up)`,
      `<kbd>6</kbd> wave (on foot or on a quad): a girl close by waves back, one further off who is free comes over, and one who is driving pulls up and waits a bit. It is how to call her over an engine`,
      `<kbd>7</kbd> raise the camera (on foot or on a quad): the girls in the picture pose, pull a face or tell you to put it away, and the shot is pinned on the cork board in the barn (<kbd>E</kbd> at the board for a closer look)`,
      `<kbd>8</kbd> photo mode: the farm stands still and the camera flies free. <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> fly, <kbd>Space</kbd> up, <kbd>C</kbd> down, <kbd>Shift</kbd> fast, mouse to look, wheel to zoom, <kbd>E</kbd> the girls in the shot pose, <kbd>H</kbd> hide the screen's dials and words, <kbd>Enter</kbd> or a click takes it (pinned in the barn and saved full size), <kbd>B</kbd> or <kbd>8</kbd> to leave`,
      `At a quad: <kbd>K</kbd> <kbd>R</kbd> <kbd>Q</kbd> <kbd>Z</kbd> <kbd>F</kbd> work its engine, <kbd>U</kbd> dip the tank to see what is really in it, <kbd>Y</kbd> pull the dipstick on a four-stroke (hold it by the oil bottle to top up, or away from it to let out too much), with the coolant bottle in your hands hold <kbd>E</kbd> to top up a stopped, cool radiator, with the diesel anti-gel hold <kbd>E</kbd> to treat a diesel's tank, with the booster pack in your hands hold <kbd>E</kbd> to boost a flat battery, <kbd>E</kbd> at its back seat sits you on the back, hold <kbd>V</kbd> to push it (the Hornet, the Adder and the kids' quad have no reverse)`,
    ],
  },
  {
    title: 'On the back while she drives',
    lines: [
      `<kbd>Enter</kbd> talk to her (mouse and click): stop, slower, faster, let me off, let me drive, coach her. <kbd>E</kbd> gets you off once she has stopped`,
    ],
  },
  {
    title: 'On the quad',
    lines: [
      `<kbd>K</kbd> ignition, hold <kbd>R</kbd> to crank, <kbd>O</kbd> pull-start (the two-strokes: hold, then let go), <kbd>P</kbd> lights on the Farm 300, Bruin and RB300: off, dipped, main beam (the switch pod on the left bar), and on the Hornet and the Adder: on or off (a rocker on the left bar)`,
      `<kbd>Q</kbd> more choke, <kbd>Z</kbd> less, <kbd>F</kbd> fuel tap. Each quad's choke, tap and reverse are in a different place: look down for them, and some need you stopped or a hand off the bars`,
      `The old bike (the Plover, under a tarp in the barn) starts the old way: <kbd>Y</kbd> tickles the carb (once or twice when it is cold, never more), <kbd>[</kbd> and <kbd>]</kbd> move the spark lever on the left bar (hold <kbd>[</kbd> to retard it for starting, then bring it up with <kbd>]</kbd> as it speeds up), and <kbd>O</kbd> kicks it (hold, then let go). Kicked with the lever advanced it kicks back. <kbd>P</kbd> switches its lamp on and off (a rocker on the left bar, on at the start); the lamp runs off the magneto, so it only lights while the engine runs, dim at tickover and bright as it revs. It has a clutch and a three-speed box like the manual quads`,
      `Farm 300, RB300 and Hornet have a clutch: hold <kbd>Shift</kbd> to change gear with <kbd>1</kbd> to <kbd>4</kbd>, <kbd>B</kbd> reverse (Farm 300: turn the bars as you press it; RB300: stopped), <kbd>0</kbd> neutral`,
      `<kbd>W</kbd> throttle and <kbd>S</kbd> brake (tap for a little, hold for the lot), and backwards once reverse is on (Bruin and loan quad: hold it and press <kbd>B</kbd>; Farm 300, RB300: <kbd>B</kbd> with the clutch in), <kbd>A</kbd><kbd>D</kbd> steer`,
      `Farm 300 and Bruin: <kbd>G</kbd> 2WD or 4WD (4WD for the mud; the rocker on the bars), blue: <kbd>U</kbd> diff lock (the Yak and Moorland have both too)`,
      `<kbd>Space</kbd> parking brake, <kbd>T</kbd> right it if it tips, <kbd>E</kbd> get off`,
      `Hold <kbd>L</kbd> for the horn: the girls beep back`,
      `<kbd>X</kbd> wipe mud off your view on an open vehicle (the first wipe smears it, the second clears it)`,
      `Hold <kbd>C</kbd> to look back, <kbd>V</kbd> to lean in to the dash`,
    ],
  },
  {
    title: 'The old tractor',
    lines: [
      `<kbd>K</kbd> key (heats the glow plugs: wait for the GLOW lamp to go out), hold <kbd>R</kbd> to crank`,
      `Hold <kbd>Shift</kbd> for the clutch: <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> gears, <kbd>B</kbd> reverse, <kbd>0</kbd> neutral`,
      `<kbd>Q</kbd> <kbd>Z</kbd> hand throttle (it has no fuel tap; they work from the ground beside it too), <kbd>W</kbd> foot throttle, <kbd>S</kbd> brake (<kbd>S</kbd> goes backwards, <kbd>W</kbd> brakes, in reverse gear), <kbd>O</kbd> stop knob (the key won't stop it), <kbd>P</kbd> lights on and off (and the tail lamps with them, brighter on the brake), <kbd>Space</kbd> the hand brake lever`,
      `Leave it running in first gear with the hand throttle open and get off, and it creeps off on its own: the more throttle, the faster (a trickle to a brisk walk)`,
      `Bale spike on the back (no trailer on the drawbar): <kbd>]</kbd> raises the arms and <kbd>[</kbd> lowers them (engine running); the red lever on the left of the seat shows where they are. Reverse the point into a standing silage bale at its middle to spear it, lift to carry, lower it to the ground or onto another and drive on to leave it`,
      `<kbd>J</kbd> hook the bale trailer on when the drawbar is at its ring, or take it off when you're stopped. The girls climb on once you're stopped`,
    ],
  },
  {
    title: 'Loading a quad on the bale trailer',
    lines: [
      `On foot by the back of the bale trailer, <kbd>T</kbd> folds the ramps down or up (or from the tractor's seat, stopped). The bales are all at the front, so there is a clear bed`,
      `Switch a quad off, stand within reach, then hold <kbd>X</kbd> and the trailer's winch drags it to the ramp and up. Or line it up straight at the foot of the ramp and hold <kbd>V</kbd> to push it up (let go and it rolls back)`,
      `<kbd>E</kbd> on the quad once it is aboard to strap it down or undo the strap; unstrapped it slides about when you brake or pull away hard. <kbd>Shift</kbd> + hold <kbd>X</kbd> lowers an unstrapped one back down. Not the tractor, the Yak or the Moorlands`,
    ],
  },
  {
    title: 'The sprayer',
    lines: [
      `<kbd>J</kbd> on a quad with a rack hooks the sprayer on when the hitch is at its ring, or takes it off when you're stopped (on foot, <kbd>E</kbd> at its drawbar does the same). <kbd>T</kbd> folds the boom out or in (from the seat, or standing by it). With the boom out, drive slowly (about walking pace) and it sprays 6 m wide behind the trailer`,
      `Hold <kbd>E</kbd> at the sprayer with the hose in your hands to fill the tank. The spraying job is on the chalkboard when the south field wants it; the lines you spray show on the map (<kbd>M</kbd>)`,
    ],
  },
  {
    title: 'The little tipping trailer',
    lines: [
      `<kbd>J</kbd> on a quad with a rack (or the tractor) hooks it on when the hitch is at its ring, or takes it off when you're stopped (on foot, <kbd>E</kbd> at its drawbar does the same). <kbd>E</kbd> at the tub with a jerry can or the toolbox in your hands stands it in the tub. <kbd>T</kbd> tips the tub (stopped, from the seat or beside it) and tips out whatever is in it. Jess may climb in against the rules, or ask either girl in from the wheel`,
      `Money: <kbd>E</kbd> at the money tin on the shelf under the cork board, on the barn's back wall, to lift the lid and see what the farm has, what moved today and the last few deals`,
      `Small ads: <kbd>E</kbd> at the cork board on the barn's back wall to read what is for sale (most days nothing is), then <kbd>1</kbd> to <kbd>3</kbd> to buy that ad with the money the farm jobs earn (it turns up in the yard the next morning), or <kbd>&rarr;</kbd> for what a buyer would take for yours: its number, then the same number again to sell (it is collected the next morning). <kbd>&larr;</kbd> goes back to the ads. <kbd>B</kbd> or <kbd>Esc</kbd> closes any close view`,
      `Challenges: <kbd>E</kbd> at either chalkboard for the close view, then <kbd>1</kbd> starts the cold-start clock (start every cold quad inside five minutes) and <kbd>2</kbd> judges the quads parked in the painted bays in the yard. A clean hill climb counts on its own`,
      `Farm jobs: <kbd>E</kbd> at the chalkboard on the barn door to read today's list. For the muck job, park the trailer by the muck heap in the east wheat field, hold <kbd>E</kbd> at the trailer to fork muck in, then press <kbd>T</kbd> (stopped) and the tub tilts just enough and holds, then drive slowly (under 2 m/s) across the stubble: it spreads out of the back. <kbd>T</kbd> again lowers it; <kbd>Shift</kbd>+<kbd>T</kbd> tips it all the way out in one heap`,
    ],
  },
  {
    title: 'The bonfire',
    lines: [
      `Bundles of hedge cuttings lie along the south hedge of the grass field: <kbd>E</kbd> picks one up, <kbd>G</kbd> puts it down. At the ring of stones south of the yard <kbd>E</kbd> puts it on the pile; three make a fire, and <kbd>E</kbd> again lights it. Rain puts it out. Beside a blazing fire <kbd>E</kbd> asks the nearest girl to sit by it`,
    ],
  },
  {
    title: "The shepherd's hut",
    lines: [
      `Up the hill pasture, at the top by the far hedge. <kbd>E</kbd> at the stove lights it, and again puts a log on; once the hut is warm, hold <kbd>E</kbd> at the kettle to pour a mug of tea. At the door, <kbd>E</kbd> asks the nearest free girl to sit in the hut with you`,
    ],
  },
  {
    title: 'The Yak',
    lines: [
      `<kbd>K</kbd> key (wait for the GLOW lamp to go out), hold <kbd>R</kbd> to crank; the key stops it again. It is a diesel: red diesel only`,
      `<kbd>W</kbd> throttle, <kbd>S</kbd> brake, <kbd>A</kbd><kbd>D</kbd> steer. Stopped, <kbd>B</kbd> moves the console's lever from F to R, then <kbd>S</kbd> backs up`,
      `<kbd>G</kbd> 2WD or 4WD, <kbd>U</kbd> diff lock (the switches on the console), <kbd>P</kbd> lights: off, dipped, main beam (the LIGHTS lamp goes blue), <kbd>,</kbd> <kbd>.</kbd> left and right indicators (they cancel when you straighten up) and <kbd>=</kbd> hazards, <kbd>L</kbd> horn, <kbd>;</kbd> seat belt (leave it off, or leave the driver's seat empty, with the key on and the BELT lamp flashes and it bongs every couple of seconds; the girls always put theirs on)`,
      `<kbd>T</kbd> tip the bed (stopped, from the seat or beside it), again to lower it. Stop with it running and the girls may climb in. Ask them from the wheel too`,
    ],
  },
  {
    title: 'The Moorland (the Tor)',
    lines: [
      `<kbd>K</kbd> key, hold <kbd>R</kbd> to start. Battery flat? Stand at the front: <kbd>1</kbd> thumb round the handle (it can kick back) or <kbd>2</kbd> thumb alongside your fingers, then hold <kbd>P</kbd> and let go to swing the starting handle`,
      `Hold <kbd>Shift</kbd> for the clutch, <kbd>1</kbd>-<kbd>4</kbd> gears, <kbd>B</kbd> reverse (then <kbd>S</kbd> backs up), <kbd>0</kbd> neutral: first and second crunch on the move unless you stop or double-declutch. <kbd>Q</kbd><kbd>Z</kbd> choke, <kbd>]</kbd><kbd>[</kbd> hand throttle out and in, <kbd>G</kbd> 4WD, <kbd>U</kbd> diff lock, <kbd>P</kbd> lights (off, dipped, main beam: a blue lamp for the main beam), <kbd>,</kbd> <kbd>.</kbd> <kbd>=</kbd> left, right and hazards, <kbd>Space</kbd> handbrake, <kbd>;</kbd> seat belt (optional: an old Moorland has no lamp or bong)`,
      `<kbd>T</kbd> drops the tailgate or raises it (stopped, from the seat or beside the tub). <kbd>E</kbd> at the tub with a jerry can or the toolbox in your hands stands it in the tub. The doors swing out when you get in or out`,
    ],
  },
  {
    title: 'The Crag',
    lines: [
      `<kbd>K</kbd> key (wait for the GLOW lamp to go out), hold <kbd>R</kbd> to crank; the key stops it. A diesel: red diesel only. No choke, hand throttle or starting handle`,
      `<kbd>T</kbd> swings the back door out on its hinge or shuts it (stopped, from the seat or beside it). The front doors swing out when you get in or out`,
      `Hold <kbd>Shift</kbd> for the clutch, <kbd>1</kbd>-<kbd>5</kbd> gears (all synchromesh), <kbd>B</kbd> reverse, <kbd>0</kbd> neutral, <kbd>G</kbd> 4WD, <kbd>U</kbd> diff lock, <kbd>P</kbd> lights (off, dipped, main beam: a green and a blue lamp), <kbd>,</kbd> <kbd>.</kbd> <kbd>=</kbd> left, right and hazards, <kbd>Space</kbd> handbrake, <kbd>;</kbd> seat belt (leave it off, or the driver's seat empty, with the key on and the BELT lamp flashes and it bongs)`,
    ],
  },
  {
    title: 'Amy\'s Finch',
    lines: [
      `<kbd>K</kbd> key, hold <kbd>R</kbd> to start, <kbd>Q</kbd> <kbd>Z</kbd> choke, hold <kbd>Shift</kbd> for the clutch, <kbd>1</kbd>-<kbd>4</kbd> gears, <kbd>B</kbd> reverse, <kbd>Space</kbd> handbrake. <kbd>T</kbd> lifts the hatch or shuts it (stopped, from the seat or beside it). The doors swing out when you get in or out`,
    ],
  },
  {
    title: 'The radio (the Moorlands and the girls\' cars)',
    lines: [
      `<kbd>I</kbd> radio on and off, <kbd>Shift</kbd>+<kbd>I</kbd> louder, <kbd>Alt</kbd>+<kbd>I</kbd> quieter. It needs the key on, and goes quiet while the starter turns`,
      `Each has a set of its own: the Series' picks up the engine and drifts off the station, Amy's Finch has a cassette radio, Jess's Griffin a loud one with a lot of bass. Jess turns it up, Amy turns it off`,
    ],
  },
  {
    title: 'Fuel and tools',
    lines: [
      `<kbd>E</kbd> pick up a jerry can, hold <kbd>E</kbd> at a quad to pour or at the tank to refill, <kbd>G</kbd> put it down`,
      `Hose: <kbd>E</kbd> pick up, hold <kbd>E</kbd> to wash. Toolbox: <kbd>E</kbd> pick up, <kbd>E</kbd> on a quad to tinker. In the panel <kbd>W</kbd> <kbd>S</kbd> pick, <kbd>E</kbd> presses, hold <kbd>E</kbd> for jobs that take time, <kbd>B</kbd> puts it away`,
      `RB300's winch: <kbd>E</kbd> at the hook on its front to take it, <kbd>G</kbd> to put it back, <kbd>E</kbd> on a quad, a vehicle or a tree to hook it, hold <kbd>X</kbd> to wind in (on a tree or a heavy vehicle the RB300 pulls itself up to it)`,
      `Tractor's tow chain: <kbd>E</kbd> looking at its drawbar to take it, <kbd>G</kbd> to put it back, <kbd>E</kbd> on a quad to hook it, then back the tractor up and drive off`,
      `Tow rope on the Farm 300's and Bruin's racks: <kbd>E</kbd> looking at one to take it, <kbd>G</kbd> to put it back, <kbd>E</kbd> on a dead quad to hook it, ride off gently; ask a girl on the wheel to steer it`,
      `Hayloft ladder, workbench and Amy's logbook in the barn: <kbd>E</kbd>. On the bench menu a number or <kbd>W</kbd> <kbd>S</kbd> and <kbd>E</kbd> starts a job (the full service is the row after the jobs) and <kbd>&rarr;</kbd> turns to the jobs for the shed kit`,
      `The shed catalogue under the cork board: <kbd>E</kbd> to read it, a number to ask for a compressor, parts washer or pit and the same number again to buy`,
      `The bell by the barn doors: <kbd>E</kbd> to ring it and call the girls back`,
      `The calendar on the barn's back wall: <kbd>E</kbd> in the evening, with the girls back, to call it a day and go on to the next`,
    ],
  },
  {
    title: 'Other',
    lines: [
      `<kbd>H</kbd> help, <kbd>Tab</kbd> bucket list (<kbd>&larr;</kbd><kbd>&rarr;</kbd> turn the page), <kbd>Enter</kbd> talk to the girl you are looking at, on foot or from the seat, or at nobody to open your own wheel: "A race" (on a quad, by the yard or at the drag strip) a timed hill climb (by the cones past the stream) or the cone course (by the cones west of the middle of the field), <kbd>M</kbd> farm map, <kbd>N</kbd> mute, <kbd>Esc</kbd> pause, <kbd>\`</kbd> tuning panel, <kbd>\\</kbd> console`,
    ],
  },
  {
    title: 'On a gamepad',
    lines: [
      `Press <kbd>Start</kbd> on the start card to play, and again to pause. <kbd>Select</kbd> shows this help`,
      `On foot: left stick walks (a gentle lean is a gentle walk), right stick looks, <kbd>A</kbd> is <kbd>E</kbd>, <kbd>RB</kbd> is <kbd>Enter</kbd> (talk to her, or open your own wheel), <kbd>B</kbd> puts down what you hold, <kbd>X</kbd> is <kbd>X</kbd> (wind the winch), <kbd>L3</kbd> jogs, <kbd>LT</kbd> pushes`,
      `On a vehicle: <kbd>RT</kbd> throttle and <kbd>LT</kbd> brake (as far as you press), left stick steers, right stick looks, <kbd>L3</kbd> looks back, <kbd>B</kbd> gets off, <kbd>X</kbd> horn, <kbd>Y</kbd> parking brake, <kbd>RB</kbd> reverse`,
      `Clutch: hold <kbd>LB</kbd> and press <kbd>D-pad up</kbd> or <kbd>down</kbd> for the next gear up or down (down from first is neutral)`,
      `Everything else (ignition, crank, choke, fuel tap, lights, indicators, 4WD, diff lock, seat belt, the bucket list...): click <kbd>R3</kbd> for the ring, <kbd>D-pad</kbd> or the right stick to pick, <kbd>A</kbd> to do it, <kbd>B</kbd> to cancel. The crank, choke and pull-start hold themselves for a moment; any button lets go`,
      `In the girls' wheel the sticks and <kbd>D-pad</kbd> point, <kbd>A</kbd> picks and <kbd>B</kbd> backs out. At the toolbox the <kbd>D-pad</kbd> picks and adjusts, <kbd>A</kbd> presses (hold it for jobs that take time) and <kbd>B</kbd> leaves; at the bench <kbd>A</kbd> is <kbd>E</kbd> and <kbd>X</kbd> <kbd>Y</kbd> <kbd>LB</kbd> <kbd>RB</kbd> pick the first four jobs`,
    ],
  },
];

/** The help panel's HTML: a heading and a line per row. */
export function controlsHtml(sections = CONTROLS) {
  return sections.map((s) => `<h3>${s.title}</h3>\n` + s.lines.map((l) => `<div>${l}</div>`).join('\n')).join('\n');
}
