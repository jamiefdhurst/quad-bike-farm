// Waiting that fits where she is. Stood about, a girl picks her ways of standing (poseMoves.js STANDING_IDLES) partly from her own
// habits and partly from what is around her: a tyre within reach she kicks, a seat beside her she wipes, the cold has her rubbing
// her hands, the sun has her shading her eyes, a shower coming on has her looking up at the sky, and now and then she checks her
// phone. This says which of them suit now and how likely each is; StandingIdles picks; companionWaiting.js turns her to the thing and
// says what she looks at. Pure.

/**
 * The ways of waiting that depend on what's about. needs: what has to be there ('wheel', 'seat', 'cold', 'shivering', 'sun', 'clouding', or null
 * for anywhere); pins: she faces the thing and doesn't turn round to look while doing it; hands: something in or under her hand (no
 * hands-up reaction); label: for the debug panel.
 */
export const WAITING_IDLES = {
  kickTyre: { needs: 'wheel', pins: true, label: 'kicking a tyre' },
  wipeSeat: { needs: 'seat', pins: true, hands: true, label: 'wiping a seat' },
  rubHands: { needs: 'cold', label: 'rubbing her hands' },
  shiver: { needs: 'shivering', label: 'shivering' },
  shadeEyes: { needs: 'sun', label: 'shading her eyes' },
  lookUp: { needs: 'clouding', label: 'looking up at the clouds' },
  phone: { needs: null, hands: true, label: 'checking her phone' },
  phoneCall: { needs: null, forced: true, hands: true, pins: true, label: 'on a call' }, // never chosen: phoneCalls.js has her do it, and updateWaiting keeps it in her list
};

export const DEFAULT_WAITING_PARAMS = {
  waitThings: 2.5, // how much likelier a way of waiting that fits what's around her is than one of her own habits
  waitPhone: 0.6, // how likely checking her phone is, against one of her habits (times her taste for it)
  waitReach: 1.2, // metres: a tyre or a seat this close to her is within reach
  waitShiver: 12, // how much likelier she is to stand shivering than an ordinary way of waiting, at her coldest from the rain (soaking.js)
  waitShiverAt: 0.15, // how cold from the rain before she does
  waitCold: 0.3, // how cold (0 mild, 1 the coldest day) before she rubs her hands
  waitSun: 0.65, // how bright the sun (0 none, 1 a sunny day's) before she shades her eyes
  waitCloud: 0.05, // how far the rain has to be coming on (where it's heading less where it is) for her to look up at the sky
};

export const WAITING_PARAM_RANGES = {
  waitThings: [0, 10, 0.1],
  waitPhone: [0, 5, 0.05],
  waitReach: [0.5, 3, 0.05],
  waitShiver: [0, 40, 0.5],
  waitShiverAt: [0, 1, 0.01],
  waitCold: [0, 1, 0.01],
  waitSun: [0, 1, 0.01],
  waitCloud: [0, 1, 0.01],
};

/** Whether what a way of waiting needs is there. `ctx`: { wheel, seat (anything within reach, or null), chill, shiver (0..1, cold from the rain), sun, clouding, wet }. */
function suits(need, ctx, p) {
  if (!need) return true;
  if (need === 'wheel') return !!ctx.wheel;
  if (need === 'seat') return !!ctx.seat;
  if (need === 'cold') return (ctx.chill ?? 0) >= p.waitCold;
  if (need === 'shivering') return (ctx.shiver ?? 0) >= p.waitShiverAt;
  if (need === 'sun') return (ctx.sun ?? 0) >= p.waitSun && !ctx.wet;
  if (need === 'clouding') return (ctx.clouding ?? 0) >= p.waitCloud;
  return false;
}

/**
 * Her ways of standing about now, each { name, weight }: her own habits (`own`, names) at 1 each, then whatever suits what's about,
 * each `p.waitThings` (the phone `p.waitPhone`) times her taste for it (`tastes`: name -> times, 1 if unsaid; 0 and she never does it).
 */
export function waitingChoices(own, ctx, tastes = {}, p = DEFAULT_WAITING_PARAMS) {
  const out = own.map((name) => ({ name, weight: 1 }));
  for (const [name, w] of Object.entries(WAITING_IDLES)) {
    if (w.forced || !suits(w.needs, ctx, p)) continue;
    const weight = (name === 'phone' ? p.waitPhone : name === 'shiver' ? p.waitShiver * (ctx.shiver ?? 0) : p.waitThings) * (tastes[name] ?? 1);
    if (weight > 0) out.push({ name, weight });
  }
  return out;
}

/** Of `points` ({ x, z, ...}), the nearest to `self` within `reach`, or null. */
export function nearestWithin(self, points, reach) {
  let best = null;
  let bestD = reach;
  for (const pt of points) {
    const d = Math.hypot(pt.x - self.x, pt.z - self.z);
    if (d <= bestD) {
      best = pt;
      bestD = d;
    }
  }
  return best;
}

/** What she's doing waiting, for the debug panel and the console. */
export function describeWaiting(name, weight) {
  if (!name || weight <= 0.05) return 'nothing in particular';
  return WAITING_IDLES[name]?.label ?? name;
}
