// The in-game console's engine: a tree of named values (vehicle.red.temperature), commands that work on them, and tab completion
// over both. Pure (no DOM, no Three.js, no game), so it is tested on its own; gameTree.js and gameHost.js plug the game into it.

/** Lower case, with anything that is not a letter or digit turned into one dash: "Red quad" is "red-quad". */
export function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Tree ---------------------------------------------------------------------------------------------------------------------

/** A folder of things. `children` is called each time, so the folder always reflects the game as it is now. */
export const group = (children, help = '') => ({ group: true, children, help });

/**
 * A value you can read and maybe write.
 * @param {object} o
 * @param {() => any} o.get
 * @param {(v: any) => void} [o.set]    left out for read-only values
 * @param {'number'|'bool'|'text'|'choice'} [o.type]
 * @param {number} [o.min] @param {number} [o.max]   the range the debug panel uses; going outside it is allowed, with a note
 * @param {string[]} [o.choices]
 * @param {string} [o.unit]
 */
export const value = ({ get, set, type = 'number', min, max, choices, unit = '', help = '' }) => ({ group: false, get, set, type, min, max, choices, unit, help });

/** Looks a dotted path up from `root`. Returns { node, path } or { error }. Names match whatever the case. */
export function resolve(root, path) {
  let node = root;
  const names = [];
  const parts = String(path).split('.').filter((p) => p !== '');
  for (const part of parts) {
    if (!node.group) return { error: `${names.join('.') || 'that'} is a value, it has nothing inside it` };
    const kids = node.children();
    const key = Object.keys(kids).find((k) => k === part) ?? Object.keys(kids).find((k) => k.toLowerCase() === part.toLowerCase());
    if (!key) return { error: `no "${part}" in ${names.join('.') || 'the console'}${suggest(Object.keys(kids), part)}` };
    node = kids[key];
    names.push(key);
  }
  return { node, path: names.join('.') };
}

function suggest(names, part) {
  const near = names.filter((n) => n.toLowerCase().startsWith(part.toLowerCase().slice(0, 2))).slice(0, 6);
  return near.length ? ` (did you mean ${near.join(', ')}?)` : names.length && names.length <= 12 ? ` (there is ${names.join(', ')})` : '';
}

/** Every value under a node, depth first, as [path, node]. Folders can be huge, so `limit` stops the walk. */
export function walk(node, prefix = '', limit = 5000, out = []) {
  if (out.length >= limit) return out;
  if (!node.group) {
    out.push([prefix, node]);
    return out;
  }
  for (const [name, child] of Object.entries(node.children())) walk(child, prefix ? `${prefix}.${name}` : name, limit, out);
  return out;
}

// Values -------------------------------------------------------------------------------------------------------------------

const TRUE = ['on', 'true', 'yes', '1'];
const FALSE = ['off', 'false', 'no', '0'];

/** Reads what was typed as a value for this node. Returns { value } or { error }. */
export function parseValue(node, text) {
  const t = String(text).trim();
  if (node.type === 'bool') {
    if (TRUE.includes(t.toLowerCase())) return { value: true };
    if (FALSE.includes(t.toLowerCase())) return { value: false };
    return { error: `"${t}" is not on or off` };
  }
  if (node.type === 'number') {
    const n = Number(t);
    if (t === '' || !Number.isFinite(n)) return { error: `"${t}" is not a number` };
    return { value: n };
  }
  if (node.type === 'choice') {
    const match = node.choices.find((c) => String(c).toLowerCase() === t.toLowerCase());
    if (match === undefined) return { error: `"${t}" is not one of ${node.choices.join(', ')}` };
    return { value: match };
  }
  return { value: t };
}

/** A value as it reads on screen. */
export function show(node) {
  const v = node.get();
  if (node.type === 'bool') return v ? 'on' : 'off';
  if (node.type === 'number') return `${Number.isInteger(v) ? v : Number(v).toFixed(Math.abs(v) < 10 ? 3 : 2).replace(/\.?0+$/, '')}${node.unit ? ` ${node.unit}` : ''}`;
  return String(v);
}

/** What a value will take, for list and help. */
export function describe(node) {
  const bits = [];
  if (node.type === 'number' && node.min !== undefined) bits.push(`${node.min} to ${node.max}`);
  if (node.type === 'choice') bits.push(node.choices.join(' | '));
  if (node.type === 'bool') bits.push('on | off');
  if (!node.set) bits.push('read only');
  if (node.help) bits.push(node.help);
  return bits.join(', ');
}

