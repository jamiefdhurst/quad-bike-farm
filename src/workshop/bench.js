import './bench.css';
import * as THREE from 'three';
import { PARTS } from './spares.js';
import { SHED_JOBS, SHED_JOB_KINDS, shedJobWhyNot, shedLook } from './shedJobs.js';
import { registerTuning } from '../core/tuning.js';
import { DEFAULT_SERVICE_PARAMS, SERVICE_PARAM_RANGES, ServiceRun, servicePlan, factsOf, stateOf, dueBook, applyServiceReward } from './service.js';
import { DEFAULT_BENCH_PARAMS, BENCH_PARAM_RANGES, JOBS, JOB_KINDS, BenchJob, finishJob, jobAvailable, jobPart, tyreJobFor, inBay, plugCondition, readPlug, scoringLook, chainLook, bootLook, clutchLook, valvesLook, crashLook } from './benchJobs.js';

// The jobs after the tenth (which is on 0) have the keys beside it.
const OVERFLOW_KEYS = [
  { code: 'Minus', label: '-' },
  { code: 'Equal', label: '=' },
  { code: 'BracketLeft', label: '[' },
  { code: 'BracketRight', label: ']' },
  { code: 'Semicolon', label: ';' },
  { code: 'Quote', label: "'" },
  { code: 'Period', label: '.' },
];

/**
 * The barn bench: park a vehicle in a painted bay (the small one for the quads, the big one in the second span for everything else), switch it off and work on it here. Each job is a few
 * steps with E (tap or hold). Unlike the toolbox panel's quick fixes, a job done right puts the thing
 * properly right. The girls watch from wherever they are: Amy helps, Jess heckles.
 */
export class Bench {
  constructor(game) {
    this.game = game;
    this.params = { ...DEFAULT_BENCH_PARAMS };
    this.unit = null;
    this.job = null;
    this.page = 0; // 0 the usual jobs, 1 the ones that need the shed kit (R turns the page)
    this.dt = 1 / 60;
    this.serviceParams = { ...DEFAULT_SERVICE_PARAMS };
    this.services = new Map(); // unit id -> the full service under way on it (it carries on if you step away and come back)
    registerTuning('Workshop bench', this.params, BENCH_PARAM_RANGES);
    registerTuning('Service', this.serviceParams, SERVICE_PARAM_RANGES);
    // Something to look at to start work: a box over the bench top.
    const b = game.world.layout.bench;
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(b.length, 0.5, b.depth + 0.4), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.set(b.x, game.world.heightAt(b.x, b.z) + b.height + 0.2, b.z + 0.1);
    game.scene.add(this.proxy);
    this.build();
  }

  get isOpen() {
    return !!this.unit;
  }

  /** The quad parked in the bay, if there's one. Failing that, the barn find: it can't be driven, so it's worked on where it stands. */
  unitInBay() {
    const bay = this.game.world.layout.bay;
    const parked = this.game.girlUnits.find((u) => !u.quad.driver && inBay(bay, u.quad.position.x, u.quad.position.z, this.params.bayMargin));
    const rusty = this.game.rustyUnit;
    return parked ?? (rusty && !rusty.barnFind.ready ? rusty : null);
  }

  /** What the bench works on: the quad in the small bay (or the barn find), else whatever is in the big bay in the barn's second span: any vehicle, since it is
   *  the one bay the tractor, UTV, Land Rovers and cars fit. The girls only ever work on the small bay (unitInBay). */
  unitAtBench() {
    const inBig = this.game.world.layout.bay2;
    const big = inBig && this.game.units.find((u) => !u.barnFind && !u.quad.driver && !u.quad.rider && inBay(inBig, u.quad.position.x, u.quad.position.z, this.params.bayMargin));
    return this.unitInBay() ?? big ?? null;
  }

  /** The jobs listed for a quad: the barn find's own (the tarp, then what it needs), or the usual ones. */
  kindsFor(unit) {
    if (this.page === 1) return SHED_JOB_KINDS;
    const charger = unit.engine.batteryOut ? 'chargeOff' : 'chargeOn';
    return unit.barnFind ? [...unit.barnFind.kinds, ...(unit.engine.params.noStarter ? [] : [charger])] : [...JOB_KINDS, charger];
  }

  /** What fitting new tyres to this vehicle takes: { part, count, axle }, or null while its tyres are not worn enough. */
  tyreJob(unit) {
    return tyreJobFor(unit.quad.tyres, unit.spec.tyreSize);
  }

