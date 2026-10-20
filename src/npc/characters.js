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
    poloOpen: [0, 1], // buttons of her polo undone, dealt for each farm between these
    // What she wears on top, dealt each day (npc/outfits.js): mostly her polo. She never wears a crop-top, so its share is her polo's.
    outfitOdds: { polo: 0.55, plaid: 0.3, doublePolo: 0.15, cropTop: 0 },
    poppedChance: 0.1, // now and then a popped collar
    // What she might have in mind for the day (npc/agenda.js): tea and tidying, the careful things.
    agendaOdds: { tea: 3, bench: 2, cones: 2, tidy: 2, landRover: 2, fire: 2, hill: 1, ramp: 0.5, race: 0.5 },
    underOpen: [0, 1], // in two polos, buttons undone on her own under the other
    plaidButtons: [0, 1], // a buttoned plaid: done right up, or the top one undone
    params: {
      // The taller of the two, a balanced figure (figure.js amounts, 1 the usual shape).
      height: 1.58,
      bust: 1.0,
      waist: 0.9,
      hips: 0.95,
      outfit: 'farmPolo',
      boredShowOffChance: 0.04,
      boredBuzzChance: 0.03, // sits on a rough one now and then, and never says why
      askChance: 1.3, // polite: asks rather than assumes
      askGoesAnyway: 0.2, // goes quiet and puts out a lip rather than shrugging it off
      tagWeight: 1.2, // goes along with Jess to keep an eye on her
      phoneWeight: 0.9, // her mum, the vet, the college
      phoneMoodChance: 0.35, // and it is not always good news
      phoneMoodSeconds: 360, // she stews on it
      benchWeight: 1.3, // services her own quad at the bench, and asks you for a hand
      helmetWeight: 2.2, // always wears hers, and is first to the hooks
      helmetLeave: 0.7, // but takes it off again when she gets off
      helmetGround: 0.1, // and puts it neatly on the seat
      helmetNags: 1, // and tells you off if you don't
      stormWont: 1, // won't get on or drive a quad in a thunderstorm, and gets off one stood still in it
      carGoWeight: 0.8, // takes her Fiesta down the road now and then, carefully, on her L plates
      generatorWeight: 1.1, // sees the barn dark and the charger waiting, and goes and starts the generator
      trailerGuideWeight: 1.2, // walks round behind a trailer you are reversing and calls the lock
      workLightWeight: 1.2, // brings the Land Rover round to light what you're at in the dark, unasked
      sideSaddleChance: 0.4, // sits side-saddle on the back, ladylike
      blownNoticeAt: 0.25,
      remembers4wd: 0.65,
      voiceHardBrakeDecel: 5.5, // notices hard braking a little sooner than Jess
      voiceHardBrakeTime: 0.3,
      towHorizon: 2.6, // brakes early and keeps her eyes on the rope
      towDistractChance: 0.004,
      radioKeen: 0.1, // would rather hear the engine: turns the radio down, then off
      reactEarsChance: 0.85, // covers her ears at revs beside her; claps a jump rather than cheering
      reactStartleChance: 0.95, // a pheasant out of the hedge makes her jump
      reactCheerChance: 0.45,
      forecastChat: 0.85, // reads the board in the barn and tells you what it says
      reactWaveChance: 0.25, // a nod and a small wave, now and then
      photoPose: 1, // poses neatly
      photoFace: 0.12,
      photoPalm: 0.4, // and says put that away, if she is not in the mood
      reactCheerArms: 0.2,
      needColdRise: 0.032, // feels the cold sooner (needs.js)
      needSleepRise: 0.0009, // sleepy later than Jess, and says she was only resting her eyes
      dozeWeight: 0.8,
      napProne: 1.3, // drops off on a smooth ride, and says she only closed her eyes
      dozeMinds: 1, // and takes it badly if you wake her with a rev
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
    poloOpen: [0, 5], // buttons of her polo undone, dealt for each farm between these: none up to all of them
    // What she wears on top, dealt each day (npc/outfits.js); the crop-top only on a warm day, its share her polo's otherwise.
    outfitOdds: { polo: 0.5, plaid: 0.3, doublePolo: 0.15, cropTop: 0.05 },
    // What she might have in mind for the day (npc/agenda.js): the loud, quick things.
    agendaOdds: { ramp: 3, doughnuts: 3, race: 2, bigOne: 2, car: 2, hill: 1, landRover: 1, cones: 1, fire: 1, bench: 0.5 },
    poppedChance: 0.3, // her collar popped a good third of the time
    underOpen: [0, 4], // in two polos, buttons undone on her own under the other
    plaidButtons: [0, 3], // a buttoned plaid: done right up, down to three undone
    // Cheekier: braver behind the bars, chattier, bored sooner (usually after
    // about 45 s rather than 60) and more likely to do something about it, and
    // she likes being left on a runaway.
    params: {
      outfit: 'jessPolo',
      voiceWobbleDepth: 2.4, // talks on a buzzing seat on purpose, wobbling her voice more than the seat does
      benchSlip: 0.85,
      dareWeight: 1.2, // dares you to jump the ramp, take the ford flat out, touch the fence
      phoneWeight: 1.3, // always on it
      phoneMoodChance: 0.2, // her mates fall out with her now and then
      phoneMoodSeconds: 150, // and she is over it quickly
      benchWeight: 0.7, // has a go at the bench now and then, and hands it back
      helmetWeight: 0.5, // fetches hers when she remembers
      helmetSize: 1.05, // over her big black hair
      helmetRaise: 0,
      helmetLeave: 0.9, // and off it comes the moment she's off the quad
      helmetGround: 0.6, // usually chucked on the grass
      generatorWeight: 0.6, // starts the generator if she is bored of the dark, with a lot of tugging and swearing
      carGoWeight: 1.3, // can't leave her Corsa alone: down the road and back, loud
      voiceHardBrakeDecel: 6.5, // takes a sharper stop before she calls it hard braking
      voiceHardBrakeShed: 3,
      radioKeen: 0.9, // radio on and up, always
      reactEarsChance: 0.15, // loves the noise; cheers a jump with both arms up; flinches less
      reactStartleChance: 0.4, // laughs at the pheasant, mostly
      reactCheerChance: 0.95,
      forecastChat: 0.2, // hardly looks at the board
      reactWaveChance: 0.85, // waves at anyone going by
      photoPose: 0.6,
      photoFace: 1, // pulls faces
      photoPalm: 0.08,
      reactCheerArms: 1,
      reactFlinch: 0.7,
      memoryFade: 0.0008, // forgets a bad bog sooner, and a win (memory.js)
      needThrillRise: 0.003, // gets restless for a bit of excitement sooner (needs.js)
      needSleepRise: 0.0016, // up late, so sleepy sooner
      dozeWeight: 1.2,
      napProne: 0.7, // too fidgety to sleep on a quad, mostly
      // Shorter than Amy and curvier: a fuller bust, a narrower waist and wider hips.
      height: 1.52,
      bust: 1.4,
      waist: 1.15,
      hips: 1.2,
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
      exhaustSideChance: 0.3, // swings off the pipe side without looking
      burnChance: 0.8, // and catches her calf on it if it's hot
      boredBuzzChance: 0.14, // goes and sits on a rough one for the shake, and says so
      askChance: 0.8, // more likely to just go
      askGoesAnyway: 0.9, // 'suit yourself'
      pairWeight: 1.3, // can't stand about on her own for long
      planChance: 0.1, // seldom thinks past the next thing
      boredShowOffChance: 0.12, // rides at you to wheelie or skid past, and looks to see you saw
      boredLineUpChance: 0.06, // now and then parks one quad crooked on purpose, to wind Amy up
      lineUpCrookedChance: 1,
      nickChance: 1, // hops on a quad you've left running and rides off with it (nicking.js)
      boredDriveChance: 0.4,
      driveConfidence: 0.7,
      towHorizon: 1.2, // brakes late for the quad in front, and now and then looks away
      towDistractChance: 0.04,
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
