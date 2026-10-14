// What a girl does about the radio when she is sat in a vehicle that has one (vehicle/radio.js). Jess is keen: she turns it on, and up.
// Amy would rather have quiet: she turns it down and then off. It is a reaction to what is playing, so it runs on a clock of its own
// rather than being a choice (npc/chooser.js). Neither touches it for a while after you have, and neither reaches for it before the
// engine has been running a moment. Pure, so it is tested without the game.

export const DEFAULT_RADIO_TASTE_PARAMS = {
  firstAfter: 8, // seconds sat in a vehicle before she thinks about the radio
  checkEvery: 6, // then how often she thinks about it
  leaveAlone: 25, // seconds she leaves it alone after anyone touched it (you, or her friend)
  onChance: 0.35, // how likely a keen girl is to switch it on, each time she thinks of it (scaled by how keen)
  upChance: 0.4, // how likely a keen girl is to turn it up
  downChance: 0.4, // how likely a girl who would rather not is to turn it down, then off
  keenAbove: 0.5, // keen above this and she wants it on and loud; below it she wants it quiet
};

export const RADIO_TASTE_PARAM_RANGES = {
  firstAfter: [0, 60, 1],
  checkEvery: [1, 60, 1],
  leaveAlone: [0, 120, 1],
  onChance: [0, 1, 0.01],
  upChance: [0, 1, 0.01],
  downChance: [0, 1, 0.01],
  keenAbove: [0.1, 0.9, 0.01],
};

export const RADIO_TASTE_PARAMS = { ...DEFAULT_RADIO_TASTE_PARAMS };

/** What she does to the radio: 'on', 'up', 'down', 'off' or null. `keen` is her liking for it, 0 to 1 (characters.js radioKeen). */
export function radioMove(keen, radio, p = RADIO_TASTE_PARAMS, random = Math.random) {
  if (!radio.powered || radio.untouchedFor < p.leaveAlone) return null;
  if (keen > p.keenAbove) {
    const wants = 0.5 + 0.5 * keen; // the volume she is happy with
    if (!radio.on) return random() < p.onChance * keen ? 'on' : null;
    if (radio.volume < wants - 0.05 && random() < p.upChance) return 'up';
    return null;
  }
  if (!radio.on) return null;
  if (radio.volume > 0.35 && random() < p.downChance * (1 - keen)) return 'down';
  return random() < p.downChance * (1 - keen) * 0.6 ? 'off' : null;
}

/** One girl's thinking about it: counts the time she has been sat in and how long since she last thought. */
export class RadioTaste {
  constructor() {
    this.sat = 0;
    this.sinceCheck = 0;
  }

  /** Every frame; returns her move or null. `inVehicle` is whether she is sat in this vehicle now. */
  update(dt, inVehicle, keen, radio, p = RADIO_TASTE_PARAMS, random = Math.random) {
    if (!inVehicle) {
      this.sat = 0;
      this.sinceCheck = 0;
      return null;
    }
    this.sat += dt;
    if (this.sat < p.firstAfter) return null;
    this.sinceCheck += dt;
    if (this.sinceCheck < p.checkEvery) return null;
    this.sinceCheck = 0;
    return radioMove(keen, radio, p, random);
  }
}

/** Applies her move to the radio, returning the situation she says a line for (or null). */
export function applyRadioMove(move, radio) {
  if (move === 'on') radio.set(true);
  else if (move === 'up') radio.louder();
  else if (move === 'down') radio.quieter();
  else if (move === 'off') radio.set(false);
  else return null;
  return { on: 'radioOn', up: 'radioUp', down: 'radioDown', off: 'radioOff' }[move];
}
