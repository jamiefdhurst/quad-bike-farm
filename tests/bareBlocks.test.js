import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import { buildWorldModels, modelStats, CATALOGUED_BUILDERS } from './helpers/worldModels.js';
import { SET_PIECE_NAMES, BARN_PROP_NAMES } from '../src/world/farDetail.js';

// Anything new you'll see has to look like more than a block. This builds every named set piece, barn prop, carried item and fixture and
// fails one that is a block, has too few parts, or is all plain colour. The limits come from what is there now (the smallest model that looks
// right passes); a new one that fails needs its detail, not a bigger allowance: read .claude/rules/looks.md.

const MIN_MESHES = 2;
const MIN_TRIANGLES = 40;
const BLOCK_MESHES = 3; // this many meshes or fewer, all of them boxes, is a block with a lid
const MIN_PLAIN_AREA = 1; // m2: a model with less surface than this, in one plain colour, is a small thing (a bolt, a strap) and not judged on its texture
const MIN_TEXTURED = 0.1; // of the surface, which must have a texture or vertex colours (the kits' canvas textures) above MIN_PLAIN_AREA

/** Existing models that are plain colour all over, with why; each is for a detail item to fix and then remove. Never add a new thing here. */
const KNOWN_PLAIN = {
  logs: 'bark in two flat browns, no grain or rings on the ends',
  coneCourse: 'moulded orange rubber cones, no texture',
  tyreRack: 'black tyres and a plain steel frame',
  helmetHooks: 'a painted board and plain hooks',
  sparesRack: 'a steel shelf and bins in flat colour',
  generator: 'a red painted housing in flat colour',
  compressor: 'a red painted tank in flat colour',
  washer: 'a white painted body in flat colour',
  brushwood: 'sticks in flat brown, no bark texture',
  'trolley-jack': 'painted steel in flat colour',
  pit: 'concrete and steel edging in flat colour',
};

const FIX = 'Read .claude/rules/looks.md: give it a shape (a frame, a lip, parts), a texture from the kits and small detail, then run this again. Do not add it to KNOWN_PLAIN.';

let models;
beforeAll(async () => {
  models = await buildWorldModels();
}, 60000);

describe('the bare-block check', () => {
  it('has a model for every set piece and barn prop named in farDetail.js, and none that is not named there', () => {
    const built = (kind) => models.filter((m) => m.kind === kind).map((m) => m.name).sort();
    expect(built('setPiece'), 'SET_PIECE_NAMES: add the new one to buildWorldModels in tests/helpers/worldModels.js').toEqual([...SET_PIECE_NAMES].sort());
    expect(built('barnProp'), 'BARN_PROP_NAMES: add the new one to buildWorldModels in tests/helpers/worldModels.js').toEqual([...BARN_PROP_NAMES].sort());
  });

  it('has a model for every build function of the items and the workshop', () => {
    const exported = [];
    for (const dir of ['items', 'workshop']) {
      for (const f of fs.readdirSync(new URL(`../src/${dir}/`, import.meta.url)).filter((n) => n.endsWith('.js'))) {
        const src = fs.readFileSync(new URL(`../src/${dir}/${f}`, import.meta.url), 'utf8');
        for (const m of src.matchAll(/^export function (build[A-Z]\w*)/gm)) exported.push(`${dir}/${f}: ${m[1]}`);
      }
    }
    const missing = exported.filter((e) => !CATALOGUED_BUILDERS.includes(e.split(': ')[1]));
    expect(missing, `no entry in buildWorldModels (tests/helpers/worldModels.js) and CATALOGUED_BUILDERS, so nothing checks that it is more than a block. ${FIX}`).toEqual([]);
  });

  it('has no model that is a block, or a few blocks', () => {
    const blocks = models.filter(({ group }) => {
      const s = modelStats(group);
      return s.meshes <= BLOCK_MESHES && s.boxes === s.meshes;
    });
    expect(blocks.map((m) => m.name), `these are blocks. ${FIX}`).toEqual([]);
  });

  it('has no model of too few parts or triangles', () => {
    const thin = models.filter(({ group }) => {
      const s = modelStats(group);
      return s.meshes < MIN_MESHES || s.triangles < MIN_TRIANGLES;
    });
    expect(thin.map((m) => `${m.name} (${modelStats(m.group).meshes} meshes, ${Math.round(modelStats(m.group).triangles)} triangles)`), `too little to look like the real thing. ${FIX}`).toEqual([]);
  });

  it('has no large model in one plain colour, apart from the known ones', () => {
    const plain = models.filter(({ group }) => {
      const s = modelStats(group);
      return s.area >= MIN_PLAIN_AREA && s.textured < MIN_TEXTURED;
    });
    expect(plain.map((m) => m.name).filter((n) => !(n in KNOWN_PLAIN)), `plain colour all over. ${FIX}`).toEqual([]);
  });

  it('lists as known only models that are still plain, so a fixed one comes off the list', () => {
    const plain = new Set(
      models.filter(({ group }) => {
        const s = modelStats(group);
        return s.area >= MIN_PLAIN_AREA && s.textured < MIN_TEXTURED;
      }).map((m) => m.name),
    );
    expect(Object.keys(KNOWN_PLAIN).filter((n) => !plain.has(n)), 'now textured (or gone): remove it from KNOWN_PLAIN').toEqual([]);
  });
});
