import { describe, it, expect } from 'vitest';
import { requirements, parseList, writeList, refresh, judge, commentBody, postedComment, canClose } from '../tools/issueCheck.mjs';

const BODY = `What happens for the player.

## What to do

- Build the shed
- [ ] Add a door
- [x] Already done by the last PR
  - A nested line
1. A numbered line

### Sub-part

* Another bullet

\`\`\`
- not a line, it is in a code block
\`\`\`

## Where it fits

- Context nobody has to do

### More of where it fits

- Still context

## Done when

- The tests pass

Depends on: #3`;

const done = (text, note = '`npm test`') => ({ ticked: true, text, note });

describe('the lines of an issue', () => {
  it('takes every bullet, numbered line and unticked box, outside code and the sections that are not work', () => {
    expect(requirements(BODY)).toEqual(['Build the shed', 'Add a door', 'A nested line', 'A numbered line', 'Another bullet', 'The tests pass']);
  });

  it('takes the sections after a left-out one again', () => {
    expect(requirements('## Findings\n\n- one\n\n## What to do\n\n- two')).toEqual(['two']);
  });

  it('takes the prose of an issue with no bullets, leaving out its plumbing', () => {
    expect(requirements('Make the gate squeak.\n\nDepends on: #3\nBuilds on: #4\nWas TODO 12\n\nOnly when it is wet.')).toEqual(['Make the gate squeak.', 'Only when it is wet.']);
  });

  it('takes the title of an empty issue, so there is always something to answer', () => {
    expect(requirements('', 'Fix the gate')).toEqual(['Fix the gate']);
    expect(requirements(null, 'Fix the gate')).toEqual(['Fix the gate']);
  });

  it('counts a repeated line once', () => {
    expect(requirements('- same\n- same')).toEqual(['same']);
  });
});

describe('the list', () => {
  it('reads back what it wrote, and a note over several lines', () => {
    const entries = [done('One', '`npm test`'), { ticked: false, text: 'Two', note: 'waiting on #5' }];
    expect(parseList(writeList(entries))).toEqual(entries);
    expect(parseList('- [x] One\n  → first\n  second')[0].note).toBe('first second');
  });

  it('keeps what is written when the list is made again, picks up a new line and drops nothing', () => {
    const had = [done('Old line'), done('A line the session added')];
    expect(refresh(['Old line', 'New line'], had).map((e) => [e.text, e.ticked])).toEqual([['Old line', true], ['New line', false], ['A line the session added', true]]);
  });
});

describe('judging a list against the issue', () => {
  const required = ['One', 'Two'];

  it('is complete only with every line ticked and shown', () => {
    expect(judge(required, [done('One'), done('Two', 'tests/gate.test.js')])).toMatchObject({ valid: true, complete: true });
  });

  it('fails a line of the issue that was dropped', () => {
    expect(judge(required, [done('One')])).toMatchObject({ valid: false, complete: false, missing: ['Two'] });
  });

  it('fails a tick with nothing to show for it', () => {
    for (const note of ['', 'done', 'yes it works', 'see the diff']) {
      expect(judge(required, [done('One'), done('Two', note)])).toMatchObject({ valid: false, unproven: ['Two'] });
    }
  });

  it('takes a file, an issue, a test or command in backticks, or context, as evidence', () => {
    for (const note of ['src/world/gate.js', 'tools/shot.mjs run on the hut', 'in #735', '`it fails a block`', 'context: says why, nothing to do']) {
      expect(judge(['One'], [done('One', note)]).complete, note).toBe(true);
    }
  });

  it('wants a reason for a line left undone, and with one it can be posted but cannot close', () => {
    expect(judge(required, [done('One'), { ticked: false, text: 'Two', note: '' }])).toMatchObject({ valid: false, noReason: ['Two'] });
    expect(judge(required, [done('One'), { ticked: false, text: 'Two', note: 'Jamie to decide' }])).toMatchObject({ valid: true, complete: false, undone: ['Two'] });
  });

  it('counts a line the session added: it has to be answered as well', () => {
    expect(judge(['One'], [done('One'), { ticked: false, text: 'Extra', note: 'not reached' }]).complete).toBe(false);
  });
});

describe('whether a PR can close an issue', () => {
  const issue = (comments, extra) => ({ number: 7, title: 'T', body: '- One\n- Two', labels: [], comments, ...extra });
  const posted = (entries) => [{ body: 'A chat about it' }, { body: commentBody(entries), url: 'x#issuecomment-1' }];

  it('passes with every line answered in the comment', () => {
    expect(canClose(issue(posted([done('One'), done('Two')])))).toMatchObject({ ok: true });
  });

  it('fails with no comment, and says what to run', () => {
    const r = canClose(issue([{ body: 'A chat about it' }]));
    expect(r.ok).toBe(false);
    expect(r.say).toContain('node tools/issueCheck.mjs start 7');
    expect(r.say).toContain('gh run rerun');
  });

  it('fails a line left undone, naming it and pointing at "Part of"', () => {
    const r = canClose(issue(posted([done('One'), { ticked: false, text: 'Two', note: 'too big' }])));
    expect(r.ok).toBe(false);
    expect(r.say).toContain('not done: Two');
    expect(r.say).toContain('Part of');
  });

  it('fails when a line was added to the issue after the comment', () => {
    const r = canClose(issue(posted([done('One'), done('Two')]), { body: '- One\n- Two\n- Three' }));
    expect(r.ok).toBe(false);
    expect(r.say).toContain('not on the list: Three');
  });

  it('reads the latest comment when there are several', () => {
    const old = commentBody([done('One'), { ticked: false, text: 'Two', note: 'later' }]);
    const comments = [{ body: old }, { body: commentBody([done('One'), done('Two')]) }];
    expect(postedComment(comments).body).toContain('2 of 2');
    expect(canClose(issue(comments))).toMatchObject({ ok: true });
  });

  it('leaves testing issues to /test', () => {
    expect(canClose(issue([], { labels: [{ name: '🧪 testing' }] }))).toMatchObject({ ok: true });
  });
});
