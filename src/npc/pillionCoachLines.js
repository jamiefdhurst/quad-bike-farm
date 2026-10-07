// What the girl on the back says as she coaches the one driving (pillionCoach.js), keyed by the advice (skills.js COACHING):
// coachGive_<key>. The driver answers with the usual taught_, coachWrongTime and coachNagged lines. Amy's are patient and
// helpful; Jess's are loud and bossy. Merged into the main line sets (voiceLines.js, jessLines.js).

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_PILLION_COACH_LINES = {
  coachGive_chokeOff: line(15, ["It's warm now. Choke off.", 'You can take the choke off, you know.', 'Choke off now, it will run better.']),
  coachGive_crankLess: line(15, ['Short bursts on the starter. You will flood it.', 'Let go of it a moment, then go again.', 'Little goes on the starter, not one long one.']),
  coachGive_easyCorner: line(15, ['Ease off before the corner, not in it.', 'Slow down before you turn. Gently.', 'Bit slower into the bend. That is it.']),
  coachGive_keepGoing: line(15, ["Keep going, don't stop in the wet.", 'Throttle on through the mud!', 'Do not lift off. Keep it going.']),
};

export const JESS_PILLION_COACH_LINES = {
  coachGive_chokeOff: ['Choke! Choke off! Honestly!', 'It is warm! Take the choke off!', 'Choke. Off. Do I have to do everything?'],
  coachGive_crankLess: ['Stop holding it! Short bursts!', 'You are flooding it! Let go of the starter!', 'Short goes! Short! Like this!'],
  coachGive_easyCorner: ['Slow down for the corner! Slower!', 'Brake before the bend, not in it!', 'Whoa, ease off! We are going to go over!'],
  coachGive_keepGoing: ['Keep going! Do not stop! Gun it!', 'MORE THROTTLE! Through the mud!', 'Do not lift off! Never lift off in the mud!', 'Go, go, go! It is only mud!'],
};
