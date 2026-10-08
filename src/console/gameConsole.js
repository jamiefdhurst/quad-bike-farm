// The in-game console: a line at the bottom of the screen that opens with backslash (see shell.js for the language and commands.js for what
// it can do). Not persisted, like the debug panel: its history lasts until the page reloads.
import { Shell, tabStep } from './shell.js';
import { buildCommands } from './commands.js';
import { buildGameTree } from './gameTree.js';
import { createHost } from './gameHost.js';

const MAX_LINES = 300;

export class GameConsole {
  /** @param {import('../game.js').Game} game */
  constructor(game) {
    this.game = game;
    this.visible = false;
    this.host = createHost(game, {
      copy: (text) => {
        navigator.clipboard?.writeText(text);
        console.log(text);
      },
    });
    this.shell = new Shell({ root: buildGameTree(game, this.host), commands: buildCommands(this.host) });
    this.tab = null; // what the last Tab press did, so pressing again goes on to the next choice
    this.recall = -1; // where the up arrow has got to in the history
    this.draft = '';
    this.build();
    this.print('Console. help lists every command, Tab completes, Esc shuts it.', 'info');
  }

  build() {
    const root = document.createElement('div');
    root.id = 'console';
    root.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:30;display:none;font:13px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#e8e8e8;background:rgba(10,12,16,.88);border-top:1px solid #444';
    this.out = document.createElement('div');
    this.out.style.cssText = 'max-height:42vh;overflow-y:auto;padding:6px 10px;white-space:pre-wrap;word-break:break-word';
    this.hint = document.createElement('div');
    this.hint.style.cssText = 'padding:0 10px;min-height:1.35em;color:#8aa;white-space:pre-wrap';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;padding:4px 10px 8px;align-items:center';
    const prompt = document.createElement('span');
    prompt.textContent = '>';
    prompt.style.color = '#7cf';
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.spellcheck = false;
    this.input.autocomplete = 'off';
    this.input.autocapitalize = 'off';
    this.input.style.cssText = 'flex:1;background:transparent;border:0;outline:0;color:#fff;font:inherit';
    row.append(prompt, this.input);
    root.append(this.out, this.hint, row);
    document.body.appendChild(root);
    this.root = root;
    // The game listens on the window; keys typed here must not reach it (W would walk, E would interact).
    this.input.addEventListener('keydown', (e) => this.onKey(e));
    this.input.addEventListener('keyup', (e) => e.stopPropagation());
    this.input.addEventListener('keypress', (e) => e.stopPropagation());
  }

  print(text, kind = 'out') {
    const line = document.createElement('div');
    line.textContent = text;
    line.style.color = kind === 'error' ? '#f88' : kind === 'echo' ? '#7cf' : kind === 'info' ? '#9a9' : '';
    this.out.appendChild(line);
    while (this.out.childNodes.length > MAX_LINES) this.out.removeChild(this.out.firstChild);
    this.out.scrollTop = this.out.scrollHeight;
  }

  open() {
    if (this.visible || document.activeElement?.tagName === 'INPUT') return;
    this.visible = true;
    this.root.style.display = 'block';
    this.game.input.exitPointerLock();
    document.getElementById('overlay').classList.add('tuning');
    setTimeout(() => this.input.focus(), 0); // after the key that opened it has finished typing
  }

  close() {
    if (!this.visible) return;
    this.visible = false;
    this.root.style.display = 'none';
    this.input.blur();
    document.getElementById('overlay').classList.toggle('tuning', !!this.game.debugGui?.visible);
    if (!this.game.debugGui?.visible) this.game.input.requestPointerLock();
  }

  onKey(e) {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      return this.close();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      return this.pressTab(e.shiftKey ? -1 : 1);
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      return this.walkHistory(e.key === 'ArrowUp' ? 1 : -1);
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      return this.submit();
    }
    // Any other key starts a fresh Tab.
    this.tab = null;
    this.recall = -1;
    setTimeout(() => this.showHint(), 0);
  }

  pressTab(dir) {
    const line = this.input.value;
    const step = tabStep(this.shell, line, this.tab, dir);
    if (!step) {
      this.hint.textContent = '';
      return;
    }
    this.tab = step;
    this.input.value = step.line;
    this.hint.textContent = step.candidates.length > 1 ? step.candidates.join('   ') : '';
  }

  /** While typing, the choices for the word you are on. */
  showHint() {
    const { candidates } = this.shell.complete(this.input.value);
    this.hint.textContent = candidates.length > 1 && candidates.length <= 40 ? candidates.join('   ') : '';
  }

  walkHistory(dir) {
    const h = this.shell.history;
    if (this.recall === -1) this.draft = this.input.value;
    this.recall = Math.max(-1, Math.min(h.length - 1, this.recall + dir));
    this.input.value = this.recall === -1 ? this.draft : h[h.length - 1 - this.recall];
    this.tab = null;
  }

  submit() {
    const line = this.input.value;
    this.input.value = '';
    this.tab = null;
    this.recall = -1;
    this.hint.textContent = '';
    if (!line.trim()) return;
    this.print(`> ${line}`, 'echo');
    this.shell.cleared = false;
    const lines = this.shell.run(line);
    if (this.shell.cleared) this.out.replaceChildren();
    for (const l of lines) this.print(l.text, l.kind);
  }
}
