// The frame budget's command line (tools/frameBudget.mjs says what it is for):
//   node tools/budget.mjs --dist dist [--root <checkout>] --out numbers.json     measure a build on its own
//   node tools/budget.mjs --summary pr.json [main.json]                          the markdown table for the job summary
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { summary } from './frameBudget.mjs';
import { measureBuild } from './frameBudgetRun.mjs';

const args = process.argv.slice(2);
const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

if (args.includes('--summary')) {
  const read = (p) => (p && existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : undefined);
  const [prFile, mainFile] = args.filter((a) => !a.startsWith('--'));
  const pr = read(prFile);
  if (!pr) {
    console.error('budget: no numbers to summarise');
    process.exit(2);
  }
  console.log(summary(pr, read(mainFile)));
} else {
  const result = await measureBuild({ dist: arg('--dist'), root: arg('--root') });
  if (arg('--out')) writeFileSync(arg('--out'), JSON.stringify(result, null, 1));
  else console.log(JSON.stringify(result, null, 1));
  process.exit(0);
}
