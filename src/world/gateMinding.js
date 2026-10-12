// The girls and the gate by the cattle grid. Pure: no Three.js, no game. A girl who is walking or driving up to a shut gate opens it as she
// reaches it, and once she has been through and nobody is near any more she shuts it, so a gate she opened is not left swinging. A gate you
// opened is yours to shut: she leaves it. The host (world/trafficHost.js) feeds this the girls and anyone else near, and does the swinging.

export const DEFAULT_GATE_MIND_PARAMS = {
  openWithin: 10, // m (a girl driving covers it in a second or two, and the gate takes 1.8 s to swing): a girl on the move this close to a shut gate opens it
  moveSpeed: 0.6, // m/s: slower than this she is stood about, not going through
  shutAfter: 8, // s: how long nobody has been near a gate she opened before she shuts it
  shutRadius: 14, // m: anyone (you, a quad, a girl) within this of the gate keeps it open
};

export const GATE_MIND_RANGES = {
  openWithin: [2, 15, 0.5],
  moveSpeed: [0.1, 2, 0.1],
  shutAfter: [1, 30, 1],
  shutRadius: [6, 30, 1],
};

export class GateMinder {
  constructor(params = DEFAULT_GATE_MIND_PARAMS) {
    this.p = params;
    this.byGirl = false; // she opened it, so she shuts it
    this.quiet = 0; // s nobody has been near it
  }

  /** You (or the debug panel) swung the gate: whatever its state, it is not hers to put back. */
  taken() {
    this.byGirl = false;
    this.quiet = 0;
  }

  /**
   * One tick. `gate` { x, z, open }; `girls` [{ x, z, speed, going }] (going: she is walking or driving, not riding on someone's back);
   * `near` [{ x, z }] everyone who counts against shutting. Returns 'open', 'shut' or null: what to do now.
   */
  update(dt, gate, girls, near) {
    const p = this.p;
    if (!gate.open) {
      this.quiet = 0;
      this.byGirl = false;
      const goer = girls.find((g) => g.going && g.speed >= p.moveSpeed && Math.hypot(g.x - gate.x, g.z - gate.z) < p.openWithin);
      if (!goer) return null;
      this.byGirl = true;
      return 'open';
    }
    if (!this.byGirl) return null;
    const busy = [...near, ...girls].some((t) => Math.hypot(t.x - gate.x, t.z - gate.z) < p.shutRadius);
    this.quiet = busy ? 0 : this.quiet + dt;
    return this.quiet >= p.shutAfter ? 'shut' : null;
  }
}
