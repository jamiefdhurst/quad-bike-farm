// The pattern for the girls' minds (.claude/rules/girls-minds.md): every state says what she looks at and what it means for her being
// free, everything the game tells her about is a kind attention.js knows, and nothing decides she's free except availability(). These
// fail until something new follows it.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { STATES } from '../src/npc/companion.js';
import { NOTICE_KINDS } from '../src/npc/attention.js';
import { STATE_WHY } from '../src/npc/availability.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';

describe("the girls' minds pattern", () => {
  it('every state says what she looks at', () => {
    for (const [name, state] of Object.entries(STATES)) {
      const look = state.look;
      expect(look === 'free' || look === 'own' || typeof look === 'function', `state "${name}" needs a look ('free', 'own' or a function)`).toBe(true);
    }
  });

  it('every state says what it means for her being free', () => {
    for (const name of Object.keys(STATES)) expect(name in STATE_WHY, `state "${name}" needs a STATE_WHY entry (availability.js)`).toBe(true);
  });

  it("no feature in game.js decides she's free from her state and flags rather than availability()", () => {
    const src = readFileSync('src/game.js', 'utf8');
    const own = [...src.matchAll(/\b\w+\.fsm\.is\('idle'\)\s*&&\s*!(this\.menu\.isOpen|this\.dieselJob|\w+\.(warmingAt|pendingSpot|nickJob|hayFell|carrying|numbPlan|lineUpJob))/g)];
    expect(own.map((m) => m[0]), 'use c.availability() (npc/availability.js)').toEqual([]);
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

  it('every kind of offer the game makes is one the chooser knows', () => {
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
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\{ key: '([a-zA-Z]+)'[^}\n]*\bweight:/g)) used.add(m[1]);
      for (const m of src.matchAll(/\boffer\('([a-zA-Z]+)'/g)) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(20);
    for (const k of used) expect(OFFER_KINDS[k], `offer kind "${k}" is not in OFFER_KINDS`).toBeTruthy();
  });
});
