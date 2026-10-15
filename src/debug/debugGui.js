import { lensCoverage } from '../effects/lensMud.js';
import GUI from 'lil-gui';
import { getTuningGroups, exportTuning } from '../core/tuning.js';
import { FAULT_KINDS } from '../vehicle/faults.js';
import { applicableQuirks, featuresOf } from '../vehicle/quirks.js';
import { categoryOf, sortTuneGroups } from './tuneCategories.js';
import { buildGirlsTab } from './girlsTab.js';
import { buildFrameTime } from './frameTimeFolder.js';
import { setQuirk, setFault, clearFaults, fixEverything, problemSummary, quirkLabel, startWarm, switchOff, engineReadouts } from './vehicleDebug.js';
import { netCharge } from '../engine/charging.js';
import { sickness, sickEvidence } from '../npc/keepAlive.js';
import { BRANDS, WHEEL_NAMES } from '../vehicle/tyres.js';
import { LIGHT_MODES } from '../vehicle/lightSwitch.js';
import { SIGNAL_MODES } from '../vehicle/indicators.js';
import { DRIVE_MODES } from '../vehicle/driveMode.js';
import { Trace, TRACE_LINES } from './trace.js';

/**
 * lil-gui panel built from the tuning registry, plus live engine readouts and
 * a few shortcuts. Hidden until backtick is pressed.
 */
export class DebugGui {
  constructor(game) {
    this.game = game;
    this.gui = new GUI({ title: 'Debug  ( ` to hide )', width: 340 });
    this.gui.hide();
    // lil-gui keeps a name on one line and lets a long one push its widget right, so the right-hand column drifts row by row.
    // Let names wrap inside their column instead, so every widget starts at the same place.
    const style = document.createElement('style');
    style.textContent = `.lil-gui { --name-width: 45%; }
.lil-gui .lil-controller > .lil-name { width: var(--name-width); max-width: var(--name-width); white-space: normal; overflow-wrap: anywhere; line-height: 1.25; padding-top: 3px; padding-bottom: 3px; box-sizing: border-box; }`;
    document.head.appendChild(style);
    this.visible = false;
    this.pickedId = null; // the vehicle chosen on the Vehicles tab; null follows whichever you are on or looking at
    this.tabs = { Vehicles: [], Girls: [], Tune: [] };
    this.tab = 'Vehicles';
    this.search = { text: '' };
    const unitNames = new Set(game.units.map((u) => u.name));

    this.buildVehicles();
    this.buildVehicleActions();
    this.buildVehicleFolders();
    buildGirlsTab(this);
    // Every vehicle's own registered tuning, together at the bottom of the Vehicles tab.
    this.tuningParent = this.addFolder('Vehicles', 'Tuning for each vehicle (engine, controls, sound...)');
    this.tuningParent.close();
    buildFrameTime(this);
    this.searchFolder = this.addFolder('Tune', 'Search');
    this.searchFolder.add(this.search, 'text').name('Find a folder').onChange(() => this.applyVisibility());
    this.searchFolder
      .add(
        {
          copy: () => {
            const text = JSON.stringify(exportTuning(), null, 2);
            navigator.clipboard?.writeText(text);
            console.log(text);
            game.hud.toast('Tuning values copied');
          },
        },
        'copy',
      )
      .name('Copy all values as JSON');
    const folders = {};
    // The Tune tab: groups gathered under categories (tuneCategories.js), sorted, so it reads the same every time.
    this.tuneCategories = {};
    const categoryFolder = (name) => {
      if (!this.tuneCategories[name]) {
        const f = this.addFolder('Tune', name);
        f.close();
        this.tuneCategories[name] = f;
      }
      return this.tuneCategories[name];
    };
    // "Red quad/Engine" becomes an Engine folder inside a Red quad folder.
    const folderFor = (path) => {
      if (folders[path]) return folders[path];
      const cut = path.lastIndexOf('/');
      const parent = cut < 0 ? (unitNames.has(path) ? this.tuningParent : categoryFolder(categoryOf(path))) : folderFor(path.slice(0, cut));
      const f = parent.addFolder(path.slice(cut + 1));
      f.close();
      folders[path] = f;
      return f;
    };
    for (const group of sortTuneGroups(getTuningGroups())) {
      const folder = folderFor(group.name);
      for (const [key, range] of Object.entries(group.ranges)) {
        let c;
        if (typeof range[0] === 'string') {
          // A list of strings is a dropdown of choices.
          c = folder.add(group.params, key, range);
        } else if (typeof group.params[key] === 'number') {
          const [min, max, step] = range;
          c = folder.add(group.params, key, min, max, step);
        } else {
          continue;
        }
        if (group.onChange) c.onChange(group.onChange);
      }
      for (const [key, value] of Object.entries(group.params)) {
        if (typeof value === 'boolean') folder.add(group.params, key);
      }
      folder.close();
    }
    this.buildTabBar();
    this.showTab('Vehicles');
  }

