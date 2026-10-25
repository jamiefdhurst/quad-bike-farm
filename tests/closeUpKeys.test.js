import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// .claude/rules/controls.md: a close-up screen is closed by B and Esc only. E acts on it and G does nothing there.
const SCREENS = [
  'src/world/classifiedsView.js', 'src/world/jobBoard.js', 'src/world/moneyTinView.js', 'src/photos/photoBoard.js',
  'src/workshop/notebook.js', 'src/workshop/shedView.js', 'src/workshop/sparesShelf.js', 'src/workshop/bench.js',
];

const handleInput = (path) => {
  const src = readFileSync(path, 'utf8');
  const at = src.indexOf('handleInput(input)');
  expect(at).toBeGreaterThan(-1);
  return src.slice(at, src.indexOf('\n  }\n', at));
};

describe('close-up screens', () => {
  for (const path of SCREENS) {
    it(`${path} closes on B and Esc, and not on G`, () => {
      const body = handleInput(path);
      expect(body).toContain("wasPressed('KeyB')");
      expect(body).toContain("wasPressed('Escape')");
      expect(body).not.toContain("wasPressed('KeyG')");
    });
  }

  it('lets E do nothing to close the read-only screens', () => {
    for (const path of SCREENS.filter((p) => !p.endsWith('bench.js') && !p.endsWith('sparesShelf.js') && !p.endsWith('shedView.js'))) {
      expect(handleInput(path)).not.toContain("wasPressed('KeyE')");
    }
  });

  it('closes the girls\' wheel on B and Esc, not on E or Q', () => {
    const src = readFileSync('src/interaction/wheel.js', 'utf8');
    expect(src).toContain("wasPressed('KeyB')");
    expect(src).not.toContain("wasPressed('KeyE')");
    expect(src).not.toContain("wasPressed('KeyQ')");
  });

  it('flies photo mode up on Space and down on C, poses on E and leaves on B', () => {
    const src = readFileSync('src/photos/photoHost.js', 'utf8');
    expect(src).toContain("up: key('Space', 'KeyC')");
    expect(src).toContain("wasPressed('KeyE')) this.setGirlsPosing");
    expect(src).toContain("wasPressed('KeyB')");
  });
});