  /** The part a job uses on this vehicle, and how many: new tyres are the vehicle's own size and an axle's worth. */
  partFor(kind, unit = this.unit) {
    if (kind === 'newTyres') {
      const t = unit && this.tyreJob(unit);
      return t ? { part: t.part, count: t.count } : null;
    }
    const part = jobPart(kind);
    return part ? { part, count: 1 } : null;
  }

  /** The shelf has the part the job fits (a job with no part always has it). */
  partOk(kind, unit = this.unit) {
    const need = this.partFor(kind, unit);
    return !need || this.game.spares.count(need.part) >= need.count;
  }

  /** A battery job needs your hands: out wants them empty, back in wants this quad's battery in them. */
  batteryHandsOk(kind, unit) {
    if (kind === 'chargeOn') return !this.game.handsFull;
    if (kind === 'chargeOff') return this.game.heldBattery()?.unitId === unit.id;
    return true;
  }

  /** Why a shed-kit job can't be done on this vehicle now, or null if it can. */
  shedWhyNot(kind, unit) {
    const g = this.game;
    const day = g.farm.day;
    const piece = SHED_JOBS[kind]?.piece;
    if (piece && g.shed.onTheWay(piece, day)) return 'turns up tomorrow morning';
    const e = unit.engine;
    return shedJobWhyNot(kind, {
      have: (p) => g.shed.has(p, day),
      atPit: inBay(g.world.layout.bay2, unit.quad.position.x, unit.quad.position.z, this.params.bayMargin),
      hasCarb: !e.params.compressionIgnition && !e.params.injected,
      hasChain: !!unit.quad.faults.hasChain,
      hasSump: !!unit.quad.sump,
    });
  }

  canBegin(kind, unit) {
    if (kind in SHED_JOBS) return !this.shedWhyNot(kind, unit);
    if ((kind === 'filter' || kind === 'belt') && !servicePlan(factsOf(unit)).includes(kind)) return false;
    if (kind === 'newTyres' && !this.tyreJob(unit)) return false;
    return this.partOk(kind, unit) && this.batteryHandsOk(kind, unit) && (unit.barnFind && kind !== 'chargeOn' && kind !== 'chargeOff' ? unit.barnFind.available(kind) : unit.barnFind && !unit.barnFind.tarpOff ? false : jobAvailable(kind, unit.engine, this.params, unit.quad.faults.hasChain, unit.quad.faults.hasValves, unit.quad.faults.hasClutch));
  }

  toolboxHere() {
    const t = this.game.toolbox;
    const b = this.game.world.layout.bench;
    return !t.held && Math.hypot(t.model.position.x - b.x, t.model.position.z - b.z) < 2.5;
  }

  prompt() {
    if (!this.toolboxHere()) return { text: "The toolbox isn't on the bench" };
    const unit = this.unitAtBench();
    if (!unit) return { text: 'Park a vehicle in a painted bay and switch it off to work on it here' };
    if (unit.engine.isRunning || unit.engine.state === 'cranking') return { text: `Switch the ${unit.label} off first` };
    return `Work on the ${unit.label} at the bench`;
  }

  open() {
    const unit = this.unitAtBench();
    if (!unit || !this.toolboxHere() || unit.engine.isRunning || unit.engine.state === 'cranking') return;
    this.unit = unit;
    // A girl left a job half done for you to finish: it carries on from the step she got to.
    const left = this.game.girlBench.pendingFor(unit.id);
    this.job = left?.job ?? null;
    if (this.job) {
      this.job.holding = false;
      this.job.held = 0;
    }
    this.page = 0;
    this.render();
    this.el.style.display = 'block';
    document.body.classList.add('bench-open');
    this.game.player.moveEnabled = false;
    if (!left) this.say(unit.engine.params.boreKit && !unit.engine.bore ? 'catalogue' : !unit.barnFind && dueBook(stateOf(unit), this.serviceParams) ? 'serviceDue' : 'start');
  }

  close() {
    if (!this.unit) return;
    this.unit = null;
    this.job = null;
    this.el.style.display = 'none';
    document.body.classList.remove('bench-open');
    this.game.player.moveEnabled = true;
  }

  say(kind) {
    for (const c of this.game.companions) c.voice.onBench?.(kind);
  }

