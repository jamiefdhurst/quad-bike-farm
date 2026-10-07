// Showing off (showOff.js): deciding to, the moment she does it, and what she says if you saw it or didn't. Merged into the main line sets
// (voiceLines.js, jessLines.js), so they're recorded with the rest. The girls only call the player "you".

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_SHOWOFF_LINES = {
  selfShowOff: line(60, ['I am going to show you something. Do not laugh.', 'Right, watch. I have been practising.']),
  showOffGo: line(10, ['Look, look, look!', 'Are you watching?', 'Here we go.']),
  showOffSeen: line(20, ['Did you see that? I did that on purpose.', 'There. Not bad, is it?', 'Good. I wanted you to see that.']),
  showOffAgain: line(10, ['You were not even looking. Right. Again.', 'Hang on, you missed it. I will go again.', 'Oh, come on. Look this time.']),
  showOffMissed: line(30, ['Never mind. I am not doing it a fourth time.', 'Fine. Be like that. It was brilliant.']),
};

export const JESS_SHOWOFF_LINES = {
  selfShowOff: ['Watch me! Watch this!', 'Oi, you! Look at me!', 'I am going to show you something amazing.'],
  showOffGo: ['Looooook!', 'Here I come!', 'Wheeeee, watch watch watch!'],
  showOffSeen: ['Did you see?! Did you see that?!', 'Yes! You saw it! I am a legend!', 'Told you. Told you I could.'],
  showOffAgain: ['You did not see! Do not move, I am going again!', 'Were you looking at the sky?! Again!', 'Oh, you muppet. Again!'],
  showOffMissed: ['You never look! It was the best one yet!', 'I am telling everyone you missed it.'],
};

export const SHOWOFF_LINE_KEYS = ['selfShowOff', 'showOffGo', 'showOffSeen', 'showOffAgain', 'showOffMissed'];
