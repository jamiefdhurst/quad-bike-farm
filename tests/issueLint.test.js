import { describe, it, expect } from 'vitest';
import {
  MAX_WORK,
  without,
  section,
  questionsLeft,
  ownWork,
  tooBig,
  doneWhen,
  scale,
  missingPaths,
  consoleLines,
  consoleProblems,
  handsOff,
  lint,
  readDraft,
} from '../tools/issueLint.mjs';

const bullets = (n) => Array.from({ length: n }, (_, i) => `- do thing ${i + 1}`).join('\n');
const READY = `Something happens.\n\n## What to do\n\n- Build it in \`src/game.js\`\n\n## Done when\n\n- \`npm test\` passes\n- a look by eye\n`;

describe('sections', () => {
  const body = '## A\n\none\n\n### Sub\n\ntwo\n\n## B\n\nthree\n\n```\n## not a heading\n```\n';
  it('drops a section with its sub-sections and keeps the rest', () => {
    const rest = without(body, /^a$/i);
    expect(rest).not.toMatch(/one|two/);
    expect(rest).toMatch(/three/);
    expect(rest).toMatch(/not a heading/);
  });
  it('reads one section up to the next of its level, and says when there is none', () => {
    expect(section(body, /^a$/i)).toMatch(/one[\s\S]*two/);
    expect(section(body, /^a$/i)).not.toMatch(/three/);
    expect(section(body, /^zzz$/i)).toBeNull();
  });
});

describe('questions left', () => {
  it('fails an issue with a Questions to settle first section, however it is marked', () => {
    expect(questionsLeft('## Questions to settle first\n\n1. Which?')).toHaveLength(1);
    expect(questionsLeft('**Questions to settle first**\n\n1. Which?')).toHaveLength(1);
  });
  it('passes one whose answers are under Settled with Jamie', () => {
    expect(questionsLeft('## Settled with Jamie\n\n1. This one.')).toEqual([]);
  });
});

describe('size', () => {
  it('counts the lines of its own work, not Done when, Looks like or the standard for what you will see', () => {
    const body = `## What to do\n\n${bullets(3)}\n\n## Looks like\n\n${bullets(20)}\n\n## The standard for anything you'll see\n\n${bullets(9)}\n\n## Done when\n\n${bullets(5)}`;
    expect(ownWork(body)).toHaveLength(3);
  });
  it('passes the limit and fails one line over it', () => {
    expect(tooBig(`## What to do\n\n${bullets(MAX_WORK)}`)).toEqual([]);
    expect(tooBig(`## What to do\n\n${bullets(MAX_WORK + 1)}`)).toHaveLength(1);
  });
});

describe('done when', () => {
  it('passes lines that name a test, a command, a scene or by eye', () => {
    expect(doneWhen(READY)).toEqual([]);
    expect(doneWhen('## Done when\n\n- the unit tests pass\n- `scene frost` shows it\n')).toEqual([]);
  });
  it('fails a missing section, an empty one, and a line that shows nothing', () => {
    expect(doneWhen('## What to do\n\n- a')).toHaveLength(1);
    expect(doneWhen('## Done when\n\nSoon.\n')[0]).toMatch(/no lines|names no/);
    expect(doneWhen('## Done when\n\n- it works properly\n- `npm test`')).toEqual(['"Done when" line names no test, command, scene or "by eye": it works properly']);
  });
  it('holds only the lines at the left, not what they are made of', () => {
    expect(doneWhen('## Done when\n\n- `npm test` passes with:\n  - the marks\n  - the dates\n')).toEqual([]);
  });
});

describe('scale', () => {
  it('asks a world or performance issue for a Scale: line', () => {
    expect(scale('Nothing here.', ['🌾 world'])).toHaveLength(1);
    expect(scale('Nothing here.', ['🚀 performance'])).toHaveLength(1);
  });
  it('passes a size, or none with its reason', () => {
    expect(scale('Scale: a 2 km road, in under 3 s.', ['🌾 world'])).toEqual([]);
    expect(scale('Scale: none, it is one prop in the yard.', ['🌾 world'])).toEqual([]);
  });
  it('fails an empty Scale:, or none without why', () => {
    expect(scale('Scale:\n', ['🌾 world'])).toHaveLength(1);
    expect(scale('Scale: none', ['🌾 world'])).toHaveLength(1);
  });
  it('leaves other issues alone', () => {
    expect(scale('Nothing here.', ['👭 girls'])).toEqual([]);
  });
});

