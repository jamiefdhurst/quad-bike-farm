// The buzz-seeking requests (requests.js: Grid, Bumpy, Mudguard kinds) and a girl choosing a rough quad to sit on (selfBuzz). Asking,
// thanking you, reminding you, and holding it against you after it lapsed, as for the other favours (requestLines.js). Amy never admits why she
// picks the rough one: selfBuzz is neutral for her. Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the
// rest. The girls call you "you", never he, she or they.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_BUZZ_LINES = {
  askGrid: line(60, ['Could you take me over the cattle grid again? I rather like it.', 'Would you take me across the cattle grid? Just once more.', 'Over the cattle grid again, please. On the back.']),
  askBumpy: line(60, ['Could we go the bumpy way for a bit? On the back, with you.', 'Would you take me the bumpy way? I like the rattle.', 'Can we go the rough way round? I do not mind bumps.']),
  askMudguard: line(60, ['Could you start the tractor? I would like to sit on the mudguard while it idles.', 'Can I sit on the tractor mudguard while it idles? If you start it.', 'Start the tractor and let it tick over, would you? I want to sit up there.']),
  thanksGrid: line(30, ['Lovely. All that rattling. Thank you.', 'Thank you. That was exactly what I wanted.']),
  thanksBumpy: line(30, ['That was bumpy. Lovely. Thank you.', 'Thank you for the rough way round.']),
  thanksMudguard: line(30, ['Oh, that is lovely. It is humming right up through me. Thank you.', 'Thank you for starting it. Do not mind me up here.']),
  remindGrid: line(30, ['The cattle grid? Whenever you are ready.', 'Do not forget the cattle grid.']),
  remindBumpy: line(30, ['The bumpy way? When you are riding.', 'Still waiting for the bumpy way round.']),
  remindMudguard: line(30, ['The tractor? Whenever you are ready.', 'Do not forget the tractor, would you?']),
  grudgeGrid: line(30, ['You never took me over the cattle grid. I did ask.', 'I asked for the cattle grid and you ignored me.']),
  grudgeBumpy: line(30, ['You never took me the bumpy way. I noticed.', 'I asked to go the rough way and you never did.']),
  grudgeMudguard: line(30, ['You never started the tractor for me. I asked nicely.', 'I did ask about the tractor mudguard. Never mind.']),
  selfBuzz: line(60, ['I think I will sit on this one for a bit.', 'This one looks comfortable.', 'I am just going to sit here.']),
};

export const JESS_BUZZ_LINES = {
  askGrid: ['Take me over the cattle grid again! Go on!', 'Cattle grid! Me on the back! Now!', 'Over the cattle grid again, go on, you know you want to.'],
  askBumpy: ['Go the bumpy way! The really bumpy way!', 'Take me somewhere properly rough. On the back.', 'Bumpy way, please. Not the boring smooth way.'],
  askMudguard: ['Start the tractor! I want to sit on the mudguard while it idles!', 'Can I sit on the tractor mudguard while it shakes? Start it!', 'Tractor. Start it. Mudguard. Me. Go.'],
  thanksGrid: ['Brilliant! My teeth are still rattling.', 'That was great. Again later.'],
  thanksBumpy: ['That was properly rough! Thanks!', 'Yes! Bumpy! Thanks.'],
  thanksMudguard: ['Free massage! Thanks!', 'Ahh, that is brilliant. Better than a massage chair.'],
  remindGrid: ['The cattle grid. You promised.', 'Cattle grid. Come on.'],
  remindBumpy: ['The bumpy way! Come on!', 'You said you would take me the rough way.'],
  remindMudguard: ['The tractor. Start it. Please.', 'Are you going to start the tractor or what?'],
  grudgeGrid: ['You never took me over the cattle grid. Boring.', 'I asked for the cattle grid. Typical.'],
  grudgeBumpy: ['You never went the bumpy way. Rubbish.', 'I asked for rough and you gave me smooth.'],
  grudgeMudguard: ['You never started the tractor. I am not over it.', 'No tractor for me, then. Fine.'],
  selfBuzz: ['This one shakes properly now. Mine.', 'Ooh, rattly. I am having this one.', 'I am sitting on the shaky one.'],
};
