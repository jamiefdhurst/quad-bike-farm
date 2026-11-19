// Being turned round at the edge of the map, in the running game (#687): watches where you are (on foot or on any vehicle), and when you cross a junction's
// give-way line onto the A-road, or the lane's southern line, fades to black (the HUD's own fade), puts you and your vehicle, and anyone aboard, about 25 m
// back up the road you came along facing home, and fades back in. The girl with you says why; alone, you get one toast. The rules are world/turnRound.js.

import { TurnRound, turnRoundLines, DEFAULT_TURN_ROUND_PARAMS, TURN_ROUND_PARAM_RANGES } from './turnRound.js';
import { registerTuning } from '../core/tuning.js';
import { TURN_ROUND_TOAST, TURN_ROUND_MOOR_TOAST } from '../npc/turnRoundLines.js';

const WITH_YOU = 25; // m: a girl on foot this close is with you
const ABOARD = 6; // m: a girl this close to your vehicle is aboard or beside it

export class TurnRoundHost {
  constructor(game) {
    this.game = game;
    const layout = game.world.layout;
    this.params = { ...DEFAULT_TURN_ROUND_PARAMS };
    registerTuning('Turn round', this.params, TURN_ROUND_PARAM_RANGES);
    this.state = null;
    if (layout.turnRound) {
      const net = game.world.roads;
      const lines = turnRoundLines(net, layout.turnRound, layout.ground);
      this.state = new TurnRound({ net, lines, params: this.params });
    }
    this.last = 'nothing yet';
  }

  /** Where you are: your vehicle's place if you are on one (any seat), else your feet. */
  position() {
    const p = this.game.player;
    const v = p.isRiding ? p.vehicle : null;
    return v ? { x: v.position.x, z: v.position.z, vehicle: v } : { x: p.position.x, z: p.position.z, vehicle: null };
  }

  /** Each frame. */
  update(dt) {
    if (!this.state) return;
    const g = this.game;
    const here = this.position();
    const r = this.state.update(dt, here);
    if (r.started) this.start(r.line, here);
    if (r.move) this.move(r.move, here.vehicle);
    if (this.state.busy || r.done) g.hud.setFade(r.fade); // not while idle: the romance's cut-away has the fade then
    if (r.done) this.last = `${r.line?.id ?? 'road'} at ${new Date().toLocaleTimeString()}`;
  }

  /** The girl with you says why, or, alone, a toast. */
  start(line, here) {
    const g = this.game;
    const where = here.vehicle ? here.vehicle.position : g.player.position;
    const near = g.companions
      .map((c) => ({ c, d: Math.hypot(c.root.position.x - where.x, c.root.position.z - where.z) }))
      .filter(({ c, d }) => (here.vehicle ? (c.quad === here.vehicle || d < ABOARD) : d < WITH_YOU) && c.voice)
      .sort((a, b) => a.d - b.d);
    const key = line.id === 'lane-south' ? 'turnRoundSouth' : line.id === 'moor-stile' ? 'turnRoundMoor' : 'turnRound';
    if (near.length) near[0].c.voice.say(key, { urgent: true, force: true });
    else g.hud.toast(line.id === 'moor-stile' ? TURN_ROUND_MOOR_TOAST : TURN_ROUND_TOAST, 3);
  }

  /** Puts you (and your vehicle, with anyone aboard) at `to`, facing its `yaw`, stopped. */
  move(to, vehicle) {
    const g = this.game;
    if (vehicle) {
      vehicle.placeAt(to.x, to.z, to.yaw);
    } else {
      const y = g.world.groundHeightAt(to.x, to.z) + 0.5;
      g.player.moveTo({ x: to.x, y, z: to.z });
      g.player.yaw = to.yaw - Math.PI;
    }
  }

  /** The debug panel's and console's way in: the fade and the put-back at the line nearest you, with the girl's line or the toast, as if you had crossed it. */
  debugStart() {
    if (!this.state) return false;
    const here = this.position();
    const nearest = this.state.lines.reduce((best, l) => (Math.hypot(l.point.x - here.x, l.point.z - here.z) < Math.hypot(best.point.x - here.x, best.point.z - here.z) ? l : best));
    if (!this.state.force(nearest, here, here)) return false;
    this.start(nearest, here);
    return true;
  }

  /** One line for the console's `turnround`. */
  describe() {
    if (!this.state) return 'no A-road on this farm: nothing turns you round';
    return `${this.state.lines.length} lines; ${this.state.busy ? `turning you round (${this.state.line?.id ?? 'road'})` : 'idle'}; last: ${this.last}`;
  }
}
