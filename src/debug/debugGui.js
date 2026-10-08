import GUI from 'lil-gui';
import { getTuningGroups, exportTuning } from '../core/tuning.js';
import { pickTrick } from '../npc/showOff.js';
import { FAULT_KINDS } from '../vehicle/faults.js';
import { applicableQuirks, featuresOf } from '../vehicle/quirks.js';
import { setQuirk, setFault, clearFaults, fixEverything, problemSummary, quirkLabel } from './vehicleDebug.js';
import { BRANDS, WHEEL_NAMES } from '../vehicle/tyres.js';
import { rampPoint } from '../npc/jumps.js';

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
    this.tabs = { Vehicles: [], Girls: [], Tune: [], Actions: [] };
    this.tab = 'Vehicles';
    this.search = { text: '' };
    this.vehicleTuning = {}; // each vehicle's own registered tuning folders, shown for the picked one
    const unitNames = new Set(game.units.map((u) => u.name));

    this.buildVehicles();
    this.buildFavour();
    this.buildFallingOut();
    this.buildSkills();
    this.buildLPlates();
    this.buildGirls();
    this.buildActions();
    this.searchFolder = this.addFolder('Tune', 'Search');
    this.searchFolder.add(this.search, 'text').name('Find a folder').onChange(() => this.applyVisibility());
    const folders = {};
    // "Red quad/Engine" becomes an Engine folder inside a Red quad folder.
    const folderFor = (path) => {
      if (folders[path]) return folders[path];
      const cut = path.lastIndexOf('/');
      const parent = cut < 0 ? this.gui : folderFor(path.slice(0, cut));
      const f = parent.addFolder(path.slice(cut + 1));
      if (cut < 0) {
        if (unitNames.has(path)) this.vehicleTuning[path] = f;
        else this.tabs.Tune.push(f);
        if (unitNames.has(path)) this.tabs.Vehicles.push(f);
      }
      f.close();
      folders[path] = f;
      return f;
    };
    for (const group of getTuningGroups()) {
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

  /** On the Vehicles tab only the picked vehicle's own tuning shows; on the Tune tab the search narrows the folders. */
  applyVisibility() {
    const u = this.unit();
    if (this.tab === 'Vehicles') for (const [name, f] of Object.entries(this.vehicleTuning)) f.show(name === u.name);
    if (this.tab === 'Tune') {
      const q = this.search.text.trim().toLowerCase();
      for (const f of this.tabs.Tune) if (f !== this.searchFolder) f.show(!q || f._title.toLowerCase().includes(q));
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
    show(r, 'rpm', () => Math.round(unit().engine.rpm));
    show(r, 'speed (mph)', () => round(unit().quad.speed * 2.237, 1));
    show(r, 'throttle', () => round(unit().engine.throttle));
    show(r, 'load / lug', () => `${round(unit().engine.load)} / ${round(unit().engine.lug)}`);
    show(r, 'power', () => round(unit().engine.power));
    show(r, 'mixture', () => round(unit().engine.mixture));
    show(r, 'roughness', () => round(unit().engine.roughness));
    show(r, 'erratic (needs a service)', () => round(unit().engine.erratic));
    show(r, 'shake', () => round(unit().vibration.intensity));
    set(r, 'temperature', () => round(unit().engine.temperature), (v) => unit().engine.setTemperature(v), 0, 1);
    show(r, 'overheating', () => round(unit().engine.heat));
    set(r, 'battery', () => round(unit().engine.battery), (v) => (unit().engine.battery = v), 0, 1);
    set(r, 'fuel (litres)', () => round(unit().quad.fuel.litres, 1), (v) => (unit().quad.fuel.litres = v), 0, u.quad.fuel.params.tankCapacity, 0.1);
    show(r, 'fuel tap', () => unit().quad.fuel.tap);
    if (!u.quad.fuel.params.noTap) show(r, 'choke', () => round(unit().quad.choke));
    if (u.quad.sump) set(r, 'engine oil', () => round(unit().quad.sump.level), (v) => (unit().quad.sump.level = v), 0, 1);
    if (e.params.waterCooled) {
      set(r, 'coolant', () => round(unit().engine.coolant), (v) => (unit().engine.coolant = v), 0, 1);
      show(r, 'radiator fan', () => (unit().engine.fan ? 'on' : 'off'));
    }
    show(r, 'hours', () => round(unit().quad.usage.hours));
    show(r, 'odometer / trip (mi)', () => `${unit().quad.usage.odoMiles.toFixed(2)} / ${unit().quad.tripMiles.toFixed(2)}`);
    tick(r, 'parking brake', () => !!unit().quad.parkBrake, (v) => (unit().quad.parkBrake = v));

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
    p.add(buttons, 'clearFaults').name('Clear the four faults');
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

  /** Who you favour: each girl's score, where she stands against her friend, and buttons to push it either way. */
  buildFavour() {
    const favour = this.game.favour;
    const f = this.addFolder('Girls', 'Favour (live): how each girl rates you');
    const live = {};
    const nudges = {};
    for (const id of favour.ids) {
      const name = id[0].toUpperCase() + id.slice(1);
      Object.defineProperty(live, `${id} score`, { enumerable: true, get: () => Math.round(favour.scores[id] * 100) / 100 });
      Object.defineProperty(live, `${id} standing`, { enumerable: true, get: () => `${Math.round(favour.standing(id) * 100) / 100} (${favour.mood(id)})` });
      nudges[`Favour ${name} +5`] = () => favour.add(id, 5);
      nudges[`Neglect ${name} -5`] = () => favour.add(id, -5);
    }
    for (const key of Object.keys(live)) f.add(live, key).listen().disable();
    for (const key of Object.keys(nudges)) f.add(nudges, key);
    nudges['Reset both'] = () => favour.ids.forEach((id) => (favour.scores[id] = 0));
    f.add(nudges, 'Reset both');
  }

  /** Whether the girls are fallen out, how much friction there is, and buttons to start or end one (npc/fallingOut.js). */
  buildFallingOut() {
    const fo = this.game.fallingOut;
    const f = this.addFolder('Girls', 'Falling out (live): the girls and each other');
    const live = {};
    Object.defineProperty(live, 'fallen out', { enumerable: true, get: () => (fo.active ? `yes, ${fo.cause.kind} (${fo.fault} at fault)` : 'no') });
    Object.defineProperty(live, 'friction', { enumerable: true, get: () => Math.round(fo.friction * 10) / 10 });
    Object.defineProperty(live, 'seconds left', { enumerable: true, get: () => Math.round(fo.remaining) });
    for (const key of Object.keys(live)) f.add(live, key).listen().disable();
    const actions = {
      'Fall out now': () => !fo.active && this.game.handleFallingOut(fo.begin('digs')),
      'Make up now': () => fo.active && this.game.handleFallingOut(fo.end()),
    };
    for (const key of Object.keys(actions)) f.add(actions, key);
  }

  /** Buttons to put the L plates on Amy's quad or the tractor, or take them off, so you can see them (npc/lPlates.js). */
  buildLPlates() {
    const l = this.game.lPlates;
    const f = this.addFolder('Girls', 'L plates (live)');
    f.add(l, 'where').listen().disable();
    const actions = { quad: () => l.put('quad'), tractor: () => l.put('tractor'), off: () => l.put('none') };
    f.add(actions, 'quad').name("Put them on Amy's quad");
    f.add(actions, 'tractor').name('Put them on the tractor');
    f.add(actions, 'off').name('Take them off');
  }

  /** What each girl is good at, live, with buttons to push a skill up or down. */
  buildSkills() {
    const skills = this.game.skills;
    const f = this.addFolder('Girls', 'Skills (live): what each girl is good at');
    for (const id of skills.ids) {
      for (const skill of Object.keys(skills.levels[id])) {
        const row = {
          get level() {
            return Math.round(skills.level(id, skill) * 100) / 100;
          },
          set level(v) {
            skills.set(id, skill, v);
          },
        };
        f.add(row, 'level', 0, 1, 0.01).name(`${id} ${skill}`).listen();
      }
    }
  }

  /** Whose quad is whose, what the quads are called, the race score, and buttons to start things that are otherwise left to chance. */
  buildGirls() {
    const g = this.game;
    const f = this.addFolder('Girls', 'Girls (live): quads, names, racing');
    const live = {};
    const cap = (s) => s[0].toUpperCase() + s.slice(1);
    for (const c of g.companions) {
      const id = c.character.id;
      Object.defineProperty(live, `${cap(id)}'s quad`, { enumerable: true, get: () => g.ownership.claims[id] ?? 'none' });
    }
    for (const u of g.girlUnits) {
      Object.defineProperty(live, `${u.spec.id} quad`, {
        enumerable: true,
        get: () => `${g.ownership.ownerOf(u.spec.id) ?? 'nobody'}'s${g.quadNames.names[u.spec.id] ? ` (${g.quadNames.names[u.spec.id]}${g.quadNames.announced.has(u.spec.id) ? '' : ', not said yet'})` : ''}`,
      });
    }
    Object.defineProperty(live, 'Day temperature', { enumerable: true, get: () => `${g.weather.temperature} °C (${g.weather.band}), chill ${g.weather.chill.toFixed(2)}, frost ${g.weather.frost.toFixed(2)}` });
    Object.defineProperty(live, 'Race', { enumerable: true, get: () => g.race.phase });
    Object.defineProperty(live, 'Follow the leader', { enumerable: true, get: () => (g.convoy.active ? `${g.convoy.phase}: ${g.convoy.leader} leads, ${g.convoy.swapsDone} swaps` : 'idle') });
    Object.defineProperty(live, 'Race score', { enumerable: true, get: () => g.companions.map((c) => `${cap(c.character.id)} ${g.race.tally[c.character.id]?.wins ?? 0}-${g.race.tally[c.character.id]?.losses ?? 0}`).join(', ') });
    Object.defineProperty(live, 'Throttle grab', { enumerable: true, get: () => g.throttleGrab.grab?.girl ? `${g.throttleGrab.grab.girl} (${g.throttleGrab.grab.phase})` : g.throttleGrab.forced ? `${g.throttleGrab.forced} waiting` : 'none' });
    Object.defineProperty(live, 'Jump', {
      enumerable: true,
      get: () => {
        const c = g.companions.find((o) => o.fsm.is('driving') && o.drive?.jump);
        const run = c?.drive.jump.run;
        return run ? `${c.character.id}: ${run.phase}, go ${run.went + 1} of ${run.goes}` : 'nobody';
      },
    });
    Object.defineProperty(live, 'Last jump', {
      enumerable: true,
      get: () => (g.lastJump ? `${g.lastJump.girl}: ${g.lastJump.rating} (air ${g.lastJump.air.toFixed(2)} s, level ${g.lastJump.upY.toFixed(2)}, down ${g.lastJump.impact.toFixed(1)} m/s)` : 'none yet'),
    });
    Object.defineProperty(live, 'Jump score', { enumerable: true, get: () => g.companions.map((c) => { const s = g.jumpWatch.score[c.character.id]; return `${cap(c.character.id)} ${s ? `${s.jumps} jumps, ${s.great} great, ${s.bails} bails` : 'none'}`; }).join('; ') });
    for (const c of g.companions) Object.defineProperty(live, `${cap(c.character.id)} tidying`, { enumerable: true, get: () => c.lineUpStatus });
    for (const key of Object.keys(live)) f.add(live, key).listen().disable();
    const actions = {
      race: () => {
        if (g.race.active) return g.hud.toast('A race is already on');
        g.race.forced = true;
        g.hud.toast('A race will start as soon as both girls are stood about (and not on a quad)');
      },
      drag: () => {
        if (g.race.active || g.drag.active) return g.hud.toast('A race is already on');
        g.drag.forced = true;
        g.hud.toast('A drag race will start as soon as both girls are stood about, with you on a quad');
      },
      grabJess: () => {
        g.throttleGrab.forced = 'jess';
        g.hud.toast('Ride with Jess on the back (moving): she will grab the throttle');
      },
      grabAmy: () => {
        g.throttleGrab.forced = 'amy';
        g.hud.toast('Ride with Amy on the back (moving): she will grab the throttle');
      },
      names: () => {
        g.quadNames.p.firstNameAfter = 0;
        g.quadNames.p.nameEvery = 5;
        g.quadNames.nextAt = 0;
        g.hud.toast('Jess will name the quads, one every 5 seconds, when she is free and you are near');
      },
    };
    actions.recall = () => g.recallGirls();
    f.add(actions, 'recall').name('Call the girls back to the barn (as the bell does)');
    actions.convoy = () => {
      if (g.convoy.active) return g.hud.toast('They are already out');
      g.convoy.forced = true;
      g.hud.toast('Follow the leader will start as soon as both girls are stood about');
    };
    actions.tea = () => {
      g.tea.forced = true;
      g.hud.toast('A free girl will put her tea on a rack');
    };
    for (const id of ['amy', 'jess']) {
      const name = id[0].toUpperCase() + id.slice(1);
      actions[`jumper_${id}`] = () => {
        const what = g.jumpers.toggle(id);
        g.hud.toast(what === 'fetch' ? `${name} will go and put a jumper on once she is stood about` : `${name} will go and hang her jumper up once she is stood about`);
      };
    }
    actions.diesel = () => {
      g.dieselMistake.forced = true;
      g.hud.toast('Jess will fill a parked quad from the diesel can as soon as she is stood about');
    };
    const girl = (id) => g.companions.find((c) => c.character.id === id);
    const free = (c) => (c.fsm.is('idle') ? true : g.hud.toast(`${cap(c.character.id)} is busy: call her back to the barn first (the bell)`) && false);
    actions.lineUp = () => {
      const c = girl('amy');
      if (!free(c)) return;
      const job = c.planLineUp(0);
      if (!job) return g.hud.toast('The quads are already in a row (or none are free)');
      c.lineUpOn = true;
      c.startLineUp(job);
      g.hud.toast('Amy is tidying the quads into a row in front of the barn');
    };
    actions.crooked = () => {
      const c = girl('jess');
      if (!free(c)) return;
      const job = c.planLineUp(1);
      if (!job) return g.hud.toast('No free quad');
      c.startLineUp(job);
      g.hud.toast('Jess will park one crooked, then Amy will notice');
    };
    actions.doughnuts = () => {
      const c = girl('jess');
      if (!free(c)) return;
      const quads = g.girlUnits.map((u) => u.quad).filter((q) => c.mayRide(q) && c.canDrive(q) && !c.takenByOther(q) && q.position.distanceTo(c.root.position) < 60);
      quads.sort((a, b) => a.position.distanceTo(c.root.position) - b.position.distanceTo(c.root.position));
      const plan = c.doughnutPlan();
      if (!quads.length || !plan) return g.hud.toast('Jess cannot find a free quad or a clear stretch of field');
      c.selfEvents.push('doughnuts');
      c.requestDrive(quads[0], { doughnut: plan });
      g.hud.toast('Jess is off to spin doughnuts');
    };
    f.add(actions, 'lineUp').name('Amy lines the quads up by the barn');
    f.add(actions, 'crooked').name('Jess parks one crooked');
    actions.nick = () => {
      const c = girl('jess');
      if (!free(c)) return;
      const quads = g.girlUnits.map((u) => u.quad).filter((q) => c.mayRide(q) && c.canDrive(q) && !c.takenByOther(q) && !q.rider);
      quads.sort((a, b) => a.position.distanceTo(g.player.position) - b.position.distanceTo(g.player.position));
      if (!quads.length) return g.hud.toast('No free quad');
      g.startNick(c, quads[0]);
      g.hud.toast(`Jess is off with the ${quads[0].label}`);
    };
    actions.showOff = () => {
      const c = girl('jess');
      if (!free(c)) return;
      const quads = g.girlUnits.map((u) => u.quad).filter((q) => !q.tractor && c.mayRide(q) && c.canDrive(q) && !c.takenByOther(q) && !q.rider);
      quads.sort((a, b) => (b.engine.params.strokes === 2) - (a.engine.params.strokes === 2) || a.position.distanceTo(c.root.position) - b.position.distanceTo(c.root.position));
      if (!quads.length) return g.hud.toast('No free quad');
      c.selfEvents.push('showOff');
      c.requestDrive(quads[0], { showOff: { trick: pickTrick(quads[0].engine.params.strokes === 2, g.showOffParams), p: g.showOffParams } });
      g.hud.toast(`Jess is off to show off on the ${quads[0].label}`);
    };
    f.add(actions, 'doughnuts').name('Jess does doughnuts');
    f.add(actions, 'showOff').name('Jess shows off to you');
    for (const id of ['jess', 'amy']) {
      const name = id[0].toUpperCase() + id.slice(1);
      actions[`jump_${id}`] = () => {
        const c = girl(id);
        if (!free(c)) return;
        c.selfEvents.push('jumps');
        if (!g.sendToRamp(c)) g.hud.toast(`${name} cannot find a free quad, or the line to the ramp is blocked`);
        else g.hud.toast(`${name} is off to jump the ramp (the other girl may take a turn after)`);
      };
      f.add(actions, `jump_${id}`).name(`${name} jumps the ramp`);
    }
    actions.toRamp = () => {
      const r = g.world.layout.jumpRamp;
      if (!r) return;
      // Stood beside the lip, looking back down the run-up, off the line.
      const at = rampPoint(r, r.length * 0.6, 3.5);
      if (g.riddenUnit) return g.hud.toast('Get off first');
      g.player.moveTo({ x: at.x, y: g.world.heightAt(at.x, at.z) + 0.5, z: at.z });
      g.hud.toast('At the ramp');
    };
    f.add(actions, 'toRamp').name('Take me to the jump');
    f.add(actions, 'nick').name('Jess nicks the nearest quad');
    f.add(actions, 'race').name('Start a race now');
    f.add(actions, 'drag').name('Start a drag race now');
    f.add(actions, 'diesel').name('Jess pours red diesel into a quad');
    f.add(actions, 'jumper_amy').name('Amy fetches or hangs up a jumper');
    f.add(actions, 'jumper_jess').name('Jess fetches or hangs up a jumper');
    f.add(actions, 'tea').name('A girl leaves her tea on a rack');
    f.add(actions, 'convoy').name('Start follow the leader now');
    f.add(actions, 'grabJess').name('Jess grabs the throttle (next ride)');
    f.add(actions, 'grabAmy').name('Amy grabs the throttle (next ride)');
    f.add(actions, 'names').name('Jess names the quads now');
  }

  buildActions() {
    const g = this.game;
    const actions = {
      warm: () => this.unit().engine.setTemperature(1),
      cold: () => this.unit().engine.setTemperature(0),
      clearFouling: () => (this.unit().engine.fouling = 0),
      warmAll: () => g.units.forEach((u) => u.engine.setTemperature(1)),
      startAll: () => {
        // Straight to running and warm, as if each had been started and left a while (no cranking).
        for (const u of g.units) {
          const e = u.engine;
          const f = u.quad.fuel;
          f.tap = 'on';
          if (f.litres > 0) f.bowl = f.params.bowlCapacity;
          e.setIgnition(true);
          e.setTemperature(1);
          if (!e.isRunning) {
            e.state = 'running';
            e.rpm = Math.max(e.rpm, e.params.catchRpm);
          }
        }
        g.hud.toast('All the quads are running');
      },
      stopAll: () => {
        g.units.forEach((u) => {
          u.engine.setIgnition(false);
          u.engine.stopKnob(); // a diesel runs on with the key off
          u.quad.fuel.tap = 'off';
        });
        g.hud.toast('All the quads are switched off, fuel taps off');
      },
      resetQuads: () => g.units.forEach((u) => u.resetToSpawn(g.world)),
      copy: () => {
        const text = JSON.stringify(exportTuning(), null, 2);
        navigator.clipboard?.writeText(text);
        console.log(text);
        g.hud.toast('Tuning values copied');
      },
    };
    const f = this.addFolder('Actions', 'Shortcuts');
    f.add(actions, 'warm').name('Warm this engine');
    f.add(actions, 'cold').name('Cool this engine');
    f.add(actions, 'warmAll').name('Warm every engine');
    f.add(actions, 'startAll').name('Start every quad (warm, fuel on)');
    f.add(actions, 'stopAll').name('Switch every quad off (fuel off)');
    f.add(actions, 'clearFouling').name('Clear plug fouling');
    f.add(actions, 'resetQuads').name('Put the quads back in the yard');
    f.add(actions, 'copy').name('Copy all values as JSON');
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
