// When a car's or Land Rover's door or tailgate does something you should hear: it comes unlatched and swings out, it is pushed shut (or
// slammed, because you drove off or a girl let it go), a dropped tailgate comes up on its chains. Watches the 0..1 openness that
// doorSwing.js and tailgate.js already work out and turns the crossings into events for the ride sounds (audio/doorSamples.js makes the
// noises). Pure logic, tested in tests/doorSounds.test.js.

const DOOR_SOUND_THRESHOLDS = {
  openAt: 0.1, // a door counts as open once it has swung this far
  shutAt: 0.05, // and as shut again when it is back below this (less than openAt, so one that hovers does not chatter)
  slamSpeed: 0.5, // m/s: shut at more than this and it is a slam, not a push
  hatchSlamSpeed: 2, // m/s: a tailgate or hatch shut by driving off is a slam
};

export class DoorSounds {
  /** @param {'tailgate'|'backDoor'|'hatch'} rear  What this vehicle's rear opening is, which decides how it sounds. */
  constructor(rear = 'hatch', p = DOOR_SOUND_THRESHOLDS) {
    this.p = p;
    this.rear = rear;
    this.up = { left: false, right: false, rear: false }; // whether each is out just now
    this.prev = { left: 0, right: 0, rear: 0 };
    this.stopped = false; // a dropped tailgate has reached the end of its chains
    this.events = [];
  }

  /**
   * One step. `doors` is { left, right } and `rear` the tailgate's openness, each 0..1 (as doorSwing and Tailgate give them).
   * Events collect until `take()`: { part: 'door'|rear kind, side: -1 left, 1 right, 0 rear, what: 'open'|'shut'|'slam'|'stop', strength }.
   */
  update(dt, { doors = {}, rear = 0, speed = 0 } = {}) {
    const p = this.p;
    const v = Math.abs(speed);
    for (const key of ['left', 'right']) {
      const now = doors[key] ?? 0;
      if (!this.up[key] && now > p.openAt) {
        this.up[key] = true;
        this.events.push({ part: 'door', side: key === 'left' ? -1 : 1, what: 'open', strength: 0.5 });
      } else if (this.up[key] && now < p.shutAt) {
        this.up[key] = false;
        const slam = v >= p.slamSpeed;
        this.events.push({ part: 'door', side: key === 'left' ? -1 : 1, what: slam ? 'slam' : 'shut', strength: slam ? 1 : 0.65 });
      }
      this.prev[key] = now;
    }
    if (!this.up.rear && rear > p.openAt) {
      this.up.rear = true;
      this.stopped = false;
      this.events.push({ part: this.rear, side: 0, what: 'open', strength: 0.5 });
    } else if (this.up.rear && rear < p.shutAt) {
      this.up.rear = false;
      const slam = v >= p.hatchSlamSpeed;
      this.events.push({ part: this.rear, side: 0, what: slam ? 'slam' : 'shut', strength: slam ? 1 : 0.7 });
    }
    // A dropped tailgate (the Series') stops hard on its chains; the others have nothing to stop against.
    if (this.up.rear && !this.stopped && rear > 0.97) {
      this.stopped = true;
      if (this.rear === 'tailgate') this.events.push({ part: 'tailgate', side: 0, what: 'stop', strength: 0.8 });
    } else if (rear < 0.9) this.stopped = false;
    this.prev.rear = rear;
  }

  take() {
    return this.events.splice(0);
  }
}
