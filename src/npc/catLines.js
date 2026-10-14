// The barn cat (world/cat.js): what the girls say when it is asleep on a vehicle, shooed off, frightened, or rubs round one of them.
// Amy pretends she does not like it and gets caught fussing it; Jess does not pretend. Merged into the main line sets (voiceLines.js,
// jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_CAT_LINES = {
  catPerched: line(150, ['The cat is on the seat again. I am not moving it.', 'There is a cat asleep on that engine. Do not start it yet.']),
  catShooed: line(60, ['Shoo. Off you go, you have had your nap.', 'Go on, out of it. That is not your bed.']),
  catFled: line(90, ['You have frightened the cat. Well done.', 'Could you not rev right next to the cat? It has gone.']),
  catGreeted: line(150, ['Do not rub on me. I have just washed these.', 'I do not like cats. Stop looking at me like that.']),
  catFussed: line(240, ['Oh. Hello you. No, I am not stroking you. I am just stood here.', 'Fine. One scratch behind the ears. Do not tell anyone.']),
};

export const JESS_CAT_LINES = {
  catPerched: ['Aww, the cat is having a nap. Look at it.', 'Ooh, somebody has found the warmest spot. Clever puss.'],
  catShooed: ['Sorry, puss, you have to shift.', 'Off you hop. I will find you a better bed.'],
  catFled: ['You scared the cat! Poor puss.', 'Oh, you have frightened the cat. Go and say sorry.'],
  catGreeted: ['Hello, puss! Who is a lovely one then?', 'Aww, come here, you. Look at that face.'],
  catFussed: ['You are so soft. Do you want to come home with me?', 'Do not tell Amy, but this is the best bit of my day.'],
};
