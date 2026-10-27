// Dipping the tank: a stick down the filler shows what is really in it, whatever the gauge says (quirks.js: a gauge that reads high or
// sticks). Pure logic, no Three.js. U at a quad does it for you, and Amy does it before she rides a quad whose gauge she knows lies.

export const DEFAULT_DIP_PARAMS = {
  readNoise: 0.03, // the most the stick is out by, as a share of the tank (about a third of a litre on 12)
  lieBy: 0.15, // how far the gauge has to be from the stick, as a share of the tank, before it is called a lie
  amyDips: 0.9, // chance Amy dips the tank before she rides a quad whose gauge she knows is wrong
};

export const DIP_PARAM_RANGES = {
  readNoise: [0, 0.1, 0.005],
  lieBy: [0.05, 0.5, 0.01],
  amyDips: [0, 1, 0.05],
};

/**
 * What the stick shows for a tank, in words. `noise` is -1..1 (the wet line is never read exactly). `reserve` is the litres only the
 * tap's RESERVE position reaches.
 * @returns {{ share: number, text: string, low: boolean }} `share` is the share of the tank read off the stick, `low` that it is down in the reserve
 */
export function readTank({ litres, capacity, reserve = 0, noise = 0 }, P = DEFAULT_DIP_PARAMS) {
  const share = Math.min(1, Math.max(0, litres / capacity + noise * P.readNoise));
  const low = reserve > 0 && share * capacity <= reserve;
  let text;
  if (share < 0.02) text = 'Dry. Nothing on the stick';
  else if (share < 0.12) text = 'Barely wet. Next to nothing in there';
  else if (share < 0.3) text = 'About a quarter of a tank';
  else if (share < 0.45) text = 'About a third of a tank';
  else if (share < 0.62) text = 'About half a tank';
  else if (share < 0.82) text = 'About three quarters of a tank';
  else if (share < 0.97) text = 'Nearly full';
  else text = 'Full to the neck';
  return { share, text, low };
}

/** Whether the gauge reads far enough off the stick to be called a lie (`shown` and `share` are shares of the tank). */
export function gaugeLies(shown, share, P = DEFAULT_DIP_PARAMS) {
  return Math.abs(shown - share) >= P.lieBy;
}

/** The toast for a dip. `shown` is what the gauge reads (null: this quad shows no fuel level). */
export function dipMessage(reading, shown, P = DEFAULT_DIP_PARAMS) {
  const parts = [reading.text + (reading.low ? ', down in the reserve' : '')];
  if (shown !== null && shown !== undefined) {
    if (gaugeLies(shown, reading.share, P)) parts.push(`but the gauge says ${gaugeWord(shown)}. Don't trust it`);
    else parts.push('and the gauge agrees');
  }
  return `Dip: ${parts.join(', ')}`;
}

/** The gauge's reading in a few words, the same ones the stick uses. */
export function gaugeWord(shown) {
  if (shown < 0.12) return 'empty';
  if (shown < 0.3) return 'a quarter';
  if (shown < 0.45) return 'a third';
  if (shown < 0.62) return 'half';
  if (shown < 0.82) return 'three quarters';
  return 'full';
}
