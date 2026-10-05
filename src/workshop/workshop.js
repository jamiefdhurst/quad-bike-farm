import './workshop.css';
import { registerTuning } from '../core/tuning.js';
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
    key: 'limiter',
    name: 'Throttle stop (speed limiter)',
    explain:
      'Farm quads leave the factory with a stop screw so the throttle never opens all the way. Wind it out and it goes faster and revs a bit higher, but it drinks more and everything comes at you quicker over the bumps.',
    value: (s, P) => (s.limiter === 0 ? 'Fitted' : s.limiter >= P.limiterTurns ? 'Taken off' : `Out ${s.limiter} turn${s.limiter === 1 ? '' : 's'}`),
    stock: () => 'fitted',
    effect: (s, P) => (s.limiter === 0 ? 'as it came' : `top speed ${pct(P.limiterSpeed * s.limiter)}, fuel ${pct(P.limiterFuel * s.limiter)}`),
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
    value: (s) => `${s.tyres.toFixed(1)} psi`,
    stock: (st) => `${st.tyres.toFixed(1)} psi`,
    effect: (s, P) => {
      const grip = -P.psiGrip * (s.tyres - P.stockPsi);
      return grip === 0 ? 'as it came' : `grip ${pct(grip)}, ${grip > 0 ? 'bouncier' : 'firmer'}`;
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
      const stock = captureStock(tuneTarget(unit));
      this.quads.set(unit, { stock, settings: stockSettings(stock, this.params) });
    }
    this.unit = unit;
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
    const raisedLimiter = key === 'limiter' && next.limiter > q.settings.limiter;
    this.apply(next);
    for (const c of this.game.companions) c.voice.onTinker?.(raisedLimiter ? 'limiter' : 'adjust');
    return true;
  }

  /** A service: new plug, clean filter, carb tickled over. Clears the wear and leaves it running as sweetly as this quad can. */
  service() {
    const unit = this.unit;
    if (!unit || this.isServiced(unit)) return;
    unit.engine.wear = 0;
    const best = unit.spec.roughnessRange?.[0];
    if (best !== undefined) unit.engine.params.baseRoughness = Math.min(unit.engine.params.baseRoughness, best);
    this.render();
    for (const c of this.game.companions) c.voice.onTinker?.('service');
  }

  /** Strip a nipped-up or seized two-stroke down and free it. */
  stripDown() {
    const unit = this.unit;
    if (!unit || !unit.engine.freeSeized()) return;
    this.render();
    for (const c of this.game.companions) c.voice.onTinker?.('service');
  }

  isServiced(unit) {
    const best = unit.spec.roughnessRange?.[0] ?? unit.engine.params.baseRoughness;
    return unit.engine.wear < 0.005 && unit.engine.params.baseRoughness <= best + 0.001;
  }

  backToStock() {
    const q = this.quads.get(this.unit);
    if (isStock(q.settings, q.stock, this.params)) return;
    this.apply(stockSettings(q.stock, this.params));
    for (const c of this.game.companions) c.voice.onTinker?.('stock');
  }

  apply(settings) {
    const unit = this.unit;
    const q = this.quads.get(unit);
    q.settings = applyTune(tuneTarget(unit), q.stock, settings, this.params);
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
    if (pressed('ArrowUp', 'KeyW')) this.select((this.selected + ROWS.length - 1) % ROWS.length);
    if (pressed('ArrowDown', 'KeyS')) this.select((this.selected + 1) % ROWS.length);
    if (pressed('KeyB', 'Backspace')) this.backToStock();
    if (pressed('KeyV')) this.service();
    if (pressed('KeyF')) this.stripDown();
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

  select(i) {
    if (i === this.selected) return;
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
        <div class="ws-explain"></div>
        <div class="ws-foot">
          <button type="button" class="ws-btn ws-reset"><span class="key">B</span>Back to stock</button>
          <button type="button" class="ws-btn ws-strip"><span class="key">F</span>Strip it down</button>
          <button type="button" class="ws-btn ws-service"><span class="key">V</span>Service it</button>
          <button type="button" class="ws-btn ws-done"><span class="key">E</span>Done</button>
        </div>
        <div class="ws-keys">↑ ↓ choose   ·   ← → adjust (hold to keep going)   ·   V service   ·   F strip down   ·   or use the mouse</div>
      </div>`;
    document.body.appendChild(el);
    this.el = el;
    this.titleEl = el.querySelector('.ws-title');
    this.rowsEl = el.querySelector('.ws-rows');
    this.explainEl = el.querySelector('.ws-explain');
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
    el.querySelector('.ws-service').addEventListener('click', () => this.service());
    el.querySelector('.ws-strip').addEventListener('click', () => this.stripDown());
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
    ROWS.forEach((r, i) => {
      const rowEl = this.rowEls[i];
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
    this.el.querySelector('.ws-reset').disabled = isStock(settings, stock, P);
    // How it's running: roughness from its build plus wear, which a service clears.
    const e = unit.engine;
    const rough = Math.min(1, e.params.baseRoughness + e.wear);
    const word = rough < 0.15 ? 'sweet' : rough < 0.35 ? 'a bit lumpy' : rough < 0.6 ? 'rough' : 'very rough';
    this.el.querySelector('.ws-cond').textContent = `Running ${word}: roughness ${rough.toFixed(2)}${e.wear >= 0.005 ? ` (${e.wear.toFixed(2)} of it wear)` : ''}. A service clears the wear.`;
    this.el.querySelector('.ws-service').disabled = this.isServiced(unit);
    // Only a two-stroke that's scuffed or seized has anything to strip.
    const strip = this.el.querySelector('.ws-strip');
    strip.style.display = e.params.strokes === 2 && (e.seized || e.scuff >= 0.05) ? '' : 'none';
    if (e.seized) this.el.querySelector('.ws-cond').textContent = 'Seized solid: it needs stripping down before it will turn over.';
  }
}
