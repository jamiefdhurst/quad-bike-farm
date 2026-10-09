// The controls, in one place: the in-game help (H) and the FAQ page both read this, so they can't drift apart.
// Each line is HTML; keys go in <kbd>.

export const CONTROLS = [
  {
    title: 'On foot',
    lines: [
      `<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move, mouse to look, <kbd>Shift</kbd> jog`,
      `<kbd>E</kbd> interact with what you're looking at`,
      `At a quad: <kbd>K</kbd> <kbd>R</kbd> <kbd>Q</kbd> <kbd>Z</kbd> <kbd>F</kbd> work its engine, <kbd>Y</kbd> pull the dipstick on a four-stroke (hold it by the oil bottle to top up), <kbd>B</kbd> sit on the back, hold <kbd>V</kbd> to push it (the yellow, orange and kids' quads have no reverse)`,
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
      `<kbd>W</kbd> throttle, <kbd>S</kbd> brake, and backwards once reverse is on (blue and loan: hold it and press <kbd>B</kbd>; red, green: <kbd>B</kbd> with the clutch in), <kbd>A</kbd><kbd>D</kbd> steer`,
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
    title: 'The little tipping trailer',
    lines: [
      `<kbd>J</kbd> on a quad with a rack (or the tractor) hooks it on when the hitch is at its ring, or takes it off when you're stopped. <kbd>E</kbd> at the tub with a jerry can or the toolbox in your hands stands it in the tub. <kbd>T</kbd> tips the tub (stopped, from the seat or beside it) and tips out whatever is in it. Jess may climb in against the rules, or ask either girl in from the wheel`,
    ],
  },
  {
    title: 'The UTV',
    lines: [
      `<kbd>K</kbd> key (wait for the GLOW lamp to go out), hold <kbd>R</kbd> to crank; the key stops it again. It is a diesel: red diesel only`,
      `<kbd>W</kbd> throttle, <kbd>S</kbd> brake, <kbd>A</kbd><kbd>D</kbd> steer. Stopped, <kbd>B</kbd> moves the console's lever from F to R, then <kbd>S</kbd> backs up`,
      `<kbd>G</kbd> 2WD or 4WD, <kbd>U</kbd> diff lock (the switches on the console), <kbd>P</kbd> lights: off, dipped, main beam (the blue MAIN lamp), <kbd>L</kbd> horn, <kbd>;</kbd> seat belt (leave it off with the key on and the BELT lamp flashes and it pings quietly; the girls always put theirs on)`,
      `<kbd>T</kbd> tip the bed (stopped, from the seat or beside it), again to lower it. Stop with it running and the girls may climb in. Ask them from the wheel too`,
    ],
  },
  {
    title: 'The Land Rover',
    lines: [
      `<kbd>K</kbd> key, hold <kbd>R</kbd> to start. Battery flat? Stand at the front: <kbd>1</kbd> thumb round the handle (it can kick back) or <kbd>2</kbd> thumb alongside your fingers, then hold <kbd>P</kbd> and let go to swing the starting handle`,
      `Hold <kbd>Shift</kbd> for the clutch, <kbd>1</kbd>-<kbd>4</kbd> gears, <kbd>B</kbd> reverse (then <kbd>S</kbd> backs up), <kbd>0</kbd> neutral: first and second crunch on the move. <kbd>Q</kbd><kbd>Z</kbd> choke, <kbd>]</kbd><kbd>[</kbd> hand throttle out and in, <kbd>G</kbd> 4WD, <kbd>U</kbd> diff lock`,
    ],
  },
  {
    title: 'Fuel and tools',
    lines: [
      `<kbd>E</kbd> pick up a jerry can, hold <kbd>E</kbd> at a quad to pour or at the tank to refill, <kbd>G</kbd> put it down`,
      `Hose: <kbd>E</kbd> pick up, hold <kbd>E</kbd> to wash. Toolbox: <kbd>E</kbd> pick up, <kbd>E</kbd> on a quad to tinker`,
      `Green quad's winch: <kbd>X</kbd> take the hook, <kbd>E</kbd> on a quad to hook it, hold <kbd>X</kbd> to wind in`,
      `Tractor's tow chain: <kbd>X</kbd> looking at the tractor to take it, <kbd>E</kbd> on a quad to hook it, then back the tractor up and drive off`,
      `Hayloft ladder, workbench and Amy's logbook in the barn: <kbd>E</kbd>`,
      `The bell by the barn doors: <kbd>E</kbd> to ring it and call the girls back`,
    ],
  },
  {
    title: 'Other',
    lines: [
      `<kbd>H</kbd> help, <kbd>Tab</kbd> bucket list (<kbd>&larr;</kbd><kbd>&rarr;</kbd> turn the page), <kbd>Enter</kbd> ask for a race (on a quad, by the yard or at the drag strip), <kbd>M</kbd> farm map, <kbd>N</kbd> mute, <kbd>Esc</kbd> pause, <kbd>\`</kbd> tuning panel, <kbd>\\</kbd> console`,
    ],
  },
];

/** The help panel's HTML: a heading and a line per row. */
export function controlsHtml(sections = CONTROLS) {
  return sections.map((s) => `<h3>${s.title}</h3>\n` + s.lines.map((l) => `<div>${l}</div>`).join('\n')).join('\n');
}
