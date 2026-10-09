// The UTV's light switch and its dash lamps. The old quads' lights run straight off the engine (headlight.js); the UTV has a battery and
// a three-way switch instead: off, dipped, and main beam (a longer, brighter, whiter beam, with a blue lamp on the dash). The lights need
// the key on as well as the switch, so key on with the switch off is dark. Pure logic, so it is tested without Three.js; the model applies
// the look (`setHeadlights` in quadModel.js).

export const LIGHT_MODES = ['off', 'low', 'high'];

export const DEFAULT_LIGHT_SWITCH_PARAMS = {
  lowLevel: 0.7, // dipped beam's brightness (1 is the lens at full)
  highLevel: 1, // main beam's
  highReach: 2.2, // how many times longer the main beam's shaft is than the dipped one's
  highSpread: 1.5, // and how many times wider
  highGlare: 1.9, // how many times brighter the shaft looks
  highHalo: 1.6, // and the bloom round each lamp
  lowColour: 0xffeec4, // halogen: a warm white
  highColour: 0xf2f6ff, // main beam: whiter, a touch blue
};

export const LIGHT_SWITCH_PARAM_RANGES = {
  lowLevel: [0.1, 1, 0.01],
  highLevel: [0.1, 1.5, 0.01],
  highReach: [1, 4, 0.1],
  highSpread: [1, 3, 0.1],
  highGlare: [1, 4, 0.1],
  highHalo: [1, 3, 0.1],
};

export const LIGHT_SWITCH_PARAMS = { ...DEFAULT_LIGHT_SWITCH_PARAMS }; // shared by the UTV (and anything else that gets the switch), registered once

export class LightSwitch {
  constructor(mode = 'off') {
    this.mode = LIGHT_MODES.includes(mode) ? mode : 'off';
  }

  /** The key: off, then dipped, then main beam, then off again. Returns the new mode. */
  cycle() {
    this.mode = LIGHT_MODES[(LIGHT_MODES.indexOf(this.mode) + 1) % LIGHT_MODES.length];
    return this.mode;
  }

  set(mode) {
    if (LIGHT_MODES.includes(mode)) this.mode = mode;
    return this.mode;
  }
}

/**
 * What the headlamps look like.
 * @param {string} mode   off, low or high
 * @param {boolean} powered   the key is on and the battery has something to give
 * @returns {{ level: number, colour: number, reach: number, spread: number, glare: number, halo: number, main: boolean }}
 *   `level` 0..1.5 of the lens's full glow; `reach`, `spread`, `glare` and `halo` scale the faked beam and the bloom (1 is the dipped beam).
 */
export function lightLook(mode, powered, P = LIGHT_SWITCH_PARAMS) {
  if (!powered || mode === 'off') return { level: 0, colour: P.lowColour, reach: 1, spread: 1, glare: 1, halo: 1, main: false };
  if (mode === 'high') return { level: P.highLevel, colour: P.highColour, reach: P.highReach, spread: P.highSpread, glare: P.highGlare, halo: P.highHalo, main: true };
  return { level: P.lowLevel, colour: P.lowColour, reach: 1, spread: 1, glare: 1, halo: 1, main: false };
}

/** The lamps on the dash for a switch position: the green side-light symbol for dipped or main beam, the blue one for main beam only. */
export function lightLamps(mode, powered) {
  const lit = !!powered && mode !== 'off';
  return { lights: lit, main: lit && mode === 'high' };
}
