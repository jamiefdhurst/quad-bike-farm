// Puts data.json into the page: node tools/engine-review/build.mjs (after render.mjs). The page's order (page.json) and its template are
// read from here; data.json, compare.json and the built site/index.html are in .scratch/engine-review/.
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const dir = '.scratch/engine-review';
const here = (f) => new URL(f, import.meta.url);
const sha = execSync('git rev-parse --short HEAD').toString().trim();
const built = `${new Date().toISOString().slice(0, 10)} at ${sha}`;
// The page's order: what is waiting on Jamie's ears first, numbered as the questions in chat, then done and parked work. Each takes
// rows from a rendered section (sections.mjs writes compare.json).
const rendered = JSON.parse(readFileSync(`${dir}/compare.json`, 'utf8'));
const PAGE = JSON.parse(readFileSync(here('./page.json'), 'utf8'));
const compare = PAGE.map((p) => {
  const from = rendered.find((r) => r.id === p.from);
  if (!from) throw new Error(`no rendered section ${p.from}`);
  const rows = p.rows ? p.rows.map((id) => from.rows.find((r) => r.id === id) ?? (() => { throw new Error(`${p.from} has no ${id}`); })()) : from.rows;
  // `cols` picks and orders a rendered section's columns (by key); without it, all of them.
  const cols = p.cols ? p.cols.map((k) => from.cols.find((c) => c[0] === k) ?? (() => { throw new Error(`${p.from} has no column ${k}`); })()) : from.cols;
  return { id: p.id, n: p.n, status: p.status, title: p.title, question: p.question ?? '', intro: p.intro ?? from.intro, cols, rows };
});
const html = readFileSync(here('./site/template.html'), 'utf8').replace('/*DATA*/null', `{"vehicles":${readFileSync(`${dir}/data.json`, 'utf8')},"compare":${JSON.stringify(compare)}}`).replace('/*BUILT*/', built);
writeFileSync(`${dir}/site/index.html`, html);
console.log(`built ${built}, ${(html.length / 1024).toFixed(0)} KB`);
