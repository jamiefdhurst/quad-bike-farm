// What the girls say in a driving lesson (lessons.js). Amy is patient and sets the drills one at a time; Jess has one lesson, "faster", and
// no patience. Situations: lessonBegin (offering), lessonSet_<drill> (setting it), lessonNudge (saying it again), lessonGood_<drill> (a clean
// go), lessonBad_<why> (a go gone wrong), lessonPassed_<drill>, lessonDone (the last drill passed), lessonGiveUp, lessonBye (you got off).
// Merged into the main line sets (voiceLines.js, jessLines.js). The girls only ever call the player "you".

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_LESSON_LINES = {
  lessonBegin: line(30, ["Do you want a lesson? I will talk you through it.", 'Shall I teach you a few things? You are not bad, but you could be smoother.', "I could show you how to drive it properly, if you like."]),
  lessonSet_pullAway: line(20, ['First one. Pull away without touching the throttle. Let the clutch do the work.', 'Stop, first gear, and bring the clutch up slowly. Hardly any revs.']),
  lessonSet_hillClutch: line(20, ['Next, find a hill. Stop on it and pull away without rolling back.', 'Now a hill. Hold it on the clutch, then ease off. No rolling back.']),
  lessonSet_changeDown: line(20, ['Now the banks. Change down before you get to one, not halfway up it.', 'Find a bank, and drop a gear before you reach it. Not on it.']),
  lessonSet_smooth: line(20, ['Now your gear changes. Clutch in, change, and bring it up gently.', 'Smooth changes now. You should hardly feel them.']),
  lessonSet_stopping: line(20, ['Last one. Come to a stop without stalling it.', 'Now stop it from some speed. Clutch in before it chugs.']),
  lessonNudge: line(20, ['Whenever you are ready.', 'Go on, have a go.', 'I am still here. Have a go when you like.']),
  lessonGood_pullAway: line(10, ['That was lovely. Again.', 'Very good. Once more to be sure.']),
  lessonGood_hillClutch: line(10, ['Not a roll back. Again.', 'Nicely done. Do it once more.']),
  lessonGood_changeDown: line(10, ['That is the way. Once more.', 'You changed down in plenty of time. Again.']),
  lessonGood_smooth: line(10, ['I hardly felt that. Again.', 'Smooth. One more.']),
  lessonGood_stopping: line(10, ['Perfect stop. Once more.', 'Still running. Again, please.']),
  lessonBad_stalled: line(10, ['It stalled. More throttle, a little, or the clutch up slower.', 'It has stalled. Do not worry, start it and try again.']),
  lessonBad_revved: line(10, ['Too many revs. You do not need the throttle for that.', 'Gently. It is the clutch that moves it.']),
  lessonBad_slipped: line(10, ['You are slipping the clutch too long. It wears it out. Bring it up.', 'Do not sit on the bite. Up it comes.']),
  lessonBad_rolled: line(10, ['We rolled back. A touch more throttle before the clutch comes up.', 'It rolled. Hold it on the clutch and the throttle.']),
  lessonBad_noChange: line(10, ['You went up in the same gear. Change down before the bank.', 'You needed to drop a gear before that.']),
  lessonBad_late: line(10, ['That was a bit late. Change down before the bank.', 'You changed after it started. Sooner next time.']),
  lessonBad_lugged: line(10, ['It was labouring. Change down sooner.', 'It nearly stopped on the bank. Drop a gear earlier.']),
  lessonBad_jerky: line(10, ['That was a jerk. Keep your speed through the change.', 'We lost a lot of speed there. Quicker, and smoother.']),
  lessonBad_overrev: line(10, ['It revved up as you let the clutch out. Ease it.', 'Too many revs on that change.']),
  lessonPassed_pullAway: line(10, ['That is pulling away. You have got it.', 'Good. That one is done.']),
  lessonPassed_hillClutch: line(10, ['That is the hill done. Well done.', 'You have got that. No more rolling back.']),
  lessonPassed_changeDown: line(10, ['Banks done. That will save the engine.', 'Good. You have got the banks.']),
  lessonPassed_smooth: line(10, ['Your changes are smooth now.', 'That is smooth changes done.']),
  lessonPassed_stopping: line(10, ['That is stopping done.', 'You can stop it now without a stall.']),
  // Amy does not teach this one (Jess does), but every situation has to exist for both girls.
  lessonSet_faster: line(20, ['Now see how quickly you can get it up to speed.']),
  lessonGood_faster: line(10, ['That was quick. Again.']),
  lessonBad_slow: line(10, ['A little quicker than that.']),
  lessonPassed_faster: line(10, ['That is quick enough.']),
  lessonDone: line(30, ['That is the lot. You can drive it now. Properly.', 'I have nothing else to teach you. Well done.']),
  lessonGiveUp: line(30, ["Let's leave it there for now. We will try again another time.", 'That is enough for now. It takes time.', 'Never mind. We will do it another day.']),
  lessonBye: line(30, ['We will carry on another time.', 'That will do for now.']),
};

export const JESS_LESSON_LINES = {
  lessonBegin: ['Want to learn to go faster? Because you are slow.', 'I will show you how to go properly fast. Ready?', 'Right. Lesson. Faster. Go.'],
  lessonSet_faster: ['Get it up to speed! Flat out from a stop!', 'From standing, as fast as it will go! Now!', 'Go! Go on! Quicker than that!'],
  lessonNudge: ['Well? Go on then!', 'Are you waiting for Christmas? Go!', 'Now! Go!'],
  lessonGood_faster: ['That is more like it! Again!', 'Faster than that, but it will do. Again!'],
  lessonBad_slow: ['Slower than my gran! Faster!', 'Do not lift off! Keep your foot down!', 'No! Faster! Right to the floor!'],
  lessonPassed_faster: ['You are not as slow as you were!', 'Right, you can go fast now. Try not to crash.'],
  lessonDone: ['That is it. You are quicker. A bit.', 'Lesson over! You are almost as fast as me.'],
  lessonGiveUp: ['Oh, forget it. You are hopeless.', 'This is taking forever. Another time.', 'Fine. Be slow.'],
  lessonBye: ['Fine. I will teach you later.', 'We are not done, you know.'],
};
