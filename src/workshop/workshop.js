import './workshop.css';
import { jetError, leanStarve, jetTrue, jetText, adviceText } from '../engine/jetting.js';
import { registerTuning } from '../core/tuning.js';
import { FIX_PARTS, PARTS, jetShelfChange } from './spares.js';
import {
  DEFAULT_TUNE_PARAMS,
  TUNE_PARAM_RANGES,
  tuneTarget,
  captureStock,
  stockSettings,
  isStock,
  limits,
  nudge,
  applyTune,
} from '../vehicle/tuneUp.js';

// Holding an adjust key steps again after this delay, then at this interval.
const REPEAT_DELAY = 0.35;
const REPEAT_INTERVAL = 0.09;
const FAST_SAY_AFTER = 1.5; // seconds above the old top speed, with her on the back, before she notices

const REPAIR_DONE = {
  puncture: 'Put a spare inner tube in and pumped it up: it will do for now',
  belt: 'Swapped in a spare belt: it grips a bit better',
  cable: 'Squirted some oil on the cable: it is freer, but not right',
  carb: 'Gave the carb a clean with what is in the toolbox: better, not perfect',
  mounts: 'Nipped up the engine mount bolts and packed a washer under the worst: it shakes less, but the rubber is still perished',
  chain: 'Put the chain back on the sprocket and gave it a squirt of oil: it still wants adjusting at the bench',
};
const REPAIR_NOTHING = {
  puncture: 'Pumped the tyres up: they were fine',
  belt: 'Drive belt looks fine',
  cable: 'Throttle cable runs freely',
  carb: 'Carb is clean',
  mounts: 'Engine mounts look sound',
  chain: 'The chain is on the sprocket and not too slack',
};
const SILENCER_OFF = 'Took the silencer off: it will be a lot louder, and a bit stronger';
const SILENCER_ON = 'Put the silencer back on';
const POD_JOB_SECONDS = 3; // fitting or taking off an accessory pod
const FILTER_KEY = 'KeyI'; // hold to clean the air filter
const POD_NAMES = { analogue: 'analogue pod', digital: 'digital pod' };
const REPAIR_KEYS = { KeyT: 'puncture', KeyR: 'belt', KeyL: 'cable', KeyC: 'carb', KeyM: 'mounts', KeyN: 'chain' };

const rpm = (n) => `${Math.round(n).toLocaleString('en-GB')} rpm`;
const pct = (f) => `${f >= 0 ? '+' : '−'}${Math.round(Math.abs(f) * 100)}%`;
const clicks = (n, word) => `${n} click${n === 1 ? '' : 's'} ${word}`;

