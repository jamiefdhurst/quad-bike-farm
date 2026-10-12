// The controls, in one place: the in-game help (H) and the FAQ page both read this, so they can't drift apart.
// Each line is HTML; keys go in <kbd>.

export const CONTROLS = [
  {
    title: 'On foot',
    lines: [
      `<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move, mouse to look, <kbd>Shift</kbd> jog`,
      `<kbd>E</kbd> interact with what you're looking at`,
      `<kbd>5</kbd> raise the camera (on foot or on a quad): the girls in the picture pose, pull a face or tell you to put it away, and the shot is pinned on the corkboard in the barn (<kbd>E</kbd> at the board for a closer look)`,
      `At a quad: <kbd>K</kbd> <kbd>R</kbd> <kbd>Q</kbd> <kbd>Z</kbd> <kbd>F</kbd> work its engine, <kbd>Y</kbd> pull the dipstick on a four-stroke (hold it by the oil bottle to top up, or away from it to let out too much), <kbd>B</kbd> sit on the back, hold <kbd>V</kbd> to push it (the yellow, orange and kids' quads have no reverse)`,
    ],
  },
  {
    title: 'On the back while she drives',
    lines: [
      `<kbd>E</kbd> talk to her (mouse and click): stop, slower, faster, let me off, let me drive, coach her`,
    ],
  },
  {
    title: 'On the quad',
    lines: [
      `<kbd>K</kbd> ignition, hold <kbd>R</kbd> to crank, <kbd>P</kbd> pull-start (yellow and orange)`,
      `<kbd>Q</kbd> more choke, <kbd>Z</kbd> less, <kbd>F</kbd> fuel tap. Each quad's choke, tap and reverse are in a different place: look down for them, and some need you stopped or a hand off the bars`,
      `Red, green and yellow have a clutch: hold <kbd>Shift</kbd> to change gear with <kbd>1</kbd> to <kbd>4</kbd>, <kbd>B</kbd> reverse (red: turn the bars as you press it; green: stopped), <kbd>0</kbd> neutral`,
      `<kbd>W</kbd> throttle and <kbd>S</kbd> brake (tap for a little, hold for the lot), and backwards once reverse is on (blue and loan: hold it and press <kbd>B</kbd>; red, green: <kbd>B</kbd> with the clutch in), <kbd>A</kbd><kbd>D</kbd> steer`,
      `Red and blue: <kbd>G</kbd> 2WD or 4WD (4WD for the mud; the rocker on the bars), blue: <kbd>U</kbd> diff lock (the UTV and Land Rover have both too)`,
      `<kbd>Space</kbd> parking brake, <kbd>T</kbd> right it if it tips, <kbd>E</kbd> get off`,
      `Hold <kbd>L</kbd> for the horn: the girls beep back`,
      `Hold <kbd>C</kbd> to look back, <kbd>V</kbd> to lean in to the dash`,
    ],
  },
  {
    title: 'The old tractor',
    lines: [
      `<kbd>K</kbd> key (heats the glow plugs: wait for the GLOW lamp to go out), hold <kbd>R</kbd> to crank`,
      `Hold <kbd>Shift</kbd> for the clutch: <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> gears, <kbd>B</kbd> reverse, <kbd>0</kbd> neutral`,
      `<kbd>Q</kbd> <kbd>Z</kbd> hand throttle (it has no fuel tap; they work from the ground beside it too), <kbd>W</kbd> foot throttle, <kbd>S</kbd> brake (<kbd>S</kbd> goes backwards, <kbd>W</kbd> brakes, in reverse gear), <kbd>O</kbd> stop knob (the key won't stop it)`,
      `Leave it running in first gear with the hand throttle open and get off, and it creeps off on its own: the more throttle, the faster (a trickle to a brisk walk)`,
      `<kbd>J</kbd> hook the bale trailer on when the drawbar is at its ring, or take it off when you're stopped. The girls climb on once you're stopped`,
    ],
  },
  {
    title: 'Loading a quad on the bale trailer',
    lines: [
      `On foot by the back of the bale trailer, <kbd>T</kbd> folds the ramps down or up (or from the tractor's seat, stopped). The bales are all at the front, so there is a clear bed`,
      `Switch a quad off, stand within reach, then hold <kbd>X</kbd> and the trailer's winch drags it to the ramp and up. Or line it up straight at the foot of the ramp and hold <kbd>V</kbd> to push it up (let go and it rolls back)`,
      `<kbd>E</kbd> on the quad once it is aboard to strap it down or undo the strap; unstrapped it slides about when you brake or pull away hard. <kbd>Shift</kbd> + hold <kbd>X</kbd> lowers an unstrapped one back down. Not the tractor, the UTV or the Land Rovers`,
    ],
  },
  {
    title: 'The little tipping trailer',
    lines: [
      `<kbd>J</kbd> on a quad with a rack (or the tractor) hooks it on when the hitch is at its ring, or takes it off when you're stopped. <kbd>E</kbd> at the tub with a jerry can or the toolbox in your hands stands it in the tub. <kbd>T</kbd> tips the tub (stopped, from the seat or beside it) and tips out whatever is in it. Jess may climb in against the rules, or ask either girl in from the wheel`,
      `Farm jobs: <kbd>E</kbd> at the chalkboard on the barn door to read today's list. For the muck job, park the trailer by the muck heap in the east wheat field, hold <kbd>E</kbd> at the trailer to fork muck in, then press <kbd>T</kbd> (stopped) and the tub tilts just enough and holds, then drive slowly (under 2 m/s) across the stubble: it spreads out of the back. <kbd>T</kbd> again lowers it; <kbd>Shift</kbd>+<kbd>T</kbd> tips it all the way out in one heap`,
    ],
  },
  {
    title: 'The UTV',
    lines: [
      `<kbd>K</kbd> key (wait for the GLOW lamp to go out), hold <kbd>R</kbd> to crank; the key stops it again. It is a diesel: red diesel only`,
      `<kbd>W</kbd> throttle, <kbd>S</kbd> brake, <kbd>A</kbd><kbd>D</kbd> steer. Stopped, <kbd>B</kbd> moves the console's lever from F to R, then <kbd>S</kbd> backs up`,
      `<kbd>G</kbd> 2WD or 4WD, <kbd>U</kbd> diff lock (the switches on the console), <kbd>P</kbd> lights: off, dipped, main beam (the LIGHTS lamp goes blue), <kbd>,</kbd> <kbd>.</kbd> left and right indicators (they cancel when you straighten up) and <kbd>=</kbd> hazards, <kbd>L</kbd> horn, <kbd>;</kbd> seat belt (leave it off, or leave the driver's seat empty, with the key on and the BELT lamp flashes and it bongs every couple of seconds; the girls always put theirs on)`,
      `<kbd>T</kbd> tip the bed (stopped, from the seat or beside it), again to lower it. Stop with it running and the girls may climb in. Ask them from the wheel too`,
    ],
  },
  {
    title: 'The Land Rover (the Series III)',
    lines: [
      `<kbd>K</kbd> key, hold <kbd>R</kbd> to start. Battery flat? Stand at the front: <kbd>1</kbd> thumb round the handle (it can kick back) or <kbd>2</kbd> thumb alongside your fingers, then hold <kbd>P</kbd> and let go to swing the starting handle`,
      `Hold <kbd>Shift</kbd> for the clutch, <kbd>1</kbd>-<kbd>4</kbd> gears, <kbd>B</kbd> reverse (then <kbd>S</kbd> backs up), <kbd>0</kbd> neutral: first and second crunch on the move. <kbd>Q</kbd><kbd>Z</kbd> choke, <kbd>]</kbd><kbd>[</kbd> hand throttle out and in, <kbd>G</kbd> 4WD, <kbd>U</kbd> diff lock, <kbd>P</kbd> lights (off, dipped, main beam: a blue lamp for the main beam), <kbd>,</kbd> <kbd>.</kbd> <kbd>=</kbd> left, right and hazards, <kbd>Space</kbd> handbrake, <kbd>;</kbd> seat belt (optional: an old Land Rover has no lamp or bong)`,
    ],
  },
  {
    title: 'The 200TDi',
    lines: [
      `<kbd>K</kbd> key (wait for the GLOW lamp to go out), hold <kbd>R</kbd> to crank; the key stops it. A diesel: red diesel only. No choke, hand throttle or starting handle`,
      `Hold <kbd>Shift</kbd> for the clutch, <kbd>1</kbd>-<kbd>5</kbd> gears (all synchromesh), <kbd>B</kbd> reverse, <kbd>0</kbd> neutral, <kbd>G</kbd> 4WD, <kbd>U</kbd> diff lock, <kbd>P</kbd> lights (off, dipped, main beam: a green and a blue lamp), <kbd>,</kbd> <kbd>.</kbd> <kbd>=</kbd> left, right and hazards, <kbd>Space</kbd> handbrake, <kbd>;</kbd> seat belt (leave it off, or the driver's seat empty, with the key on and the BELT lamp flashes and it bongs)`,
    ],
  },
  {
    title: 'Fuel and tools',
    lines: [
      `<kbd>E</kbd> pick up a jerry can, hold <kbd>E</kbd> at a quad to pour or at the tank to refill, <kbd>G</kbd> put it down`,
      `Hose: <kbd>E</kbd> pick up, hold <kbd>E</kbd> to wash. Toolbox: <kbd>E</kbd> pick up, <kbd>E</kbd> on a quad to tinker`,
      `Green quad's winch: <kbd>X</kbd> take the hook, <kbd>E</kbd> on a quad to hook it, hold <kbd>X</kbd> to wind in`,
      `Tractor's tow chain: <kbd>X</kbd> looking at the tractor to take it, <kbd>E</kbd> on a quad to hook it, then back the tractor up and drive off`,
      `Tow rope on the red and blue quads' racks: <kbd>X</kbd> looking at one to take it, <kbd>E</kbd> on a dead quad to hook it, ride off gently; ask a girl on the wheel to steer it`,
      `Hayloft ladder, workbench and Amy's logbook in the barn: <kbd>E</kbd>`,
      `The bell by the barn doors: <kbd>E</kbd> to ring it and call the girls back`,
      `The calendar on the barn's back wall: <kbd>E</kbd> in the evening, with the girls back, to call it a day and go on to the next`,
    ],
  },
  {
    title: 'Other',
    lines: [
      `<kbd>H</kbd> help, <kbd>Tab</kbd> bucket list (<kbd>&larr;</kbd><kbd>&rarr;</kbd> turn the page), <kbd>Enter</kbd> ask for a race (on a quad, by the yard or at the drag strip) or a timed hill climb (by the cones past the stream), <kbd>M</kbd> farm map, <kbd>N</kbd> mute, <kbd>Esc</kbd> pause, <kbd>\`</kbd> tuning panel, <kbd>\\</kbd> console`,
    ],
  },
  {
    title: 'On a gamepad',
    lines: [
      `Press <kbd>Start</kbd> on the start card to play, and again to pause. <kbd>Select</kbd> shows this help`,
      `On foot: left stick walks (a gentle lean is a gentle walk), right stick looks, <kbd>A</kbd> is <kbd>E</kbd>, <kbd>B</kbd> puts down what you hold, <kbd>X</kbd> is <kbd>X</kbd> (winch), <kbd>L3</kbd> jogs, <kbd>LT</kbd> pushes, <kbd>RB</kbd> sits on the back`,
      `On a vehicle: <kbd>RT</kbd> throttle and <kbd>LT</kbd> brake (as far as you press), left stick steers, right stick looks, <kbd>L3</kbd> looks back, <kbd>B</kbd> gets off, <kbd>X</kbd> horn, <kbd>Y</kbd> parking brake, <kbd>RB</kbd> reverse`,
      `Clutch: hold <kbd>LB</kbd> and press <kbd>D-pad up</kbd> or <kbd>down</kbd> for the next gear up or down (down from first is neutral)`,
      `Everything else (ignition, crank, choke, fuel tap, lights, indicators, 4WD, diff lock, seat belt, the bucket list...): click <kbd>R3</kbd> for the ring, <kbd>D-pad</kbd> or the right stick to pick, <kbd>A</kbd> to do it, <kbd>B</kbd> to cancel. The crank, choke and pull-start hold themselves for a moment; any button lets go`,
      `In the girls' wheel the sticks and <kbd>D-pad</kbd> point, <kbd>A</kbd> picks and <kbd>B</kbd> backs out. At the toolbox the <kbd>D-pad</kbd> picks and adjusts, <kbd>B</kbd> leaves; at the bench <kbd>A</kbd> is <kbd>E</kbd> and <kbd>X</kbd> <kbd>Y</kbd> <kbd>LB</kbd> <kbd>RB</kbd> pick the first four jobs`,
    ],
  },
];

/** The help panel's HTML: a heading and a line per row. */
export function controlsHtml(sections = CONTROLS) {
  return sections.map((s) => `<h3>${s.title}</h3>\n` + s.lines.map((l) => `<div>${l}</div>`).join('\n')).join('\n');
}