  begin(kind) {
    if (!this.canBegin(kind, this.unit)) return;
    this.job = new BenchJob(kind, this.params, this.game.spares, kind === 'newTyres' ? this.tyreJob(this.unit) : null);
    this.render();
  }

  // A full service ----------------------------------------------------------

  /** The service Amy would do on this quad: its plan, or null where the bench can't (the barn find has to be got running first). */
  servicePlanFor(unit) {
    return unit.barnFind ? [] : servicePlan(factsOf(unit));
  }

  /** S on the menu: starts a full service, or carries on with the one already under way. */
  startService() {
    const unit = this.unit;
    const plan = this.servicePlanFor(unit);
    if (!unit || !plan.length) return;
    if (!this.services.has(unit.id)) this.services.set(unit.id, new ServiceRun(unit.id, plan));
    this.beginNextService();
  }

  /** Starts the next job of the full service, or says what is stopping it. */
  beginNextService() {
    const run = this.services.get(this.unit.id);
    const kind = run?.next;
    if (!kind) return;
    if (!this.canBegin(kind, this.unit)) {
      this.game.hud.toast(!this.partOk(kind) ? `The service wants ${PARTS[this.partFor(kind).part].one} and there is none on the shelf: order one from the parts rack` : `The ${JOBS[kind].name.toLowerCase()} can't be done on this one`);
      this.render();
      return;
    }
    this.begin(kind);
    if (this.job) {
      this.job.service = true;
      this.render();
    }
  }

  /** A job from a full service is finished: tick it off, and either start the next or finish the service. */
  serviceStepDone(unit, kind, botched) {
    const run = this.services.get(unit.id);
    if (!run) return;
    run.record(kind, botched);
    if (!run.finished) {
      this.beginNextService();
      return;
    }
    this.services.delete(unit.id);
    const took = applyServiceReward(unit.engine, unit.spec.roughnessRange?.[0], run, this.serviceParams);
    this.game.hud.toast(run.clean ? (took > 0 ? 'Full service done: it runs noticeably smoother' : 'Full service done: it was already running as sweetly as it can') : 'Full service done, though not everything was done well', 4);
    this.game.notebook.note(unit, { kind: 'job', job: 'service', botched: !run.clean }, { by: 'you' });
    this.say(run.clean ? 'serviceDone' : 'botched');
  }

  /** Reacts to what a tap, hold or release did. */
  handle(events, inspected) {
    if (inspected && this.job?.kind in SHED_JOBS) {
      this.game.hud.toast(`${this.job.kind === 'pressures' ? '' : 'Looking it over: '}${shedLook(this.job.kind, this.unit.quad.faults, this.unit.quad.tyres)}`);
    } else if (inspected && this.job?.kind === 'topEnd') {
      this.game.hud.toast(`The piston is ${scoringLook(this.unit.engine, this.params)}`);
    } else if (inspected && this.job?.kind === 'chain') {
      this.game.hud.toast(`The chain is ${chainLook(this.unit.quad.faults)}`);
    } else if (inspected && this.job?.kind === 'crash') {
      this.game.hud.toast(`Looking it over: ${crashLook(this.unit.quad.faults)}`);
    } else if (inspected && this.job?.kind === 'clutch') {
      this.game.hud.toast(`The plates: ${clutchLook(this.unit.quad.faults)}`);
    } else if (inspected && this.job?.kind === 'boot') {
      this.game.hud.toast(`The spray: ${bootLook(this.unit.quad.faults)}`);
    } else if (inspected && this.job?.kind === 'valves') {
      this.game.hud.toast(`The feeler gauge goes in ${valvesLook(this.unit.quad.faults)}`);
    } else if (inspected) {
      const reading = readPlug(this.unit.engine, this.params);
      this.game.hud.toast(`The old plug is ${plugCondition(this.unit.engine, this.params)}`);
      for (const c of this.game.companions) c.voice.onPlug?.(reading.kind);
      this.game.notebook.note(this.unit, { kind: 'plug', reading: reading.kind }, { by: 'you' });
    }
    for (const e of events) {
      if (e.type === 'noPart') this.game.hud.toast(`No ${PARTS[e.part].one} left on the shelf: order one from the parts rack`);
      else if (e.type === 'flaw') this.say('flaw');
      else if (e.type === 'step') this.say('step');
      else if (e.type === 'done') {
        const job = this.job;
        const unit = this.unit;
        this.game.hud.toast(finishJob(job, { engine: unit.engine, faults: unit.quad.faults, fuel: unit.quad.fuel, tyres: unit.quad.tyres, sump: unit.quad.sump, filter: unit.quad.filter, batteryOut: () => this.game.batteryOut(unit), batteryIn: () => this.game.batteryIn(unit) }, this.params));
        if (!job.service) this.say(job.kind === 'bore' ? (job.botched ? 'boreBotched' : 'boreDone') : job.botched ? 'botched' : 'done');
        if (unit.barnFind) this.foundJobDone(unit, job.kind);
        this.game.notebook.note(unit, { kind: 'job', job: job.kind, botched: job.botched }, { by: 'you' });
        this.job = null;
        this.game.girlBenchFinished(job);
        this.game.serviceJobNoted(unit, job.kind, job.botched);
        if (job.service) this.serviceStepDone(unit, job.kind, job.botched);
      }
    }
    if (events.length) this.render();
  }