// What's on the panel, top to bottom: value(settings, P, unit) is what it's set
// to, stock(stockSettings, stock) what it came with, effect(settings, P, unit) a
// short note of what that does.
const ROWS = [
  {
    key: 'idle',
    name: 'Idle screw',
    explain:
      "Wind it in for a faster, steadier tickover that copes better from cold, or back it out for a quieter, lazier one. Too low and it'd stall when you brake hard, so it stops at the safe minimum. Wind it right up and the clutch has to be stiffened to stop it creeping.",
    value: (s) => rpm(s.idle),
    stock: (st) => rpm(st.idle),
    effect: () => 'warm idle',
  },
  {
    key: 'mixture',
    petrolOnly: true,
    name: 'Carb mixture',
    explain:
      'Leaner gives a touch more go and uses less petrol, but it runs hotter, wants more choke from cold and can stumble and miss. Richer is happier from cold, but smokier and thirstier, and right at the end it slowly fouls its plug.',
    value: (s) => (s.mixture === 0 ? 'Middle' : s.mixture < 0 ? clicks(-s.mixture, 'lean') : clicks(s.mixture, 'rich')),
    stock: () => 'middle',
    effect: (s, P, unit) => {
      if (s.mixture === 0) return 'as it came';
      const lean = Math.max(0, -s.mixture);
      const rich = Math.max(0, s.mixture);
      // The pull it gains, less what lean running costs it (see the engine's leanPowerLoss).
      const e = unit.engine.params;
      const floor = unit.quad.params.drivePowerFloor;
      const leanLoss = (1 - floor) * e.leanPowerLoss * P.leanTrim * lean;
      const pull = (1 + P.leanDrive * lean - P.richDrive * rich) * (1 - leanLoss) - 1;
      return `pull ${pct(pull)}, fuel ${pct(P.richFuel * rich - P.leanFuel * lean)}`;
    },
  },
  {
    key: 'jet',
    name: 'Main jet (jet kit)',
    twoStrokeOnly: true,
    explain:
      "A two-stroke breathes thick cold air and thin hot air, so it wants a bigger jet on a cold day and a smaller one on a hot day. Jetted right for the day it is the cleanest power it makes. Too small on a cold day and it runs hot, scuffs and seizes, the way straight petrol does. Too big and it is sluggish, smoky and fouls its plug. The jet that came with it is right at 12 °C.",
    value: (s) => jetText(s.jet),
    stock: () => 'stock jet',
    effect: (s, P, unit) => {
      const e = unit.engine;
      const p = e.params;
      const day = e.dayTemp;
      const err = jetError(s.jet, day, p, e.bore);
      const word = leanStarve(err, p) > 0 ? 'too lean, it will run hot and scuff' : jetTrue(err, p) > 0.85 ? 'spot on for the day' : err < 0 ? 'a bit lean' : 'a bit rich';
      return `${adviceText(day, p, e.bore)}: ${word}`;
    },
  },
  {
    key: 'limiter',
    petrolOnly: true,
    name: 'Throttle stop (speed limiter)',
    explain:
      'Farm quads leave the factory with a stop screw so the throttle never opens all the way. Wind it out and it goes faster and revs a bit higher, but it drinks more and everything comes at you quicker over the bumps.',
    value: (s, P) => (s.limiter === 0 ? 'Fitted' : s.limiter >= P.limiterTurns ? 'Taken off' : `Out ${s.limiter} turn${s.limiter === 1 ? '' : 's'}`),
    stock: () => 'fitted',
    effect: (s, P) => (s.limiter === 0 ? 'as it came' : `top speed ${pct(P.limiterSpeed * s.limiter)}, fuel ${pct(P.limiterFuel * s.limiter)}`),
  },
  {
    key: 'revs',
    petrolOnly: true,
    name: 'Rev limiter',
    explain:
      'The ignition cuts out at a set number of revs. Raise it and the engine revs harder (and louder) flat out, but anything over the revs it was built for wears it out faster. Lower it and it is calmer and kinder to itself. The redline on the dash moves with it. It leaves the top speed alone: that is the throttle stop.',
    value: (s, P, unit) => rpm(unit.engine.params.maxRpm),
    stock: (st, stock) => rpm(stock.engine.maxRpm),
    effect: (s, P) => (s.revs === 0 ? 'as it came' : `${pct(s.revs * P.revStep)} revs flat out${s.revs > 0 ? ', wears faster' : ''}`),
  },
  {
    key: 'clutch',
    name: 'Clutch springs',
    explain:
      "Softer springs let the clutch bite sooner, for gentle pull-aways at low revs. Stiffer ones let it rev up before it goes, so it leaps off the line, but the take-up is snatchier. It always bites well above the idle, so it won't creep.",
    value: (s, P, unit) => `Bites at ${rpm(unit.quad.params.clutchEngageRpm)}`,
    stock: (st, stock) => rpm(stock.vehicle.clutchEngageRpm),
    effect: (s) => (s.clutch === 0 ? 'as it came' : s.clutch < 0 ? clicks(-s.clutch, 'softer') : clicks(s.clutch, 'stiffer')),
  },
  {
    key: 'tyres',
    name: 'Tyre pressures',
    explain:
      'Softer tyres grip better in mud and on slopes but squash and bounce about. Harder ones roll easier and feel sharper on the track, but slide about in the wet.',
    // The gauge reads each wheel. The setting levels all four to one pressure, so the readings change as you adjust.
    value: (s, P, unit) => unit.quad.tyres.gauge(unit.quad.faults.tyre, unit.quad.faults.started.puncture ? unit.quad.faults.levels.puncture : 0),
    stock: (st) => `all ${st.tyres.toFixed(1)} psi`,
    effect: (s, P, unit) => {
      const grip = -P.psiGrip * (unit.quad.tyres.meanPsi - P.stockPsi);
      return Math.abs(grip) < 0.005 ? 'about as it should be' : `average grip ${pct(grip)}, ${grip > 0 ? 'bouncier' : 'firmer'}`;
    },
  },
];

/**
 * The toolbox panel: tinkering with a quad that's switched off. Opens over the
 * game with the mouse free (pointer lock released, like the tuning panel), and
 * works from the keyboard or with clicks. Every change goes straight into that
 * quad's params, so you can hear and feel it, and stays for the rest of the game.
 */
export class Workshop {
  constructor(game) {
    this.game = game;
    this.params = { ...DEFAULT_TUNE_PARAMS };
    this.quads = new Map(); // unit -> { stock, settings }
    this.unit = null;
    this.selected = 0;
    this.repeat = {};
    this.fastTime = 0;
    this.fastSaid = false;
    registerTuning('Toolbox', this.params, TUNE_PARAM_RANGES);
    this.build();
  }

  get isOpen() {
    return !!this.unit;
  }

  /** The prompt when you look at a quad with the toolbox in your hands. */
  prompt(unit) {
    const e = unit.engine;
    if (e.isRunning || e.state === 'cranking') return { text: `Switch the ${unit.label} off first   ·   K ignition   ·   G put the toolbox down` };
    if (unit.quad.speed > 0.5) return { text: `Wait for the ${unit.label} to stop` };
    if (unit.engine.params.runsOnDiesel && this.game.utvTainted(unit)) return `Get the spanners out on the ${unit.label}: there's petrol in it   ·   G put the toolbox down`;
    return `Get the spanners out on the ${unit.label}   ·   G put the toolbox down`;
  }

