// A girl who likes you a lot asking you round the back of the barn, and later onto her favourite quad (romance.js): the
// invitation, you saying not now, the invitation going cold, what she says in the moment and just after, what her friend
// says about it, and what she says if you throw her off a quad once she is yours. Merged into the main line sets
// (voiceLines.js, jessLines.js), so they're recorded with the rest. Nothing is described beyond a fade to black.
// Nobody calls you anything but "you".

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_ROMANCE_LINES = {
  inviteBarn: line(60, ['Can I show you something? Round the back of the barn. It is nothing much. It is just quiet.', 'Come round the back of the barn with me for a minute. Please.', 'Walk with me? Round the back of the barn. I want to be on my own with you for a bit.']),
  inviteQuad: line(60, ['I am going to sit on the back of my quad. Come and stand by me. Just for a minute.', 'Meet me at my quad? I will be on the back. I have been thinking about it all day.', 'My quad, the back seat, you stood next to me. You know the one. Come on.']),
  inviteDeclined: line(30, ['Oh. No, that is fine. Another time.', 'Right. Yes. Silly idea. Forget I said.', 'Okay. I will pretend I did not ask.']),
  inviteLapsed: line(30, ['Never mind, then.', 'You are miles away, aren\'t you. It is fine.', 'I will ask another day, when you are listening.']),
  trystBarn: line(10, ['Hello, you.', 'This is nice. Just us.', 'Don\'t laugh. I have been wanting to do this for ages.']),
  trystQuad: line(10, ['There. Now stand just there.', 'Come here, you. Closer.', 'I picked this one on purpose, you know.']),
  afterBarn: line(10, ['Right. Well. That happened. Let\'s go back and be normal.', 'I am going bright red, aren\'t I. Do not look at me.', 'Thank you. For that. Now, quad.']),
  afterQuad: line(10, ['That is it settled, then. You are mine and I am not sharing.', 'I meant it. Whatever the others say, I meant it.', 'Well. Now you are stuck with me.']),
  teaseRomance: line(60, ['I saw where you two went. I am not saying anything. I am just saying I saw.', 'Jess went off with you for ages. That is fine. It is all fine.']),
  sulkLockedOut: line(90, ['I am happy for you. Really. I am just a bit quiet.', 'Do not mind me. I will just stand here, being supportive.']),
  betrayed: line(30, ['You threw me off. After everything. Do not talk to me.', 'I trusted you with my favourite quad and my everything else. Unbelievable.', 'No. I am not hurt. I am furious. There is a difference.']),
};

export const JESS_ROMANCE_LINES = {
  inviteBarn: [
    'Oi. Come round the back of the barn with me. No reason. Definitely no reason.',
    'You and me, round the back of the barn. Go on. Do not make me say it twice.',
    'Come on, I want to show you something. It is behind the barn. It is me, basically.',
  ],
  inviteQuad: [
    'I am sitting on my quad. Come and stand by me. You know what for.',
    'Get over here. I am on the back of my favourite and you are going to stand there looking handsome.',
    'My quad, the back seat, you next to me. Do not look so surprised.',
  ],
  inviteDeclined: ['Wow. Okay. Rejected. Fine.', 'Your loss, honestly.', 'Ha. Right. I will ask again just to annoy you.'],
  inviteLapsed: ['Fine, ignore me, see if I care.', 'Seriously? Too busy for me?', 'Too slow. Offer is off the table. For now.'],
  trystBarn: ['Do not say a word.', 'Shut up and come here.', 'About time, if you ask me.'],
  trystQuad: ['Right. Here. Stand right there.', 'Look at you. Come on, then.', 'Do not you dare take the mickey.'],
  afterBarn: ['That did not happen. It totally happened.', 'Do not tell Amy. Tell Amy. I do not care.', 'Right. Back to the quads. Act cool.'],
  afterQuad: ['There. Official. You are not allowed to run off with anyone else now.', 'I am keeping you, you know. Just so it is clear.', 'Well, that is you taken. Sorry, not sorry.'],
  teaseRomance: ['Where did you two vanish to? Do not tell me. I can guess.', 'Oh, so you do have time for Amy. Good to know.'],
  sulkLockedOut: ['Do not mind me. I am fine. I am absolutely fine.', 'Got my own quad. Do not need anybody. Nope.'],
  betrayed: ['You threw me off! Me! You absolute idiot.', 'I am not speaking to you. I mean it this time.', 'Right. That is it. All of it. Gone.'],
};