  /** A job on the barn find is finished: the girls say something about the tarp coming off. */
  foundJobDone(unit, kind) {
    unit.barnFind.finish(kind);
    if (kind === 'tarp') for (const c of this.game.companions) c.voice.onBench?.('tarp');
  }

  /** Keys while it's open: the numbers pick a job, E does the steps, G steps away. */
  handleInput(input) {
    if (!this.unit) return;
    this.game.player.moveEnabled = false;
    input.takeWheelSteps();
    if (input.wasPressed('KeyG') || input.wasPressed('Escape')) {
      this.close();
      return;
    }
    const job = this.job;
    if (!job) {
      if (input.wasPressed('KeyS') && this.page === 0) this.startService();
      if (input.wasPressed('KeyR')) {
        this.page = 1 - this.page;
        this.render();
        return;
      }
      this.kindsFor(this.unit).forEach((kind, i) => {
        const n = (i + 1) % 10; // the tenth job is on 0, the eleventh on the minus key, the twelfth on equals, the thirteenth on the left bracket, the fourteenth on the right, the fifteenth on the semicolon, the sixteenth on the quote
        const hit = i >= 10 ? input.wasPressed(OVERFLOW_KEYS[i - 10].code) : input.wasPressed(`Digit${n}`) || input.wasPressed(`Numpad${n}`);
        if (hit) this.begin(kind);
      });
      return;
    }
    const step = job.step;
    if (step.kind === 'press' && input.wasPressed('KeyE')) this.handle(job.press(), step.inspect);
    else if (step.kind === 'hold') {
      if (input.wasPressed('KeyE')) job.startHold();
      if (job.holding && input.isDown('KeyE')) this.handle(job.update(this.dt));
      else if (job.holding) this.handle(job.releaseHold());
      this.paintHold();
    }
  }

  update(dt) {
    this.dt = dt;
    const unit = this.unit;
    if (!unit) return;
    if (unit.engine.isRunning || unit.quad.speed > 1 || this.game.player.isRiding) {
      this.close();
      this.game.hud.toast('Bench work stopped');
    }
  }

  // DOM ------------------------------------------------------------------

  build() {
    const el = document.createElement('div');
    el.className = 'bench';
    el.style.display = 'none';
    el.innerHTML = '<div class="bn-card"><div class="bn-title"></div><div class="bn-body"></div><div class="bn-hold"><div class="bn-window"></div><div class="bn-fill"></div></div><div class="bn-keys"></div></div>';
    document.body.appendChild(el);
    this.el = el;
    this.titleEl = el.querySelector('.bn-title');
    this.bodyEl = el.querySelector('.bn-body');
    this.holdEl = el.querySelector('.bn-hold');
    this.fillEl = el.querySelector('.bn-fill');
    this.windowEl = el.querySelector('.bn-window');
    this.keysEl = el.querySelector('.bn-keys');
  }

  /** The last row of the menu: the full service, with how far it has got. */
  serviceRow(unit) {
    const plan = this.servicePlanFor(unit);
    if (!plan.length) return '';
    const run = this.services.get(unit.id);
    const list = plan.map((k, i) => (run && i < run.results.length ? `✓ ${JOBS[k].name}` : JOBS[k].name)).join(', ');
    return `<div class="bn-row"><span class="key">S</span>${run ? 'Carry on with the full service' : 'Full service'}<div class="bn-sub">${list}</div></div>`;
  }

