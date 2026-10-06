// Fuel tank, fuel tap and carburettor float bowl. Pure logic, no Three.js.
//
// The engine draws from the float bowl; the bowl refills from the tank through
// the tap. On ON the tap can't reach the last few litres (the reserve); on
// RESERVE it can; OFF shuts it. When the bowl runs low the engine starts to
// starve, which the engine model turns into a lean, misfiring stumble.

import { mixOil } from '../engine/lubrication.js';

export const DEFAULT_FUEL_PARAMS = {
  tankCapacity: 12, // litres
  reserveLitres: 2, // only reachable with the tap on RESERVE
  startLitres: 7, // fuel in the tank at the start
  startDiesel: 0, // diesel fraction of that fuel: 1 on the tractor, which runs on red diesel
  startOil: 0, // oil fraction of that fuel: 0.02 (50:1 pre-mix) on the two-strokes, none on the four-strokes
  startTap: 'off', // tap position at the start: turn it ON before riding off
  bowlCapacity: 0.012, // litres in the carburettor float bowl: with the tap OFF it runs about half a minute at idle
  bowlFillRate: 0.02, // litres per second from the tank into the bowl
  burnPerRev: 0.0000722, // litres per crank revolution at full throttle (game-paced: a full tank lasts about 25 minutes flat out, cruising at about 5,700 rpm under load)
  idleBurnFraction: 0.295, // fraction of that burnt at a closed throttle (keeps idle burn, and so tap-off timing, as it was)
  chokeBurn: 0.3, // extra consumption at full choke
};

export const FUEL_PARAM_RANGES = {
  tankCapacity: [2, 40, 0.5],
  reserveLitres: [0, 10, 0.1],
  startLitres: [0, 40, 0.1],
  startOil: [0, 0.2, 0.001],
  bowlCapacity: [0.005, 0.3, 0.005],
  bowlFillRate: [0.001, 0.2, 0.001],
  burnPerRev: [0, 0.0005, 0.000001],
  idleBurnFraction: [0, 1, 0.01],
  chokeBurn: [0, 2, 0.01],
};

export const TAP_POSITIONS = ['on', 'reserve', 'off'];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class FuelSystem {
  constructor(params) {
    this.params = params;
    this.litres = clamp(params.startLitres, 0, params.tankCapacity);
    this.bowl = this.litres > 0 ? params.bowlCapacity : 0;
    this.oil = params.startOil ?? 0; // oil fraction of what's in the tank
    this.diesel = params.startDiesel ?? 0; // diesel fraction of what's in the tank (red diesel poured in by mistake, or the tractor's own fuel)
    this.bowlDiesel = this.diesel; // and of what's in the float bowl, which is what the engine is fed
    this.tap = params.startTap ?? 'on';
    this.burnRate = 0; // litres per second, last update
  }

  /** Fraction of the tank that's full, for the gauge. */
  get level() {
    return this.litres / this.params.tankCapacity;
  }

  /** Fraction of the float bowl that's full; what the engine is fed from. */
  get bowlLevel() {
    return this.bowl / this.params.bowlCapacity;
  }

  /** Litres the tap can currently reach. */
  get reachable() {
    if (this.tap === 'off') return 0;
    if (this.tap === 'on') return Math.max(0, this.litres - this.params.reserveLitres);
    return this.litres;
  }

  get space() {
    return this.params.tankCapacity - this.litres;
  }

  cycleTap() {
    this.tap = TAP_POSITIONS[(TAP_POSITIONS.indexOf(this.tap) + 1) % TAP_POSITIONS.length];
    return this.tap;
  }

  /** Sets what's in the tank, as if it had been there all along. */
  setLitres(litres) {
    this.litres = clamp(litres, 0, this.params.tankCapacity);
    this.bowl = this.litres > 0 ? this.params.bowlCapacity : 0;
  }

  /** Pours fuel in, with `oil` as its oil fraction and `diesel` as its diesel fraction; returns how much actually went in. */
  add(litres, oil = 0, diesel = 0) {
    const added = clamp(litres, 0, this.space);
    this.oil = mixOil(this.litres, this.oil, added, oil);
    this.diesel = mixOil(this.litres, this.diesel, added, diesel);
    this.litres += added;
    return added;
  }

  /** Tank and float bowl emptied (the toolbox drain): the fuel is lost, diesel and all. Returns the litres that went. */
  drain() {
    const lost = this.litres + this.bowl;
    this.litres = 0;
    this.bowl = 0;
    this.diesel = 0;
    this.bowlDiesel = 0;
    return lost;
  }

  /**
   * @param {number} dt
   * @param {object} engine  { rpm, throttle, choke, running }
   */
  update(dt, { rpm, throttle, choke, running }) {
    const p = this.params;
    // Burn from the bowl while the engine is running.
    const pedal = p.idleBurnFraction + (1 - p.idleBurnFraction) * throttle;
    this.burnRate = running ? p.burnPerRev * (rpm / 60) * pedal * (1 + p.chokeBurn * choke) : 0;
    this.bowl = Math.max(0, this.bowl - this.burnRate * dt);

    // Top the bowl up from the tank through the tap.
    const want = p.bowlCapacity - this.bowl;
    const flow = Math.min(want, p.bowlFillRate * dt, this.reachable);
    if (flow > 0) {
      this.bowlDiesel = mixOil(this.bowl, this.bowlDiesel, flow, this.diesel);
      this.bowl += flow;
      this.litres -= flow;
    }
  }
}
