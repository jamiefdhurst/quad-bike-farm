import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { benchCandidates } from '../src/workshop/benchJobs.js';
import { LAYOUT } from '../src/world/layout.js';

const unit = (id, p) => ({ id, quad: { position: new THREE.Vector3(p.x, 0, p.z) } });
const at = (bay, dx = 0, dz = 0) => ({ x: bay.x + dx, z: bay.z + dz });
const ids = (list) => list.map((u) => u.id);
const bench = (extra) => benchCandidates({ bay: LAYOUT.bay, bay2: LAYOUT.bay2, margin: 0.2, from: new THREE.Vector3(LAYOUT.bench.x, 0, LAYOUT.bench.z + 1), ...extra });

describe('what the bench could work on', () => {
  const rusty = unit('rusty', LAYOUT.rusty);
  const plover = unit('plover', LAYOUT.plover);
  const tor = unit('tor', at(LAYOUT.bay2));
  const yellow = unit('yellow', at(LAYOUT.bay));

  it('is the barn find when nothing is parked, nearest to you first', () => {
    expect(ids(bench({ finds: [plover, rusty], from: new THREE.Vector3(LAYOUT.rusty.x, 0, LAYOUT.rusty.z) }))).toEqual(['rusty', 'plover']);
    expect(ids(bench({ finds: [rusty, plover], from: new THREE.Vector3(LAYOUT.plover.x, 0, LAYOUT.plover.z) }))).toEqual(['plover', 'rusty']);
    expect(bench({})).toEqual([]);
  });

  it('puts a vehicle in the big bay ahead of the rusty quad and the Plover, which no longer keep it from the bench', () => {
    expect(bench({ big: [tor], finds: [rusty, plover] })[0]).toBe(tor);
  });

  it('keeps the barn finds on the list, so the other row can still reach them while a vehicle is in a bay', () => {
    expect(bench({ big: [tor], finds: [rusty] })).toEqual([tor, rusty]);
  });

  it('takes the small bay first, then the big one, then the finds', () => {
    expect(bench({ small: [yellow], big: [tor], finds: [rusty, plover] }).slice(0, 2)).toEqual([yellow, tor]);
  });

  it('leaves out a vehicle that is not inside a bay', () => {
    const out = unit('tor', at(LAYOUT.bay2, LAYOUT.bay2.halfX + 1, 0));
    expect(bench({ big: [out], finds: [rusty] })).toEqual([rusty]);
    expect(bench({ small: [unit('yellow', at(LAYOUT.bay, LAYOUT.bay.halfX, 0))] })).toEqual([]); // on the line is not parked in it, with the margin
  });
});
