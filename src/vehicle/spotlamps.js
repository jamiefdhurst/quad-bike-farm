// Spotlamps: a pair of long-throw lamps fitted at the barn bench (the `spotlamps` job in workshop/benchJobs.js) to the quads and the
// Land Rovers, for riding the fields after dark. They have their own switch (9), need the key on and a battery, and load it more than the
// headlights do. A narrow, bright beam that carries much further than a headlamp's. Done badly at the bench, they are aimed wrong
// (low and a bit off to one side). Pure logic, no Three.js; the model is spotlampModel.js and the real light is in
// effects/vehicleLights.js.

export const DEFAULT_SPOTLAMP_PARAMS = {
  candela: 900, // a pair at full, at the middle of the beam (a headlamp pair is 140)
  reach: 95, // metres: the light is gone by here
  decay: 1.1, // how fast it falls away with distance (2 is real; less carries further)
  angle: 0.16, // radians: half the beam's spread, a tight pencil beside a headlamp's 0.55
  penumbra: 0.35, // how soft the beam's edge is
  dip: 0.04, // radians the beam is aimed down from straight ahead
  load: 0.8, // how much of the battery's lamp load a pair adds (a headlamp pair is 1)
  easeRate: 9, // how fast the lamps come up and go out, per second
  badPitch: 0.16, // radians a badly aimed pair points too low
  badYaw: 0.07, // and off to one side
};

export const SPOTLAMP_PARAM_RANGES = {
  candela: [0, 3000, 10],
  reach: [10, 200, 1],
  decay: [0, 3, 0.05],
  angle: [0.03, 0.6, 0.01],
  penumbra: [0, 1, 0.01],
  dip: [-0.2, 0.4, 0.01],
  load: [0, 3, 0.05],
  easeRate: [1, 30, 0.5],
  badPitch: [0, 0.5, 0.01],
  badYaw: [0, 0.3, 0.01],
};

export const SPOTLAMP_PARAMS = { ...DEFAULT_SPOTLAMP_PARAMS }; // shared by every vehicle, registered once

export class Spotlamps {
  /** `canFit`: whether this vehicle can have a pair (the quads and the Land Rovers, with headlamps to mount them by). */
  constructor(canFit = false, p = SPOTLAMP_PARAMS) {
    this.p = p;
    this.canFit = !!canFit;
    this.fitted = false;
    this.on = false; // the switch
    this.aim = 1; // 1 aimed true, less for a pair put on badly (the same 0..1 as the other bench jobs' fit)
    this.level = 0; // how brightly they are lit now, eased towards the target
  }

  /** Fitted at the bench: `aim` 1 for a good job. The switch starts off. */
  fit(aim = 1) {
    if (!this.canFit) return false;
    this.fitted = true;
    this.aim = aim;
    this.on = false;
    return true;
  }

  /** Taken off again (the debug panel). */
  remove() {
    this.fitted = false;
    this.on = false;
    this.level = 0;
  }

  /** The switch (9). Returns the new state, or null if there is nothing to switch. */
  toggle() {
    if (!this.fitted) return null;
    this.on = !this.on;
    return this.on;
  }

  /** Each step. `supply` is 0..1 how well the battery and revs are feeding lamps (charging.js lampSupply); `power` is key on with a battery. Returns the level. */
  update(dt, power, supply = 1) {
    const target = this.fitted && this.on && power ? supply : 0;
    const k = Math.min(1, this.p.easeRate * dt);
    this.level += (target - this.level) * k;
    if (Math.abs(target - this.level) < 0.005) this.level = target;
    return this.level;
  }

  /** What they add to the battery's lamp load (0..1 added to the headlamps'). */
  get load() {
    return this.level > 0.02 ? this.p.load * this.level : 0;
  }

  /** Where the pair points: radians down from straight ahead, and sideways, with a bad aim worse the further `aim` is from 1. */
  aimAngles() {
    const bad = 1 - this.aim;
    return { pitch: this.p.dip + this.p.badPitch * bad, yaw: this.p.badYaw * bad };
  }

  capture() {
    return { fitted: this.fitted, on: this.on, aim: this.aim };
  }

  restore(s) {
    if (!s || !this.canFit || !s.fitted) return;
    this.fitted = true;
    this.on = !!s.on;
    this.aim = typeof s.aim === 'number' && Number.isFinite(s.aim) ? Math.max(0, Math.min(1, s.aim)) : 1;
  }
}
