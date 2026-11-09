// Finds names used in code that nothing declares: the mistake that stopped the girls choosing when #725 moved code out of game.js and left a constant
// behind (#764). It throws only when that line runs, and the frame guard catches it, so nothing else notices. TypeScript's checker, for this one error
// only: no types are asked of the game, and each file is read alone, as nothing here needs to follow an import.
import ts from 'typescript';

const NAME_ERRORS = new Set([2304, 2552, 18004]); // cannot find name, cannot find name (did you mean), no value for a shorthand property

const OPTIONS = {
  allowJs: true,
  checkJs: true,
  noEmit: true,
  noResolve: true,
  skipLibCheck: true,
  types: [],
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  lib: ['lib.esnext.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
};

/** Where names are used in the code proper. A walk of the tree does not go into comments, so a type named in JSDoc is not among them. */
function namesInCode(file) {
  const at = new Set();
  const walk = (node) => {
    if (ts.isIdentifier(node)) at.add(node.getStart(file));
    ts.forEachChild(node, walk);
  };
  walk(file);
  return at;
}

/** `{ file, name, line }` for each undefined name in `paths`, leaving out `known[file]`: the names a file gets from outside the page, relative to `root`. */
export function undefinedNames(paths, { known = {}, root = '' } = {}) {
  const program = ts.createProgram(paths, OPTIONS);
  const out = [];
  for (const path of paths) {
    const file = program.getSourceFile(path);
    const inCode = namesInCode(file);
    const allowed = known[path.slice(root.length)] ?? [];
    for (const d of program.getSemanticDiagnostics(file)) {
      if (!NAME_ERRORS.has(d.code) || !inCode.has(d.start)) continue;
      const name = file.text.slice(d.start, d.start + d.length);
      if (!allowed.includes(name)) out.push({ file: path.slice(root.length), name, line: file.getLineAndCharacterOfPosition(d.start).line + 1 });
    }
  }
  return out;
}
