// A game without the girls, the farm to yourself. The switch is ?vx=2 in the URL: deliberately a name that means
// nothing, so it can sit in the address bar (or a bookmark, or a screen share) without saying what it does. Not in the FAQ. Pure.

const KEY = 'vx';
const VALUE = '2';

/** Whether this URL's query string (location.search) asks for a game with no girls in it. */
export function girlsLeftOut(search) {
  return new URLSearchParams(search ?? '').get(KEY) === VALUE;
}
