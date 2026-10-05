// DOM overlay: crosshair, interaction prompt, riding status, toasts, her captions and the
// controls help panel.

const HELP_HTML = `
  <h3>On foot</h3>
  <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move, mouse to look</div>
  <div><kbd>Shift</kbd> jog</div>
  <div><kbd>E</kbd> interact with what you're looking at</div>
  <div>Looking at a quad: <kbd>K</kbd> <kbd>R</kbd> <kbd>Q</kbd> <kbd>Z</kbd> <kbd>F</kbd> work its engine</div>
  <h3>On the quad</h3>
  <div><kbd>K</kbd> ignition on / off</div>
  <div><kbd>R</kbd> hold to crank the starter</div>
  <div><kbd>Q</kbd> more choke, <kbd>Z</kbd> less (hold to keep going)</div>
  <div><kbd>W</kbd> throttle, <kbd>S</kbd> brake / reverse when stopped</div>
  <div><kbd>A</kbd><kbd>D</kbd> steer</div>
  <div><kbd>E</kbd> get off (at speed you jump off and it carries on)</div>
  <div><kbd>F</kbd> fuel tap: ON, RESERVE, OFF</div>
  <div><kbd>T</kbd> right the quad if it tips over</div>
  <div>Hold <kbd>C</kbd> or the middle mouse button to look back over your shoulder</div>
  <h3>Fuel</h3>
  <div><kbd>E</kbd> pick up the jerry can by the barn</div>
  <div>Hold <kbd>E</kbd> at a quad to pour, or at the petrol tank to refill the can</div>
  <div><kbd>G</kbd> put the can down</div>
  <h3>Toolbox</h3>
  <div><kbd>E</kbd> pick up the toolbox by the petrol tank, <kbd>G</kbd> put it down</div>
  <div>Take it to a quad that's switched off and press <kbd>E</kbd> to tinker</div>
  <h3>Other</h3>
  <div><kbd>H</kbd> toggle this help</div>
  <div><kbd>M</kbd> mute</div>
  <div><kbd>\`</kbd> tuning panel</div>
`;

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
    this.help.innerHTML = HELP_HTML;
    this.help.style.display = 'none';
    this.toastTimer = 0;
  }

  el(tag, cls) {
    const e = document.createElement(tag);
    e.className = cls;
    this.root.appendChild(e);
    return e;
  }

  setPrompt(text) {
    const t = text ?? '';
    if (this.prompt.textContent !== t) this.prompt.textContent = t;
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

  toggleHelp(force) {
    const show = force ?? this.help.style.display === 'none';
    this.help.style.display = show ? 'block' : 'none';
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
