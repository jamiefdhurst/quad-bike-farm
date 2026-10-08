// The buildings and odds and ends out in the east fields: the Dutch barn at the far end of the road with its stack of round bales, the old
// stone field shed, the muck heap and the water trough. Pure: their shapes from the layout (layout.js), for the props (outbuildingProps.js),
// the terrain (levelled under the two buildings), the stubble (none grows under them) and the rain (none falls under their roofs).

// A round bale: the same as the farm's others (props.js buildBales).
export const BALE = { radius: 0.75, length: 1.2 };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => t * t * (3 - 2 * t);
const rect = (x, z, hx, hz) => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
const inRect = (r, x, z, margin = 0) => x > r.minX - margin && x < r.maxX + margin && z > r.minZ - margin && z < r.maxZ + margin;
const outside = (r, x, z) => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));

/** The Dutch barn's shape: its outline, where its stanchions stand, its roof and the bales stacked in it. Null if the layout has none. */
export function dutchBarnShape(layout) {
  const b = layout.dutchBarn;
  if (!b) return null;
  const outer = rect(b.x, b.z, b.halfX, b.halfZ);
  const bay = (b.halfX * 2) / b.bays;
  const postXs = Array.from({ length: b.bays + 1 }, (_, i) => outer.minX + i * bay);
  const roof = rect(b.x, b.z, b.halfX + b.overhang, b.halfZ + b.overhang);

  // The stack: rows of bales lying with their ends to the front, two rows deep against the back wall, from the open bays' end to the clad
  // east end. Each layer sits in the hollows of the one below, one fewer bale across.
  const R = BALE.radius;
  const L = BALE.length;
  const fromX = outer.minX + b.openBays * bay + 0.5;
  const toX = outer.maxX - 0.25;
  const across = Math.floor((toX - fromX) / (2 * R));
  const rowZs = [outer.minZ + 0.3 + L / 2, outer.minZ + 0.3 + L * 1.5];
  const bales = [];
  for (let layer = 0; layer < b.layers && across - layer > 0; layer++) {
    for (let i = 0; i < across - layer; i++) {
      const x = fromX + R + layer * R + i * 2 * R;
      for (const z of rowZs) bales.push({ x, z, layer, y: R + layer * R * Math.sqrt(3) });
    }
  }
  const stack = { minX: fromX, maxX: fromX + across * 2 * R, minZ: outer.minZ, maxZ: rowZs[1] + L / 2 };
  // The two bales on the floor at the front, to sit on: the girls' seats there (layout.restSpots), under this roof.
  const seats = (layout.restSpots ?? []).filter((sp) => sp.seat !== undefined && inRect(roof, sp.x, sp.z));
  return { outer, roof, postXs, bay, eaves: b.eaves, rise: b.rise, bales, seats, stack, open: rect(outer.minX + (b.openBays * bay) / 2, b.z, (b.openBays * bay) / 2, b.halfZ) };
}

/** The field shed's shape: outside and inside its walls, the doorway in its south wall, and its roof. Null if the layout has none. */
export function fieldShedShape(layout) {
  const s = layout.fieldShed;
  if (!s) return null;
  const outer = rect(s.x, s.z, s.halfX, s.halfZ);
  const inner = rect(s.x, s.z, s.halfX - s.wall, s.halfZ - s.wall);
  return {
    outer,
    inner,
    roof: rect(s.x, s.z, s.halfX + 0.3, s.halfZ + 0.35),
    wall: s.wall,
    wallHeight: s.wallHeight,
    ridge: s.ridge,
    door: { minX: s.x - s.door.halfWidth, maxX: s.x + s.door.halfWidth, z: outer.maxZ, height: s.door.height },
  };
}

/**
 * The height of the muck heap above the ground at (x, z): a long, flat-topped heap with slumped sides, 0 off it. The lumps are a fixed
 * pattern rather than random, so the collider built from it and the drawing agree.
 */
export function muckHeapHeight(layout, x, z) {
  const m = layout.muckHeap;
  if (!m) return 0;
  const u = (x - m.x) / m.halfX;
  const v = (z - m.z) / m.halfZ;
  const r = Math.pow(Math.pow(Math.abs(u), 3) + Math.pow(Math.abs(v), 3), 1 / 3); // a rounded oblong
  if (r >= 1) return 0;
  const lumps = 1 + 0.08 * Math.sin(u * 7.1 + 1.3) * Math.sin(v * 5.3 + 0.4) + 0.05 * Math.sin(u * 13 + v * 9);
  return m.height * smooth(clamp01((1 - r) / 0.6)) * lumps;
}

export function createOutbuildings(layout) {
  const barn = dutchBarnShape(layout);
  const shed = fieldShedShape(layout);
  const m = layout.muckHeap;
  const t = layout.trough;
  const heap = m ? rect(m.x, m.z, m.halfX, m.halfZ) : null;
  const trough = t ? rect(t.x, t.z, t.length / 2, t.width / 2) : null;
  const footprints = [barn?.outer, shed?.outer, heap, trough].filter(Boolean);
  // The trodden ground in front of the Dutch barn's open side, out to the hardstanding: no stubble there either.
  const apron = barn ? { minX: barn.outer.minX - 1, maxX: barn.outer.maxX + 1, minZ: barn.outer.maxZ, maxZ: barn.outer.maxZ + 4 } : null;

  /** Under the Dutch barn's or the field shed's roof: out of the rain. */
  function covered(x, z) {
    return (!!barn && inRect(barn.roof, x, z)) || (!!shed && inRect(shed.roof, x, z));
  }

  /** Whether (x, z) is on a building, the heap or the trough (or the Dutch barn's apron), or within `margin` metres of one: no stubble grows there. */
  function builtAt(x, z, margin = 0) {
    return footprints.some((r) => inRect(r, x, z, margin)) || (!!apron && inRect(apron, x, z, margin));
  }

  /** Metres from (x, z) to the nearest building, heap or trough (0 on one). */
  function clearance(x, z) {
    return Math.min(Infinity, ...footprints.map((r) => outside(r, x, z)));
  }

  /**
   * 0..1 how much to level the ground at (x, z) to a building's floor, and the floor's height there from `ground(x, z)` at the building's
   * middle: flat under each building, easing back over `reach` metres outside it. Returns null away from them.
   */
  function floorAt(x, z, ground, reach = 2.5) {
    for (const [s, o] of [[barn, layout.dutchBarn], [shed, layout.fieldShed]]) {
      if (!s) continue;
      const d = outside(s.outer, x, z);
      if (d < reach) return { k: 1 - smooth(clamp01(d / reach)), level: ground(o.x, o.z) };
    }
    return null;
  }

  return { barn, shed, heap, trough, apron, footprints, covered, builtAt, clearance, floorAt };
}
