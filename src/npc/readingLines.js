// Reading the dash out (dashReading.js). Amy says it in good time and helpfully; Jess says it when it's too late. Merged
// into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_READING_LINES = {
  readFuel: line(60, ["Your fuel is on the red. We should fill up soon.", "The fuel light is on, you know.", "You are into the reserve. Do not go far."]),
  readCold: line(60, ["It is still cold. Go easy on it.", "The engine has not warmed up yet. Gently, please.", "The temperature gauge is still down. Give it a minute."]),
  readHot: line(60, ["The temperature light is on. Ease off.", "It is running hot. Slow down a bit.", "The engine is getting too hot. Maybe a rest?"]),
};

export const JESS_READING_LINES = {
  readFuel: ["Your fuel is on the red. Has been for ages.", "Um, the tank is basically empty. Just so you know.", "Fuel light. Very, very on."],
  readCold: ["It was cold, you know. You thrashed it.", "That engine was freezing when you flogged it. Just saying.", "Told you it needed warming up. Well, I was going to."],
  readHot: ["It has been boiling for ages. I did not like to say.", "The temperature light has been on for a bit. A while, actually.", "Is it meant to rattle like that? It is pretty hot."],
};