  /** The vehicle the Vehicles tab is about: the one picked, or else whichever you're on or looking at. */
  unit() {
    return this.game.units.find((u) => u.id === this.pickedId) ?? this.game.inspectedUnit();
  }

  /** A folder on a tab. Tabs show and hide their folders; the Tune tab's folders can also be searched. */
  addFolder(tab, title) {
    const f = this.gui.addFolder(title);
    (this.tabs[tab] ??= []).push(f);
    return f;
  }

  /** A row of buttons across the top, one per tab. */
  buildTabBar() {
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:2px;padding:4px;background:#1a1a1a;position:sticky;top:0;z-index:2';
    this.tabButtons = {};
    for (const name of Object.keys(this.tabs)) {
      const b = document.createElement('button');
      b.textContent = name;
      b.style.cssText = 'flex:1;padding:4px 0;border:0;cursor:pointer;font:inherit;color:#ddd;background:#333';
      b.onclick = () => this.showTab(name);
      bar.appendChild(b);
      this.tabButtons[name] = b;
    }
    this.gui.$children.prepend(bar);
  }

  showTab(name) {
    this.tab = name;
    for (const [tab, folders] of Object.entries(this.tabs)) for (const f of folders) f.show(tab === name);
    for (const [tab, b] of Object.entries(this.tabButtons)) b.style.background = tab === name ? '#2c7be5' : '#333';
    this.applyVisibility();
  }

  /** On the Tune tab the search narrows the folders (and opens the categories that still have some). */
  applyVisibility() {
    if (this.tab !== 'Tune') return;
    const q = this.search.text.trim().toLowerCase();
    for (const cat of Object.values(this.tuneCategories)) {
      const kids = cat.folders;
      let any = false;
      for (const k of kids) {
        const hit = !q || k._title.toLowerCase().includes(q) || cat._title.toLowerCase().includes(q);
        k.show(hit);
        any ||= hit;
      }
      cat.show(any);
      if (q && any) cat.open();
    }
  }

  /** Every control that follows the picked vehicle is rebuilt when it changes, so it only lists what that vehicle has. */
  buildVehicles() {
    const g = this.game;
    const self = this;
    const pick = { vehicle: '' };
    const options = { 'Follow me (the one I am on or looking at)': '' };
    for (const u of g.units) options[`${u.name} (${u.label})`] = u.id;
    const f = this.addFolder('Vehicles', 'Which vehicle');
    f.add(pick, 'vehicle', options).name('Vehicle').onChange((v) => {
      this.pickedId = v || null;
      this.rebuildVehicle();
    });
    this.vehicleHeading = {
      get now() {
        return `${self.unit().name}${self.pickedId ? '' : ' (following you)'}`;
      },
      get problems() {
        return problemSummary(self.unit());
      },
    };
    f.add(this.vehicleHeading, 'now').name('Showing').listen().disable();
    f.add(this.vehicleHeading, 'problems').name('Wrong with it').listen().disable();
  }

  buildVehicleFolders() {
    this.vehicleFolders = {
      running: this.addFolder('Vehicles', 'Running'),
      problems: this.addFolder('Vehicles', 'Problems (drag to set, 0 clears)'),
      quirks: this.addFolder('Vehicles', 'Quirks (untick to remove)'),
      tyres: this.addFolder('Vehicles', 'Tyres'),
      character: this.addFolder('Vehicles', 'How this one was dealt'),
    };
    this.trace = new Trace();
    this.buildTraceGraph(this.vehicleFolders.running);
    this.rebuildVehicle();
  }

