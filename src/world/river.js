// The river (layout.hill.river, world/brook.js) and the riverside meadow it runs through (layout.hill.riverside): where the crossing's posts
// stand, the hurdle that shuts the river in at the meadow's east end, where reeds and trees grow, and which part of the river a point is in.
// Pure: the props (riverProps.js) and the girls (what they say as you come to the crossing) both read it.

const ZONE_WORDS = { crossing: 'on the crossing', riffle: 'on a riffle', deep: 'in a deep pool', bank: 'on the bank' };

/** Where you are at the river (`zoneAt`'s answer) and how far up it is (`level` 0..1), in words, for the panel and the console's `river.now`. */
export const describeRiverZone = (zone, level) => `${zone ? `you are ${ZONE_WORDS[zone]}` : 'you are away from it'}; the river is ${(level * 100).toFixed(0)}% up`;

/** Null when the layout has no river (or the brook it widens). */
export function createRiver(layout, brook) {
  const river = layout.hill?.river;
  const meadow = layout.hill?.riverside;
  if (!river || !meadow || !brook) return null;
  const cross = river.crossing;
  const anchor = brook.crossing(); // the crossing's one anchor (#999): everything at the crossing stands from it

  // The public footpath's line (layoutNew.js `RESERVED_PLAN`), which comes down the south bank past the crossing: a post is kept off it (#999).
  const paths = layout.reserved?.footpath ?? [];
  const offPath = (x, z) => paths.every((pts) => pts.every(([ax, az], i) => {
    if (!i) return true;
    const [bx, bz] = pts[i - 1];
    const len2 = (bx - ax) ** 2 + (bz - az) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / len2));
    return Math.hypot(x - ax - t * (bx - ax), z - az - t * (bz - az)) > 1.3;
  }));

  /**
   * Posts marking the crossing: two lines across the river at either end of the shallows, `cross.posts` a line, from bank to bank. A bank post on the
   * footpath's line moves in towards the water until it is clear of it.
   */
  function posts() {
    const out = [];
    for (const side of [-1, 1]) {
      const x = anchor.x + side * (anchor.reach - 0.2);
      const zc = brook.zAt(x);
      const reach = brook.halfAt(x) + 1.2;
      for (let i = 0; i < cross.posts; i++) {
        const t = cross.posts === 1 ? 0.5 : i / (cross.posts - 1);
        let z = zc - reach + t * reach * 2;
        for (let k = 0; k < 12 && !offPath(x, z); k++) z += Math.sign(zc - z) * 0.25;
        out.push({ x, z, line: side });
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

  /**
   * Every river gate: where the river crosses a boundary (`meadow.gates` are the xs), each with its middle and the half-length it spans (#565). Given
   * the field gateways it fills the boundary's own shut gap there (which the plan sizes, and a boundary's end can move), else it spans the river.
   */
  const hurdles = (gateways = []) => (meadow.gates ?? [meadow.maxX]).map((x) => {
    const g = gateways.find((w) => w.gap?.shut && !w.gap.gate && Math.abs((w.pa.x + w.pb.x) / 2 - x) < 3 && Math.abs((w.pa.z + w.pb.z) / 2 - brook.zAt(x)) < 4);
    return g ? { x: (g.pa.x + g.pb.x) / 2, z: (g.pa.z + g.pb.z) / 2, half: g.gap.half } : { x, z: brook.zAt(x), half: brook.halfAt(x) + 1.6 };
  });

  /** The farm bridge's place (#689) and the crossing, named for the girls' routes (#690): the new farm's river has the bridge, the old one has none. */
  const places = () => ({ ...(river.bridge ? { bridge: { x: river.bridge.x, z: brook.zAt(river.bridge.x) } } : {}), crossing: { x: anchor.x, z: anchor.z } });

  /**
   * Which part of the river (x, z) is in: 'crossing' on the marked shallows (between the posts, in the water), 'riffle' in a riffle's shallow water
   * (#1000), 'deep' in the river's deep water, 'bank' on the ground beside it, and null everywhere else.
   */
  function zoneAt(x, z) {
    if (x < meadow.minX || x > meadow.maxX) return null;
    const dz = Math.abs(z - brook.zAt(x));
    if (dz > brook.halfAt(x) + 6) return null;
    if (brook.waterAt(x, z) > 0.05 || brook.cutAt(x, z) > 0.3) {
      if (Math.abs(x - cross.x) <= cross.half && brook.waterDepthAt(x) <= cross.water + 0.05) return 'crossing';
      if (brook.waterAt(x, z) > 0.05 && brook.deepAt(x, z) === 0 && (brook.riffleK?.(x) ?? 0) > 0.5) return 'riffle';
      return brook.waterAt(x, z) > 0.55 ? 'deep' : 'bank';
    }
    return 'bank';
  }

  /** Whether (x, z) is within `reach` m of the crossing's middle: where a girl remarks on it as you come to it. */
  const nearCrossing = (x, z, reach = 14) => Math.hypot(x - anchor.x, z - anchor.z) < reach;

  /**
   * Reed clumps. The new farm's (`meadow.gates`): drifts in the shallows, `kind` 'shallow', and a thin stand now and then up the bank,
   * 'bank', none by the crossing, the drinking places or the bridge (#565). Today's: one every stride along both banks from the hedge to the hurdle.
   */
  /**
   * With shaped banks (#999): metres from the line to a reed's place in the shallows on `side`, `t` 0..1 of the way out from as deep as a reed stands
   * (0.35 m of water) to the water's edge, so a reed by a cut bank stands at its foot and one on a bar out along its shelf.
   */
  function shallowAt(x, side, t) {
    const zc = brook.zAt(x);
    const dry = brook.depthAt(x) - brook.waterDepthAt(x);
    let edge = 0;
    while (edge < brook.halfAt(x) + 3 && brook.cutAt(x, zc + side * edge) > dry) edge += 0.1;
    let deep = edge;
    while (deep > 0 && brook.cutAt(x, zc + side * (deep - 0.1)) - dry < 0.35) deep -= 0.1;
    return deep + (edge - deep) * t;
  }

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
            out.push({ x: xx, z: brook.zAt(xx) + side * (brook.banks ? shallowAt(xx, side, random()) : brook.halfAt(xx) * (0.7 + random() * 0.3)), kind: 'shallow' });
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

  return { posts, hurdle, hurdles, places, zoneAt, nearCrossing, reeds, willows, cross, anchor, meadow };
}
