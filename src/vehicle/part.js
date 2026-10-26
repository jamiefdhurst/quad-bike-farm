// A named part of a vehicle model, found once. The pose functions look for the same few parts (a lever, a pedal, a door) on every vehicle every
// frame, and `getObjectByName` walks the whole model each time (some 0.35 ms a frame across the farm, #442).

const found = new WeakMap(); // model -> Map(name -> { object, at })
const RECHECK = 1000; // ms before a part that was not there is looked for again (a kit fitted later), and a hit that has come off is looked for at once

/** `model.getObjectByName(name)`, remembered. Undefined if there is no such part. */
export function part(model, name, now = performance.now()) {
  let names = found.get(model);
  if (!names) found.set(model, (names = new Map()));
  const known = names.get(name);
  if (known && (known.object ? known.object.parent : now - known.at < RECHECK)) return known.object;
  const object = model.getObjectByName(name);
  names.set(name, { object, at: now });
  return object;
}
