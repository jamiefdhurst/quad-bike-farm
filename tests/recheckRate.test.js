import { describe, it, expect } from 'vitest';
import { ANSWER_HEADING, ASK_AFTER, COUNT_FORM, askLine, countLines, family, report, tally } from '../tools/recheckRate.mjs';

// Counting what the rechecks found, by the model the item was built on, so the recheck can be narrowed once it stops paying (#1178).
const line = (fix, ask, nit, agreed, model = 'claude-opus-5-5') =>
  `Recheck count: ${fix} fix, ${ask} ask, ${nit} nit; ${agreed} fixes agreed; built on ${model}.`;
const issue = (number, ...bodies) => ({ number, comments: bodies.map((body) => ({ body })) });

describe('counting the rechecks', () => {
  it('reads the count line in the form the commands give', () => {
    const form = COUNT_FORM.replace('<f>', '2').replace('<a>', '1').replace('<n>', '3').replace('<g>', '2').replace('<model id>', 'claude-opus-5-5');
    expect(countLines(form)).toEqual([{ fix: 2, ask: 1, nit: 3, agreed: 2, model: 'claude-opus-5-5' }]);
  });

  it('finds it among other lines of a comment, and takes "1 fix agreed"', () => {
    const body = `Rechecked.\n\nRecheck count: 1 fix, 0 ask, 0 nit; 1 fix agreed; built on claude-sonnet-5-5.\nThanks`;
    expect(countLines(body)).toEqual([{ fix: 1, ask: 0, nit: 0, agreed: 1, model: 'claude-sonnet-5-5' }]);
  });

  it('takes a line posted in backticks too', () => {
    expect(countLines('`' + line(1, 2, 0, 1) + '`')).toEqual([{ fix: 1, ask: 2, nit: 0, agreed: 1, model: 'claude-opus-5-5' }]);
  });

  it('ignores a line in another form', () => {
    expect(countLines('Recheck: 2 fixes, found by Opus')).toEqual([]);
    expect(countLines(undefined)).toEqual([]);
  });

  it('names the family of a model id', () => {
    expect(family('claude-opus-5-5')).toBe('Opus');
    expect(family('claude-sonnet-5-5')).toBe('Sonnet');
    expect(family('something-else')).toBe('something-else');
  });

  it('counts an issue rechecked twice as one item with its counts added, and skips issues with none', () => {
    const t = tally([
      issue(1, line(2, 1, 0, 2), 'a comment', line(1, 0, 1, 1)),
      issue(2, line(0, 0, 2, 0)),
      issue(3, 'no recheck here'),
      issue(4, line(3, 0, 0, 2, 'claude-sonnet-5-5')),
    ]);
    expect(t.Opus).toEqual({ items: 2, fix: 3, ask: 1, nit: 3, agreed: 3, rate: 1.5 });
    expect(t.Sonnet).toEqual({ items: 1, fix: 3, ask: 0, nit: 0, agreed: 2, rate: 2 });
    expect(report(t)).toMatch(/^Opus: 2 items rechecked, 3 agreed fixes \(1\.50 an item\)/);
    expect(report({})).toBe('No recheck counts yet.');
  });
});

describe('putting the rate to Jamie', () => {
  const opus = (items, agreed) => tally(Array.from({ length: items }, (_, i) => issue(i, line(0, 0, 0, i < agreed ? 1 : 0))));

  it(`waits for ${ASK_AFTER} Opus items`, () => {
    expect(askLine(opus(ASK_AFTER - 1, 0))).toBeNull();
    expect(askLine(opus(ASK_AFTER, 0))).toMatch(/^ask: 20 items built on Opus .* narrowing is recommended/);
  });

  it('recommends keeping it at one agreed fix in five items or more', () => {
    expect(askLine(opus(ASK_AFTER, 4))).toMatch(/keeping it is recommended/);
    expect(askLine(opus(ASK_AFTER, 3))).toMatch(/narrowing is recommended/);
  });

  it('stops asking once the decisions file records the answer', () => {
    expect(askLine(opus(30, 1), `## Something else\n\n${ANSWER_HEADING}\n\n- Kept.`)).toBeNull();
    expect(askLine(opus(30, 1), `- mentions ${ANSWER_HEADING} in passing`)).not.toBeNull();
  });
});
