import { describe, it, expect } from 'vitest';
import { withoutCheck, standing, rulePaths, matches, rulesFor, areasFor, packText } from '../tools/reviewPack.mjs';
import { MARK } from '../tools/issueCheck.mjs';

// One file a reviewing subagent reads once, in place of fetching the issue, rules and summaries a call at a time (#1010).

describe('the review pack', () => {
  it('leaves out the check comment and keeps the rest', () => {
    const comments = [{ body: 'Settled: the gate opens inwards' }, { body: `${MARK}\n**Checked against the issue:** 3 of 4 lines done.` }, { body: 'One more thing' }];
    expect(withoutCheck(comments).map((c) => c.body)).toEqual(['Settled: the gate opens inwards', 'One more thing']);
  });

  it('cuts out the "Where things stand" summary, up to the next section or the end', () => {
    const text = '# Area\n\nIntro.\n\n## Where things stand\n\n- **One.** First.\n- **Two.** Second.\n\n## A later section (#1)\n\nNot this.\n';
    expect(standing(text)).toBe('- **One.** First.\n- **Two.** Second.');
    expect(standing('# Area\n\n## Where things stand\n\n- Last.\n')).toBe('- Last.');
    expect(standing('# Area\n\nNo summary.')).toBe('');
  });


  it('reads the globs in a rules file and matches them as the rules loader does', () => {
    expect(rulePaths('---\npaths:\n  - "src/world/**"\n  - src/effects/**\n---\n# The world')).toEqual(['src/world/**', 'src/effects/**']);
    expect(matches('src/world/**', 'src/world/gate.js')).toBe(true);
    expect(matches('src/world/**', 'src/world/sub/deep.js')).toBe(true);
    expect(matches('src/world/**', 'src/worldly.js')).toBe(false);
    expect(matches('tests/*.test.js', 'tests/gate.test.js')).toBe(true);
    expect(matches('tests/*.test.js', 'tests/helpers/x.test.js')).toBe(false);
    expect(matches('**/glossary.md', 'docs/glossary.md')).toBe(true);
    expect(matches('src/core/featureGuard.js', 'src/core/featureGuardXjs')).toBe(false);
  });

  it('picks the rules files whose paths a change touches', () => {
    const rules = [
      { file: 'world rules', text: '---\npaths:\n  - "src/world/**"\n---\n# World' },
      { file: 'girls rules', text: '---\npaths:\n  - "src/npc/**"\n---\n# Girls' },
      { file: 'no rules', text: '# No front matter' },
    ];
    expect(rulesFor(rules, ['src/world/gate.js', 'tests/gate.test.js']).map((r) => r.file)).toEqual(['world rules']);
    expect(rulesFor(rules, ['package.json'])).toEqual([]);
  });

  it('takes the areas from the labels and the changed paths', () => {
    expect(areasFor(['⚡ enhancement', '🌾 world'])).toEqual(['world']);
    expect(areasFor(['🔨 task'])).toEqual(['process']);
    expect(areasFor(['🐛 bug', '👭 girls'], ['src/vehicle/quad.js', 'src/game.js'])).toEqual(['girls', 'vehicles']);
    expect(areasFor(['🔨 task'], ['tools/reviewPack.mjs', `docs/decisions/${'sound'}.md`])).toEqual(['process', 'sound']);
    expect(areasFor(['🔨 task'], ['src/game.js'])).toEqual(['process']);
  });

  it('writes the issue, the list, the branch, the rules and the summaries, with the issue\'s headings nested', () => {
    const text = packText({
      issue: { number: 7, title: 'Hang the gate', labels: [{ name: '🌾 world' }], body: '## What to do\n\n- Hang it', comments: [{ author: { login: 'jamie' }, createdAt: 'then', body: 'Yes' }, { body: MARK }] },
      list: '- [x] Hang it\n  → `tests/gate.test.js`',
      branch: { path: '/w', log: 'abc Hang the gate', stat: ' src/world/gate.js | 4 ++', status: '' },
      rules: [{ file: 'world rules', text: '---\npaths:\n  - "src/world/**"\n---\n# The world\n\n## Lights\n\nRule.' }],
      summaries: [{ area: 'world', text: '- **Gates.** Hung.' }],
    });
    expect(text).toContain('# Review pack for #7: Hang the gate');
    expect(text).toContain('#### What to do');
    expect(text).toContain('## Comments (1, leaving out the check comment');
    expect(text).not.toContain(MARK);
    expect(text).toContain('- [x] Hang it');
    expect(text).toContain('abc Hang the gate');
    expect(text).toContain('### world rules');
    expect(text).toContain('#### Lights');
    expect(text).not.toContain('paths:');
    expect(text).toContain('### docs/decisions/world.md\n\n- **Gates.** Hung.');
  });
});
