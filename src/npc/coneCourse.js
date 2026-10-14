// Amy's cone course: a slalom of gates across the grass, each a pair of cones to weave through, timed like the hill climb (hillClimb.js, whose
// run and girl-choosing machinery it reuses) with penalties on top: a cone knocked down costs `conePenalty` seconds and a gate missed
// `missPenalty`. The cones really fall (ConeField) and stay down until Amy tidies them or you stand them up. Pure: the game feeds in where
// everything is and draws the cones.

import { DEFAULT_CLIMB_PARAMS, CLIMB_PARAM_RANGES, ClimbRun, HillClimb, crossesGate } from './hillClimb.js';

export const DEFAULT_CONE_PARAMS = {
  ...DEFAULT_CLIMB_PARAMS,
  startAfter: 200, // seconds into the game before a girl might choose to
  cooldown: 300, // seconds between the girls' runs
  weightJess: 1.2, // how keen Jess is to weave round the cones (chooser.js weighs it)
  weightAmy: 1.4, // and Amy, whose course it is
  timeout: 90, // seconds from the start before a run is out
  cruiseAmy: 5, // m/s Amy aims for: careful
  cruiseJess: 8, // and Jess
  conePenalty: 2, // seconds added for each cone knocked down in a run
  missPenalty: 5, // seconds added for each gate missed
  hitRadius: 0.9, // metres from a quad's middle that a cone goes over
  footRadius: 0.4, // and from a girl's feet
  hitSpeed: 0.4, // m/s below which a thing touching a cone leaves it standing
  tidyAfter: 8, // seconds after a run that Amy stands the cones up again
  jessKnockChance: 0.4, // chance Jess aims for the cones instead of the gaps, on purpose
};

export const CONE_PARAM_RANGES = {
  ...CLIMB_PARAM_RANGES,
  timeout: [20, 300, 5],
  cruiseAmy: [2, 15, 0.5],
  cruiseJess: [2, 15, 0.5],
  conePenalty: [0, 10, 0.5],
  missPenalty: [0, 20, 0.5],
  hitRadius: [0.3, 2, 0.05],
  footRadius: [0.1, 1, 0.05],
  hitSpeed: [0, 3, 0.1],
  tidyAfter: [0, 60, 1],
  jessKnockChance: [0, 1, 0.05],
};

/**
 * The course's gates from its layout: the start, `gates` slalom gates `spacing` apart swinging `swing` m either side of the line in turn,
 * then the finish `tail` m on. Each faces towards the next (the same shape as hillClimb.js climbGates, so its run and route work on them).
 * `yaw` is the way you ride, as a quad's yaw.
 */
export function coneGates(c) {
  const fx = Math.sin(c.yaw);
  const fz = Math.cos(c.yaw);
  const lx = Math.cos(c.yaw); // across the course
  const lz = -Math.sin(c.yaw);
  const at = (along, across) => ({ x: c.x + fx * along + lx * across, z: c.z + fz * along + lz * across });
  const pts = [at(0, 0)];
  for (let i = 0; i < c.gates; i++) pts.push(at(c.lead + i * c.spacing, (i % 2 ? -1 : 1) * c.swing));
  pts.push(at(c.lead + (c.gates - 1) * c.spacing + c.tail, 0));
  return pts.map((p, i) => {
    const n = pts[Math.min(i + 1, pts.length - 1)];
    const b = pts[i === pts.length - 1 ? i - 1 : i];
    const dx = i === pts.length - 1 ? p.x - b.x : n.x - p.x;
    const dz = i === pts.length - 1 ? p.z - b.z : n.z - p.z;
    const len = Math.hypot(dx, dz) || 1;
    return { x: p.x, z: p.z, tx: dx / len, tz: dz / len, half: c.gateHalf };
  });
}

/** Where each cone stands: one either side of every gate (the cone `0.5` m outside its gap), and two pairs `box` m apart at the start and finish. */
export function coneSpots(gates, box = 3) {
  const out = [];
  gates.forEach((g, i) => {
    const end = i === 0 || i === gates.length - 1;
    for (const side of [-1, 1]) {
      for (const along of end ? [-box / 2, box / 2] : [0]) {
        out.push({ x: g.x - g.tz * (g.half + 0.5) * side + g.tx * along, z: g.z + g.tx * (g.half + 0.5) * side + g.tz * along, gate: i, side });
      }
    }
  });
  return out;
}

