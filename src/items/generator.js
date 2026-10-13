// The barn's generator: a small diesel set outside the door that powers the barn bulb and the bench charger. It needs red diesel
// poured in, is started with a pull cord (it may take a few goes, and a dry tank only wheezes), and is off again every morning.
// Pure logic, no Three.js or DOM: the game says what is asked of it and where the fuel came from.

export const DEFAULT_GENERATOR_PARAMS = {
  tank: 5, // litres the tank holds
  startLitres: 2.5, // what is in it on a fresh farm; after that the save keeps it
  burn: 0.004, // litres a second running with nothing on it: a full tank lasts about twenty minutes
  loadBurn: 0.0025, // and this much more while the charger is drawing on it
  pourRate: 0.4, // litres a second from a jerry can
  catchChance: 0.45, // the first pull of the cord catches this often
  warmUp: 0.2, // each pull that doesn't catch makes the next one likelier by this much
  maxChance: 0.95, // but never past this
  pullSeconds: 1.1, // a pull takes this long, and the next can't start before it is done
  sputterAt: 0.15, // litres left under which it runs rough, and a girl says it is low
};

export const GENERATOR_PARAM_RANGES = {
  tank: [1, 20, 0.5],
  startLitres: [0, 20, 0.5],
  burn: [0.0005, 0.03, 0.0005],
  loadBurn: [0, 0.02, 0.0005],
  pourRate: [0.05, 3, 0.05],
  catchChance: [0.05, 1, 0.05],
  warmUp: [0, 0.5, 0.05],
  maxChance: [0.5, 1, 0.05],
  pullSeconds: [0.3, 3, 0.1],
  sputterAt: [0, 1, 0.05],
};

/** Red diesel only: the share of a can that must be diesel for the tank to take it. */
export const DIESEL_ENOUGH = 0.5;

export class Generator {
  constructor(params = { ...DEFAULT_GENERATOR_PARAMS }, random = Math.random) {
    this.params = params;
    this.random = random;
    this.fuel = Math.min(params.tank, params.startLitres);
    this.running = false;
    this.pulls = 0; // goes at the cord since it last ran
    this.pulling = 0; // seconds left of the pull in hand
    this.ranFor = 0; // seconds it has run this go
  }

  /** Is the power on? The barn bulb and the charger ask this. */
  get powered() {
    return this.running;
  }

  get space() {
    return Math.max(0, this.params.tank - this.fuel);
  }

  get level() {
    return this.fuel / this.params.tank;
  }

  get low() {
    return this.running && this.fuel <= this.params.sputterAt;
  }

  /** The chance the next pull catches. */
  get chance() {
    const p = this.params;
    return Math.min(p.maxChance, p.catchChance + this.pulls * p.warmUp);
  }

  /** Can a pull be started now? */
  get canPull() {
    return !this.running && this.pulling <= 0;
  }

  /**
   * Pours `litres` from a can that is `diesel` (0..1) diesel in. Returns litres taken; `wrong` says it was refused for the fuel,
   * and nothing goes in while it runs (nobody tops up a hot set).
   */
  add(litres, diesel = 1) {
    if (this.running) return 0;
    if (diesel < DIESEL_ENOUGH) return 0;
    const taken = Math.min(litres, this.space);
    this.fuel += taken;
    return taken;
  }

  /** A pull of the cord. Returns 'caught', 'coughed' (didn't), 'dry' (nothing to burn) or null (one is in hand already, or it runs). */
  pull() {
    if (!this.canPull) return null;
    this.pulling = this.params.pullSeconds;
    if (this.fuel <= 0) return 'dry';
    const caught = this.random() < this.chance;
    this.pulls++;
    if (!caught) return 'coughed';
    this.running = true;
    this.ranFor = 0;
    return 'caught';
  }

  /** Switched off at the switch. */
  stop() {
    if (!this.running) return false;
    this.running = false;
    this.pulls = 0;
    return true;
  }

  /** The morning: it has stood all night and is off. */
  overnight() {
    this.running = false;
    this.pulls = 0;
    this.pulling = 0;
  }

  /** One step; `load` is 0..1 of what is drawing on it. Returns 'stalled' on the step the tank runs dry. */
  update(dt, load = 0) {
    if (this.pulling > 0) this.pulling = Math.max(0, this.pulling - dt);
    if (!this.running) return null;
    const p = this.params;
    this.ranFor += dt;
    this.fuel = Math.max(0, this.fuel - (p.burn + p.loadBurn * load) * dt);
    if (this.fuel > 0) return null;
    this.running = false;
    this.pulls = 0;
    return 'stalled';
  }

  /** What the save keeps: the fuel (it is always off in the morning). */
  toJSON() {
    return { fuel: Math.round(this.fuel * 100) / 100 };
  }

  restore(saved) {
    if (typeof saved?.fuel === 'number') this.fuel = Math.max(0, Math.min(this.params.tank, saved.fuel));
    this.overnight();
  }

  describe() {
    return `${this.running ? 'running' : 'off'}, ${this.fuel.toFixed(2)} / ${this.params.tank} L${this.running && this.low ? ', running rough' : ''}`;
  }
}