  /** The graph of revs, speed, wheel slip and throttle over the last ten seconds, at the top of Running (a canvas, so rebuilding the rows leaves it be). */
  buildTraceGraph(folder) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding:4px 6px';
    this.traceCanvas = document.createElement('canvas');
    this.traceCanvas.width = 320;
    this.traceCanvas.height = 90;
    this.traceCanvas.style.cssText = 'width:100%;height:90px;background:#111;display:block';
    const key = document.createElement('div');
    key.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;font-size:10px;margin-top:2px';
    this.traceKey = TRACE_LINES.map((l) => {
      const span = document.createElement('span');
      span.style.color = l.colour;
      key.appendChild(span);
      return span;
    });
    wrap.append(this.traceCanvas, key);
    folder.$children.prepend(wrap);
  }

  /** Takes this moment's sample and redraws the graph. */
  updateTrace(dt) {
    const u = this.unit();
    this.trace.tick(dt, () => ({
      rpm: u.engine.rpm,
      speed: Math.abs(u.quad.speed),
      slip: u.quad.physics.spinSlip,
      throttle: u.engine.throttle,
    }));
    const ctx = this.traceCanvas.getContext('2d');
    const { width: w, height: h } = this.traceCanvas;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#2a2a2a';
    ctx.beginPath();
    for (const f of [0.25, 0.5, 0.75]) {
      ctx.moveTo(0, h * f);
      ctx.lineTo(w, h * f);
    }
    ctx.stroke();
    const lines = this.trace.lines({ rpm: u.engine.params.maxRpm });
    lines.forEach((line, i) => {
      ctx.strokeStyle = line.colour;
      ctx.beginPath();
      // Newest on the right; a trace still filling starts part way across.
      const x0 = w - (line.values.length - 1) * (w / (this.trace.size - 1));
      line.values.forEach((v, j) => {
        const x = x0 + j * (w / (this.trace.size - 1));
        if (j === 0) ctx.moveTo(x, h - 2 - v * (h - 4));
        else ctx.lineTo(x, h - 2 - v * (h - 4));
      });
      ctx.stroke();
      const now = line.values.length ? line.values[line.values.length - 1] * line.top : 0;
      this.traceKey[i].textContent = `${line.label} ${Math.round(now * (line.key === 'rpm' ? 1 : 10)) / (line.key === 'rpm' ? 1 : 10)}`;
    });
  }

  rebuildVehicle() {
    const u = this.unit();
    this.builtFor = u.id;
    this.trace?.clear();
    for (const folder of Object.values(this.vehicleFolders)) {
      for (const c of [...folder.controllers]) c.destroy();
    }
    const unit = () => this.unit();
    const e = u.engine;
    const round = (v, n = 2) => Math.round(v * 10 ** n) / 10 ** n;
    // A read-only line, or a slider that writes back, over whichever vehicle is picked.
    const show = (f, label, get) => f.add({ get v() { return get(); } }, 'v').name(label).listen().disable();
    const set = (f, label, get, put, min, max, step = 0.01) =>
      f.add({ get v() { return get(); }, set v(x) { put(x); } }, 'v', min, max, step).name(label).listen();
    const tick = (f, label, get, put) => f.add({ get v() { return get(); }, set v(x) { put(x); } }, 'v').name(label).listen();

    const r = this.vehicleFolders.running;
    show(r, 'state', () => unit().engine.state);
    show(r, 'speed (mph)', () => round(unit().quad.speed * 2.237, 1));
    show(r, 'rpm', () => Math.round(unit().engine.rpm));
    show(r, 'throttle', () => round(unit().engine.throttle));
    show(r, 'load / lug', () => `${round(unit().engine.load)} / ${round(unit().engine.lug)}`);
    show(r, 'power', () => round(unit().engine.power));
    show(r, 'on the tow rope', () => (this.game.towRope.target === unit().quad ? (this.game.towRope.tight ? `tight, ${Math.round(this.game.towRope.force)} N` : 'slack') : this.game.towRope.puller === unit().quad ? `pulling the ${this.game.towRope.target?.unit?.label ?? 'rope'}` : 'no'));
    show(r, 'on the bale trailer', () => (unit().quad.loadedOn ? (this.game.trailer.load.mode === 'aboard' ? (this.game.trailer.load.strapped ? 'strapped on' : 'on, loose') : 'on the ramps') : 'no'));
    show(r, 'trailer hitch angle (deg)', () => { const t = this.game.trailerOf(unit().quad); return t ? `${Math.round((t.motion.hitchAngle * 180) / Math.PI)}${t.motion.jammed ? ', folded' : ''}` : 'none'; });
    if (u.quad.manual) show(r, 'turned by the wheels (bump-start)', () => round(unit().engine.rollSpeed));
    set(r, 'temperature', () => round(unit().engine.temperature), (v) => unit().engine.setTemperature(v), 0, 1);
    // Heat and the rest of what the engine does that you would watch: only what this engine can do (vehicleDebug.js engineReadouts).
    for (const m of engineReadouts(e, { manual: !!u.quad.manual })) show(r, m.label, () => { const v = m.get(unit().engine); return typeof v === 'number' ? round(v) : v; });
    if (e.params.waterCooled) {
      set(r, 'coolant', () => round(unit().engine.coolant), (v) => (unit().engine.coolant = v), 0, 1);
      show(r, 'radiator fan', () => (unit().engine.fan ? 'on' : 'off'));
    }
    set(r, 'fuel (litres)', () => round(unit().quad.fuel.litres, 1), (v) => (unit().quad.fuel.litres = v), 0, u.quad.fuel.params.tankCapacity, 0.1);
    show(r, 'fuel tap', () => unit().quad.fuel.tap);
    if (!u.quad.fuel.params.noTap) show(r, 'fuel slopped away from the tap (steep bank, low tank)', () => (unit().quad.fuel.uncovered ? 'yes' : 'no'));
    // The Land Rover has a choke (Q and Z) but no fuel tap, so the tap's absence doesn't mean no choke.
    if (!u.quad.fuel.params.noTap || (u.quad.landRover && !u.quad.engine.params.compressionIgnition)) set(r, 'choke', () => round(unit().quad.choke), (v) => (unit().quad.choke = v), 0, 1, 0.1);
    if (u.quad.sump) set(r, 'engine oil', () => round(unit().quad.sump?.level ?? 0), (v) => unit().quad.sump && (unit().quad.sump.level = v), 0, unit().quad.sump?.params.maxLevel ?? 1); // the picked vehicle can change before the next rebuild (past 1 is overfilled)
    set(r, 'battery', () => round(unit().engine.battery), (v) => (unit().engine.battery = v), 0, 1);
    show(r, 'battery is', () => this.game.batteryWhere(unit()));
    show(r, 'charging (battery per minute)', () => {
      const en = unit().engine;
      return en.isRunning ? round(netCharge(en.rpm, en.params.idleRpmWarm, en.params.maxRpm, en.lightLoad, en.params.batteryChargeRate, en.params) * 60, 3) : 'not running';
    });
    show(r, 'hours', () => round(unit().quad.usage.hours));
    show(r, 'odometer / trip (mi)', () => `${unit().quad.usage.odoMiles.toFixed(2)} / ${unit().quad.tripMiles.toFixed(2)}`);
    show(r, 'chain oil (1 fresh)', () => (unit().quad.faults.hasChain ? round(unit().quad.faults.kept.chainLube) : 'no chain'));
    show(r, 'mud on your view (0 clean; open vehicles only)', () => round(lensCoverage(this.game.lens)));
    show(r, 'brakes wet (0 dry)', () => round(unit().quad.brakes.wet));
    show(r, 'ice in the throttle cable', () => round(unit().quad.iceCable.ice));
    if (u.engine.params.compressionIgnition) show(r, 'diesel waxed (0 clear)', () => round(unit().quad.fuel.wax));
    if (u.quad.carbIce.enabled) show(r, 'ice in the carb', () => round(unit().quad.carbIce.ice));
    if (u.engine.params.strokes === 2) set(r, 'plug-saver in the tank (share)', () => round(unit().quad.fuel.additive), (v) => (unit().quad.fuel.additive = v), 0, 1);
    show(r, 'water reaching the carb', () => round(unit().engine.fuelWater));
    tick(r, 'parking brake', () => !!unit().quad.parkBrake, (v) => (unit().quad.parkBrake = v));
    // The UTV's light switch, and the 2WD / 4WD switch where there is one.
    if (u.quad.lights) r.add({ get v() { return unit().quad.lights?.mode; }, set v(x) { unit().quad.lights?.set(x); } }, 'v', LIGHT_MODES).name('lights').listen();
    // The red's lights and HI / LO rockers on its switch pod (off, dipped, main beam): the same three positions, P in the game.
    if (u.quad.barLights) r.add({ get v() { return unit().quad.barLights?.mode; }, set v(x) { unit().quad.barLights?.set(x); } }, 'v', unit().quad.barLights.modes).name('lights (the bars\' pod or switch)').listen();
    if (u.quad.radio) {
      tick(r, 'radio on', () => unit().quad.radio?.on ?? false, (v) => unit().quad.radio?.set(v));
      set(r, 'radio volume', () => round(unit().quad.radio?.volume ?? 0), (v) => unit().quad.radio?.setVolume(v), 0, 1);
      show(r, 'radio (what you hear, signal)', () => (unit().quad.radio ? `${unit().quad.radio.describe()}, signal ${round(unit().quad.radio.signal)}, ${unit().quad.radio.profile.name}` : 'none'));
    }
    if (u.quad.signals) r.add({ get v() { return unit().quad.signals?.mode; }, set v(x) { unit().quad.signals?.set(x); } }, 'v', SIGNAL_MODES).name('indicators').listen();
    if (u.quad.drive) r.add({ get v() { return unit().quad.drive?.mode; }, set v(x) { if (unit().quad.drive) unit().quad.drive.mode = x; } }, 'v', u.quad.drive.hasLock ? DRIVE_MODES : ['2wd', '4wd']).name('drive').listen();
    show(r, 'mixture', () => round(unit().engine.mixture));
    show(r, 'roughness', () => round(unit().engine.roughness));
    show(r, 'erratic (needs a service)', () => round(unit().engine.erratic));
    show(r, 'shake', () => round(unit().vibration.intensity));
    show(r, 'sick (the girls keep it going)', () => {
      const k = sickness(sickEvidence(unit().quad), this.game.keepParams);
      return k.sick ? `${round(k.score)}: ${k.reasons.join(', ')}` : `no (${round(k.score)})`;
    });

    const p = this.vehicleFolders.problems;
    for (const kind of FAULT_KINDS) {
      set(p, kind, () => (unit().quad.faults.started[kind] ? round(unit().quad.faults.levels[kind]) : 0), (v) => setFault(unit().quad.faults, kind, v), 0, 1);
    }
    set(p, 'hard start (goes it took)', () => unit().quad.startTrouble, (v) => (unit().quad.startTrouble = Math.round(v)), 0, 6, 1);
    show(p, 'flat tyre (wheel)', () => unit().quad.faults.tyre);
    show(p, 'bent track rod / bent rim (wheel)', () => `${unit().quad.faults.rodWheel} / ${unit().quad.faults.rimWheel}`);
    tick(p, 'valves too tight (not worn wide)', () => unit().quad.faults.kept.valveTight, (v) => (unit().quad.faults.kept.valveTight = v));
    tick(p, 'chain off the sprocket', () => unit().quad.faults.chainOff, (v) => (unit().quad.faults.kept.chainOff = v));
    set(p, 'chain oil (0 bone dry)', () => round(unit().quad.faults.kept.chainLube), (v) => (unit().quad.faults.kept.chainLube = v), 0, 1);
    set(p, 'wet brakes', () => round(unit().quad.brakes.wet), (v) => (unit().quad.brakes.wet = v), 0, 1);
    if (u.quad.carbIce.enabled) set(p, 'iced carb (ice)', () => round(unit().quad.carbIce.ice), (v) => (unit().quad.carbIce.ice = v), 0, 1);
    if (u.engine.params.compressionIgnition) {
      set(p, 'waxed diesel (wax)', () => round(unit().quad.fuel.wax), (v) => (unit().quad.fuel.wax = v), 0, 1);
      set(p, 'anti-gel in the tank (share)', () => round(unit().quad.fuel.antiGel), (v) => (unit().quad.fuel.antiGel = v), 0, 1);
    }
    set(p, 'frozen throttle cable (ice)', () => round(unit().quad.iceCable.ice), (v) => (unit().quad.iceCable.ice = v), 0, 1);
    tick(p, 'cable freezes open (not shut)', () => unit().quad.iceCable.mode === 'open', (v) => (unit().quad.iceCable.mode = v ? 'open' : 'shut'));
    tick(p, 'brake binding (rides free)', () => unit().quad.brakes.binding, (v) => unit().quad.brakes.setBinding(v));
    set(p, 'plug fouling', () => round(unit().engine.fouling), (v) => (unit().engine.fouling = v), 0, 1);
    set(p, 'air filter clogged', () => round(unit().engine.clog), (v) => (unit().engine.clog = v), 0, 1);
    set(p, 'wear (a service clears it)', () => round(unit().engine.wear), (v) => (unit().engine.wear = v), 0, e.params.wearMax ?? 1);
    set(p, 'scuffing (1 seizes it)', () => round(unit().engine.scuff), (v) => (unit().engine.scuff = v), 0, 1);
    tick(p, 'seized', () => unit().engine.seized, (v) => (unit().engine.seized = v));
    if (e.params.waterCooled) set(p, 'thermostat stuck shut', () => round(unit().engine.thermostat), (v) => (unit().engine.thermostat = v), 0, 1);
    set(p, 'water in it', () => round(unit().engine.water), (v) => (unit().engine.water = v), 0, 1);
    set(p, 'water in the fuel (fraction)', () => round(unit().quad.fuel.water), (v) => (unit().quad.fuel.water = v), 0, 0.3);
    set(p, 'tap bowl full of water', () => round(unit().quad.fuel.sediment), (v) => (unit().quad.fuel.sediment = v), 0, 1);
    set(p, 'diesel soaked', () => round(unit().engine.dieselSoak), (v) => (unit().engine.dieselSoak = v), 0, 1);
    if (e.params.strokes === 2) set(p, 'silencer blown', () => round(unit().engine.silencerBlown), (v) => (unit().engine.silencerBlown = v), 0, 1);
    show(p, 'running in / scar', () => `${round(unit().engine.runIn)} / ${round(unit().engine.scar)}`);
    const buttons = {
      clearFaults: () => clearFaults(unit().quad.faults),
      batteryOut: () => this.game.debugBatteryOut(unit()),
      batteryIn: () => this.game.debugBatteryIn(unit()),
      fix: () => (fixEverything(unit()), this.game.debugBatteryIn(unit())),
      crash: () => unit().quad.crashHeadOn(1),
    };
    p.add(buttons, 'crash').name('Hit a post head-on (bends a rod?)');
    p.add(buttons, 'clearFaults').name('Clear the faults');
    p.add(buttons, 'batteryOut').name('Take the battery out (stands by it)');
    p.add(buttons, 'batteryIn').name('Put the battery back in');
    p.add(buttons, 'fix').name('Put everything right (not quirks)');

    const qf = this.vehicleFolders.quirks;
    const applicable = applicableQuirks(featuresOf(u.spec, !!this.game.podRack.podOn(u.id)));
    for (const kind of applicable) tick(qf, quirkLabel(kind), () => unit().quad.quirks.has(kind), (v) => setQuirk(unit().quad.quirks, kind, v));
    qf.add({ none: () => [...unit().quad.quirks.kinds].forEach((k) => setQuirk(unit().quad.quirks, k, false)) }, 'none').name('Remove them all');
    if (applicable.includes('tapStiff')) set(qf, 'tap stiffness (1 stuck, 0 free)', () => round(unit().quad.quirks.tapStiff), (v) => (unit().quad.quirks.tapStiff = v), 0, 1);
    if (applicable.includes('seatSplit')) set(qf, 'seat wetness', () => round(unit().quad.quirks.seatWet), (v) => (unit().quad.quirks.seatWet = v), 0, 1);

    const t = this.vehicleFolders.tyres;
    WHEEL_NAMES.forEach((name, i) => set(t, `${name} psi`, () => round(unit().quad.tyres.psi[i], 1), (v) => { unit().quad.tyres.psi[i] = v; unit().quad.physics.applyParams(); }, 0.5, 7, 0.1));
    show(t, 'off the rim (per wheel)', () => [0, 1, 2, 3].map((i) => unit().quad.tyres.rimLevel(i).toFixed(2)).join('  '));
    show(t, 'front tyres', () => `${BRANDS[unit().quad.tyres.brand.front].label}, tread ${unit().quad.tyres.tread.front.toFixed(2)}`);
    show(t, 'rear tyres', () => `${BRANDS[unit().quad.tyres.brand.rear].label}, tread ${unit().quad.tyres.tread.rear.toFixed(2)}`);
    show(t, 'grip on grass (per wheel)', () => [0, 1, 2, 3].map((i) => unit().quad.tyres.grip(i, 0, 0).toFixed(2)).join('  '));
    show(t, 'grip in mud (per wheel)', () => [0, 1, 2, 3].map((i) => unit().quad.tyres.grip(i, 1, 0).toFixed(2)).join('  '));

    // What this game dealt it, which doesn't change while you play.
    const c = this.vehicleFolders.character;
    show(c, 'idle (rpm)', () => Math.round(unit().idleRpm ?? 0));
    show(c, 'top revs (rpm)', () => Math.round(unit().topRpm ?? 0));
    for (const kind of FAULT_KINDS) {
      show(c, `${kind} luck`, () => `x${unit().quad.faults.prone[kind].toFixed(2)} often, x${unit().quad.faults.worsens[kind].toFixed(2)} fast`);
    }
    show(c, 'where it started', () => unit().where ?? '');
    this.applyVisibility?.();
  }

  /** Things to do to the picked vehicle, then to all of them. */
  buildVehicleActions() {
    const g = this.game;
    const startOne = startWarm;
    const stopOne = switchOff;
    const one = this.addFolder('Vehicles', 'Do something to this vehicle');
    const row = (f, label, fn) => f.add({ fn }, 'fn').name(label);
    row(one, 'Start it (warm, fuel on)', () => startOne(this.unit()));
    row(one, 'Switch it off (fuel off)', () => stopOne(this.unit()));
    row(one, 'Warm it up', () => this.unit().engine.setTemperature(1));
    row(one, 'Cool it right down', () => this.unit().engine.setTemperature(0));
    row(one, 'Turn every radio on', () => g.setAllRadios(true));
    row(one, 'Turn every radio off', () => g.setAllRadios(false));
    row(one, 'Fill the tank', () => (this.unit().quad.fuel.litres = this.unit().quad.fuel.params.tankCapacity));
    row(one, 'Winch it onto the bale trailer', () => g.hud.toast(g.debugLoad(this.unit())));
    row(one, 'Pay it back off the trailer', () => g.hud.toast(g.debugUnload(this.unit())));
    row(one, 'Hook the tow rope on it / take it off', () => g.hud.toast(g.debugTowRope(this.unit())));
    row(one, 'Jack-knife the trailer on it', () => g.hud.toast(g.debugJackknife(this.unit())));
    row(one, 'Straighten the trailer on it', () => g.hud.toast(g.debugJackknife(this.unit(), false)));
    row(one, 'Put it right (faults, plug, filter, wear; not quirks)', () => (fixEverything(this.unit()), g.debugBatteryIn(this.unit()), g.trailerOf(this.unit().quad)?.motion.jammed && g.debugJackknife(this.unit(), false)));
    row(one, 'Splat mud on the lens', () => g.debugLens('splat'));
    row(one, 'Wipe the lens (once smears, twice clears)', () => g.debugLens('wipe'));
    row(one, 'Take me to it', () => {
      const q = this.unit().quad;
      if (g.riddenUnit) return g.hud.toast('Get off first');
      g.player.moveTo({ x: q.position.x + 2.5, y: g.world.heightAt(q.position.x + 2.5, q.position.z) + 0.5, z: q.position.z });
    });
    row(one, 'Put it back where it started', () => this.unit().resetToSpawn(g.world));
    const all = this.addFolder('Vehicles', 'Do something to every vehicle');
    row(all, 'Start them all (warm, fuel on)', () => g.units.forEach(startOne));
    row(all, 'Switch them all off (fuel off)', () => g.units.forEach(stopOne));
    row(all, 'Warm them all up', () => g.units.forEach((u) => u.engine.setTemperature(1)));
    row(all, 'Put them all right (not quirks)', () => g.units.forEach((u) => (fixEverything(u), g.debugBatteryIn(u))));
    row(all, 'Put them all back in the yard', () => g.units.forEach((u) => u.resetToSpawn(g.world)));
    all.close();
  }

  /** While the panel is open and following you, rebuild the Vehicles tab when the vehicle you are on or looking at changes. */
  watch() {
    if (!this.visible) return;
    if (!this.pickedId && this.unit().id !== this.builtFor) this.rebuildVehicle();
    const now = performance.now();
    if (this.tab === 'Vehicles') this.updateTrace(Math.min(0.25, (now - (this.lastWatch ?? now)) / 1000));
    this.lastWatch = now;
    requestAnimationFrame(() => this.watch());
  }

  toggle() {
    this.visible = !this.visible;
    if (this.visible) {
      this.gui.show();
      this.game.input.exitPointerLock();
      this.lastWatch = undefined;
      this.watch();
    } else {
      this.gui.hide();
      this.game.input.requestPointerLock();
    }
    document.getElementById('overlay').classList.toggle('tuning', this.visible);
  }
}
