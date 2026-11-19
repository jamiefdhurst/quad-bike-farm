// Gathers what a reviewing subagent reads into one file (#1010). The second opinion before a stop and /recheck's reviewer were fetching the issue
// two to ten times in different forms, then the rules and the decisions summaries one call at a time, and every call reads the whole context again.
// One file, read once, replaces all of that.
//
//   node tools/reviewPack.mjs <n>                    the issue and its comments (not the check comment), the list, the decisions summaries for its labels
//   node tools/reviewPack.mjs <n> --worktree <path>  adds the branch's commits, changed files, the rules for them and the summaries for their areas
//
// Writes .scratch/review-pack-<n>.md and prints its path. The session makes it and the subagent only reads it.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MARK } from './issueCheck.mjs';

// The docs/decisions/ file for each area label. An issue with none of them is about how work is done.
const LABEL_AREAS = {
  '👭 girls': 'girls', '🏍️ vehicles': 'vehicles', '⚙️ engine': 'engine', '🌾 world': 'world', '🔊 sound': 'sound',
  '🧰 items': 'items', '🖥️ interface': 'interface', '🚀 performance': 'performance',
};

// The area a changed file is in, first match wins. game.js wires everything, so it names none.
const PATH_AREAS = [
  [/^src\/npc\//, 'girls'], [/^src\/vehicle\//, 'vehicles'], [/^src\/engine\//, 'engine'], [/^src\/(world|effects|farm)\//, 'world'],
  [/^src\/audio\//, 'sound'], [/^src\/(items|workshop)\//, 'items'], [/^src\/(hud|start|faq|debug|console)\//, 'interface'],
  [/^(tools|\.claude|\.github)\/|^CLAUDE\.md$/, 'process'],
];

/** The issue's comments without the check comment, whose list the pack carries from the file instead. */
export function withoutCheck(comments = []) {
  return comments.filter((c) => !c.body?.includes(MARK));
}

/** The "Where things stand" summary of a docs/decisions/ file, without its heading, or '' if it has none. */
export function standing(text = '') {
  const match = text.match(/^## Where things stand\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m);
  return match ? match[1].trim() : '';
}

/** The `paths:` globs in a rules file's front matter. */
export function rulePaths(text = '') {
  const front = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  return [...front.matchAll(/^\s+-\s+["']?([^"'\n]+?)["']?\s*$/gm)].map((m) => m[1]);
}

/** Whether a path matches a glob: `**` crosses folders, `*` and `?` don't. */
export function matches(glob, path) {
  const re = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\/|\*\*|\*|\?/g, (t) => ({ '**/': '(?:.*/)?', '**': '.*', '*': '[^/]*', '?': '[^/]' })[t]);
  return new RegExp(`^${re}$`).test(path);
}

/** The rules files ({ file, text }) whose globs match any of the changed paths. */
export function rulesFor(rules, paths) {
  return rules.filter((r) => rulePaths(r.text).some((g) => paths.some((p) => matches(g, p))));
}

/** The decisions areas for an issue's labels (names, as gh gives them) and its changed paths, in a fixed order. */
export function areasFor(labels = [], paths = []) {
  const areas = new Set(labels.map((l) => LABEL_AREAS[l]).filter(Boolean));
  if (!areas.size && !paths.length) areas.add('process');
  for (const p of paths) {
    const area = PATH_AREAS.find(([re]) => re.test(p))?.[1] ?? p.match(/^docs\/decisions\/(\w[\w-]*)\.md$/)?.[1];
    if (area && area !== 'ideas-turned-down') areas.add(area);
  }
  if (!areas.size) areas.add('process');
  return [...areas].sort();
}

// Headings in the issue, its comments and the rules sit under the pack's own, so they go down two levels.
const nest = (text = '') => text.trim().replace(/^(#{1,4}) /gm, '##$1 ');

/** The pack's text, from what was gathered. */
export function packText({ issue, list, branch, rules = [], summaries = [] }) {
  const comments = withoutCheck(issue.comments);
  const out = [
    `# Review pack for #${issue.number}: ${issue.title}`,
    '',
    'Made by `tools/reviewPack.mjs`. Read it once: it has the issue, its list and the summaries, so don\'t fetch them again.',
    '',
    '## The issue',
    '',
    `Labels: ${issue.labels.map((l) => l.name).join(', ') || 'none'}`,
    '',
    nest(issue.body),
    '',
    `## Comments (${comments.length}, leaving out the check comment: the list is below)`,
  ];
  for (const c of comments) out.push('', `### ${c.author?.login ?? 'someone'}, ${c.createdAt ?? ''}`.trim(), '', nest(c.body));
  out.push('', `## The list (.scratch/issue-check-${issue.number}.md)`, '', list?.trim() || 'No list yet.');
  if (branch) {
    out.push('', `## The branch (${branch.path})`, '', '### Commits on it', '', '```', branch.log.trim() || 'none', '```',
      '', '### Changed from origin/main', '', '```', branch.stat.trim() || 'nothing', '```',
      '', '### Not committed', '', '```', branch.status.trim() || 'nothing', '```');
  }
  if (rules.length) {
    out.push('', '## The rules for the changed files');
    for (const r of rules) out.push('', `### ${r.file}`, '', nest(r.text.replace(/^---\n[\s\S]*?\n---\n/, '')));
  }
  out.push('', '## Where things stand');
  for (const s of summaries) out.push('', `### docs/decisions/${s.area}.md`, '', s.text || 'No summary.');
  return `${out.join('\n')}\n`;
}

const ROOT = resolve(import.meta.dirname, '..');
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8' });

function gather(n, worktree) {
  const root = worktree ? resolve(worktree) : ROOT;
  const issue = { number: Number(n), ...JSON.parse(run('gh', ['issue', 'view', String(n), '--json', 'title,body,labels,comments'], ROOT)) };
  const listFile = join(ROOT, '.scratch', `issue-check-${n}.md`);
  const list = existsSync(listFile) ? readFileSync(listFile, 'utf8') : '';
  let branch = null;
  let paths = [];
  if (worktree) {
    const status = run('git', ['status', '--short'], root);
    paths = [...new Set([...run('git', ['diff', '--name-only', 'origin/main...HEAD'], root).split('\n'),
      ...status.split('\n').map((l) => l.slice(3).split(' -> ').pop())].filter(Boolean))];
    branch = { path: root, log: run('git', ['log', '--oneline', 'origin/main..HEAD'], root), stat: run('git', ['diff', '--stat', 'origin/main...HEAD'], root), status };
  }
  const rulesDir = join(root, '.claude', 'rules');
  const rules = worktree ? rulesFor(readdirSync(rulesDir).filter((f) => f.endsWith('.md'))
    .map((f) => ({ file: `.claude/rules/${f}`, text: readFileSync(join(rulesDir, f), 'utf8') })), paths) : [];
  const summaries = areasFor(issue.labels.map((l) => l.name), paths).map((area) => {
    const file = join(root, 'docs', 'decisions', `${area}.md`);
    return { area, text: existsSync(file) ? standing(readFileSync(file, 'utf8')) : '' };
  });
  return { issue, list, branch, rules, summaries };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--worktree');
  const worktree = at >= 0 ? args[at + 1] : null;
  const n = args.find((a, i) => /^\d+$/.test(a) && (at < 0 || i !== at + 1));
  if (!n || (at >= 0 && !worktree)) {
    console.error('usage: node tools/reviewPack.mjs <issue number> [--worktree <path>]');
    process.exit(1);
  }
  const text = packText(gather(n, worktree));
  const file = join(ROOT, '.scratch', `review-pack-${n}.md`);
  writeFileSync(file, text);
  console.log(`${file} (${Math.round(text.length / 1000)}k characters)`);
}
