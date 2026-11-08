// The farm jobs on the barn door's board in the running game: ticking one off (and the toast, the board's redraw and the achievement that go
// with it), the muck job's fork, spread and debug buttons, the log and silage jobs' finishes, the service job and the girls' remarks about a
// job (world/farmJobs.js, workshop/service.js, npc/farmJobLines.js). game.js builds this as `this.farmJobs`; the board, the muck and the
// service job themselves stay on the game for the rest of the code to read.

import { createRandom } from '../core/random.js';
import { shortName } from '../workshop/logbook.js';
import { ServiceJob, pickServiceJob, serviceChalk, servicePlan, factsOf, stateOf } from '../workshop/service.js';

export class FarmJobsHost {
  constructor(game) {
    this.g = game;
    this.muckWrongCool = 0; // seconds before the "not here" toast can come again
  }

  /** Ticks a job off the board if it is on today: a toast, the board redrawn and `boardCleared` if that was the last. False if it wasn't on it. */
  tickOff(id, message, seconds = 3) {
    const g = this.g;
    if (!g.jobBoard.complete(id)) return false;
    g.hud.toast(message, seconds);
    g.jobBoardView.refresh();
    if (g.jobBoard.cleared) g.achievements.note('boardCleared');
    return true;
  }

  /** One girl, the nearest who is free to remark (or the other one), says a line about the job. */
  say(key, other = false, at = this.g.tipTrailer.model.position) {
    const ranked = this.g.companions
      .filter((c) => c.availability().canRemark && c.root.position.distanceTo(at) < 30)
      .sort((a, b) => a.root.position.distanceTo(at) - b.root.position.distanceTo(at));
    ranked[other ? ranked.length - 1 : 0]?.voice.say(key);
  }

  // The muck ----------------------------------------------------------------------

  canForkMuck() {
    const g = this.g;
    const m = g.tipTrailer.motion;
    return !g.heldLoad() && g.muck.canFork(g.world.layout.muckHeap, m.x, m.z, g.tipTrailer.bed.tip) && !g.player.isRiding;
  }

  /** Holding E at the trailer by the heap: fork muck in, the girls remark as the job starts and as the tub fills. */
  forkMuck(dt) {
    if (!this.canForkMuck()) return false;
    for (const e of this.g.muck.fork(dt)) {
      if (e.type === 'start') this.say('muckStart');
      else if (e.type === 'full') this.say('muckFull', true);
    }
    this.g.muckView.setLoad(this.g.muck.load);
    return true;
  }

  /** The muck in the tub and what it leaves: patches behind the tub on the stubble (world/farmJobs.js). */
  updateMuck(dt) {
    const g = this.g;
    const t = g.tipTrailer;
    this.muckWrongCool = Math.max(0, this.muckWrongCool - dt);
    const yaw = t.model.rotation.y;
    // Muck leaves over the tailgate, a little behind the axle.
    const x = t.motion.x - Math.sin(yaw) * 1.2;
    const z = t.motion.z - Math.cos(yaw) * 1.2;
    const onStubble = g.world.fields.stubbleAt(x, z) > 0.5;
    const events = g.muck.update(dt, { x, z, speed: Math.abs(t.signedSpeed), tip: t.bed.tip, slideAt: t.bed.p.slideAt, onStubble });
    for (const e of events) {
      if (e.type === 'patch') g.muckView.lay(e.x, e.z);
      else if (e.type === 'pile') {
        g.muckView.lay(e.x, e.z, 1.3);
        g.hud.toast('The lot slid out in a heap', 2);
      } else if (e.type === 'wrong') {
        g.muckView.lay(e.x, e.z, 0.5);
        if (this.muckWrongCool <= 0) {
          g.hud.toast('Spread it on the stubble, not here', 2);
          this.muckWrongCool = 6;
        }
      } else if (e.type === 'done') this.finishMuck();
    }
    if (events.length) g.muckView.setLoad(g.muck.load);
  }

  /** Debug panel and console: set how full the tub is. */
  debugSetMuck(load) {
    const g = this.g;
    g.muck.load = Math.max(0, Math.min(1, load));
    g.muck.started = g.muck.load > 0;
    g.muckView.setLoad(g.muck.load);
  }

