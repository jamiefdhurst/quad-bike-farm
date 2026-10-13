// Helmets and goggles (headgear.js): helmetOn (taking hers down from the hooks), helmetNag (Amy, at you riding with a bare head),
// helmetPraise (Amy, when you've put yours on), helmetFell (hers shaken off the seat of a quad that drove away) and gogglesOn (at you
// putting your goggles on). Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_HEADGEAR_LINES = {
  helmetOn: line(60, ['Helmet first. It is not optional.', 'I will just get my helmet.', 'There is a reason these hang by the door.']),
  helmetNag: line(120, ['Where is your helmet? Honestly.', 'You are not riding that without a helmet. Go and get it.', 'Helmet. On the hook. Now, please.', 'I am not going to mention the helmet again. I am mentioning it now.']),
  helmetPraise: line(120, ['That is better. Thank you.', 'There. Was that so hard?', 'A helmet. I am almost proud of you.']),
  helmetFell: line(60, ['My helmet has fallen off the seat. I did say.', 'That is my helmet in the grass. Wait.', 'Oh, my helmet. It was on the seat, and now it is not.']),
  gogglesOn: line(120, ['Goggles. Sensible.', 'Those will keep the mud off you.', 'Very practical. Well done.']),
};

export const JESS_HEADGEAR_LINES = {
  helmetOn: ['Fine. Helmet. It is flattening my hair.', 'Yes, yes, I am wearing it. Sort of.', 'Helmet on. Ish.'],
  helmetFell: ['Ha, my helmet just flew off the quad.', 'Whoops. My hat has gone.', 'Oh well. It likes the grass better.'],
  gogglesOn: ['Goggles! You look like a pilot.', 'Nice goggles. Very Biggles.', 'I want a pair. Mud everywhere, I bet.'],
};
