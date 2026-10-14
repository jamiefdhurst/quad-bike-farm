// The panel is 340 px wide, so a button label that runs past one line is hard to read. Labels are written as a short action
// followed by any explanation in brackets ("% works at the bench (needs a quad parked there)"); the button shows the action and
// the explanation becomes its tooltip.

/** The longest button text that fits on one line. */
export const BUTTON_MAX = 40;

/** Splits "action (explanation)" or "action: explanation" into the text for the button and the tooltip (the whole label). */
export function buttonText(label) {
  const cut = label.search(/ \(|: /);
  return { text: cut > 0 ? label.slice(0, cut) : label, hint: label };
}
