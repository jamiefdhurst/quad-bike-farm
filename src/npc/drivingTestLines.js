// What the girls say as Amy goes for her driving test (drivingTest.js, #85). Amy: testPractice (after a practice in the Finch with you
// beside her), testBooked, testNervous (the evening before), testLeaves (setting off for it), testPassed, testFailed. Jess has her say at each:
// jessTestPractice, jessTestBooked, jessTestNervous, jessTestLeaves, jessTestPassed, jessTestFailed. Merged into the main line sets
// (voiceLines.js, jessLines.js), so they're recorded with the rest. Nobody calls you anything but "you".

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_DRIVING_TEST_LINES = {
  testPractice: line(60, ['That was better. I only stalled it twice.', 'Thank you for coming with me. It helps, having someone in the seat.', 'Mirrors, signal, manoeuvre. I am getting there.', 'I did not stall it once that time. Did you see?']),
  testBooked: line(60, ['I have booked it. My driving test. It is in the village, and it is real now.', 'That is it, I am ready. I have booked the test.', 'Right. Test booked. Please do not let me think about it.']),
  testNervous: line(60, ['I cannot stop going over it. Mirror, signal, mirror, signal.', 'I am so nervous about tomorrow. I will not sleep.', 'Tomorrow is my test. Say something to calm me down. Anything.']),
  testLeaves: line(60, ['Right. Wish me luck. I am going to need it.', 'Today is the day. See you later, I hope.', 'I am off to my test. Do not let Jess near my car.']),
  testPassed: line(60, ['I passed! I actually passed! Take the plates off, they are done.', 'I have my licence. A proper one. I am never going to stop saying it.', 'I passed. I passed! The L plates are coming off the Finch, right now.']),
  testFailed: line(60, ['I failed. I stalled it at the lights, and that was that.', 'I did not pass. Two minor faults too many. I am going to be sick.', 'They said I was too cautious. Too cautious! I will book it again.']),
};

export const JESS_DRIVING_TEST_LINES = {
  jessTestPractice: ['Look at her, ten to two on the wheel.', 'Amy has stalled it again. You can hear it from here.', 'At that speed she will be home for tea next week.'],
  jessTestBooked: ['Amy is going for her test. I give it a fortnight before she cancels.', 'A test! Amy, you will be brilliant. Or you will stall it. One of the two.', 'I passed first time, you know. Just saying.'],
  jessTestNervous: ['Amy, you will be fine. You drive that car like it is made of glass, and the examiner will love it.', 'Stop pacing. You are making me nervous, and I am not even taking it.', 'Early night, Amy. Put the kettle on and stop thinking about it.'],
  jessTestLeaves: ['Good luck, Amy. Do not hit anything. Anything.', 'Off she goes. Mirrors, Amy!', 'Do not stall it! Or do, and we will have a story.'],
  jessTestPassed: ['She passed! Amy passed! I told you, did I not? I always said.', 'Finally! That took long enough. I passed first time, you know.', 'Well done, Amy. I am not crying. It is the diesel.'],
  jessTestFailed: ['Never mind, Amy. Loads of people fail first time. Not me, but loads of people.', 'Oh, Amy. Next time. You were robbed.', 'You were too careful, that is all. Honestly, it is a compliment.'],
};

/** Lines only Jess has: her side of Amy's test. */
export const JESS_ONLY_DRIVING_TEST_SITUATIONS = Object.keys(JESS_DRIVING_TEST_LINES);
