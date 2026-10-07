// What the girls say when they smell petrol by a parked quad with a dripping carb (vehicle/carbDrip.js): dripSmell. Amy
// minds the waste; Jess blames the tap, and Amy. Merged into the main line sets (voiceLines.js, jessLines.js).

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_DRIP_LINES = {
  dripSmell: line(60, ['I can smell petrol. Is this one dripping? Look, there is a patch under it.', 'There is petrol coming out of the carb. Someone left the tap on.', 'It is leaking petrol again. Turn the tap off when you park, please.']),
};

export const JESS_DRIP_LINES = {
  dripSmell: ['Ooh, it stinks of petrol over here. It is dripping everywhere.', 'This one is peeing petrol. It will be flooded when we start it, you watch.', 'Somebody left the tap on. Not me. Probably Amy.'],
};
