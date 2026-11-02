import { MowBlade } from './mowing.js';

// The ride-on mower at work, as the game meets it (#76): the lever on T, what the blade asks of the engine, the stripes it cuts, the grit it
// throws on hard ground, the seat switch and the job ticked off the board. It takes the game as `game` and what it draws with as `view`, so a
// test can stand in for both (tests/mowHost.test.js). The rules themselves are in mowing.js.

const DECK_AHEAD = 0.1; // metres from the chassis' origin to the middle of the deck

export class MowHost {
  /** @param {object} game  units, jobBoard, farm (day), hud, audioHub, handsFull, saySomethingAboutJob
   *  @param {{grid: object, params: object, surfaceAt: Function, view: {update: Function, refresh: Function}}} o */
  constructor(game, { grid, params, surfaceAt, view }) {
    this.game = game;
    this.grid = grid;
    this.params = params;
    this.surfaceAt = surfaceAt;
    this.view = view;
    this.gritCool = 0; // seconds before a girl remarks on grit again
  }

  /** The ride-on mower (a spec with `mower: true`), if this farm has one. */
  get unit() {
    return this.game.units.find((u) => u.spec.mower) ?? null;
  }

  /** The mower's blade, made the first time it is wanted. */
  bladeOf(unit) {
    return (unit.quad.blade ??= new MowBlade(this.params));
  }

  /** T on the mower: the blade lever forward or back. It will only go forward with the engine running. */
  toggleBlade(unit) {
    const blade = this.bladeOf(unit);
    const running = unit.quad.engine.isRunning;
    const was = blade.engaged;
    blade.toggle(running);
    if (!running && !was) return this.game.hud.toast('The blade only turns with the engine running', 2);
    return this.game.audioHub.useCue('latch');
  }

  /** The blade at work: what it asks of the engine, the grass it cuts, the grit it throws, and the job. */
  update(dt, ridden, input) {
    const game = this.game;
    this.view.update(dt, game.farm.day);
    const unit = this.unit;
    if (!unit) return;
    const q = unit.quad;
    const blade = this.bladeOf(unit);
    const riding = ridden === unit;
    if (riding && input.wasPressed('KeyT') && !q.isTipped && !game.handsFull) this.toggleBlade(unit);
    if (!riding && blade.engaged) blade.engaged = false; // the seat switch: leave the seat and the blade stops
    const day = game.farm.day;
    const fx = Math.sin(q.yaw);
    const fz = Math.cos(q.yaw);
    const cx = q.position.x + fx * DECK_AHEAD;
    const cz = q.position.z + fz * DECK_AHEAD;
    const ground = this.surfaceAt(cx, cz);
    const out = blade.update(dt, { running: q.engine.isRunning, speed: q.forwardSpeed, hard: ground.grass < 0.5, grass: this.grid.longnessUnder(cx, cz, q.yaw, day) });
    q.pto.load = out.load;
    q.bladeDrive = out.drive;
    if (out.cutting && this.grid.cut(cx, cz, q.yaw, out.width, day) && game.jobBoard.has('mow') && this.grid.done(day)) this.finish();
    this.gritCool = Math.max(0, this.gritCool - dt);
    for (const e of out.events) {
      if (e.type !== 'grit') continue;
      game.audioHub.useCue('tap');
      if (this.gritCool <= 0 && riding) {
        game.saySomethingAboutJob('mowGrit', false, q.position);
        this.gritCool = 40;
      }
    }
  }

  /** The lawns are cut enough: tick the job off, and the girls say so. */
  finish() {
    const game = this.game;
    if (!game.jobBoard.complete('mow')) return;
    game.hud.toast('Lawns mown. Ticked off the board on the barn door', 3);
    game.saySomethingAboutJob('mowDone', false, this.unit?.quad.position);
  }

  cutAll() {
    this.grid.cutAll(this.game.farm.day);
    this.view.refresh(this.game.farm.day);
  }

  growBack() {
    this.grid.clear();
    this.view.refresh(this.game.farm.day);
  }

  finishNow() {
    this.cutAll();
    this.finish();
  }
}
