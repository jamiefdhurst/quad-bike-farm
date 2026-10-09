/** The anchors people (and the player's eyes) hang from: every one that can sit under a scaled model. */
export const SEAT_ANCHOR_NAMES = [
  'riderAnchor', 'pillionAnchor', 'rackAnchor', 'mugAnchor', 'cameraAnchor', 'pillionCameraAnchor',
  'seatLeft', 'seatMid', 'bedSeat', // the UTV's and Land Rover's bench and the UTV's bed
];

/**
 * Undoes a model's scale on its seat anchors, so whoever sits there is still full size (the Land Rover and UTV are drawn at 1.15). As
 * well as the names above, every plain anchor named seat<Something> (the 200TDi's seatRearLeft and the rest), so a seat added later
 * can't be missed; the parts named so (seatBox, the seatBack_ backrests) are meshes and groups, not plain anchors, and keep their size.
 */
export function unscaleAnchors(model, scale) {
  const anchors = new Set(SEAT_ANCHOR_NAMES.map((name) => model.getObjectByName(name)).filter(Boolean));
  model.traverse((o) => {
    if (o.type === 'Object3D' && /^seat[A-Z]/.test(o.name)) anchors.add(o);
  });
  for (const a of anchors) a.scale.setScalar(1 / scale);
}