  /** Opens the panel on this quad, if it's switched off and still. */
  open(unit) {
    const e = unit.engine;
    if (e.isRunning || e.state === 'cranking') {
      this.game.hud.toast('Switch it off first');
      return;
    }
    if (unit.quad.speed > 0.5) return;
    if (!this.quads.has(unit)) {
      // A quad that came with someone's tinkering left in (history.js) opens as it is, with stock the factory settings.
      this.quads.set(unit, unit.leftovers ?? (() => {
        const stock = captureStock(tuneTarget(unit));
        return { stock, settings: stockSettings(stock, this.params) };
      })());
    }
    this.unit = unit;
    if (!this.rowShown(this.selected)) this.selected = 0; // the jet row isn't there on a four-stroke
    this.repeat = {};
    this.render();
    this.el.style.display = 'flex';
    document.getElementById('overlay')?.classList.add('workshop');
    document.body.classList.add('workshop-open');
    this.game.input.exitPointerLock();
    this.freezePlayer(true);
    for (const c of this.game.companions) c.voice.onTinker?.('open');
  }

  close() {
    if (!this.unit) return;
    this.unit = null;
    this.podJob = null;
    this.filterHeld = 0;
    this.filterKey = false;
    this.el.style.display = 'none';
    document.getElementById('overlay')?.classList.remove('workshop');
    document.body.classList.remove('workshop-open');
    this.freezePlayer(false);
    this.game.input.requestPointerLock();
  }

  freezePlayer(frozen) {
    this.game.player.lookEnabled = !frozen;
    this.game.player.moveEnabled = !frozen;
  }

  /** This quad's settings so far (stock if you've not touched it). */
  settingsFor(unit) {
    return this.quads.get(unit)?.settings ?? null;
  }

  /** Changes one setting by a click; returns whether anything changed. */
  adjust(key, direction) {
    const q = this.quads.get(this.unit);
    const next = nudge(q.settings, key, direction, q.stock, this.params);
    if (Object.keys(next).every((k) => next[k] === q.settings[k])) return false;
    const shelf = key === 'jet' ? jetShelfChange(q.settings.jet, next.jet) : null;
    if (shelf === 'take' && !this.game.spares.has('jet')) {
      this.game.hud.toast('There is no spare main jet on the shelf: order one from the parts rack in the barn');
      return false;
    }
    if (shelf === 'take') this.game.spares.take('jet');
    else if (shelf === 'give') this.game.spares.give('jet');
    const raisedLimiter = key === 'limiter' && next.limiter > q.settings.limiter;
    this.apply(next);
    let kind = raisedLimiter ? 'limiter' : 'adjust';
    if (key === 'jet') {
      const p = this.unit.engine.params;
      const err = jetError(p.jet, this.unit.engine.dayTemp, p, this.unit.engine.bore);
      if (leanStarve(err, p) > 0) kind = 'jetLean';
      else if (jetTrue(err, p) > 0.85) kind = 'jetRight';
    }
    for (const c of this.game.companions) c.voice.onTinker?.(kind);
    return true;
  }

  /** A service: new plug, clean filter, carb tickled over. Clears the wear and leaves it running as sweetly as this quad can. */
  service() {
    const unit = this.unit;
    if (!unit || this.isServiced(unit)) return;
    if (!this.game.spares.take('plug')) {
      this.game.hud.toast('A service wants a new spark plug and there is none on the shelf: order one from the parts rack in the barn');
      return;
    }
    unit.engine.wear = 0;
    unit.engine.silencerBlown = 0;
    const best = unit.spec.roughnessRange?.[0];
    if (best !== undefined) unit.engine.params.baseRoughness = Math.min(unit.engine.params.baseRoughness, best);
    // A diesel can't go on the bench, so its service is the oil change too (a quad's oil is topped up at the dipstick or done at the bench).
    if (unit.engine.params.runsOnDiesel) unit.quad.sump?.fill();
    this.render();
    for (const c of this.game.companions) c.voice.onTinker?.('service');
  }

  /**
   * Holding the key (or button) cleans the air filter: a few seconds' hold, which starts again if you let go. It
   * says so while you do, and only a filter that has anything in it takes the time.
   */
  cleanFilter(dt) {
    const unit = this.unit;
    const filter = unit?.quad.filter;
    if (!filter || !this.filterKey || filter.isClean || this.podJob) {
      if (this.filterHeld > 0) {
        this.filterHeld = 0;
        if (unit) this.render();
      }
      return;
    }
    this.filterHeld += dt;
    if (this.filterHeld >= filter.p.cleanSeconds) {
      this.filterHeld = 0;
      filter.clean();
      this.filterButton = false;
      this.game.hud.toast('Air filter cleaned out');
      for (const c of this.game.companions) c.voice.onTinker?.('service');
    }
    this.render();
  }

