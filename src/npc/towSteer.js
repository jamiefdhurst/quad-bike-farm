import { angleDiff, headingTo, steerFor } from './herDriving.js';

// A girl sat on a dead quad on the end of the tow rope (items/towRope.js), steering it after the one in front and working the brake. The
// engine's off, so there's no throttle: she aims the bars at the towing quad's hitch and brakes so as not to run into its back. Amy looks
// well ahead; Jess brakes later, and now and then looks away at something. It has the shape of HerDrive (controls, update, stop, done,
// result) so the driving state can run it in place.

export const DEFAULT_TOW_STEER_PARAMS = {
  steerGain: 1.6, // bars per radian of heading error to the hitch
  clearance: 0.4, // metres between the two hitches at which the quads touch
  easeClosing: 0.4, // m/s of closing in on a slack rope that gets a touch of brake
  easeBrake: 0.25, // how much
  holdBrake: 0.5, // brake while the towing quad is stopped and she's close
  holdSpeed: 0.3, // m/s the towing quad is under to count as stopped
  distractFor: 1.6, // seconds she looks away for (no steering, no braking)
  giveUpAfter: 25, // seconds with nobody on the towing quad before she gets off
  bumpClosing: 1.2, // m/s of closing at the moment they touch that counts as running into it
  bumpCooldown: 6, // seconds before she can say it again
};

export const TOW_STEER_RANGES = {
  steerGain: [0.5, 4, 0.1],
  clearance: [0, 1.5, 0.05],
  easeClosing: [0, 2, 0.05],
  easeBrake: [0, 1, 0.05],
  holdBrake: [0, 1, 0.05],
  holdSpeed: [0.05, 1.5, 0.05],
  distractFor: [0.2, 5, 0.1],
  giveUpAfter: [3, 120, 1],
  bumpClosing: [0.3, 4, 0.1],
  bumpCooldown: [0, 30, 1],
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Her controls. `room` is the metres between the quads' ends once the rope's slack is counted out (gap minus the clearance), `closing` how
 * fast that is shrinking (m/s), `horizon` how many seconds ahead she brakes for (Amy long, Jess short), `distracted` that she isn't looking.
 */
export function towControls({ room, closing, slack, error, leaderSpeed, horizon, distracted }, p = DEFAULT_TOW_STEER_PARAMS) {
  if (distracted) return { throttle: 0, brake: 0, steer: 0 };
  const steer = steerFor(error, { driveSteerGain: p.steerGain });
  const ttc = closing > 0.05 ? Math.max(0, room) / closing : Infinity;
  let brake = clamp(1 - ttc / horizon, 0, 1);
  if (slack > 0 && closing > p.easeClosing) brake = Math.max(brake, p.easeBrake);
  if (leaderSpeed < p.holdSpeed && room < slack + 0.5) brake = Math.max(brake, p.holdBrake);
  return { throttle: 0, brake, steer };
}

export class TowSteer {
  /** @param {object} opts.horizon, opts.distractChance  Her habits: seconds ahead she brakes for, and the chance each second she looks away. */
  constructor(quad, rope, { params = { ...DEFAULT_TOW_STEER_PARAMS }, horizon = 1.8, distractChance = 0.02, random = Math.random } = {}) {
    this.quad = quad;
    this.rope = rope;
    this.p = params;
    this.horizon = horizon;
    this.distractChance = distractChance;
    this.random = random;
    this.controls = { throttle: 0, brake: 1, steer: 0, starter: false, reverse: false };
    this.phase = 'drive';
    this.done = false;
    this.result = null;
    this.towing = true;
    this.follow = null;
    this.park = null;
    this.race = null;
    this.events = [];
    this.distractLeft = 0;
    this.bumpWait = 0;
    this.lastRoom = null;
    this.alone = 0;
    this.started = false;
  }

  coachable() {
    return [];
  }

  isMoment() {
    return false;
  }

  endActivity() {}

  stop(reason = 'asked') {
    this.finish(reason);
  }

  finish(result) {
    if (this.done) return;
    this.done = true;
    this.result = result;
    this.controls.brake = 1;
    this.controls.steer = 0;
  }

  update(dt) {
    const out = this.events;
    out.length = 0;
    if (this.done) return out;
    const rope = this.rope;
    const q = this.quad;
    if (rope.state !== 'hooked' || rope.target !== q) {
      this.finish('unhooked');
      return out;
    }
    if (!this.started) {
      this.started = true;
      out.push('towStart');
    }
    const lead = rope.puller;
    this.alone = lead.rider || lead.driver ? 0 : this.alone + dt;
    if (this.alone > this.p.giveUpAfter) {
      this.finish('bored');
      return out;
    }
    this.bumpWait = Math.max(0, this.bumpWait - dt);
    if (this.distractLeft > 0) this.distractLeft -= dt;
    else if (this.random() < this.distractChance * dt) this.distractLeft = this.p.distractFor * (0.6 + this.random() * 0.8);

    const gap = rope.gap();
    const room = gap - this.p.clearance;
    const closing = this.lastRoom === null ? 0 : (this.lastRoom - room) / dt;
    this.lastRoom = room;
    const hitch = rope.pin();
    const error = angleDiff(q.yaw, headingTo(q.position, hitch));
    this.controls = {
      ...this.controls,
      ...towControls({ room, closing, slack: rope.length - gap, error, leaderSpeed: lead.speed ?? 0, horizon: this.horizon, distracted: this.distractLeft > 0 }, this.p),
    };
    if (room <= 0 && closing >= this.p.bumpClosing && this.bumpWait <= 0) {
      this.bumpWait = this.p.bumpCooldown;
      out.push('bump');
    }
    return out;
  }
}
