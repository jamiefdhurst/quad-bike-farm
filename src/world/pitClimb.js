// The pit climb: a timed run from the cones on the gravel pit's floor up its steepest wall to the cones over the lip (layout: quarry.climb).
// You ask with Enter by the start cones, then the clock runs from the moment you ride through them and stops over the finish cones; the cone
// between is a gate you have to go through, wide enough to take in the line you choose up the climb wall, so the line is yours. Only you run it. It is the hill
// climb's run (npc/hillClimb.js ClimbRun) with the same gates, kept on its own board line. Pure logic: the game feeds in where you are.

import { ClimbRun } from '../npc/hillClimb.js';
import { formatValue } from './records.js';

export const DEFAULT_PIT_PARAMS = {
  nearStart: 16, // metres from the start cones you count as there to ask
  armFor: 120, // seconds your ask lasts before you have to ask again
  outAfter: 8, // seconds off the quad or stalled and the run is out
  timeout: 120, // seconds from the start before the run is out
};

export const PIT_PARAM_RANGES = {
  nearStart: [5, 80, 1],
  armFor: [10, 300, 5],
  outAfter: [2, 60, 1],
  timeout: [20, 400, 5],
};

/** What you are told as the run goes (the toast), or null for nothing: `e` is an event from `update`, `result` { record, quadBest } for a finish. */
export function pitMessage(e, result = {}) {
  if (e.type === 'start') return 'Go!';
  if (e.type === 'gate') return 'Gate. The finish cones are over the lip';
  if (e.type === 'out') return 'Pit climb: you are out';
  if (e.type === 'finish') return `Pit climb: ${formatValue('pit', e.time)}${result.record ? '. A record!' : result.quadBest ? '. Your best on this quad' : ''}`;
  return null;
}

/** What you are told when you ask (Enter by the start cones). */
export const PIT_ASK_MESSAGE = 'Pit climb: ride through the start cones when you are ready, then find a way up the wall and through the gate and the finish cones over the lip';

/** Your timed run up the pit's wall. `update` returns events { type: 'start' | 'gate' | 'finish' | 'out', time, gatesLeft }. */
export class PitClimb {
  constructor(gates, params = { ...DEFAULT_PIT_PARAMS }) {
    this.gates = gates;
    this.p = params;
    this.run = null;
    this.armed = 0; // seconds left of your ask
    this.tally = 0; // climbs finished
  }

  /** You ask (Enter near the start): the next time you ride through the start cones the clock runs. */
  arm() {
    this.armed = this.p.armFor;
    this.run = new ClimbRun(this.gates, this.p);
  }

  get youArmed() {
    return this.armed > 0 && this.run?.state === 'waiting';
  }

  /** Whether a run is going: you are on the clock. */
  get running() {
    return this.run?.state === 'running';
  }

  /** The metres you are from the start cones. */
  distanceToStart(at) {
    const s = this.gates[0];
    return Math.hypot(at.x - s.x, at.z - s.z);
  }

  /** Called off (the bell, or you got off): the run is forgotten. */
  stand() {
    this.run = null;
    this.armed = 0;
  }

  /** `at`: { x, z, riding, running } for you, or null when you are not on a quad. */
  update(dt, at) {
    if (this.armed > 0) this.armed -= dt;
    if (!this.run) return [];
    if (this.armed <= 0 && this.run.state === 'waiting') {
      this.run = null;
      return [];
    }
    if (!at || (this.run.state === 'waiting' && !this.youArmed)) return [];
    const e = this.run.update(dt, at, at);
    if (!e) return [];
    if (e === 'finish') this.tally++;
    return [{ type: e, time: this.run.time, gatesLeft: this.run.gatesLeft }];
  }
}