describe('paths', () => {
  const here = new Set(['src/game.js', 'tools/issueCheck.mjs']);
  const exists = (p) => here.has(p);
  it('passes paths that are there, with a line number or section on them', () => {
    expect(missingPaths('Edit `src/game.js` and `tools/issueCheck.mjs#L5`, and run `tools/issueCheck.mjs start 3`.', exists)).toEqual([]);
  });
  it('fails one that is not there', () => {
    expect(missingPaths('Edit `src/world/stockYear.js`.', exists)).toEqual(["names src/world/stockYear.js, which isn't there: fix the path, or say on its line that it is new"]);
  });
  it('lets a line say it is new, and leaves placeholders and other paths alone', () => {
    expect(missingPaths('A new `src/world/stockYear.js`.', exists)).toEqual([]);
    expect(missingPaths('`src/world/<name>.js` and `src/world/*.js` and `public/audio/x.mp3`', exists)).toEqual([]);
  });
});

describe('console lines', () => {
  const body = 'Run `tp me to barn`, then `tp me to 105 -17`. See `src/game.js` and `npm test` and `tp me <x> <z>`.';
  it('finds the backticked phrases that could be console lines', () => {
    expect(consoleLines(body)).toEqual(['tp me to barn', 'tp me to 105 -17', 'npm test']);
  });
  it('fails the ones consolePath.sh says NO to, with its reason', () => {
    const verdict = (l) => (l === 'tp me to 105 -17' ? '"105" is not a place' : undefined);
    expect(consoleProblems(body, verdict)).toEqual(['console line `tp me to 105 -17` doesn\'t run ("105" is not a place): try it with tools/consolePath.sh and fix it']);
  });
  it('passes when every line runs or is skipped', () => {
    expect(consoleProblems(body, () => undefined)).toEqual([]);
  });
});

describe('work handed to another issue', () => {
  const open = new Map([
    [5, { title: 'Turn the barn', body: 'Takes the barn from #9.' }],
    [6, { title: 'Something else', body: 'Nothing to do with it.' }],
  ]);
  const lookup = (n) => open.get(n);
  it('fails a hand-off to an open issue that does not name this one', () => {
    expect(handsOff('#6 adds the gate.', 9, lookup)).toHaveLength(1);
    expect(handsOff('The gate is left for #6.', 9, lookup)).toHaveLength(1);
  });
  it('passes when that issue names this one, is closed, or the line only looks back', () => {
    expect(handsOff('#5 turns the barn.', 9, lookup)).toEqual([]);
    expect(handsOff('#77 adds the gate.', 9, lookup)).toEqual([]);
    expect(handsOff('## What is there now\n\n- #6 does nothing about it.\n\nDepends on: #6', 9, lookup)).toEqual([]);
  });
  it('has nothing to say about a draft with no number', () => {
    expect(handsOff('#6 adds the gate.', undefined, lookup)).toEqual([]);
  });
});

describe('lint', () => {
  it('passes a ready issue', () => {
    expect(lint({ number: 1, title: 'x', body: READY, labels: [] }, { exists: () => true })).toEqual([]);
  });
  it('names the check that failed', () => {
    const body = `## Questions to settle first\n\n1. Which?\n\n## What to do\n\n${bullets(13)}\n`;
    expect(lint({ number: 1, title: 'x', body, labels: [{ name: '🌾 world' }] }).map((f) => f.check)).toEqual(['questions', 'size', 'done-when', 'scale']);
  });
});

describe('a draft file', () => {
  it('takes the title and labels from its top lines and the rest as the body', () => {
    const draft = readDraft('Title: A shed\nLabels: 🌾 world, 🔨 task\n\nThe body.\n');
    expect(draft).toMatchObject({ title: 'A shed', labels: [{ name: '🌾 world' }, { name: '🔨 task' }], body: 'The body.\n' });
  });
});
