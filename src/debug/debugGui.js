import GUI from 'lil-gui';
import { getTuningGroups, exportTuning } from '../core/tuning.js';
import { pickTrick } from '../npc/showOff.js';
import { FAULT_KINDS } from '../vehicle/faults.js';
import { rampPoint } from '../npc/jumps.js';

/**
 * lil-gui panel built from the tuning registry, plus live engine readouts and
 * a few shortcuts. Hidden until backtick is pressed.
 */
export class DebugGui {
  constructor(game) {
    this.game = game;
    this.gui = new GUI({ title: 'Tuning  ( ` to hide )', width: 320 });
    this.gui.hide();
    this.visible = false;

    this.buildLive();
    this.buildFavour();
    this.buildSkills();
    this.buildLPlates();
    this.buildGirls();
    this.buildActions();
    const folders = {};
    // "Red quad/Engine" becomes an Engine folder inside a Red quad folder.
    const folderFor = (path) => {
      if (folders[path]) return folders[path];
      const cut = path.lastIndexOf('/');
      const parent = cut < 0 ? this.gui : folderFor(path.slice(0, cut));
      const f = parent.addFolder(path.slice(cut + 1));
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
  }

  buildLive() {
    const g = this.game;
    const unit = () => g.inspectedUnit();
    const live = {
      get quad() {
        return unit().name;
      },
      get state() {
        return unit().engine.state;
      },
      get rpm() {
        return Math.round(unit().engine.rpm);
      },
      get water() {
        return Math.round(unit().engine.water * 100) / 100;
      },
      get mixture() {
        return unit().engine.mixture;
      },
      get roughness() {
        return unit().engine.roughness;
      },
      get power() {
        return unit().engine.power;
      },
      get fouling() {
        return unit().engine.fouling;
      },
      get load() {
        return unit().engine.load;
      },
      get lug() {
        return unit().engine.lug;
      },
      get choke() {
        return unit().quad.choke;
      },
      get shake() {
        return unit().vibration.intensity;
      },
      get speed() {
        return Math.round(unit().quad.speed * 10) / 10;
      },
      get fuel() {
        const f = unit().quad.fuel;
        return `${f.litres.toFixed(1)} L, tap ${f.tap}`;
      },
      get oil() {
        return Math.round(unit().engine.oil * 1000) / 1000;
      },
      get wear() {
        return unit().engine.wear;
      },
      get quirks() {
        return unit().quad.quirks.kinds.join(', ') || 'none';
      },
      get hours() {
        return Math.round(unit().quad.usage.hours * 100) / 100;
      },
      get odometer() {
        return `${unit().quad.usage.odoMiles.toFixed(2)} mi`;
      },
      get trip() {
        return `${unit().quad.tripMiles.toFixed(2)} mi`;
      },
      get erratic() {
        return unit().engine.erratic;
      },
      get heat() {
        return unit().engine.heat;
      },
      get pinking() {
        return unit().engine.pink;
      },
      get fan() {
        return unit().engine.fan;
      },
      get soak() {
        return unit().engine.soak;
      },
      get scuff() {
        return unit().engine.scuff;
      },
      get nip() {
        return unit().engine.nip;
      },
      get seized() {
        return unit().engine.seized;
      },

      get temperature() {
        return unit().engine.temperature;
      },
      set temperature(v) {
        unit().engine.setTemperature(v);
      },
      get battery() {
        return Math.round(unit().engine.battery * 100) / 100;
      },
      set battery(v) {
        unit().engine.battery = v;
      },
    };
    const f = this.gui.addFolder('Engine (live): the quad you are on or looking at');
    for (const key of Object.keys(Object.getOwnPropertyDescriptors(live))) {
      if (key === 'temperature' || key === 'battery') continue;
      f.add(live, key).listen().disable();
    }
    f.add(live, 'temperature', 0, 1, 0.01).name('temperature (drag to set)').listen();
    f.add(live, 'battery', 0, 1, 0.01).name('battery (drag to set)').listen();

    // The faults that develop (vehicle/faults.js): each shows its level (0 is none), and dragging it starts or clears one.
    const faults = {};
    for (const kind of FAULT_KINDS) {
      Object.defineProperty(faults, kind, {
        enumerable: true,
        get: () => (unit().quad.faults.started[kind] ? Math.round(unit().quad.faults.levels[kind] * 100) / 100 : 0),
        set: (v) => {
          const fl = unit().quad.faults;
          if (v <= 0) fl.fix(kind);
          else {
            fl.begin(kind);
            fl.levels[kind] = v;
            fl.caps[kind] = 1;
          }
        },
      });
    }
    // How prone the quad is to each, dealt once a game: [times as often it starts, times as fast it worsens].
    for (const kind of FAULT_KINDS) {
      Object.defineProperty(faults, `${kind} luck`, {
        enumerable: false,
        get: () => {
          const f = unit().quad.faults;
          return `x${f.prone[kind].toFixed(2)} often, x${f.worsens[kind].toFixed(2)} fast`;
        },
      });
    }
    const ff = this.gui.addFolder('Faults (live): drag to start, set or clear one');
    for (const kind of FAULT_KINDS) {
      ff.add(faults, kind, 0, 1, 0.01).listen();
      ff.add(faults, `${kind} luck`).listen().disable();
    }
    Object.defineProperty(faults, 'tyre', { enumerable: false, get: () => unit().quad.faults.tyre });
    ff.add(faults, 'tyre').name('flat tyre (wheel, -1 none)').listen().disable();
  }

  /** Who you favour: each girl's score, where she stands against her friend, and buttons to push it either way. */
  buildFavour() {
    const favour = this.game.favour;
    const f = this.gui.addFolder('Favour (live): how each girl rates you');
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

  /** Buttons to put the L plates on Amy's quad or the tractor, or take them off, so you can see them (npc/lPlates.js). */
  buildLPlates() {
    const l = this.game.lPlates;
    const f = this.gui.addFolder('L plates (live)');
    f.add(l, 'where').listen().disable();
    const actions = { quad: () => l.put('quad'), tractor: () => l.put('tractor'), off: () => l.put('none') };
    f.add(actions, 'quad').name("Put them on Amy's quad");
    f.add(actions, 'tractor').name('Put them on the tractor');
    f.add(actions, 'off').name('Take them off');
  }

  /** What each girl is good at, live, with buttons to push a skill up or down. */
  buildSkills() {
    const skills = this.game.skills;
    const f = this.gui.addFolder('Skills (live): what each girl is good at');
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
    const f = this.gui.addFolder('Girls (live): quads, names, racing');
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
    f.add(actions, 'recall').name('Call the girls back to the barn (N)');
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
    const free = (c) => (c.fsm.is('idle') ? true : g.hud.toast(`${cap(c.character.id)} is busy: call her back to the barn first (N)`) && false);
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
      warm: () => g.inspectedUnit().engine.setTemperature(1),
      cold: () => g.inspectedUnit().engine.setTemperature(0),
      clearFouling: () => (g.inspectedUnit().engine.fouling = 0),
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
    const f = this.gui.addFolder('Shortcuts');
    f.add(actions, 'warm').name('Warm this engine');
    f.add(actions, 'cold').name('Cool this engine');
    f.add(actions, 'warmAll').name('Warm every engine');
    f.add(actions, 'startAll').name('Start every quad (warm, fuel on)');
    f.add(actions, 'stopAll').name('Switch every quad off (fuel off)');
    f.add(actions, 'clearFouling').name('Clear plug fouling');
    f.add(actions, 'resetQuads').name('Put the quads back in the yard');
    f.add(actions, 'copy').name('Copy all values as JSON');
  }

  toggle() {
    this.visible = !this.visible;
    if (this.visible) {
      this.gui.show();
      this.game.input.exitPointerLock();
    } else {
      this.gui.hide();
      this.game.input.requestPointerLock();
    }
    document.getElementById('overlay').classList.toggle('tuning', this.visible);
  }
}
