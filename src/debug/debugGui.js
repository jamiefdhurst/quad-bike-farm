import GUI from 'lil-gui';
import { getTuningGroups, exportTuning } from '../core/tuning.js';
import { FAULT_KINDS } from '../vehicle/faults.js';

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
    const ff = this.gui.addFolder('Faults (live): drag to start, set or clear one');
    for (const kind of FAULT_KINDS) ff.add(faults, kind, 0, 1, 0.01).listen();
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

  buildActions() {
    const g = this.game;
    const actions = {
      warm: () => g.inspectedUnit().engine.setTemperature(1),
      cold: () => g.inspectedUnit().engine.setTemperature(0),
      clearFouling: () => (g.inspectedUnit().engine.fouling = 0),
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
