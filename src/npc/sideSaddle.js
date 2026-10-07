// Sitting side-saddle on the back of a quad: both legs over one side, body turned to it. Now and then she picks it for a
// ride (Amy more than Jess). It grips less than sitting astride, so a hard corner, or a big bump or landing, can have her
// slip: a wobble first, then off, unless she's got her arms round you. Pure logic: the game says what the seat is doing to
// her, this says whether she holds. Tunables live in her companion params (companionParams.js).

/** Which side her legs hang for this ride: 0 astride, +1 to her left, -1 to her right. */
export function pickSideSaddle(p, random = Math.random) {
  if (random() >= p.sideSaddleChance) return 0;
  return random() < 0.5 ? 1 : -1;
}

export class SideSaddleSlip {
  constructor() {
    this.slip = 0; // 0 holding on, 1 off
    this.wobbled = false;
  }

  reset() {
    this.slip = 0;
    this.wobbled = false;
  }

  /**
   * One step, side-saddle on the back. `m`: speed (m/s), lateral (m/s^2 sideways, positive towards her left), up (m/s^2 along
   * the seat's up), side (+1 or -1, which way her legs hang), holding (her arms are round you).
   * Returns 'wobble' (it's getting away from her), 'off' (she's gone) or null.
   */
  update(dt, m, p) {
    if (m.speed < p.slipMinSpeed) {
      this.slip = Math.max(0, this.slip - p.slipRecover * dt);
      if (this.slip === 0) this.wobbled = false;
      return null;
    }
    // Thrown the way her legs hang there is nothing to stop her; the other way she has the seat behind her to lean on.
    const outward = -m.lateral; // the push on her is away from the centre of the turn
    const towardLegs = outward * m.side > 0;
    const lateral = Math.abs(m.lateral) * (towardLegs ? 1 : p.slipBackedOff);
    const grip = m.holding ? p.slipHoldingGrip : 1;
    const overload = Math.max(lateral / (p.slipLateral * grip), Math.abs(m.up) / (p.slipBump * grip));
    if (overload > 1) this.slip += (overload - 1) * p.slipRate * dt;
    else this.slip = Math.max(0, this.slip - p.slipRecover * dt);
    if (this.slip >= 1) {
      this.reset();
      return 'off';
    }
    if (this.slip >= p.slipWobbleAt && !this.wobbled) {
      this.wobbled = true;
      return 'wobble';
    }
    if (this.slip < p.slipWobbleAt * 0.5) this.wobbled = false;
    return null;
  }
}
