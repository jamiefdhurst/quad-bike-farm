import GUI from 'lil-gui';
import { getTuningGroups, exportTuning } from '../core/tuning.js';

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
    this.buildActions();
    for (const group of getTuningGroups()) {
      const folder = this.gui.addFolder(group.name);
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
    const { engine, quad, vibration } = this.game;
    const live = {
      get state() {
        return engine.state;
      },
      get rpm() {
        return Math.round(engine.rpm);
      },
      get mixture() {
        return engine.mixture;
      },
      get roughness() {
        return engine.roughness;
      },
      get power() {
        return engine.power;
      },
      get fouling() {
        return engine.fouling;
      },
      get load() {
        return engine.load;
      },
      get choke() {
        return quad.choke;
      },
      get shake() {
        return vibration.intensity;
      },
    };
    const f = this.gui.addFolder('Engine (live)');
    for (const key of Object.keys(Object.getOwnPropertyDescriptors(live))) {
      f.add(live, key).listen().disable();
    }
    f.add(engine, 'temperature', 0, 1, 0.01).name('temperature (drag to set)').listen();
  }

  buildActions() {
    const g = this.game;
    const actions = {
      warm: () => g.engine.setTemperature(1),
      cold: () => g.engine.setTemperature(0),
      clearFouling: () => (g.engine.fouling = 0),
      resetQuad: () => {
        const s = g.world.spawn.quad;
        g.quad.physics.reset(s.x, g.world.heightAt(s.x, s.z) + 0.5, s.z, s.yaw);
      },
      copy: () => {
        const text = JSON.stringify(exportTuning(), null, 2);
        navigator.clipboard?.writeText(text);
        console.log(text);
        g.hud.toast('Tuning values copied');
      },
    };
    const f = this.gui.addFolder('Shortcuts');
    f.add(actions, 'warm').name('Warm engine');
    f.add(actions, 'cold').name('Cold engine');
    f.add(actions, 'clearFouling').name('Clear plug fouling');
    f.add(actions, 'resetQuad').name('Put quad back at the barn');
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
