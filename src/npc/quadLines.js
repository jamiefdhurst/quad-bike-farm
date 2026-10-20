// What the girls say about particular quads: Jess naming them (quadNames.js), each girl claiming hers and objecting
// when someone else rides it (ownership.js), and placing a quad by ear (earing.js). Lines about a quad are written
// once for the colour and once for each possible nickname (see expandQuadLines), so they can be recorded; the game
// picks the one for this game's names. Merged into the main line sets (voiceLines.js, jessLines.js).

import { QUAD_PHRASES, NICKNAMES, expandQuadLines, quadKey } from './quadNames.js';

const line = (cooldown, lines) => ({ cooldown, lines });

// {q} is the quad as she calls it ("the green quad" or "Grandad"), {Q} the same with a capital.
const AMY_TEMPLATES = {
  claim: line(300, ['Just so you know, {q} is mine. I always ride it.', 'I like {q}. It is mine, really.']),
  earHard: line(60, ["That's Jess on {q}. She never lets it idle.", 'Listen to that. Jess is thrashing {q} again.']),
  earRough: line(60, ["That's Jess on {q}. It sounds poorly. That is not a healthy noise.", 'Jess is on {q}. Listen to the state of it.']),
  startSorry: line(30, ['Oh, {q}, I am so sorry. I flooded you.', 'Sorry, {q}. That was too much choke. My fault.', 'I am sorry, {q}. I did not mean to drown you.', 'Poor {q}. Sorry. Give it a minute.']),
  quadDry: line(90, ['That is {q} nearly out of petrol. Look at the tank before you ruin it.', 'You are running {q} on fumes. It is not a toy, you know.', 'Is {q} running dry? Do not just ride it until it stops.']),
  quadThrashed: line(90, ['Easy on {q}! It is not built to be flat out all day.', 'Stop thrashing {q}. It has feelings, you know.', 'Is that really good for {q}? Gently, please.']),
  quadProud: line(180, ['Oh, {q} looks lovely now. Thank you.', 'Look at {q}. All clean. I could almost cry.', '{Q} is so shiny. I am very pleased with it.']),
  earSteady: line(60, ["That's Jess on {q}. I can tell by the sound.", 'I can hear Jess on {q}. At least it sounds happy.']),
};

const JESS_TEMPLATES = {
  claim: line(300, ['{Q}? That one is mine. Hands off.', 'Just so you know, {q} is mine.']),
  earHard: line(60, ["That's Amy on {q}? Flat out? Wonders never cease.", 'Is that Amy on {q}? She is actually giving it some.']),
  earRough: line(60, ["That's Amy on {q}. Hear that? She is killing it with kindness.", 'Amy is on {q}. It sounds like it is begging for mercy.']),
  startPat: line(15, ['Come on, {q}. You can do it.', 'There, {q}. Be good for me.', 'Come on, {q}, do it for me.', 'Hello, {q}. Wake up.']),
  startCheer: line(15, ['Yes! Well done, {q}!', 'Clever {q}! Told you it would.', 'That is it, {q}! I knew you had it in you.', 'Ha! {Q} loves me.']),
  quadDry: line(90, ['Oi! {Q} is almost empty. Do not leave me pushing it.', 'You are going to run {q} dry, you know.', 'Put some petrol in {q} before it conks out, will you?']),
  quadThrashed: line(90, ['Oi, go easy on {q}! You will break it.', 'You are flogging {q}. Ease off.', 'Gently on {q}! It is not a rental.']),
  quadProud: line(180, ['Ooh, {q} is gleaming. Nice one.', 'Now {q} looks good. Proper clean.', '{Q} is spotless. I might not let anyone on it.']),
  earSteady: line(60, ["That's Amy on {q}. I can tell, she is going at walking pace.", 'Amy on {q}, listen. Nice and sensible. Boring.']),
};

// Jess naming one: written out for every quad and nickname, since each says both.
const NAMING = {};
for (const [id, phrase] of Object.entries(QUAD_PHRASES)) {
  for (const nick of NICKNAMES[id]) {
    NAMING[quadKey('nameQuad', id, nick)] = [`Right. ${phrase} is ${nick} from now on.`, `I am calling ${phrase} ${nick}. Do not argue.`];
  }
}

export const AMY_QUAD_LINES = {
  ...expandQuadLines(AMY_TEMPLATES),
  nameAmy: line(30, ['I am not calling it that.', 'Absolutely not. It has a colour.', 'It is a quad, Jess. It does not need a name.']),
  ownerUpset_you: line(60, ['Oi, that is my quad! You could have asked.', 'Hey, you are on my quad. Fine. Just this once.']),
  ownerUpset_jess: line(60, ['Jess! Get off my quad!', 'That is my quad, Jess! Give it back!', 'Jess, I said that one was mine!']),
};

export const JESS_QUAD_LINES = {
  ...expandQuadLines(JESS_TEMPLATES),
  ...Object.fromEntries(Object.entries(NAMING).map(([k, lines]) => [k, line(30, lines)])),
  nameCaved: line(60, ['You said it. You used its name!', 'Ha! Amy used the name! I heard you.']),
  ownerUpset_you: line(60, ['That is my quad you are on. You owe me.', 'Oi! My quad! Go on then, but be careful with it.']),
  ownerUpset_amy: line(60, ['Amy! That one is mine!', 'Oi, Amy, that is my quad. Hands off.']),
  borrow: line(60, ["Borrowing yours, Amy. Hope you don't mind.", "Amy's quad looks lonely. I'll take it.", "This one is Amy's, isn't it? Lovely."]),
  borrowTease: line(60, ['Relax, Amy. I am just keeping it warm for you.', 'What? It is only a quad.', 'You snooze, you lose.']),
};

// Things only Jess says (naming, pouncing, borrowing, and objecting when Amy is on hers): Amy has no version of them.
export const JESS_ONLY_QUAD_SITUATIONS = [...Object.keys(NAMING), 'nameCaved', ...Object.keys(JESS_QUAD_LINES).filter((k) => /^start(Pat|Cheer):/.test(k)), 'ownerUpset_amy', 'borrow', 'borrowTease'];
