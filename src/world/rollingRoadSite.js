// Where the tuner's rig stands when it is set up, worked out from where the Land Rover stops: the trailer behind it, the rollers' cradle, the
// ramp at the back, the screen on its post and the place the tuner stands. Pure, so the visit (traffic.js), the model, the colliders and the
// tests all use the same numbers. Heading 0 is +z, as the rest of the game; the trailer's own frame is x to the right of the way it is towed
// and z along it, y up from the ground.

export const RIG = {
  hitch: 6, // m from the Land Rover's middle back to the middle of the trailer's deck
  deckHalf: 2.2, // the deck is this far either side of its middle, along the trailer
  deckHalfWide: 1.05, // and across
  deckHeight: 0.34, // m above the ground
  rampLength: 2.5, // the ramp runs back from the deck's rear edge down to the ground
  rampHalfWide: 0.85,
  cradleZ: -0.35, // where the rollers' middle is along the deck (towards the rear)
  cradleHalfAlong: 0.75, // a quad's middle must be this close to it
  cradleHalfAcross: 0.7,
  frontBlock: 1.2, // from here to the deck's front edge stand the fan, the tool chest and the reel: solid, so a quad stops short of them
  frontBlockHeight: 1.1,
  rollerGap: 0.62, // m between the two rollers' middles along the deck
  postX: 1.55, // the screen's post, beside the deck at the rear corner
  postZ: -1.7,
  standX: 1.9, // where the tuner stands, by the deck's side
  standZ: 0.6,
};

const sin = Math.sin;
const cos = Math.cos;

/** A point in the trailer's frame ({ x, z }: across to the right, along the way it points) in the world, for a trailer at `pose` { x, z, yaw }. */
export function toWorld(pose, lx, lz) {
  return { x: pose.x + lx * cos(pose.yaw) + lz * sin(pose.yaw), z: pose.z - lx * sin(pose.yaw) + lz * cos(pose.yaw) };
}

/** The trailer behind a Land Rover at `vehicle` { x, z, yaw }: the same heading, `hitch` metres back. */
export function trailerPose(vehicle) {
  return { x: vehicle.x - sin(vehicle.yaw) * RIG.hitch, z: vehicle.z - cos(vehicle.yaw) * RIG.hitch, yaw: vehicle.yaw };
}

/** Everything the game needs about the set-up rig whose Land Rover has stopped at `vehicle`. */
export function rigSite(vehicle) {
  const trailer = trailerPose(vehicle);
  const at = (x, z) => toWorld(trailer, x, z);
  const cradle = { ...at(0, RIG.cradleZ), yaw: trailer.yaw, halfAlong: RIG.cradleHalfAlong, halfAcross: RIG.cradleHalfAcross };
  return {
    vehicle: { ...vehicle },
    trailer,
    cradle,
    post: at(RIG.postX, RIG.postZ), // the screen: look at it and press E to run
    stand: at(RIG.standX, RIG.standZ), // the tuner
    rampFoot: at(0, -RIG.deckHalf - RIG.rampLength), // where the ramp meets the ground
    corners: [at(-RIG.deckHalfWide, RIG.deckHalf), at(RIG.deckHalfWide, RIG.deckHalf), at(RIG.deckHalfWide, -RIG.deckHalf), at(-RIG.deckHalfWide, -RIG.deckHalf)],
  };
}

/** Whether a point is on the deck (for keeping other things off it). */
export function onDeck(site, x, z, margin = 0) {
  const t = site.trailer;
  const dx = x - t.x;
  const dz = z - t.z;
  const across = dx * cos(t.yaw) - dz * sin(t.yaw);
  const along = dx * sin(t.yaw) + dz * cos(t.yaw);
  return Math.abs(across) <= RIG.deckHalfWide + margin && along >= -RIG.deckHalf - RIG.rampLength - margin && along <= RIG.deckHalf + margin;
}
