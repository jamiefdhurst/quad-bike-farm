// Fuel tank, fuel tap and carburettor float bowl. Pure logic, no Three.js.
//
// The engine draws from the float bowl; the bowl refills from the tank through
// the tap. On ON the tap can't reach the last few litres (the reserve); on
// RESERVE it can; OFF shuts it. When the bowl runs low the engine starts to
// starve, which the engine model turns into a lean, misfiring stumble.

import { mixOil } from '../engine/lubrication.js';
import { DEFAULT_FUEL_WATER_PARAMS, settleWater } from './fuelWater.js';

export const DEFAULT_FUEL_PARAMS = {
  tankCapacity: 12, // litres
  reserveLitres: 2, // only reachable with the tap on RESERVE
  startLitres: 7, // fuel in the tank at the start
  startDiesel: 0, // diesel fraction of that fuel: 1 on the tractor, which runs on red diesel
  startWater: 0, // water fraction of that fuel (see fuelWater.js): the barn find's old tank, or a can left out in the rain
  startOil: 0, // oil fraction of that fuel: 0.02 (50:1 pre-mix) on the two-strokes, none on the four-strokes
  noTap: false, // no fuel tap (the tractor's): the fuel always flows and there's no reserve
  startTap: 'off', // tap position at the start: turn it ON before riding off
  bowlCapacity: 0.012, // litres in the carburettor float bowl: with the tap OFF it runs about half a minute at idle
  bowlFillRate: 0.02, // litres per second from the tank into the bowl
  burnPerRev: 0.0000722, // litres per crank revolution at full throttle (game-paced: a full tank lasts about 25 minutes flat out, cruising at about 5,700 rpm under load)
  idleBurnFraction: 0.295, // fraction of that burnt at a closed throttle (keeps idle burn, and so tap-off timing, as it was)
  chokeBurn: 0.3, // extra consumption at full choke
  starveFraction: 0.3, // below this share of the tank the fuel runs away from the tap on a steep nose-up bank (taps only, not the cars or the tractor)
  starveClimb: 0.3, // sine of the nose-up climb at which the tap is uncovered with the tank at that share (0.3 is about 17 degrees); less fuel, a gentler bank
  starveMinClimb: 0.1, // and the gentlest climb that uncovers it however little is left (about 6 degrees)
};

