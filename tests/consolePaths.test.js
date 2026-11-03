import { describe, it, expect } from 'vitest';
import { writeSync } from 'fs';
import { buildGameTree } from '../src/console/gameTree.js';
import { resolve } from '../src/console/shell.js';

// `tools/consolePath.sh lane.kids village.shop` resolves each against the real console tree, so a path given to Jamie is never a guess.
// Without CONSOLE_PATHS it only checks that the paths this repo's docs rely on exist.
const root = () => buildGameTree({ units: [], companions: [], weather: {} }, {});
const asked = (process.env.CONSOLE_PATHS ?? '').split(/\s+/).filter(Boolean);

describe('console paths', () => {
  it('has the top-level folders other docs name', () => {
    const top = Object.keys(root().children());
    for (const name of ['vehicle', 'girl', 'weather', 'farm', 'lane', 'village', 'pit', 'mot', 'river']) expect(top).toContain(name);
  });

  it.runIf(asked.length)('answers for the paths asked about', () => {
    const tree = root();
    const lines = asked.map((p) => {
      const r = resolve(tree, p);
      if (r.error) return `NO   ${p}: ${r.error}`;
      return r.node.group ? `ok   ${p} (folder: ${Object.keys(r.node.children()).slice(0, 40).join(', ')})` : `ok   ${p} (${r.node.type}${r.node.set ? '' : ', read-only'})`;
    });
    writeSync(2, `\n${lines.join('\n')}\n`);
  });
});
