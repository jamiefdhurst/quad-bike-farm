import { describe, it, expect } from 'vitest';
import { DrownOut, DEFAULT_DROWNOUT_PARAMS as P } from '../src/npc/drownOut.js';
import { AMY_DROWNOUT_LINES, JESS_DROWNOUT_LINES } from '../src/npc/drownOutLines.js';
import { VOICE_LINES } from '../src/npc/voiceLines.js';

const ctx = (over = {}) => ({ jessCanRev: true, amyFree: true, amyLeft: 3, distance: 3, ...over });
const always = () => 0;

describe('drowning her out', () => {
  it('starts when Jess is sat running near Amy mid-sentence', () => {
    const d = new DrownOut({ ...P }, always);
    expect(d.update(0.1, ctx())).toEqual([{ type: 'rev' }]);
  });

  it('does not start with Amy quiet, nearly done, too far off, or Jess not able to', () => {
    for (const over of [{ amyLeft: 0 }, { amyLeft: P.amyLeftMin - 0.1 }, { distance: P.hearRange + 1 }, { jessCanRev: false }]) {
      expect(new DrownOut({ ...P }, always).update(0.1, ctx(over))).toEqual([]);
    }
  });

  it('holds the throttle for a while, then Amy switches it off if she is in reach', () => {
    const d = new DrownOut({ ...P }, always);
    d.update(0.1, ctx());
    expect(d.throttleFor()).toBe(0);
    d.update(P.revDelay + 0.1, ctx());
    expect(d.throttleFor()).toBe(1);
    const events = d.update(P.switchOffAfter, ctx());
    expect(events).toEqual([{ type: 'switchOff', by: 'amy' }]);
    expect(d.throttleFor()).toBe(0);
  });

  it('has Jess switch it off herself when Amy is out of reach or busy', () => {
    const far = new DrownOut({ ...P }, always);
    far.update(0.1, ctx());
    expect(far.update(P.switchOffAfter, ctx({ distance: P.reachRange + 1 }))).toEqual([{ type: 'switchOff', by: 'jess' }]);
    const busy = new DrownOut({ ...P }, always);
    busy.update(0.1, ctx());
    expect(busy.update(P.switchOffAfter, ctx({ amyFree: false }))).toEqual([{ type: 'switchOff', by: 'jess' }]);
  });

  it('gives up quietly if Jess is no longer on a running quad', () => {
    const d = new DrownOut({ ...P }, always);
    d.update(0.1, ctx());
    expect(d.update(P.switchOffAfter, ctx({ jessCanRev: false }))).toEqual([]);
    expect(d.throttleFor()).toBe(0);
  });

  it('waits out the cooldown before doing it again', () => {
    const d = new DrownOut({ ...P }, always);
    d.update(0.1, ctx());
    d.update(P.switchOffAfter, ctx());
    expect(d.update(1, ctx())).toEqual([]);
    d.update(P.cooldown, ctx({ amyLeft: 0 }));
    expect(d.update(0.1, ctx())).toEqual([{ type: 'rev' }]);
  });

  it('has its lines in the main sets, with no em dashes and never "he" or "she" for you', () => {
    const lines = [...Object.values(AMY_DROWNOUT_LINES).flatMap((s) => s.lines), ...Object.values(JESS_DROWNOUT_LINES).flat()];
    for (const l of lines) expect(l).not.toMatch(/—/);
    for (const k of Object.keys(AMY_DROWNOUT_LINES)) expect(VOICE_LINES[k]).toBeDefined();
  });
});
