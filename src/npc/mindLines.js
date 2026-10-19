// What the girls say about what they're set on doing (intent.js): interrupted (you called her over, or rang the bell, on her way to
// something she'd chosen), resumed (getting back to it later), teaGo (off to put the kettle on), pairGo (going over to stand with her
// friend), tagGo (tagging along after her, pair.js), moodLow and moodHigh (she has tipped into a low or a high spell, mood.js) and
// moodCurt (short with you when you ask her something in a low one), and memoryWary and memoryKeen (she's about to do something that went
// badly, or well, the last time: memory.js), and plan_<a>_<b> (two things strung into a plan, plans.js). Merged into the main line sets
// (voiceLines.js, jessLines.js), so they're recorded with the rest.

import { planLineSet } from './plans.js';

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_MIND_LINES = {
  interrupted: line(30, ['Oh. I was just going to do that. Never mind.', 'Right. That can wait, then.', 'I was halfway there. Go on, then.']),
  resumed: line(60, ['Right. Where was I?', 'Now, what was I doing? Oh, yes.', 'Back to it, then.']),
  teaGo: line(90, ['I am going to put the kettle on.', 'Time for a cup of tea, I think.', 'I need a brew.']),
  pairGo: line(90, ['Jess, what are you up to?', 'Budge up, Jess.', 'Mind if I stand with you?']),
  tagGo: line(60, ['Wait for me, Jess.', 'Where are you off to? I will come too.', 'Hang on, I am coming with you.']),
  moodLow: line(240, ['I am not in the best of moods, if I am honest.', 'It has been one of those mornings.', 'I have had about enough of this.', 'I am cold and I am fed up.']),
  moodHigh: line(240, ['I am really enjoying this, you know.', 'What a lovely day. I mean it.', 'I feel quite cheerful, actually.', 'This is turning out rather well.']),
  moodCurt: line(20, ['Fine.', 'If I must.', 'Yes, all right.', 'Go on, then.']),
  memoryWary: line(120, ['I am going to be careful this time, after last time.', 'I would rather not repeat what happened before.', 'Steady, this time. I have not forgotten.', 'It went badly last time, so I shall take it gently.']),
  memoryKeen: line(120, ['That went rather well last time, so I will have another go.', 'I rather fancy doing that again.', 'I was quite good at that, you know.', 'Let me have another go. I think I have got it.']),
  ...planLineSet((first, then) => `${first}, and then ${then}.`, (lines) => line(120, lines)),
};

export const JESS_MIND_LINES = {
  interrupted: ['I was busy, you know.', 'Oi. I was doing something.', 'Fine. I will do it after.'],
  resumed: ['Right, as I was saying, before you stopped me.', 'Now I can get on.', 'Where was I? Oh, yeah.'],
  teaGo: ['Brew time.', 'I am making tea. Not for you.', 'Kettle is going on.'],
  pairGo: ['Amy! Talk to me, I am bored.', 'Oi, Amy. What are we doing?', 'Amy, stay there. I am coming over.'],
  tagGo: ['Wait up!', 'Where are you going? I am coming.', 'Do not leave me on my own.'],
  moodLow: ['I am so bored. And freezing.', 'This is rubbish. Everything is rubbish.', 'Do not talk to me, I am in a mood.', 'Nothing is happening and I hate it.'],
  moodHigh: ['This is brilliant!', 'I am in such a good mood right now.', 'Best day ever. Probably.', 'Honestly, I could do this all day.'],
  moodCurt: ['What.', 'Yeah, yeah.', 'Do I have to?', 'Ugh. Fine.'],
  memoryWary: ['Not doing that again. Well. Carefully.', 'Last time was a disaster, so I am taking it easy.', 'I remember how that went. Slowly, then.', 'Nope. Not after last time. Well, a bit.'],
  memoryKeen: ['I smashed that last time. Watch this.', 'Again! I was brilliant at that.', 'Right, I am doing that again.', 'Oh, I am so good at this one.'],
  ...planLineSet((first, then) => `${first}, then ${then}. Probably.`),
};
