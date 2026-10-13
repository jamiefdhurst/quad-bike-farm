// What the girls know of how a quad came to be as it is (vehicle/history.js): who had it out yesterday (histRiderAmy,
// histRiderJess: the girl it was), a fault it already had (histPuncture, histBelt, histCable, histCarb, histMounts, histChain, histValves, histRod, histRim, histLeak, histClutch) and tinkering left
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
  histClutch: line(600, ['The clutch on {q} was slipping yesterday and it smelt hot. It wants a new plate.']),
  histLeak: line(600, ['{Q} has a split in the intake boot. It hunts at idle and pops when you come off the throttle.']),
  histValves: line(600, ['{q} was ticking away yesterday. I think the valves want setting.']),
  histRod: line(600, ['Someone has bent the track rod on {q}. It pulls to one side.']),
  histRim: line(600, ['{Q} has a bent rim. You can see the wheel wobble when it goes.']),
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
  histClutch: line(600, ['{Q} slips a bit when you pull away. You just have to be quicker with your feet.']),
  histLeak: line(600, ['{Q} pops and hisses when you lift off. It is like it is telling jokes.']),
  histValves: line(600, ['{q} goes tick tick tick. I like it, it is like a little clock.']),
  histRod: line(600, ['{Q} steers itself a bit. It is brilliant, you just let it.']),
  histRim: line(600, ['{Q} has a wobbly wheel. It wibbles. I like it.']),
  histLimiter: line(600, ['Someone has wound the stop out on {q}. Good. I like them.']),
  histMixture: line(600, ['Someone has richened up {q}. It smokes more. I love it.']),
};

export const AMY_HISTORY_LINES = expandQuadLines(AMY_TEMPLATES);
export const JESS_HISTORY_LINES = expandQuadLines(JESS_TEMPLATES);
export const HISTORY_KINDS = Object.keys(AMY_TEMPLATES);
