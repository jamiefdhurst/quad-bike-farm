import { describe, it, expect } from 'vitest';
import { yourAsks } from '../src/npc/yourAsks.js';

// Your own wheel names what each start is for, so "A race" is not what you pick for a timed climb.
const labels = (r) => yourAsks(r).map((a) => a.label);

describe('what you can ask for', () => {
  it('offers only a disabled race when you are not on a quad', () => {
    const [a, ...rest] = yourAsks({ riding: false, near: { climb: true } });
    expect(rest).toEqual([]);
    expect(a).toMatchObject({ id: 'race', disabled: true });
  });

  it('offers just the race away from any start', () => {
    expect(labels({ riding: true, near: {} })).toEqual(['A race']);
  });

  it('names the hill climb at its cones, the cone course at its cones, and the drag strip', () => {
    expect(labels({ riding: true, near: { climb: true } })).toEqual(['The hill climb', 'A race']);
    expect(labels({ riding: true, near: { pit: true } })).toEqual(['The pit climb', 'A race']);
    expect(labels({ riding: true, near: { cones: true } })).toEqual(['The cone course', 'A race']);
    expect(labels({ riding: true, near: { drag: true } })).toEqual(['A drag race', 'A race']);
  });

  it('lists every start you are within reach of, the race last', () => {
    expect(yourAsks({ riding: true, near: { climb: true, cones: true } }).map((a) => a.id)).toEqual(['climb', 'cones', 'race']);
  });
});
