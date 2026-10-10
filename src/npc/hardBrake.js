// Whether you braked hard with her on the back. Not a quick dab: the quad has to keep slowing hard (over `decel` m/s^2, already
// smoothed) for `time` seconds and have shed `shed` m/s since it started, from above `minSpeed`. It counts once per stop: the
// slowing has to ease off before another one can. Pure; companionVoice.js feeds it each frame and says hardBrake when it fires.

export class HardBrake {
  constructor() {
    this.reset();
  }

  reset() {
    this.hardFor = 0; // seconds it has been slowing hard
    this.from = 0; // the speed when it started
    this.counted = false;
  }

  /**
   * One frame: `decel` m/s^2 (smoothed, positive slowing), `speed` m/s now. `p` holds voiceHardBrakeDecel, voiceHardBrakeTime,
   * voiceHardBrakeShed and voiceHardBrakeMinSpeed. True on the frame it becomes a hard brake.
   */
  update(dt, decel, speed, p) {
    if (decel <= p.voiceHardBrakeDecel) {
      this.reset();
      return false;
    }
    if (this.hardFor === 0) this.from = speed + decel * dt; // the speed before this frame's slowing
    this.hardFor += dt;
    if (this.counted || this.from <= p.voiceHardBrakeMinSpeed) return false;
    if (this.hardFor >= p.voiceHardBrakeTime && this.from - speed >= p.voiceHardBrakeShed) return (this.counted = true);
    return false;
  }
}
