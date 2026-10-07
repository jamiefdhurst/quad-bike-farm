// What the girls say about the quads they like and don't (contentment.js, sideSaddle.js): stallSad and stallRelief (a quad
// stalling, and going again), likeAllRunning and wishAllRunning (they'd like them all going), buzzLove (the seat shaking them),
// and sideSaddleOn, sideSaddleWobble and sideSaddleSlip (sitting side-saddle on the back, and sliding off). Amy is gentle and
// a little embarrassed; Jess is dramatic and not embarrassed at all. Merged into the main line sets (voiceLines.js,
// jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_CONTENT_LINES = {
  stallSad: line(25, ['Oh no, it has stopped. Poor thing.', 'Aw, it has stalled. It was doing so well.', 'It has gone quiet. I do not like it when they stop.']),
  stallRelief: line(40, ['There, it is going again. That is better.', 'Oh good, it is back. I hate it when one is off.']),
  likeAllRunning: line(120, ['Listen to them all going. That is the best sound.', 'I like it when every one of them is running.', 'All of them running at once. Lovely.']),
  wishAllRunning: line(120, ['Shall we get the others going? It sounds wrong with only some of them on.', 'I wish they were all running.', 'It is a bit sad when some of them are just sitting there off.']),
  buzzLove: line(180, ['I do like the seat shaking like this. Do not tell anyone.', 'It is quite nice, the buzz. I am a bit embarrassed.', 'This one has a lovely hum through the seat.']),
  sideSaddleOn: line(90, ['I will sit side-saddle, if that is all right. Hold on to me.', 'Sideways, like a lady. Go gently.']),
  sideSaddleWobble: line(20, ['Careful! I am slipping!', 'Slow down, I am sliding off!', 'Whoa, steady, I cannot hold on like this.']),
  sideSaddleSlip: line(30, ['Ow! I told you to go gently!', 'Oh! I have fallen off. Come back!']),
};

export const JESS_CONTENT_LINES = {
  stallSad: ['Nooo, it died! Somebody tell it it is not allowed.', 'Oh come on. It has stopped. This is a tragedy.', 'Poor little engine. Gone quiet. I could cry.'],
  stallRelief: ['Yes! It is alive! I knew you had it in you!', 'It is back! Never doubted it. Well, a bit.'],
  likeAllRunning: ['Listen to that! They are all going. Brilliant.', 'I love it when they are all on at once. Like a choir.', 'Every single one is running. Best day.'],
  wishAllRunning: ['Why is that one off? Start it! They should all be going.', 'I want them all running. Somebody start them.', 'It is too quiet. More engines!'],
  buzzLove: ['Mmm, the seat is buzzing. I could sit here all day.', 'Ooh, feel that shake. This is the best seat in the farm.', 'It tickles. I love it.'],
  sideSaddleOn: ['Side-saddle! Like a princess. Do not go fast.', 'Look at me, sat sideways. Very posh.'],
  sideSaddleWobble: ['Whoa! Whoa! I am going!', 'I am sliding! Slow down!', 'Aaah, I am falling off, I am falling off!'],
  sideSaddleSlip: ['Oof! I fell off! Why did you go over that?', 'Ow, my bum! Come back!'],
};
