// When a vehicle's doors swing out (the UTV's nets now; the cars' and the Land Rovers' doors when they are made to move): each side's
// own door opens for a few seconds when somebody gets on or off at that side, and while a girl is stepping in or climbing down there, only
// while the vehicle is nearly stopped, and shuts again; the other side's stays shut. Pure logic, tested in tests/doorSwing.test.js.

export const DEFAULT_DOOR_PARAMS = {
  seconds: 2.4, // how long a door stays out after you get on or off at its side
  stopSpeed: 0.5, // m/s: it will not open (and it shuts) above this
  rate: 4, // how fast it swings, a fraction of the way a second
};

export const DOOR_PARAM_RANGES = { seconds: [0, 10, 0.1], stopSpeed: [0, 3, 0.1], rate: [1, 12, 0.5] };

const SIDES = ['left', 'right'];

export class DoorSwing {
  constructor(p = DEFAULT_DOOR_PARAMS) {
    this.p = p;
    this.open = { left: 0, right: 0 }; // 0 shut to 1 swung out
    this.timer = { left: 0, right: 0 };
    this.was = null;
  }

  /**
   * One step. `aboard` says whether somebody is on at each side (you, as the driver on the right or a passenger on the left), `boarding`
   * whether a girl is stepping in or climbing down at each side just now. Returns { left, right }, each 0..1.
   */
  update(dt, { speed = 0, aboard = {}, boarding = {} } = {}) {
    const p = this.p;
    this.was ??= { left: !!aboard.left, right: !!aboard.right };
    for (const side of SIDES) {
      const now = !!aboard[side];
      if (now !== this.was[side]) this.timer[side] = p.seconds;
      this.was[side] = now;
      this.timer[side] = Math.max(0, this.timer[side] - dt);
      const want = Math.abs(speed) < p.stopSpeed && (this.timer[side] > 0 || !!boarding[side]) ? 1 : 0;
      this.open[side] += (want - this.open[side]) * Math.min(1, p.rate * dt);
    }
    return this.open;
  }
}
