import { describe, it, expect } from 'vitest';
import { yourAsks } from '../src/npc/yourAsks.js';

// Your own wheel names what each start is for, so "A race" is not what you pick for a timed climb.
const labels = (r) => yourAsks(r).map((a) => a.label);

describe('what you can ask for', () => {
  it('offers only a disabled race when you are not on a quad', () => {
    const [call, a, ...rest] = yourAsks({ riding: false, near: { climb: true } });
    expect(call.id).toBe('call');
    expect(rest).toEqual([]);
    expect(a).toMatchObject({ id: 'race', disabled: true });
  });

  it('offers just the race away from any start', () => {
    expect(labels({ riding: true, near: {} })).toEqual(['Call them', 'A race']);
  });

  it('names the hill climb at its cones, the cone course at its cones, and the drag strip', () => {
    expect(labels({ riding: true, near: { climb: true } })).toEqual(['Call them', 'The hill climb', 'A race']);
    expect(labels({ riding: true, near: { pit: true } })).toEqual(['Call them', 'The pit climb', 'A race']);
    expect(labels({ riding: true, near: { cones: true } })).toEqual(['Call them', 'The cone course', 'A race']);
    expect(labels({ riding: true, near: { drag: true } })).toEqual(['Call them', 'A drag race', 'A race']);
  });

  it('lists every start you are within reach of, the race last', () => {
    expect(yourAsks({ riding: true, near: { climb: true, cones: true } }).map((a) => a.id)).toEqual(['call', 'climb', 'cones', 'race']);
  });
});
