// What the girls say when a quad's carb ices up on a cold, damp day (vehicle/carbIcing.js): carbIcing. Amy knows what it is and
// what clears it (a blip of the throttle, or stopping for a minute); Jess thinks it's broken. Merged into the main line sets
// (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_ICE_LINES = {
  carbIcing: line(60, ['That is carb icing. It is cold and damp and the carb has frozen up. Give it a good blip and it will clear.', 'It is losing power at a steady throttle? That is ice in the carb, not a fault. Blip it, or stop for a minute.', 'Damp air and a cold carb will do that. It is only ice, so open it right up and shut it again.']),
};

export const JESS_ICE_LINES = {
  carbIcing: ['It is dying on us! Something is broken, I am sure of it!', 'It has gone all flat! Is it out of petrol? Have you broken it?', 'It will not pull! It was fine a minute ago, what have you done to it?'],
};