  /** Empties the tank and carb, for fuel that's gone wrong (red diesel). The fuel is lost; the engine's soak goes with it. */
  drainFuel() {
    const unit = this.unit;
    if (!unit || !this.canDrain(unit)) return;
    const lost = unit.quad.drainFuel();
    if (this.isDiesel) {
      this.game.utvPetrolSaid = false;
      this.game.hud.toast(`Tank drained: ${lost.toFixed(1)} L gone. It needs red diesel`);
    } else this.game.hud.toast(`Tank and carb drained: ${lost.toFixed(1)} L gone`);
    this.render();
    for (const c of this.game.companions) c.voice.onTinker?.('service');
  }

  /** Opens the drain on the sediment bowl under the fuel tap: the water runs out of the bowl, the tank's bottom and the carb. */
  drainWater() {
    const unit = this.unit;
    if (!unit || !this.canDrainWater(unit)) return;
    const lost = unit.quad.fuel.drainSediment();
    this.game.hud.toast(`Drained at the tap: the water has run out with ${lost.toFixed(1)} L of fuel`);
    this.render();
    for (const c of this.game.companions) c.voice.onTinker?.('service');
  }

  /** Worth opening the tap's drain: there's water in the sediment bowl, the tank or the carb. The diesels have no tap or bowl. */
  canDrainWater(unit) {
    return !unit.quad.fuel.params.noTap && !unit.engine.params.runsOnDiesel && unit.quad.fuel.hasWater;
  }

  /** Worth draining: there's diesel in a petrol quad's fuel or its engine is soaked with it, or petrol in a diesel's. */
  canDrain(unit) {
    if (unit.engine.params.runsOnDiesel) return this.game.utvTainted(unit); // red diesel is its fuel: it's petrol in the tank that's wrong
    return unit.quad.fuel.diesel > 0.005 || unit.quad.fuel.bowlDiesel > 0.005 || unit.engine.dieselSoak > 0.005;
  }

  /** Strip a nipped-up engine down and free it (top the oil up first, or it goes again). A seized one is a job for the bench (`topEnd`). */
  stripDown() {
    const unit = this.unit;
    if (!unit) return;
    if (unit.engine.seized) {
      this.game.hud.toast('It is seized solid: the barrel has to come off at the bench, and it wants a new piston and rings');
      return;
    }
    if (!unit.engine.freeSeized()) return;
    this.render();
    for (const c of this.game.companions) c.voice.onTinker?.('service');
  }

  /**
   * The quick jobs for faults that develop. Each does its job if there is one, and says so either way, so it doesn't give a fault away.
   * In the yard it's only a rough fix (the fault stays, mildly); the barn bench does it properly.
   */
  repair(kind) {
    const unit = this.unit;
    if (!unit || !this.repairShown(kind)) return;
    const part = FIX_PARTS[kind];
    const f = unit.quad.faults;
    if (part && f.started[kind] && f.caps[kind] >= 1 && !this.game.spares.has(part)) {
      // Something to fix and nothing on the shelf to fix it with.
      this.game.hud.toast(`There is no spare ${PARTS[part].one} on the shelf: order one from the parts rack in the barn`);
      return;
    }
    if (kind === 'puncture') this.levelTyres(unit); // pumping up is pumping up, whether or not there was a puncture
    const done = unit.quad.faults.fix(kind, { rough: true });
    if (done && part) this.game.spares.take(part);
    this.game.hud.toast(done ? REPAIR_DONE[kind] : REPAIR_NOTHING[kind]);
    if (done) for (const c of this.game.companions) c.voice.onTinker?.('service');
    this.render(); // the pump's readings changed
  }

  /** Whether a quick job is on the panel: a diesel has no carb, and the tractor no belt. */
  repairShown(kind) {
    if (kind === 'carb') return !this.isDiesel;
    if (kind === 'chain') return !!this.unit?.quad.faults.hasChain; // only the chain-driven ones
    if (kind === 'belt') return !this.unit?.quad.tractor && !this.unit?.quad.landRover; // the Land Rover has a clutch
    return true;
  }

  /** Pumps (or lets down) all four tyres to the pressure the toolbox is set to. */
  levelTyres(unit) {
    const q = this.quads.get(unit);
    unit.quad.tyres.level(q?.settings.tyres ?? this.params.stockPsi);
    unit.quad.physics.applyParams();
  }

  /** The pump: lets one tyre down or tops it up by a step, whatever the toolbox's all-four setting says. */
  pumpWheel(i, dir) {
    const unit = this.unit;
    if (!unit) return;
    const t = unit.quad.tyres;
    t.pump(i, dir * t.P.pumpStep);
    unit.quad.physics.applyParams();
    this.render();
  }

