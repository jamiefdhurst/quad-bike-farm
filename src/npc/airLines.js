// What the girls say when a diesel has run dry and has air in its fuel line (vehicle/bleeding.js): dieselAir, once there is fuel in the
// tank again and it still won't catch. Amy knows it wants bleeding at the lift pump; Jess blames the engine, or you. dieselBled is Amy
// when it has been done. Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_AIR_LINES = {
  dieselAir: line(90, ['That is air in the line. You let it run dry, so it needs bleeding at the lift pump before it will start. Open the toolbox and work the little priming lever.', 'It has sucked air in. Filling the tank is not enough on a diesel, you have to bleed it at the lift pump. Hold the priming lever till it runs through.', 'It is not flooded, it is airlocked. Bleed it at the lift pump and it will go.']),
  dieselBled: line(60, ['That is it bled. Give it the glow plugs and try it now.', 'There is fuel right through to the pump again. It should start now.']),
};

export const JESS_AIR_LINES = {
  dieselAir: ['It is just cranking! Why is it not going? There is plenty of fuel in it now!', 'You ran it out, did you not? Now it is sulking and nothing I say will help!', 'It is making all the noises and none of the going! Amy, do something!'],
};
