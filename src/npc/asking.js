// You ask the girls for a race, a drag run or the hill climb (Enter at the line). Asking is a priority for them: they leave what
// they were doing (availability's `pull`), take a quad and join in. Pure and tested. If it still can't happen, `askProblems` says why,
// in words, so the game can tell you (a toast when the ask runs out) and the debug panel and console can show it before you ask.

export const ASK_KINDS = ['race', 'drag', 'climb', 'cones'];
export const ASK_LABELS = { race: 'the lap race', drag: 'the drag race', climb: 'the hill climb', cones: 'the cone course' };

/** Seconds the girls get to find a quad and set off before the ask is called off with a reason. */
export const ASK_PATIENCE = 15;

/** How many girls an ask needs: both for the lap (they race each other and you), one for the drag run and the climb. */
export const GIRLS_NEEDED = { race: 2, drag: 1, climb: 1, cones: 1 };

/**
 * What stops this ask from working now, as a list of short sentences (empty if nothing does). `ctx`:
 *   girls: [{ id, name, free, why }]       free: she could be taken from what she's at (Companion.availability({ asked, pull })), why: what has her
 *   options: { girlId: [spec ids she could take] }
 *   busy: why nothing can start (another race on, the bell rung, a falling-out), or null
 *   riding: whether you are on a quad (the lap and drag races need it; the climb does not)
 *   distinct: whether the quads on offer cover everyone who needs one (null if not worked out)
 */
export function askProblems(kind, ctx) {
  const out = [];
  if (ctx.busy) out.push(ctx.busy);
  if (kind !== 'climb' && !ctx.riding) out.push('you need to be on a quad');
  const needed = Math.min(GIRLS_NEEDED[kind], ctx.girls.length);
  const usable = ctx.girls.filter((g) => g.free && (ctx.options[g.id] ?? []).length);
  if (usable.length >= needed && (kind !== 'race' || ctx.distinct !== false)) return out;
  for (const g of ctx.girls) {
    if (!g.free) out.push(`${g.name} is ${g.why}`);
    else if (!(ctx.options[g.id] ?? []).length) out.push(`${g.name} has no quad she can take`);
  }
  if (kind === 'race' && ctx.distinct === false && !out.length) out.push('there are not two different quads for them');
  return out;
}

/** The problems as one line for a toast or the panel. */
export function askLine(kind, problems) {
  return problems.length ? `${cap(ASK_LABELS[kind])}: ${problems.join('; ')}` : `${cap(ASK_LABELS[kind])}: nothing in the way`;
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);
