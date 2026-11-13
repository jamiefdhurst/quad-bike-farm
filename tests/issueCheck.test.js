import { describe, it, expect } from 'vitest';
import { requirements, parseList, writeList, refresh, judge, unplanned, commentBody, postedComment, canClose } from '../tools/issueCheck.mjs';

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

describe('a line done another way', () => {
  const other = (note) => ({ ticked: false, text: 'Two', note, differently: true });

  it('reads back as a [~] line', () => {
    const entries = [done('One'), other('built it in fieldPlan.js, as hill.js owns the numbers')];
    expect(writeList(entries)).toContain('- [~] Two');
    expect(parseList(writeList(entries))).toEqual(entries);
  });

  it('can be posted with what was done instead, but cannot close the issue', () => {
    expect(judge(['One', 'Two'], [done('One'), other('built it in fieldPlan.js')])).toMatchObject({ valid: true, complete: false, unagreed: ['Two'], undone: [] });
  });

  it('is refused with no note', () => {
    expect(judge(['One', 'Two'], [done('One'), other('')])).toMatchObject({ valid: false, noReason: ['Two'] });
  });

  it('closes once its note says Jamie agreed, with his words', () => {
    expect(judge(['One', 'Two'], [done('One'), other('Jamie agreed: "yes, leave it there"')])).toMatchObject({ valid: true, complete: true, unagreed: [] });
    expect(judge(['One', 'Two'], [done('One'), other('Jamie agreed:')]).complete).toBe(false);
    expect(judge(['One', 'Two'], [done('One'), other('I think Jamie agreed: yes')]).complete).toBe(false);
  });

  it('is counted on the comment', () => {
    const body = commentBody([done('One'), other('Jamie agreed: yes'), { ...other('built it elsewhere'), text: 'Three' }]);
    expect(body).toContain('1 of 3 lines done. 2 done differently: 1 agreed by Jamie, 1 waiting for him.');
    expect(commentBody([done('One')])).not.toContain('differently');
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

  it('fails a line done another way until Jamie has agreed, naming it, and passes once he has', () => {
    const line = (note) => ({ ticked: false, text: 'Two', note, differently: true });
    const r = canClose(issue(posted([done('One'), line('built it elsewhere')])));
    expect(r.ok).toBe(false);
    expect(r.say).toContain("done another way, and Jamie hasn't agreed: Two");
    expect(r.say).toContain('Jamie agreed:');
    expect(canClose(issue(posted([done('One'), line('Jamie agreed: "fine, leave it"')])))).toMatchObject({ ok: true });
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

describe('a plan for every line (#775)', () => {
  const planned = (text, plan = 'plan: tools/gate.js, proved by `npm test`', proof = '') => parseList(`- [ ] ${text}\n  → ${plan}${proof ? `\n  ${proof}` : ''}\n`)[0];

  it('names a line with no plan, and passes when every line has one', () => {
    const bare = { ticked: false, text: 'Two', note: 'waiting on #5' };
    expect(unplanned([planned('One'), bare])).toEqual(['Two']);
    expect(unplanned([planned('One'), planned('Two')])).toEqual([]);
    expect(unplanned([{ ticked: false, text: 'Three', note: '' }])).toEqual(['Three']);
  });

  it('wants something after the word plan', () => {
    expect(unplanned([planned('One', 'plan:')])).toEqual(['One']);
    expect(unplanned([planned('One', 'my plan: later')])).toEqual(['One']);
  });

  it('keeps the plan and what follows it apart, and reads back what it wrote', () => {
    const entry = planned('One', 'plan: src/gate.js', 'tests/gate.test.js');
    expect(entry).toMatchObject({ plan: 'plan: src/gate.js', proof: 'tests/gate.test.js' });
    expect(parseList(writeList([entry]))).toEqual([entry]);
  });

  it('does not count a plan as proof of a tick', () => {
    const only = { ...planned('One'), ticked: true };
    expect(judge(['One'], [only])).toMatchObject({ valid: false, unproven: ['One'] });
    const shown = { ...planned('One', 'plan: src/gate.js', 'tests/gate.test.js'), ticked: true };
    expect(judge(['One'], [shown])).toMatchObject({ valid: true, complete: true });
  });

  it('counts a plan, nothing done, as 0 of n on the comment', () => {
    expect(commentBody([planned('One'), planned('Two')])).toContain('0 of 2 lines done');
  });
});
