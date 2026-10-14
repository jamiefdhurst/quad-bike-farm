// What the girls say when a diesel's fuel waxes up in a hard frost (vehicle/dieselWax.js): dieselWaxed. Amy knows what it is and what
// clears it (warmth, or anti-gel from the shelf); Jess thinks the engine has given up. Merged into the main line sets (voiceLines.js,
// jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_WAX_LINES = {
  dieselWaxed: line(90, ['That is the diesel waxing. It is too cold and the fuel has gone thick in the filter. Anti-gel from the shelf will sort it, or keep it in the barn.', 'It is a hard frost and the diesel has started to wax. It will not run properly till it is warm, or you have put anti-gel in.', 'The fuel is gelling. Diesel does that in a hard frost when it has been left out. The anti-gel is by the coolant.']),
};

export const JESS_WAX_LINES = {
  dieselWaxed: ['It is giving up! It has gone all coughy and now it is dead! Is it poorly?', 'It will not go! It was fine, and now it is just sulking at us because it is cold!', 'Something is wrong with the fuel! It has gone thick like porridge, or I think it has!'],
};
