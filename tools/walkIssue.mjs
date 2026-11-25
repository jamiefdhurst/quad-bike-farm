// One walk issue for each place (#1179). A testing issue for each merged item piled up (55 open, a median of 18 days old, one closed in two weeks),
// while Jamie tests by walking an area. So a merged item's "try this" lines go into the open "Walk: <place>" issue for its place on the farm plan,
// and `/test <place>` works that walk in one go.
//
//   node tools/walkIssue.mjs place <n>                                    prints the walk an issue's lines go to, and why
//   node tools/walkIssue.mjs add <n> --pr <url> --lines <file> [--place <p>] [--dry-run]
//                                                                          adds a "Try #n, merged in <PR>" section to the open walk for the
//                                                                          place (worked out from the issue if --place isn't given; --place takes
//                                                                          a walk's name or any place's, and refuses anything else), or opens one;
//                                                                          a walk too long for GitHub is followed by "Walk: <place> (2)"
//   node tools/walkIssue.mjs fold [--dry-run] [--out <dir>]                moves every open testing issue that isn't a walk into the walk for its
//                                                                          item's place, ticked lines left out, and closes it with a link
//
// The place is the item's place on docs/farm-plan.md: the **Place:** line of its "Where it fits", or that section's first line. A plain row of the
// plan's table (the barn, the farmhouse) is part of the bold place above it (the farmstead), as a walk covers a place you can walk round. An item that
// isn't placed goes to the walk for its first area label, in the order .github/settings.yml lists them ("Walk: the girls").

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TESTING = '🧪 testing';
export const TITLE = 'Walk: ';
// Area labels in .github/settings.yml's order, and the walk each names when an item isn't placed (a test holds these to the settings file).
export const AREAS = [
  ['👭 girls', 'the girls'], ['🏍️ vehicles', 'vehicles'], ['⚙️ engine', 'engines'], ['🌾 world', 'the world'], ['🔊 sound', 'sound'],
  ['🧰 items', 'items'], ['🖥️ interface', 'the interface'],
];
// GitHub refuses an issue body longer than this.
export const MAX_BODY = 65536;

const COUNT = /^(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+/i;
const stripBold = (s) => s.replace(/\*\*/g, '').trim();
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The names a place goes by in prose: "The barn" is "the barn" (a common noun keeps its article), "The Moor" is "Moor" too. */
function aliasesOf(name) {
  const bare = name.replace(/^the\s+/i, '');
  if (bare === name) return [name];
  return /^[A-Z0-9]/.test(bare) && !/^\d/.test(bare) ? [name, bare] : [name];
}

/** The places on the farm plan's table, each with the names it is matched by and the walk it belongs to. */
export function readPlaces(plan) {
  const at = plan.indexOf('## The farm');
  const rows = plan.slice(at).split('\n').filter((l) => l.startsWith('| ')).slice(1);
  const places = [];
  let parent = null;
  for (const row of rows) {
    const cell = row.split('|')[1].trim();
    if (/^-+$/.test(cell) || cell === 'Place') continue;
    const bold = cell.startsWith('**');
    const name = bold ? /^\*\*(.+?)\*\*/.exec(cell)[1] : stripBold(cell);
    const walk = bold ? name.replace(/^The\s+/, 'the ').replace(COUNT, 'the ') : parent ?? name;
    if (bold) parent = walk;
    const names = new Set(aliasesOf(name));
    const after = stripBold(cell.slice(bold ? cell.indexOf('**', 2) + 2 : 0)).replace(/^\([^)]*\)/, '').trim();
    if (after.startsWith(':')) for (const part of after.slice(1).split(',')) if (part.trim()) names.add(part.trim());
    if (!bold) for (const part of name.split(',')) if (part.trim()) aliasesOf(part.trim()).forEach((a) => names.add(a));
    places.push({ name, walk, names: [...names] });
  }
  return places;
}

/** The "Where it fits" section of an issue body ('' if it has none). */
export function whereItFits(body = '') {
  const m = /^##\s*Where it fits\s*\n([\s\S]*?)(?=^##\s|(?![\s\S]))/m.exec(body);
  return m ? m[1].trim() : '';
}

