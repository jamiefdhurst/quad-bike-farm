// Central registry of tunable parameter groups. Each module owns its params
// object and a ranges table; the debug panel builds itself from this list, so
// adding a tunable is just adding a key to a params file.

const groups = [];

/**
 * @param {string} name     Folder name in the debug panel.
 * @param {object} params   Live params object; the panel writes into it directly.
 * @param {object} ranges   { key: [min, max, step] } for numeric keys.
 * @param {object} [labels] Optional { key: 'Readable label' }.
 */
export function registerTuning(name, params, ranges, labels = {}) {
  groups.push({ name, params, ranges, labels });
}

export function getTuningGroups() {
  return groups;
}
