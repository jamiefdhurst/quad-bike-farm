import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FONT_STACKS, boardFont, applyFontVariables } from '../src/world/boardFont.js';

// Everything written in the barn uses the two fonts of boardFont.js (#818, #807): a canvas asks for a role, the stylesheets for a variable, and none names a font.
const SCRIPTS = [
  'src/world/jobBoard.js', 'src/photos/photoBoard.js', 'src/world/classifiedsView.js', 'src/world/wallCalendar.js', 'src/world/weatherStation.js',
  'src/world/moneyTin.js', 'src/world/biscuitTin.js', 'src/workshop/notebookModel.js', 'src/workshop/tyreRackModel.js', 'src/workshop/sparesModel.js',
  'src/workshop/shedModels.js', 'src/workshop/chargerModel.js',
];
const STYLES = ['src/world/jobBoard.css', 'src/photos/photoBoard.css', 'src/world/classifieds.css', 'src/workshop/notebook.css'];
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('the barn\'s fonts', () => {
  it('are two roles of system fonts, neither of them Comic Sans', () => {
    expect(Object.keys(FONT_STACKS).sort()).toEqual(['board', 'label']);
    for (const stack of Object.values(FONT_STACKS)) expect(stack).not.toMatch(/comic/i);
    expect(boardFont('board', 24, 'bold')).toBe(`bold 24px ${FONT_STACKS.board}`);
    expect(boardFont('label', 12)).toBe(`12px ${FONT_STACKS.label}`);
  });
  it('are asked for by role in every canvas the barn writes on, never by name', () => {
    for (const p of SCRIPTS) {
      const source = read(p);
      const fonts = source.match(/\.font\s*=\s*[^;]+;/g) ?? [];
      expect(fonts.length, p).toBeGreaterThan(0);
      for (const f of fonts) expect(f, `${p}: ${f}`).toMatch(/=\s*boardFont\('(board|label)',/);
      expect(source, p).not.toMatch(/Comic Sans|Georgia|Courier|sans-serif|monospace/);
    }
  });
  it('are set in the stylesheets by variable', () => {
    for (const p of STYLES) {
      const families = read(p).match(/font-family:[^;]+;/g) ?? [];
      expect(families.length, p).toBeGreaterThan(0);
      for (const f of families) expect(f, p).toMatch(/var\(--font-(board|label)\)/);
    }
    expect(read('src/style.css')).not.toMatch(/Comic Sans/);
  });
  it('are set on the page once, as variables', () => {
    const set = {};
    applyFontVariables({ style: { setProperty: (k, v) => (set[k] = v) } });
    expect(set).toEqual({ '--font-board': FONT_STACKS.board, '--font-label': FONT_STACKS.label });
  });
});
