/** The anchors people (and the player's eyes) hang from: every one that can sit under a scaled model. */
export const SEAT_ANCHOR_NAMES = [
  'riderAnchor', 'pillionAnchor', 'rackAnchor', 'mugAnchor', 'cameraAnchor', 'pillionCameraAnchor',
  'seatLeft', 'seatMid', 'bedSeat', // the UTV's and Land Rover's bench and the UTV's bed
];

/** Undoes a model's scale on its seat anchors, so whoever sits there is still full size (the Land Rover and UTV are drawn at 1.15). */
export function unscaleAnchors(model, scale) {
  for (const name of SEAT_ANCHOR_NAMES) model.getObjectByName(name)?.scale.setScalar(1 / scale);
}
