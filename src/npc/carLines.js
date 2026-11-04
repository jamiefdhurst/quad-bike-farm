// What the girls say about their own cars (npc/carGo.js): carGoOff as she sets off to take hers out (or when you ask her to), carGoSetOff
// as she pulls away, carGoWatch from her friend watching, carGoDone back; carNotMine asked to drive the other's; carTaken when she sees you
// drive off in hers, carBack and carBackDamaged when you bring it back, carRidden when you take her along in it; and sat beside you in
// hers, carStalled, carTooFast (Amy) and carTooSlow (Jess). And your car (#229): carYours asked to drive it, liftThanks getting out of it after a
// lift of a morning, yourCarRide now and then while you drive her in it. And going home (#100, npc/goingHome.js): carHome as she heads for her
// car when you call it a day, liftHome as she goes to wait in yours, carJessFast (Amy) when Jess's car is heard going down the lane. Merged into the main line sets (voiceLines.js, jessLines.js).

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_CAR_LINES = {
  carGoOff: line(120, ['I am just taking the Finch down the road and back. Practice.', 'I need to practise. I will take the car out for a bit.', 'I am going to do some driving. Proper driving, in my car.']),
  carGoSetOff: line(60, ['Mirror, signal, manoeuvre.', 'Handbrake off. Gently does it.', 'Right. Clutch, first, and off we go.']),
  carGoWatch: line(120, ['She will have that exhaust off on the cattle grid one day.', 'You can hear her from the far end of the road.', 'She drives that car like she stole it.']),
  carGoDone: line(60, ['There. Back in one piece.', 'That was much better. I only stalled it once.', 'Parked, and straight, more or less.']),
  carNotMine: line(30, ["That is Jess's car. I am not driving that, she would never let me forget it.", "Not Jess's car. I would not even know where to start with it."]),
  carTaken: line(60, ['Is that my car? Where are you going in my car?', 'That is my Finch! At least put the L plates away.', 'You could have asked before you took my car.']),
  carBack: line(60, ['Thank you for bringing it back. Next time, ask.', 'Is it all right? You did not rev it, did you?', 'Back where it belongs. Please ask next time.']),
  carBackDamaged: line(60, ['What have you done to my car?', 'There is something wrong with it now. I can hear it. What happened?', 'You have got it stuck. My car. In the mud.']),
  carRidden: line(60, ['Gently, please. It is not a quad.', 'Mind the choke, it does not like being cold.', 'All right, but I am watching you.']),
  carStalled: line(40, ['Clutch, then gas. Gently.', 'You stalled it. It does that. Try again.', 'Bring the clutch up slower.']),
  carTooFast: line(30, ['Slow down! It does not like going this fast.', 'That is far too quick. Please.', 'It was not built for this. Neither was I.']),
  carYours: line(30, ['It is your car. You drive it.', 'I am not driving your car. I would only find a new dent for it.']),
  carHome: line(60, ['Right, I am off home. See you tomorrow.', 'That is me done for the day. Goodnight.', 'I will get my car and head off. An early start tomorrow.']),
  liftHome: line(60, ['I will wait for you in your car, then.', 'Home time. I will sit in the car.']),
  carJessFast: line(30, ['Listen to her. The whole lane will hear that.', 'There she goes. Flat out, down a lane with a tractor in it, probably.', 'She will have the neighbours out again. Honestly.']),
  liftThanks: line(60, ['Thanks for the lift.', 'Thank you for picking me up.', 'Thanks. Your heater could do with looking at.']),
  yourCarRide: line(240, ['There is a bottle rolling about under my feet.', 'It smells of diesel in here.', 'How many miles has this done now?', 'You really should get that dent seen to.', 'It is quite comfy, for an old diesel.']),
};

export const JESS_CAR_LINES = {
  carGoOff: ['I am taking the Griffin out. Listen to this.', 'Back in a bit. Going to give the car a run.', 'Time to wake the neighbours.'],
  carGoSetOff: ['Listen to that!', 'Here we go.', 'Hold on to your hats.'],
  carGoWatch: ['Look at her, ten to two on the wheel.', 'Amy drives like she is carrying eggs.', 'She will be back by teatime at that speed.'],
  carGoDone: ['Best car in the world, that.', 'Did you hear it on the straight? Did you?', 'Back. Nobody died.'],
  carNotMine: ["Amy's car? She would never speak to me again.", 'Not the Finch. I like being alive.'],
  carTaken: ['Oi! That is my car!', 'Where do you think you are going in my Griffin?', 'You had better give it some, at least.'],
  carBack: ['Did you give it some? Course you did.', 'Not bad. Still in one piece.', 'Told you it goes.'],
  carBackDamaged: ['You have broken my car. You are paying.', 'What have you done to it? It sounds worse than before, and that is saying something.', 'Stuck. You got my car stuck.'],
  carRidden: ['Go on then, let us see what you can do.', 'Put your foot down, it will not break. Probably.', 'Mind the exhaust on the bumps.'],
  carStalled: ['You stalled it. In my car.', 'More revs! It is not a tractor.', 'Ha! Go on, again.'],
  carTooSlow: ['My nan drives faster than this.', 'Are we parking or driving?', 'You can put your foot down, you know.'],
  carYours: ['Your car, your problem.', 'Me, drive that? It is a diesel. No thank you.'],
  carHome: ['Home time! See you tomorrow.', 'Right, I am off. Do not miss me too much.', 'Night! Watch this.'],
  liftHome: ['Home time! I am already in your car.', 'Taking me home, then? I will get in.'],
  liftThanks: ['Cheers for the lift.', 'Ta for the lift. Same time tomorrow?', 'Cheers. Your car smells of diesel, by the way.'],
  yourCarRide: ['Can we put some music on? Not those CDs.', 'This thing rattles like a tractor.', 'Who keeps CDs in a car any more?', 'Does it go any faster than this?', 'It is a nice enough car. For a pensioner.'],
};

/** Lines only Jess has: Amy would never tell you to go faster. */
export const JESS_ONLY_CAR_SITUATIONS = ['carTooSlow'];
