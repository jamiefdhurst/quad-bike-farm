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
    mapColour: '#3a5690', // her blue polo, for her dot on the farm map
    params: {
      outfit: 'farmPolo',
      boredShowOffChance: 0.04,
      boredBuzzChance: 0.03, // sits on a rough one now and then, and never says why
      tagWeight: 1.2, // goes along with Jess to keep an eye on her
      workLightWeight: 1.2, // brings the Land Rover round to light what you're at in the dark, unasked
      sideSaddleChance: 0.4, // sits side-saddle on the back, ladylike
      blownNoticeAt: 0.25,
      remembers4wd: 0.65,
      voiceHardBrakeDecel: 5.5, // notices hard braking a little sooner than Jess
      voiceHardBrakeTime: 0.3,
      reactEarsChance: 0.85, // covers her ears at revs beside her; claps a jump rather than cheering
      reactCheerChance: 0.45,
      reactCheerArms: 0.2,
      needColdRise: 0.032, // feels the cold sooner (needs.js)
    },
    lines: VOICE_LINES,
    idles: ['folded', 'clasped', 'weight'], // her ways of standing about (STANDING_IDLES in poseMoves.js): tidy and patient
    waitTastes: { wipeSeat: 2, kickTyre: 0.5, phone: 0.4 }, // how keen she is on each way of waiting that fits what's about (waiting.js): tidies the seat
    seatedIdles: ['folded', 'handsOnKnees', 'anklesCrossed', 'leanBack', 'elbowOut'], // and of sitting a while (SEATED_IDLES)
    voiceBank: 'companion-voice', // public/audio/<voiceBank>.json, recorded by tools/generate_companion_voice.py
    soundRate: 1, // her sighs and laughs, played at this speed (a shade higher pitched above 1)
  },
  {
    id: 'jess',
    name: 'Jess',
    mapColour: '#8e2238', // her burgundy polo
    // Cheekier: braver behind the bars, chattier, bored sooner (usually after
    // about 45 s rather than 60) and more likely to do something about it, and
    // she likes being left on a runaway.
    params: {
      outfit: 'jessPolo',
      voiceHardBrakeDecel: 6.5, // takes a sharper stop before she calls it hard braking
      voiceHardBrakeShed: 3,
      reactEarsChance: 0.15, // loves the noise; cheers a jump with both arms up; flinches less
      reactCheerChance: 0.95,
      reactCheerArms: 1,
      reactFlinch: 0.7,
      needThrillRise: 0.003, // gets restless for a bit of excitement sooner (needs.js)
      height: 1.53,
      walkSpeed: 1.4,
      boredAfterMin: 20,
      boredAfterMax: 70,
      boredMountChance: 0.2,
      parkBrakeChance: 0.5, // leaves it in gear-less limbo half the time
      remembers4wd: 0.25, // and mostly forgets the 4WD switch
      rockPrankWeight: 0.9,
      boredStartChance: 0.25,
      boredDoughnutChance: 0.12, // spins doughnuts in the field when she's bored
      boredJumpChance: 0.12, // rides at the ramp in the field when she's bored
      sideSaddleChance: 0.1, // it isn't her style
      boredBuzzChance: 0.14, // goes and sits on a rough one for the shake, and says so
      pairWeight: 1.3, // can't stand about on her own for long
      boredShowOffChance: 0.12, // rides at you to wheelie or skid past, and looks to see you saw
      boredLineUpChance: 0.06, // now and then parks one quad crooked on purpose, to wind Amy up
      lineUpCrookedChance: 1,
      nickChance: 1, // hops on a quad you've left running and rides off with it (nicking.js)
      boredDriveChance: 0.4,
      driveConfidence: 0.7,
      diagnoseAccuracy: 0.5, // sure of herself, wrong about half the time
      faultNoticeFrom: 0.6, // not watching the quad, only what's fun
      startPullWhenFlat: 1, // on a flat battery she'd rather yank the pull-start than give up
      driveScaredChance: 0.25,
      blownNoticeAt: 0.6, // she only comments when it's properly loud, and she's delighted
      driveBackChance: 0.3,
      ghostFunChance: 0.65,
      takeOverDriveChance: 0.7,
      chattiness: 1.3,
      voiceMinGap: 6,
      overtakeChance: 0.04, // bored of your pace, she goes round you and waits
      followSmokeGap: 0.7, // right up behind a two-stroke: she loves the smoke
      followDustGap: 0.6, // tucked in behind a dusty quad, coughing and laughing
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
    idles: ['hips', 'rock', 'scuff', 'stretch', 'pocket'], // fidgety
    waitTastes: { kickTyre: 1.6, wipeSeat: 0.3, phone: 2 }, // kicks the tyres, never off her phone
    seatedIdles: ['kneeJiggle', 'handsBehindHead', 'swingLegs', 'slouch', 'leanBack', 'elbowOut'],
    lines: linesFor(JESS_LINES),
    voiceBank: 'companion-voice-jess',
    soundRate: 1.06,
  },
];
