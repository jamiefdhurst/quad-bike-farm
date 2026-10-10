import GUI from 'lil-gui';
import { getTuningGroups, exportTuning } from '../core/tuning.js';
import { FAULT_KINDS } from '../vehicle/faults.js';
import { applicableQuirks, featuresOf } from '../vehicle/quirks.js';
import { categoryOf, sortTuneGroups } from './tuneCategories.js';
import { buildGirlsTab } from './girlsTab.js';
import { setQuirk, setFault, clearFaults, fixEverything, problemSummary, quirkLabel, startWarm, switchOff } from './vehicleDebug.js';
import { BRANDS, WHEEL_NAMES } from '../vehicle/tyres.js';
import { LIGHT_MODES } from '../vehicle/lightSwitch.js';
import { SIGNAL_MODES } from '../vehicle/indicators.js';
import { DRIVE_MODES } from '../vehicle/driveMode.js';

/**
 * lil-gui panel built from the tuning registry, plus live engine readouts and
 * a few shortcuts. Hidden until backtick is pressed.
 */
export class DebugGui {
  constructor(game) {
    this.game = game;
    this.gui = new GUI({ title: 'Debug  ( ` to hide )', width: 340 });
    this.gui.hide();
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
    this.rebuildVehicle();
  }

  rebuildVehicle() {
    const u = this.unit();
    this.builtFor = u.id;
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
    if (u.quad.manual) show(r, 'turned by the wheels (bump-start)', () => round(unit().engine.rollSpeed));
    set(r, 'temperature', () => round(unit().engine.temperature), (v) => unit().engine.setTemperature(v), 0, 1);
    show(r, 'overheating', () => round(unit().engine.heat));
    if (e.params.waterCooled) {
      set(r, 'coolant', () => round(unit().engine.coolant), (v) => (unit().engine.coolant = v), 0, 1);
      show(r, 'radiator fan', () => (unit().engine.fan ? 'on' : 'off'));
    }
    set(r, 'fuel (litres)', () => round(unit().quad.fuel.litres, 1), (v) => (unit().quad.fuel.litres = v), 0, u.quad.fuel.params.tankCapacity, 0.1);
    show(r, 'fuel tap', () => unit().quad.fuel.tap);
    // The Land Rover has a choke (Q and Z) but no fuel tap, so the tap's absence doesn't mean no choke.
    if (!u.quad.fuel.params.noTap || (u.quad.landRover && !u.quad.engine.params.compressionIgnition)) set(r, 'choke', () => round(unit().quad.choke), (v) => (unit().quad.choke = v), 0, 1, 0.1);
    if (u.quad.sump) set(r, 'engine oil', () => round(unit().quad.sump.level), (v) => (unit().quad.sump.level = v), 0, 1);
    set(r, 'battery', () => round(unit().engine.battery), (v) => (unit().engine.battery = v), 0, 1);
    show(r, 'hours', () => round(unit().quad.usage.hours));
    show(r, 'odometer / trip (mi)', () => `${unit().quad.usage.odoMiles.toFixed(2)} / ${unit().quad.tripMiles.toFixed(2)}`);
    tick(r, 'parking brake', () => !!unit().quad.parkBrake, (v) => (unit().quad.parkBrake = v));
    // The UTV's light switch, and the 2WD / 4WD switch where there is one.
    if (u.quad.lights) r.add({ get v() { return unit().quad.lights?.mode; }, set v(x) { unit().quad.lights?.set(x); } }, 'v', LIGHT_MODES).name('lights').listen();
    if (u.quad.signals) r.add({ get v() { return unit().quad.signals?.mode; }, set v(x) { unit().quad.signals?.set(x); } }, 'v', SIGNAL_MODES).name('indicators').listen();
    if (u.quad.drive) r.add({ get v() { return unit().quad.drive?.mode; }, set v(x) { if (unit().quad.drive) unit().quad.drive.mode = x; } }, 'v', u.quad.drive.hasLock ? DRIVE_MODES : ['2wd', '4wd']).name('drive').listen();
    show(r, 'mixture', () => round(unit().engine.mixture));
    show(r, 'roughness', () => round(unit().engine.roughness));
    show(r, 'erratic (needs a service)', () => round(unit().engine.erratic));
    show(r, 'shake', () => round(unit().vibration.intensity));

    const p = this.vehicleFolders.problems;
    for (const kind of FAULT_KINDS) {
      set(p, kind, () => (unit().quad.faults.started[kind] ? round(unit().quad.faults.levels[kind]) : 0), (v) => setFault(unit().quad.faults, kind, v), 0, 1);
    }
    show(p, 'flat tyre (wheel)', () => unit().quad.faults.tyre);
    set(p, 'plug fouling', () => round(unit().engine.fouling), (v) => (unit().engine.fouling = v), 0, 1);
    set(p, 'air filter clogged', () => round(unit().engine.clog), (v) => (unit().engine.clog = v), 0, 1);
    set(p, 'wear (a service clears it)', () => round(unit().engine.wear), (v) => (unit().engine.wear = v), 0, e.params.wearMax ?? 1);
    set(p, 'scuffing (1 seizes it)', () => round(unit().engine.scuff), (v) => (unit().engine.scuff = v), 0, 1);
    tick(p, 'seized', () => unit().engine.seized, (v) => (unit().engine.seized = v));
    set(p, 'water in it', () => round(unit().engine.water), (v) => (unit().engine.water = v), 0, 1);
    set(p, 'diesel soaked', () => round(unit().engine.dieselSoak), (v) => (unit().engine.dieselSoak = v), 0, 1);
    if (e.params.strokes === 2) set(p, 'silencer blown', () => round(unit().engine.silencerBlown), (v) => (unit().engine.silencerBlown = v), 0, 1);
    show(p, 'running in / scar', () => `${round(unit().engine.runIn)} / ${round(unit().engine.scar)}`);
    const buttons = {
      clearFaults: () => clearFaults(unit().quad.faults),
      fix: () => fixEverything(unit()),
    };
    p.add(buttons, 'clearFaults').name('Clear the faults');
    p.add(buttons, 'fix').name('Put everything right (not quirks)');

    const qf = this.vehicleFolders.quirks;
    const applicable = applicableQuirks(featuresOf(u.spec, !!this.game.podRack.podOn(u.id)));
    for (const kind of applicable) tick(qf, quirkLabel(kind), () => unit().quad.quirks.has(kind), (v) => setQuirk(unit().quad.quirks, kind, v));
    qf.add({ none: () => [...unit().quad.quirks.kinds].forEach((k) => setQuirk(unit().quad.quirks, k, false)) }, 'none').name('Remove them all');
    if (applicable.includes('tapStiff')) set(qf, 'tap stiffness (1 stuck, 0 free)', () => round(unit().quad.quirks.tapStiff), (v) => (unit().quad.quirks.tapStiff = v), 0, 1);
    if (applicable.includes('seatSplit')) set(qf, 'seat wetness', () => round(unit().quad.quirks.seatWet), (v) => (unit().quad.quirks.seatWet = v), 0, 1);

    const t = this.vehicleFolders.tyres;
    WHEEL_NAMES.forEach((name, i) => set(t, `${name} psi`, () => round(unit().quad.tyres.psi[i], 1), (v) => { unit().quad.tyres.psi[i] = v; unit().quad.physics.applyParams(); }, 1.5, 7, 0.1));
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
    row(one, 'Fill the tank', () => (this.unit().quad.fuel.litres = this.unit().quad.fuel.params.tankCapacity));
    row(one, 'Put it right (faults, plug, filter, wear; not quirks)', () => fixEverything(this.unit()));
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
    row(all, 'Put them all right (not quirks)', () => g.units.forEach(fixEverything));
    row(all, 'Put them all back in the yard', () => g.units.forEach((u) => u.resetToSpawn(g.world)));
    all.close();
  }

  /** While the panel is open and following you, rebuild the Vehicles tab when the vehicle you are on or looking at changes. */
  watch() {
    if (!this.visible) return;
    if (!this.pickedId && this.unit().id !== this.builtFor) this.rebuildVehicle();
    requestAnimationFrame(() => this.watch());
  }

  toggle() {
    this.visible = !this.visible;
    if (this.visible) {
      this.gui.show();
      this.game.input.exitPointerLock();
      this.watch();
    } else {
      this.gui.hide();
      this.game.input.requestPointerLock();
    }
    document.getElementById('overlay').classList.toggle('tuning', this.visible);
  }
}
