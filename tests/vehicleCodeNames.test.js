import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

// The code calls each vehicle by the game's name (tor, crag, bruin...), never by the real one it copies. The one place the real vehicle
// is named is the "After a ..." line at the top of its body file, which the vehicle reviews check the model against (#800).
const { codeNames, fileNames } = JSON.parse(readFileSync('tools/realMakes.json', 'utf8'));
const NAMED = new RegExp(codeNames.join('|'), 'i');
const FILE_NAMED = new RegExp(`^(${fileNames.join('|')})`, 'i');

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = path.join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

describe('the code does not name the real vehicles', () => {
  it('has no line in src or tests naming one, apart from an "After a ..." line', () => {
    const bad = [];
    for (const f of [...walk('src'), ...walk('tests')].filter((p) => p.endsWith('.js') && !p.endsWith('vehicleCodeNames.test.js'))) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (NAMED.test(line) && !/^\/\/ After an? /.test(line)) bad.push(`${f}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('has no file in src/vehicle named after a real vehicle', () => {
    const files = walk('src/vehicle').map((p) => path.basename(p));
    expect(files.filter((f) => NAMED.test(f) || FILE_NAMED.test(f))).toEqual([]);
  });

  it('starts each model\'s body file with the line naming the real vehicle', () => {
    for (const f of ['bruin', 'hornet', 'rb300', 'racer', 'junior', 'tz65', 'shepherd', 't185', 'plover', 'ursa', 'hartley', 'yak', 'tor', 'crag', 'finch', 'griffin', 'vauclair', 'mower']) {
      expect(readFileSync(`src/vehicle/${f}Body.js`, 'utf8').split('\n')[0], f).toMatch(/^\/\/ After an? /);
    }
  });
});
