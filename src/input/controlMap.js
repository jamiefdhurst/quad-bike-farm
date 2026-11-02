// The control map: what each key means in each context, once. `.claude/rules/controls.md` says why, and tests/controlMap.test.js holds the
// game to it (one meaning per key per context, every remappable key placed, the help page naming no key that isn't here). Pure data.
//
// An entry is [key code, 'press' | 'hold', what it does], with a fourth part, the piece of #416 that moves it, where the game doesn't do
// it yet. When the piece lands the fourth part goes (none are waiting now).

export const CONTEXTS = {
  foot: {
    title: 'On foot',
    keys: [
      ['KeyW', 'press', 'Walk forwards'], ['KeyS', 'press', 'Walk back'], ['KeyA', 'press', 'Walk left'], ['KeyD', 'press', 'Walk right'],
      ['KeyE', 'press', 'Use what you are looking at: pick up, open, read, switch, hook on or off, ring, sit'],
      ['KeyE', 'hold', 'Anything that takes time: pour, fill, wash, fork, strap, top up'],
      ['KeyG', 'press', 'Put down what you hold'],
      ['Enter', 'press', 'Talk to the girl you are looking at, or open your own wheel (a race and the rest)'],
      ['KeyV', 'hold', 'Push a quad'],
      ['KeyT', 'press', 'Work a vehicle or trailer\'s kit: tip, fold, drop the tailgate, right a tipped quad'],
      ['KeyX', 'hold', 'Wind the winch, or winch a quad up the ramp'],
      ['KeyK', 'press', 'Ignition, from beside the quad'],
      ['KeyR', 'hold', 'Crank, from beside the quad'],
      ['KeyQ', 'press', 'More choke, from beside the quad'],
      ['KeyZ', 'press', 'Less choke, from beside the quad'],
      ['KeyF', 'press', 'Fuel tap, from beside the quad'],
      ['KeyY', 'press', 'Dipstick, or tickle the old bike\'s carb'],
      ['KeyU', 'press', 'Dip the tank, from beside the quad'],
    ],
  },
  ride: {
    title: 'Riding',
    keys: [
      ['KeyW', 'press', 'Throttle'], ['KeyS', 'press', 'Brake, and backwards'], ['KeyA', 'press', 'Steer left'], ['KeyD', 'press', 'Steer right'],
      ['Space', 'press', 'Parking brake, handbrake'],
      ['KeyE', 'press', 'Get off'],
      ['Enter', 'press', 'Talk to the girl you are looking at, or open your own wheel (a race and the rest)'],
      ['KeyB', 'press', 'Reverse'],
      ['KeyC', 'hold', 'Look back'], ['KeyV', 'hold', 'Lean in to the dash'],
      ['KeyK', 'press', 'Ignition, key'], ['KeyR', 'hold', 'Crank'], ['KeyO', 'press', 'Pull-start, stop knob'],
      ['KeyP', 'press', 'Lights, starting handle'], ['Digit9', 'press', 'Spotlamps'],
      ['KeyQ', 'press', 'More choke, hand throttle'], ['KeyZ', 'press', 'Less choke'], ['KeyF', 'press', 'Fuel tap'],
      ['KeyG', 'press', '2WD or 4WD'], ['KeyU', 'press', 'Diff lock'],
      ['Digit0', 'press', 'Neutral'], ['Digit1', 'press', 'Gear 1'], ['Digit2', 'press', 'Gear 2'], ['Digit3', 'press', 'Gear 3'],
      ['Digit4', 'press', 'Gear 4'], ['Digit5', 'press', 'Gear 5'],
      ['Comma', 'press', 'Left indicator'], ['Period', 'press', 'Right indicator'], ['Equal', 'press', 'Hazards'], ['Semicolon', 'press', 'Seat belt'],
      ['KeyI', 'press', 'Radio'], ['KeyL', 'hold', 'Horn'],
      ['BracketRight', 'press', 'Raise the bale arms, hand throttle out, advance the spark'],
      ['BracketLeft', 'press', 'Lower the bale arms, hand throttle in, retard the spark'],
      ['KeyJ', 'press', 'Hook a trailer on or off'],
      ['KeyT', 'press', 'Work the vehicle\'s or trailer\'s kit: tip, fold, drop the tailgate'],
      ['KeyX', 'press', 'Wipe your view, or the wiper stalk where there is a windscreen'], ['KeyX', 'hold', 'Wind the winch'],
      ['KeyY', 'press', 'Tickle the old bike\'s carb'],
    ],
  },
  back: {
    title: 'On the back while she drives',
    keys: [
      ['KeyE', 'press', 'Get off, once she has stopped'],
      ['Enter', 'press', 'Talk to her about the ride (the passenger wheel)'],
    ],
  },
  screen: {
    title: 'A close-up screen',
    keys: [
      ['KeyB', 'press', 'Close the screen, or go back a step'],
      ['Escape', 'press', 'Close the screen'],
      ['KeyE', 'press', 'Act on what the screen shows'],
      ['KeyE', 'hold', 'Do a job that takes time'],
      ['ArrowLeft', 'press', 'Turn the page back'], ['ArrowRight', 'press', 'Turn the page on'],
      ['KeyW', 'press', 'Pick the row above'], ['KeyS', 'press', 'Pick the row below'],
      ['Digit1', 'press', 'Choose option 1'], ['Digit2', 'press', 'Choose option 2'], ['Digit3', 'press', 'Choose option 3'],
    ],
  },
  photo: {
    title: 'Photo mode',
    keys: [
      ['KeyW', 'hold', 'Fly forwards'], ['KeyS', 'hold', 'Fly back'], ['KeyA', 'hold', 'Fly left'], ['KeyD', 'hold', 'Fly right'],
      ['Space', 'hold', 'Fly up'], ['KeyC', 'hold', 'Fly down'],
      ['KeyE', 'press', 'Pose the girls in the shot'],
      ['KeyH', 'press', 'Hide the screen\'s dials and words'],
      ['Enter', 'press', 'Take the shot'],
      ['Digit8', 'press', 'Leave photo mode'],
      ['KeyB', 'press', 'Leave photo mode'],
    ],
  },
  anytime: {
    title: 'Any time',
    keys: [
      ['KeyH', 'press', 'Help'], ['KeyM', 'press', 'Farm map'], ['KeyN', 'press', 'Mute'], ['Tab', 'press', 'Bucket list'],
      ['Digit6', 'press', 'Wave'], ['Digit7', 'press', 'Raise the camera'], ['Digit8', 'press', 'Photo mode'],
      ['Escape', 'press', 'Pause'],
    ],
  },
};

/** Every [context id, key, mode, what, moves-in] in the map. */
export const entries = () => Object.entries(CONTEXTS).flatMap(([id, c]) => c.keys.map(([key, mode, what, moves]) => ({ id, key, mode, what, moves })));