  /** The pump's rows: a gauge reading per real wheel with a bleed and a pump button. */
  renderPump(unit) {
    const t = unit.quad.tyres;
    const f = unit.quad.faults;
    const reading = t.reading(f.tyre, f.started.puncture ? f.levels.puncture : 0);
    this.pumpEl.innerHTML = `<div class="ws-pumphead">Tyre pump and gauge</div>${t.realWheels
      .map(
        (w) => `<div class="ws-wheel${t.rimLevel(w.i) > 0 ? ' low' : ''}"><span class="ws-wname">${w.name}</span>
          <button type="button" data-wheel="${w.i}" data-dir="-1" aria-label="Let some out"${t.psi[w.i] <= t.P.ventMinPsi ? ' disabled' : ''}>−</button>
          <span class="ws-wpsi">${reading[w.i].toFixed(1)} psi</span>
          <button type="button" data-wheel="${w.i}" data-dir="1" aria-label="Pump up"${t.psi[w.i] >= t.P.maxPsi ? ' disabled' : ''}>+</button></div>`,
      )
      .join('')}`;
  }

  /** Takes the silencer off, or puts it back. */
  toggleSilencer() {
    const unit = this.unit;
    if (!unit || this.isDiesel) return;
    unit.engine.silencerOff = !unit.engine.silencerOff;
    this.game.hud.toast(unit.engine.silencerOff ? SILENCER_OFF : SILENCER_ON);
    this.render();
    for (const c of this.game.companions) c.voice.onTinker?.(unit.engine.silencerOff ? 'silencerOff' : 'silencerOn');
  }

  /** Starts fitting a pod from the toolbox to this quad, or taking its pod off. Each takes a few seconds. */
  startPod(action, kind) {
    const unit = this.unit;
    const rack = this.game.podRack;
    if (!unit || !rack || this.podJob || !this.canPod) return; // the pods fit the quads and the tractor
    if (action === 'fit') {
      if (rack.podOn(unit.id)) return this.game.hud.toast(`There's already a ${POD_NAMES[rack.podOn(unit.id)]} on it`);
      if (!rack.inToolbox(kind)) return this.game.hud.toast(`The ${POD_NAMES[kind]} is on another quad`);
      if (!unit.quad.model.userData.podMount) return this.game.hud.toast("Nowhere to mount it on this one");
    } else {
      kind = rack.podOn(unit.id);
      if (!kind) return this.game.hud.toast('There is no pod on it');
    }
    this.podJob = { action, kind, unit, t: 0 };
    this.render();
  }

  finishPod() {
    const { action, kind, unit } = this.podJob;
    const rack = this.game.podRack;
    this.podJob = null;
    if (action === 'fit' && rack.fit(kind, unit.id)) {
      unit.quad.fitPod(this.game.pods[kind]);
      this.game.hud.toast(`The ${POD_NAMES[kind]} is fitted`);
    } else if (action === 'off' && rack.takeOff(unit.id)) {
      unit.quad.removePod();
      this.game.hud.toast(`The ${POD_NAMES[kind]} is off and back in the toolbox`);
    }
    this.render();
    for (const c of this.game.companions) c.voice.onTinker?.('service');
  }

  isServiced(unit) {
    const best = unit.spec.roughnessRange?.[0] ?? unit.engine.params.baseRoughness;
    if (unit.engine.params.runsOnDiesel && unit.quad.sump && unit.quad.sump.level < 0.995) return false;
    return unit.engine.wear < 0.005 && unit.engine.silencerBlown < 0.005 && unit.engine.params.baseRoughness <= best + 0.001;
  }

  backToStock() {
    const q = this.quads.get(this.unit);
    const e = this.unit.engine;
    if (isStock(q.settings, q.stock, this.params) && !e.silencerOff) return;
    e.silencerOff = false;
    if (q.settings.jet !== 0) this.game.spares.give('jet'); // the stock jet goes back in, the other comes out
    this.apply(stockSettings(q.stock, this.params));
    this.levelTyres(this.unit);
    for (const c of this.game.companions) c.voice.onTinker?.('stock');
  }

  apply(settings) {
    const unit = this.unit;
    const q = this.quads.get(unit);
    const before = q.settings.tyres;
    q.settings = applyTune(tuneTarget(unit), q.stock, settings, this.params);
    if (q.settings.tyres !== before) this.levelTyres(unit); // moving the setting pumps all four to it, which levels them out
    unit.quad.physics.applyParams();
    unit.idleRpm = q.settings.idle;
    this.render();
  }

  /** Keyboard while the panel is open (the mouse works through the buttons). */
  handleInput(input) {
    if (!this.unit) return;
    this.freezePlayer(true);
    input.takeWheelSteps();
    const pressed = (...codes) => codes.some((c) => input.wasPressed(c));
    if (pressed('KeyE', 'Escape', 'Enter')) {
      this.close();
      return;
    }
    for (let i = 0; i < ROWS.length; i++) {
      if (pressed(`Digit${i + 1}`, `Numpad${i + 1}`)) this.select(i);
    }
    if (pressed('ArrowUp', 'KeyW')) this.select(this.nextRow(-1));
    if (pressed('ArrowDown', 'KeyS')) this.select(this.nextRow(1));
    if (pressed('KeyB', 'Backspace')) this.backToStock();
    this.filterKey = input.isDown(FILTER_KEY) || this.filterButton;
    if (pressed('KeyV')) this.service();
    if (pressed('KeyX')) this.toggleSilencer();
    if (pressed('KeyF')) this.stripDown();
    if (pressed('KeyP')) this.drainFuel();
    if (pressed('KeyG')) this.drainWater();
    if (pressed('KeyY')) this.startPod('fit', 'analogue');
    if (pressed('KeyU')) this.startPod('fit', 'digital');
    if (pressed('KeyO')) this.startPod('off');
    for (const [code, kind] of Object.entries(REPAIR_KEYS)) if (pressed(code)) this.repair(kind);
    const key = ROWS[this.selected].key;
    if (this.repeatKey(input, ['ArrowLeft', 'KeyA'])) this.adjust(key, -1);
    if (this.repeatKey(input, ['ArrowRight', 'KeyD'])) this.adjust(key, 1);
  }