/**
 * Where Jess drives when she means to knock them: `route` is hillClimb.js climbRoute (two waiting points, then a point per gate, then on past
 * the finish). Each slalom gate's point moves to the edge of its gap, so she clips a cone and the gate still counts.
 */
export function knockRoute(gates, route) {
  return route.map((pt, i) => {
    const gi = i - 2;
    if (gi < 1 || gi > gates.length - 2) return pt;
    const g = gates[gi];
    const off = Math.max(0, g.half - 0.2) * (gi % 2 ? 1 : -1);
    return { x: pt.x - g.tz * off, z: pt.z + g.tx * off };
  });
}

/** A run with penalties: knocked cones (told by `hit`) and gates missed (one crossed with an earlier one skipped). */
export class CourseRun extends ClimbRun {
  constructor(gates, p = DEFAULT_CONE_PARAMS) {
    super(gates, p);
    this.cones = 0;
    this.misses = 0;
  }

  update(dt, at, status) {
    if (this.state === 'running' && this.prev) {
      for (let j = this.next + 1; j < this.gates.length; j++) {
        if (crossesGate(this.gates[j], this.prev, at)) {
          this.misses += j - this.next;
          this.next = j;
          break;
        }
      }
    }
    return super.update(dt, at, status);
  }

  hit() {
    if (this.state === 'running') this.cones++;
  }

  /** The score: the time and what the cones and the gates cost. */
  result() {
    return this.time + this.cones * this.p.conePenalty + this.misses * this.p.missPenalty;
  }
}

/** The runs and the girls choosing to run it: the hill climb's, timed with penalties. */
export class ConeCourse extends HillClimb {
  constructor(gates, params = { ...DEFAULT_CONE_PARAMS }, random = Math.random) {
    super(gates, params, random);
    this.Run = CourseRun;
    this.kind = 'cones';
  }

  /** A cone went over under this runner (you or a girl's id). */
  hit(id) {
    this.runs[id]?.hit();
  }

  /** Whether she aims for the cones this run (Jess, now and then; Amy never). */
  knocksOnPurpose(id) {
    return id === 'jess' && this.random() < this.p.jessKnockChance;
  }
}

/** The cones as things that fall over and are stood up again. */
export class ConeField {
  constructor(spots, params = DEFAULT_CONE_PARAMS) {
    this.p = params;
    this.cones = spots.map((s) => ({ ...s, down: false, fall: 0, dx: 0, dz: 1 }));
    this.tidy = 0; // seconds until Amy stands them up (0: not waiting)
  }

  get downCount() {
    return this.cones.filter((c) => c.down).length;
  }

  /**
   * Things moving over the cones: [{ id, x, z, speed, foot }]. Returns { index, id } for each cone that went over this step. A thing has to be
   * moving (`hitSpeed`) to knock one, and sends it over away from itself.
   */
  hit(things) {
    const p = this.p;
    const out = [];
    this.cones.forEach((c, index) => {
      if (c.down) return;
      for (const t of things) {
        if (t.speed < p.hitSpeed) continue;
        const dx = c.x - t.x;
        const dz = c.z - t.z;
        const d = Math.hypot(dx, dz);
        if (d >= (t.foot ? p.footRadius : p.hitRadius)) continue;
        c.down = true;
        c.fall = 0;
        c.dx = d > 1e-3 ? dx / d : 0;
        c.dz = d > 1e-3 ? dz / d : 1;
        out.push({ index, id: t.id });
        break;
      }
    });
    return out;
  }

  /** Falls take about a third of a second; Amy's tidy countdown runs, and returns true on the step it stands them up. */
  update(dt) {
    for (const c of this.cones) c.fall = c.down ? Math.min(1, c.fall + dt * 3) : Math.max(0, c.fall - dt * 3);
    if (this.tidy > 0 && (this.tidy -= dt) <= 0) {
      this.tidy = 0;
      this.standUp();
      return true;
    }
    return false;
  }

  standUp() {
    for (const c of this.cones) c.down = false;
    this.tidy = 0;
  }

  /** Amy will stand them up in `after` seconds (if any are down). */
  tidySoon(after = this.p.tidyAfter) {
    if (this.downCount) this.tidy = Math.max(after, 0.01);
  }
}