// Typing -------------------------------------------------------------------------------------------------------------------

/** Splits a line into words; "double quotes" keep spaces together. A trailing space leaves an empty last word, for completion. */
export function tokenise(line) {
  const tokens = [];
  let cur = '';
  let quoted = false;
  let any = false;
  for (const ch of line) {
    if (ch === '"') {
      quoted = !quoted;
      any = true;
    } else if (/\s/.test(ch) && !quoted) {
      if (any || cur) tokens.push(cur);
      cur = '';
      any = false;
    } else cur += ch;
  }
  tokens.push(cur);
  return tokens;
}

// The shell ------------------------------------------------------------------------------------------------------------------

/**
 * @typedef {object} Command
 * @property {string} name
 * @property {string[]} [aliases]
 * @property {string} usage        e.g. "tp <thing> <x> <z> [heading]"
 * @property {string} help         one line
 * @property {string} [group]      where it sits in `help`
 * @property {string[]} [examples]
 * @property {(ctx: object, tokens: string[], partial: string) => string[]} [complete]  full-word candidates for the word being typed;
 *            `tokens` are the words before it (not the command)
 * @property {(args: string[], shell: Shell) => string|string[]|void} run   returns what to print; throw an Error to report a problem
 */

export class Shell {
  /**
   * @param {object} o
   * @param {object} o.root       the tree (a group)
   * @param {Command[]} o.commands
   * @param {object} [o.ctx]      passed to completers (the host)
   */
  constructor({ root, commands, ctx = {} }) {
    this.root = root;
    this.commands = commands;
    this.ctx = { ...ctx, root, shell: this };
    this.history = [];
    this.cleared = false;
  }

  command(name) {
    const n = name.toLowerCase();
    return this.commands.find((c) => c.name === n || c.aliases?.includes(n));
  }

