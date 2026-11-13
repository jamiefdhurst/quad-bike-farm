// What the girls say about having a go at the UTV or the Tor or Crag (the same go as the tractor's, tractorGoLines.js): taking it
// (utvGoAsk, torGoAsk), setting off (utvGoSetOff, torGoSetOff), finishing (utvGoDone, torGoDone) and the other one's view of it
// (utvGoWatch, torGoWatch); Amy refusing (utvRefuse, torRefuse) before her day. The Tor's or Crag's own: the starting handle on a flat
// battery (torGoSwing as she goes to it, torGoKick when Jess's thumb gets caught and torGoKickWatch from the other one,
// torGoNoLuck if it will not go), and Jess grinding first or second (torGoCrunch, torGoCrunchWatch). The 200TDi has its own
// (cragRefuse, cragGoAsk, cragGoSetOff, cragGoDone, cragGoWatch, cragBong): a diesel with a synchro five-speed and a
// belt bong, so none of the Tor's starting handle or crunching. Merged into the main line
// sets (voiceLines.js, jessLines.js), so they're recorded with the rest. Nobody calls you anything but "you".

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_VEHICLEGO_LINES = {
  utvRefuse: line(30, ['No. It is a farm vehicle, not a toy. Ask Jess, she will love it.', 'Absolutely not. I would have to reverse it, and I do not trust the lever.']),
  torRefuse: line(30, ['I am not driving that. It has a starting handle.', 'No. It has no power steering and I will not be made to try.']),
  utvGoAsk: line(60, ['Fine. Though it is only a very large golf buggy.', 'All right. Mind the bed, nothing is in it.', 'If I must. Which one is reverse?']),
  utvGoSetOff: line(40, ['There. Smooth as anything.', 'Oh, it does it all itself. That is much more sensible.', 'Seat belt on. Not that there is one.']),
  utvGoDone: line(60, ['That was perfectly civilised.', 'Fine, that was quite nice. Do not tell Jess.', 'Parked, and not a scratch on it.']),
  utvGoWatch: line(60, ['Slowly, Jess! It is not a quad!', 'Please do not tip the bed.', 'Mind the gatepost!']),
  torGoAsk: line(60, ['Fine. Hand me the keys. Both feet on the pedals, correctly.', 'All right. I have read the manual. It is a Series. It is simple.', 'If I must. Stand back from the front.']),
  torGoSetOff: line(40, ['There. Double declutch and away.', 'Second, then third. It is very charming, really.', 'It steers like a bus, but it goes.']),
  torGoDone: line(60, ['Rather good, actually. Do not say anything.', 'That was lovely. I want one.', 'There. Not a single crunch.']),
  torGoWatch: line(60, ['Jess! Clutch right down, all the way!', 'Mind the gearbox, it is older than both of us put together.', 'I cannot watch. Tell me when it is over.']),
  torGoSwing: line(40, ['Thumb alongside the fingers. I have read about this.', 'The battery is flat. Stand back, I am doing the handle.', 'Right. A proper swing, and let go. Not round the handle.']),
  torGoKickWatch: line(20, ['That is what thumbs round the handle get you!', 'Jess! I told you. Alongside the fingers!', 'Oh, your hand. Is it broken?']),
  torGoNoLuck: line(40, ['It is quite dead. Someone fetch a jump lead.', 'Nothing. The battery is flat and the handle is not helping.']),
  torGoKick: line(20, ['Ow! That is exactly why the thumb goes alongside.', 'Ouch. I did say. Mostly to myself.']),
  torGoCrunch: line(20, ['Sorry, sorry. Poor old gearbox.', 'That was the gearbox, not me.']),
  torGoCrunchWatch: line(20, ['That noise! Clutch all the way down, Jess!', 'Poor gearbox. It never did anything to you.', 'It has no synchromesh. Slow down for it.']),
  cragRefuse: line(30, ['No. It is a big diesel and it bongs at me. I am not having that.', 'I am not driving that. It is too tall and I cannot see the corners.']),
  cragGoAsk: line(60, ['Fine. Keys. Belt on first, or it will bong at me all the way.', 'All right. It is a diesel, so I shall let it settle before I pull away.', 'If I must. Five gears, and I will use every one of them.']),
  cragGoSetOff: line(40, ['There. Synchromesh. No double declutching, thank goodness.', 'It rattles, but it pulls like anything.', 'Belt on, bong off. Lovely.']),
  cragGoDone: line(60, ['That was rather nice. It is very tall, though.', 'Parked, and no bong. Do not say a word.', 'It pulls well for something that rattles that much.']),
  cragGoWatch: line(60, ['Jess, belt! It will bong at you!', 'Mind the height, Jess. It is a lot wider than it feels.', 'Fifth gear is for the road, Jess, not the field.']),
  cragBong: line(45, ['That is the belt bong. Belt on, please.', 'You are not wearing your belt. It is bonging at you.', 'Belt. The bong will not stop until you do it.']),
};

export const JESS_VEHICLEGO_LINES = {
  utvGoAsk: ['Right, I am having the Yak.', 'Nobody is using the Yak. Mine now.', 'Move aside, I am driving the Yak.'],
  utvGoSetOff: ['It has a bed! I can carry things! I have nothing to carry!', 'No gears, no clutch, I am a natural.', 'Hold on, here I go.'],
  utvGoDone: ['Best thing ever. Again!', 'I am a Yak driver now. Call me that.', 'I only clipped the one thing. Maybe two.'],
  utvGoWatch: ['Show off.', "Beginner's luck, that is all it is.", 'Oh, come on! She is good at it? Since when?'],
  torGoAsk: ['Right, I am having the Tor.', 'Nobody is using the Tor. Mine now.', 'Move aside, I am driving the old one.'],
  torGoSetOff: ['Where is the first gear? Is that first gear?', 'It is so slow to turn. Why is it so slow to turn?', 'This is brilliant, and I cannot feel the steering at all.'],
  torGoDone: ['That was the best thing ever. Again!', 'I am a Tor driver now. Call me that.', 'I only ground it a bit.'],
  torGoWatch: ['Show off.', "Beginner's luck, that is all it is.", 'Oh, come on! She is good at it? Since when?'],
  torGoSwing: ['I know how to do the handle. Thumb round it, obviously.', 'Easy. I swing it hard and it goes.', 'Flat battery? Pah. Handle time.'],
  torGoKick: ['Ow! It bit me! It actually bit me!', 'My thumb! My thumb is broken! It is not broken. It really hurts.', 'Right. Thumb alongside. I knew that.'],
  torGoNoLuck: ['It is dead. I did try. It is dead.', 'Nothing. Not even a cough.'],
  torGoCrunch: ['That was not me, that was the gearbox.', 'It is crunching! Is it meant to crunch?', 'Sorry, sorry, sorry. Gearbox!'],
  cragGoAsk: ['Right, I am having the Crag.', 'Nobody is using the Crag. Mine now.', 'Move aside, I am driving the diesel.'],
  cragGoSetOff: ['It sounds like a tractor and I love it.', 'Five gears! I am going to use all of them.', 'No crunching! I have no excuse this time.'],
  cragGoDone: ['That was brilliant. It never even crunched.', 'I am a Crag driver now. Call me that.', 'I put the belt on, so the bong left me alone. Mostly.'],
  cragGoWatch: ['Show off.', 'Oh, come on! She is good at it? Since when?', 'It is a lorry. You are driving a lorry.'],
  cragBong: ['Bong, bong, bong. I get it, I get it.', 'It is only a noise. Ignore the noise.', 'Ha, it is nagging you. Belt up.'],
};
