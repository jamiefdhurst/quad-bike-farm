import { VOICE_LINES } from './voiceLines.js';
import { JESS_LINES } from './jessLines.js';

// The companions on the farm. They share the model, the behaviour and the voice
// code; each has her own name, look, personality (params on top of
// companionParams.js), lines and recorded voice. They don't interact with each
// other, except that each leaves alone a quad the other is busy with.

/** Shared lines with a character's own lines swapped in, situation by situation. */
export function linesFor(own = {}) {
  const lines = { ...VOICE_LINES };
  for (const [situation, list] of Object.entries(own)) {
    const base = VOICE_LINES[situation] ?? {};
    lines[situation] = Array.isArray(list) ? { ...base, lines: list } : { ...base, ...list };
  }
  return lines;
}

export const CHARACTERS = [
  {
    id: 'amy',
    name: 'Amy',
    params: { outfit: 'farmPolo' },
    lines: VOICE_LINES,
    voiceBank: 'companion-voice', // public/audio/<voiceBank>.json, recorded by tools/generate_companion_voice.py
    soundRate: 1, // her sighs and laughs, played at this speed (a shade higher pitched above 1)
  },
  {
    id: 'jess',
    name: 'Jess',
    // Cheekier: braver behind the bars, chattier, bored sooner (usually after
    // about 45 s rather than 60) and more likely to do something about it, and
    // she likes being left on a runaway.
    params: {
      outfit: 'jessPolo',
      height: 1.53,
      walkSpeed: 1.4,
      boredAfterMin: 20,
      boredAfterMax: 70,
      boredMountChance: 0.2,
      boredStartChance: 0.25,
      boredDriveChance: 0.4,
      driveConfidence: 0.7,
      diagnoseAccuracy: 0.5, // sure of herself, wrong about half the time
      faultNoticeFrom: 0.6, // not watching the quad, only what's fun
      startPullWhenFlat: 1, // on a flat battery she'd rather yank the pull-start than give up
      driveScaredChance: 0.25,
      driveBackChance: 0.3,
      ghostFunChance: 0.65,
      takeOverDriveChance: 0.7,
      chattiness: 1.3,
      voiceMinGap: 6,
      followGiveUpMin: 15,
      followGiveUpMax: 50,
      followDriveOnChance: 0.5,
      offerRideRestMin: 25,
      offerRideRestMax: 70,
      offerRideForMin: 45,
      offerRideForMax: 110,
      placedPatienceMin: 150,
      placedPatienceMax: 300,
    },
    lines: linesFor(JESS_LINES),
    voiceBank: 'companion-voice-jess',
    soundRate: 1.06,
  },
];
