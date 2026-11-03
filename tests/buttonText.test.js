import { describe, it, expect } from 'vitest';
import { buttonText } from '../src/debug/buttonText.js';

describe('buttonText', () => {
  it('keeps the action and moves the explanation to the tooltip', () => {
    expect(buttonText('Amy works at the bench (needs a quad parked there)')).toEqual({
      text: 'Amy works at the bench',
      hint: 'Amy works at the bench (needs a quad parked there)',
    });
    expect(buttonText('Amy goes numb now: gets off, walks it off').text).toBe('Amy goes numb now');
  });
  it('leaves a plain label alone', () => {
    expect(buttonText('Think now').text).toBe('Think now');
  });
});

import { girlActions } from '../src/debug/girlActions.js';
import { BUTTON_MAX } from '../src/debug/buttonText.js';

describe('the Girls tab buttons', () => {
  it('each fits on one line once the explanation is a tooltip', () => {
    const stub = new Proxy(function () {}, { get: () => stub, apply: () => stub });
    const g = { companions: [], girlUnits: [], hud: stub, world: stub, voices: stub };
    const { all } = girlActions(new Proxy(g, { get: (t, k) => (k in t ? t[k] : stub) }));
    const long = all.map((a) => buttonText(a.label.replace('%', 'Jess')).text).filter((t) => t.length > BUTTON_MAX);
    expect(long).toEqual([]);
  });
});

import { readdirSync, readFileSync } from 'node:fs';

describe('button labels in the debug panel', () => {
  it('never carry a colon before their meaning, as buttonText would cut the label there', () => {
    const dir = new URL('../src/debug/', import.meta.url);
    const bad = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
      for (const m of readFileSync(new URL(file, dir), 'utf8').matchAll(/\bbutton\(\s*\w+\s*,\s*(['"`])((?:(?!\1).)*)\1/g)) {
        if (m[2].includes(': ')) bad.push(`${file}: ${m[2]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
