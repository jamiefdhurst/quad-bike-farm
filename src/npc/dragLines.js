// The drag race (drag.js): Jess's blip and the answer, agreeing when you ask, the count-down, a false start, the win, the excuses and a quad that
// dies. Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest. Amy only races you when you ask for it.

const line = (cooldown, lines) => ({ cooldown, lines });

export const DRAG_LINE_KEYS = ['dragBlip', 'dragAccepted', 'dragChicken', 'dragAsked', 'dragCount', 'dragWin', 'dragLose', 'dragFalseStart', 'dragOut'];

export const AMY_DRAG_LINES = {
  dragBlip: line(30, ['Do not look at me like that.']),
  dragAccepted: line(30, ['Fine. The straight, then. Do not cry when you lose.']),
  dragChicken: line(30, ['Oh, you are not going to. Sensible.']),
  dragAsked: line(30, ['A drag race? Go on then. Get on the line and I will beat you.', 'Down the straight, you and me. I am quite looking forward to this.']),
  dragCount: line(30, ['Ready? Three, two, one, go!']),
  dragWin: line(30, ['Gone. Straight past you. I did say.', 'I won! Down the straight, no hedges to blame.']),
  dragLose: line(30, ['Oh, you were fast. Well done.', 'I got a terrible start. That is the only reason.', 'Best of three? Please?']),
  dragFalseStart: line(30, ['False start! Back on the line, please.', 'You went early. Reverse back and line up again.']),
  dragOut: line(30, ['Oh no, it has died. That does not count!']),
};

export const JESS_DRAG_LINES = {
  dragBlip: ['Oi. Go on, rev it. Dare you.', 'Hear that? Your turn.'],
  dragAccepted: ['Ha! Right. The straight. Now.', 'Finally. Follow me.'],
  dragChicken: ['Chicken! Bawk bawk bawk!', 'You have gone all quiet. Chicken.', 'I knew it. You are scared.'],
  dragAsked: ['Drag race? Yes. Yes please. Get on the line.', 'You and me, down the straight. You are going to lose.'],
  dragCount: ['On your marks. Three, two, one, go!'],
  dragWin: ['Not even close! Eat my gravel!', 'Too easy. Do you want to go again?'],
  dragLose: ['Oh, shut up. My engine was cold.', 'You cheated. You had a head start.', 'Rematch. Right now.'],
  dragFalseStart: ['False start! You are rubbish at this!', 'Oi! Wait for the count!'],
  dragOut: ['It has stalled! That is not fair!', 'Typical. It has died on me.'],
};
