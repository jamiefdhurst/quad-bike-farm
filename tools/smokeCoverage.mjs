// How much of the game a smoke run reaches (#767). The smoke test only sees what it runs, so CI measures the share of `game.js`, of each host file and of
// all of `src` that Chrome's coverage says ran, and fails if one falls below its floor here. Pure functions over Chrome's coverage entries, so a test can try them.
//
// Measured over the dev server (SMOKE_DEV=1), not the build: the built bundle is one file, so there is nothing to give a share per file, and Chrome's
// ranges on it would need its source map to be turned back into files. The dev server serves each module as its own file. Its inline source maps are
// stripped first: left in they count as code and every share reads about 96%.

/** The share of each of these that a smoke run reaches, as a whole-number percentage, with the point each may not fall below. Each floor is 2 points
 * under the worst of five CI runs, so the ordinary differences between runs don't fail a PR. To raise one, run the Smoke job a few times (it prints the
 * shares in its summary) and set it 2 under the lowest. To add a host file, add a line here: a test fails until it has one. */
export const FLOORS = {
  all: 78,
  'src/game.js': 63,
  hosts: {
    'src/console/gameHost.js': 69,
    'src/items/powerHost.js': 49,
    'src/items/rackHost.js': 74,
    'src/items/toolsHost.js': 30,
    'src/items/towHost.js': 43,
    'src/items/tractorWorkHost.js': 37,
    'src/npc/mindsHost.js': 77,
    'src/photos/photoHost.js': 30,
    'src/world/farmJobsHost.js': 44,
    'src/world/fieldWorkHost.js': 43,
    'src/world/hutHost.js': 71,
    'src/world/motHost.js': 57,
    'src/world/mowHost.js': 43,
    'src/world/neighbourHost.js': 63,
    'src/world/rollingRoadHost.js': 43,
    'src/world/trafficHost.js': 76,
    'src/world/villageHost.js': 80,
    'src/world/weatherHost.js': 78,
  },
};

const MAP_COMMENT = /\n?\/\/# sourceMappingURL=data:[^\n]*\s*$/;

/** The source path a coverage entry is for ("src/game.js"), or null for anything that is not the game's own code (libraries, the page). */
export function sourcePath(url) {
  let path;
  try {
    path = new URL(url).pathname.replace(/^\//, '');
  } catch {
    return null;
  }
  return /^src\/.*\.js$/.test(path) ? path : null;
}

/** { 'src/game.js': { covered, total } } from Chrome's coverage entries ({ url, text, ranges: [{ start, end }] }), source maps stripped. */
export function bytesByFile(entries) {
  const out = {};
  for (const e of entries) {
    const path = sourcePath(e.url);
    if (!path) continue;
    const text = e.text.replace(MAP_COMMENT, '');
    const total = text.length;
    let covered = 0;
    for (const r of e.ranges) covered += Math.max(0, Math.min(r.end, total) - Math.min(r.start, total));
    out[path] = { covered, total };
  }
  return out;
}

const pct = (v) => (v.total ? (100 * v.covered) / v.total : 0);

/** Every share as { name, share } in a fixed order: all of src, game.js, then each host file the floors list (or that was loaded). */
export function sharesOf(bytes, floors = FLOORS) {
  const sum = Object.values(bytes).reduce((a, v) => ({ covered: a.covered + v.covered, total: a.total + v.total }), { covered: 0, total: 0 });
  const hostNames = [...new Set([...Object.keys(floors.hosts), ...Object.keys(bytes).filter((p) => /Host\.js$/.test(p))])].sort();
  return [
    { name: 'all', label: 'all of src', share: pct(sum) },
    { name: 'src/game.js', label: 'src/game.js', share: pct(bytes['src/game.js'] ?? { covered: 0, total: 0 }) },
    ...hostNames.map((p) => ({ name: p, label: p, share: pct(bytes[p] ?? { covered: 0, total: 0 }), host: true })),
  ];
}

const floorOf = (name, floors) => (name === 'all' ? floors.all : name === 'src/game.js' ? floors['src/game.js'] : floors.hosts[name]);

/** The shares with their floors, and a message for each that is below: what it is, what it was, and what to do. */
export function checkShares(shares, floors = FLOORS) {
  const rows = shares.map((s) => ({ ...s, floor: floorOf(s.name, floors) }));
  const failures = [];
  for (const r of rows) {
    if (r.floor === undefined) {
      failures.push(`${r.label} has no floor in tools/smokeCoverage.mjs: add a line for it (a new host file needs one)`);
    } else if (r.share < r.floor) {
      failures.push(
        `${r.label}: the smoke run reached ${r.share.toFixed(1)}% of it, under its floor of ${r.floor}%. Something that ran before no longer does: look for an action, prompt, ` +
          `verb or scene in tools/smokeActions.mjs that stopped before reaching it. If it is meant (code removed, or moved to a file with its own floor), lower the floor in tools/smokeCoverage.mjs and say why`,
      );
    }
  }
  return { rows, failures };
}

/** A markdown table for the job summary. */
export function summaryMarkdown(rows) {
  const lines = ['### What the smoke run reached', '', '| File | Reached | Floor |', '|---|---:|---:|'];
  for (const r of rows) lines.push(`| ${r.label} | ${r.share.toFixed(1)}% | ${r.floor ?? 'none'}% |`);
  return lines.join('\n');
}