  debugFillMuck() {
    this.debugSetMuck(1);
    this.g.hud.toast('The tub is full of muck: tip it a little and drive slowly over the stubble', 3);
  }

  debugFinishMuck() {
    const m = this.g.muck;
    m.done = true;
    m.laid = Math.max(m.laid, this.g.muckParams.patchesNeeded);
    this.finishMuck();
  }

  debugResetMuck() {
    this.g.muck.reset();
    this.g.muckView.setLoad(0);
    this.g.muckView.clear();
  }

  /** The strip is down: tick it off the board. */
  finishMuck() {
    this.g.achievements.note('muckSpread');
    this.tickOff('muck', 'Muck spread. Ticked off the board on the barn door');
    this.say('muckDone');
  }

  // The logs and the silage ---------------------------------------------------------

  finishLogs() {
    this.tickOff('logs', 'Logs stacked. Ticked off the board on the barn door');
  }

  debugFinishLogs() {
    const g = this.g;
    if (!g.logStack) return;
    while (!g.logStack.jobComplete && !g.logStack.full) g.logStack.add();
    g.stackView.set(g.logStack.count);
    if (g.jobBoard.has('logs')) this.finishLogs();
  }

  /** A bale has been left: if that brings the silage job's bales into the Dutch barn, tick it off. */
  baleSettled() {
    const g = this.g;
    if (!g.siloRect || !g.jobBoard.has('silage') || g.jobBoard.finished.has('silage')) return;
    if (g.baleRig.yard.countIn(g.siloRect) < g.spikeParams.balesNeeded) return;
    this.finishSilage();
  }

  finishSilage() {
    this.g.achievements.note('silageMoved');
    this.tickOff('silage', 'Silage in. Ticked off the board on the barn door');
    this.saySomethingAboutBale('silageDone');
  }

  /** One of the girls near the tractor says something about the bales (npc/farmJobLines.js). */
  saySomethingAboutBale(key) {
    const g = this.g;
    const at = g.tractorUnit.quad.model.position;
    const c = g.companions
      .filter((girl) => girl.availability().canRemark && girl.root.position.distanceTo(at) < 30)
      .sort((a, b) => a.root.position.distanceTo(at) - b.root.position.distanceTo(at))[0];
    c?.voice.say(key);
  }

  debugFinishSilage() {
    if (this.g.tractorUnit) this.finishSilage();
  }

  // The service ------------------------------------------------------------------

  /** A quad in a bad way: a full or partial service goes on the board for the day, on top of the other jobs (workshop/service.js). */
  setUpServiceJob() {
    const g = this.g;
    g.serviceJob = null;
    const quads = g.units
      .filter((u) => !u.barnFind && u.quad.faults && u.engine)
      .map((u) => ({ id: u.id, name: shortName(u.name), plan: servicePlan(factsOf(u)), state: stateOf(u) }));
    const pick = pickServiceJob(quads, createRandom(g.seed ^ 0x5e71), g.bench?.serviceParams);
    if (!pick) return;
    g.serviceJob = new ServiceJob(pick);
    g.jobBoard.add(`service:${pick.id}`, {
      chalk: serviceChalk(pick),
      hint: pick.full ? 'Do a full service at the bench: press S on the bench menu' : `At the bench: ${pick.kinds.join(', ')}`,
    });
  }

  /** A bench job is finished on a vehicle: it counts towards a service on the board. */
  serviceJobNoted(unit, kind, botched) {
    const job = this.g.serviceJob;
    if (!job || !job.note(unit.id, kind, botched)) return;
    this.tickOff(`service:${job.id}`, 'Service done: ticked off the board', 4);
  }

  /** The debug panel and console: every step of the service on the board is done, clean, and the board ticks it off. */
  debugFinishService() {
    const job = this.g.serviceJob;
    if (!job) return 'There is no service job on the board';
    for (const kind of [...job.left]) this.serviceJobNoted({ id: job.id }, kind, false);
  }
}
