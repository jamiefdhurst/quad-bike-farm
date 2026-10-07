// What the girls say about the little tipping trailer (trailerRide.js, the game's wheel). Riding in it is against the rules: Amy follows the
// rules (but goes in if you ask), Jess does not.
//   trailerBoard     hopping in while you're stopped
//   trailerAsked     you asked her in
//   trailerTell      the other one, who has seen her in there
//   trailerBump      it went over something hard
//   trailerShout     in there with it going
//   trailerTipOut    slid out of the back when the tub went up
//   trailerTipLaugh  the other one, who watched it
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_TRAILER_LINES = {
  trailerBoard: line(40, ['Oh, go on then. Just to the end of the yard.', 'I am not supposed to, but my feet are tired.', 'Room for one in the back? Right, mind how you go.']),
  trailerAsked: line(30, ['Since you ask. Drive carefully, though.', 'In the trailer? Fine, but only because it is you asking.', 'All right. Do not go over anything silly.']),
  trailerTell: line(40, ['Get out of the trailer! It is for tools, not people.', 'You will fall out and I will have to pick you up. Out, please.', 'That is not a seat, you know. It is a tub.']),
  trailerBump: line(15, ['Ow! Every stone, I swear!', 'Mind the ruts! I felt that in my teeth!', 'Oh! That was a big one!']),
  trailerShout: line(30, ['Slow down! Everything in here is rattling, me included!', 'This is not comfortable at all! Go gently!', 'I am being shaken to bits back here!']),
  trailerTipOut: line(30, ['You tipped it with me in it! Honestly!', 'I am on the ground. In the mud. Again.', 'That is exactly why it is not allowed.']),
  trailerTipLaugh: line(30, ['Oh dear. Are you all right? I did say.', 'I am not laughing. I am really not laughing.', 'Well, that was entirely predictable.']),
};

export const JESS_TRAILER_LINES = {
  trailerBoard: ['Taxi! Take me to the field, driver!', 'Ooh, a trailer. Shift over, I am getting in.', 'Nobody said I could not. Off we go!'],
  trailerAsked: ['Yes! Proper luxury! Drive, drive!', 'Right, hold on to your hat. Mine, I mean.', 'My own carriage. Go on, bounce me about.'],
  trailerTell: ['You are in the trailer. Ha! Is there room for two?', 'Look at you, being a parcel. I love it.', 'Amy is going to go spare. Do not move.'],
  trailerBump: ['Whoa! Do that again!', 'Aargh! My bum! Brilliant!', 'That was a pothole! Hit another one!'],
  trailerShout: ['Faster! Faster! It is like a roller coaster!', 'I can feel every single stone! Yes!', 'Everything is rattling! This is the best bit!'],
  trailerTipOut: ['You absolute muppet! I am sat in the dirt!', 'You tipped me out! That was on purpose!', 'Oi! I was comfortable! Now I am covered in mud!'],
  trailerTipLaugh: ['Ha ha ha! She went out like a sack of spuds!', 'Did you see her go? Do it again!', 'I am going to be laughing about that all day.'],
};
