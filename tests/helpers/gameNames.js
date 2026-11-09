// Finds a name asked of the game that nothing gives it: `this.g.someMethod()` in a host, after the method was renamed or moved, throws only when that line
// runs, and the frame guard catches it (#764, #767). The game gives names three ways: a member of `class Game`, `this.x = ...` in it, and an assignment from
// outside (`g.showForced = ...` in the debug tab, `Object.assign(game, ...)`). A name asked of it is a property read off something that is the game:
// `this` inside `Game`, `this.g` or `this.game` in another class, a parameter called `g` or `game`, and a `const g = this.g` or `const { a, b } = this.g` of
// those. Names are read from the code by TypeScript's parser (nothing is type-checked), one file at a time.
import ts from 'typescript';
import { readFileSync } from 'node:fs';

const ASSIGN = new Set([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.BarEqualsToken,
]);

/** Names every object has, so asking the game for one is never a mistake. */
const OBJECT_NAMES = new Set(['constructor', 'hasOwnProperty', 'toString', 'valueOf', 'toJSON']);

/**
 * What one file gives the game and asks of it: { provides: Set<string>, asks: { name, line }[] }.
 * @param {string} text the file's source
 * @param {{ gameClass?: string, paramsAreGame?: boolean }} [o] the class that is the game, when this file has it; and whether a parameter called `g` or `game` is
 * the game here (in most files `g` is a green channel, a canvas context or a geometry)
 */
export function readGameNames(text, { gameClass = 'Game', paramsAreGame = true } = {}) {
  const file = ts.createSourceFile('x.js', text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  const provides = new Set();
  const asks = [];
  const lineOf = (node) => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;

  /** Whether this expression is the game, in the scope `ctx` (the names bound to it and whether `this` is it). */
  const isGame = (e, ctx) => {
    if (ts.isParenthesizedExpression(e)) return isGame(e.expression, ctx);
    if (ts.isIdentifier(e)) return ctx.vars.has(e.text);
    if (e.kind === ts.SyntaxKind.ThisKeyword) return ctx.thisIsGame;
    if (ts.isPropertyAccessExpression(e) && e.expression.kind === ts.SyntaxKind.ThisKeyword && !ctx.thisIsGame) return e.name.text === 'g' || e.name.text === 'game';
    return false;
  };

  const ask = (node, name) => {
    if (!OBJECT_NAMES.has(name)) asks.push({ name, line: lineOf(node) });
  };

  /** The game's properties named inside the left side of an assignment: provided, not asked. */
  const providedBy = (left, ctx, seen) => {
    if (ts.isParenthesizedExpression(left)) return providedBy(left.expression, ctx, seen);
    if (ts.isPropertyAccessExpression(left) && isGame(left.expression, ctx)) {
      provides.add(left.name.text);
      seen.add(left);
    } else if (ts.isArrayLiteralExpression(left)) left.elements.forEach((el) => providedBy(el, ctx, seen));
    else if (ts.isObjectLiteralExpression(left)) {
      for (const p of left.properties) {
        if (ts.isPropertyAssignment(p)) providedBy(p.initializer, ctx, seen);
        else if (ts.isShorthandPropertyAssignment(p)) continue;
      }
    }
  };

  const FUNCTIONS = new Set([
    ts.SyntaxKind.FunctionDeclaration,
    ts.SyntaxKind.FunctionExpression,
    ts.SyntaxKind.MethodDeclaration,
    ts.SyntaxKind.Constructor,
    ts.SyntaxKind.GetAccessor,
    ts.SyntaxKind.SetAccessor,
    ts.SyntaxKind.ArrowFunction,
  ]);

  const walk = (node, ctx, seen) => {
    let next = ctx;
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      const isGameClass = node.name?.text === gameClass;
      for (const m of node.members) {
        if (isGameClass && m.name && (ts.isIdentifier(m.name) || ts.isStringLiteral(m.name))) provides.add(m.name.text);
      }
      next = { ...ctx, inGameClass: isGameClass };
    } else if (FUNCTIONS.has(node.kind)) {
      const arrow = node.kind === ts.SyntaxKind.ArrowFunction;
      const vars = new Set(ctx.vars);
      // A callback (`.filter((g) => ...)`) names something else `g`, and shadows the game where it is; any other function with such a parameter is handed the game.
      const callback = (ts.isCallExpression(node.parent) || ts.isNewExpression(node.parent)) && node.parent.arguments?.includes(node);
      for (const p of node.parameters) {
        if (!ts.isIdentifier(p.name) || (p.name.text !== 'g' && p.name.text !== 'game')) continue;
        if (callback) vars.delete(p.name.text);
        else if (paramsAreGame) vars.add(p.name.text);
      }
      const directMember = node.parent && ts.isClassLike(node.parent);
      next = { ...ctx, vars, thisIsGame: arrow ? ctx.thisIsGame : !!(directMember && ctx.inGameClass) };
    } else if (ts.isVariableDeclaration(node) && node.initializer && isGame(node.initializer, ctx)) {
      if (ts.isIdentifier(node.name)) ctx.vars.add(node.name.text);
      else if (ts.isObjectBindingPattern(node.name)) {
        for (const el of node.name.elements) if (!el.dotDotDotToken) ask(el, (el.propertyName ?? el.name).text);
      }
    } else if (ts.isBinaryExpression(node) && ASSIGN.has(node.operatorToken.kind)) {
      providedBy(node.left, ctx, seen);
    } else if ((ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node)) && node.operand) {
      providedBy(node.operand, ctx, seen);
    } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.arguments.length >= 2) {
      const callee = node.expression;
      if (ts.isIdentifier(callee.expression) && callee.expression.text === 'Object' && isGame(node.arguments[0], ctx)) {
        if (callee.name.text === 'assign') for (const o of node.arguments.slice(1)) if (ts.isObjectLiteralExpression(o)) for (const p of o.properties) if (p.name) provides.add(p.name.text);
        if (callee.name.text === 'defineProperty' && ts.isStringLiteral(node.arguments[1])) provides.add(node.arguments[1].text);
      }
    }
    if (ts.isPropertyAccessExpression(node) && !seen.has(node) && isGame(node.expression, ctx)) ask(node.name, node.name.text);
    // A declaration's name or an object key is not a use of anything: walk what is inside, but a plain `{ g }` shorthand is not walked as a read.
    ts.forEachChild(node, (child) => walk(child, next, seen));
  };

  walk(file, { vars: new Set(), thisIsGame: false, inGameClass: false }, new Set());
  return { provides, asks };
}

/**
 * The names asked of the game that nothing gives it, across `paths`: [{ file, name, line }]. `leftOut` are files not read for asks, as the game
 * means something else in them (they still count for what they give); `root` is taken off the front of each path; `paramsAreGame(file)` says where a parameter
 * called `g` or `game` is the game; `gameFile` is the one with `class Game`.
 */
export function namesAskedOfGame(paths, { leftOut = {}, root = '', paramsAreGame = () => true, gameFile = 'game.js' } = {}) {
  const provides = new Set();
  const asked = [];
  for (const path of paths) {
    const rel = path.slice(root.length);
    const r = readGameNames(readFileSync(path, 'utf8'), { gameClass: rel === gameFile ? 'Game' : '', paramsAreGame: paramsAreGame(rel) });
    r.provides.forEach((n) => provides.add(n));
    if (!(rel in leftOut)) for (const a of r.asks) asked.push({ file: rel, ...a });
  }
  return asked.filter((a) => !provides.has(a.name));
}