  /** The second page: the jobs that need the compressor, the parts washer and the pit, each with why not when it can't be done. */
  renderShed(unit) {
    this.bodyEl.innerHTML = SHED_JOB_KINDS.map((k, i) => {
      const why = this.shedWhyNot(k, unit);
      return `<div class="bn-row${why ? ' off' : ''}"><span class="key">${i >= 10 ? OVERFLOW_KEYS[i - 10].label : (i + 1) % 10}</span>${SHED_JOBS[k].name}${why ? ` (${why})` : ''}</div>`;
    }).join('');
    this.keysEl.textContent = 'Press a number to start   ·   R back to the usual jobs   ·   G step away';
  }

  /** The hold meter: the fill climbs, and where a window is, the green band is where to let go. */
  paintHold() {
    const job = this.job;
    if (!job) return;
    this.fillEl.style.width = `${Math.round(job.progress * 100)}%`;
  }

  render() {
    const unit = this.unit;
    if (!unit) return;
    this.titleEl.textContent = `Workbench   ·   ${unit.name}`;
    const job = this.job;
    if (!job) {
      this.holdEl.style.display = 'none';
      const find = unit.barnFind;
      if (this.page === 1) return this.renderShed(unit);
      this.bodyEl.innerHTML = this.kindsFor(unit).map((k, i) => {
        const ok = this.canBegin(k, unit);
        let note = '';
        const lacking = !this.partOk(k, unit);
        if (find) note = find.isDone(k) ? ' ✓' : ok ? '' : k === 'chargeOn' ? (find.tarpOff ? ' (empty your hands first)' : ' (take the tarp off first)') : k === 'chargeOff' ? ' (carry its battery here first)' : ' (take the tarp off first)';
        else if (lacking) {
          const need = this.partFor(k, unit);
          note = k === 'newTyres' ? ` (needs ${need.count} ${need.count === 1 ? PARTS[need.part].one : PARTS[need.part].many} from the tyre rack)` : ` (no ${PARTS[need.part].one} on the shelf)`;
        }
        else if (!ok) note = k === 'chargeOn' ? (unit.engine.params.noStarter ? ' (no battery to take out)' : ' (empty your hands first)') : k === 'chargeOff' ? ' (carry its battery here first)' : k === 'newTyres' ? ' (the tread is fine)' : k === 'sump' ? ' (petrol four-strokes only)' : k === 'coolant' ? ' (water-cooled only)' : k === 'bore' ? (unit.engine.bore ? ' ✓ fitted' : ' (yellow only)') : k === 'chain' ? ' (chain-driven quads only)' : k === 'valves' ? ' (two-strokes have none)' : k === 'topEnd' ? (unit.engine.params.strokes === 2 ? ' (nothing wrong with it)' : ' (two-strokes only)') : ' (two-strokes only)';
        return `<div class="bn-row${ok ? '' : ' off'}"><span class="key">${i >= 10 ? OVERFLOW_KEYS[i - 10].label : (i + 1) % 10}</span>${JOBS[k].name}${note}</div>`;
      }).join('') + this.serviceRow(unit) + '<div class="bn-row"><span class="key">R</span>Jobs that need the shed kit<div class="bn-sub">Compressor, parts washer and the pit</div></div>';
      this.keysEl.textContent = 'Press a number to start   ·   R the shed kit   ·   G step away';
      return;
    }
    const run = job.service ? this.services.get(unit.id) : null;
    if (run) this.titleEl.textContent = `Workbench   ·   ${unit.name}   ·   Service ${run.results.length + 1} of ${run.kinds.length}`;
    this.bodyEl.innerHTML = job.def.steps
      .map((s, i) => `<div class="bn-step ${i < job.index ? 'done' : i === job.index ? 'now' : ''}">${i < job.index ? '✓' : i + 1}  ${s.text}</div>`)
      .join('');
    const s = job.step;
    this.holdEl.style.display = s.kind === 'hold' ? 'block' : 'none';
    if (s.kind === 'hold') {
      const end = job.limitSeconds || job.needSeconds;
      this.windowEl.style.display = s.limit ? 'block' : 'none';
      this.windowEl.style.left = `${Math.round((job.needSeconds / end) * 100)}%`;
      this.windowEl.style.width = `${100 - Math.round((job.needSeconds / end) * 100)}%`;
      this.fillEl.style.width = '0%';
    }
    this.keysEl.textContent = s.kind === 'press' ? 'E do it   ·   G step away' : s.limit ? 'Hold E, and let go in the green   ·   G step away' : 'Hold E until it is done   ·   G step away';
  }
}
