// Tidies the top ring of the girls' wheel. Every quad, car and truck is its own slice, which is a dozen slices on a busy farm and too many to read,
// so the vehicle slices are folded into two: the quads, and the other vehicles. Pure (no DOM): game.js tags each vehicle slice with a `group`.

/** Group names, in the order their slices appear on the ring. */
export const WHEEL_GROUPS = ['Quads', 'Other vehicles'];

/**
 * Folds options tagged with a `group` into one slice per group, placed where the group's first member was.
 * A group of one stays as it was (a ring to open for a single choice would only be a click in the way).
 */
export function groupWheelOptions(options) {
  const members = {};
  for (const o of options) if (o.group) (members[o.group] ??= []).push(o);
  const out = [];
  const placed = new Set();
  for (const o of options) {
    const list = o.group && members[o.group];
    if (!list || list.length < 2) {
      out.push(o);
    } else if (!placed.has(o.group)) {
      placed.add(o.group);
      out.push({ label: o.group, children: list.map(({ group, ...rest }) => rest) });
    }
  }
  return out;
}
