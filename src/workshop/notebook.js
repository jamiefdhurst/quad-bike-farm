import './notebook.css';
import * as THREE from 'three';
import { registerTuning } from '../core/tuning.js';
import { FINDING_OF_FAULT } from '../npc/wontRide.js';
import { Logbook, DEFAULT_LOGBOOK_PARAMS, LOGBOOK_PARAM_RANGES, shortName, startingCandidates, startingEntries } from './logbook.js';
import { buildNotebookModel } from './notebookModel.js';
import { createRandom } from '../core/random.js';

const FAULT_OF_FINDING = Object.fromEntries(Object.entries(FINDING_OF_FAULT).map(([fault, finding]) => [finding, fault]));

/**
 * Amy's logbook: the notebook lying on the workbench, and the page you read when you look at it and press E. What goes in it is decided
 * in logbook.js; this is the prop, the page, and the check that she was near enough to see what she writes up.
 */
export class Notebook {
  constructor(game) {
    this.game = game;
    this.params = { ...DEFAULT_LOGBOOK_PARAMS };
    this.book = new Logbook(this.params);
    this.told = false; // the one-off toast saying where her notes go
    registerTuning('Logbook', this.params, LOGBOOK_PARAM_RANGES);
    this.book.day = game.farm?.day ?? 1;
    const amy = game.companions.find((c) => c.character.id === 'amy');
    if (game.farm?.continuing) {
      // The farm remembers: her page from earlier days, and the faults on it that are still there she still knows about.
      this.book.restore(game.farm.save.logbook);
      for (const e of this.book.entries) {
        const fault = e.what?.kind === 'fault' ? e.what.fault : e.what?.kind === 'walk' ? FAULT_OF_FINDING[e.what.finding] : null;
        const unit = fault && game.units.find((u) => shortName(u.name) === e.quad);
        if (unit && unit.quad.faults.has(fault) && amy?.knows) amy.knows.learn(unit.spec.id, [FINDING_OF_FAULT[fault]]);
      }
    } else {
      // What she had already written down before the first day: some of what is true of the quads at the start, from the seed.
      const candidates = game.units.flatMap((u) => startingCandidates({ name: u.name, history: game.history.quads[u.id], quirks: u.quad.quirks.kinds }));
      const starting = startingEntries(candidates, createRandom(game.seed ^ 0x109b), this.params);
      this.book.seed(starting);
      // Faults she wrote down are faults she knows about, so she won't ride those quads until they're put right (npc/wontRide.js).
      for (const e of starting) {
        const unit = e.what.kind === 'fault' && game.units.find((u) => shortName(u.name) === e.quad);
        if (unit && amy?.knows) amy.knows.learn(unit.spec.id, [FINDING_OF_FAULT[e.what.fault]]);
      }
    }
    const b = game.world.layout.bench;
    const top = game.world.heightAt(b.x, b.z) + b.height;
    this.model = buildNotebookModel();
    this.model.position.set(b.x + b.length / 2 - 0.7, top, b.z + 0.05); // by the east end, with the vice
    this.model.rotation.y = 0.35;
    game.scene.add(this.model);
    // Something to look at: a box a little bigger than the notebook, so you don't have to aim at the cover.
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.45), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.copy(this.model.position);
    this.proxy.position.y += 0.05;
    game.scene.add(this.proxy);
    this.build();
  }

  get isOpen() {
    return this.el.style.display !== 'none';
  }

  prompt() {
    return "Read Amy's logbook";
  }

  open() {
    this.render();
    this.el.style.display = 'block';
    document.body.classList.add('notebook-open');
    this.game.player.moveEnabled = false;
  }

  close() {
    this.el.style.display = 'none';
    document.body.classList.remove('notebook-open');
    this.game.player.moveEnabled = true;
  }

  handleInput(input) {
    this.game.player.moveEnabled = false;
    input.takeWheelSteps();
    if (input.wasPressed('KeyG') || input.wasPressed('KeyE') || input.wasPressed('Escape')) this.close();
  }

  update(dt) {
    this.book.update(dt);
  }

  /** Whether Amy is near enough to you to have seen what you were doing at the bench. */
  amySaw() {
    const amy = this.game.companions.find((c) => c.character.id === 'amy');
    return !!amy && amy.voice.head.distanceTo(amy.voice.listener) <= this.params.writeRange;
  }

  /**
   * Amy writes something about a quad. `saw` is true for what she did herself (her walk-round, topping up the oil); false for what you
   * did at the bench, which she only writes up if she was near enough to see it.
   * @param {object} unit the quad's unit
   * @param {object} what see entryText in logbook.js
   */
  note(unit, what, { by = null, saw = false } = {}) {
    if (!saw && !this.amySaw()) return;
    const entry = this.book.write({ quad: shortName(unit.name), what, by });
    if (entry && !this.told) {
      this.told = true;
      this.game.hud.toast("Amy writes it in her logbook on the bench");
    }
  }

  /** Amy writes her ranking of the quads by their buzz (the girls comparing notes). */
  noteRanking(names) {
    const entry = this.book.writeRanking(names);
    if (entry && !this.told) {
      this.told = true;
      this.game.hud.toast('Amy writes it in her logbook on the bench');
    }
  }

  build() {
    const el = document.createElement('div');
    el.className = 'notebook';
    el.style.display = 'none';
    el.innerHTML = '<div class="nb-card"><div class="nb-title">Amy\'s logbook</div><div class="nb-body"></div><div class="nb-keys">E or G to put it down</div></div>';
    document.body.appendChild(el);
    this.el = el;
    this.bodyEl = el.querySelector('.nb-body');
  }

  render() {
    const lines = this.book.lines();
    this.bodyEl.replaceChildren(...(lines.length ? lines : ['Nothing written yet.']).map((t) => Object.assign(document.createElement('div'), { textContent: t })));
    this.bodyEl.scrollTop = this.bodyEl.scrollHeight;
  }
}
