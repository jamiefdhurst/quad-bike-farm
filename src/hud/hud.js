// DOM overlay: crosshair, interaction prompt, riding status, toasts, her captions and the
// controls help panel.

const HELP_HTML = `
  <h3>On foot</h3>
  <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move, mouse to look</div>
  <div><kbd>Shift</kbd> jog</div>
  <div><kbd>E</kbd> interact with what you're looking at</div>
  <div>Looking at a quad: <kbd>K</kbd> <kbd>R</kbd> <kbd>Q</kbd> <kbd>Z</kbd> <kbd>F</kbd> work its engine, <kbd>B</kbd> sit on the back (with nobody driving, sooner or later one of them offers to drive you)</div>
  <h3>On the back while she drives</h3>
  <div><kbd>E</kbd> talk to her (a wheel: move the mouse and click): stop, slow down, faster, let me off, let me drive, and "Coach her" when she's just got something wrong</div>
  <h3>On the quad</h3>
  <div><kbd>K</kbd> ignition on / off</div>
  <div><kbd>R</kbd> hold to crank the starter (a flat battery cranks slowly, then only clicks)</div>
  <div><kbd>P</kbd> the yellow and orange have a pull-start as well: hold to draw the cord, let go to yank (about half a second to a second is right), and it works with a flat battery</div>
  <div><kbd>Q</kbd> more choke, <kbd>Z</kbd> less (hold to keep going)</div>
  <div><kbd>W</kbd> throttle, <kbd>S</kbd> brake / reverse when stopped</div>
  <div><kbd>A</kbd><kbd>D</kbd> steer</div>
  <div><kbd>E</kbd> get off (at speed you jump off and it carries on)</div>
  <div><kbd>F</kbd> fuel tap: ON, RESERVE, OFF</div>
  <div><kbd>T</kbd> right the quad if it tips over</div>
  <div>Hold <kbd>C</kbd> or the middle mouse button to look back over your shoulder</div>
  <div>Hold <kbd>V</kbd> to lean in and look closely at the dash (and the pod, if there's one)</div>
  <h3>Fuel</h3>
  <div><kbd>E</kbd> pick up the red jerry can by the barn, or the yellow pre-mix can by the petrol tank (the yellow and orange take pre-mix, the others plain petrol; hold <kbd>E</kbd> on the oil bottle to add oil to a can)</div>
  <div>Hold <kbd>E</kbd> at a quad to pour, or at the petrol tank to refill the can</div>
  <div><kbd>G</kbd> put the can down</div>
  <div>Hose by the petrol tank: <kbd>E</kbd> pick up, hold <kbd>E</kbd> to spray a quad clean, <kbd>G</kbd> put it back</div>
  <div>Green quad's winch: <kbd>X</kbd> take the hook, <kbd>E</kbd> on a quad to hook it, hold <kbd>X</kbd> by the green to wind in</div>
  <h3>Toolbox</h3>
  <div><kbd>E</kbd> pick up the toolbox by the petrol tank, <kbd>G</kbd> put it down; <kbd>X</kbd> in the panel takes the silencer off or puts it back, <kbd>F</kbd> strips down a seized engine; <kbd>Y</kbd> fits the analogue pod, <kbd>U</kbd> the digital pod and <kbd>O</kbd> takes a pod off; <kbd>T</kbd> tyres, <kbd>R</kbd> belt, <kbd>L</kbd> throttle cable and <kbd>C</kbd> carb give what's gone wrong a rough fix</div>
  <div>The hayloft: look at the ladder just inside the barn doors and press <kbd>E</kbd> to climb up (and again at the top to climb down). Up there, look at the hay and press <kbd>E</kbd> to hide in it; any key gets you out</div>
  <div>The workbench in the barn: the toolbox lives on it. Park a switched-off quad in the painted bay, look at the bench and press <kbd>E</kbd>; <kbd>1</kbd> to <kbd>4</kbd> pick plug, carb, tyre or two-stroke oil, then <kbd>E</kbd> taps or holds each step (let go in the green where there is one); <kbd>G</kbd> steps away</div>
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

  /**
   * What you can do with what you're looking at: plain text, or { action, keys }
   * where the action is what E does and keys are the other keys that work, as
   * [key, what it does] pairs shown as little chips.
   */
  setPrompt(prompt) {
    const sig = typeof prompt === 'string' || !prompt ? (prompt ?? '') : JSON.stringify(prompt);
    if (this.promptSig === sig) return;
    this.promptSig = sig;
    const el = this.prompt;
    el.replaceChildren();
    if (!prompt) return;
    if (typeof prompt === 'string') {
      el.textContent = prompt;
      return;
    }
    const chip = (key, label, cls = '') => {
      const row = document.createElement('span');
      row.className = `prompt-item ${cls}`;
      const k = document.createElement('kbd');
      k.textContent = key;
      row.append(k, document.createTextNode(label));
      return row;
    };
    el.appendChild(chip('E', prompt.action, 'prompt-main'));
    if (prompt.keys?.length) {
      const row = document.createElement('div');
      row.className = 'prompt-keys';
      for (const [key, label] of prompt.keys) row.appendChild(chip(key, label));
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
