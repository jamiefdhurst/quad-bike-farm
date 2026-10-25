// DOM overlay: crosshair, interaction prompt, riding status, toasts, her captions and the
// controls help panel.

import { spreads } from '../achievements/pages.js';
import { normalisePrompt, promptSignature } from '../interaction/prompt.js';
import { CONTROLS, controlsHtml } from './controls.js';
import { KEYS_EVENT, keyStorage, loadBindings, relabelKbd } from '../input/keyMap.js';

// The pad's section names buttons, not keys, so a moved key doesn't rename them.
const PAD_SECTION = 'On a gamepad';
export function helpHtml(bindings = {}) {
  const keys = CONTROLS.filter((s) => s.title !== PAD_SECTION);
  const pad = CONTROLS.filter((s) => s.title === PAD_SECTION);
  return relabelKbd(controlsHtml(keys), bindings) + controlsHtml(pad);
}

export class Hud {
  constructor(root) {
    this.root = root;
    this.crosshair = this.el('div', 'crosshair');
    this.prompt = this.el('div', 'prompt');
    this.status = this.el('div', 'status');
    this.toastEl = this.el('div', 'toast');
    this.toastEl.style.opacity = 0;
    this.captionEl = this.el('div', 'caption');
    this.captionEl.style.opacity = 0;
    this.captionTimer = 0;
    this.help = this.el('div', 'help');
    this.showKeys(loadBindings(keyStorage()));
    window.addEventListener?.(KEYS_EVENT, (e) => this.showKeys(e.detail ?? {}));
    this.help.style.display = 'none';
    this.toastTimer = 0;
    this.bucket = this.el('div', 'bucket');
    this.bucket.style.display = 'none';
    this.fadeEl = this.el('div', 'fade');
    this.fadeEl.style.opacity = 0;
  }

  /** The black screen for a cut away (0 clear, 1 black). */
  setFade(v) {
    this.fadeEl.style.opacity = v;
  }

  el(tag, cls) {
    const e = document.createElement(tag);
    e.className = cls;
    this.root.appendChild(e);
    return e;
  }

  /**
   * What you can do with what you're looking at, as the interaction module's one shape (`normalisePrompt`):
   * { action, hold?, keys? } is what E (or holding E) does, with the other keys that work as [key, what it does] chips;
   * { info, keys? } is a line with nothing to press.
   */
  setPrompt(prompt) {
    const p = normalisePrompt(prompt);
    const sig = promptSignature(p);
    if (this.promptSig === sig) return;
    this.promptSig = sig;
    const el = this.prompt;
    el.replaceChildren();
    if (!p) return;
    const chip = (key, label, cls = '') => {
      const row = document.createElement('span');
      row.className = `prompt-item ${cls}`;
      const k = document.createElement('kbd');
      k.textContent = key;
      row.append(k, document.createTextNode(label));
      return row;
    };
    if (p.action) el.appendChild(chip(p.hold ? 'hold E' : 'E', p.action, 'prompt-main'));
    else {
      const line = document.createElement('span');
      line.className = 'prompt-item';
      line.textContent = p.info;
      el.appendChild(line);
    }
    if (p.keys.length) {
      const row = document.createElement('div');
      row.className = p.action ? 'prompt-keys' : 'prompt-keys prompt-keys-bare';
      for (const [key, label] of p.keys) row.appendChild(chip(key, label));
      el.appendChild(row);
    }
  }

  setStatus(text) {
    if (this.status.textContent !== text) this.status.textContent = text;
  }

  toast(text, seconds = 2.2) {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = 1;
    this.toastTimer = seconds;
  }

  /** What she says, at the bottom of the screen. */
  caption(text, seconds = 3) {
    this.captionEl.textContent = text;
    this.captionEl.style.opacity = 1;
    this.captionTimer = seconds;
  }

  /** The help panel with the keys the player has chosen written on it. */
  showKeys(bindings) {
    this.help.innerHTML = helpHtml(bindings);
  }

  toggleHelp(force) {
    const show = force ?? this.help.style.display === 'none';
    this.help.style.display = show ? 'block' : 'none';
  }

  /**
   * The bucket list as a notebook open at one spread (two pages), items crossed off in pen. `pages` come from achievements/pages.js
   * and `score` from Achievements; returns the spread it showed (clamped) and how many there are.
   */
  showBucket(pages, score, spread = 0) {
    const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const all = spreads(pages);
    const at = Math.max(0, Math.min(spread, all.length - 1));
    const page = (pg, n) => {
      if (!pg) return '<div class="nb-page"></div>';
      const lines = pg.lines
        .map((l) =>
          l.heading
            ? `<h3>${esc(l.heading)}</h3>`
            : `<div class="nb-item${l.entry.done ? ' done' : ''}"><b></b><span>${esc(l.entry.name)}<small>${esc(l.entry.hint)}</small></span><i>${l.entry.points}</i></div>`,
        )
        .join('');
      return `<div class="nb-page">${lines}<em>${n}</em></div>`;
    };
    const [left, right] = all[at] ?? [null, null];
    this.bucket.innerHTML =
      `<div class="nb-title"><h2>Bucket list</h2><span>${score.count} of ${score.totalCount} done &middot; ${score.points} of ${score.total} points</span></div>` +
      `<div class="nb-foot">${at > 0 ? '&larr; ' : ''}turn the page${at < all.length - 1 ? ' &rarr;' : ''} &middot; Tab to close</div>` +
      `<div class="nb-spread">${page(left, at * 2 + 1)}${page(right, at * 2 + 2)}</div>`;
    this.bucket.style.display = 'block';
    return { spread: at, count: all.length };
  }

  hideBucket() {
    this.bucket.style.display = 'none';
  }

  get bucketOpen() {
    return this.bucket.style.display !== 'none';
  }

  setCrosshairVisible(v) {
    this.crosshair.style.display = v ? 'block' : 'none';
  }

  update(dt) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.style.opacity = 0;
    }
    if (this.captionTimer > 0) {
      this.captionTimer -= dt;
      if (this.captionTimer <= 0) this.captionEl.style.opacity = 0;
    }
  }
}