  /** Runs a line. Returns lines to print: [{ text, kind: 'out' | 'error' }]. */
  run(line) {
    const text = line.trim().replace(/^\//, '');
    if (!text) return [];
    if (this.history[this.history.length - 1] !== text) this.history.push(text);
    this.line = text; // the line as typed, for a command that takes the rest of it whole (save load)
    const tokens = tokenise(text);
    if (tokens[tokens.length - 1] === '') tokens.pop();
    const out = [];
    const emit = (r, kind = 'out') => {
      if (r === undefined || r === null) return;
      for (const l of Array.isArray(r) ? r : String(r).split('\n')) out.push({ text: l, kind });
    };
    try {
      const [head, ...args] = tokens;
      const cmd = this.command(head);
      if (cmd) emit(cmd.run(args, this));
      else emit(this.bare(tokens));
    } catch (e) {
      emit(e.message, 'error');
    }
    return out;
  }

  /** "vehicle.red.fuel" reads it, "vehicle.red.fuel 5" and "vehicle.red.fuel = 5" set it. */
  bare(tokens) {
    const [path, ...rest] = tokens;
    const found = resolve(this.root, path);
    if (found.error) throw new Error(this.looksLikeCommand(path) ? `no command "${path}". Type help for the list` : found.error);
    const words = rest[0] === '=' ? rest.slice(1) : rest;
    if (!words.length) return this.read(found);
    return this.write(found, words.join(' '));
  }

  looksLikeCommand(word) {
    return !word.includes('.') && !Object.keys(this.root.children()).some((k) => k.toLowerCase() === word.toLowerCase());
  }

  read({ node, path }) {
    if (!node.group) return `${path} = ${show(node)}`;
    const rows = walk(node, path, 400).map(([p, n]) => `${p} = ${show(n)}`);
    return rows.length ? rows : `${path} is empty`;
  }

  write({ node, path }, text) {
    if (node.group) throw new Error(`${path} is a folder, not a value. Try list ${path}`);
    if (!node.set) throw new Error(`${path} is read only`);
    const parsed = parseValue(node, text);
    if (parsed.error) throw new Error(parsed.error);
    node.set(parsed.value);
    const note = node.type === 'number' && node.min !== undefined && (parsed.value < node.min || parsed.value > node.max) ? ` (outside the panel's ${node.min} to ${node.max})` : '';
    return `${path} = ${show(node)}${note}`;
  }

  // Completion -------------------------------------------------------------------------------------------------------------

  /**
   * What Tab can offer for the end of `line`.
   * @returns {{ start: number, candidates: string[] }}  `start` is where the word being typed begins in `line`
   */
  complete(line) {
    const body = line.replace(/^\s*\//, (m) => m.replace('/', ''));
    const tokens = tokenise(body);
    const partial = tokens.pop();
    const start = line.length - partial.length;
    let candidates;
    if (tokens.length === 0) {
      candidates = [...this.commands.map((c) => c.name), ...Object.keys(this.root.children()).map((k) => `${k}.`)];
    } else {
      const cmd = this.command(tokens[0]);
      if (cmd) candidates = cmd.complete?.(this.ctx, tokens.slice(1), partial) ?? [];
      else candidates = this.completeBare(tokens, partial);
    }
    const p = partial.toLowerCase();
    const unique = [...new Set(candidates)].filter((c) => c.toLowerCase().startsWith(p)).sort();
    return { start, candidates: unique };
  }

  completeBare(tokens, partial) {
    const found = resolve(this.root, tokens[0]);
    if (found.error || found.node.group) return [];
    return tokens.length === 1 || (tokens.length === 2 && tokens[1] === '=') ? valueOptions(found.node) : [];
  }
}

/** The words a value will take, where there is a short list. */
export function valueOptions(node) {
  if (node.type === 'bool') return ['on', 'off'];
  if (node.type === 'choice') return node.choices.map(String);
  return [];
}

/** Candidates for a dotted path being typed: the names inside the folder before the last dot, folders ending in a dot. */
export function pathCandidates(root, partial, { foldersOnly = false } = {}) {
  const cut = partial.lastIndexOf('.');
  const head = partial.slice(0, cut + 1);
  const parent = cut < 0 ? { node: root } : resolve(root, partial.slice(0, cut));
  if (parent.error || !parent.node.group) return [];
  return Object.entries(parent.node.children())
    .filter(([, n]) => !foldersOnly || n.group)
    .map(([name, n]) => `${head}${name}${n.group ? '.' : ''}`);
}

/**
 * One press of Tab (or Shift+Tab, `dir` -1). The first press fills in as far as every candidate agrees, or the word itself if there
 * is only one; pressing again on the result goes through the candidates in turn. `prev` is what the last press returned (or null).
 * @returns {{ line: string, start: number, candidates: string[], index: number } | null}
 */
export function tabStep(shell, line, prev, dir = 1) {
  if (prev && prev.line === line && prev.candidates.length > 1) {
    const n = prev.candidates.length;
    const index = (((prev.index + dir) % n) + n) % n;
    return { ...prev, line: prev.line.slice(0, prev.start) + prev.candidates[index], index };
  }
  const { start, candidates } = shell.complete(line);
  if (!candidates.length) return null;
  const typed = line.slice(start);
  const common = commonPrefix(candidates);
  const head = line.slice(0, start);
  if (candidates.length === 1) return { line: head + candidates[0] + finishing(candidates[0]), start, candidates, index: 0 };
  if (common.length > typed.length) {
    // The shared start may itself be one of the choices ("rain" among rain, rain-heavy): then the next press goes on from it.
    const at = candidates.findIndex((c) => c.toLowerCase() === common.toLowerCase());
    return { line: head + common, start, candidates, index: at >= 0 ? at : dir > 0 ? -1 : 0 };
  }
  const index = dir > 0 ? 0 : candidates.length - 1;
  return { line: head + candidates[index], start, candidates, index };
}

/**
 * The choices to show under the line while typing: all of them (no cap), as the part of each after the last dot so a long path
 * stays readable, as soon as the word being typed is empty (just after a space or a dot) or is part-way through. A lone choice is
 * shown too, so you can see what Tab will do.
 * @returns {string[]}
 */
export function hintChoices(shell, line) {
  const { start, candidates } = shell.complete(line);
  const typed = line.slice(start);
  const shortFrom = typed.lastIndexOf('.') + 1;
  return candidates.filter((c) => c.toLowerCase() !== typed.toLowerCase()).map((c) => c.slice(shortFrom));
}

const finishing = (word) => (word.endsWith('.') ? '' : ' ');

export function commonPrefix(words) {
  if (!words.length) return '';
  let p = words[0];
  for (const w of words) {
    let i = 0;
    while (i < p.length && i < w.length && p[i].toLowerCase() === w[i].toLowerCase()) i++;
    p = p.slice(0, i);
  }
  return p;
}
