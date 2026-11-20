// The two fonts everything written in the barn uses (#818, #807 asks for them for the whole game): `board` for what is written by hand (the job board, the
// photo board, the forecast slate, the calendar's month, the notebook) and `label` for what is printed (the ads, the dials, the tin and rack labels, the charger).
// A canvas texture asks for a role by `boardFont('board', 24)`, never a font name; the CSS asks for `var(--font-board)` or `var(--font-label)`, set here once.
// System fonts only, so there is nothing to credit: whichever of each stack the player's machine has.

export const FONT_STACKS = {
  board: '"Bradley Hand", "Segoe Print", "Chalkboard SE", "Marker Felt", cursive',
  label: '"Arial Narrow", "Helvetica Neue", Arial, sans-serif',
};

/** The canvas `font` string for a role at `px` pixels, with an optional `style` ('bold', 'italic', 'bold italic'). */
export const boardFont = (role, px, style = '') => `${style ? `${style} ` : ''}${px}px ${FONT_STACKS[role]}`;

/** Sets `--font-board` and `--font-label` on the page, for the boards' stylesheets. Runs once when this module is loaded in a page. */
export function applyFontVariables(root = typeof document !== 'undefined' ? document.documentElement : null) {
  if (!root) return;
  for (const [role, stack] of Object.entries(FONT_STACKS)) root.style.setProperty(`--font-${role}`, stack);
}

applyFontVariables();
