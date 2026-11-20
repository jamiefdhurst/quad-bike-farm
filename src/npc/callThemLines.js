// What the girls say when you call them from your wheel (callThem.js), and where the new farm's places are for a girl stuck out there
// (spotNames.js NEW_FARM_SPOT_NAMES). Merged in last of all (voiceLines.js, jessLines.js), so no recorded bank before them moves.

import { ALL_SPOT_NAMES, NEW_FARM_SPOT_NAMES } from './spotNames.js';

const shout = (lines, cooldown = 0) => ({ shout: true, cooldown, lines });
const line = (cooldown, lines) => ({ cooldown, lines });

const made = (bog, tip, here) => {
  const out = {};
  for (const [id, name] of Object.entries(NEW_FARM_SPOT_NAMES)) {
    out[`callout_bog_${id}`] = shout([bog(name)]);
    out[`callout_tip_${id}`] = shout([tip(name)]);
  }
  for (const [id, name] of Object.entries(ALL_SPOT_NAMES)) out[`called_${id}`] = line(0, [here(name)]);
  return out;
};

export const AMY_CALL_THEM_LINES = {
  ...made((at) => `I am stuck ${at}! Can you help me?`, (at) => `I have tipped it over ${at}! Please come!`, (at) => `I am ${at}! Do you see me?`),
  calledComing: line(0, ['Coming!', 'One moment, I am coming.', 'I heard you. I am on my way.']),
  farStop: line(0, ['Wait! That is much too far to walk. Come back for me!', 'You are miles away! Can you give me a lift?', 'I am not walking all that way. Come and fetch me!']),
};

export const JESS_CALL_THEM_LINES = {
  ...made((at) => `Oi! I'm stuck ${at}! Come and get me out!`, (at) => `I've flipped it ${at}! Quick, come on!`, (at) => `I'm ${at}! Over here!`),
  calledComing: line(0, ['Yeah, yeah, coming!', 'Hold your horses, I\'m coming!', 'Alright, alright, on my way!']),
  farStop: line(0, ['Oi! I\'m not walking all that way! Come and get me!', 'Are you serious? That\'s miles! Give us a lift!', 'No chance. Come back for me!']),
};
