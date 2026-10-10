// What the girls say when the seat they are on slams (vehicle/seatRide.js): seatPillion, seatRack, seatRear (the 200TDi's back bench on its
// leaf springs), seatBed and seatBedAir (the UTV's bed throwing her up). Merged into the main line sets (voiceLines.js, jessLines.js), so they're
// recorded with the rest. The girls call you "you", never he, she or they.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_SEAT_LINES = {
  seatPillion: line(45, ['Ouch. Mind the bumps.', 'That one went right up my back.', 'Gently over the rough bits, please.']),
  seatRack: line(45, ['Ow! That rack is hard.', 'I can feel every single bump up here.']),
  seatRear: line(45, ['These springs are terrible back here.', 'My teeth! Is there anything holding this bench up?', 'It comes down so hard on the springs.']),
  seatBed: line(45, ['Ow. There is no cushion at all in the bed.', 'Every bump goes straight through the floor.']),
  seatBedAir: line(45, ['I left the floor! I actually left the floor!', 'Hold on, I am flying in the back here.']),
};

export const JESS_SEAT_LINES = {
  seatPillion: ['Ow! My bum!', 'Do that again, I dare you.', 'Whoa, that was a big one.'],
  seatRack: ['Ow, ow, ow! The rack!', 'Bumpy! Brilliant!'],
  seatRear: ['Whoa, the springs back here! Brilliant!', 'My head hit the roof!', 'It is like a trampoline back here!'],
  seatBed: ['Ow! No cushion in the bed!', 'Bump! Every bump!'],
  seatBedAir: ['Wheee! I went right up!', 'I flew! Did you see me fly?'],
};
