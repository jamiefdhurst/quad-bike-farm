/**
 * What your own wheel ("You ask for", Enter looking at nobody) offers: the thing the start you are at is for, named for what it does, and
 * "A race" (the lap) always. Pure, so the labels and the order are tested; game.js says where you are and what each one runs.
 */
export function yourAsks({ riding, near }) {
  if (!riding) return [{ id: 'race', label: 'A race', disabled: true, hint: 'you need to be driving a quad' }];
  const here = [
    near.climb && { id: 'climb', label: 'The hill climb' },
    near.pit && { id: 'pit', label: 'The pit climb' },
    near.cones && { id: 'cones', label: 'The cone course' },
    near.drag && { id: 'drag', label: 'A drag race' },
  ].filter(Boolean);
  return [...here, { id: 'race', label: 'A race' }];
}

/**
 * The prompt riding up to a climb's start (within its nearStart) looking at nobody: Enter opens your wheel, which has the climb on it. Null
 * anywhere else. The pit's start wins if you are somehow near both.
 */
export function startPrompt(near) {
  const what = near.pit ? 'the pit climb' : near.climb ? 'the hill climb' : null;
  return what && { action: `Time ${what}`, key: 'Enter' };
}
