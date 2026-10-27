// What the girls say about the lane and who comes in at the gate (world/traffic.js): the post van, a neighbour calling, a gate left open.
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_TRAFFIC_LINES = {
  postVan: line(60, ['That will be the post.', 'Post is here. I hope it is the parts.', 'The post van. Somebody sign for it.']),
  neighbourCalls: line(60, ['Oh, a neighbour. I will put the kettle on.', 'Someone is coming up the road. Be nice.', 'That is the neighbour, I think. Wave.']),
  parcelLeft: line(90, ['Has the post left something at the barn door?', 'There is a parcel by the barn. I bet it is for you.']),
  gateLeftOpen: line(90, ['They have left the gate open again.', 'The big gate is open. Somebody shut it before anything gets out.', 'Whoever that was left the gate open.']),
  gateShutting: line(120, ['Thank you for shutting the gate.', 'Good, you shut the gate.']),
  kidsPass: line(120, ['The neighbours\' children are out on their little bikes again.', 'There go the neighbours\' kids. Wave.']),
  kidsWatch: line(120, ['They have stopped at the gate to watch. Try to look as if you know what you are doing.', 'We have an audience. Do not do anything silly.']),
  kidsShowOff: line(120, ['Right, the children are watching. Behave.', 'Let them see how it is done properly.']),
  kidsLeave: line(120, ['And off they go. Tough crowd.', 'The children have gone. I thought that went rather well.']),
  sparesLow: line(180, ['That is the last of one of the spares on the rack. Order another before you need it.', 'We are down to the last one of something on the shelf.']),
  sparesOut: line(180, ['The rack has none of that left. You will have to order it from the post.', 'We are out of one of the spares. Put an order in, and then we wait for the van.']),
};

export const JESS_TRAFFIC_LINES = {
  postVan: ['Post! Anything for me?', 'Ooh, the post van!', 'Is it my parcel? It is probably not my parcel.'],
  neighbourCalls: ['Visitors! Hide the mess.', 'Somebody is coming. Act normal.', 'It is the neighbour. Say hello!'],
  parcelLeft: ['Ooh, a parcel! Can I open it?', 'A parcel by the barn. Shake it and see.'],
  gateLeftOpen: ['They left the gate open. Not my gate.', 'Open gate. Race you through it.', 'Rude. They never shut it.'],
  gateShutting: ['Gate shut. Very responsible of you.', 'Look at you, shutting the gate.'],
  kidsPass: ['Little ones on little bikes! I want a go.', 'The kids are out! Hi!'],
  kidsWatch: ['We have got an audience! Watch this!', 'They are watching us. Everybody look cool.'],
  kidsShowOff: ['Right, watch this, little ones!', 'Time to show them how it is done.'],
  kidsLeave: ['Bye! Come back and see the next one!', 'They have gone. Did you see them looking at me?'],
  sparesLow: ['Last one on the rack. Somebody else can order it.', 'We are nearly out of something. Not saying what.'],
  sparesOut: ['The box is empty. Do not look at me.', 'None left. It was not me. It was a bit me.'],
};