  /** True on a press, then repeatedly while held. */
  repeatKey(input, codes) {
    const id = codes[0];
    const dt = this.dt ?? 1 / 60;
    if (codes.some((c) => input.wasPressed(c))) {
      this.repeat[id] = REPEAT_DELAY;
      return true;
    }
    if (codes.some((c) => input.isDown(c)) && this.repeat[id] !== undefined) {
      this.repeat[id] -= dt;
      if (this.repeat[id] <= 0) {
        this.repeat[id] += REPEAT_INTERVAL;
        return true;
      }
      return false;
    }
    delete this.repeat[id];
    return false;
  }

  /** Whether a row is on the panel for this quad: the jet only shows on a two-stroke, and the diesels leave out the petrol carb's settings. */
  rowShown(i) {
    if (ROWS[i].petrolOnly && this.isDiesel) return false;
    return !ROWS[i].twoStrokeOnly || this.unit?.engine.params.strokes === 2;
  }

  /** Whether this vehicle has a place to mount a pod (the quads and the tractor; not the UTV). */
  get canPod() {
    return !!this.unit?.quad.model.userData.podMount;
  }

  /** The tractor and UTV: a diesel has no carb mixture, throttle stop or rev limiter to fiddle with, no belt on the tractor, and no silencer to swap (and no pods on the UTV). */
  get isDiesel() {
    return !!this.unit?.engine.params.runsOnDiesel;
  }

  /** The row above (-1) or below (1) the selected one, skipping any that aren't shown. */
  nextRow(direction) {
    let i = this.selected;
    do i = (i + direction + ROWS.length) % ROWS.length;
    while (!this.rowShown(i));
    return i;
  }

  select(i) {
    if (i === this.selected || !this.rowShown(i)) return;
    this.selected = i;
    this.render();
  }

  /**
   * Every frame: shuts the panel if the quad starts or moves, and lets her
   * notice when a quad you've de-restricted goes faster than it used to.
   */
  update(dt) {
    this.dt = dt;
    const unit = this.unit;
    if (this.podJob && (this.podJob.t += dt) >= POD_JOB_SECONDS) this.finishPod();
    this.cleanFilter(dt);
    if (unit && (unit.engine.isRunning || unit.quad.speed > 1 || this.game.player.isRiding)) {
      this.close();
      this.game.hud.toast(unit.engine.isRunning ? "It's running: toolbox away" : 'Toolbox away');
    }

    const ridden = this.game.riddenUnit;
    const q = ridden && this.quads.get(ridden);
    const c = q && this.game.companions.find((h) => h.isSeated && h.quad === ridden.quad);
    const together = !!c;
    const quicker = together && q.settings.limiter > 0 && Math.abs(ridden.quad.forwardSpeed) > q.stock.vehicle.maxSpeed * 0.97;
    this.fastTime = quicker ? this.fastTime + dt : 0;
    if (!quicker) this.fastSaid = false;
    if (this.fastTime > FAST_SAY_AFTER && !this.fastSaid) this.fastSaid = !!c.voice.onTinker?.('fast');
  }

  // DOM ------------------------------------------------------------------

