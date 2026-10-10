// The pattern for the girls' attention (CLAUDE.md, "The girls' minds"): every state says what she looks at, and everything the
// game tells her about is a kind attention.js knows. These fail until something new follows it.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { STATES } from '../src/npc/companion.js';
import { NOTICE_KINDS } from '../src/npc/attention.js';

describe("the girls' attention pattern", () => {
  it('every state says what she looks at', () => {
    for (const [name, state] of Object.entries(STATES)) {
      const look = state.look;
      expect(look === 'free' || look === 'own' || typeof look === 'function', `state "${name}" needs a look ('free', 'own' or a function)`).toBe(true);
    }
  });

  it('every notice the game sends is a kind attention knows', () => {
    const files = [];
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) walk(join(dir, e.name));
        else if (e.name.endsWith('.js')) files.push(join(dir, e.name));
      }
    };
    walk('src');
    const used = new Set();
    for (const f of files) {
      for (const m of readFileSync(f, 'utf8').matchAll(/\bnotice\(\s*'([a-zA-Z]+)'/g)) used.add(m[1]);
    }
    for (const kind of used) expect(NOTICE_KINDS[kind], `notice kind "${kind}" is not in NOTICE_KINDS`).toBeTruthy();
  });
});
