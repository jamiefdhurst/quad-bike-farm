// Central registry of tunable parameter groups. Each module owns its params
// object and a ranges table; the debug panel builds itself from this list, so
// adding a tunable is just adding a key to a params file.

const groups = [];

/**
 * @param {string} name     Folder name in the debug panel.
 * @param {object} params   Live params object; the panel writes into it directly.
 * @param {object} ranges   { key: [min, max, step] } for numeric keys, or { key: ['a', 'b'] } for a choice.
 *                          Keys without a range are left out.
 * @param {object} [options]
 * @param {() => void} [options.onChange]  Called after any value in the group changes.
 */
export function registerTuning(name, params, ranges, { onChange } = {}) {
  groups.push({ name, params, ranges, onChange });
}

export function getTuningGroups() {
  return groups;
}

/** Snapshot of every group's current values, for copying out a tuning session. */
export function exportTuning() {
  const out = {};
  for (const g of groups) {
    out[g.name] = {};
    for (const key of Object.keys(g.ranges)) out[g.name][key] = g.params[key];
  }
  return out;
}