  build() {
    const el = document.createElement('div');
    el.className = 'workshop';
    el.style.display = 'none';
    el.innerHTML = `
      <div class="ws-card">
        <div class="ws-head">
          <div class="ws-title"></div>
          <div class="ws-sub">Changes take effect straight away and stay for the rest of the game.</div>
          <div class="ws-cond"></div>
        </div>
        <div class="ws-rows"></div>
        <div class="ws-pump"></div>
        <div class="ws-explain"></div>
        <div class="ws-foot">
          <button type="button" class="ws-btn ws-service"><span class="key">V</span>Service it</button>
          <button type="button" class="ws-btn ws-filter"><span class="key">I</span>Hold to clean the air filter</button>
          <button type="button" class="ws-btn ws-fix" data-fix="puncture"><span class="key">T</span>Pump and patch tyres</button>
          <button type="button" class="ws-btn ws-fix" data-fix="belt"><span class="key">R</span>Check the belt</button>
          <button type="button" class="ws-btn ws-fix" data-fix="cable"><span class="key">L</span>Oil the throttle cable</button>
          <button type="button" class="ws-btn ws-fix" data-fix="carb"><span class="key">C</span>Clean the carb</button>
          <button type="button" class="ws-btn ws-fix" data-fix="mounts"><span class="key">M</span>Nip up the engine mounts</button>
          <button type="button" class="ws-btn ws-fix" data-fix="chain"><span class="key">N</span>Put the chain back and oil it</button>
          <button type="button" class="ws-btn ws-drain"><span class="key">P</span>Pump out the tank and carb</button>
          <button type="button" class="ws-btn ws-water"><span class="key">G</span>Drain the water at the tap</button>
          <button type="button" class="ws-btn ws-strip"><span class="key">F</span>Strip it down</button>
          <button type="button" class="ws-btn ws-silencer"><span class="key">X</span>Take the silencer off</button>
          <button type="button" class="ws-btn ws-reset"><span class="key">B</span>Back to stock</button>
          <button type="button" class="ws-btn ws-done"><span class="key">E</span>Done</button>
        </div>
        <div class="ws-pods">
          <div class="ws-podline"></div>
          <button type="button" class="ws-btn ws-pod" data-pod="analogue"><span class="key">Y</span>Fit analogue pod</button>
          <button type="button" class="ws-btn ws-pod" data-pod="digital"><span class="key">U</span>Fit digital pod</button>
          <button type="button" class="ws-btn ws-podoff"><span class="key">O</span>Pod off</button>
        </div>
        <div class="ws-keys">↑ ↓ choose   ·   ← → adjust (hold to keep going)   ·   V service   ·   hold I air filter   ·   X silencer   ·   F strip down   ·   P pump out the fuel   ·   Y U O pods   ·   T tyres   ·   R belt   ·   L cable   ·   C carb   ·   M mounts   ·   N chain   ·   or use the mouse</div>
      </div>`;
    document.body.appendChild(el);
    this.el = el;
    this.titleEl = el.querySelector('.ws-title');
    this.rowsEl = el.querySelector('.ws-rows');
    this.explainEl = el.querySelector('.ws-explain');
    this.pumpEl = el.querySelector('.ws-pump');
    // One click handler for the pump's buttons, as the wheels (and so the buttons) change with the quad.
    this.pumpEl.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-wheel]');
      if (b) this.pumpWheel(Number(b.dataset.wheel), Number(b.dataset.dir));
    });
    this.rowsEl.innerHTML = ROWS.map(
      (r, i) => `
        <div class="ws-row" data-row="${i}">
          <div class="ws-name"><span class="key">${i + 1}</span>${r.name}</div>
          <div class="ws-ctrl">
            <button type="button" class="ws-step" data-dir="-1" aria-label="Less">−</button>
            <div class="ws-value"><div class="ws-now"></div><div class="ws-meter"><div class="ws-fill"></div><div class="ws-stock-tick"></div></div></div>
            <button type="button" class="ws-step" data-dir="1" aria-label="More">+</button>
          </div>
          <div class="ws-detail"><span class="ws-effect"></span><span class="ws-stock"></span></div>
        </div>`,
    ).join('');
    this.rowEls = [...this.rowsEl.querySelectorAll('.ws-row')];
    this.rowEls.forEach((rowEl, i) => {
      rowEl.addEventListener('mouseenter', () => this.select(i));
      for (const b of rowEl.querySelectorAll('.ws-step')) {
        b.addEventListener('click', () => {
          this.select(i);
          this.adjust(ROWS[i].key, Number(b.dataset.dir));
        });
      }
    });
    el.querySelector('.ws-reset').addEventListener('click', () => this.backToStock());
    el.querySelector('.ws-silencer').addEventListener('click', () => this.toggleSilencer());
    el.querySelector('.ws-service').addEventListener('click', () => this.service());
    el.querySelector('.ws-strip').addEventListener('click', () => this.stripDown());
    el.querySelector('.ws-drain').addEventListener('click', () => this.drainFuel());
    el.querySelector('.ws-water').addEventListener('click', () => this.drainWater());
    // The air filter takes a hold, with the key or the mouse button.
    const filterBtn = el.querySelector('.ws-filter');
    filterBtn.addEventListener('mousedown', () => (this.filterButton = true));
    for (const ev of ['mouseup', 'mouseleave']) filterBtn.addEventListener(ev, () => (this.filterButton = false));
    for (const b of el.querySelectorAll('.ws-fix')) b.addEventListener('click', () => this.repair(b.dataset.fix));
    for (const b of el.querySelectorAll('.ws-pod')) b.addEventListener('click', () => this.startPod('fit', b.dataset.pod));
    el.querySelector('.ws-podoff').addEventListener('click', () => this.startPod('off'));
    el.querySelector('.ws-done').addEventListener('click', () => this.close());
    // Keep clicks on the panel from reaching the game.
    el.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  render() {
    const unit = this.unit;
    if (!unit) return;
    const { stock, settings } = this.quads.get(unit);
    const P = this.params;
    const st = stockSettings(stock, P);
    this.titleEl.textContent = `Toolbox   ·   ${unit.name}`;
    this.explainEl.textContent = ROWS[this.selected].explain;
    this.renderPump(unit);
    ROWS.forEach((r, i) => {
      const rowEl = this.rowEls[i];
      rowEl.style.display = this.rowShown(i) ? '' : 'none';
      rowEl.classList.toggle('selected', i === this.selected);
      const changed = settings[r.key] !== st[r.key];
      rowEl.classList.toggle('changed', changed);
      rowEl.querySelector('.ws-now').textContent = r.value(settings, P, unit);
      rowEl.querySelector('.ws-effect').textContent = r.effect(settings, P, unit);
      rowEl.querySelector('.ws-stock').textContent = `stock ${r.stock(st, stock)}`;
      const [lo, hi] = limits(r.key, settings, stock, P);
      const at = (v) => (hi > lo ? (v - lo) / (hi - lo) : 0.5);
      rowEl.querySelector('.ws-fill').style.width = `${Math.round(at(settings[r.key]) * 100)}%`;
      rowEl.querySelector('.ws-stock-tick').style.left = `${Math.round(Math.min(1, Math.max(0, at(st[r.key]))) * 100)}%`;
      const [less, more] = rowEl.querySelectorAll('.ws-step');
      less.disabled = settings[r.key] <= lo;
      more.disabled = settings[r.key] >= hi;
    });
    this.el.querySelector('.ws-reset').disabled = isStock(settings, stock, P) && !unit.engine.silencerOff;
    this.el.querySelector('.ws-silencer').lastChild.textContent = unit.engine.silencerOff ? 'Put the silencer back' : 'Take the silencer off';
    // How it's running: roughness from its build plus wear, which a service clears.
    const e = unit.engine;
    const rough = Math.min(1, e.params.baseRoughness + e.wear);
    const word = rough < 0.15 ? 'sweet' : rough < 0.35 ? 'a bit lumpy' : rough < 0.6 ? 'rough' : 'very rough';
    this.el.querySelector('.ws-cond').textContent = `Running ${word}: roughness ${rough.toFixed(2)}${e.wear >= 0.005 ? ` (${e.wear.toFixed(2)} of it wear)` : ''}. A service clears the wear.`;
    this.el.querySelector('.ws-service').disabled = this.isServiced(unit);
    this.el.querySelector('.ws-drain').disabled = !this.canDrain(unit);
    this.el.querySelector('.ws-water').disabled = !this.canDrainWater(unit);
    this.el.querySelector('.ws-water').style.visibility = this.isDiesel ? 'hidden' : '';
    this.el.querySelector('.ws-drain').lastChild.textContent = this.isDiesel ? 'Pump the petrol out of the tank' : 'Pump out the tank and carb';
    this.el.querySelector('.ws-silencer').style.visibility = this.isDiesel ? 'hidden' : '';
    this.el.querySelector('.ws-pods').style.visibility = this.canPod ? '' : 'hidden';
    for (const b of this.el.querySelectorAll('.ws-fix')) b.style.visibility = this.repairShown(b.dataset.fix) ? '' : 'hidden';
    this.el.querySelector('.ws-service').lastChild.textContent = this.isDiesel ? 'Service it (oil, wear)' : 'Service it';
    const filter = unit.quad.filter;
    const filterBtn = this.el.querySelector('.ws-filter');
    filterBtn.disabled = filter.isClean;
    filterBtn.lastChild.textContent = this.filterHeld > 0 ? `Cleaning... ${Math.round((this.filterHeld / filter.p.cleanSeconds) * 100)}%` : `Hold: clean air filter (${filter.state})`;
    // The pods: what's on this quad, what's in the toolbox, and the job in hand.
    const rack = this.canPod ? this.game.podRack : null;
    if (rack) {
      const fitted = rack.podOn(unit.id);
      const loose = ['analogue', 'digital'].filter((k) => rack.inToolbox(k)).map((k) => POD_NAMES[k]);
      const job = this.podJob;
      this.el.querySelector('.ws-podline').textContent = job
        ? `${job.action === 'fit' ? 'Fitting' : 'Taking off'} the ${POD_NAMES[job.kind]}...`
        : `On this quad: ${fitted ? `the ${POD_NAMES[fitted]}` : 'no pod'}.   In the toolbox: ${loose.length ? loose.join(' and ') : 'nothing'}.`;
      for (const b of this.el.querySelectorAll('.ws-pod')) b.disabled = !!job || !!fitted || !rack.inToolbox(b.dataset.pod);
      this.el.querySelector('.ws-podoff').disabled = !!job || !fitted;
    }
    // Only an engine that's scuffed or seized has anything to strip.
    const strip = this.el.querySelector('.ws-strip');
    strip.style.visibility = (e.seized || e.scuff >= 0.05) ? '' : 'hidden'; // keeps its place, so the others don't move
    if (e.seized) this.el.querySelector('.ws-cond').textContent = 'Seized solid: it needs its top end rebuilt at the bench before it will turn over.';
  }
}
