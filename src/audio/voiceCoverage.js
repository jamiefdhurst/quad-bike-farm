// Which of a girl's written lines have no recording in her voice bank, so they would be said by the browser's speech instead.
// Pure: the same list of lines tools/generate_companion_voice.py records (her situations' string lines, and her side of the banter),
// checked against the bank's `clips` (keyed by the line's text, as companionAudio.js looks them up).

/** Every distinct line a character says, as { text: [situations it is said in] }. `banter` is BANTER from banterLines.js. */
export function spokenLines(character, banter = []) {
  const out = {};
  for (const [situation, entry] of Object.entries(character.lines)) {
    for (const line of entry.lines) if (typeof line === 'string') (out[line] ??= []).push(situation);
  }
  for (const entry of banter) {
    for (const [who, line] of entry.lines) if (who === character.id) (out[line] ??= []).push('banter');
  }
  return out;
}

/** The lines with no clip in `clips`: [{ text, situations }], in the order they are written. */
export function unrecordedLines(character, clips, banter = []) {
  return Object.entries(spokenLines(character, banter))
    .filter(([text]) => !clips?.[text])
    .map(([text, situations]) => ({ text, situations }));
}
