// The key editor on the start and pause card: every key the game uses, by what it does, and a click to give it another key. The
// bindings live in the browser's storage (input/keyMap.js); Input and the help page hear of a change by an event on window.
// Clicks stay inside it (the card starts the game when it is clicked).

import {
  ACTIONS, KEYS_EVENT, actionName, canBind, keyLabel, keyStorage, loadBindings, physicalFor, rebind, resetBindings, saveBindings,
} from '../input/keyMap.js';

const storage = keyStorage();

let bindings = loadBindings(storage);
let listening = null; // the action code waiting for a key
let note = '';

const button = document.getElementById('keys-open');
const panel = document.getElementById('keys-panel');

function changed() {
  saveBindings(storage, bindings);
  window.dispatchEvent(new CustomEvent(KEYS_EVENT, { detail: bindings }));
}

function draw() {
  panel.textContent = '';
  const add = (parent, tag, text, cls) => {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    if (cls) el.className = cls;
    parent.appendChild(el);
    return el;
  };
  add(panel, 'p', note || 'Click a key, then press the one you want. Giving it one that is in use swaps the two.', 'keys-note');
  for (const group of ACTIONS) {
    add(panel, 'h3', group.group);
    for (const [code] of group.keys) {
      const row = add(panel, 'div', null, 'keys-row');
      add(row, 'span', actionName(code));
      const mine = physicalFor(bindings, code);
      const b = add(row, 'button', listening === code ? 'press a key…' : keyLabel(mine), mine !== code ? 'keys-moved' : '');
      b.type = 'button';
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        listening = listening === code ? null : code;
        note = '';
        draw();
      });
    }
  }
  const foot = add(panel, 'div', null, 'keys-foot');
  const reset = add(foot, 'button', 'Put them all back');
  reset.type = 'button';
  reset.addEventListener('click', (e) => {
    e.stopPropagation();
    bindings = resetBindings(bindings);
    listening = null;
    note = 'Back to the usual keys.';
    changed();
    draw();
  });
  const done = add(foot, 'button', 'Done');
  done.type = 'button';
  done.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });
}

function close() {
  listening = null;
  panel.hidden = true;
  button.textContent = 'Change keys';
  document.getElementById('overlay').classList.remove('keys-open');
}

if (button && panel) {
  panel.addEventListener('click', (e) => e.stopPropagation());
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!panel.hidden) return close();
    panel.hidden = false;
    button.textContent = 'Hide keys';
    document.getElementById('overlay').classList.add('keys-open');
    draw();
  });
  // While it waits for a key, that key is for the editor: in the capture phase, ahead of the game's own listener.
  document.addEventListener(
    'keydown',
    (e) => {
      if (!listening) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') note = 'Left as it was.';
      else if (!canBind(e.code)) note = `${keyLabel(e.code)} can't be used: the game keeps it.`;
      else {
        bindings = rebind(bindings, listening, e.code);
        note = '';
        changed();
      }
      listening = null;
      draw();
    },
    true,
  );
  document.addEventListener('keyup', (e) => listening && e.stopPropagation(), true);
}
