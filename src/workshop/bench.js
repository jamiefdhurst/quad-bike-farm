import './bench.css';
import * as THREE from 'three';
import { registerTuning } from '../core/tuning.js';
import { DEFAULT_BENCH_PARAMS, BENCH_PARAM_RANGES, JOBS, JOB_KINDS, BenchJob, finishJob, jobAvailable, inBay, plugCondition, readPlug } from './benchJobs.js';

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

  /** The quad parked in the bay, if there's one. */
  unitInBay() {
    const bay = this.game.world.layout.bay;
    return this.game.girlUnits.find((u) => !u.quad.driver && inBay(bay, u.quad.position.x, u.quad.position.z, this.params.bayMargin)) ?? null;
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
    this.job = null;
    this.render();
    this.el.style.display = 'block';
    document.body.classList.add('bench-open');
    this.game.player.moveEnabled = false;
    this.say('start');
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
    if (!jobAvailable(kind, this.unit.engine)) return;
    this.job = new BenchJob(kind, this.params);
    this.render();
  }

  /** Reacts to what a tap, hold or release did. */
  handle(events, inspected) {
    if (inspected) {
      const reading = readPlug(this.unit.engine, this.params);
      this.game.hud.toast(`The old plug is ${plugCondition(this.unit.engine, this.params)}`);
      for (const c of this.game.companions) c.voice.onPlug?.(reading.kind);
    }
    for (const e of events) {
      if (e.type === 'flaw') this.say('flaw');
      else if (e.type === 'step') this.say('step');
      else if (e.type === 'done') {
        const job = this.job;
        const unit = this.unit;
        this.game.hud.toast(finishJob(job, { engine: unit.engine, faults: unit.quad.faults, fuel: unit.quad.fuel, tyres: unit.quad.tyres }, this.params));
        this.say(job.botched ? 'botched' : 'done');
        this.job = null;
      }
    }
    if (events.length) this.render();
  }

  /** Keys while it's open: 1 to 4 pick a job, E does the steps, G steps away. */
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
      JOB_KINDS.forEach((kind, i) => {
        if (input.wasPressed(`Digit${i + 1}`) || input.wasPressed(`Numpad${i + 1}`)) this.begin(kind);
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
      this.bodyEl.innerHTML = JOB_KINDS.map((k, i) => {
        const ok = jobAvailable(k, unit.engine);
        return `<div class="bn-row${ok ? '' : ' off'}"><span class="key">${i + 1}</span>${JOBS[k].name}${ok ? '' : ' (two-strokes only)'}</div>`;
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
