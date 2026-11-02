// How a two-wheeler stays up and turns: the rider leans it, the lean turns the front wheel, and the grip decides whether it holds. Pure
// logic, no Three.js or Rapier; quad.js feeds it the chassis's roll and applies what it returns (a roll torque, the front wheel's angle and
// a grip factor for each tyre). Lean is positive to the left, like steering.
//
// The rider commands a lean from the bars (more at speed). A balance torque holds the chassis at that angle, and the front wheel is
// steered to whatever the actual lean turns at (curvature = g tan(lean) / v squared), so the lean drives the turn rather than the bars.
// Tyres hold a lean up to the surface's grip, which sets a limit:
//   - power mid-corner uses some of the rear's grip, so at a deep lean it steps out (rear slide) and recovers if you ease off;
//   - the front brake mid-corner uses the front's grip, so the front tucks and the bike goes down on its inside;
//   - too much slide or tuck, or a lean past `fallLeanDeg`, and it falls.
// Someone on the back (`pillion`) makes it heavier to lean: the lean builds slower, the balance holds firmer and it goes over a little sooner.
// Below `footDownSpeed` a foot is down: no lean, the bars steer directly, and it can't fall. An unattended bike (a parked one on its
// stand, or one carrying on without a rider) and one a girl is riding balance themselves and never fall.

const G = 9.81;
const DEG = Math.PI / 180;

export const DEFAULT_BIKE_PARAMS = {
  wheelbase: 0.95, // m, axle to axle
  maxLeanDeg: 40, // the lean full bars ask for at full lean speed
  fullLeanSpeed: 9, // m/s at which full bars give the full lean (less below that: slow corners are turned on the bars)
  footDownSpeed: 2.5, // m/s: below this a foot is down, so it stays upright, steers on the bars and can't fall
  footDownBlend: 2.5, // m/s over which the lean takes over the steering from the bars above that
  gripMu: 1, // sideways acceleration a grass-gripping pair of tyres holds, in g (tan of the lean they can hold)
  rollStiffness: 3200, // N m per radian: how firmly the balance holds the commanded lean
  rollDamping: 280, // N m per radian a second: stops it wobbling
  leanRate: 4, // 1/s, how fast the rider moves the commanded lean towards the bars
  powerSlide: 0.55, // fraction of the rear's grip full throttle uses at full lean
  frontBrakeUse: 0.65, // fraction of the front's grip a full brake uses
  slideRate: 1.5, // 1/s, how fast a slide builds once the grip is exceeded (a tuck or a rear slide)
  slideRecover: 1.6, // 1/s, how fast it settles when the grip is back
  tuckDropDeg: 28, // how much further over a tucking front pulls it
  slideGripLoss: 0.65, // fraction of a tyre's grip gone at full slide
  fallLeanDeg: 62, // past this it is going down whatever else
  fallPush: 700, // N m, pushing a falling bike over onto its side
  fallenRollDeg: 88, // where the push stops
  gentle: 0.6, // how much of the lean a girl will ask for
  pillionSlow: 0.25, // fraction of the lean rate lost with someone on the back: two people are slower to get over
  pillionStiff: 0.3, // how much firmer the balance holds with her weight up there
  pillionFall: 4, // degrees less lean before it goes with her weight high on the back
};

export const BIKE_PARAM_RANGES = {
  wheelbase: [0.5, 1.5, 0.05],
  maxLeanDeg: [20, 70, 1],
  fullLeanSpeed: [3, 20, 0.5],
  footDownSpeed: [0.5, 6, 0.1],
  footDownBlend: [0.5, 6, 0.1],
  gripMu: [0.3, 2, 0.05],
  rollStiffness: [500, 10000, 100],
  rollDamping: [20, 1000, 10],
  leanRate: [1, 12, 0.1],
  powerSlide: [0, 1, 0.05],
  frontBrakeUse: [0, 1, 0.05],
  slideRate: [0.5, 8, 0.1],
  slideRecover: [0.2, 6, 0.1],
  tuckDropDeg: [0, 60, 1],
  slideGripLoss: [0, 1, 0.05],
  fallLeanDeg: [45, 80, 1],
  fallPush: [100, 2000, 50],
  fallenRollDeg: [60, 90, 1],
  gentle: [0.2, 1, 0.05],
  pillionSlow: [0, 0.6, 0.05],
  pillionStiff: [0, 1, 0.05],
  pillionFall: [0, 15, 1],
};

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const smooth = (x) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};

/** The lean (radians) a steady corner of the given speed and curvature needs: tan(lean) = v squared times curvature over g. */
export function leanForCurvature(speed, curvature) {
  return Math.atan((speed * speed * curvature) / G);
}

/** The front wheel's angle (radians) a bike of the given wheelbase needs to follow a corner of the given lean at the given speed. */
export function steerForLean(wheelbase, lean, speed) {
  const v = Math.max(1, Math.abs(speed));
  return Math.atan((wheelbase * G * Math.tan(lean)) / (v * v));
}

export class BikeLean {
  constructor(params = DEFAULT_BIKE_PARAMS) {
    this.p = params;
    this.recover();
  }

  /** Back on its wheels, upright, nothing sliding (also the start). */
  recover() {
    this.command = 0; // the lean the rider is asking for, radians
    this.lean = 0; // the actual lean last seen, radians
    this.rearSlide = 0; // 0 gripping .. 1 gone
    this.frontSlide = 0;
    this.fallen = false;
    this.fallSide = 0; // +1 fell to the left, -1 to the right
    this.justFell = false; // set the step it goes down, until taken with takeFall()
    this.out = { rollTorque: 0, steer: 0, rearGrip: 1, frontGrip: 1, leaning: false };
  }

