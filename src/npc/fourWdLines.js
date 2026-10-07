// What the girls say when one of them gets bogged in 2WD and works out she never put the quad in four-wheel drive (vehicle/driveMode.js):
// fourWdOwn (she flips the switch and admits it), fourWdToldJess (Amy, to Jess who forgot) and fourWdToldAmy (Jess, to Amy who forgot).
// Amy is exasperated and then sorry; Jess is gleeful and then not sorry at all. They say "it", so the same lines do for the red and blue.
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_FOUR_WD_LINES = {
  fourWdOwn: line(30, ['Oh, I never put it in four-wheel drive. No wonder. There.', 'That was me. I left it in two-wheel drive. I am so sorry.']),
  fourWdToldJess: line(30, ['Jess! You have to put it in four-wheel drive for the mud! Honestly!', 'Jess, it is in two-wheel drive again. That is why you are stuck.']),
};

export const JESS_FOUR_WD_LINES = {
  fourWdOwn: ['Ah. Two-wheel drive. Yeah. That would do it.', 'Whoops. Forgot the switch. Four-wheel drive, go on then.'],
  fourWdToldAmy: ['Amy! You forgot the four-wheel drive! It is the little switch on the bars!', 'Ha! Amy, you are stuck in two-wheel drive! Flick the switch!'],
};

export const JESS_ONLY_FOUR_WD_SITUATIONS = ['fourWdToldAmy'];
