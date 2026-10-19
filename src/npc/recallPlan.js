// What a girl has to do before she can walk to where she is called (the bell, "come here", being sent back to the barn). Pure and
// tested: every state she can be in has an answer, and none of them is "walk" while she is still on a vehicle, because walking from a
// seat leaves her parented to it (floating over the ground and going nowhere). companion.js carries the plan out.

/**
 * The first step for a girl in `state` (the fsm state's name); `goal` is the walking state's goal, if she is walking.
 * 'walk' (she is on the ground: just go), 'stopDriving' (pull up and get out, then go), 'dismount' (get off the seat), 'afterDismount'
 * (she is already getting on or off a seat: go when done), 'leaveRest' (get up), 'climbDown' (off the trailer, tractor arch or cab seat),
 * 'afterBoarding' (she is climbing up: let her get there, then straight back down), 'abortBoarding' (she was only walking to it),
 * 'wait' (a fall off the trailer: the next nudge finds her on her feet).
 */
export function recallPlan(state, goal = null) {
  switch (state) {
    case 'driving': return 'stopDriving';
    case 'seated':
    case 'mounting': return 'dismount';
    case 'shuffling':
    case 'dismounting': return 'afterDismount';
    case 'resting': return 'leaveRest';
    case 'onTrailer': return 'climbDown';
    case 'boarding': return 'afterBoarding';
    case 'sliding': return 'wait';
    case 'walking': return goal === 'board' ? 'abortBoarding' : 'walk';
    default: return 'walk';
  }
}

/** Plans after which she is on her own two feet on the ground. */
export const GROUNDED_PLANS = ['walk', 'abortBoarding'];

/** States in which she is walking or stood about on the ground, so her root belongs to the scene, not to a vehicle's seat. */
const ON_THE_GROUND = ['idle', 'walking'];

/** A girl stood or walking about whose root is still parented to a vehicle is stranded (floating, going nowhere): drop her where she is. */
export function strandedOnVehicle(state, parentIsScene) {
  return ON_THE_GROUND.includes(state) && !parentIsScene;
}
