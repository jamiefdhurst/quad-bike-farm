// What the girls' wheel offers for a car, Tor or Crag, and why an option is greyed out when she can't do it just now.
// Pure (no Three.js or DOM): game.js gathers the facts, this says which options show and which are greyed with a reason.
// A greyed option stays on the wheel so its shape doesn't change from one opening to the next.

/**
 * `f` is the facts: { name, inside (she is sat in it), idle, busy (why she isn't idle, for the hint), moving, youDriving, girlDriving,
 * seatFree, hasBack (it has a back bench), backFree, mayDrive, ownerName, canDrive, driveFree (nobody at the wheel or on their way; passengers don't count), running,
 * untouched (nobody in or on it at all) }.
 * Returns [{ key, label, why }] where `why` is null when she can do it now and a short reason when she can't.
 */
export function vehicleOptions(f) {
  if (f.inside) return [{ key: 'out', label: `Get out of the ${f.name}`, why: null }];
  const busy = f.idle ? null : f.busy || 'busy';
  const driven = f.youDriving ? 'you\'re driving it' : f.girlDriving ? 'someone\'s driving it' : null;
  const getIn = busy ?? driven ?? (f.moving ? 'it\'s moving' : !f.seatFree && !f.backFree ? 'it\'s full' : null);
  const out = [{ key: 'in', label: `Get in the ${f.name}`, why: getIn ?? (f.seatFree || f.backFree ? null : 'it\'s full') }];
  if (f.hasBack) out.push({ key: 'back', label: 'Get in the back', why: getIn ?? (f.backFree ? null : 'the back is full') });
  const drive = busy ?? (!f.mayDrive ? `it's ${f.ownerName}'s` : !f.canDrive ? 'she can\'t just now' : driven ?? (f.driveFree ? null : 'someone\'s getting in'));
  out.push({ key: 'drive', label: 'Drive it', why: drive });
  const start = busy ?? (f.running ? 'it\'s running' : !f.untouched ? 'someone\'s in it' : null);
  out.push({ key: 'start', label: 'Start it', why: start });
  return out;
}

/** Wheel options from those: a greyed one has no `run` and says why. `run(key)` is what doing it does. */
export function wheelChildren(options, run) {
  return options.map((o) => (o.why ? { label: o.label, disabled: true, hint: o.why } : { label: o.label, run: () => run(o.key) }));
}