/** The text that names an item's place: the **Place:** line if there is one, else the first sentence of the section (later ones name what it ties into). */
export function placeLine(section) {
  const place = /\*\*Place:\*\*\s*(.*)/.exec(section);
  if (place) return place[1].trim();
  const first = section.split('\n').find((l) => l.trim())?.replace(/^[-*]\s*/, '').trim() ?? '';
  return first.split(/(?<=\.)\s+/)[0];
}

/** A place's name as a pattern: its case as the plan writes it ("Tracks" isn't "stone tracks"), but "the barn" may start a sentence. */
const namePattern = (name) => (/^the /i.test(name) ? `[Tt]he ${escape(name.slice(4))}` : escape(name));

/** The walk the first place named in a line belongs to (earliest in the line, the longest name where two start together), or null. */
export function matchPlace(line, places, flags = 'u') {
  let best = null;
  for (const place of places) {
    for (const name of place.names) {
      const m = new RegExp(`(?<![\\p{L}\\d])${namePattern(name)}(?![\\p{L}\\d])`, flags).exec(line);
      if (m && (!best || m.index < best.index || (m.index === best.index && name.length > best.name.length))) best = { index: m.index, name, walk: place.walk };
    }
  }
  return best;
}

/** The walk an item's lines go to: its place on the plan, else its first area label, else "the game". `why` says which. */
export function placeFor({ body = '', labels = [] }, places) {
  const section = whereItFits(body);
  const line = placeLine(section);
  if (line && !/^not placed/i.test(line)) {
    const hit = matchPlace(line, places);
    if (hit) return { place: hit.walk, why: `"${hit.name}" in its Where it fits` };
  }
  const names = labels.map((l) => l.name ?? l);
  const area = AREAS.find(([label]) => names.includes(label));
  if (area) return { place: area[1], why: `${section ? 'not placed on the plan' : 'no Where it fits'}, so its first area label, ${area[0]}` };
  return { place: 'the game', why: 'not placed, and no area label' };
}

export const walkTitle = (place, part = 1) => `${TITLE}${place}${part > 1 ? ` (${part})` : ''}`;

/** Every walk there can be: each place's, each area's and the game's. */
export const walkNames = (places) => [...new Set([...places.map((p) => p.walk), ...AREAS.map(([, w]) => w), 'the game'])];

/** The walk a `--place` names: a walk's own name, or any name of a place on the plan ("the barn" is the farmstead's). Throws on anything else, so a
 * slip can't open a second walk for a place. */
export function resolvePlace(given, places) {
  const names = walkNames(places);
  const exact = names.find((w) => w.toLowerCase() === given.trim().toLowerCase());
  if (exact) return exact;
  const hit = matchPlace(given, places, 'iu');
  if (hit) return hit.walk;
  throw new Error(`"${given}" isn't a place on docs/farm-plan.md or an area. The walks are: ${names.join(', ')}`);
}

/** The open walk a place's next section goes in: the latest part, as a full one is followed by "Walk: <place> (2)". Null if none is open. */
export function currentWalk(issues, place) {
  const title = new RegExp(`^${escape(TITLE + place)}(?: \\((\\d+)\\))?$`);
  const parts = issues.map((i) => ({ i, m: title.exec(i.title) })).filter((x) => x.m).map((x) => ({ ...x.i, part: Number(x.m[1] ?? 1) }));
  return parts.sort((a, b) => b.part - a.part)[0] ?? null;
}

export const walkIntro = (place) =>
  `Everything merged for ${place} that only eyes and ears can judge, one section per item. \`/test ${place}\` works it in one go along one route, ` +
  'ticking each line as it passes. It closes when every line is ticked, and the next item here opens a fresh walk (#1179).';

