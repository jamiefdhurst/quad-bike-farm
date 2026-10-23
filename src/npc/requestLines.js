// What the girls say about favours: asking (ask<Kind>), thanking you when it's
// done (thanks<Kind>), reminding you when you talk to her with it still open
// (remind<Kind>), and holding it against you after it lapsed (grudge<Kind>, said
// the next time you talk to her). Kinds are Wash, Bales, Can and Pub. gloatFavour is
// the favoured one crowing when her friend is listening. Merged into the main
// line sets (voiceLines.js, jessLines.js) so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_REQUEST_LINES = {
  askWash: line(60, ["Could you give my quad a wash? It's absolutely filthy.", 'Would you hose my quad down for me? Please?', "My quad's caked. Any chance you could wash it?"]),
  askBales: line(60, ['Could you take me over to the straw bales? I fancy sitting there.', 'Give me a lift to the straw bales? Just for a bit.', 'Will you run me over to the bales? I want a sit down.']),
  askCan: line(60, ["Could you fetch the jerry can for me? I'd get it, but my hands are full.", 'Would you bring me the jerry can? Please?', "I need the jerry can. Could you grab it?"]),
  thanksWash: line(30, ['Oh, look at that, it shines. Thank you!', "You washed it! You're lovely.", 'Spotless. Thank you, that was kind.']),
  thanksBales: line(30, ['Lovely. Thanks for the lift.', 'Ah, this is nice. Thank you for bringing me.', "That's just what I wanted. Thanks."]),
  thanksCan: line(30, ['You got it! Thank you.', 'Perfect. You remembered.', "Ooh, thanks. You're a star."]),
  remindWash: line(30, ["You haven't done my quad yet, you know.", "It's still filthy. Just saying.", 'My quad. The washing. Remember?']),
  remindBales: line(30, ["Don't forget the bales.", 'Still waiting on that lift to the bales.', 'Bales. When you are ready.']),
  remindCan: line(30, ["The jerry can? You haven't forgotten?", "Still no jerry can. I'm patient. Mostly.", 'Any luck with the jerry can?']),
  grudgeWash: line(30, ["You never washed my quad. I'm not sulking. Much.", "My quad's still dirty, you know. I asked.", 'I did ask about the washing. Just saying.']),
  grudgeBales: line(30, ["You never took me to the bales. I haven't forgotten.", 'I asked for a lift to the bales and you ignored me.', "Funny how you couldn't find the time for the bales."]),
  grudgeCan: line(30, ["You never brought me the jerry can. I noticed.", 'I asked for the jerry can ages ago. Never mind.', "I'll remember you left me without the can."]),
  gloatFavour: line(60, ["See? You do what I ask. That's because I'm your favourite.", 'Told you, Jess. I get the favours.', 'Oh, I do love being asked first.']),
};

export const JESS_REQUEST_LINES = {
  askWash: ['Oi, wash my quad. It looks like a pig did it.', "My quad needs a wash. You've got a hose. Do the thing.", 'Hose my quad down? Go on.'],
  askBales: ["Take me to the bales. I'm bored of standing here.", 'Give me a ride to the bales, go on.', 'Bales. Me. Now. Please?'],
  askCan: ["Go and fetch the jerry can. I'm not walking.", 'Can you grab the jerry can? Cheers.', 'Bring me the jerry can. Chop chop.'],
  thanksWash: ['Ha, shiny. Nice work.', "That'll do. Thanks.", 'You did it! Look at that colour.'],
  thanksBales: ['Nice. I can sit here all day.', "Right on, that's the spot. Cheers.", "Ahh. Perfect. You're not so bad."],
  thanksCan: ['About time. Thanks.', 'Cheers. I was going to ask again.', "You're all right, you are."],
  remindWash: ["I'm still looking at a filthy quad.", 'Wash. My quad. Any day now.', "That quad isn't going to wash itself."],
  remindBales: ['Bales. Remember?', "I'm still waiting for that lift.", 'Are we going to the bales, or what?'],
  remindCan: ["Jerry can. It's not going to walk over.", 'Still waiting on that can.', 'Did you forget about the can?'],
  grudgeWash: ['Never washed my quad, did you? Fine.', "I asked for a wash and you didn't even look.", "My quad's still dirty. Thanks for that."],
  grudgeBales: ["You didn't take me to the bales. Rude.", 'The bales. Remember those? I asked.', "I'll remember you said no to the bales."],
  grudgeCan: ["Didn't fetch the can, did you? Typical.", 'I asked for one thing. One.', 'No jerry can. Great.'],
  gloatFavour: ['Ha! I get what I ask for. Wonder why.', 'Jealous, Amy? You should be.', "You do things for me. I'm just saying."],
};

// The village pub (#43). Kept apart, and merged at the end of each girl's lines, so adding them leaves the recorded banks before them as they were.
export const AMY_PUB_LINES = {
  askPub: line(60, ["Could you run me down to the pub? The Plough and Harrow. I'd love to sit in the car park for a bit.", 'Will you take me to the pub in the village? Just to pull up outside.', "Fancy a run down to the Plough and Harrow? On the back, with you."]),
  thanksPub: line(30, ['Lovely. Look at that sign. I do like this pub.', 'Ah, thank you. The Plough and Harrow. Perfect.', "That's just what I wanted. Thanks for the ride."]),
  remindPub: line(30, ["Don't forget the pub.", 'Still waiting on that run to the Plough and Harrow.', 'The pub. When you are ready.']),
  grudgePub: line(30, ["You never took me to the pub. I haven't forgotten.", 'I asked for a run down to the pub and you ignored me.', "Funny how you couldn't find the time for the pub."]),
};

export const JESS_PUB_LINES = {
  askPub: ["Take me to the pub. The Plough and Harrow. I'm parched.", 'Run me down to the village pub, go on.', 'Pub. Me. On the back. Now. Please?'],
  thanksPub: ['Nice. I could sit here all afternoon.', "Right on, the Plough and Harrow. Cheers.", "Ahh. Perfect. You're not so bad."],
  remindPub: ['Pub. Remember?', "I'm still waiting for that run to the pub.", 'Are we going to the pub, or what?'],
  grudgePub: ["You didn't take me to the pub. Rude.", 'The pub. Remember that? I asked.', "I'll remember you said no to the pub."],
};
