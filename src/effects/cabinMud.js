// Mud never gets inside a cab. A model with a closed cab names its `cabin` box (min and max, in the quad's own frame); inside it, a
// surface facing the middle of the box is the cab's inside (the painted door skins, the pillars, the underside of the roof), and the mud
// coat leaves it clean. Faces pointing away are the outside and take mud as before. The shader in mudCoat.js does the same sum.

/** A cabin box for a model, or one that nothing is inside (min above max). */
export function cabinBox(cabin) {
  return cabin ? { min: [...cabin.min], max: [...cabin.max] } : { min: [1, 1, 1], max: [-1, -1, -1] };
}

/** 1 where a surface at `pos` with `normal` is the inside of `box`'s cab (so no mud), else 0. */
export function cabinInside(pos, normal, box) {
  for (let i = 0; i < 3; i++) if (pos[i] < box.min[i] || pos[i] > box.max[i]) return 0;
  let facing = 0;
  for (let i = 0; i < 3; i++) facing += normal[i] * ((box.min[i] + box.max[i]) / 2 - pos[i]);
  return facing >= 0 ? 1 : 0;
}
