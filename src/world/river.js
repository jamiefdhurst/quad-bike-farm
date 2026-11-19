// The river (layout.hill.river, world/brook.js) and the riverside meadow it runs through (layout.hill.riverside): where the crossing's posts
// stand, the hurdle that shuts the river in at the meadow's east end, where reeds and trees grow, and which part of the river a point is in.
// Pure: the props (riverProps.js) and the girls (what they say as you come to the crossing) both read it.

/** Null when the layout has no river (or the brook it widens). */
export function createRiver(layout, brook) {
  const river = layout.hill?.river;
  const meadow = layout.hill?.riverside;
  if (!river || !meadow || !brook) return null;
  const cross = river.crossing;

  /** Posts marking the crossing: two lines across the river at either end of the shallows, `cross.posts` a line, from bank to bank. */
  function posts() {
    const out = [];
    for (const side of [-1, 1]) {
      const x = cross.x + side * (cross.half - 0.2);
      const zc = brook.zAt(x);
      const reach = brook.halfAt(x) + 1.2;
      for (let i = 0; i < cross.posts; i++) {
        const t = cross.posts === 1 ? 0.5 : i / (cross.posts - 1);
        out.push({ x, z: zc - reach + t * reach * 2, line: side });
      }
    }
    return out;
  }

  /** The hurdle across the river at the meadow's east hedge: its middle and the half-length it spans. */
  function hurdle() {
    const x = meadow.maxX;
    const gap = brook.halfAt(x) + 1.6;
    return { x, z: brook.zAt(x), half: gap };
  }

  /** Every river gate: where the river crosses a boundary (`meadow.gates` are the xs), each with its middle and the half-length it spans (#565). */
  const hurdles = () => (meadow.gates ?? [meadow.maxX]).map((x) => ({ x, z: brook.zAt(x), half: brook.halfAt(x) + 1.6 }));

  /** The farm bridge's place (#689) and the crossing, named for the girls' routes (#690): the new farm's river has the bridge, the old one has none. */
  const places = () => ({ ...(river.bridge ? { bridge: { x: river.bridge.x, z: brook.zAt(river.bridge.x) } } : {}), crossing: { x: cross.x, z: brook.zAt(cross.x) } });

  /**
   * Which part of the river (x, z) is in: 'crossing' on the marked shallows (between the posts, in the water), 'deep' in the river's deep
   * water, 'bank' on the ground beside it, and null everywhere else.
   */
  function zoneAt(x, z) {
    if (x < meadow.minX || x > meadow.maxX) return null;
    const dz = Math.abs(z - brook.zAt(x));
    if (dz > brook.halfAt(x) + 6) return null;
    if (brook.waterAt(x, z) > 0.05 || brook.cutAt(x, z) > 0.3) {
      if (Math.abs(x - cross.x) <= cross.half && brook.waterDepthAt(x) <= cross.water + 0.05) return 'crossing';
      return brook.waterAt(x, z) > 0.55 ? 'deep' : 'bank';
    }
    return 'bank';
  }

  /** Whether (x, z) is within `reach` m of the crossing's middle: where a girl remarks on it as you come to it. */
  const nearCrossing = (x, z, reach = 14) => Math.hypot(x - cross.x, z - brook.zAt(cross.x)) < reach;

  /**
   * Reed clumps. The new farm's (`meadow.gates`): drifts in the shallows of the pools, `kind` 'shallow', and a thin stand now and then up the bank,
   * 'bank', none by the crossing, the drinking places or the bridge (#565). Today's: one every stride along both banks from the hedge to the hurdle.
   */
  function reeds(random) {
    const out = [];
    if (meadow.gates) {
      const clear = (x, side) => Math.abs(x - cross.x) > cross.half + 5 && Math.abs(x - (river.bridge?.x ?? -1e9)) > 12 && !brook.drinks.some((d) => d.side === side && Math.abs(d.x - x) < 8);
      for (let x = meadow.minX + 10; x < meadow.maxX - 2; ) {
        const drift = 3 + random() * 5; // metres a drift runs along the bank
        const side = random() < 0.5 ? -1 : 1;
        if (random() < 0.6) {
          for (let d = 0; d < drift; d += 0.5 + random() * 0.6) {
            const xx = x + d;
            if (!clear(xx, side)) continue;
            out.push({ x: xx, z: brook.zAt(xx) + side * (brook.halfAt(xx) * (0.7 + random() * 0.3)), kind: 'shallow' });
          }
        } else if (clear(x, side)) {
          out.push({ x, z: brook.zAt(x) + side * (brook.halfAt(x) + 0.3 + random() * 1.5), kind: 'bank' });
        }
        x += drift + 3 + random() * 7;
      }
      return out;
    }
    for (let x = meadow.minX + 6; x < meadow.maxX - 1; x += 0.3 + random() * 0.5) {
      if (Math.abs(x - cross.x) < cross.half + 5) continue;
      for (const side of [-1, 1]) {
        if (random() < 0.25) continue;
        const z = brook.zAt(x) + side * (brook.halfAt(x) * (0.85 + random() * 0.4));
        out.push({ x, z });
      }
    }
    return out;
  }

  /** Where the willows stand: on the banks, off the crossing, clear of the water and each other. */
  function willows() {
    return (meadow.willows ?? []).map(([x, side, off]) => ({ x, z: brook.zAt(x) + side * (brook.halfAt(x) + off) }));
  }

  return { posts, hurdle, hurdles, places, zoneAt, nearCrossing, reeds, willows, cross, meadow };
}
