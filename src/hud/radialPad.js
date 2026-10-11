// The gamepad's radial menu (input/gamepad.js): a ring of what the pad has no button for, with the picked one lit. Drawn only while it is
// open, and rebuilt only when what it shows changes.
import { radialPositions } from '../input/gamepad.js';

const RADIUS = 170;

export class RadialPad {
  constructor() {
    const el = document.createElement('div');
    el.id = 'radial-pad';
    el.style.cssText = 'position:fixed;left:50%;top:50%;width:0;height:0;z-index:25;display:none;pointer-events:none;font:600 14px system-ui,sans-serif;color:#fff';
    document.body.appendChild(el);
    this.el = el;
    this.shown = null;
  }

  /** `radial` is { items, index } from the pad, or null when it is shut. */
  update(radial) {
    if (!radial) {
      if (this.shown) {
        this.el.style.display = 'none';
        this.shown = null;
      }
      return;
    }
    if (this.shown && this.shown.items === radial.items && this.shown.index === radial.index) return;
    this.shown = { items: radial.items, index: radial.index };
    this.el.style.display = 'block';
    this.el.replaceChildren();
    const at = radialPositions(radial.items.length, RADIUS);
    radial.items.forEach((item, i) => {
      const d = document.createElement('div');
      const on = i === radial.index;
      d.textContent = item.label;
      d.style.cssText = `position:absolute;transform:translate(calc(-50% + ${at[i].x}px),calc(-50% + ${at[i].y}px));padding:6px 10px;border-radius:14px;white-space:nowrap;background:${on ? 'rgba(255,200,60,.95)' : 'rgba(20,24,30,.78)'};color:${on ? '#111' : '#fff'}`;
      this.el.appendChild(d);
    });
    const mid = document.createElement('div');
    const item = radial.items[radial.index];
    mid.textContent = item.note ? `${item.label} (${item.note})` : item.label;
    mid.style.cssText = 'position:absolute;transform:translate(-50%,-50%);padding:8px 12px;background:rgba(20,24,30,.9);border-radius:10px;text-align:center;white-space:nowrap';
    const hint = document.createElement('div');
    hint.textContent = 'D-pad or right stick to pick, A to do it, B to cancel';
    hint.style.cssText = 'font-weight:400;font-size:12px;opacity:.8;margin-top:2px';
    mid.appendChild(hint);
    this.el.appendChild(mid);
  }
}
