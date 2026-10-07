// DOM overlay: crosshair, interaction prompt, riding status, toasts, her captions and the
// controls help panel.

const HELP_HTML = `
  <h3>On foot</h3>
  <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move, mouse to look, <kbd>Shift</kbd> jog</div>
  <div><kbd>E</kbd> interact with what you're looking at</div>
  <div>At a quad: <kbd>K</kbd> <kbd>R</kbd> <kbd>Q</kbd> <kbd>Z</kbd> <kbd>F</kbd> work its engine, <kbd>Y</kbd> pull the dipstick on a four-stroke (hold it by the oil bottle to top up), <kbd>B</kbd> sit on the back, hold <kbd>V</kbd> to push it (the yellow, orange and kids' quads have no reverse)</div>
  <h3>On the back while she drives</h3>
  <div><kbd>E</kbd> talk to her (mouse and click): stop, slower, faster, let me off, let me drive, coach her</div>
  <h3>On the quad</h3>
  <div><kbd>K</kbd> ignition, hold <kbd>R</kbd> to crank, <kbd>P</kbd> pull-start (yellow and orange)</div>
  <div><kbd>Q</kbd> more choke, <kbd>Z</kbd> less, <kbd>F</kbd> fuel tap. Each quad's choke, tap and reverse are in a different place: look down for them, and some need you stopped or a hand off the bars</div>
  <div>Red, green and yellow have a clutch: hold <kbd>Shift</kbd> to change gear with <kbd>1</kbd> to <kbd>4</kbd>, <kbd>B</kbd> reverse (red: turn the bars as you press it; green: stopped), <kbd>0</kbd> neutral</div>
  <div><kbd>W</kbd> throttle, <kbd>S</kbd> brake (blue and loan: hold it and press <kbd>B</kbd> for reverse, then <kbd>S</kbd> backs up), <kbd>A</kbd><kbd>D</kbd> steer</div>
  <div>Red and blue: <kbd>G</kbd> 2WD or 4WD (4WD for the mud; the rocker on the bars), blue: <kbd>U</kbd> diff lock</div>
  <div><kbd>Space</kbd> parking brake, <kbd>T</kbd> right it if it tips, <kbd>E</kbd> get off</div>
  <div>Hold <kbd>L</kbd> for the horn: the girls beep back</div>
  <div>Hold <kbd>C</kbd> to look back, <kbd>V</kbd> to lean in to the dash</div>
  <h3>The old tractor</h3>
  <div><kbd>K</kbd> key (heats the glow plugs: wait for the GLOW lamp to go out), hold <kbd>R</kbd> to crank</div>
  <div>Hold <kbd>Shift</kbd> for the clutch: <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> gears, <kbd>B</kbd> reverse, <kbd>0</kbd> neutral</div>
  <div><kbd>Q</kbd> <kbd>Z</kbd> hand throttle (it has no fuel tap), <kbd>W</kbd> foot throttle, <kbd>S</kbd> brake, <kbd>O</kbd> stop knob (the key won't stop it)</div>
  <div>Leave it running in first gear with the hand throttle open and get off, and it creeps off on its own: the more throttle, the faster (a trickle to a brisk walk)</div>
  <div><kbd>J</kbd> hook the bale trailer on when the drawbar is at its ring, or take it off when you're stopped. The girls climb on once you're stopped</div>
  <h3>The little tipping trailer</h3>
  <div><kbd>J</kbd> on a quad with a rack (or the tractor) hooks it on when the hitch is at its ring, or takes it off when you're stopped. <kbd>E</kbd> at the tub with a jerry can or the toolbox in your hands stands it in the tub. <kbd>T</kbd> tips the tub (stopped, from the seat or beside it) and tips out whatever is in it. Jess may climb in against the rules, or ask either girl in from the wheel</div>
  <h3>The UTV</h3>
  <div><kbd>K</kbd> key (wait for the GLOW lamp to go out), hold <kbd>R</kbd> to crank; the key stops it again. It is a diesel: red diesel only</div>
  <div><kbd>W</kbd> throttle, <kbd>S</kbd> brake, <kbd>A</kbd><kbd>D</kbd> steer. Stopped, <kbd>B</kbd> flips the dash lever to reverse, then <kbd>S</kbd> backs up</div>
  <div><kbd>T</kbd> tip the bed (stopped, from the seat or beside it), again to lower it. Stop with it running and the girls may climb in. Ask them from the wheel too</div>
  <h3>Fuel and tools</h3>
  <div><kbd>E</kbd> pick up a jerry can, hold <kbd>E</kbd> at a quad to pour or at the tank to refill, <kbd>G</kbd> put it down</div>
  <div>Hose: <kbd>E</kbd> pick up, hold <kbd>E</kbd> to wash. Toolbox: <kbd>E</kbd> pick up, <kbd>E</kbd> on a quad to tinker</div>
  <div>Green quad's winch: <kbd>X</kbd> take the hook, <kbd>E</kbd> on a quad to hook it, hold <kbd>X</kbd> to wind in</div>
  <div>Tractor's tow chain: <kbd>X</kbd> looking at the tractor to take it, <kbd>E</kbd> on a quad to hook it, then back the tractor up and drive off</div>
  <div>Hayloft ladder, workbench and Amy's logbook in the barn: <kbd>E</kbd></div>
  <h3>Other</h3>
  <div><kbd>H</kbd> help, <kbd>N</kbd> call the girls, <kbd>Enter</kbd> ask for a race (on a quad, by the yard or at the drag strip), <kbd>M</kbd> mute, <kbd>\`</kbd> tuning panel</div>
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
