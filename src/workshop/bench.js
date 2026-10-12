import './bench.css';
import * as THREE from 'three';
import { registerTuning } from '../core/tuning.js';
import { DEFAULT_BENCH_PARAMS, BENCH_PARAM_RANGES, JOBS, JOB_KINDS, BenchJob, finishJob, jobAvailable, inBay, plugCondition, readPlug, scoringLook, chainLook, valvesLook } from './benchJobs.js';

/**
 * The barn bench: park a quad in the painted bay, switch it off and work on it here. Each job is a few
 * steps with E (tap or hold). Unlike the toolbox panel's quick fixes, a job done right puts the thing
 * properly right. The girls watch from wherever they are: Amy helps, Jess heckles.
 */
export class Bench {
  constructor(game) {
    this.game = game;
    this.params = { ...DEFAULT_BENCH_PARAMS };
    this.unit = null;
    this.job = null;
    this.dt = 1 / 60;
    registerTuning('Workshop bench', this.params, BENCH_PARAM_RANGES);
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

  /** The jobs listed for a quad: the barn find's own (the tarp, then what it needs), or the usual ones. */
  kindsFor(unit) {
    return unit.barnFind ? unit.barnFind.kinds : JOB_KINDS;
  }

  canBegin(kind, unit) {
    return unit.barnFind ? unit.barnFind.available(kind) : jobAvailable(kind, unit.engine, this.params, unit.quad.faults.hasChain, unit.quad.faults.hasValves);
  }

  toolboxHere() {
    const t = this.game.toolbox;
    const b = this.game.world.layout.bench;
    return !t.held && Math.hypot(t.model.position.x - b.x, t.model.position.z - b.z) < 2.5;
  }

  prompt() {
    if (!this.toolboxHere()) return { text: "The toolbox isn't on the bench" };
    const unit = this.unitInBay();
    if (!unit) return { text: 'Park a quad in the painted bay and switch it off to work on it here' };
    if (unit.engine.isRunning || unit.engine.state === 'cranking') return { text: `Switch the ${unit.label} off first` };
    return `Work on the ${unit.label} at the bench`;
  }

  open() {
    const unit = this.unitInBay();
    if (!unit || !this.toolboxHere() || unit.engine.isRunning || unit.engine.state === 'cranking') return;
    this.unit = unit;
    // A girl left a job half done for you to finish: it carries on from the step she got to.
    const left = this.game.girlBench.pendingFor(unit.id);
    this.job = left?.job ?? null;
    if (this.job) {
      this.job.holding = false;
      this.job.held = 0;
    }
    this.render();
    this.el.style.display = 'block';
    document.body.classList.add('bench-open');
    this.game.player.moveEnabled = false;
    if (!left) this.say(unit.engine.params.boreKit && !unit.engine.bore ? 'catalogue' : 'start');
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
    this.job = new BenchJob(kind, this.params);
    this.render();
  }

  /** Reacts to what a tap, hold or release did. */
  handle(events, inspected) {
    if (inspected && this.job?.kind === 'topEnd') {
      this.game.hud.toast(`The piston is ${scoringLook(this.unit.engine, this.params)}`);
    } else if (inspected && this.job?.kind === 'chain') {
      this.game.hud.toast(`The chain is ${chainLook(this.unit.quad.faults)}`);
    } else if (inspected && this.job?.kind === 'valves') {
      this.game.hud.toast(`The feeler gauge goes in ${valvesLook(this.unit.quad.faults)}`);
    } else if (inspected) {
      const reading = readPlug(this.unit.engine, this.params);
      this.game.hud.toast(`The old plug is ${plugCondition(this.unit.engine, this.params)}`);
      for (const c of this.game.companions) c.voice.onPlug?.(reading.kind);
      this.game.notebook.note(this.unit, { kind: 'plug', reading: reading.kind }, { by: 'you' });
    }
    for (const e of events) {
      if (e.type === 'flaw') this.say('flaw');
      else if (e.type === 'step') this.say('step');
      else if (e.type === 'done') {
        const job = this.job;
        const unit = this.unit;
        this.game.hud.toast(finishJob(job, { engine: unit.engine, faults: unit.quad.faults, fuel: unit.quad.fuel, tyres: unit.quad.tyres, sump: unit.quad.sump }, this.params));
        this.say(job.kind === 'bore' ? (job.botched ? 'boreBotched' : 'boreDone') : job.botched ? 'botched' : 'done');
        if (unit.barnFind) this.foundJobDone(unit, job.kind);
        this.game.notebook.note(unit, { kind: 'job', job: job.kind, botched: job.botched }, { by: 'you' });
        this.job = null;
        this.game.girlBenchFinished(job);
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
      this.kindsFor(this.unit).forEach((kind, i) => {
        const n = (i + 1) % 10; // the tenth job is on 0, the eleventh on the minus key, the twelfth on equals
        const hit = i >= 10 ? input.wasPressed(i === 10 ? 'Minus' : 'Equal') : input.wasPressed(`Digit${n}`) || input.wasPressed(`Numpad${n}`);
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
      this.bodyEl.innerHTML = this.kindsFor(unit).map((k, i) => {
        const ok = this.canBegin(k, unit);
        let note = '';
        if (find) note = find.isDone(k) ? ' ✓' : k === 'battery' && find.charging ? ` (charging: ${Math.round(find.chargeProgress * 100)}%)` : ok ? '' : ' (take the tarp off first)';
        else if (!ok) note = k === 'sump' ? ' (petrol four-strokes only)' : k === 'coolant' ? ' (water-cooled only)' : k === 'bore' ? (unit.engine.bore ? ' ✓ fitted' : ' (yellow only)') : k === 'chain' ? ' (chain-driven quads only)' : k === 'valves' ? ' (two-strokes have none)' : k === 'topEnd' ? (unit.engine.params.strokes === 2 ? ' (nothing wrong with it)' : ' (two-strokes only)') : ' (two-strokes only)';
        return `<div class="bn-row${ok ? '' : ' off'}"><span class="key">${i >= 10 ? (i === 10 ? '-' : '=') : (i + 1) % 10}</span>${JOBS[k].name}${note}</div>`;
      }).join('');
      this.keysEl.textContent = 'Press a number to start   ·   G step away';
      return;
    }
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
