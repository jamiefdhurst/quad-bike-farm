// A companion wheel, for talking to the girls without leaving pointer lock:
// options round a ring, picked by moving the mouse towards one and clicking
// (or pressing its number, or scrolling to it and pressing Enter). An option
// with `children` opens another ring of its own (a quad, then what to do with
// it); right-click, Backspace or Escape goes back a ring, E or Q closes it.
// Same interface as a menu: open(title, options), isOpen, handleInput(), close().

const SVG = 'http://www.w3.org/2000/svg';
const SIZE = 600;
const INNER = 84; // radius of the hole in the middle
const OUTER = 284;
const LABEL_RADIUS = 186;
const FIT = 0.9; // the wheel (and the hint under it) never takes more than this much of the window's height
const DEAD = 28; // mouse travel (px) before anything's picked
const REACH = 110; // and the most it counts

/** SVG path for a ring slice from angle a0 to a1 (radians, clockwise from the top). */
function slicePath(a0, a1, r0, r1) {
  const pt = (a, r) => `${(SIZE / 2 + Math.sin(a) * r).toFixed(2)} ${(SIZE / 2 - Math.cos(a) * r).toFixed(2)}`;
  if (a1 - a0 >= Math.PI * 2 - 1e-6) {
    // The whole ring: two circles, the inner one cut out.
    const c = SIZE / 2;
    return `M ${c - r1} ${c} a ${r1} ${r1} 0 1 0 ${2 * r1} 0 a ${r1} ${r1} 0 1 0 ${-2 * r1} 0 M ${c - r0} ${c} a ${r0} ${r0} 0 1 1 ${2 * r0} 0 a ${r0} ${r0} 0 1 1 ${-2 * r0} 0`;
  }
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${pt(a0, r0)} L ${pt(a0, r1)} A ${r1} ${r1} 0 ${large} 1 ${pt(a1, r1)} L ${pt(a1, r0)} A ${r0} ${r0} 0 ${large} 0 ${pt(a0, r0)} Z`;
}

const cssColor = (c) => (typeof c === 'number' ? `#${c.toString(16).padStart(6, '0')}` : c);

export class Wheel {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'wheel';
    this.el.style.display = 'none';
    root.appendChild(this.el);
    this.isOpen = false;
    this.stack = [];
    this.cursor = { x: 0, y: 0 };
    this.selected = -1;
    // Right-click is "back" while it's open, not the browser's menu.
    document.addEventListener('contextmenu', (e) => this.isOpen && e.preventDefault());
  }

  /**
   * @param {string} title
   * @param {{label: string, run?: () => void, children?: object[], color?: number|string, hint?: string, disabled?: boolean}[]} options
   */
  open(title, options) {
    this.stack = [{ title, options }];
    // Only one thing to choose between at the top, and it's a ring of its own: go straight in.
    if (options.length === 1 && options[0].children) this.stack = [{ title: `${title}: ${options[0].label}`, options: options[0].children, color: options[0].color }];
    this.isOpen = true;
    this.reset();
    this.el.style.display = 'block';
    this.fit();
  }

  /** Scales the wheel down to fit a short window; it is drawn at full size otherwise. */
  fit() {
    const scale = Math.min(1, (window.innerHeight * FIT) / (SIZE + 30));
    this.el.style.setProperty('--wheel-scale', scale.toFixed(3));
  }

  get level() {
    return this.stack[this.stack.length - 1];
  }

  close() {
    this.isOpen = false;
    this.stack = [];
    this.el.style.display = 'none';
  }

  reset() {
    this.cursor = { x: 0, y: 0 };
    this.selected = -1;
    this.render();
  }

  /** Which slice is in the direction (x right, y down), or -1 near the middle. */
  sliceAt(x, y) {
    const n = this.level.options.length;
    if (Math.hypot(x, y) < DEAD) return -1;
    const a = (Math.atan2(x, -y) + Math.PI * 2 + Math.PI / n) % (Math.PI * 2);
    return Math.floor(a / ((Math.PI * 2) / n)) % n;
  }

  /** Points the cursor at a slice (for keys and the scroll wheel). */
  point(i) {
    const n = this.level.options.length;
    const a = (i * Math.PI * 2) / n;
    this.cursor = { x: Math.sin(a) * REACH * 0.8, y: -Math.cos(a) * REACH * 0.8 };
    this.selected = i;
    this.render();
  }

  choose(i) {
    const option = this.level.options[i];
    if (!option || option.disabled) return;
    if (option.children) {
      this.stack.push({ title: option.label, options: option.children, color: option.color });
      this.reset();
      return;
    }
    this.close();
    option.run?.();
  }

  back() {
    if (this.stack.length > 1) {
      this.stack.pop();
      this.reset();
    } else {
      this.close();
    }
  }

  /** Returns true while the wheel is consuming input. */
  handleInput(input) {
    if (!this.isOpen) return false;
    const n = this.level.options.length;
    const m = input.takeMouseDelta();
    if (m.x || m.y) {
      let { x, y } = this.cursor;
      x += m.x;
      y += m.y;
      const len = Math.hypot(x, y);
      if (len > REACH) {
        x *= REACH / len;
        y *= REACH / len;
      }
      this.cursor = { x, y };
      const pick = this.sliceAt(x, y);
      if (pick !== this.selected) {
        this.selected = pick;
        this.render();
      } else {
        this.moveNeedle();
      }
    }
    for (let i = 0; i < n && i < 9; i++) {
      if (input.wasPressed(`Digit${i + 1}`) || input.wasPressed(`Numpad${i + 1}`)) {
        this.choose(i);
        return true;
      }
    }
    const steps = input.takeWheelSteps();
    if (steps !== 0) this.point((Math.max(0, this.selected) + Math.sign(steps) + n) % n);
    if (input.wasPressed('ArrowRight') || input.wasPressed('ArrowDown')) this.point((this.selected + 1 + n) % n);
    if (input.wasPressed('ArrowLeft') || input.wasPressed('ArrowUp')) this.point((Math.max(0, this.selected) - 1 + n) % n);
    if ((input.wasClicked(0) || input.wasPressed('Enter') || input.wasPressed('Space')) && this.selected >= 0) {
      this.choose(this.selected);
      return true;
    }
    if (input.wasClicked(2) || input.wasPressed('Backspace') || input.wasPressed('Escape')) {
      this.back();
      return true;
    }
    if (input.wasPressed('KeyE') || input.wasPressed('KeyQ')) this.close();
    return true;
  }

  render() {
    const { title, options } = this.level;
    const n = options.length;
    const step = (Math.PI * 2) / n;
    const gap = n > 1 ? 0.025 : 0;
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
    svg.setAttribute('width', SIZE);
    svg.setAttribute('height', SIZE);
    const hub = document.createElementNS(SVG, 'circle');
    hub.setAttribute('class', 'wheel-hub');
    hub.setAttribute('cx', SIZE / 2);
    hub.setAttribute('cy', SIZE / 2);
    hub.setAttribute('r', INNER - 6);
    svg.appendChild(hub);
    const labels = [];
    options.forEach((o, i) => {
      const a0 = i * step - step / 2 + gap;
      const a1 = i * step + step / 2 - gap;
      const slice = document.createElementNS(SVG, 'path');
      slice.setAttribute('d', slicePath(a0, a1, INNER, OUTER));
      slice.setAttribute('class', `wheel-slice${i === this.selected ? ' selected' : ''}${o.disabled ? ' disabled' : ''}`);
      svg.appendChild(slice);
      if (o.color !== undefined) {
        // A band of the quad's colour round the outside of its slice.
        const band = document.createElementNS(SVG, 'path');
        band.setAttribute('d', slicePath(a0, a1, OUTER - 12, OUTER));
        band.setAttribute('fill', cssColor(o.color));
        svg.appendChild(band);
      }
      const a = i * step;
      const x = SIZE / 2 + Math.sin(a) * LABEL_RADIUS;
      const y = SIZE / 2 - Math.cos(a) * LABEL_RADIUS;
      const more = o.children ? ' ›' : '';
      labels.push(
        `<div class="wheel-label${i === this.selected ? ' selected' : ''}${o.disabled ? ' disabled' : ''}" style="left:${x}px;top:${y}px"><span class="key">${i + 1}</span>${o.label}${more}${o.hint ? `<small>${o.hint}</small>` : ''}</div>`,
      );
    });
    const needle = document.createElementNS(SVG, 'circle');
    needle.setAttribute('class', 'wheel-needle');
    needle.setAttribute('r', 5);
    svg.appendChild(needle);
    this.needle = needle;
    const back = this.stack.length > 1 ? 'right-click back' : 'E to close';
    this.el.innerHTML = `<div class="wheel-centre"><div class="wheel-title">${title}</div></div>${labels.join('')}<div class="wheel-hint">move the mouse and click, or 1-${n}   ·   ${back}</div>`;
    this.el.prepend(svg);
    this.moveNeedle();
  }

  /** The dot that shows where the mouse is pointing. */
  moveNeedle() {
    if (!this.needle) return;
    const len = Math.hypot(this.cursor.x, this.cursor.y);
    const r = len < 1 ? 0 : Math.min(INNER - 10, (len / REACH) * (INNER - 10));
    this.needle.setAttribute('cx', SIZE / 2 + (this.cursor.x / Math.max(len, 1)) * r);
    this.needle.setAttribute('cy', SIZE / 2 + (this.cursor.y / Math.max(len, 1)) * r);
    this.needle.style.opacity = len < DEAD ? 0.35 : 1;
  }
}
