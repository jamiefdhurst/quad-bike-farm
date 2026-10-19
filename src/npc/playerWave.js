// You wave (6). What a girl does about it depends on how far off she is and what she is doing: close, she waves back (Jess pulls a face
// as well); further off and free, it calls her over; driving, it makes her pull up and wait a while. Engines drown out shouting, so from
// a running quad this is the way to call her. Pure: the game says where she is and whether she can be asked; this says what she does.

export const DEFAULT_WAVE_PARAMS = {
  backRange: 30, // metres: closer than this she waves back
  callRange: 90, // metres: out to here a free girl comes over, a driving one pulls up (any further and she can't make you out)
  gap: 3, // seconds before the same girl answers another wave
  driverWaits: 12, // seconds a driving girl waits where she pulled up before carrying on
  jessFaceChance: 0.5, // when Jess waves back, the chance she pulls a face too
};

export const WAVE_RANGES = {
  backRange: [5, 80, 1],
  callRange: [20, 200, 5],
  gap: [0, 15, 0.5],
  driverWaits: [3, 60, 1],
  jessFaceChance: [0, 1, 0.05],
};

/**
 * What she does. `s`: { distance (metres to you), state ('driving' or the rest), askable (free to be asked: soft jobs give way),
 * canPullUp (she is driving and in a plain drive, not a race or a lesson), canRemark, since (seconds since she last answered) }.
 * `who`: her character id. Returns { kind: 'waveBack' | 'comeOver' | 'pullUp', face } or null.
 */
export function answerWave(s, p, who, random = Math.random) {
  if (s.since < p.gap || s.distance > p.callRange) return null;
  if (s.state === 'driving') return s.askable && s.canPullUp ? { kind: 'pullUp', face: false } : null;
  if (s.distance <= p.backRange) {
    // Close enough to see it is for her. Stood about or walking she waves back; busy, she doesn't.
    if (!s.canRemark && s.state !== 'walking') return null;
    return { kind: 'waveBack', face: who === 'jess' && random() < p.jessFaceChance };
  }
  return s.askable ? { kind: 'comeOver', face: false } : null;
}
