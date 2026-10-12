// What the girls say about oil: oilOver (Amy letting out too much), engineTicking (a four-stroke ticking from a low sump), oilTopUp and oilFine (Amy checking the dipstick before
// she rides; Jess never does), and for two-strokes: oilStraight (you're pouring straight petrol
// into a two-stroke), oilPremixFour (pre-mix into a four-stroke), engineHot (a two-stroke
// running hot), engineNipping (it's tightening up), engineSeized (it's locked solid) and
// oilSmoky (far too much oil). Amy reads the cause; Jess blames the quad. Merged into the
// main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_OIL_LINES = {
  oilStraight: line(40, ["That's the straight petrol can. The two-strokes need the pre-mix.", 'Hold on, that has no oil in it. It will seize.', 'Wrong can. A two-stroke needs oil in the petrol.']),
  oilPremixFour: line(40, ["That's the pre-mix can. It's only for the two-strokes.", "Oil in a four-stroke? It'll smoke like anything.", 'Wrong can again. This one takes plain petrol.']),
  engineHot: line(45, ['That is running awfully hot. Did it get any oil?', 'Look at the temperature. Something is wrong.', "It's cooking. Back off the throttle."]),
  engineNipping: line(30, ["It's tightening up. Stop, stop, stop!", 'That does not sound right. It is nipping up. Switch it off.', 'It is losing power. It has not got enough oil.']),
  engineSeized: line(30, ["It's seized. That's what happens with no oil in it.", 'Oh no. It has locked solid. It will need stripping down.', "That's the engine gone. It wanted oil."]),
  engineTicking: line(40, ['Listen to the ticking. That is short of oil.', 'It is ticking. Has anyone checked the dipstick?', 'That tapping is the top end running dry. Pull over and check the oil.']),
  oilTopUp: line(20, ["That's low on oil. There, I've topped it up.", 'The dipstick is barely wet. I will put some in before it does any damage.', 'Hardly any oil in this one. Topped up.']),
  oilOver: line(20, ['Too much oil in that. I have let some out.', 'The dipstick is over the top. There, drained back to the line.', 'Someone has overfilled it. It would only smoke and clog up.']),
  oilFine: line(60, ['Oil is fine.', 'Dipstick looks good.', 'Oil is up to the mark.']),
  oilSmoky: line(40, ["That's far too much oil. It is smoking like a bonfire.", 'Too much oil. The plug will be filthy.', 'Cough. That is a lot of smoke.']),
};

export const JESS_OIL_LINES = {
  oilStraight: ['Ha, that has no oil in it. Bang.', 'Straight petrol? Brave.', "That'll go pop. I'm just saying."],
  oilPremixFour: ['That one is for the smoky ones.', 'Ooh, free smoke machine.', 'Wrong can, you muppet.'],
  engineHot: ["It's boiling. It's fine, it's fine.", 'Hot. Very hot. Good.', "It's just warm. Ignore it."],
  engineNipping: ["It's sulking. It does that.", 'Why is it slowing down? Stupid thing.', 'Come on. Come on, you rubbish quad.'],
  engineSeized: ["It's just stopped. It's the quad's fault, not mine.", 'It was fine and then it died. Typical.', 'This quad is useless. It is not me, it is the quad.'],
  engineTicking: ["It's just ticking. They all tick.", 'That is the sound of it working hard.', 'Ticking is normal. Probably.'],
  oilSmoky: ['Bonfire! Brilliant.', 'It smells amazing. Like a bonfire in a chip shop.', 'Smoke, smoke, smoke.'],
};
