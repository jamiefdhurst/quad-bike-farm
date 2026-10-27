// What Amy says when she dips the tank of a quad whose fuel gauge she knows is wrong, before she rides it (game.js amyDipsTank).
// tankDipLow: the stick is down in the reserve, tankDipLies: the gauge is well off but there is enough, tankDipFine: the gauge was right
// after all. Jess never dips a tank. Merged into the main line set (voiceLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_TANK_DIP_LINES = {
  tankDipLow: line(20, ['I dipped the tank. The gauge says plenty and there is hardly any in there. Fill it before we go.', 'That gauge is no use. The stick is nearly dry.', 'Do not believe the gauge. I dipped it and it is almost empty.']),
  tankDipLies: line(20, ['I dipped the tank. The gauge is wrong again, but there is enough for now.', 'Gauge says one thing, the stick says another. There is enough, though.', 'I checked it with the stick. Never mind the gauge.']),
  tankDipFine: line(20, ['I dipped the tank. The gauge is about right this time.', 'The stick agrees with the gauge. Fair enough.']),
};
