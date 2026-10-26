// The frame budget's command line (tools/frameBudget.mjs says what it is for):
//   node tools/budget.mjs --dist dist [--root <checkout>] --out numbers.json     measure a build on its own
//   node tools/budget.mjs --summary pr.json [main.json] [--history history.json]  the markdown table for the job summary, and the trend of the last ten merges
//   node tools/budget.mjs --record numbers.json --history history.json --sha <sha> --label <text>   add a merge to the history (perf-history.yml)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { summary } from './frameBudget.mjs';
import { append, entry, trend } from './budgetHistory.mjs';
import { measureBuild } from './frameBudgetRun.mjs';

const args = process.argv.slice(2);
const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

const read = (p) => (p && existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : undefined);

if (args.includes('--record')) {
  const numbers = read(arg('--record'));
  if (!numbers) {
    console.error('budget: no numbers to record');
    process.exit(2);
  }
  const history = append(read(arg('--history')) ?? [], entry({ sha: arg('--sha'), label: arg('--label'), at: new Date().toISOString().slice(0, 10) }, numbers));
  writeFileSync(arg('--history'), JSON.stringify(history, null, 1));
  console.log(`budget: ${history.length} merges in the history`);
} else if (args.includes('--summary')) {
  const [prFile, mainFile] = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--history'));
  const pr = read(prFile);
  if (!pr) {
    console.error('budget: no numbers to summarise');
    process.exit(2);
  }
  console.log(summary(pr, read(mainFile)));
  const t = trend(read(arg('--history')) ?? []);
  if (t) console.log(`\n${t}`);
} else {
  const result = await measureBuild({ dist: arg('--dist'), root: arg('--root') });
  if (arg('--out')) writeFileSync(arg('--out'), JSON.stringify(result, null, 1));
  else console.log(JSON.stringify(result, null, 1));
  process.exit(0);
}
