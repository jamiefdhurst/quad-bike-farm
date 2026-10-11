// How muddy and dusty a girl is. Pure logic, no Three.js. Riding on a muddy quad (the pillion most, behind the back wheel) marks her jeans and
// boots, dust off the stubble gets in her face and hair. Mud dries and is brushed off as she walks about; the hose takes it off quickest.
// Amy minds once it shows; Jess laughs (the lines are in muddyLines.js, the look is effects/girlMud.js).

export const DEFAULT_MUDDY_PARAMS = {
  mudRate: 0.05, // mud a second on her at full spray (a quad caked in mud, flat out), for the pillion
  riderShare: 0.45, // how much of that the rider (or driver) takes: she is further from the back wheel
  puddleRate: 0.18, // extra a second from a puddle splash, scaled by the quad's speed and how muddy its wheels already are
  dustRate: 0.04, // dust a second in a full cloud of the stubble's dust (her own quad's or one she is following through)
  dryTime: 240, // seconds for fresh mud to dry from wet to dry (dry mud is lighter and flakes off)
  flakeRate: 0.0012, // dry mud lost a second just from moving about, riding or not
  brushRate: 0.012, // a second more while she is walking about (she slaps it off her jeans)
  dustBrushRate: 0.02, // dust a second she loses when she is out of it (rubbed off her face, shaken from her hair)
  washRate: 0.4, // a second when the hose is on her
  noticeAt: 0.3, // how much mud makes her notice and say something
  dustNoticeAt: 0.4, // and how much dust
  forgetAt: 0.12, // she is clean enough to say something again once she is below this
  remarkGap: 150, // seconds between her remarks about herself
};

export const MUDDY_PARAM_RANGES = {
  mudRate: [0, 0.3, 0.005],
  riderShare: [0, 1, 0.05],
  puddleRate: [0, 1, 0.01],
  dustRate: [0, 0.3, 0.005],
  dryTime: [10, 1200, 10],
  flakeRate: [0, 0.02, 0.0002],
  brushRate: [0, 0.1, 0.001],
  dustBrushRate: [0, 0.2, 0.002],
  washRate: [0, 2, 0.05],
  noticeAt: [0.05, 1, 0.05],
  dustNoticeAt: [0.05, 1, 0.05],
  forgetAt: [0, 0.5, 0.01],
  remarkGap: [10, 600, 10],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function createMuddiness() {
  return { mud: 0, dust: 0, wet: 0, noticedMud: false, noticedDust: false, sinceRemark: 1e9 };
}

/**
 * One step. `s`: the state, changed in place. `ctx`:
 *   ride: null, or { pillion, wheels (the quad's mud on its wheels 0..1), body (0..1), speed (m/s), puddle (0..1, how much of that is puddle splash), dust (0..1, the cloud she is in) },
 *   walking: she is on her feet and moving, hosed: the hose is on her (0..1 how squarely).
 */
export function updateMuddiness(s, dt, ctx, p) {
  s.sinceRemark += dt;
  const r = ctx.ride;
  if (r) {
    const share = r.pillion ? 1 : p.riderShare;
    const speed = Math.min(Math.abs(r.speed), 12) / 12;
    const flung = clamp01(r.wheels * 0.7 + r.body * 0.3) * speed;
    const splash = (r.puddle ?? 0) * speed * p.puddleRate;
    const gain = (flung * p.mudRate + splash) * share * dt;
    if (gain > 0) {
      s.mud = clamp01(s.mud + gain * (1 - s.mud * 0.5)); // it takes less once she is plastered
      s.wet = clamp01(s.wet + gain * 8);
    }
    if (r.dust > 0) s.dust = clamp01(s.dust + r.dust * p.dustRate * dt * (r.pillion ? 1 : 0.8));
  }
  s.wet = clamp01(s.wet - dt / p.dryTime);
  if (!r || !(r.dust > 0)) s.dust = clamp01(s.dust - p.dustBrushRate * dt * (ctx.walking ? 1.5 : 0.4));
  // Wet mud stays put; once it has dried it flakes off, quicker when she's brushing at it.
  const dryness = 1 - s.wet;
  s.mud = clamp01(s.mud - (p.flakeRate + (ctx.walking ? p.brushRate : 0)) * dryness * dt);
  if (ctx.hosed > 0) {
    s.mud = clamp01(s.mud - p.washRate * ctx.hosed * dt);
    s.dust = clamp01(s.dust - p.washRate * 1.5 * ctx.hosed * dt);
    s.wet = 1; // she is soaked
  }
  if (s.mud < p.forgetAt) s.noticedMud = false;
  if (s.dust < p.forgetAt) s.noticedDust = false;
  return s;
}

/**
 * Whether she has just noticed the state she is in: 'mud', 'dust' or null. Once per time she gets dirty (until she is clean again)
 * and no more often than `remarkGap`. Call `markRemarked` when she has said something.
 */
export function noticing(s, p) {
  if (s.sinceRemark < p.remarkGap) return null;
  if (!s.noticedMud && s.mud >= p.noticeAt) return 'mud';
  if (!s.noticedDust && s.dust >= p.dustNoticeAt) return 'dust';
  return null;
}

export function markRemarked(s, kind, p) {
  if (kind === 'mud') s.noticedMud = true;
  if (kind === 'dust') s.noticedDust = true;
  s.sinceRemark = 0;
}

/** Clean her (the debug panel's button, the "Put it right"). */
export function cleanUp(s) {
  s.mud = 0;
  s.dust = 0;
  s.wet = 0;
  s.noticedMud = s.noticedDust = false;
  return s;
}
