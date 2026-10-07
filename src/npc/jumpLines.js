// The jump (jumps.js): deciding to, the run-up, being in the air, what the jumper says about her own landing (jumpLand_*) and what the
// other girl thought of it (jumpRate_*), and having her own turn. Merged into the main line sets (voiceLines.js, jessLines.js), so they're
// recorded with the rest. The girls only call the player "you".

const line = (cooldown, lines) => ({ cooldown, lines });
const RATINGS = ['great', 'good', 'rough', 'bail', 'tame'];

export const AMY_JUMP_LINES = {
  selfJumps: line(60, ['I am going to have a go at the ramp. Once.', 'Right. The jump. Jess has been going on about it.']),
  jumpRun: line(20, ['Okay, okay, okay.', 'Do not look at me.', 'Straight, Amy. Stay straight.']),
  jumpAir: line(10, ['Oh no oh no oh no!', 'This is a terrible idea!', 'Whoaaa!']),
  jumpLand_great: line(10, ['Did you see that?! I flew!', 'Oh my goodness. I did that.']),
  jumpLand_good: line(10, ['Right. That was fine. That was completely fine.', 'Still alive. Good.']),
  jumpLand_rough: line(10, ['Ow. My teeth.', 'That was a lot harder than it looked.']),
  jumpLand_bail: line(10, ['I am fine! The quad is fine! Probably!', 'Nobody saw that.']),
  jumpLand_tame: line(10, ['I did not really leave the ground, did I.', 'Hm. Barely a hop. I will go faster.']),
  jumpRate_great: line(8, ['Oh, that was really good, Jess. Annoyingly good.', 'Ten out of ten. Do not let it go to your head.']),
  jumpRate_good: line(8, ['Not bad, Jess. Seven out of ten.', 'That was decent. Land it flatter next time.']),
  jumpRate_rough: line(8, ['That landing was terrifying to watch.', 'Four out of ten, and I am being kind.']),
  jumpRate_bail: line(8, ['Jess! Are you all right?', 'Oh, you went over. Do not move. Are you hurt?']),
  jumpRate_tame: line(8, ['Is that all? You did not even leave the ground.', 'That was a speed bump, not a jump.']),
  jumpTurn: line(60, ['Right, my go. Move out of the way.', 'Fine. I will show you how it is done.']),
};

export const JESS_JUMP_LINES = {
  selfJumps: ['Ramp time!', 'I am going to get so much air!', 'Watch this, you two!'],
  jumpRun: ['Here we go!', 'Faster, faster, faster!', 'Hold on to your hats!'],
  jumpAir: ['Wheeeeeee!', 'I am flying!', 'Wooooo!'],
  jumpLand_great: ['Yes! Did you see that?!', 'I am a stuntwoman!', 'Best one ever!'],
  jumpLand_good: ['Again! Again!', 'Oh, that was good!'],
  jumpLand_rough: ['Ow, my bum!', 'That hurt! Do it again!'],
  jumpLand_bail: ['Ow! I am okay! I am okay!', 'The ground came up really fast.'],
  jumpLand_tame: ['That was rubbish! I am going faster!', 'Nothing! I did nothing! Again!'],
  jumpRate_great: ['Amy! That was amazing! Do it again!', 'Ten out of ten! Who are you?!'],
  jumpRate_good: ['Pretty good, Amy! I would have gone higher.', 'Nice one, Amy! Seven!'],
  jumpRate_rough: ['Ooh, that looked like it hurt.', 'Amy, your face!'],
  jumpRate_bail: ['Amy! Oh my gosh! Are you alive?!', 'That was the best crash I have ever seen. Are you okay?'],
  jumpRate_tame: ['Amy, you have to go faster than that.', 'Is that it? Seriously?'],
  jumpTurn: ['My go! My go!', 'Move over, Amy, watch me.'],
};

export const JUMP_LINE_KEYS = ['selfJumps', 'jumpRun', 'jumpAir', 'jumpTurn', ...RATINGS.flatMap((r) => [`jumpLand_${r}`, `jumpRate_${r}`])];