export const FUEL_PARAM_RANGES = {
  tankCapacity: [2, 60, 0.5],
  reserveLitres: [0, 10, 0.1],
  startLitres: [0, 40, 0.1],
  startWater: [0, 0.3, 0.005],
  startOil: [0, 0.2, 0.001],
  bowlCapacity: [0.005, 0.3, 0.005],
  bowlFillRate: [0.001, 0.2, 0.001],
  burnPerRev: [0, 0.0005, 0.000001],
  idleBurnFraction: [0, 1, 0.01],
  chokeBurn: [0, 2, 0.01],
  starveFraction: [0, 1, 0.01],
  starveClimb: [0.05, 0.9, 0.01],
  starveMinClimb: [0.02, 0.5, 0.01],
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
    this.water = params.startWater ?? 0; // water fraction of what's in the tank
    this.bowlWater = this.water; // and of what's in the float bowl, which is what the engine is fed
    this.wax = 0; // 0..1 how waxed up the diesel is in a hard frost (dieselWax.js); only a diesel's moves
    this.antiGel = 0; // share of what's in the tank that has anti-gel in it (dieselWax.js); topping up with untreated fuel thins it
    this.additive = params.startAdditive ?? 0; // share of what's in the tank that has plug-saver in it (plugAdditive.js)
    this.sediment = 0; // 0..1 how full the sediment bowl on the tap is of water
    this.waterParams = DEFAULT_FUEL_WATER_PARAMS;
    this.tap = params.startTap ?? 'on';
    this.burnRate = 0; // litres per second, last update
    this.uncovered = false; // the fuel has slopped away from the tap on a bank, so nothing reaches the bowl
  }

  /** Whether the fuel has run away from the tap's pick-up: a low tank, the nose pointing up a steep enough bank. `climb` is the sine of the nose-up angle. */
  coversTap(climb) {
    const p = this.params;
    if (p.noTap || this.tap === 'off') return true;
    const lowAt = p.starveFraction * p.tankCapacity;
    if (this.litres >= lowAt) return true;
    const limit = Math.max(p.starveMinClimb, p.starveClimb * (this.litres / lowAt));
    return climb < limit;
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
    if (this.params.noTap) return this.litres;
    if (this.tap === 'off') return 0;
    if (this.tap === 'on') return Math.max(0, this.litres - this.params.reserveLitres);
    return this.litres;
  }

  get space() {
    return this.params.tankCapacity - this.litres;
  }

  cycleTap() {
    if (this.params.noTap) return this.tap;
    this.tap = TAP_POSITIONS[(TAP_POSITIONS.indexOf(this.tap) + 1) % TAP_POSITIONS.length];
    return this.tap;
  }

  /** Sets what's in the tank, as if it had been there all along. */
  setLitres(litres) {
    this.litres = clamp(litres, 0, this.params.tankCapacity);
    this.bowl = this.litres > 0 ? this.params.bowlCapacity : 0;
  }

  /** Pours fuel in, with `oil` as its oil fraction, `diesel` as its diesel fraction `water` as its water fraction and `additive` as its treated share; returns how much actually went in. */
  add(litres, oil = 0, diesel = 0, water = 0, additive = 0) {
    const added = clamp(litres, 0, this.space);
    this.oil = mixOil(this.litres, this.oil, added, oil);
    this.diesel = mixOil(this.litres, this.diesel, added, diesel);
    this.water = mixOil(this.litres, this.water, added, water);
    this.additive = mixOil(this.litres, this.additive, added, additive);
    this.antiGel = mixOil(this.litres, this.antiGel, added, 0);
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
    this.water = 0;
    this.bowlWater = 0;
    this.additive = 0;
    this.antiGel = 0;
    this.wax = 0;
    this.sediment = 0;
    return lost;
  }

  /** Whether there is water to let out at the tap: in the bowl, the tank or the carb. */
  get hasWater() {
    return this.sediment > 0.02 || this.water > 0.002 || this.bowlWater > 0.002;
  }

  /** Opens the sediment bowl's drain: the water runs out of the bowl, the tank's bottom and the carb, with a little fuel. Returns the litres lost. */
  drainSediment() {
    const lost = Math.min(this.litres, this.waterParams.drainLoss);
    this.litres -= lost;
    this.clearWater();
    return lost;
  }

  /** All the water gone from the tank, the carb and the bowl at once (the debug panel's "Put it right"). */
  clearWater() {
    this.water = 0;
    this.bowlWater = 0;
    this.sediment = 0;
  }

  /**
   * @param {number} dt
   * @param {object} engine  { rpm, throttle, choke, running, climb } (climb: sine of the nose-up angle, 0 on the level)
   */
  update(dt, { rpm, throttle, choke, running, climb = 0 }) {
    const p = this.params;
    // Burn from the bowl while the engine is running.
    const pedal = p.idleBurnFraction + (1 - p.idleBurnFraction) * throttle;
    this.burnRate = running ? p.burnPerRev * (rpm / 60) * pedal * (1 + p.chokeBurn * choke) : 0;
    this.bowl = Math.max(0, this.bowl - this.burnRate * dt);

    // Top the bowl up from the tank through the tap.
    const want = p.bowlCapacity - this.bowl;
    this.uncovered = !this.coversTap(climb);
    const flow = this.uncovered ? 0 : Math.min(want, p.bowlFillRate * dt, this.reachable);
    if (flow > 0) {
      this.bowlDiesel = mixOil(this.bowl, this.bowlDiesel, flow, this.diesel);
      const settled = settleWater(this.sediment, flow * this.water, this.waterParams);
      this.sediment = settled.sediment;
      this.bowlWater = mixOil(this.bowl, this.bowlWater, flow, settled.passed / flow);
      this.bowl += flow;
      this.litres -= flow;
    }
  }
}