  /** Down it goes now, to this side (+1 left, -1 right): a girl having her first go has lost it. Not reported by takeFall, which is yours. */
  forceFall(side) {
    this.fallen = true;
    this.fallSide = side >= 0 ? 1 : -1;
    this.out.rollTorque = this.p.fallPush * this.fallSide;
  }

  /** True once, the step after it went down. */
  takeFall() {
    const f = this.justFell;
    this.justFell = false;
    return f;
  }

  /**
   * @param {number} dt
   * @param {object} s
   * @param {number} s.lean       The chassis's actual lean, radians, positive left.
   * @param {number} s.leanRate   Its rate, radians a second.
   * @param {number} s.speed      Signed forward speed, m/s.
   * @param {number} s.bars       The rider's steering, -1..1, positive left.
   * @param {number} s.barAngle   The front wheel's angle from the bars alone (what a quad would use), radians.
   * @param {number} s.throttle   0..1
   * @param {number} s.brake      0..1
   * @param {number} s.grip       The tyres' grip as a fraction of dry grass, about 0.2 (wet mud) to 1.2.
   * @param {boolean} s.safe      Nobody who can fall off is riding: held up regardless.
   * @param {boolean} s.gentle    A girl riding: asks for less lean.
   * @param {boolean} [s.pillion] Someone is on the back.
   * @returns {{rollTorque:number, steer:number, rearGrip:number, frontGrip:number, leaning:boolean}} The roll torque (N m, positive
   * leans it left), the front wheel angle, a factor on each tyre's grip, and whether the lean is steering it.
   */
  update(dt, s) {
    const p = this.p;
    const o = this.out;
    const speed = Math.abs(s.speed);
    this.lean = s.lean;

    if (this.fallen) {
      // Over it goes, onto its side, and then it lies there.
      const push = Math.abs(s.lean) < p.fallenRollDeg * DEG ? p.fallPush * this.fallSide : 0;
      o.rollTorque = push - p.rollDamping * 0.5 * s.leanRate;
      o.steer = s.barAngle;
      o.rearGrip = 1;
      o.frontGrip = 1;
      o.leaning = false;
      return o;
    }

    // Foot down: upright, and steered on the bars. Reversing is the same.
    const w = s.speed < 0 ? 0 : smooth((speed - p.footDownSpeed) / p.footDownBlend);
    const load = s.pillion ? 1 : 0;
    const fallLean = (p.fallLeanDeg - p.pillionFall * load) * DEG;
    const askFor = (s.gentle ? p.gentle : 1) * p.maxLeanDeg * DEG * s.bars * Math.min(1, speed / p.fullLeanSpeed) * w;

    // The grip: the tan of the lean the tyres will hold. Power uses some of the rear's, the brake some of the front's.
    // (A rider feels the grip and rides to it, so the ground counts for less than it does to a car's tyres.)
    const limit = Math.max(0.05, p.gripMu * (0.4 + 0.6 * s.grip));
    const demand = Math.tan(Math.min(Math.abs(s.lean), 80 * DEG));
    const depth = clamp(Math.abs(s.lean) / (p.maxLeanDeg * DEG), 0, 1);
    const rearLimit = limit * (1 - p.powerSlide * clamp(s.throttle, 0, 1) * depth);
    const frontLimit = limit * (1 - p.frontBrakeUse * clamp(s.brake, 0, 1));
    const planted = w > 0.3;
    this.rearSlide = grow(this.rearSlide, planted ? demand / rearLimit : 0, dt, p);
    this.frontSlide = grow(this.frontSlide, planted && s.brake > 0.2 ? demand / frontLimit : 0, dt, p);

    if (s.safe) {
      this.rearSlide = Math.min(this.rearSlide, 0.6);
      this.frontSlide = 0;
    } else if (this.rearSlide >= 1 || this.frontSlide >= 1 || Math.abs(s.lean) > fallLean) {
      this.fallen = true;
      this.justFell = true;
      this.fallSide = Math.sign(s.lean || s.bars || 1);
      o.rollTorque = p.fallPush * this.fallSide;
      o.steer = s.barAngle;
      o.rearGrip = 1 - p.slideGripLoss;
      o.frontGrip = 1 - p.slideGripLoss;
      o.leaning = false;
      return o;
    }

    // A tucking front pulls it further over, the way it is already leaning.
    const tuck = this.frontSlide * p.tuckDropDeg * DEG * Math.sign(s.lean || s.bars);
    const target = askFor + tuck;
    this.command += (target - this.command) * Math.min(1, p.leanRate * (1 - p.pillionSlow * load) * dt);

    o.rollTorque = p.rollStiffness * (1 + p.pillionStiff * load) * (this.command - s.lean) - p.rollDamping * s.leanRate;
    // The bars alone at a walking pace, the lean's own turn at speed.
    o.steer = w > 0 ? s.barAngle * (1 - w) + steerForLean(p.wheelbase, s.lean, speed) * w : s.barAngle;
    o.rearGrip = 1 - p.slideGripLoss * clamp(this.rearSlide, 0, 1);
    o.frontGrip = 1 - p.slideGripLoss * clamp(this.frontSlide, 0, 1);
    o.leaning = w > 0.5;
    return o;
  }
}

/** A slide builds while the demand is over the limit (ratio over 1), and settles when it isn't. */
function grow(slide, ratio, dt, p) {
  if (ratio > 1) return Math.min(1.2, slide + p.slideRate * clamp(ratio - 1, 0.1, 1) * dt);
  // Easing off helps: nearer the limit it settles slower.
  return Math.max(0, slide - p.slideRecover * dt * (1.4 - Math.min(1, ratio)));
}
