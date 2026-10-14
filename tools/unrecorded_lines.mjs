// Lists every line a girl says that has no recording in her voice bank (it would fall back to browser speech).
// node tools/unrecorded_lines.mjs [amy|jess]   Exits 1 if any are missing, so it can sit in a script or a check.
import { readFileSync } from 'node:fs';
import { CHARACTERS } from '../src/npc/characters.js';
import { BANTER } from '../src/npc/banterLines.js';
import { unrecordedLines } from '../src/audio/voiceCoverage.js';

const only = process.argv[2];
let missing = 0;
for (const c of CHARACTERS) {
  if (only && c.id !== only) continue;
  const bank = JSON.parse(readFileSync(new URL(`../public/audio/${c.voiceBank}.json`, import.meta.url)));
  const list = unrecordedLines(c, bank.clips, BANTER);
  missing += list.length;
  console.log(`${c.name}: ${list.length} unrecorded`);
  for (const { text, situations } of list) console.log(`  [${situations.join(', ')}] ${text}`);
}
process.exit(missing ? 1 : 0);
