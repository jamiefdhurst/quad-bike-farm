// A trailer isn't a physics body (it follows the hitch), so nothing could see it: the girls' probes ran straight through. This gives each
// a kinematic box that makes no contact forces, so it never shoves a quad or the tractor towing it, but the girls' rays hit it.

const NO_CONTACT_FORCES = 0xffff0000; // in every solver group, pushes against none
const BOX_BOTTOM = 0.2; // above the axle's ground: high enough to clear the grass, low enough that a ray at knee height hits it
const BOX_TOP = 1.0;

/** Trailer-local extents of what a girl must not walk or drive into (the bed or tub; the drawbar is thin enough to ignore). */
export const BALE_TRAILER_FOOTPRINT = { halfWidth: 1.0, rearZ: -1.7, frontZ: 1.5 };
export const TIP_TRAILER_FOOTPRINT = { halfWidth: 0.56, rearZ: -0.95, frontZ: 0.65 };

/** The box for a footprint: its centre on the ground plan, the height of its middle, its half sizes and yaw. Pure, tested. */
export function obstacleBox(footprint, motion) {
  const mid = (footprint.frontZ + footprint.rearZ) / 2;
  const sin = Math.sin(motion.yaw);
  const cos = Math.cos(motion.yaw);
  return {
    x: motion.x + sin * mid,
    z: motion.z + cos * mid,
    y: motion.y + (BOX_BOTTOM + BOX_TOP) / 2,
    half: { x: footprint.halfWidth, y: (BOX_TOP - BOX_BOTTOM) / 2, z: (footprint.frontZ - footprint.rearZ) / 2 },
    yaw: motion.yaw,
  };
}

/** Whether a collider handle is one of these trailers' boxes that a girl driving `quad` should ignore: the one she is towing. */
export function towedBy(trailers, handle, quad) {
  return trailers.some((t) => t.obstacle?.collider.handle === handle && (t.tractor ?? t.puller) === quad && t.hitched);
}

export class TrailerObstacle {
  constructor({ physics, RAPIER, footprint }) {
    this.footprint = footprint;
    this.body = physics.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    const f = footprint;
    this.collider = physics.createCollider(RAPIER.ColliderDesc.cuboid(f.halfWidth, (BOX_TOP - BOX_BOTTOM) / 2, (f.frontZ - f.rearZ) / 2), this.body);
    this.collider.setSolverGroups(NO_CONTACT_FORCES);
  }

  /** Moves the box to where the trailer is (takes effect on the next physics step). */
  sync(motion) {
    const b = obstacleBox(this.footprint, motion);
    this.body.setNextKinematicTranslation({ x: b.x, y: b.y, z: b.z });
    this.body.setNextKinematicRotation({ x: 0, y: Math.sin(b.yaw / 2), z: 0, w: Math.cos(b.yaw / 2) });
  }
}
