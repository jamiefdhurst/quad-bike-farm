// What the girls know of how a quad came to be as it is (vehicle/history.js): who had it out yesterday (histRiderAmy,
// histRiderJess: the girl it was), a fault it already had (histPuncture, histBelt, histCable, histCarb, histMounts, histChain, histValves) and tinkering left
// in (histLimiter, histMixture). Amy says it plainly; Jess is cheerful about it. Written for the colour and each nickname
// (see quadLines.js), and merged into the main line sets (voiceLines.js, jessLines.js).

import { expandQuadLines } from './quadNames.js';

const line = (cooldown, lines) => ({ cooldown, lines });

const AMY_TEMPLATES = {
  histRiderAmy: line(600, ['I had {q} out yesterday. It was fine.']),
  histRiderJess: line(600, ['Jess had {q} out yesterday. I would check it over.']),
  histPuncture: line(600, ['{Q} has a slow puncture. It was like that yesterday.']),
  histBelt: line(600, ['The belt on {q} was slipping yesterday. I did tell someone.']),
  histCable: line(600, ['The throttle on {q} sticks. It has done for a day or two.']),
  histCarb: line(600, ['{Q} has been running badly. I think the carb is dirty.']),
  histMounts: line(600, ['The engine mounts on {q} are worn. It shakes more than it should.']),
  histChain: line(600, ['The chain on {q} is loose. It was slapping yesterday.']),
  histValves: line(600, ['{q} was ticking away yesterday. I think the valves want setting.']),
  histLimiter: line(600, ['Someone has wound the throttle stop right out on {q}. I did not do it.']),
  histMixture: line(600, ['Someone has been at the carb on {q}. It is running rich.']),
};

const JESS_TEMPLATES = {
  histRiderAmy: line(600, ['Amy had {q} out yesterday. Went about four miles an hour.']),
  histRiderJess: line(600, ['I had {q} out yesterday. Brilliant. Properly flew.']),
  histPuncture: line(600, ['{Q} has a soft tyre. It will be fine, it was like that yesterday.']),
  histBelt: line(600, ['{Q} slips a bit. Just give it more welly.']),
  histCable: line(600, ['The throttle on {q} sticks a bit. You get used to it.']),
  histCarb: line(600, ['{Q} has been a bit poorly. Needs a good clean, probably.']),
  histMounts: line(600, ['{Q} clonks when you stab the throttle. You get used to it.']),
  histChain: line(600, ['The chain on {q} rattles a bit. It adds atmosphere.']),
  histValves: line(600, ['{q} goes tick tick tick. I like it, it is like a little clock.']),
  histLimiter: line(600, ['Someone has wound the stop out on {q}. Good. I like them.']),
  histMixture: line(600, ['Someone has richened up {q}. It smokes more. I love it.']),
};

export const AMY_HISTORY_LINES = expandQuadLines(AMY_TEMPLATES);
export const JESS_HISTORY_LINES = expandQuadLines(JESS_TEMPLATES);
export const HISTORY_KINDS = Object.keys(AMY_TEMPLATES);
