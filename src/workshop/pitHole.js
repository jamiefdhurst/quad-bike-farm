// Where the inspection pit's opening is in the world, for cutting it out of the drawn ground (world/terrain.js). Pure: no Three.js.

const FAR = 1e6;

/** The rectangle `[minX, minZ, maxX, maxZ]` nothing is drawn in: the opening, `margin` larger each way, on the world's axes (the barn stands a quarter turn at most). */
export function pitHoleRect(pit, margin = 0.02) {
  const turned = Math.abs(Math.round((pit.yaw ?? 0) / (Math.PI / 2))) % 2 === 1;
  const hx = (turned ? pit.halfZ : pit.halfX) + margin;
  const hz = (turned ? pit.halfX : pit.halfZ) + margin;
  return [pit.x - hx, pit.z - hz, pit.x + hx, pit.z + hz];
}

/** The rectangle that cuts nothing: far away, a metre wide. */
export const NO_HOLE = [FAR, FAR, FAR + 1, FAR + 1];
