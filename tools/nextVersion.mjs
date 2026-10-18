// The next release's version, from the latest tag and the labels on the pull request that was merged (release.yml).
// A PR's labels say what kind of change it was better than its size does: a model rebuild is thousands of lines and a patch.
//
//   node tools/nextVersion.mjs <latest tag or ''> '<labels as a JSON array>'   prints "1.4.0 minor"
//   node tools/nextVersion.mjs --latest <tag> <tag> ...                        prints the highest version tag

import { pathToFileURL } from 'node:url';

// The labels (from .github/settings.yml) that bump more than the patch number. Anything else, or no PR at all, is a patch.
export const BUMP_LABELS = { major: ['💥 breaking'], minor: ['✨ feature'] };

// The first release, matching package.json, when there is no tag yet.
export const FIRST_VERSION = '1.0.0';

/** 'v1.2.3' or '1.2.3' as [1, 2, 3]; null for anything that isn't a plain version. */
export function parseVersion(tag) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec((tag ?? '').trim());
  return m ? m.slice(1).map(Number) : null;
}

/** 'major', 'minor' or 'patch', from a merged PR's label names. */
export function bumpFor(labels) {
  const names = new Set(labels ?? []);
  if (BUMP_LABELS.major.some((l) => names.has(l))) return 'major';
  if (BUMP_LABELS.minor.some((l) => names.has(l))) return 'minor';
  return 'patch';
}

/** The version after `tag` for a PR with these labels; FIRST_VERSION when there is no tag yet. */
export function nextVersion(tag, labels) {
  const bump = bumpFor(labels);
  const v = parseVersion(tag);
  if (!v) return { version: FIRST_VERSION, bump };
  const [major, minor, patch] = v;
  if (bump === 'major') return { version: `${major + 1}.0.0`, bump };
  if (bump === 'minor') return { version: `${major}.${minor + 1}.0`, bump };
  return { version: `${major}.${minor}.${patch + 1}`, bump };
}

function compareVersions(a, b) {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/** The highest plain version among tag names (from `git ls-remote --tags`), or '' if none. */
export function latestTag(tags) {
  let best = null;
  for (const t of tags ?? []) {
    const v = parseVersion(t);
    if (v && (!best || compareVersions(v, best.v) > 0)) best = { t: t.trim(), v };
  }
  return best ? best.t : '';
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  if (args[0] === '--latest') {
    console.log(latestTag(args.slice(1)));
  } else {
    const [tag = '', labelsJson = '[]'] = args;
    const { version, bump } = nextVersion(tag, JSON.parse(labelsJson || '[]'));
    console.log(`${version} ${bump}`);
  }
}