/** A section's own headings sit under its "## Try" heading. */
const demote = (text) => text.replace(/^(#{2,5})(\s)/gm, '#$1$2');

/** The section `add` puts in a walk for an item's lines. Throws if the lines have nothing to tick. */
export function section({ item, pr, lines }) {
  const text = lines.trim();
  if (!/^\s*- \[ \]/m.test(text)) throw new Error('the lines have nothing to tick: put each thing to try on a "- [ ]" line');
  return `## Try #${item}, merged in ${pr}\n\n${demote(text)}`;
}

/** Whether a walk already has a section for an item, so running `add` twice doesn't add it twice. */
export const hasSection = (body, item) => new RegExp(`^## Try #${item}\\b`, 'm').test(body);

/** A walk's body with a section added to the end (a new walk's body if there's none yet). */
export function withSection(body, place, text) {
  return `${(body?.trim() || walkIntro(place))}\n\n${text}\n`;
}

/** A testing issue's lines that are still to try: ticked lines (and what is indented under them) left out. */
export function untickedOnly(text) {
  const out = [];
  let skipping = null;
  for (const line of text.split('\n')) {
    const indent = /^\s*/.exec(line)[0].length;
    if (skipping !== null && line.trim() && indent > skipping) continue;
    skipping = null;
    if (/^\s*[-*] \[[xX]\]/.test(line)) {
      skipping = indent;
      continue;
    }
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** The item a testing issue tries, and the PR it merged in, from its first line ("Try #945, merged in <url> ..."). */
export function triedItem(body = '') {
  const first = body.split('\n').find((l) => l.trim()) ?? '';
  const item = /#(\d+)/.exec(first);
  const pr = /https:\/\/github\.com\/\S+?\/pull\/\d+/.exec(first) ?? /\bPR (#\d+)/.exec(first);
  return { item: item ? Number(item[1]) : null, pr: pr ? pr[1] ?? pr[0] : null };
}

/** Whether a first line says no more than its section's heading will ("Try #54, merged in <url> (v1.2.0)."), so it can go. */
const onlyHeading = (line) => !line.replace(/^Try #\d+, merged in (https:\/\/\S+?\/pull\/\d+|#\d+)/, '').replace(/\([^)]*\)/g, '').replace(/[\s.,]/g, '');

/** The section a testing issue becomes in its walk: under its own "Try #n" heading, ticked lines left out. Null if nothing is left to try. */
export function foldedSection({ number, title, body = '' }) {
  const { item, pr } = triedItem(body);
  const heading = item && pr ? `Try #${item}, merged in ${pr} (was #${number})` : `${title.replace(/^Try:\s*/, '')} (was #${number})`;
  const lines = body.trim().split('\n');
  let text = untickedOnly(item && pr && onlyHeading(lines[0]) ? lines.slice(1).join('\n') : body);
  const anyBoxes = /^\s*[-*] \[[ xX]\]/m.test(body);
  if (!anyBoxes) text = text.replace(/^(\s*)\d+\.\s+/gm, '$1- [ ] ');
  if (!body.trim()) text = `- [ ] ${title.replace(/^Try:\s*/, '')} (#${number} had nothing written down to try)`;
  if (!/^\s*- \[ \]/m.test(text)) return null;
  return `## ${heading}\n\n${demote(text)}`;
}

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const json = (...args) => JSON.parse(gh(...args));
const planPlaces = () => readPlaces(readFileSync(resolve('docs/farm-plan.md'), 'utf8'));
const readIssue = (n) => json('issue', 'view', String(n), '--json', 'number,title,body,labels,state');
const openTesting = () => json('issue', 'list', '--state', 'open', '--label', TESTING, '--limit', '500', '--json', 'number,title,body,labels');
const areaLabels = (labels) => labels.map((l) => l.name ?? l).filter((l) => AREAS.some(([a]) => a === l));

function option(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

/** Writes a walk: edits the open one, or opens it. Returns its number (or 'new' on a dry run). */
function writeWalk(walk, place, body, labels, dry, part = 1) {
  if (body.length > MAX_BODY) throw new Error(`${walkTitle(place, part)} would be ${body.length} characters, over GitHub's ${MAX_BODY}`);
  const file = resolve('.scratch', `walk-${place.replace(/\W+/g, '-')}.md`);
  mkdirSync(resolve('.scratch'), { recursive: true });
  writeFileSync(file, body);
  const add = [...new Set(labels)].filter((l) => !walk?.labels?.some((w) => w.name === l));
  if (dry) return walk?.number ?? 'new';
  if (walk) {
    gh('issue', 'edit', String(walk.number), '--body-file', file, ...add.flatMap((l) => ['--add-label', l]));
    return walk.number;
  }
  const url = gh('issue', 'create', '--title', walkTitle(place, part), '--label', TESTING, ...add.flatMap((l) => ['--label', l]), '--body-file', file).trim();
  return Number(url.split('/').pop());
}

function place(args) {
  const issue = readIssue(args[0]);
  const { place: p, why } = placeFor(issue, planPlaces());
  console.log(`${walkTitle(p)} (${why})`);
}

function add(args) {
  const [n] = args;
  const pr = option(args, '--pr');
  const linesFile = option(args, '--lines');
  if (!pr || !linesFile) throw new Error('add needs --pr <url> and --lines <file>');
  const dry = args.includes('--dry-run');
  const issue = readIssue(n);
  const places = planPlaces();
  const given = option(args, '--place');
  const p = given ? resolvePlace(given, places) : placeFor(issue, places).place;
  const text = section({ item: n, pr, lines: readFileSync(resolve(linesFile), 'utf8') });
  const open = openTesting();
  const already = open.find((i) => currentWalk([i], p) && hasSection(i.body, n));
  if (already) {
    console.log(`#${already.number} ${already.title} already has a section for #${n}`);
    return;
  }
  let walk = currentWalk(open, p);
  let part = walk?.part ?? 1;
  if (walk && withSection(walk.body, p, text).length > MAX_BODY) {
    part += 1;
    walk = null;
  }
  const labels = [TESTING, ...areaLabels(issue.labels)];
  const number = writeWalk(walk, p, withSection(walk?.body, p, text), labels, dry, part);
  // A /test session ticking lines, or another /todo adding, writes the whole body too: if one landed between the read and the write, ours replaced
  // it. Read it back, and add the section again to what is there now if it's gone.
  if (!dry && walk) {
    const now = readIssue(number);
    if (!hasSection(now.body, n)) writeWalk({ ...walk, body: now.body }, p, withSection(now.body, p, text), labels, false, part);
  }
  console.log(`${dry ? 'would add' : 'added'} #${n} to ${walk ? `#${number}` : 'a new walk,'} ${walkTitle(p, part)}${dry || walk ? '' : ` (#${number})`}`);
}

function fold(args) {
  const dry = args.includes('--dry-run');
  const out = option(args, '--out');
  const places = planPlaces();
  const testing = openTesting().sort((a, b) => a.number - b.number);
  const walks = new Map(testing.filter((i) => i.title.startsWith(TITLE)).map((i) => [i.title.slice(TITLE.length), i]));
  const groups = new Map();
  for (const t of testing.filter((i) => !i.title.startsWith(TITLE))) {
    const { item } = triedItem(t.body);
    const tried = item ? readIssue(item) : null;
    const from = tried && (areaLabels(tried.labels).length || whereItFits(tried.body)) ? tried : t;
    const { place: p, why } = placeFor(from, places);
    const text = foldedSection(t);
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push({ t, text, why: `${from === t ? `#${t.number}` : `#${item}`}: ${why}`, labels: [...areaLabels(t.labels), ...(tried ? areaLabels(tried.labels) : [])] });
  }
  for (const [p, entries] of groups) {
    const walk = walks.get(p);
    let body = walk?.body ?? '';
    for (const e of entries) if (e.text && !body.includes(`(was #${e.t.number})`)) body = withSection(body, p, e.text);
    if (out) {
      mkdirSync(resolve(out), { recursive: true });
      writeFileSync(join(resolve(out), `${p.replace(/\W+/g, '-')}.md`), body);
    }
    const number = writeWalk(walk, p, body, [TESTING, ...entries.flatMap((e) => e.labels)], dry);
    console.log(`${walkTitle(p)} ${walk ? `#${walk.number}` : dry ? '(new)' : `#${number} (new)`}, ${body.length} characters`);
    for (const e of entries) {
      console.log(`  #${e.t.number} ${e.t.title}  [${e.why}]${e.text ? '' : ' (every line ticked: closed with nothing to move)'}`);
      if (dry) continue;
      const comment = e.text ? `Folded into #${number}, ${walkTitle(p)}, with its unticked lines under "${e.text.split('\n')[0].slice(3)}" (#1179).`
        : `Every line was ticked, so nothing to move into #${number}, ${walkTitle(p)} (#1179).`;
      gh('issue', 'close', String(e.t.number), '--comment', comment);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const commands = { place, add, fold };
  const [command, ...args] = process.argv.slice(2);
  if (!commands[command] || (command !== 'fold' && !/^\d+$/.test(args[0] ?? ''))) {
    console.error('usage: node tools/walkIssue.mjs place <n> | add <n> --pr <url> --lines <file> [--place <p>] [--dry-run] | fold [--dry-run] [--out <dir>]');
    process.exit(2);
  }
  try {
    commands[command](args);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
