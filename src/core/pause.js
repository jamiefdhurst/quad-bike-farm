// When the farm stands still: while the start or pause card covers the game (before the first click, or after Esc lets the mouse go).
// Not while the overlay is only the small hint left by the tuning panel or the console, which you use to watch the game live, nor
// while the toolbox panel has it out of the way. Pure.

const RUNS_UNDER = ['hidden', 'tuning', 'workshop'];

/** `classes`: the overlay's class list (any iterable of names); `display`: its inline style's display, if set. */
export function overlayPauses(classes, display = '') {
  if (display === 'none') return false;
  const list = [...classes];
  return !RUNS_UNDER.some((c) => list.includes(c));
}
