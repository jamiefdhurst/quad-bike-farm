// What the girls say about the lane and who comes in at the gate (world/traffic.js): the post van, a neighbour calling, a gate left open.
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_TRAFFIC_LINES = {
  postVan: line(60, ['That will be the post.', 'Post is here. I hope it is the parts.', 'The post van. Somebody sign for it.']),
  neighbourCalls: line(60, ['Oh, a neighbour. I will put the kettle on.', 'Someone is coming up the road. Be nice.', 'That is the neighbour, I think. Wave.']),
  parcelLeft: line(90, ['Has the post left something at the barn door?', 'There is a parcel by the barn. I bet it is for you.']),
  gateLeftOpen: line(90, ['They have left the gate open again.', 'The big gate is open. Somebody shut it before anything gets out.', 'Whoever that was left the gate open.']),
  gateShutting: line(120, ['Thank you for shutting the gate.', 'Good, you shut the gate.']),
  sparesLow: line(180, ['That is the last of one of the spares on the rack. Order another before you need it.', 'We are down to the last one of something on the shelf.']),
  sparesOut: line(180, ['The rack has none of that left. You will have to order it from the post.', 'We are out of one of the spares. Put an order in, and then we wait for the van.']),
};

export const JESS_TRAFFIC_LINES = {
  postVan: ['Post! Anything for me?', 'Ooh, the post van!', 'Is it my parcel? It is probably not my parcel.'],
  neighbourCalls: ['Visitors! Hide the mess.', 'Somebody is coming. Act normal.', 'It is the neighbour. Say hello!'],
  parcelLeft: ['Ooh, a parcel! Can I open it?', 'A parcel by the barn. Shake it and see.'],
  gateLeftOpen: ['They left the gate open. Not my gate.', 'Open gate. Race you through it.', 'Rude. They never shut it.'],
  gateShutting: ['Gate shut. Very responsible of you.', 'Look at you, shutting the gate.'],
  sparesLow: ['Last one on the rack. Somebody else can order it.', 'We are nearly out of something. Not saying what.'],
  sparesOut: ['The box is empty. Do not look at me.', 'None left. It was not me. It was a bit me.'],
};
