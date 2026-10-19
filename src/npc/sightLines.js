// What the girls say taking you to see something (sights.js): setting off (sightGo), and pulling up at the gate left open (sightGate)
// or the view up the hill (sightView). A quad left running uses the leftRunning lines. Merged into the main line sets (voiceLines.js,
// jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_SIGHT_LINES = {
  sightGo: line(20, ['I want to show you something. Hold on.', 'There is something I think you should see. Stay on.', 'Come with me, I will show you.']),
  sightGate: line(20, ['Look. Somebody has left that gate open.', 'That gate is open. It should not be. Anything could get out.', 'There. The gate is wide open. I did not do it.']),
  sightView: line(20, ['Look at that. You can see all the way up the hill from here.', 'Isn\'t it lovely from here? I come here when I want a bit of quiet.', 'There. That is the best view on the farm.']),
};

export const JESS_SIGHT_LINES = {
  sightGo: ['Oi, hold tight, I\'ve got something to show you.', 'Come on, you\'ll want to see this.', 'Ooh, I\'ve found something. Hang on to me.'],
  sightGate: ['Look at that, the gate\'s wide open. Somebody\'s getting told off.', 'Gate\'s open! Who does that? Not me, anyway.', 'Right, that gate shouldn\'t be like that. Go on, guess who.'],
  sightView: ['Look at that view. Not bad for a farm, is it?', 'Right, that. That\'s what I wanted you to see.', 'Best spot going. Don\'t tell Amy I come up here.'],
};
