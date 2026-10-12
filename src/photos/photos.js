// Photos: a camera key, the shots pinned on a corkboard on the barn wall, and how a girl takes being photographed. Pure (the picture
// itself is drawn by the game and passed in as a data URL), tested. The wall is kept between days (farm/farmSave.js).

export const DEFAULT_PHOTO_PARAMS = {
  cooldown: 2, // seconds between shots
  shutterDelay: 0.9, // seconds from pressing the key to the shutter: the girls strike their pose in between
  maxKept: 12, // shots pinned at once; when the wall is full the oldest comes down
  width: 160, // pixels of a kept shot
  height: 100,
  quality: 0.7, // JPEG quality of a kept shot
  frameRange: 14, // metres: a girl further than this is too small to be in the shot
  frameHalfAngle: 0.5, // radians either side of where you look that count as in the picture
  blankSpread: 10, // a shot whose colours vary less than this (all sky, all wall) is not kept
  flashSeconds: 0.35, // the white flash
  tiltMax: 0.14, // radians a print hangs askew
};

export const PHOTO_PARAM_RANGES = {
  cooldown: [0.5, 10, 0.5],
  shutterDelay: [0, 3, 0.1],
  maxKept: [1, 24, 1],
  width: [80, 320, 10],
  height: [50, 200, 10],
  quality: [0.3, 0.95, 0.05],
  frameRange: [4, 40, 1],
  frameHalfAngle: [0.1, 1.2, 0.05],
  blankSpread: [0, 40, 1],
  flashSeconds: [0.05, 1, 0.05],
  tiltMax: [0, 0.4, 0.02],
};

/** What a girl can do when the camera comes up: pose nicely, pull a face, or put a hand up and tell you to put it away. */
export const PHOTO_REACTIONS = ['pose', 'face', 'palm'];

/** Whether a girl at (x, z) is in a picture taken from `cam` ({ x, z, yaw }, yaw the way you face, as a quad's yaw is). */
export function inFrame(cam, at, p = DEFAULT_PHOTO_PARAMS) {
  const dx = at.x - cam.x;
  const dz = at.z - cam.z;
  const d = Math.hypot(dx, dz);
  if (d > p.frameRange) return false;
  if (d < 0.5) return true;
  let a = Math.atan2(dx, dz) - cam.yaw;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return Math.abs(a) <= p.frameHalfAngle;
}

/**
 * What she does about it: 'pose', 'face' or 'palm', picked by her three weights (her params photoPose, photoFace, photoPalm) and her
 * mood towards you. One who feels neglected is more likely to put it away and less likely to smile for you; a favoured one less so.
 */
export function photoReaction(weights, mood = 'even', random = Math.random) {
  const k = mood === 'neglected' ? { pose: 0.4, face: 0.5, palm: 3 } : mood === 'favoured' ? { pose: 1.2, face: 1.2, palm: 0.3 } : { pose: 1, face: 1, palm: 1 };
  const w = PHOTO_REACTIONS.map((r) => Math.max(0, (weights[r] ?? 0) * k[r]));
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return 'pose';
  let roll = random() * total;
  for (let i = 0; i < w.length; i++) {
    roll -= w[i];
    if (roll < 0) return PHOTO_REACTIONS[i];
  }
  return PHOTO_REACTIONS[0];
}

/** Whether pixels (RGBA bytes, sampled) are nearly all one colour: the picture would be of nothing. */
export function isBlank(rgba, spread) {
  let n = 0;
  const sum = [0, 0, 0];
  const sq = [0, 0, 0];
  for (let i = 0; i + 2 < rgba.length; i += 4) {
    n += 1;
    for (let c = 0; c < 3; c++) {
      sum[c] += rgba[i + c];
      sq[c] += rgba[i + c] * rgba[i + c];
    }
  }
  if (n === 0) return true;
  const sd = [0, 1, 2].map((c) => Math.sqrt(Math.max(0, sq[c] / n - (sum[c] / n) ** 2)));
  return (sd[0] + sd[1] + sd[2]) / 3 < spread;
}

/** "14:05" from hours after midnight. */
export function clockText(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours - Math.floor(hours)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * The corkboard's shots. Each is { data, day, time, girls: [ids], x, y, tilt, pin }: x and y where it is pinned (0..1 across the cork,
 * dealt so it lands away from those already there), tilt how askew, pin the colour of the pin.
 */
export class PhotoWall {
  constructor(params = DEFAULT_PHOTO_PARAMS) {
    this.p = params;
    this.photos = [];
    this.clock = 0; // seconds of play, for the cooldown
    this.lastShot = -Infinity;
  }

  update(dt) {
    this.clock += dt;
  }

  /** Seconds before the next shot may be taken (0: now). */
  get cooling() {
    return Math.max(0, this.lastShot + this.p.cooldown - this.clock);
  }

  /** Where the next print goes: of a handful of random spots, the one furthest from the others, so they scatter rather than pile up. */
  deal(random) {
    let best = null;
    let bestGap = -1;
    for (let i = 0; i < 8; i++) {
      const x = 0.12 + random() * 0.76;
      const y = 0.16 + random() * 0.68;
      const gap = this.photos.reduce((m, o) => Math.min(m, Math.hypot((o.x - x) * 1.3, o.y - y)), Infinity);
      if (gap > bestGap) {
        best = { x, y };
        bestGap = gap;
      }
    }
    return { ...best, tilt: (random() * 2 - 1) * this.p.tiltMax, pin: Math.floor(random() * 4) };
  }

  /** Pins a shot ({ data, day, time, girls }). The oldest comes down if the wall is full. Returns the print. */
  add(shot, random = Math.random) {
    const photo = { ...shot, girls: [...(shot.girls ?? [])], ...this.deal(random) };
    this.photos.push(photo);
    while (this.photos.length > this.p.maxKept) this.photos.shift();
    this.lastShot = this.clock;
    return photo;
  }

  clear() {
    this.photos = [];
  }

  toJSON() {
    return this.photos.map((ph) => ({ ...ph, girls: [...ph.girls] }));
  }

  restore(list) {
    if (!Array.isArray(list)) return;
    this.photos = list
      .filter((s) => s && typeof s.data === 'string' && s.data.startsWith('data:image/') && Number.isFinite(s.x) && Number.isFinite(s.y))
      .map((s) => ({
        data: s.data,
        day: Number.isInteger(s.day) ? s.day : 1,
        time: typeof s.time === 'string' ? s.time : '',
        girls: Array.isArray(s.girls) ? s.girls.filter((g) => typeof g === 'string') : [],
        x: s.x,
        y: s.y,
        tilt: Number.isFinite(s.tilt) ? s.tilt : 0,
        pin: Number.isInteger(s.pin) ? s.pin : 0,
      }))
      .slice(-this.p.maxKept);
  }
}
