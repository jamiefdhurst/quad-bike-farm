import * as THREE from 'three';
import { Input } from './core/input.js';
import { createRandom, startSeed } from './core/random.js';
import { prepareShaders } from './core/shaderPrep.js';
import { randomiseQuadSpawns, randomJerryCanSpots, spawnKeepOut, spawnBlocked } from './world/spawns.js';
import { registerTuning } from './core/tuning.js';
import { loadModels } from './world/assets.js';
import { World } from './world/world.js';
import { Player, PLAYER_CAPSULE } from './player/player.js';
import { DEFAULT_PLAYER_PARAMS, PLAYER_PARAM_RANGES } from './player/playerParams.js';
import { QuadUnit } from './vehicle/quadUnit.js';
import { QUAD_SPECS, EXTRA_SPECS, PLOVER_SPEC, TRACTOR_SPEC, UTV_SPEC, LAND_ROVER_SPEC, DEFENDER_SPEC, FIESTA_SPEC, CORSA_SPEC, P309_SPEC } from './vehicle/quadSpecs.js';
import { LANDY_STAND, LANDY_REAR_STAND, LANDY_REAR_SEATS } from './vehicle/landRoverModel.js';
import { CARS, CAR_STAND } from './vehicle/carModel.js';
import { nearerPassenger } from './interaction/seatLook.js';
import { DEFAULT_REAR_ACCESS_PARAMS, REAR_ACCESS_PARAM_RANGES, seatTipTargets, easeSeatTips, pickRearSeat, rearDoor } from './vehicle/rearAccess.js';
import { clearOfChassis } from './vehicle/dismount.js';
import { DEFAULT_BIKE_PARAMS, BIKE_PARAM_RANGES } from './vehicle/bikeLean.js';
import { DEFAULT_RIDER_LEAN_PARAMS, RIDER_LEAN_RANGES } from './vehicle/riderLean.js';
import { pickFleet } from './vehicle/fleet.js';
import { endOfDay, DayFade } from './farm/endOfDay.js';
import { dayRecap, todaysLog, DayRecap } from './farm/dayRecap.js';
import { DayEvents, writeStory, keepStory, validStories } from './farm/dayStory.js';
import { StoriesView } from './farm/storiesView.js';
import { DEFAULT_SHOW_PARAMS, SHOW_PARAM_RANGES, ShowKeeper, isShowDay, isShowEve, runShow, showCard, showSpeech, judgeQuad, previewText, rosetteSvg } from './farm/showDay.js';
import { formatEntry } from './workshop/logbook.js';
import { DEFAULT_FARM_PARAMS, FARM_PARAM_RANGES, browserStorage, openFarm, writeSave, wipeSave, fleetFromSave, describeFarm, validSave } from './farm/farmSave.js';
import { captureVehicle, restoreVehicle, overnight, savedFaults, captureGirls, restoreGirls } from './farm/farmState.js';
import { applyIdle, applyTopRpm, applyVariation, pickIdle } from './vehicle/quadVariation.js';
import { AudioHub } from './audio/engineAudio.js';
import { startBanks } from './audio/bankWant.js';
import { RideWind, rideBuffers } from './audio/rideAudio.js';
import { overlayPauses } from './core/pause.js';
import { DEFAULT_GRAPHICS_PARAMS, GRAPHICS_PARAM_RANGES, pixelRatioFor, nextFrameAt } from './core/graphics.js';
import { FrameStats } from './core/frameStats.js';
import { FrameBreakdown } from './core/frameBreakdown.js';
import { StutterWatch } from './core/stutters.js';
import { FeatureGuard } from './core/featureGuard.js';
import { RadialPad } from './hud/radialPad.js';
import { PAD_RANGES } from './input/gamepad.js';
import { Rumble, DEFAULT_RUMBLE_PARAMS, RUMBLE_RANGES, playRumble } from './input/rumble.js';
import { DEFAULT_SOUND_PARAMS, SOUND_PARAM_RANGES } from './audio/audioParams.js';
import { Companion } from './npc/companion.js';
import { CompanionVoice } from './npc/companionVoice.js';
import { Speech, CompanionSounds } from './audio/companionAudio.js';
import { DEFAULT_COMPANION_PARAMS, COMPANION_PARAM_RANGES } from './npc/companionParams.js';
import { PILLION_PARAM_RANGES } from './npc/pillionParams.js';
import { CHARACTERS } from './npc/characters.js';
import { DEFAULT_NOTICE_PARAMS, NOTICE_PARAM_RANGES } from './npc/attention.js';
import { NoticeWatch } from './npc/noticeWatch.js';
import { Pair, PAIR_PARAM_RANGES, pairFacing, standBy } from './npc/pair.js';
import { MakeUp, MAKE_UP_PARAM_RANGES } from './npc/makeUp.js';
import { AskAlong, ALONG_KINDS, ASK_ALONG_PARAM_RANGES } from './npc/askAlong.js';
import { generalRequests } from './npc/generalRequests.js';
import { DEFAULT_WAITING_PARAMS, WAITING_PARAM_RANGES } from './npc/waiting.js';
import { Daylight, DEFAULT_DAYLIGHT_PARAMS, DAYLIGHT_PARAM_RANGES } from './world/daylight.js';
import { VehicleLights, VEHICLE_LIGHT_PARAM_RANGES } from './effects/vehicleLights.js';
import { MUD_STATE_RANGES } from './effects/quadMud.js';
import { WEAR_LOOK_RANGES } from './effects/mudCoat.js';
import { WeatherStation } from './world/weatherStation.js';
import { Forecast, DEFAULT_FORECAST_PARAMS, FORECAST_PARAM_RANGES, KIND_WARMTH } from './world/forecast.js';
import { choose, mainNeed, nextThink, OFFER_KINDS } from './npc/chooser.js';
import { pickThen, planKey } from './npc/plans.js';
import { Agenda, agendaKey } from './npc/agenda.js';
import { FAULT_KINDS } from './vehicle/faults.js';
import { Briefing, planBriefing, worstTrouble, DEFAULT_BRIEFING_PARAMS, BRIEFING_PARAM_RANGES } from './npc/briefing.js';
import { girlsLeftOut } from './npc/leftOut.js';
import { DEFAULT_ARRIVAL_PARAMS, ARRIVAL_PARAM_RANGES, dealArrival, liftSeats, carsAway, keepAway, Arrival } from './farm/arrival.js';
import { Favour, FAVOUR_PARAM_RANGES } from './npc/favour.js';
import { FallingOut, FALLING_OUT_PARAM_RANGES } from './npc/fallingOut.js';
import { Romance, Tryst, ROMANCE_PARAM_RANGES } from './npc/romance.js';
import { pickHistory, pickFaultChance } from './vehicle/history.js';
import { TyreSet, dealTyres, DEFAULT_TYRE_PARAMS, TYRE_PARAM_RANGES } from './vehicle/tyres.js';
import { pushDirection, localAlong, hasChoke } from './vehicle/controls.js';
import { BrakeState, DEFAULT_BRAKE_PARAMS, BRAKE_PARAM_RANGES } from './vehicle/brakeState.js';
import { DEFAULT_CARB_ICE_PARAMS, CARB_ICE_PARAM_RANGES } from './vehicle/carbIcing.js';
import { FrozenCable, DEFAULT_FROZEN_CABLE_PARAMS, FROZEN_CABLE_PARAM_RANGES } from './vehicle/frozenCable.js';
import { RollWatch, rollReactions, DEFAULT_HANDBRAKE_PARAMS, HANDBRAKE_PARAM_RANGES } from './vehicle/handbrake.js';
import { DEFAULT_DRIVE_PARAMS, DRIVE_PARAM_RANGES, StuckWatch, forgotReaction } from './vehicle/driveMode.js';
import { HEADLIGHT_PARAMS, HEADLIGHT_PARAM_RANGES } from './vehicle/headlight.js';
import { LIGHT_SWITCH_PARAMS, LIGHT_SWITCH_PARAM_RANGES } from './vehicle/lightSwitch.js';
import { SPOTLAMP_PARAMS, SPOTLAMP_PARAM_RANGES } from './vehicle/spotlamps.js';
import { SNORKEL_PARAMS, SNORKEL_PARAM_RANGES } from './vehicle/snorkel.js';
import { INDICATOR_PARAMS, INDICATOR_PARAM_RANGES } from './vehicle/indicators.js';
import { SEAT_BELT_PARAMS, SEAT_BELT_PARAM_RANGES } from './vehicle/seatBelts.js';
import { describeVehicle } from './debug/startReport.js';
import { QuirkSet, DEFAULT_QUIRK_PARAMS, QUIRK_PARAM_RANGES, featuresOf, pickQuirks } from './vehicle/quirks.js';
import { captureStock, tuneTarget, stockSettings, clampSettings, applyTune } from './vehicle/tuneUp.js';
import { startRunningIn } from './engine/runningIn.js';
import { WearLedger, LEDGER_PARAM_RANGES } from './engine/wearLedger.js';
import { LeftRunning, LEFT_PARAM_RANGES, leftRunningSituation } from './npc/leftRunning.js';
import { CarbDrip, DRIP_PARAM_RANGES } from './vehicle/carbDrip.js';
import { pickLeak, pickThermostat, levelText } from './engine/coolant.js';
import { Pranks, PRANK_PARAM_RANGES } from './npc/pranks.js';
import { RevOff, REVOFF_PARAM_RANGES } from './npc/revOff.js';
import { DrownOut, DROWNOUT_PARAM_RANGES } from './npc/drownOut.js';
import { Horns, HORN_PARAM_RANGES } from './npc/horns.js';
import { TractorWatch, TRACTOR_WATCH_PARAM_RANGES } from './npc/tractorWatch.js';
import { RiverWatch, RIVER_WATCH_PARAM_RANGES } from './npc/riverWatch.js';
import { QuarryWatch, QUARRY_WATCH_PARAM_RANGES } from './npc/quarryWatch.js';
import { PitClimb, PIT_PARAM_RANGES, pitMessage, PIT_ASK_MESSAGE } from './world/pitClimb.js';
import { HayRide, HAYRIDE_PARAM_RANGES } from './npc/hayRide.js';
import { MudguardRide, MUDGUARD_PARAM_RANGES } from './npc/mudguardRide.js';
import { TractorMount } from './vehicle/tractorMount.js';
import { UtvMount } from './vehicle/utvMount.js';
import { BENCH_SEATS, benchDismountSpots, pickBenchSeat } from './vehicle/benchSeat.js';
import { UtvBed, UTV_BED_PARAM_RANGES } from './vehicle/utvBed.js';
import { TipTrailer, canTow, TIP_TRAILER_PARAM_RANGES } from './vehicle/tipTrailer.js';
import { DEFAULT_TOW_PARAMS, TOW_PARAM_RANGES, towLoad, towEffect } from './vehicle/towing.js';
import { DEFAULT_MIRROR_PARAMS, MIRROR_PARAM_RANGES, MirrorView, insideFootprint, lookingForward, mirrorTurn } from './vehicle/mirrorView.js';
import { TrailerRide, TRAILER_RIDE_PARAM_RANGES } from './npc/trailerRide.js';
import { poseUtvBed, BED_CARGO_SPOTS, BED_CARGO_YAWS, BED_CARGO_YAW } from './vehicle/utvModel.js';
import { CargoHold, CARGO_PARAM_RANGES } from './vehicle/cargoHold.js';
import { DEFAULT_LOOSE_PARAMS, LOOSE_PARAM_RANGES, newLoose, creepStep, offRack, shuffleStep, tipStep } from './vehicle/looseThings.js';
import { Tailgate, TAILGATE_PARAM_RANGES } from './vehicle/tailgate.js';
import { UtvRide, UTV_RIDE_PARAM_RANGES, DEFAULT_UTV_RIDE_PARAMS } from './npc/utvRide.js';
import { TractorGo, TRACTORGO_PARAM_RANGES } from './npc/tractorGo.js';
import { vehicleOptions, wheelChildren } from './npc/vehicleWheel.js';
import { RadioAudio } from './audio/radioAudio.js';
import { RADIO_PARAMS, RADIO_PARAM_RANGES } from './vehicle/radio.js';
import { RadioTaste, applyRadioMove, RADIO_TASTE_PARAMS, RADIO_TASTE_PARAM_RANGES } from './npc/radioTaste.js';
import { CarGo, Borrowing, mayDriveCar, refuseCarLine, CAR_GO_PARAM_RANGES } from './npc/carGo.js';
import { LPlates, LPLATE_PARAM_RANGES, meanSkill } from './npc/lPlates.js';
import { LPlateSet } from './vehicle/lPlateModel.js';
import { TractorRunaway, TRACTOR_RUNAWAY_PARAM_RANGES } from './npc/tractorRunaway.js';
import { DEFAULT_CREEP_PARAMS, CREEP_PARAM_RANGES } from './vehicle/creep.js';
import { DEFAULT_BRAKE_KEY_PARAMS, DEFAULT_THROTTLE_KEY_PARAMS, PEDAL_KEY_PARAM_RANGES } from './vehicle/pedalKeys.js';
import { DEFAULT_TRACTOR_GO_DRIVE, TRACTOR_GO_DRIVE_RANGES, DEFAULT_UTV_GO_DRIVE, DEFAULT_LANDY_GO_DRIVE } from './npc/companionDriving.js';
import { DEFAULT_CRANK_ATTEMPT_PARAMS, CRANK_ATTEMPT_PARAM_RANGES, needsStartingHandle } from './npc/crankAttempt.js';
import { DEFAULT_PUSH_PARAMS, PUSH_PARAM_RANGES } from './npc/pushStart.js';
import { DEFAULT_TRACTOR_START_PARAMS, TRACTOR_START_PARAM_RANGES } from './npc/tractorStart.js';
import { DEFAULT_NOVICE_PARAMS, NOVICE_PARAM_RANGES } from './vehicle/autoShifter.js';
import { HAYSEAT_PARAM_RANGES, DEFAULT_HAYSEAT_PARAMS } from './npc/companionHayRide.js';
import { DEFAULT_MOVE_PARAMS, MOVE_PARAM_RANGES } from './npc/companionMoves.js';
import { DEFAULT_IDLE_POSE_PARAMS, IDLE_POSE_PARAM_RANGES } from './npc/poseMoves.js';
import { HayTrailer } from './vehicle/hayTrailer.js';
import { TRAILER_PARAM_RANGES } from './vehicle/trailer.js';
import { LOAD_PARAM_RANGES, mayLoad } from './vehicle/quadLoad.js';
import { QuadNames, NAME_PARAM_RANGES, quadKey } from './npc/quadNames.js';
import { Ownership, OWNERSHIP_PARAM_RANGES } from './npc/ownership.js';
import { QuadCare, CARE_PARAM_RANGES } from './npc/quadCare.js';
import { Hearing, EAR_PARAM_RANGES } from './npc/earing.js';
import { Warming, WARMING_PARAM_RANGES, isChilly } from './npc/warming.js';
import { CabShelter, CAB_SHELTER_PARAM_RANGES } from './npc/cabShelter.js';
import { Sulking, SULK_PARAM_RANGES } from './npc/sulking.js';
import { ReadyWaiting, READY_PARAM_RANGES } from './npc/readyWaiting.js';
import { answerWave, DEFAULT_WAVE_PARAMS, WAVE_RANGES } from './npc/playerWave.js';
import { WarmSit, WARMSIT_PARAM_RANGES } from './npc/warmSit.js';
import { Practising, PRACTISING_PARAM_RANGES } from './npc/practising.js';
import { DontFixIt, DONTFIX_PARAM_RANGES } from './npc/dontFixIt.js';
import { ComparingNotes, COMPARE_PARAM_RANGES } from './npc/comparingNotes.js';
import { OPINION_PARAMS, OPINION_PARAM_RANGES, disagreements, agreements } from './npc/quadOpinion.js';
import { STRENGTH_PARAMS, STRENGTH_PARAM_RANGES, strengthOf, bonusFor, groundKind } from './vehicle/strength.js';
import { DEFAULT_NUMB_PARAMS, NUMB_PARAM_RANGES } from './npc/numbness.js';
import { DEFAULT_KEEPALIVE_PARAMS, KEEPALIVE_PARAM_RANGES } from './npc/keepAlive.js';
import { HeadStart, HEADSTART_PARAM_RANGES } from './npc/headStart.js';
import { Gossip, GOSSIP_PARAM_RANGES } from './npc/gossip.js';
import { ThrottleGrab, GRAB_PARAM_RANGES } from './npc/throttleGrab.js';
import { DEFAULT_NAP_PARAMS, NAP_PARAM_RANGES } from './npc/backNap.js';
import { DEFAULT_BLINK_PARAMS, BLINK_PARAM_RANGES } from './npc/blink.js';
import { DEFAULT_FACE_PARAMS, FACE_PARAM_RANGES } from './npc/faceExpression.js';
import { PillionCoach, PILLION_COACH_PARAM_RANGES } from './npc/pillionCoach.js';
import { Lessons, LESSON_PARAM_RANGES, DRILLS } from './npc/lessons.js';
import { dustExposure } from './world/dust.js';
import { SmokeSense, SMOKE_PARAM_RANGES } from './npc/smokeSense.js';
import { FaultShout, SHOUT_PARAM_RANGES } from './npc/shoutFault.js';
import { Haze, HAZE_PARAM_RANGES } from './world/haze.js';
import { HazeLayer } from './effects/hazeLayer.js';
import { Mist, Rainbow, MIST_PARAM_RANGES, RAINBOW_PARAM_RANGES } from './world/mist.js';
import { RainbowView } from './effects/rainbowView.js';
import { BarnFumes, FUMES_PARAM_RANGES } from './world/barnFumes.js';
import { barnShape, underRoof } from './world/barn.js';
import { Race, RACE_PARAM_RANGES, planLap, YouRun, youOnGrid, pickQuads } from './npc/race.js';
import { DEFAULT_SIGHT_PARAMS, SIGHT_PARAM_RANGES, gatesFoundOpen } from './npc/sights.js';
import { DEFAULT_OUTING_PARAMS, OUTING_PARAM_RANGES, pickOuting, outingSpots } from './npc/outings.js';
import { ASK_PATIENCE, ASK_KINDS, askProblems, askLine } from './npc/asking.js';
import { Drag, DRAG_PARAM_RANGES, onDragGrid } from './npc/drag.js';
import { buildDragStrip } from './world/dragStrip.js';
import { HillClimb, CLIMB_PARAM_RANGES, climbGates, climbRoute } from './npc/hillClimb.js';
import { ConeCourse, ConeField, DEFAULT_CONE_PARAMS, CONE_PARAM_RANGES, coneGates, coneSpots, knockRoute } from './npc/coneCourse.js';
import { yourAsks } from './npc/yourAsks.js';
import { Challenges, ColdStartRun, CleanWatch, DEFAULT_CHALLENGE_PARAMS, CHALLENGE_PARAM_RANGES, CHALLENGE_KINDS, judgeLineUp, formatChallenge } from './world/challenges.js';
import { buildLineUpBays } from './world/lineUpBays.js';
import { Records, JumpMeasure, DEFAULT_RECORD_PARAMS, RECORD_PARAM_RANGES, RECORD_KINDS, WHO_NAMES, formatValue } from './world/records.js';
import { LAYOUT, stripFrame, stripPoint } from './world/layout.js';
import { dealtLayout } from './world/quarry.js';
import { DashReader, READING_PARAM_RANGES } from './npc/dashReading.js';
import { Convoy, CONVOY_PARAM_RANGES } from './npc/convoy.js';
import { DoughnutWatch, DOUGHNUT_PARAM_RANGES } from './npc/doughnuts.js';
import { TarmacWatch, TARMAC_PARAM_RANGES, onTarmac } from './npc/tarmac.js';
import { squealLevel, slipAngle } from './vehicle/tyreSqueal.js';
import { DEFAULT_SHOWOFF_PARAMS, SHOWOFF_PARAM_RANGES } from './npc/showOff.js';
import { JumpWatch, JUMP_PARAM_RANGES, rampPoint } from './npc/jumps.js';
import { Nicking, NICK_PARAM_RANGES } from './npc/nicking.js';
import { DEFAULT_LINEUP_PARAMS, LINEUP_PARAM_RANGES, parkRoute } from './npc/lineUp.js';
import { BALE_TRAILER_FOOTPRINT, TIP_TRAILER_FOOTPRINT } from './vehicle/trailerObstacle.js';
import { TrailerGuide, TRAILER_GUIDE_PARAM_RANGES, guideSpot } from './npc/trailerGuide.js';
import { WorkLight, WORK_LIGHT_PARAM_RANGES } from './npc/workLight.js';
import { GeneratorStart, GENERATOR_START_PARAM_RANGES } from './npc/generatorStart.js';
import { finishJob } from './workshop/benchJobs.js';
import { Dares, DARE_PARAM_RANGES, DARE_KINDS, steepestBank } from './npc/dares.js';
import { GirlBench, GIRL_BENCH_PARAM_RANGES, ASK_PROMPT, pickJob, workSpot } from './npc/girlBench.js';
import { PhoneCalls, PHONE_PARAM_RANGES, callSpot } from './npc/phoneCalls.js';
import { PhoneAudio } from './audio/phoneAudio.js';
import { DEFAULT_HOME_PARAMS, HOME_PARAM_RANGES } from './npc/homeParking.js';
import { Tea, TEA_PARAM_RANGES } from './npc/tea.js';
import { Flask, FLASK_PARAM_RANGES } from './npc/flask.js';
import { carryParams, CARRY_PARAM_RANGES, carryWeight } from './npc/carrying.js';
import { dealPoloOpen } from './npc/polo.js';
import { dealOutfit, outfitsFor, outfitRemark, DEFAULT_OUTFIT_PARAMS, OUTFIT_PARAM_RANGES } from './npc/outfits.js';
import { dealPonytail, DEFAULT_PONYTAIL_PARAMS, PONYTAIL_PARAM_RANGES } from './npc/ponytail.js';
import { Jumpers, JUMPER_PARAM_RANGES, dealJumperColours } from './npc/jumpers.js';
import { JumperRail } from './world/jumperRail.js';
import { Coats, COAT_PARAM_RANGES, dealCoatColours } from './npc/coats.js';
import { Headgear, HEADGEAR_PARAM_RANGES } from './npc/headgear.js';
import { HelmetView } from './npc/helmetView.js';
import { HelmetHooks } from './world/helmetHooks.js';
import { GogglesOverlay } from './hud/gogglesOverlay.js';
import { DieselMistake, DIESEL_MISTAKE_PARAM_RANGES } from './npc/dieselMistake.js';
import { Mugs } from './items/mug.js';
import { Achievements, DEFAULT_ACHIEVEMENT_PARAMS, ACHIEVEMENT_PARAM_RANGES } from './achievements/achievements.js';
import { paginate } from './achievements/pages.js';
import { Discoveries, stallDiscovery, prankDiscovery } from './achievements/discoveries.js';
import { achievementSnapshot, placesAt } from './achievements/snapshot.js';
import { buildStartLine, buildClimbCones, buildConeCourse, layCone, nearestTrackFraction } from './world/startLine.js';
import { DEFAULT_LOFT_PARAMS, LOFT_PARAM_RANGES, onLoft, Climb, Hiding, StrawDrop } from './world/loft.js';
import { StrawFall } from './effects/strawFall.js';
import { Places, PLACE_PARAM_RANGES, isFine, nearestSpot, restStay } from './npc/places.js';
import { dozeStay } from './npc/dozing.js';
import { SnoreAudio } from './audio/snoreAudio.js';
import { Requests, REQUEST_PARAM_RANGES } from './npc/requests.js';
import { Skills, SKILL_PARAM_RANGES, COACHING } from './npc/skills.js';
import { Watching, WATCH_PARAM_RANGES, WATCH_THINGS } from './npc/watching.js';
import { Banter } from './npc/banter.js';
import { RideOffer, pickOfferer } from './npc/rideOffer.js';
import { BANTER } from './npc/banterLines.js';
import { BanterWatch } from './npc/banterWatch.js';
import { PubVisit, DEFAULT_PUB_PARAMS, PUB_PARAM_RANGES } from './npc/pubVisit.js';

// Bickers where they trade digs: each adds a little friction towards falling out (fallingOut.js).
const FRICTION_BANTER = ['idle', 'favoured', 'rivals', 'strengths', 'watching', 'sharing', 'riding', 'corrected', 'swapped', 'stuck'];
import { JerryCan, DEFAULT_JERRY_CAN_PARAMS, JERRY_CAN_PARAM_RANGES, PREMIX_CAN_COLOURS, DIESEL_CAN_COLOURS } from './items/jerryCan.js';
import { OilBottle, OIL_BOTTLE_PARAM_RANGES } from './items/oilBottle.js';
import { CoolantBottle, COOLANT_BOTTLE_PARAM_RANGES, pourStep } from './items/coolantBottle.js';
import { AntiGelBottle, ANTI_GEL_BOTTLE_PARAM_RANGES, doseStep } from './items/antiGelBottle.js';
import { DEFAULT_BLEED_PARAMS, BLEED_PARAM_RANGES } from './vehicle/bleeding.js';
import { DEFAULT_DIESEL_WAX_PARAMS, DIESEL_WAX_PARAM_RANGES, dealWax } from './vehicle/dieselWax.js';
import { BatteryItem, hasBattery } from './items/battery.js';
import { BoosterPack, BOOSTER_ID, DEFAULT_BOOSTER_PARAMS, BOOSTER_PARAM_RANGES, boostStep, packOvernight } from './items/boosterPack.js';
import { Charger, CHARGER_PARAM_RANGES } from './workshop/charger.js';
import { buildChargerModel, CHARGER_SLOT } from './workshop/chargerModel.js';
import { PlugAdditive, PLUG_ADDITIVE_PARAM_RANGES } from './items/plugAdditive.js';
import { ratioText } from './engine/lubrication.js';
import { walkRound, DEFAULT_WALK_PARAMS, WALK_PARAM_RANGES } from './npc/walkRound.js';
import { DEFAULT_MOTO_PARAMS, MOTO_PARAM_RANGES } from './npc/motoGo.js';
import { DEFAULT_THROWN_PARAMS, THROWN_PARAM_RANGES } from './npc/companionThrown.js';
import { FaultKnowledge, DEFAULT_WONT_PARAMS, WONT_PARAM_RANGES, WONT_LINE } from './npc/wontRide.js';
import { Sump, DEFAULT_SUMP_PARAMS, SUMP_PARAM_RANGES, pickBurner, startLevel, readStick } from './vehicle/sump.js';
import { DEFAULT_DIP_PARAMS, DIP_PARAM_RANGES, readTank, dipMessage, gaugeLies } from './vehicle/tankDip.js';
import { fuelText } from './engine/diesel.js';
import { FuelTank } from './items/fuelTank.js';
import { Bell } from './world/bellBuild.js';
import { Flock, findFlockSpot, DEFAULT_FLOCK_PARAMS, FLOCK_PARAM_RANGES } from './world/flock.js';
import { FlockView } from './world/flockView.js';
import { SheepAudio } from './audio/sheepAudio.js';
import { GeneratorAudio } from './audio/generatorAudio.js';
import { Generator, GENERATOR_PARAM_RANGES } from './items/generator.js';
import { buildGeneratorModel, GENERATOR_SIZE, GENERATOR_EXHAUST } from './items/generatorModel.js';
import { ExhaustSmoke, DEFAULT_SMOKE_PARAMS } from './effects/exhaustSmoke.js';
import { Rabbits, Pheasants, hedgeSpots, DEFAULT_WILDLIFE_PARAMS, WILDLIFE_PARAM_RANGES } from './world/wildlife.js';
import { WildlifeView } from './world/wildlifeView.js';
import { WildlifeAudio } from './audio/wildlifeAudio.js';
import { Cat, perchWarmth, catShelter, DEFAULT_CAT_PARAMS, CAT_PARAM_RANGES } from './world/cat.js';
import { CatView } from './world/catView.js';
import { CatAudio } from './audio/catAudio.js';
import { Dog, DEFAULT_DOG_PARAMS, DOG_PARAM_RANGES } from './world/dog.js';
import { DogView } from './world/dogView.js';
import { DogAudio } from './audio/dogAudio.js';
import { AnimalAudio } from './audio/animalAudio.js';
import { FarmAnimals, DEFAULT_ANIMAL_PARAMS, ANIMAL_PARAM_RANGES } from './world/farmAnimals.js';
import { FarmAnimalsView } from './world/farmAnimalsView.js';
import { FeedBucket, FeedBin, FEED_BUCKET_PARAM_RANGES } from './items/feedBucket.js';
import { ElectricFence, createElectricFence, DEFAULT_FENCE_PARAMS, FENCE_PARAM_RANGES } from './world/electricFence.js';
import { FenceAudio } from './audio/fenceAudio.js';
import { BELL_PARAM_RANGES } from './world/bell.js';
import { Toolbox } from './items/toolbox.js';
import { JumpLeads, JUMP_LEAD_PARAM_RANGES } from './items/jumpLeads.js';
import { Hose, HOSE_PARAM_RANGES } from './items/hose.js';
import { Winch, WINCH_PARAM_RANGES } from './items/winch.js';
import { pickTree, isHeavy } from './items/winchAnchor.js';
import { WinchAudio } from './audio/winchAudio.js';
import { Chain, CHAIN_PARAM_RANGES } from './items/chain.js';
import { TowRope, TOW_ROPE_PARAM_RANGES } from './items/towRope.js';
import { DEFAULT_TOW_STEER_PARAMS, TOW_STEER_RANGES } from './npc/towSteer.js';
import { DEFAULT_STRANDED_PARAMS, STRANDED_RANGES } from './npc/stranded.js';
import { nearestNamedSpot } from './npc/spotNames.js';
import { TRACTOR_GROUND_OFFSET, SPLITTER, poseLogSplitter } from './vehicle/tractorModel.js';
import { DEFAULT_SPLITTER_PARAMS, SPLITTER_PARAM_RANGES, LogSplitter, LogStack, splitterPowered } from './items/logSplitter.js';
import { WoodPiece, StackView } from './items/woodPieces.js';
import { SplitAudio } from './audio/splitAudio.js';
import { Weather, pickWeatherKind, pickTemperature } from './world/weather.js';
import { dateToday, daylightParams, weatherWeights, temperatureBandWeights, groundFor, isAutumn, isWinter } from './world/seasons.js';
import { Wind, Shutter, pickHeading, DEFAULT_WIND_PARAMS, WIND_PARAM_RANGES } from './world/wind.js';
import { windUniforms, swayMetres } from './effects/windSway.js';
import { DoorAudio } from './audio/doorAudio.js';
import { TrafficHost } from './world/trafficHost.js';
import { showOffBoost } from './world/kids.js';
import { NeighbourHost } from './world/neighbourHost.js';
import { VillageHost } from './world/villageHost.js';
import { Snow } from './effects/snow.js';
import { leavesInAir, DEFAULT_AUTUMN_PARAMS, AUTUMN_PARAM_RANGES } from './world/autumn.js';
import { LeafFall } from './world/autumnView.js';
import { Conkers } from './npc/conkers.js';
import { ConkerAudio } from './audio/conkerAudio.js';
import { Rain } from './effects/rain.js';
import { Thunderstorm, DEFAULT_THUNDER_PARAMS, THUNDER_PARAM_RANGES } from './world/thunder.js';
import { ThunderAudio } from './audio/thunderAudio.js';

import { washMud } from './effects/mudBuildUp.js';
import { DEFAULT_LENS_PARAMS, LENS_PARAM_RANGES, createLens, updateLens, wipeLens, leaderAhead, isOpenVehicle, lensCoverage, addSplat } from './effects/lensMud.js';
import { LensMudView } from './effects/lensMudView.js';
import { DEFAULT_MUDDY_PARAMS, MUDDY_PARAM_RANGES, updateMuddiness, noticing, markRemarked } from './npc/muddiness.js';
import { Workshop } from './workshop/workshop.js';
import { PodRack } from './vehicle/pods.js';
import { buildPod } from './vehicle/dashPod.js';
import { pickWornGearbox } from './vehicle/manualDrivetrain.js';
import { DashClock, pickReading, pickRelatedReading, setDashClock, dashClock } from './vehicle/dashState.js';
import { Bench } from './workshop/bench.js';
import { DEFAULT_FUEL_WATER_PARAMS, FUEL_WATER_RANGES, stepCanWater } from './vehicle/fuelWater.js';
import { pickBarnFind, pickClassicFind, BarnFind, DEFAULT_BARN_FIND_PARAMS, BARN_FIND_RANGES, RUSTY_ID } from './vehicle/barnFind.js';
import { weatherModel, buildTarp } from './vehicle/rustyLook.js';
import { planDamage, applyDamage } from './vehicle/rustyDamage.js';
import { Notebook } from './workshop/notebook.js';
import { SparesShelf } from './workshop/sparesShelf.js';
import { canPull, fitIndex } from './vehicle/engineSwap.js';
import { FARM_JOBS, MuckLoad, DEFAULT_MUCK_PARAMS, MUCK_PARAM_RANGES, JobBoard, DEFAULT_JOB_BOARD_PARAMS, JOB_BOARD_PARAM_RANGES, availableJobs, feedWanted } from './world/farmJobs.js';
import { JobBoardView } from './world/jobBoard.js';
import { ClassifiedsView } from './world/classifiedsView.js';
import { MoneyTinView } from './world/moneyTinView.js';
import { Shed, DEFAULT_SHED_PARAMS, SHED_PARAM_RANGES, SHED_PIECES } from './farm/shed.js';
import { ShedView } from './workshop/shedView.js';
import { CoinAudio } from './audio/coinAudio.js';
import { MarketTalk, DEFAULT_MARKET_TALK_PARAMS, MARKET_TALK_RANGES } from './farm/marketTalk.js';
import { Market, DEFAULT_MARKET_PARAMS, MARKET_PARAM_RANGES, FOR_SALE, dealAds, withBought, withoutSold, sellOffer, moneyFacts, colourName } from './farm/classifieds.js';
import { ServiceJob, pickServiceJob, serviceChalk, servicePlan, factsOf, stateOf } from './workshop/service.js';
import { DEFAULT_SPIKE_PARAMS, SPIKE_PARAM_RANGES, keepOutside } from './items/baleSpike.js';
import { BaleSpikeRig } from './items/baleSpikeRig.js';
import { dutchBarnShape } from './world/outbuildings.js';
import { Bonfire, DEFAULT_BONFIRE_PARAMS, BONFIRE_PARAM_RANGES, logSeats } from './world/bonfire.js';
import { BonfireView } from './world/bonfireView.js';
import { HutHost } from './world/hutHost.js';
import { BrushwoodHeap } from './items/brushwood.js';
import { FireSit, FIRE_SIT_PARAM_RANGES } from './npc/fireSit.js';
import { PhotoHost } from './photos/photoHost.js';
import { WallCalendar } from './world/wallCalendar.js';
import { TrophyShelf } from './world/trophyShelf.js';
import { MuckView } from './world/muckView.js';
import { Haymaking, DEFAULT_HAY_PARAMS, HAY_PARAM_RANGES, STACK_CAPACITY, trailerSlots } from './world/haymaking.js';
import { HayView } from './world/hayView.js';
import { SprayerTrailer, SPRAYER_PARAM_RANGES } from './vehicle/sprayerTrailer.js';
import { Spraying, DEFAULT_SPRAY_PARAMS, SPRAY_PARAM_RANGES, SPRAY_PHASE_TEXT, sprayWanted } from './world/spraying.js';
import { SprayView } from './world/sprayView.js';
import { HayLoading, HAY_LOADING_PARAM_RANGES } from './npc/hayLoading.js';
import { shortName } from './workshop/logbook.js';
import { Interaction } from './interaction/interaction.js';
import { cueFor } from './interaction/feedback.js';
import { normalisePrompt } from './interaction/prompt.js';
import { Wheel } from './interaction/wheel.js';
import { groupWheelOptions } from './interaction/wheelGroups.js';
import { Hud } from './hud/hud.js';
import { MapView } from './hud/mapView.js';
import { farmMapFeatures, DEFAULT_MAP_PARAMS, MAP_PARAM_RANGES } from './hud/farmMap.js';
import { DebugGui } from './debug/debugGui.js';
import { GameConsole } from './console/gameConsole.js';

/** Stands in a bench slot's `girl` while you are in that seat, so the girls' seat picking leaves it alone. */
const YOU_ABOARD = { you: true };

const BARN_BULB = 30; // candela of the bulb in the barn, scaled by how far in you are and how gloomy the day is

const FIXED_DT = 1 / 60;
const SETTLE_SECONDS = 2; // physics run while loading so the vehicles are on their wheels before you can hear them (settleVehicles)
const MAX_FRAME_DT = 0.1;
const RACE_STAGE_BACK = 14; // metres behind the start line the girls stage before they come up to the grid

// The vehicles the girls take for a go (and are asked to start): the tractor, the UTV and the two Land Rovers.
const GO_KINDS = ['tractor', 'utv', 'landy', 'defender', 'fiesta', 'corsa', 'p309'];
const CAR_KINDS = ['fiesta', 'corsa']; // the girls' own cars: each goes out only with her owner at the wheel (npc/carGo.js)
const OWNED_KINDS = [...CAR_KINDS, 'p309']; // every car with an owner, yours too (#229): only its owner drives it, so no girl takes it for a go
const CAB_KINDS = ['landy', 'defender', ...OWNED_KINDS]; // the Land Rovers and the cars: in `landys`, a cab with seats behind the wheel

export class Game {
  constructor(RAPIER, canvas) {
    this.RAPIER = RAPIER;
    this.canvas = canvas;

    // How often and at what resolution a frame is drawn, and how far the ground cover reaches (core/graphics.js).
    this.graphics = { ...DEFAULT_GRAPHICS_PARAMS };
    registerTuning('Graphics', this.graphics, GRAPHICS_PARAM_RANGES, { onChange: () => this.onResize() });
    this.frameStats = new FrameStats(); // for the console's `perf`
    this.stutters = new StutterWatch(); // the cause of each long frame and the heap's growth, for `perf` and the "Frame time" folder (core/stutters.js)
    this.guard = new FeatureGuard(); // one feature's error is logged and counted, and the rest of the frame runs (core/featureGuard.js)
    this.frameBreakdown = new FrameBreakdown(); // where the time goes, for the Tune tab's "Frame time" and `perf` (core/frameBreakdown.js)
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(pixelRatioFor(window.devicePixelRatio, this.graphics));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 1200);
    this.scene.add(this.camera);

    this.physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.physics.timestep = FIXED_DT;

    this.input = new Input(canvas);
    this.radialPad = new RadialPad();
    this.hud = new Hud(document.getElementById('hud'));
    this.interaction = new Interaction();
    this.menu = new Wheel(document.getElementById('hud')); // the companion wheel
    this.timer = new THREE.Timer();
    this.accumulator = 0;
    this.girlsAuto = true; // console: girls.autonomy

    window.addEventListener('resize', () => this.onResize());
  }

  async load(report) {
    report('Loading models…');
    this.models = await loadModels((done, total) => report(`Loading models… ${done}/${total}`));
    report('Building world…');
    await new Promise((r) => setTimeout(r, 0));
    // The farm's date and season (world/seasons.js) have to be known before the world is built: autumn turns the trees and the wood's floor, and
    // winter dulls them. The farm has its own calendar, started on a date dealt from its seed; ?season=spring|summer|autumn|winter forces one.
    const farmPeek = openFarm({ search: location.search, storage: browserStorage() });
    this.seed = startSeed(); // a new farm's seed (the farm's own, once it has one, deals its date and its gravel pit)
    this.date = dateToday({ farmSeed: farmPeek.farmSeed ?? this.seed, day: farmPeek.day, forced: new URLSearchParams(location.search).get('season'), createRandom });
    this.season = this.date.season;
    this.autumn = isAutumn(this.season);
    this.world = new World({
      layout: dealtLayout(LAYOUT, farmPeek.farmSeed ?? this.seed),
      autumn: this.autumn,
      winter: isWinter(this.season),
      scene: this.scene,
      physics: this.physics,
      RAPIER: this.RAPIER,
      renderer: this.renderer,
      models: this.models,
      graphics: this.graphics,
    });

    this.player = new Player({
      physics: this.physics,
      RAPIER: this.RAPIER,
      camera: this.camera,
      input: this.input,
      world: this.world,
      params: { ...DEFAULT_PLAYER_PARAMS },
    });

    this.audioHub = new AudioHub({ ...DEFAULT_SOUND_PARAMS });
    this.input.on('firstinteraction', () => this.audioHub.unlock());
    this.rideWind = new RideWind(this.audioHub);

    // Where things start varies a little each game; ?seed=N repeats a layout.
    const random = createRandom(this.seed);
    console.info(`Layout seed ${this.seed} (add ?seed=${this.seed} to the URL to repeat it)`);
    // The farm that remembers (farm/farmSave.js): each load is the next day on the same farm, unless ?seed= is in the URL. What the farm
    // is (which vehicles, their plates, quirks and luck, the girls' quads) is dealt from the farm's seed, which is the first day's; what
    // varies each day (where things are parked, the weather) from today's. On a new farm the two are the same, so a seed deals as before.
    this.farmParams = { ...DEFAULT_FARM_PARAMS };
    registerTuning('Farm that remembers', this.farmParams, FARM_PARAM_RANGES);
    this.showParams = { ...DEFAULT_SHOW_PARAMS };
    registerTuning('Show day', this.showParams, SHOW_PARAM_RANGES);
    this.briefingParams = { ...DEFAULT_BRIEFING_PARAMS };
    registerTuning('Briefing', this.briefingParams, BRIEFING_PARAM_RANGES);
    this.briefing = new Briefing(this.briefingParams);
    this.showKeeper = new ShowKeeper(this.showParams); // the rosettes the farm has won (farm/showDay.js)
    this.farmStorage = browserStorage();
    this.farm = openFarm({ search: location.search, storage: this.farmStorage });
    this.farmSeed = this.farm.farmSeed ?? this.seed;
    const kept = this.farm.save?.vehicles ?? {}; // vehicle id -> what it was like when the last day was saved
    if (this.farm.continuing) console.info(`Day ${this.farm.day} on the farm (farm seed ${this.farmSeed})`);
    // Which vehicles are here (its own random stream, so the rest of a seed's layout doesn't depend on it).
    // The tractor, UTV and Land Rover are in the same pool as the quads and are dealt a place the same way, but they aren't the girls' quads (`girlUnits`).
    const isBig = (spec) => spec.tractor || spec.utv || spec.landRover;
    const pool = [...EXTRA_SPECS, TRACTOR_SPEC, UTV_SPEC, LAND_ROVER_SPEC, DEFENDER_SPEC];
    // The purse and what you bought and sold (farm/classifieds.js). A new farm's purse is dealt from the farm seed; a saved one is put back over it.
    this.marketParams = { ...DEFAULT_MARKET_PARAMS };
    registerTuning('Second-hand market', this.marketParams, MARKET_PARAM_RANGES);
    this.market = new Market(this.marketParams, createRandom(this.farmSeed ^ 0x7ea5));
    this.market.restore(this.farm.save?.market);
    this.shedParams = { ...DEFAULT_SHED_PARAMS }; // the barn's compressor, parts washer and pit, bought from the catalogue (farm/shed.js)
    registerTuning('Shed kit', this.shedParams, SHED_PARAM_RANGES);
    this.shed = new Shed(this.shedParams);
    this.shed.restore(this.farm.save?.shed);
    // What you sold yesterday has gone this morning (its saved condition goes with it: it isn't in the next save).
    const dealt = fleetFromSave(this.farm.save?.fleet, [...QUAD_SPECS, ...pool]) ?? pickFleet(QUAD_SPECS, pool, createRandom(this.farmSeed ^ 0x51ee7));
    const chosen = withoutSold(dealt, this.market.sold);
    this.market.sold = [];
    this.fleetIds = chosen.map((s) => s.id); // as dealt: what you bought is added to it each morning
    // What you bought turns up this morning, in the colour and condition it was sold in, in place of the dealt one of the model.
    const bySpecId = Object.fromEntries([...QUAD_SPECS, ...pool].map((s) => [s.id, s]));
    const stocked = withBought(chosen, this.market.bought, bySpecId);
    this.stockedIds = stocked.map((s) => s.id);
    this.specsById = bySpecId;
    const fleet = stocked.filter((s) => !isBig(s));
    const bigSpecs = stocked.filter(isBig);
    this.bigSpecs = Object.fromEntries(bigSpecs.map((s) => [s.id, s])); // the tractor, UTV and Land Rovers as they are this game (some bought, in their own colour)
    const keepOut = spawnKeepOut(this.world.layout); // nothing starts on a trailer, the tank, the barn doorway, a bale or the track
    const { placed: spawns, home } = randomiseQuadSpawns(this.world.spawn, stocked.length, random, {
      homeCount: fleet.length,
      big: stocked.map((_, i) => i >= fleet.length),
      blocked: (x, z) => spawnBlocked(keepOut, x, z, { track: this.world.track, trackHalfWidth: this.world.layout.trackHalfWidth }),
    });
    const bigSpawn = (spec) => spawns[fleet.length + bigSpecs.findIndex((s) => s.id === spec.id)];

    const plateRandom = createRandom(this.farmSeed ^ 0x91a7e);
    this.units = fleet.map(
      (spec, i) =>
        new QuadUnit({
          spec: spec.plateNumbers ? { ...spec, plateNumber: spec.plateNumbers[Math.floor(plateRandom() * spec.plateNumbers.length)] } : spec,
          spawn: spawns[i],
          scene: this.scene,
          physics: this.physics,
          RAPIER: this.RAPIER,
          world: this.world,
          audioHub: this.audioHub,
        }),
    );
    // Each quad idles differently every game, within its spec's idleRange (same seed, same idles); on a farm that remembers, as it did
    // on the first day (still drawn, so the rest of today's stream is the same).
    for (const unit of this.units) {
      const range = unit.spec.idleRange ?? [unit.engine.params.idleRpmWarm, unit.engine.params.idleRpmWarm];
      const dealt = pickIdle(range, random);
      unit.idleRpm = unit.dealtIdle = applyIdle(unit.engine.params, unit.quad.params, Number.isFinite(kept[unit.id]?.idle) ? kept[unit.id].idle : dealt);
    }
    // Then roughness and starting fuel, after the idles so a seed keeps its idles.
    for (const unit of this.units) {
      unit.variation = applyVariation(unit.spec, unit.engine.params, unit.quad.fuel, random);
    }
    // Each quad's top revs, on their own stream so a seed keeps everything above.
    const topRpmRandom = createRandom(this.farmSeed ^ 0x70b5);
    for (const unit of this.units) unit.topRpm = applyTopRpm(unit.spec, unit.engine.params, topRpmRandom);
    this.units.forEach((u, i) => (u.where = spawns[i].where));
    // What the hour meters and odometers show, the dash clock, and where the two accessory pods start. Each has its own seeded
    // stream, so a seed keeps its layout and these repeat too.
    const usageRandom = createRandom(this.seed ^ 0xd45b);
    for (const unit of this.units) {
      unit.quad.usage.hours = pickReading(unit.spec.hoursRange ?? [0, 0], usageRandom);
      unit.quad.usage.odoMiles = pickReading(unit.spec.odoRange ?? [0, 0], usageRandom);
    }
    // Where each quad has been: some wear already on it, perhaps a fault starting, perhaps the last person's tinkering left in.
    this.history = { quads: {}, settingsFor: (unit) => this.workshop?.settingsFor(unit) ?? unit.leftovers?.settings ?? null };
    const historyRandom = createRandom(this.seed ^ 0x4157);
    const faultChance = pickFaultChance(historyRandom);
    for (const unit of this.units) this.applyHistory(unit, historyRandom, faultChance, kept[unit.id]);
    // The time of day (world/daylight.js): its own start each game, morning or afternoon (?time=16.5 starts it then), running on into the night.
    const forcedTime = new URLSearchParams(location.search).get('time');
    this.daylight = new Daylight(daylightParams(DEFAULT_DAYLIGHT_PARAMS, this.date), { random: createRandom(this.seed ^ 0xc10c), start: forcedTime !== null && Number.isFinite(+forcedTime) ? +forcedTime : null });
    this.vehicleLights = new VehicleLights(this.scene); // real light from the lit vehicles' lamps, a fixed pool (effects/vehicleLights.js)
    // The dashboards' clocks read the time of day; their flashing and cycling keep to real seconds.
    const dash = new DashClock(this.daylight.seconds());
    dash.text = () => this.daylight.text();
    dash.rate = () => this.daylight.p.clockRate; // the hour meters count game hours
    setDashClock(dash);
    this.podRack = new PodRack(this.units.map((u) => u.id));
    this.podRack.place(createRandom(this.farmSeed ^ 0x90d5));
    this.pods = { analogue: buildPod('analogue'), digital: buildPod('digital') };
    for (const unit of this.units) {
      const kind = this.podRack.podOn(unit.id);
      if (kind) unit.quad.fitPod(this.pods[kind]);
    }
    // Tyres: pressures a bit off, mismatched brands, a worn rear (the toolbox's psi tunables are given to them once it exists, below).
    this.tyreParams = { ...DEFAULT_TYRE_PARAMS };
    registerTuning('Tyres', this.tyreParams, TYRE_PARAM_RANGES);
    registerTuning('Gamepad', this.input.padParams, PAD_RANGES);
    this.rumble = new Rumble({ ...DEFAULT_RUMBLE_PARAMS });
    registerTuning('Gamepad rumble', this.rumble.params, RUMBLE_RANGES);
    const tyreRandom = createRandom(this.seed ^ 0x7e55);
    for (const unit of this.units) {
      unit.quad.tyres = new TyreSet(dealTyres(tyreRandom, 4, this.tyreParams), this.tyreParams);
      unit.quad.tyres.useLayout(unit.quad.layout.wheels);
    }
    // Every quad starts parked properly, with its brake on; after that it's down to whoever gets off one (vehicle/handbrake.js).
    for (const unit of this.units) unit.quad.parkBrake = true;
    // Wet brakes after the ford, and the odd quad that has stood so long its brake binds until a few metres free it (vehicle/brakeState.js).
    // Water in the fuel: cans left out in the rain collect it, and the sediment bowl on each tap catches it (vehicle/fuelWater.js).
    this.fuelWaterParams = { ...DEFAULT_FUEL_WATER_PARAMS };
    registerTuning('Water in the fuel', this.fuelWaterParams, FUEL_WATER_RANGES);
    for (const unit of this.units) unit.quad.fuel.waterParams = this.fuelWaterParams;
    this.brakeParams = { ...DEFAULT_BRAKE_PARAMS };
    registerTuning('Brakes', this.brakeParams, BRAKE_PARAM_RANGES);
    const brakeRandom = createRandom(this.seed ^ 0xb4a7);
    for (const unit of this.units) {
      unit.quad.brakes = new BrakeState(this.brakeParams, brakeRandom);
      unit.quad.brakes.setBinding(brakeRandom() < this.brakeParams.bindChance);
    }
    // A throttle cable frozen on a frosty morning (vehicle/frozenCable.js); dealt once the day's weather is known, just below.
    registerTuning('Carb icing', DEFAULT_CARB_ICE_PARAMS, CARB_ICE_PARAM_RANGES); // the quads share this object (vehicle/carbIcing.js)
    this.frozenCableParams = { ...DEFAULT_FROZEN_CABLE_PARAMS };
    registerTuning('Frozen throttle cable', this.frozenCableParams, FROZEN_CABLE_PARAM_RANGES);
    // Diesel waxing in a hard frost (vehicle/dieselWax.js): one set of tuning for every diesel; dealt with the weather, just below.
    this.dieselWaxParams = { ...DEFAULT_DIESEL_WAX_PARAMS };
    registerTuning('Diesel waxing', this.dieselWaxParams, DIESEL_WAX_PARAM_RANGES);
    this.dieselWaxRandom = createRandom(this.seed ^ 0x3a9e);
    for (const unit of this.units) unit.quad.waxParams = this.dieselWaxParams;
    this.bleedParams = { ...DEFAULT_BLEED_PARAMS };
    registerTuning('Bleeding a diesel', this.bleedParams, BLEED_PARAM_RANGES);
    for (const unit of this.units) unit.quad.bleedParams = this.bleedParams;
    this.frozenCableRandom = createRandom(this.seed ^ 0xf205);
    for (const unit of this.units) unit.quad.iceCable = new FrozenCable(this.frozenCableParams, this.frozenCableRandom);
    this.handbrakeParams = { ...DEFAULT_HANDBRAKE_PARAMS };
    this.pushing = null; // the unit you're shoving along on foot (pushOnFoot)
    registerTuning('Handbrake', this.handbrakeParams, HANDBRAKE_PARAM_RANGES);
    this.rollWatch = new RollWatch(this.handbrakeParams);
    // The red and blue's 2WD / 4WD switch (vehicle/driveMode.js): they start in 2WD, and the girls forget it.
    registerTuning('2WD and 4WD', DEFAULT_DRIVE_PARAMS, DRIVE_PARAM_RANGES);
    this.fourWdState = new Map(); // companion -> { quad: the switched quad she's driving or null, watch }
    registerTuning('Headlights', HEADLIGHT_PARAMS, HEADLIGHT_PARAM_RANGES);
    registerTuning('Yak lights', LIGHT_SWITCH_PARAMS, LIGHT_SWITCH_PARAM_RANGES);
    registerTuning('Spotlamps', SPOTLAMP_PARAMS, SPOTLAMP_PARAM_RANGES);
    registerTuning('Snorkel', SNORKEL_PARAMS, SNORKEL_PARAM_RANGES);
    registerTuning('Indicators', INDICATOR_PARAMS, INDICATOR_PARAM_RANGES);
    registerTuning('Seat belts', SEAT_BELT_PARAMS, SEAT_BELT_PARAM_RANGES);
    registerTuning('Two-wheeler lean', DEFAULT_BIKE_PARAMS, BIKE_PARAM_RANGES);
    registerTuning('Three-wheeler rider lean', DEFAULT_RIDER_LEAN_PARAMS, RIDER_LEAN_RANGES);
    // One to three quirks each, from the parts the quad has (a gauge quirk needs a dash or pod that shows it, so this comes after the pods).
    this.quirkParams = { ...DEFAULT_QUIRK_PARAMS };
    registerTuning('Quirks', this.quirkParams, QUIRK_PARAM_RANGES);
    const quirkRandom = createRandom(this.farmSeed ^ 0x9a1c);
    for (const unit of this.units) {
      const kinds = pickQuirks(featuresOf(unit.spec, !!this.podRack.podOn(unit.id)), quirkRandom, this.quirkParams);
      unit.quad.quirks = new QuirkSet(kinds, this.quirkParams);
    }
    // Engine oil: each four-stroke's sump starts at its own level, and one of them burns oil this game (vehicle/sump.js).
    this.sumpParams = { ...DEFAULT_SUMP_PARAMS };
    registerTuning('Engine oil', this.sumpParams, SUMP_PARAM_RANGES);
    this.dipParams = { ...DEFAULT_DIP_PARAMS };
    registerTuning('Tank dip', this.dipParams, DIP_PARAM_RANGES);
    this.walkParams = { ...DEFAULT_WALK_PARAMS };
    registerTuning('Amy walk-round', this.walkParams, WALK_PARAM_RANGES);
    this.wontParams = { ...DEFAULT_WONT_PARAMS }; // Amy refusing a quad she knows is faulty (npc/wontRide.js)
    registerTuning('Amy won\'t ride', this.wontParams, WONT_PARAM_RANGES);
    this.motoParams = { ...DEFAULT_MOTO_PARAMS }; // the girls on the mini moto: Amy won't, Jess has a go (npc/motoGo.js)
    this.thrownParams = { ...DEFAULT_THROWN_PARAMS }; // and coming off it (npc/companionThrown.js)
    registerTuning('Mini moto nerve', this.motoParams, MOTO_PARAM_RANGES);
    registerTuning('Thrown off the moto', this.thrownParams, THROWN_PARAM_RANGES);
    const sumpRandom = createRandom(this.farmSeed ^ 0x0115);
    const sumpUnits = this.units.filter((u) => u.quad.sump);
    const burnerId = pickBurner(sumpUnits.map((u) => u.spec.id), sumpRandom);
    for (const u of sumpUnits) u.quad.sump = new Sump({ level: startLevel(u.spec.id === burnerId, sumpRandom, this.sumpParams), burner: u.spec.id === burnerId, params: this.sumpParams });
    // The tractor, if it's here this game. It's a unit like the quads (you ride it, fuel it, hear it), but `girlUnits` is what the girls know about:
    // they leave it alone for now. Each of the three is null when it isn't on the farm, and everything that uses it checks.
    this.girlUnits = this.units;
    this.tractorUnit = this.bigSpecs.tractor ? this.addTractor(bigSpawn(TRACTOR_SPEC)) : null;
    // The diesel UTV (vehicle/quadSpecs.js UTV_SPEC): another unit that isn't one of the girls' quads, which they ride in but don't drive.
    this.utvUnit = this.bigSpecs.utv ? this.addUtv(bigSpawn(UTV_SPEC)) : null;
    // The two Land Rovers, the old Series III and the 200TDi (LAND_ROVER_SPEC, DEFENDER_SPEC), either, both or neither: units like the UTV with a
    // petrol or diesel quad's quirks, that the girls ride in and take for a go. `landys.<kind>` is { kind, spec, unit, mount, ride }.
    this.landys = {};
    for (const [kind, spec] of [['landy', LAND_ROVER_SPEC], ['defender', DEFENDER_SPEC]]) {
      this.landys[kind] = { kind, spec, unit: this.bigSpecs[spec.id] ? this.addLandRover(bigSpawn(spec), this.bigSpecs[spec.id]) : null, mount: null, ride: null };
    }
    // How you arrive this morning (farm/arrival.js): which girls you gave a lift, dealt from today's stream. A girl who came with you left her car at home.
    this.arrivalParams = { ...DEFAULT_ARRIVAL_PARAMS };
    registerTuning('Arriving in your car', this.arrivalParams, ARRIVAL_PARAM_RANGES);
    this.arrivalDeal = dealArrival(createRandom(this.seed ^ 0x2291), girlsLeftOut(location.search) ? [] : CHARACTERS.map((ch) => ch.id), this.arrivalParams);
    const carSpecs = { fiesta: FIESTA_SPEC, corsa: CORSA_SPEC };
    this.carsAway = carsAway(this.arrivalDeal, (g) => CAR_KINDS.find((k) => carSpecs[k].owner === g));
    // The girls' own cars (vehicle/carModel.js), by the Dutch barn unless she came with you: built and ridden like the Land Rovers, so
    // they live in `landys` too (with `car` set), but each is driven only by its owner (spec.owner) and minds if you take it (npc/carGo.js).
    for (const kind of CAR_KINDS) {
      const spec = carSpecs[kind];
      this.landys[kind] = { kind, spec, car: true, unit: this.carsAway.includes(kind) ? null : this.addLandRover({ ...this.world.layout.cars[kind] }, spec), mount: null, ride: null };
    }
    // Your own car (#229), always here: where you arrive each morning, pulled up on the pad by the Dutch barn (farm/arrival.js).
    this.landys.p309 = { kind: 'p309', spec: P309_SPEC, car: true, unit: this.addLandRover({ ...this.world.layout.cars.p309 }, P309_SPEC), mount: null, ride: null };
    // Perhaps an old quad under a tarp at the back of the barn (vehicle/barnFind.js): a unit like the tractor, not one of the girls' quads.
    this.barnFindParams = { ...DEFAULT_BARN_FIND_PARAMS };
    registerTuning('Barn find', this.barnFindParams, BARN_FIND_RANGES);
    this.pendingLooks = []; // the barn finds' rust, cracks and webs, put on once the game is ready (dressFinds)
    this.rustyUnit = this.addRusty();
    this.ploverUnit = this.addPlover(); // and always the old bike, under its own tarp (vehicle/bantamModel.js)
    if (this.tractorUnit) this.podRack.allow(this.tractorUnit.id); // likewise the tractor, which is added after the pods are dealt
    this.discoveries = new Discoveries(); // the notebook's "Things I've learnt", written down the first time each shows itself
    this.achievements = new Achievements({ params: { ...DEFAULT_ACHIEVEMENT_PARAMS } }); // the bucket list; its fleet is set once every vehicle is added
    if (this.rustyUnit) this.podRack.allow(this.rustyUnit.id); // placed after the pods were dealt, but you can fit one at the bench
    if (this.ploverUnit) this.podRack.allow(this.ploverUnit.id);
    // A sticky float on some of the quads (vehicle/carbDrip.js): a parked one with the tap on drips petrol and floods. Own random stream.
    this.carbDrip = new CarbDrip(this.units.filter((u) => !u.quad.fuel.params.noTap && !u.quad.engine.params.compressionIgnition).map((u) => u.id), createRandom(this.farmSeed ^ 0x5d1f));
    registerTuning('Dripping carb', this.carbDrip.p, DRIP_PARAM_RANGES);
    this.dripPatches = new Map(); // quad id -> the dark patch on the ground where it dripped
    // The water-cooled ones' coolant leaks, and some have a thermostat stuck shut (engine/coolant.js): how fast and how full it starts are picked from the seed, on their own stream.
    this.coolantPatches = new Map(); // quad id -> the damp patch under a leaking radiator
    const coolantRandom = createRandom(this.farmSeed ^ 0x2b6d);
    for (const u of this.units) {
      if (!u.engine.params.waterCooled) continue;
      const pick = pickLeak(coolantRandom, u.engine.params);
      u.engine.coolantLeak = pick.leak;
      u.engine.coolant = pick.level;
      u.engine.thermostat = pickThermostat(coolantRandom, u.engine.params);
      console.info(pick.leak > 0 ? `${u.name}: leaking coolant, ${levelText(pick.level)} (${pick.level.toFixed(2)}) at ${pick.leak.toFixed(2)} times the usual rate` : `${u.name}: coolant fine this game`);
    }
    this.wearGearbox();
    this.restoreVehicles();
    this.world.wear.laneFromJSON(this.farm.save?.lane, this.farmParams.laneKept); // the green lane's ruts, half dried out overnight
    this.logStart();
    this.updateSmokeScale();
    // This game's weather, picked after everything else so a seed keeps its layout (?weather=rain forces one).
    const forced = new URLSearchParams(location.search).get('weather');
    const kind = forced ?? pickWeatherKind(random, weatherWeights(this.season));
    const forcedTemp = new URLSearchParams(location.search).get('temp'); // ?temp=-3 forces the day's temperature in degrees C
    // The picked temperature is the day's warmest; ?temp= sets it as it is when the game starts.
    const celsius = forcedTemp !== null && forcedTemp !== '' && Number.isFinite(+forcedTemp) ? this.daylight.peakFor(+forcedTemp) : pickTemperature(kind, createRandom(this.seed ^ 0x7e3b), temperatureBandWeights(this.season));
    this.weather = new Weather(kind, random, celsius);
    this.weather.season = this.season; // for the girls' remark on the time of year (companionVoice.watchWeather)
    this.weather.groundWet = groundFor(this.season).wet; // the ground never dries below the season's damp: winter's mud, spring's soft going
    this.weather.wet = Math.max(this.weather.wet, this.weather.groundWet);
    this.world.dustParams.seasonDust = groundFor(this.season).dust;
    this.weather.temperature = Math.round(this.daylight.temperature(celsius) * 10) / 10;
    // Whether the day turns to something else, and what the barn's forecast board says about it (world/forecast.js); a forced weather stays put.
    this.forecastParams = { ...DEFAULT_FORECAST_PARAMS };
    this.forecastRandom = createRandom(this.seed ^ 0x2c9d);
    this.forecast = new Forecast(kind, this.daylight.hour, this.forecastRandom, this.forecastParams, { frozen: forced !== null });
    this.weather.promise = this.forecast.promise();
    // The day's wind: which way it blows and its gusts (world/wind.js), dealt from the game's seed like the weather.
    const windRandom = createRandom(this.seed ^ 0x817d);
    this.wind = new Wind(windRandom, pickHeading(windRandom), { ...DEFAULT_WIND_PARAMS });
    this.wind.update(0, this.weather.wind);
    this.world.daylight = this.daylight;
    for (const unit of this.units) unit.quad.seatFrost = this.weather.seatFrost;
    for (const unit of this.units) {
      const q = unit.quad;
      if (q.engine.params.compressionIgnition) q.fuel.wax = dealWax(this.dieselWaxRandom, this.weather.temperature, !!this.world.covered?.(q.position.x, q.position.z), this.dieselWaxParams);
    }
    for (const unit of this.units) unit.quad.iceCable.deal(this.frozenCableRandom, this.weather.frost, !!this.world.covered?.(unit.quad.position.x, unit.quad.position.z));
    this.world.setWeather(this.weather);
    this.rain = new Rain(this.scene);
    this.thunderParams = { ...DEFAULT_THUNDER_PARAMS }; // lightning and thunder in a storm (world/thunder.js)
    this.thunder = new Thunderstorm(this.thunderParams, createRandom(this.seed ^ 0x7d1f));
    this.flashWhite = new THREE.Color(0xdfe8ff);
    this.snow = new Snow(this.scene);
    // Leaves coming down under the trees, and Jess's conkers (world/autumn.js, npc/conkers.js): only on an autumn day.
    this.autumnParams = { ...DEFAULT_AUTUMN_PARAMS };
    this.leafFall = new LeafFall(this.scene);
    this.conkers = new Conkers(this.autumnParams, createRandom(this.farmSeed ^ 0xc0c4));
    this.conkerAudio = new ConkerAudio(this.audioHub);
    this.splitAudio = new SplitAudio(this.audioHub);
    this.conkerMesh = null; // the conker in the air, made when the first one is thrown
    // Smoke hanging over the yard on a still day (world/haze.js, effects/hazeLayer.js).
    this.haze = new Haze(this.world.layout.yard);
    this.hazeLayer = new HazeLayer(this.scene, this.world.layout.yard, this.world.layout.yard.radius, createRandom(this.seed ^ 0x4a2e));
    // Fumes under the barn roof from engines run indoors (world/barnFumes.js); the same blobs, smaller and higher.
    this.barnFumes = new BarnFumes();
    const bs = barnShape(this.world.layout);
    this.barnFumesLayer = new HazeLayer(this.scene, { x: bs.x, z: bs.z }, 2.8, createRandom(this.seed ^ 0x51c3), { size: [3.5, 3], height: [2.6, 2.2], wander: 0.8 });
    // Mist lying in the north field's hollow on a cool morning, and a rainbow after a shower with the sun out (world/mist.js).
    const hollow = this.world.layout.stubbleFields.north.hollow;
    this.mist = new Mist(Mist.drawDew(createRandom(this.seed ^ 0x3d1e7)));
    this.mistLayer = new HazeLayer(this.scene, hollow, Math.min(hollow.rx, hollow.rz) * 1.1, createRandom(this.seed ^ 0x6b2c), {
      size: [10, 9], height: [0.2, 1.3], wander: 3, count: 26, spread: [hollow.rx / (hollow.rz * 1.1), 1],
    });
    this.rainbow = new Rainbow();
    this.rainbowView = new RainbowView(this.scene);
    console.info(`Date: ${this.date.dom} ${this.date.monthName}, ${this.season}. Time: ${this.daylight.text()}, falling ${this.daylight.drop.toFixed(1)} °C into the night. Weather: ${this.weather.name}, ${this.weather.temperature} °C (${this.weather.band}), chill ${this.weather.chill.toFixed(2)}, frost ${this.weather.frost.toFixed(2)} (add ?temp=<degrees> to the URL to force it)`);
    // She starts beside a random quad in the yard; the player starts facing it.
    this.homeUnit = this.units[home];
    this.lastUnit = this.homeUnit;

    // The companions (src/npc/characters.js), each starting beside her own quad in the yard.
    const yard = this.girlUnits.filter((u, i) => u !== this.homeUnit && spawns[i].where === spawns[home].where);
    const homes = [this.homeUnit, ...yard, ...this.girlUnits.filter((u) => u !== this.homeUnit && !yard.includes(u))];
    const floor = { left: 0, banter: false }; // so one waits for the other to finish before chattering, and both for a bicker
    this.talkFloor = floor;
    // A game without the girls (npc/leftOut.js): nobody is built, and with autonomy off nothing waits on them to start.
    const leftOut = girlsLeftOut(location.search);
    if (leftOut) this.girlsAuto = false;
    this.companions = (leftOut ? [] : CHARACTERS).map((character, i) => {
      const c = new Companion({
        scene: this.scene,
        physics: this.physics,
        RAPIER: this.RAPIER,
        world: this.world,
        quad: homes[i % homes.length].quad,
        gltf: this.models.companion,
        params: { ...DEFAULT_COMPANION_PARAMS, ...character.params },
        name: character.name,
      });
      c.character = character;
      c.opinion.girl = character.id; // her hunches are her own (npc/quadOpinion.js)
      c.agenda = new Agenda(character.agendaOdds, c.params);
      c.quads = this.girlUnits.map((u) => u.quad);
      c.others = () => this.companions.filter((o) => o !== c);
      c.trailers = () => [this.trailer, this.tipTrailer, this.sprayer]; // obstacles on foot and on wheels (vehicle/trailerObstacle.js)
      c.followTarget = () => this.riddenUnit?.quad ?? null;
      c.sounds = new CompanionSounds(this.audioHub, { voiceBank: character.voiceBank, rate: character.soundRate });
      c.voice = new CompanionVoice({
        companion: c,
        speech: new Speech(),
        sounds: c.sounds,
        hud: this.hud,
        params: c.params,
        soundParams: this.audioHub.params,
        lines: character.lines,
        name: CHARACTERS.length > 1 ? character.name : null,
        floor,
      });
      this.interaction.add({
        target: c.proxy,
        // While she's driving you can call her over from further away.
        range: () => (c.fsm.is('driving') ? c.params.driveTalkRange : undefined),
        // A person, not a thing: Enter talks to her (E is for things), from the ground, the seat or the back.
        person: c,
        prompt: () => ({ action: `Talk to ${c.name}`, key: 'Enter' }),
        // Sat up on the tractor, she's inside its big get-on box, so she has to win over it to be asked down.
        get priority() {
          return c.fsm.is('onTrailer') ? 1 : 0;
        },
        feedback: 'own',
        interact: () => this.openCompanionMenu(c),
      });
      return c;
    });

    // Who you favour: each girl keeps a quiet score of how you treat her (npc/favour.js), shown in the tuning panel.
    this.favour = new Favour(CHARACTERS.map((ch) => ch.id));
    for (const c of this.companions) {
      const id = c.character.id;
      // What holds both girls at once (npc/availability.js): nobody starts anything while you're in a menu or the diesel job is on.
      c.worldHold = () => (this.menu.isOpen ? 'you have a menu open' : this.dieselJob ? 'the red diesel job is on' : null);
      c.favourView = () => ({ mood: this.favour.mood(id), warmth: this.favour.warmth(id), sulk: this.favour.sulkDrive(id), standing: this.favour.standing(id) });
    }

    // The girls falling out with each other (npc/fallingOut.js): friction from races, borrowed quads and digs.
    this.fallingOut = new FallingOut(CHARACTERS.map((ch) => ch.id));
    this.fallingOutEvents = []; // banter moments waiting to be raised: fellOut, madeUp
    this.fallingOutApartAt = {}; // girl id -> clock when she was last sent off from her friend
    this.makeUp = new MakeUp(); // the first move towards making up: a mug of tea or her quad (npc/makeUp.js)
    for (const c of this.companions) c.fallenOut = () => this.fallingOut.active;
    // A girl who likes you a lot asks you round the back of the barn, then onto her favourite quad (npc/romance.js).
    this.romance = new Romance(CHARACTERS.map((ch) => ch.id));
    this.tryst = null; // the scene while it plays: { scene: Tryst, girl }
    this.sharedQuad = null; // the quad you're on with the girl you're locked in with, to catch the moment you tip it
    this.sharedFor = 0;
    this.sharedTipped = false;

    // What each girl is good at, and coaching her from the back (npc/skills.js); her driving reads the live levels.
    this.skills = new Skills(CHARACTERS.map((ch) => ch.id));
    for (const c of this.companions) {
      const id = c.character.id;
      c.skillLevels = this.skills.levels[id];
      c.skillMomentWindow = () => this.skills.p.momentWindow;
      c.onPractice = (skill) => {
        this.skills.practice(id, skill);
        c.voice.onPractice(skill);
      };
    }

    // Showing her how (npc/watching.js): she's asked to watch, and learns it if she was looking when you did it.
    this.watching = new Watching();

    // Places to be: sitting on the bales or fence on a fine day, in the barn doorway when it rains (npc/places.js).
    this.places = new Places();
    this.restSpots = [
      ...this.world.layout.restSpots,
      // Inside the barn, sat on the bales out of the rain, facing the doors.
      ...(this.world.layout.barnBaleSpots ?? []).map(([x, z, yaw], i) => ({ id: `barnBale${i}`, kind: 'shelter', x, z, yaw, seat: this.world.layout.baleSeat })),
      ...this.world.layout.strawBaleSpots
        .filter(([x, z]) => this.world.track.distanceTo(x, z, 10) >= this.world.layout.trackHalfWidth + 3)
        .map(([x, z, yaw], i) => ({ id: `bale${i}`, kind: 'bale', x, z, yaw, seat: this.world.layout.baleSeat })),
      // The village pub's picnic tables: a bench each side, facing across the table (the north bench looks south to the road).
      ...(this.world.layout.village?.pub.benches ?? []).flatMap((t, i) => [
        { id: `pubBench${i}n`, kind: 'bench', x: t.x, z: t.z - 0.62, yaw: 0, seat: 0.52 },
        { id: `pubBench${i}s`, kind: 'bench', x: t.x, z: t.z + 0.62, yaw: Math.PI, seat: 0.52 },
      ]),
    ];
    // The hayloft: she climbs the ladder (the points she passes through are heights above the barn floor) and sits on a bale at its edge.
    this.loftParams = { ...DEFAULT_LOFT_PARAMS };
    this.loft = this.world.props.barn.loft;
    // The clock and weather station on the barn wall (world/weatherStation.js).
    const ws = this.world.layout.weatherStation;
    this.station = new WeatherStation(this.scene, { x: ws.x, y: this.world.props.barn.floorY + ws.y, z: barnShape(this.world.layout).inner.minZ });
    const L0 = this.world.layout;
    this.loftSpot = {
      ...L0.loft.seat,
      stand: { x: this.loft.ladderFoot.x, z: this.loft.ladderFoot.z },
      via: [
        { x: this.loft.ladderTop.x, z: this.loft.ladderTop.z, rise: L0.loft.floor },
        { x: L0.loft.seat.x + 0.1, z: L0.loft.seat.z + 1.8, rise: L0.loft.floor },
      ],
      climbSeconds: 4,
    };
    this.restSpots.push(this.loftSpot);
    this.hiding = new Hiding(this.loftParams);
    this.strawDrop = new StrawDrop(this.loftParams);
    this.strawFall = new StrawFall(this.scene);
    // The hay door's shutter bangs about in a gale, and loose hay blows out of the door (updateWind).
    this.hayBlow = new StrawFall(this.scene);
    this.shutter = new Shutter(this.wind.p);
    this.shutterBangCool = 0;
    this.doorAudio = new DoorAudio(this.audioHub, this.world.props.barn.hayDoor);
    this.climb = null; // Climb of you on the ladder, when you are
    this.hiddenFrom = null; // where you were stood before you ducked into the hay
    const fine = () => isFine(this.weather.name, this.weather.rain, this.places.p);
    const spotTaken = (spot) => this.companions.some((o) => o.currentSpot()?.id === spot.id);
    this.napParams = { ...DEFAULT_NAP_PARAMS }; // asleep on the back of a smooth ride (npc/backNap.js); made before the companions are wired to it
    this.blinkParams = { ...DEFAULT_BLINK_PARAMS }; // her blinking (npc/blink.js)
    this.faceParams = { ...DEFAULT_FACE_PARAMS }; // her expressions (npc/faceExpression.js)
    for (const c of this.companions) {
      c.blink.p = this.blinkParams;
      c.expression.p = this.faceParams;
      c.restStayFor = () => restStay(this.places.p);
      c.dozeParams = this.places.p;
      c.nap.p = this.napParams;
      c.dozeSunny = () => fine() && this.sunWarmth() >= this.places.p.dozeSunAbove * 0.6 && (this.daylight?.darkness ?? 0) < this.places.p.darkAbove;
      // Woken rudely: Amy minds (a little favour and a sulk), Jess laughs it off (companion.params.dozeMinds).
      c.onWoken = (how) => {
        if (how !== 'startled' || !c.params.dozeMinds) return;
        this.favour.add(c.character.id, -this.places.p.dozeStartledFavour);
        this.favour.sulk(c.character.id, this.places.p.dozeStartledSulk);
      };
      c.restSpotsNear = (here) => {
        if (!fine()) return [];
        const free = this.restSpots.filter((s) => s.kind !== 'shelter' && !spotTaken(s));
        const loftFree = !spotTaken(this.loftSpot) && Math.hypot(this.loftSpot.x - here.x, this.loftSpot.z - here.z) < this.places.p.restFrom;
        if (loftFree && Math.random() < this.loftParams.girlLoftChance) return [this.loftSpot];
        const near = nearestSpot(free, ['bale', 'fence', 'bench'], here, new Set(), this.places.p.restFrom);
        return near ? [near] : [];
      };
    }

    // Favours the girls ask of you: wash her quad, take her to the bales, fetch the can (npc/requests.js).
    this.requests = new Requests();
    this.pubParams = { ...DEFAULT_PUB_PARAMS };
    this.pubVisit = new PubVisit(this.pubParams);
    const baleSpots = this.world.layout.strawBaleSpots.filter(([x, z]) => this.world.track.distanceTo(x, z, 10) >= this.world.layout.trackHalfWidth + 3);
    this.bales = baleSpots.map(([x, z]) => ({ x, z }));

    // Pranks: Jess meddles with a quad's tap or choke, Amy hides the can or toolbox while you're away (npc/pranks.js).
    this.pranks = new Pranks();
    // Rev-offs: blip the throttle near a girl sat on a running quad and she may blip back (npc/revOff.js).
    this.revOff = new RevOff();
    // Jess revving over Amy mid-sentence until Amy switches it off (npc/drownOut.js).
    this.drownOut = new DrownOut();
    // Horns: your beep (L) and the girls' answers and Jess's creep-up (npc/horns.js).
    this.horns = new Horns();
    // What they say about the tractor: the key that doesn't stop it, waiting for the glow plugs, it catching (npc/tractorWatch.js).
    this.tractorWatch = new TractorWatch(undefined, createRandom(this.seed ^ 0x7a7c));
    // What they say at the river's crossing and when the deep water drowns your engine (npc/riverWatch.js).
    this.riverWatch = new RiverWatch(undefined, createRandom(this.seed ^ 0x61e5));
    // And at the gravel pit: when you come to its lip, and when your engine stops down in it (npc/quarryWatch.js).
    this.quarryWatch = new QuarryWatch(undefined, createRandom(this.seed ^ 0x9a17));
    // The tractor creeping off on its own, and the girl who runs after it (npc/tractorRunaway.js, vehicle/creep.js).
    this.tractorRunaway = new TractorRunaway(undefined, createRandom(this.seed ^ 0x7c4e));
    this.runawayJob = null; // { girl, time }: she's running after it
    // The bale trailer in the yard, and the girls riding on it (vehicle/hayTrailer.js, npc/hayRide.js, npc/companionHayRide.js).
    this.trailer = new HayTrailer({ scene: this.scene, world: this.world });
    const tl = this.world.layout.trailer;
    this.trailer.addObstacle(this.physics, this.RAPIER);
    this.trailer.place(tl.x, tl.z, tl.yaw);
    this.hayRide = new HayRide(undefined, createRandom(this.seed ^ 0x4a71));
    this.haySeat = { ...DEFAULT_HAYSEAT_PARAMS };
    for (const c of this.companions) c.hay = this.haySeat;
    // How they get on and off things, and stand about (npc/companionMoves.js, npc/poseMoves.js): one set for both.
    this.moveParams = { ...DEFAULT_MOVE_PARAMS };
    this.idlePoseParams = { ...DEFAULT_IDLE_POSE_PARAMS };
    this.waitingParams = { ...DEFAULT_WAITING_PARAMS };
    for (const c of this.companions) Object.assign(c, { moveParams: this.moveParams, idlePoseParams: this.idlePoseParams, waitingParams: this.waitingParams });
    // A girl on the tractor's wheel arch (npc/mudguardRide.js, vehicle/tractorMount.js); the tractor is built above.
    this.mudguard = new MudguardRide(undefined, createRandom(this.seed ^ 0x3d6a));
    this.tractorMount = this.tractorUnit ? new TractorMount(this.tractorUnit.quad, (x, z) => this.world.heightAt(x, z)) : null;
    // The UTV's tipping bed, and the girls in its seats and bed (vehicle/utvBed.js, npc/utvRide.js, vehicle/utvMount.js).
    this.utvBed = new UtvBed();
    registerTuning('Yak bed', this.utvBed.p, UTV_BED_PARAM_RANGES);
    this.utvRide = new UtvRide(undefined, createRandom(this.seed ^ 0x07c9));
    registerTuning('Yak riders', this.utvRide.p, UTV_RIDE_PARAM_RANGES);
    this.utvMount = this.utvUnit ? new UtvMount(this.utvUnit.quad, (x, z) => this.world.heightAt(x, z)) : null;
    if (this.utvUnit) this.addUtvCargo(this.utvUnit.quad);
    this.utvPetrolSaid = false; // the girls have remarked on it running badly on petrol
    // The Land Rovers' benches: the same riding as the UTV's, with no bed to ride in (vehicle/utvMount.js, npc/utvRide.js).
    for (const l of Object.values(this.landys)) {
      const series = l.kind === 'landy';
      // The 200TDi has a back bench too (LANDY_REAR_SEATS): the girls take it when the front's full, or now and then by choice. The cars
      // have two seats in front and two behind (CARS), reached past a tipped front seat as the 200TDi's are.
      const rear = l.car ? CARS[l.kind].rear : series ? {} : LANDY_REAR_SEATS;
      const seed = { landy: 0x1a4d, defender: 0x1a5d, fiesta: 0x1a6d, corsa: 0x1a7d, p309: 0x1a8d }[l.kind];
      l.ride = new UtvRide({ ...DEFAULT_UTV_RIDE_PARAMS, jessBedChance: 0, amyBedChance: 0, jessBedLoseChance: 0, amyBedLoseChance: 0 }, createRandom(this.seed ^ seed), { rear: Object.keys(rear), front: l.car ? ['left'] : undefined });
      if (l.kind === 'landy') registerTuning('Tor riders', l.ride.p, UTV_RIDE_PARAM_RANGES);
      else if (l.kind === 'defender') registerTuning('Crag riders', l.ride.p, UTV_RIDE_PARAM_RANGES);
      else if (l.kind === 'fiesta') registerTuning('Finch riders', l.ride.p, UTV_RIDE_PARAM_RANGES);
      else if (l.kind === 'p309') registerTuning('Vauclair riders', l.ride.p, UTV_RIDE_PARAM_RANGES);
      else registerTuning('Griffin riders', l.ride.p, UTV_RIDE_PARAM_RANGES);
      l.mount = l.unit ? new UtvMount(l.unit.quad, (x, z) => this.world.heightAt(x, z), l.car ? CAR_STAND : { ...LANDY_STAND, ...LANDY_REAR_STAND }, rear, { driver: !!l.car }) : null;
      if (l.unit) l.unit.quad.tipHold = { left: 0, driver: 0 }; // seconds a backrest stays tipped after you climb past it
      if (l.unit && series) this.addLandyCargo(l);
      else if (l.unit && l.kind === 'corsa') registerTuning('Griffin hatch', (l.unit.quad.tailgate ??= new Tailgate()).p, TAILGATE_PARAM_RANGES); // T lifts its hatch
      else if (l.unit && l.kind === 'fiesta') registerTuning('Finch hatch', (l.unit.quad.tailgate ??= new Tailgate()).p, TAILGATE_PARAM_RANGES); // T lifts its hatch
      else if (l.unit && l.kind === 'p309') registerTuning('Vauclair hatch', (l.unit.quad.tailgate ??= new Tailgate()).p, TAILGATE_PARAM_RANGES); // T lifts its hatch
      else if (l.unit && l.kind === 'defender') registerTuning('Crag back door', (l.unit.quad.tailgate ??= new Tailgate()).p, TAILGATE_PARAM_RANGES); // T swings its back door out
    }
    this.rearAccess = { ...DEFAULT_REAR_ACCESS_PARAMS };
    registerTuning('Crag back seats', this.rearAccess, REAR_ACCESS_PARAM_RANGES);
    // The little tipping trailer behind any quad with a rack (or the tractor), and the girl who rides in it (vehicle/tipTrailer.js, npc/trailerRide.js).
    this.tipTrailer = new TipTrailer({ scene: this.scene, world: this.world });
    // The trailers' wear and the mud on them, settable like a vehicle's.
    registerTuning('Bale trailer wear', this.trailer.coat.coat.look, WEAR_LOOK_RANGES);
    registerTuning('Bale trailer mud', this.trailer.coat.state, MUD_STATE_RANGES);
    registerTuning('Tipping trailer wear', this.tipTrailer.coat.coat.look, WEAR_LOOK_RANGES);
    registerTuning('Tipping trailer mud', this.tipTrailer.coat.state, MUD_STATE_RANGES);
    const tt = this.world.layout.tipTrailer;
    this.tipTrailer.addObstacle(this.physics, this.RAPIER);
    this.tipTrailer.place(tt.x, tt.z, tt.yaw);
    this.tipRide = new TrailerRide(undefined, createRandom(this.seed ^ 0x71b7));
    this.towParams = { ...DEFAULT_TOW_PARAMS };
    this.tipPuller = null; // the Quad whose drive and brakes the trailer is taking from
    registerTuning('Tipping trailer', this.tipTrailer.p, TIP_TRAILER_PARAM_RANGES);
    registerTuning('Trailer tub', this.tipTrailer.bed.p, UTV_BED_PARAM_RANGES);
    registerTuning('Trailer riders', this.tipRide.p, TRAILER_RIDE_PARAM_RANGES);
    registerTuning('Towing', this.towParams, TOW_PARAM_RANGES);
    this.mirrorParams = { ...DEFAULT_MIRROR_PARAMS };
    this.mirrorViews = new Map(); // unit -> its MirrorView, made the first time you drive it
    this.mirrorFrame = 0;
    registerTuning('Mirrors', this.mirrorParams, MIRROR_PARAM_RANGES);
    // The field sprayer behind a quad with a rack (vehicle/sprayerTrailer.js; the job is world/spraying.js).
    this.sprayer = new SprayerTrailer({ scene: this.scene, world: this.world });
    registerTuning('Sprayer trailer wear', this.sprayer.coat.coat.look, WEAR_LOOK_RANGES);
    registerTuning('Sprayer trailer mud', this.sprayer.coat.state, MUD_STATE_RANGES);
    const sprayerAt = this.world.layout.sprayer;
    this.sprayer.addObstacle(this.physics, this.RAPIER);
    this.sprayer.place(sprayerAt.x, sprayerAt.z, sprayerAt.yaw);
    this.sprayPuller = null; // the Quad whose drive and brakes the sprayer is taking from
    registerTuning('Sprayer trailer', this.sprayer.p, SPRAYER_PARAM_RANGES);
    this.interaction.add({
      target: this.tipTrailer.proxy,
      priority: -1, // a can or the toolbox standing in the tub wins when you look at it
      isAvailable: () => !!this.heldLoad() || (!this.handsFull && !this.player.isRiding),
      prompt: () => this.tipTrailerPrompt(),
      feedback: 'putDown',
      interact: () => this.loadTipTrailer(),
      hold: (dt) => this.forkMuck(dt),
    });    // Having a go on the tractor: Jess takes it, Amy won't until her day (npc/tractorGo.js). The girls' own numbers are shared objects.
    this.tractorGo = new TractorGo(undefined, createRandom(this.seed ^ 0x70c0));
    this.tractorDrive = { ...DEFAULT_TRACTOR_GO_DRIVE };
    this.tractorStartParams = { ...DEFAULT_TRACTOR_START_PARAMS };
    this.noviceParams = { ...DEFAULT_NOVICE_PARAMS };
    this.utvDrive = { ...DEFAULT_UTV_GO_DRIVE }; // and the same for the UTV and the Land Rover (the same ranges)
    this.landyDrive = { ...DEFAULT_LANDY_GO_DRIVE };
    // The girls' own cars: each takes hers down the road now and then, and minds if you take it (npc/carGo.js).
    this.carGo = new CarGo(undefined, createRandom(this.seed ^ 0x0ca9));
    this.borrowing = Object.fromEntries(CAR_KINDS.map((k) => [k, new Borrowing(this.carGo.p)]));
    this.crankParams = { ...DEFAULT_CRANK_ATTEMPT_PARAMS };
    this.pushParams = { ...DEFAULT_PUSH_PARAMS };
    this.towSteerParams = { ...DEFAULT_TOW_STEER_PARAMS }; // a girl steering a dead quad on the tow rope (npc/towSteer.js)
    this.strandedParams = { ...DEFAULT_STRANDED_PARAMS }; // a girl stuck out in the field, calling you (npc/stranded.js)
    this.keepParams = { ...DEFAULT_KEEPALIVE_PARAMS }; // keeping a sick one alive from the back (npc/keepAlive.js), shared by both girls
    this.goJoins = []; // the other girl on her way to climb in beside a driver: { left, girl, kind, driver }
    for (const c of this.companions) Object.assign(c, { tractorGo: this.tractorDrive, utvGo: this.utvDrive, landyGo: this.landyDrive, carGo: this.carGo, crankParams: this.crankParams, pushParams: this.pushParams, towSteerParams: this.towSteerParams, strandedParams: this.strandedParams, strandedHost: (c, e) => this.onStranded(c, e), keepParams: this.keepParams, numbShared: this.numbParams, tractorStartParams: this.tractorStartParams, noviceParams: this.noviceParams });
    // Jess tapes L plates to Amy's quad; Amy peels them off, and once she's confident they go on the tractor (npc/lPlates.js).
    this.lPlates = new LPlates(undefined, createRandom(this.seed ^ 0x1b1a));
    this.lPlateSet = new LPlateSet();
    this.tractorSeen = {}; // girl id -> what we've already noticed about her go, for her lines
    this.hayLater = []; // lines to say in a moment: { left, girl, key }
    this.itemHome = {}; // where a hidden item was taken from, by name

    // What they call the quads, whose is whose, and placing a quad by ear (npc/quadNames.js, ownership.js, earing.js).
    this.quadNames = new QuadNames(this.girlUnits.map((u) => u.spec.id), { random: createRandom(this.farmSeed ^ 0x6a3e) });
    this.ownership = new Ownership(undefined, createRandom(this.farmSeed ^ 0x0c1a));
    this.quadCare = new QuadCare(this.companions.map((c) => c.character.id)); // how much each girl cares about her quad (npc/quadCare.js)
    this.hearing = new Hearing();
    this.lessons = new Lessons(); // a girl on the back teaching you to drive a manual (npc/lessons.js)
    this.pillionCoach = new PillionCoach(); // the girl on the back coaching the girl driving (npc/pillionCoach.js)
    this.throttleGrab = new ThrottleGrab(); // a girl on the back opening it over your hand (npc/throttleGrab.js)
    this.smokeSense = new SmokeSense(); // Amy coughs at two-stroke smoke, Jess loves it (npc/smokeSense.js)
    // Racing: the girls race a lap of the track from a start line by the yard (npc/race.js).
    this.faultShout = new FaultShout(); // a girl behind or beside you shouts what she can see wrong with your quad (npc/shoutFault.js)
    this.dashReader = new DashReader(); // the girl on the back reads the dash out (npc/dashReading.js)
    this.doughnutWatch = new DoughnutWatch(); // Amy watches Jess's doughnuts and has a go (npc/doughnuts.js)
    for (const c of this.companions) c.doughnutParams = this.doughnutWatch.p;
    this.tarmacWatch = new TarmacWatch(); // the girls ride faster on the farm road; Jess eggs you on, Amy scolds the squealing (npc/tarmac.js)
    for (const c of this.companions) c.tarmacParams = this.tarmacWatch.p;
    this.outingParams = { ...DEFAULT_OUTING_PARAMS }; // her drives that go somewhere (npc/outings.js)
    for (const c of this.companions) c.outingParams = this.outingParams;
    for (const c of this.companions) c.outingSpots = () => outingSpots(this.world.layout, this.world.fields.hill?.waitSpot, stripPoint);
    this.sightParams = { ...DEFAULT_SIGHT_PARAMS }; // what she takes you to see when you're on the back (npc/sights.js)
    for (const c of this.companions) {
      c.sightParams = this.sightParams;
      c.sightsNow = () => this.sightsFor(c);
    }
    this.viewForward = new THREE.Vector3(); // which way your eyes point, for the girls showing off (npc/showOff.js)
    this.showOffParams = { ...DEFAULT_SHOWOFF_PARAMS };
    for (const c of this.companions) c.showOffParams = this.showOffParams;
    this.jumpWatch = new JumpWatch(); // the girls take turns at the ramp and rate each other's landings (npc/jumps.js)
    for (const c of this.companions) {
      c.jumpParams = this.jumpWatch.p;
      c.jumpClear = (ramp, jp) => this.jumpLineClear(c, ramp, jp);
    }
    this.lineUpParams = { ...DEFAULT_LINEUP_PARAMS }; // the row in front of the barn (npc/lineUp.js)
    for (const c of this.companions) c.lineUpParams = this.lineUpParams;
    for (const c of this.companions) {
      c.walkParams = this.walkParams;
      c.knows = new FaultKnowledge(Math.random, this.wontParams);
      c.motoParams = this.motoParams;
      c.thrownParams = this.thrownParams;
    }
    this.homeParams = { ...DEFAULT_HOME_PARAMS }; // bringing a quad back near the barn when done, and jogging (npc/homeParking.js)
    for (const c of this.companions) c.homeParams = this.homeParams;
    this.tea = new Tea(); // tea left on the rear rack (npc/tea.js)
    this.dieselMistake = new DieselMistake(); // Jess pours red diesel into a quad (npc/dieselMistake.js)
    this.dieselJob = null; // her pouring: { spec, left }
    this.mugs = new Mugs(this.scene, (x, z) => this.world.heightAt(x, z), this.tea.p.stainFor);
    this.teaMugs = {}; // girl id -> the mug on a rack
    this.loose = { p: { ...DEFAULT_LOOSE_PARAMS } }; // how a shaking vehicle walks its loose things about (vehicle/looseThings.js)
    this.flask = new Flask(undefined, createRandom(this.seed ^ 0x6f1a)); // tea from a flask on the rock at the top of the hill (npc/flask.js)
    this.flaskSet = null; // the flask and two mugs out on the ground by the rock: a Group
    this.setupFlask();
    // Jumpers from the barn rail on cold or wet days (npc/jumpers.js), in colours this farm dealt.
    this.jumpers = new Jumpers(undefined, Math.random, dealJumperColours(createRandom(this.farmSeed ^ 0x1e57)));
    // Wax jackets at the far end of the same rack, for the rain (npc/coats.js), in this farm's colours too.
    this.coats = new Coats(undefined, Math.random, dealCoatColours(createRandom(this.farmSeed ^ 0xc0a7)));
    this.jumperRail = new JumperRail(this.scene, this.world.layout, (x, z) => this.world.heightAt(x, z), this.jumpers.list, this.coats.list);
    // Helmets and goggles from the hooks by the barn's south wall (npc/headgear.js): yours, and one on each girl's head when she wears hers.
    this.headgear = new Headgear(undefined, createRandom(this.seed ^ 0x4e1a));
    this.helmetHooks = new HelmetHooks(this.scene, this.world.layout, (x, z) => this.world.heightAt(x, z));
    this.helmetView = new HelmetView(this.scene, (x, z) => this.world.heightAt(x, z));
    for (const c of this.companions) {
      this.helmetView.dress(c);
      this.headgear.girl(c.character.id); // hers start on the hooks
    }
    this.helmetHooks.show(this.headgear.onHooks());
    this.helmetSeen = {}; // girl id -> where her loose helmet was last drawn, so it is only moved when it changes
    this.gogglesOverlay = new GogglesOverlay();
    this.convoy = new Convoy(); // follow the leader, swapping places (npc/convoy.js)
    this.convoyIdle = {};
    this.race = new Race();
    this.raceIdle = {}; // seconds each racer has been doing nothing about it
    this.asking = null; // you asking for a race, drag run or climb, until they set off or run out of time (askGirls, npc/asking.js)
    this.lastAsk = null; // why the last ask came to nothing, in words, for the panel
    this.raceStart = nearestTrackFraction(this.world.track, this.world.layout.yard.x, this.world.layout.yard.z);
    buildStartLine(this.scene, (x, z) => this.world.heightAt(x, z), this.world.track, this.raceStart, this.world.layout.trackHalfWidth);
    this.drag = new Drag(); // a drag race down the straight, against one girl (npc/drag.js)
    this.dragIdle = 0; // seconds the girl racing you has been doing nothing about it
    this.dragBlipSaid = false;
    buildDragStrip(this.scene, (x, z) => this.world.heightAt(x, z), this.world.layout.dragStrip);
    this.records = new Records(this.farm.day); // the bests, kept from day to day, on the barn's chalkboard (world/records.js)
    this.recordParams = { ...DEFAULT_RECORD_PARAMS };
    this.jumpMeasures = new Map(); // quad -> JumpMeasure, for whoever is on it
    this.climbGates = climbGates(this.world.layout.hill.climb);
    this.hillClimb = new HillClimb(this.climbGates, undefined, createRandom(this.seed ^ 0x5c1b)); // timed runs up the hill pasture (npc/hillClimb.js)
    this.climbIdle = 0; // seconds the girl climbing has been doing nothing about it
    buildClimbCones(this.scene, (x, z) => this.world.heightAt(x, z), this.climbGates);
    registerTuning('Hill climb', this.hillClimb.p, CLIMB_PARAM_RANGES);
    // The pit climb: your timed run up the gravel pit's steep wall (world/pitClimb.js), on the board beside the hill climb.
    const quarry = this.world.fields.quarry;
    this.pitGates = quarry ? climbGates(quarry.climb) : null;
    this.pitClimb = quarry ? new PitClimb(this.pitGates) : null;
    if (quarry) {
      buildClimbCones(this.scene, (x, z) => this.world.heightAt(x, z), this.pitGates);
      registerTuning('Pit climb', this.pitClimb.p, PIT_PARAM_RANGES);
    }
    // Amy's cone course (npc/coneCourse.js): the same kind of timed run on the grass, with cones that fall over and penalties for them.
    this.coneGates = coneGates(this.world.layout.coneCourse);
    this.coneCourse = new ConeCourse(this.coneGates, { ...DEFAULT_CONE_PARAMS }, createRandom(this.seed ^ 0x3c0e));
    this.coneField = new ConeField(coneSpots(this.coneGates), this.coneCourse.p);
    this.coneView = buildConeCourse(this.scene, (x, z) => this.world.heightAt(x, z), this.coneField.cones);
    this.coneIdle = 0; // seconds the girl on the course has been doing nothing about it
    this.coneKnocking = false; // the girl running it means to knock the cones (Jess, now and then)
    this.coneProxy = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 3), new THREE.MeshBasicMaterial({ visible: false })); // look at it and press E to stand them up
    this.coneProxy.position.set(this.coneGates[0].x, this.world.heightAt(this.coneGates[0].x, this.coneGates[0].z) + 0.7, this.coneGates[0].z);
    this.scene.add(this.coneProxy);
    registerTuning('Cone course', this.coneCourse.p, CONE_PARAM_RANGES);
    registerTuning('Records', this.recordParams, RECORD_PARAM_RANGES);
    // The challenges on the barn's chalkboard (world/challenges.js): the cold start, the line-up in the yard's painted bays and the clean climb.
    this.challengeParams = { ...DEFAULT_CHALLENGE_PARAMS };
    registerTuning('Challenges', this.challengeParams, CHALLENGE_PARAM_RANGES);
    this.challenges = new Challenges(this.farm.day);
    this.coldRun = new ColdStartRun(this.challengeParams);
    this.cleanWatch = new CleanWatch();
    this.ranToday = new Set(); // ids of the quads whose engine has run since this day began: the rest are cold
    this.lineUpBays = buildLineUpBays(this.scene, (x, z) => this.world.heightAt(x, z), this.world.layout.lineUp);
    this.warming = new Warming(); // hands over an idling engine on a cold day (npc/warming.js)
    this.waveParams = { ...DEFAULT_WAVE_PARAMS }; // you wave at the girls (npc/playerWave.js)
    this.lastWaveAnswer = new Map(); // girl id -> game clock seconds she last answered a wave (wall clock)
    this.readyWaiting = new ReadyWaiting(undefined, createRandom(this.seed ^ 0x2ead)); // sat on a running quad, revving and tooting, while you are a minute (npc/readyWaiting.js)
    this.warmSit = new WarmSit(undefined, createRandom(this.seed ^ 0x3a2f)); // sat on your quad while it warms, for the shake (npc/warmSit.js)
    this.practising = new Practising(undefined, createRandom(this.seed ^ 0x9a17)); // Jess on a parked manual, finding the bite point on her own (npc/practising.js)
    this.practiseQuads = new Map(); // girl id -> the quad she is practising on
    this.numbParams = { ...DEFAULT_NUMB_PARAMS }; // legs gone tingly and a numb bum from a long sit on a shaking seat (npc/numbness.js)
    this.comparing = new ComparingNotes(undefined, createRandom(this.seed ^ 0xc0de)); // the girls ranking the quads by their buzz (npc/comparingNotes.js)
    this.askAlong = new AskAlong(); // asking you along to what she's chosen, and what a no does (npc/askAlong.js)
    this.askGo = {}; // girl id -> { together, alone }: how to carry out what she asked about
    this.pair = new Pair(); // the two as a pair: going over to each other, tagging along, letting you in (npc/pair.js)
    this.generatorStart = new GeneratorStart(); // a girl pulling the generator's cord (npc/generatorStart.js)
    this.workLight = new WorkLight(undefined, createRandom(this.seed ^ 0x11e7)); // bringing a vehicle round to light what you're at, after dark (npc/workLight.js)
    this.trailerGuide = new TrailerGuide(); // Amy walking round behind the trailer and calling the lock when you reverse it (npc/trailerGuide.js)
    this.dontFix = new DontFixIt(); // a girl minding when her favourite is fixed up (npc/dontFixIt.js)
    this.warmSitQuads = new Map(); // girl id -> the quad she is sitting on
    this.readyQuads = new Map(); // girl id -> the quad she is getting ready or waiting on
    this.sulking = new Sulking(undefined, createRandom(this.seed ^ 0x5011)); // a girl sitting alone in a Land Rover after a row (npc/sulking.js)
    this.cabShelter = new CabShelter(undefined, createRandom(this.seed ^ 0x0cab)); // into a Land Rover or the UTV out of the rain or cold (npc/cabShelter.js)
    this.nicking = new Nicking(undefined, createRandom(this.seed ^ 0x61c3)); // Jess taking a quad you left running (npc/nicking.js)
    this.headStart = new HeadStart(undefined, createRandom(this.seed ^ 0x4ead)); // starting your usual quad for you (npc/headStart.js)
    this.gossip = new Gossip(BANTER.filter((e) => e.when === 'gossip'), undefined, createRandom(this.seed ^ 0x6055)); // talking about you (npc/gossip.js)
    const capital = (id) => id[0].toUpperCase() + id.slice(1);
    this.ownership.assign(
      Object.fromEntries(this.companions.map((c) => [c.character.id, this.girlUnits.filter((u) => c.mayRide(u.quad) && c.voice.chatter.lines[`like${capital(u.spec.id)}`]).map((u) => u.spec.id)])),
    );
    // How many of her polo's buttons she has undone, dealt for this farm (so it's the same every day) between her own limits.
    const buttonsRandom = createRandom(this.farmSeed ^ 0x9b07);
    // What each girl has on top today (npc/outfits.js): dealt for this day of this farm, so a day replays the same; a crop-top only
    // on a warm day.
    this.outfitParams = { ...DEFAULT_OUTFIT_PARAMS };
    const outfitRandom = createRandom((this.farmSeed ^ 0x0f17) + this.farm.day * 7919);
    const shirtTieRandom = createRandom((this.farmSeed ^ 0x7e1e) + this.farm.day * 7919); // the shirt and tie's own, so it moved nobody's other outfits
    const ponytailRandom = createRandom((this.farmSeed ^ 0x9a17) + this.farm.day * 7919); // her hair tied back (npc/ponytail.js), its own too
    this.ponytailParams = { ...DEFAULT_PONYTAIL_PARAMS };
    const warm = this.weather.peak > this.outfitParams.warmAbove;
    const forcedOutfit = new URLSearchParams(location.search).get('outfit');
    for (const c of this.companions) {
      const style = dealOutfit(outfitRandom, c.character.outfitOdds ?? { polo: 1 }, {
        warm,
        popped: c.character.poppedChance ?? 0,
        underOpen: c.character.underOpen,
        shirtButtons: c.character.shirtButtons,
        tieLoose: c.character.tieLooseChance ?? 0,
        extra: shirtTieRandom,
        p: this.outfitParams,
      });
      if (outfitsFor(c.character.outfitOdds).includes(forcedOutfit)) style.kind = forcedOutfit; // ?outfit=plaid puts both girls in it, to look at
      Object.assign(style, dealPonytail(ponytailRandom, c.character.ponytailChance ?? 0));
      c.rig.ponytailParams = this.ponytailParams; // the swing's tuning, shared
      c.outfit = { ...c.outfit, poloOpen: dealPoloOpen(c.character.poloOpen, buttonsRandom), style }; // fitted with her shirt just below
    }
    for (const c of this.companions) {
      const id = c.character.id;
      c.claimedSpec = this.ownership.claims[id] ?? null;
      c.voice.favourite = c.claimedSpec; // the one she likes best is the one she says is hers
      const mine = this.girlUnits.find((u) => u.spec.id === c.claimedSpec);
      if (mine) c.setShirt(mine.spec.bodyColor); // and her shirt is its colour, so you can see why
      else c.dress(); // no favourite quad, so no shirt colour to wait for: her clothes are fitted as they are
      c.voice.names = this.quadNames;
      c.borrowPick = (specs) => this.ownership.borrowPick(id, specs);
    }

    // Each quad is dealt its own luck with faults this game, from the seed (vehicle/faults.js).
    this.girlUnits.forEach((u, i) => u.quad.faults.roll(createRandom(this.farmSeed ^ (0xfa17 + i * 7919))));

    for (const unit of this.units) {
      const quad = unit.quad;
      unit.interaction = this.interaction.add({
        unit,
        target: quad.proxy,
        prompt: () => {
          if (quad.loadedOn) return this.loadedPrompt(quad);
          if (unit.barnFind && !unit.barnFind.tarpOff) return { text: `${unit.id === 'plover' ? 'The old bike' : 'The rusty quad'}: an old shape under a tarp   ·   take it off at the workbench` };
          if (this.tooFastToMount(quad) && this.herDriving(quad) && !quad.hasBench) return `Ask ${this.herDriving(quad).name} to stop and let you on`;
          if (this.tooFastToMount(quad)) {
            return { text: `The ${unit.label} is going too fast to get on   ·   K ignition` };
          }
          if (this.leads.held) return this.leads.ends.length ? `Clamp the other end on the ${unit.label}   ·   G put the leads down` : `Clamp the jump leads on the ${unit.label}   ·   G put them down`;
          if (this.leads.ends.includes(quad)) return `Take the jump leads off the ${unit.label}`;
          const winch = this.winch;
          if (winch?.state === 'carried') {
            if (unit === winch.unit) return { info: 'You are holding the winch hook', keys: [['G', 'Put it back']] };
            if (isHeavy(unit.spec)) return `Hook the winch cable on the ${unit.label}: the ${winch.unit.label} will pull itself up to it   ·   G put it back`;
            return `Hook the winch cable on the ${unit.label}${quad.bog.stuck ? ' (it\'s stuck)' : ''}   ·   G put it back`;
          }
          if (winch?.state === 'hooked' && winch.target === quad) return 'Unhook the winch   ·   hold X by the RB300 to wind in';
          const chain = this.chain;
          if (chain?.state === 'carried') {
            if (unit === this.tractorUnit) return { info: 'You are holding the tow chain', keys: [['G', 'Put it back']] };
            return `Hook the tractor's chain on the ${unit.label}${quad.bog.stuck ? ' (it\'s stuck)' : ''}   ·   G put it back`;
          }
          if (chain?.state === 'hooked' && chain.target === quad) return 'Unhook the tow chain';
          const rope = this.towRope;
          if (rope.state === 'carried') {
            if (quad === rope.puller) return { info: 'You are holding the tow rope', keys: [['G', 'Put it back']] };
            return `Hook the tow rope on the ${unit.label}   ·   G put it back`;
          }
          if (rope.state === 'hooked' && rope.target === quad) return 'Unhook the tow rope';
          if (this.hose.held) {
            const muddy = Math.round(Math.max(unit.mud.state.body, unit.mud.state.wheels) * 100);
            return { text: muddy > 0 ? `Hold E to wash the ${unit.label} (${muddy}% muddy)   ·   G put the hose back` : `The ${unit.label} is clean   ·   G put the hose back` };
          }
          if (this.heldBattery()) return this.batteryPrompt(unit);
          if (this.toolbox.held) {
            return this.workshop.prompt(unit);
          }
          if (this.coolantBottle.held) return { action: `Top up the ${unit.label}'s coolant`, hold: true, keys: [['G', 'Put the bottle down']] };
          if (this.antiGelBottle.held) return { action: `Treat the ${unit.label}'s diesel`, hold: true, keys: [['G', 'Put the bottle down']] };
          if (this.can.held) {
            const pct = Math.round(quad.fuel.level * 100);
            if (quad.fuel.space < 0.01) return { text: `The ${unit.label} is full   ·   G put the can down` };
            if (this.can.litres < 0.01) return { text: 'The can is empty   ·   G put the can down' };
            return { text: `Hold E to fill the ${unit.label} (${pct}%) with ${fuelText(this.can.oil, this.can.diesel, this.can.water, this.can.additive)}   ·   G put the can down` };
          }
          if (quad.crank && quad.atCrank && !this.player.isRiding) return { text: this.crankPrompt(quad) };
          if (this.sulkerIn(quad)) return { text: `${this.sulkerIn(quad).name} is sulking in the ${unit.label}   ·   E knock on the window` };
          if (quad.isTipped) return `Right the ${unit.label}`;
          if (this.canRideBench(quad)) return this.lookingAtBack(quad) ? `Get in the back (${this.herAtTheFront(quad).name}'s driving)` : `Get in beside ${this.herAtTheFront(quad).name} (she's driving)`;
          if (quad.hasBench && this.herAtTheFront(quad) && !quad.passenger && !this.benchSeatFor(quad)) return { text: `${this.herAtTheFront(quad).name}'s driving and the bench is full` };
          if (this.herAtTheFront(quad) && quad.hasPillion && !quad.passenger && this.herOnBack(quad)) return { text: `${this.herAtTheFront(quad).name}'s driving and ${this.herOnBack(quad).name}'s on the back: no room` };
          if (this.herAtTheFront(quad) && quad.hasPillion && !quad.passenger) return `Get on the back (${this.herAtTheFront(quad).name}'s driving)`;
          if (this.canSitOnBack(quad) && this.lookingAtPassengerSeat(quad)) return `Sit ${quad.hasBench ? (this.lookingAtBack(quad) ? 'in the back' : 'in the passenger seat') : 'on the back'} of the ${unit.label}`;
          return {
            action: `Ride the ${unit.label}`,
            keys: [
              ...(quad.tractor
                ? [['K', 'Key'], ['R', 'Start'], ['Q Z', 'Hand throttle'], ['O', 'Stop knob'], ['Y', 'Dipstick']]
                : unit.spec.utv
                  ? [['K', 'Key'], ['R', 'Start'], ['T', 'Tip the bed'], ['Y', 'Dipstick']] // the reverse lever is on the dash: only from the seat
                  : unit.spec.landRover
                    ? [['K', 'Key'], ['R', 'Start'], ...(unit.spec.defender ? [] : [['Q Z', 'Choke'], ['[ ]', 'Hand throttle']]), ['Y', 'Dipstick'], ...(unit.spec.defender ? [] : [['P', 'Starting handle (at the front)']])]
                  : unit.spec.car
                    ? [['K', unit.spec.engine.compressionIgnition ? 'Key (wait for the glow lamp)' : 'Key'], ['R', 'Start'], ...(hasChoke(unit.spec.engine) ? [['Q Z', 'Choke']] : []), ['Y', 'Dipstick']]
                  : [['K', 'Ignition'], ...(quad.engine.params.noStarter ? [] : [['R', 'Start']]), ...(quad.engine.params.pullStart ? [['O', quad.engine.params.kickStart ? 'Kick' : 'Pull-start']] : []), ...(quad.engine.params.manualTiming ? [['[ ]', 'Spark lever']] : []), ...(quad.barLights ? [['P', 'Lights']] : []), ...(hasChoke(quad.engine.params) ? [['Q Z', 'Choke']] : []), ...(quad.fuel.params.noTap ? [] : [['F', 'Fuel tap']]), ...(quad.sump ? [['Y', 'Dipstick']] : quad.engine.params.tickler ? [['Y', 'Tickle']] : []), ...(quad.reverseStyle === 'none' ? [['V', 'Push (no reverse)']] : [])]),
              ['U', 'Dip the tank'],
            ],
          };
        },
        feedback: 'own',
        interact: () => {
          if (quad.loadedOn) return this.audioHub.useCue('latch'), this.strapDown(quad);
          if (unit.barnFind && !unit.barnFind.tarpOff) return;
          if (this.leads.held) return this.audioHub.useCue('latch'), this.clampLeads(quad);
          if (this.leads.ends.includes(quad)) return this.audioHub.useCue('latch'), this.leads.unclamp(this.camera);
          if (this.winch?.state === 'carried') {
            if (unit !== this.winch.unit) (this.audioHub.useCue('latch'), this.winch.hookOn(quad));
            return;
          }
          if (this.winch?.state === 'hooked' && this.winch.target === quad) {
            this.winch.unhook(this.camera);
            return;
          }
          if (this.chain?.state === 'carried') {
            if (unit !== this.tractorUnit) this.chain.hookOn(quad);
            return;
          }
          if (this.chain?.state === 'hooked' && this.chain.target === quad) {
            this.chain.unhook(this.camera);
            return;
          }
          if (this.towRope.state === 'carried') {
            if (quad !== this.towRope.puller) this.towRope.hookOn(quad);
            return;
          }
          if (this.towRope.state === 'hooked' && this.towRope.target === quad) {
            this.towRope.unhook(this.camera);
            return;
          }
          if (this.can.held || this.hose.held || this.coolantBottle.held || this.antiGelBottle.held) return; // E is for pouring or spraying while you're holding those
          if (this.heldBattery()?.unitId === BOOSTER_ID) return; // E is for holding to boost with the pack
          if (this.heldBattery()) return this.fitHeldBattery(unit);
          if (this.toolbox.held) {
            this.achievements.note('toolbox');
            return this.workshop.open(unit);
          }
          if (this.tooFastToMount(quad) && this.herDriving(quad) && !quad.hasBench) {
            // She pulls up and moves onto the back for you.
            const c = this.herDriving(quad);
            c.requestMount(quad);
            c.voice.onRequest('back');
            return;
          }
          if (this.tooFastToMount(quad)) return;
          if (this.sulkerIn(quad)) return this.knockOnWindow(this.sulkerIn(quad));
          if (quad.isTipped) quad.rightItself();
          else if (this.canRideBench(quad)) this.mountBench(unit);
          else if (quad.hasBench && this.herAtTheFront(quad)) return; // she's driving and the bench is full
          else if (this.herAtTheFront(quad) && this.herOnBack(quad)) return;
          else if (this.herAtTheFront(quad) && quad.hasPillion && !quad.passenger) this.mountPillion(unit);
          else if (this.canSitOnBack(quad) && this.lookingAtPassengerSeat(quad)) this.sitOnBack(unit);
          else this.mount(unit);
        },
        hold: (dt) => {
          if (this.coolantBottle.held) return this.coolantTopUp(unit, dt);
          if (this.antiGelBottle.held) return this.antiGelDose(unit, dt);
          if (this.heldBattery()?.unitId === BOOSTER_ID) return this.boostWithPack(unit, dt);
          if (this.hose.held) {
            // Close enough and the jet reaches it: the mud comes off.
            const near = quad.position.distanceTo(this.player.position) < this.hose.params.washRange + 1.2;
            if (near) {
              washMud(unit.mud.state, dt, unit.mud.params);
              this.washing = unit;
              this.favourQuad(unit, this.favour.p.washPerSecond * dt);
            }
            return false;
          }
          if (!this.can.held || this.tooFastToMount(quad)) return false;
          const wanted = Math.min(this.can.params.pourRate * dt, quad.fuel.space);
          const poured = quad.fuel.add(this.can.take(wanted), this.can.oil, this.can.diesel, this.can.water, this.can.additive) > 0;
          if (poured) {
            this.wrongMix = this.mixWrongFor(quad, this.can);
            this.achievements.note('fuelPoured');
          }
          return poured;
        },
      });
    }

    // Refuelling: a jerry can and the petrol tank by the barn.
    const L = this.world.layout;
    this.fuelTank = new FuelTank({
      scene: this.scene,
      physics: this.physics,
      RAPIER: this.RAPIER,
      world: this.world,
      position: L.fuelTank,
      yaw: L.fuelTank.yaw,
    });
    const [canSpot, premixSpot, dieselSpot] = randomJerryCanSpots(L, random, 3); // the three cans start in different places
    this.petrolCan = new JerryCan({
      scene: this.scene,
      world: this.world,
      position: canSpot,
      yaw: canSpot.yaw,
      params: { ...DEFAULT_JERRY_CAN_PARAMS },
    });
    // The yellow can of pre-mix for the two-strokes, with a bottle of oil to top it up with.
    this.premixCan = new JerryCan({
      scene: this.scene,
      world: this.world,
      position: premixSpot,
      yaw: premixSpot.yaw,
      params: { ...DEFAULT_JERRY_CAN_PARAMS, startLitres: 12, startOil: 0.02 },
      colours: PREMIX_CAN_COLOURS,
      name: 'premixCan',
    });
    // Red diesel for the tractor: a bowser south of the petrol tank, and a dark green can beside it. Petrol engines hate it.
    this.dieselBowser = new FuelTank({
      scene: this.scene,
      physics: this.physics,
      RAPIER: this.RAPIER,
      world: this.world,
      position: L.dieselBowser,
      yaw: L.dieselBowser.yaw,
      text: 'RED DIESEL',
      colour: 0x2d5a38,
      paper: '#b3261e',
      ink: '#f4efe0',
      scale: 0.8,
    });
    this.dieselCan = new JerryCan({
      scene: this.scene,
      world: this.world,
      position: dieselSpot,
      yaw: dieselSpot.yaw,
      params: { ...DEFAULT_JERRY_CAN_PARAMS, startLitres: 10, startDiesel: 1 },
      colours: DIESEL_CAN_COLOURS,
      name: 'dieselCan',
    });
    this.oilBottle = new OilBottle({ scene: this.scene, world: this.world, position: L.oilBottle, yaw: L.oilBottle.yaw });
    this.coolantBottle = new CoolantBottle({ scene: this.scene, world: this.world, position: L.coolantBottle, yaw: L.coolantBottle.yaw });
    this.antiGelBottle = new AntiGelBottle({ scene: this.scene, world: this.world, position: L.antiGelBottle, yaw: L.antiGelBottle.yaw });
    this.plugAdditive = new PlugAdditive({ scene: this.scene, world: this.world, position: L.plugAdditive, yaw: L.plugAdditive.yaw });
    for (const can of [this.petrolCan, this.premixCan, this.dieselCan]) {
      this.interaction.add({
        target: can.proxy,
        isAvailable: () => !this.handsFull && !can.carried,
        prompt: () => `Pick up the ${can === this.premixCan ? 'yellow' : can === this.dieselCan ? 'dark green' : 'red'} jerry can (${can.litres.toFixed(1)} L, ${fuelText(can.oil, can.diesel, can.water, can.additive)})`,
        feedback: 'pickUp',
        interact: () => can.pickUp(this.camera),
      });
    }
    this.interaction.add({
      target: this.oilBottle.proxy,
      isAvailable: () => !this.oilBottle.held,
      prompt: () => {
        if (!this.handsFull) return 'Pick up the oil bottle';
        if (!this.can.held) return { text: 'Engine oil: bring a jerry can to add some to the pre-mix' };
        if (this.can.space < 0.01) return { text: 'The jerry can is full' };
        return { text: `Hold E to add oil to the can (${fuelText(this.can.oil, this.can.diesel, this.can.water, this.can.additive)})` };
      },
      feedback: 'pickUp',
      interact: () => {
        if (!this.handsFull) this.oilBottle.pickUp(this.camera);
      },
      hold: (dt) => this.can.held && this.can.addOil(this.oilBottle.params.pourRate * dt) > 0,
    });
    this.interaction.add({
      target: this.coolantBottle.proxy,
      isAvailable: () => !this.coolantBottle.held,
      prompt: () => (this.handsFull ? { text: 'Coolant: put what you are holding down first' } : 'Pick up the coolant bottle'),
      feedback: 'pickUp',
      interact: () => {
        if (!this.handsFull) this.coolantBottle.pickUp(this.camera);
      },
    });
    this.interaction.add({
      target: this.antiGelBottle.proxy,
      isAvailable: () => !this.antiGelBottle.held,
      prompt: () => (this.handsFull ? { text: 'Diesel anti-gel: put what you are holding down first' } : 'Pick up the diesel anti-gel'),
      feedback: 'pickUp',
      interact: () => {
        if (!this.handsFull) this.antiGelBottle.pickUp(this.camera);
      },
    });
    this.interaction.add({
      target: this.plugAdditive.proxy,
      prompt: () => {
        if (!this.can.held) return { text: 'Plug-saver: bring the pre-mix can to treat it, so a two-stroke plug stays cleaner at idle' };
        if (this.can.oil <= 0 || this.can.litres < 0.01) return { text: 'Plug-saver is for pre-mix: this can has no oil in it, or nothing' };
        if (this.can.additive > 0.99) return { text: 'The pre-mix is already treated' };
        return { text: `Hold E to treat the pre-mix with plug-saver (${Math.round(this.can.additive * 100)}% treated)` };
      },
      feedback: 'hold',
      interact: () => {},
      hold: (dt) => {
        if (!this.can.held || this.can.oil <= 0) return false;
        const was = this.can.additive;
        const treated = this.can.treat(this.plugAdditive.params.treatRate * dt);
        if (was < 0.5 && this.can.additive >= 0.5) this.saySomethingAboutAdditive();
        return treated > 0;
      },
    });
    this.interaction.add({
      target: this.fuelTank.proxy,
      prompt: () => {
        if (!this.can.held) return { text: 'Petrol tank: bring the jerry can to fill it' };
        if (this.can.space < 0.01) return { text: 'The jerry can is full' };
        return { text: `Hold E to fill the jerry can (${this.can.litres.toFixed(1)} / ${this.can.params.capacity} L, ${fuelText(this.can.oil, this.can.diesel, this.can.water, this.can.additive)})` };
      },
      feedback: 'hold',
      interact: () => {},
      hold: (dt) => this.can.held && this.can.fill(this.can.params.fillRate * dt) > 0,
    });
    this.interaction.add({
      target: this.dieselBowser.proxy,
      prompt: () => {
        if (!this.can.held) return { text: 'Red diesel, for the tractor: bring a jerry can to fill it' };
        if (this.can.space < 0.01) return { text: 'The jerry can is full' };
        return { text: `Hold E to fill the jerry can with red diesel (${this.can.litres.toFixed(1)} / ${this.can.params.capacity} L, ${fuelText(this.can.oil, this.can.diesel, this.can.water, this.can.additive)})` };
      },
      feedback: 'hold',
      interact: () => {},
      hold: (dt) => this.can.held && this.can.fill(this.can.params.fillRate * dt, 0, 1) > 0,
    });

    this.setUpFlock();
    this.setUpWildlife();
    this.setUpCat();
    this.setUpDog();
    this.setUpFarmAnimals();
    this.setUpFence();
    this.setUpRadios();
    this.trafficHost = new TrafficHost(this); // the lane's traffic, the visitors and the two gates (world/trafficHost.js)
    this.neighbourHost = new NeighbourHost(this); // the neighbour in her yard over the lane (world/neighbourHost.js)

    // The bell beside the barn doors: ring it and the girls come back to the barn, wherever they are.
    this.bell = new Bell({ scene: this.scene, physics: this.physics, RAPIER: this.RAPIER, world: this.world, audioHub: this.audioHub, position: L.bell, yaw: L.bell.yaw });
    this.interaction.add({
      target: this.bell.proxy,
      prompt: () => (this.recalling ? 'Ring the bell again' : 'Ring the bell to call the girls back'),
      feedback: 'own',
      interact: () => this.ringBell(),
    });

    // A toolbox by the petrol tank, for tinkering with the quads (see workshop.js).
    this.toolbox = new Toolbox({ scene: this.scene, world: this.world, position: L.toolbox, yaw: L.toolbox.yaw });
    this.toolbox.model.position.y += L.toolbox.lift ?? 0; // up on the barn workbench
    this.workshop = new Workshop(this);
    for (const unit of this.units) {
      unit.quad.tyres.tune = this.workshop.params; // the psi effects stay tunable in the toolbox's panel
      unit.quad.physics.tyres = unit.quad.tyres;
      unit.quad.physics.applyParams();
    }
    this.dares = new Dares(steepestBank(this.world.layout.hill), undefined, createRandom(this.seed ^ 0x6d17)); // Jess's dares (npc/dares.js)
    registerTuning('Dares', this.dares.p, DARE_PARAM_RANGES);
    this.bench = new Bench(this);
    this.notebook = new Notebook(this); // Amy's logbook, on the bench
    this.sparesShelf = new SparesShelf(this); // the parts rack on the barn wall: plugs, tubes, belts, jets and pistons, which run out (workshop/spares.js)
    this.spares = this.sparesShelf.spares;
    this.girlBench = new GirlBench(undefined, this.bench.params, createRandom(this.seed ^ 0x2b3c)); // a girl working on a quad at the bench (npc/girlBench.js)
    registerTuning('Girl at the bench', this.girlBench.p, GIRL_BENCH_PARAM_RANGES);
    this.girlBench.spares = this.spares;
    this.phoneCalls = new PhoneCalls(undefined, createRandom(this.seed ^ 0x7e1f)); // a girl's phone ringing (npc/phoneCalls.js)
    registerTuning('Phone calls', this.phoneCalls.p, PHONE_PARAM_RANGES);
    // A hosepipe for washing the mud off.
    this.hose = new Hose({ scene: this.scene, world: this.world, position: L.hose, yaw: L.hose.yaw });
    // The green quad's winch, for pulling a stuck quad out of a bog.
    const winchUnit = this.units.find((u) => u.spec.winch);
    this.winch = winchUnit ? new Winch({ scene: this.scene, unit: winchUnit }) : null;
    this.winchReel = false;
    if (this.winch) {
      this.winch.anchors = this.world.props.anchors ?? [];
      this.winchAudio = new WinchAudio(this.audioHub);
      this.winch.onCreak = (strength) => this.winchAudio.creak(strength, this.winch.leadPosition(new THREE.Vector3()));
    }
    // The tractor's tow chain (items/chain.js), for a quad sunk too deep for the winch or a dead one to tow home.
    this.chain = this.tractorUnit ? new Chain({ scene: this.scene, tractor: this.tractorUnit.quad, anchor: (q) => q.localToWorld(0, TRACTOR_GROUND_OFFSET + 0.52, -1.5) }) : null; // no tractor, no chain
    // The tow rope on the red and blue quads' racks (items/towRope.js): a quad towing a quad, with a girl steering the dead one.
    this.towRope = new TowRope({ scene: this.scene });
    this.setUpKitSpots();
    this.setUpDrawbars();
    this.interaction.add({
      target: this.hose.proxy,
      isAvailable: () => !this.handsFull,
      prompt: () => 'Pick up the hose',
      feedback: 'pickUp',
      interact: () => this.hose.pickUp(this.camera),
    });
    // Jump leads, for a flat battery: a running quad charges it.
    this.leads = new JumpLeads({ scene: this.scene, world: this.world, position: L.benchLeads, yaw: L.benchLeads.yaw });
    this.leads.model.position.y += L.bench.height; // they start on the workbench
    this.setUpBatteries();
    this.setUpGenerator();
    // The farm map on M (hud/farmMap.js, mapView.js).
    this.mapParams = { ...DEFAULT_MAP_PARAMS };
    registerTuning('Map', this.mapParams, MAP_PARAM_RANGES);
    this.farmMap = new MapView(document.getElementById('hud'), farmMapFeatures(L, this.world.fields, this.world.track), this.mapParams);
    this.interaction.add({
      target: this.leads.proxy,
      priority: 1, // they lie on the bench, whose box would otherwise be hit first
      isAvailable: () => !this.handsFull && !this.leads.held,
      prompt: () => 'Pick up the jump leads',
      feedback: 'pickUp',
      interact: () => this.leads.pickUp(this.camera),
    });
    this.interaction.add({
      target: this.toolbox.proxy,
      priority: 1, // it sits on the bench, whose box would otherwise be hit first
      isAvailable: () => !this.handsFull && !this.toolbox.carried,
      prompt: () => 'Pick up the toolbox',
      feedback: 'pickUp',
      interact: () => this.toolbox.pickUp(this.camera),
    });
    // The workbench: jobs on a quad parked in the painted bay (workshop/bench.js).
    this.interaction.add({
      target: this.bench.proxy,
      isAvailable: () => !this.handsFull || !!this.benchItem() || !!this.heldBattery(), // a battery in your hands is fitted from the bench's job list
      prompt: () => (this.benchItem() ? `Put the ${this.benchItem().name} back on the bench` : this.bench.prompt()),
      feedback: () => (this.benchItem() ? 'putDown' : 'paper'),
      interact: () => (this.benchItem() ? this.putOnBench(this.benchItem()) : (this.achievements.note('bench'), this.bench.open())),
    });
    // Her asking for a hand at the bench (npc/girlBench.js): the spanner, or the torch.
    this.interaction.add({
      target: this.bench.proxy,
      priority: 2,
      isAvailable: () => !!this.girlBench.asking && this.nearBench(this.girlBench.p.helpRange),
      prompt: () => ASK_PROMPT[this.girlBench.asking.type].replace('{name}', this.companions.find((c) => c.character.id === this.girlBench.asking.girl)?.name ?? 'her'),
      feedback: 'own',
      interact: () => this.girlBench.help(),
    });
    this.interaction.add({
      target: this.notebook.proxy,
      priority: 1, // it lies on the bench, whose box would otherwise be hit first
      isAvailable: () => !this.handsFull,
      prompt: () => this.notebook.prompt(),
      feedback: 'paper',
      interact: () => this.notebook.open(),
    });

    // The farm jobs: the chalkboard on the barn door lists today's, and the muck job is forked into the tipping trailer (world/farmJobs.js).
    this.muckParams = { ...DEFAULT_MUCK_PARAMS };
    this.muck = new MuckLoad(this.muckParams);
    this.muckView = new MuckView({ scene: this.scene, tub: this.tipTrailer.tub, heightAt: (x, z) => this.world.heightAt(x, z), random: createRandom(this.seed ^ 0x3a9c) });
    // The tractor's bale spike (items/baleSpike.js): the standing silage bales can be lifted and carried; where they were left is kept.
    this.spikeParams = { ...DEFAULT_SPIKE_PARAMS };
    this.baleRig = new BaleSpikeRig({
      physics: this.physics,
      RAPIER: this.RAPIER,
      silage: this.world.props.silage,
      groundAt: (x, z) => this.world.heightAt(x, z),
      tractor: this.tractorUnit?.quad ?? null,
      params: this.spikeParams,
    });
    this.baleRig.restore(keepOutside(this.farm.save?.bales, (x, z) => underRoof(this.world.layout, x, z))); // not one left where the barn now stands
    this.siloRect = dutchBarnShape(this.world.layout)?.open ?? null;
    registerTuning('Bale spike', this.spikeParams, SPIKE_PARAM_RANGES);
    this.setUpLogSplitter();
    this.setUpBonfire();
    this.hutHost = new HutHost(this); // the shepherd's hut on the hill: its stove, its kettle and the girls' stays (world/hutHost.js)
    this.jobBoardParams = { ...DEFAULT_JOB_BOARD_PARAMS };
    // The silage job needs the tractor, and enough bales still out of the barn for it to be worth asking.
    const hayStacked = Math.max(0, this.farm.save?.hay?.stacked ?? 0);
    const jobIds = availableJobs(this.world.layout)
      .filter((id) => id !== 'feed') // not drawn from the pool: it is dealt on its own chance below, and goes on top of the day's two
      .filter((id) => id !== 'silage' || (!!this.tractorUnit && !!this.siloRect && this.baleRig.yard.countIn(this.siloRect) < this.spikeParams.balesNeeded))
      .filter((id) => id !== 'logs' || (!!this.logStack && this.logStack.roomForJob())) // the log job needs the tractor and room on the stack
      .filter((id) => id !== 'spray' || sprayWanted(this.farm.save?.spray, this.farm.day)) // a sprayed field stays off the board for a few days
      .filter((id) => id !== 'hay' || (!!this.tractorUnit && !!this.siloRect && hayStacked + DEFAULT_HAY_PARAMS.balesNeeded <= STACK_CAPACITY)); // the hay needs the tractor and room in the barn
    this.jobBoard = new JobBoard({ ids: jobIds, random: createRandom(this.seed ^ 0x7ab0), params: this.jobBoardParams });
    if (this.jobBoard.has('logs')) this.logStack.startJob();
    if (feedWanted(createRandom((this.farmSeed ^ Math.imul(this.farm.day + 1, 0x85ebca6b)) >>> 0), this.jobBoardParams.feedChance)) this.jobBoard.add('feed', FARM_JOBS.feed);
    this.setUpServiceJob();
    this.jobBoardView = new JobBoardView({ game: this, board: this.jobBoard, records: this.records, challenges: this.challenges });
    this.setUpHay();
    this.setUpSpraying();
    // Each farm job ticked off pays (farm/classifieds.js); the neighbours' ads for vehicles are pinned up on the odd day, on the board beside the chalkboards.
    this.jobBoard.onComplete = (id) => {
      this.market.earn(this.marketParams.jobPay);
      this.hud.toast(`+£${this.marketParams.jobPay} for the job: ${(this.jobBoard.jobs[id]?.chalk ?? 'done').replace(/\.$/, '')}. £${this.market.purse.toLocaleString('en-GB')} in the tin`, 4);
      this.refreshMarketViews();
      this.coinAudio.chink(0.35);
      this.saySomethingAboutMoney('moneyIn', { chance: this.marketTalkParams.jobPaidChance });
    };
    this.market.ads = dealAds(createRandom((this.farmSeed ^ Math.imul(this.farm.day, 0x9e3779b1)) >>> 0), { specs: this.specsById, onFarm: this.stockedIds, owned: this.market.bought, P: this.marketParams });
    this.classifiedsView = new ClassifiedsView({ game: this, market: this.market });
    // The money tin on its shelf under the cork board, its coin chink, and when the girls remark on the money (farm/marketTalk.js).
    this.moneyTin = new MoneyTinView({ game: this, market: this.market });
    this.coinAudio = new CoinAudio(this.audioHub, this.moneyTin.position);
    this.villageHost = new VillageHost(this); // the village down the lane: its pumps, its shop, its draw distance and its glow after dark (world/villageHost.js)
    this.shedView = new ShedView({ game: this, shed: this.shed, market: this.market }); // the catalogue under the board, and what it has bought
    this.marketTalkParams = { ...DEFAULT_MARKET_TALK_PARAMS };
    registerTuning('Money talk', this.marketTalkParams, MARKET_TALK_RANGES);
    this.marketTalk = new MarketTalk(this.marketTalkParams);
    this.trophyShelf = new TrophyShelf({ game: this }); // under it: a rosette for each show placed at (farm/showDay.js)
    this.wallCalendar = new WallCalendar({ game: this, date: this.date }); // between the two boards: the days crossed off
    this.photos = new PhotoHost(this); // the camera key and the cork board beside the chalkboards (photos/)
    this.setUpEndOfDay();
    registerTuning('Muck job', this.muckParams, MUCK_PARAM_RANGES);
    registerTuning('Job board', this.jobBoardParams, JOB_BOARD_PARAM_RANGES);
    registerTuning('Farm animals', this.animalParams, ANIMAL_PARAM_RANGES);
    registerTuning('Feed bucket', this.feedBucket.params, FEED_BUCKET_PARAM_RANGES);
    this.interaction.add({
      target: this.jobBoardView.proxy,
      isAvailable: () => !this.handsFull && !this.player.isRiding,
      prompt: () => this.jobBoardView.prompt(),
      feedback: 'paper',
      interact: () => this.jobBoardView.open(),
    });
    this.interaction.add({
      target: this.moneyTin.proxy,
      isAvailable: () => !this.handsFull && !this.player.isRiding,
      prompt: () => this.moneyTin.prompt(),
      feedback: 'paper',
      interact: () => this.moneyTin.open(),
    });
    this.interaction.add({
      target: this.shedView.proxy,
      isAvailable: () => !this.handsFull && !this.player.isRiding,
      prompt: () => this.shedView.prompt(),
      feedback: 'paper',
      interact: () => this.shedView.open(),
    });
    this.interaction.add({
      target: this.classifiedsView.proxy,
      isAvailable: () => !this.handsFull && !this.player.isRiding,
      prompt: () => this.classifiedsView.prompt(),
      feedback: 'paper',
      interact: () => this.classifiedsView.open(),
    });
    this.interaction.add({
      target: this.jobBoardView.recordsProxy,
      isAvailable: () => !this.handsFull && !this.player.isRiding,
      prompt: () => this.jobBoardView.recordsPrompt(),
      feedback: 'paper',
      interact: () => this.jobBoardView.open(),
    });

    for (const what of ['you', 'goggles']) {
      this.interaction.add({
        target: this.helmetHooks.proxies[what],
        isAvailable: () => !this.handsFull && !this.player.isRiding,
        prompt: () => this.hookPrompt(what),
        feedback: 'latch',
        interact: () => this.toggleYourGear(what),
      });
    }

    this.interaction.add({
      target: this.photos.view.proxy,
      isAvailable: () => !this.handsFull && !this.player.isRiding,
      prompt: () => this.photos.view.prompt(),
      feedback: 'paper',
      interact: () => this.photos.openBoard(),
    });

    // The cone course: stand the knocked cones up.
    this.interaction.add({
      target: this.coneProxy,
      isAvailable: () => !this.handsFull && !this.player.isRiding && this.coneField.downCount > 0 && !this.coneCourse.active,
      prompt: () => 'Stand the cones up',
      feedback: 'putDown',
      interact: () => this.standCones(),
    });

    // The hayloft: the ladder up and down, and the hay to hide in.
    this.interaction.add({
      target: this.loft.ladderProxy,
      isAvailable: () => !this.handsFull && !this.climb && !this.hiding.active,
      prompt: () => (this.youOnLoft() ? 'Climb down the ladder' : 'Climb up to the hayloft'),
      feedback: 'own',
      interact: () => this.startClimb(),
    });
    this.interaction.add({
      target: this.loft.hayProxy,
      isAvailable: () => !this.handsFull && !this.climb && !this.hiding.active && this.youOnLoft(),
      prompt: () => 'Duck into the hay and hide',
      feedback: 'paper',
      interact: () => this.startHiding(),
    });

    // Start facing the quad she's standing by, wherever it ended up.
    const q = this.homeUnit.quad.position;
    const p = this.player.position;
    this.player.yaw = Math.atan2(-(q.x - p.x), -(q.z - p.z));

    registerTuning('Sound', this.audioHub.params, SOUND_PARAM_RANGES);
    registerTuning('Jerry can', this.petrolCan.params, JERRY_CAN_PARAM_RANGES);
    registerTuning('Pre-mix can', this.premixCan.params, JERRY_CAN_PARAM_RANGES);
    registerTuning('Diesel can', this.dieselCan.params, JERRY_CAN_PARAM_RANGES);
    registerTuning('Oil bottle', this.oilBottle.params, OIL_BOTTLE_PARAM_RANGES);
    registerTuning('Coolant bottle', this.coolantBottle.params, COOLANT_BOTTLE_PARAM_RANGES);
    registerTuning('Anti-gel bottle', this.antiGelBottle.params, ANTI_GEL_BOTTLE_PARAM_RANGES);
    registerTuning('Plug-saver', this.plugAdditive.params, PLUG_ADDITIVE_PARAM_RANGES);
    registerTuning('Hose', this.hose.params, HOSE_PARAM_RANGES);
    this.muddyParams = { ...DEFAULT_MUDDY_PARAMS };
    registerTuning('Muddy girls', this.muddyParams, MUDDY_PARAM_RANGES);
    // What is stuck on your view riding an open vehicle (effects/lensMud.js), and the canvas that draws it.
    this.lensParams = { ...DEFAULT_LENS_PARAMS };
    registerTuning('Mud on the lens', this.lensParams, LENS_PARAM_RANGES);
    this.lens = createLens();
    this.lensRandom = createRandom(this.seed ^ 0x1e45);
    this.lensView = new LensMudView();
    registerTuning('Bell', this.bell.params, BELL_PARAM_RANGES);
    registerTuning('Favour', this.favour.p, FAVOUR_PARAM_RANGES);
    registerTuning('Achievements', this.achievements.p, ACHIEVEMENT_PARAM_RANGES);
    this.achievements.fleet = [...this.units.map((u) => u.id), ...(this.rustyUnit ? ['rusty'] : [])];
    this.achievements.onUnlock((a) => this.achievementUnlocked(a));
    this.discoveries.onLearn(() => this.discoveryLearnt());
    registerTuning('Falling out', this.fallingOut.p, FALLING_OUT_PARAM_RANGES);
    registerTuning('Making up', this.makeUp.p, MAKE_UP_PARAM_RANGES);
    registerTuning('Romance', this.romance.p, ROMANCE_PARAM_RANGES);
    this.wearLedger ??= new WearLedger();
    registerTuning('Who wore it out', this.wearLedger.p, LEDGER_PARAM_RANGES);
    this.leftRunning ??= new LeftRunning();
    registerTuning('Left running', this.leftRunning.p, LEFT_PARAM_RANGES);
    registerTuning('Pranks', this.pranks.p, PRANK_PARAM_RANGES);
    registerTuning('Autumn', this.autumnParams, AUTUMN_PARAM_RANGES);
    registerTuning('Rev-offs', this.revOff.p, REVOFF_PARAM_RANGES);
    registerTuning('Drowning out', this.drownOut.p, DROWNOUT_PARAM_RANGES);
    registerTuning('Horns', this.horns.p, HORN_PARAM_RANGES);
    registerTuning('Tractor remarks', this.tractorWatch.p, TRACTOR_WATCH_PARAM_RANGES);
    registerTuning('River remarks', this.riverWatch.p, RIVER_WATCH_PARAM_RANGES);
    registerTuning('Pit remarks', this.quarryWatch.p, QUARRY_WATCH_PARAM_RANGES);
    registerTuning('Tractor creep', DEFAULT_CREEP_PARAMS, CREEP_PARAM_RANGES);
    registerTuning('Throttle key', DEFAULT_THROTTLE_KEY_PARAMS, PEDAL_KEY_PARAM_RANGES);
    registerTuning('Brake key', DEFAULT_BRAKE_KEY_PARAMS, PEDAL_KEY_PARAM_RANGES);
    registerTuning('What catches the eye', DEFAULT_NOTICE_PARAMS, NOTICE_PARAM_RANGES); // shared by both girls (npc/attention.js)
    registerTuning('Tractor runaway', this.tractorRunaway.p, TRACTOR_RUNAWAY_PARAM_RANGES);
    registerTuning('Hay ride', this.hayRide.p, HAYRIDE_PARAM_RANGES);
    registerTuning('Mudguard ride', this.mudguard.p, MUDGUARD_PARAM_RANGES);
    registerTuning('Tractor go', this.tractorGo.p, TRACTORGO_PARAM_RANGES);
    registerTuning('L plates', this.lPlates.p, LPLATE_PARAM_RANGES);
    registerTuning('Tractor go drive', this.tractorDrive, TRACTOR_GO_DRIVE_RANGES);
    registerTuning('Yak go drive', this.utvDrive, TRACTOR_GO_DRIVE_RANGES);
    registerTuning('Tor go drive', this.landyDrive, TRACTOR_GO_DRIVE_RANGES);
    registerTuning('Their cars', this.carGo.p, CAR_GO_PARAM_RANGES);
    registerTuning('Tor go handle', this.crankParams, CRANK_ATTEMPT_PARAM_RANGES);
    registerTuning('Girl pushing a start', this.pushParams, PUSH_PARAM_RANGES);
    registerTuning('Keeping it alive', this.keepParams, KEEPALIVE_PARAM_RANGES);
    registerTuning('Tractor go start', this.tractorStartParams, TRACTOR_START_PARAM_RANGES);
    registerTuning('Tractor go novice', this.noviceParams, NOVICE_PARAM_RANGES);
    registerTuning('Hay ride seat', this.haySeat, HAYSEAT_PARAM_RANGES);
    registerTuning('Getting on and off', this.moveParams, MOVE_PARAM_RANGES);
    registerTuning('Standing about', this.idlePoseParams, IDLE_POSE_PARAM_RANGES);
    registerTuning('Waiting about', this.waitingParams, WAITING_PARAM_RANGES);
    registerTuning('Time of day', this.daylight.p, DAYLIGHT_PARAM_RANGES);
    registerTuning('Forecast', this.forecastParams, FORECAST_PARAM_RANGES);
    registerTuning('Vehicle lights', this.vehicleLights.p, VEHICLE_LIGHT_PARAM_RANGES);
    registerTuning('Trailer', this.trailer.p, TRAILER_PARAM_RANGES);
    registerTuning('Loading ramps', this.trailer.lp, LOAD_PARAM_RANGES, { onChange: () => this.trailer.refreshRamps() });
    registerTuning('Quad names', this.quadNames.p, NAME_PARAM_RANGES);
    registerTuning('Whose quad', this.ownership.p, OWNERSHIP_PARAM_RANGES);
    registerTuning('Caring for her quad', this.quadCare.p, CARE_PARAM_RANGES);
    registerTuning('Hearing a quad', this.hearing.p, EAR_PARAM_RANGES);
    registerTuning('Warming hands', this.warming.p, WARMING_PARAM_RANGES);
    registerTuning('Practising the clutch', this.practising.p, PRACTISING_PARAM_RANGES);
    registerTuning('Comparing notes', this.comparing.p, COMPARE_PARAM_RANGES);
    registerTuning('Quad strengths', STRENGTH_PARAMS, STRENGTH_PARAM_RANGES);
    registerTuning('Learning the quads', OPINION_PARAMS, OPINION_PARAM_RANGES);
    registerTuning('The two as a pair', this.pair.p, PAIR_PARAM_RANGES);
    registerTuning('Asking you along', this.askAlong.p, ASK_ALONG_PARAM_RANGES);
    registerTuning('Guiding a trailer back', this.trailerGuide.p, TRAILER_GUIDE_PARAM_RANGES);
    registerTuning('Lights to work by', this.workLight.p, WORK_LIGHT_PARAM_RANGES);
    registerTuning('Starting the generator', this.generatorStart.p, GENERATOR_START_PARAM_RANGES);
    registerTuning('Numb bum', this.numbParams, NUMB_PARAM_RANGES);
    registerTuning('Minding a fix', this.dontFix.p, DONTFIX_PARAM_RANGES);
    registerTuning('Sitting while it warms', this.warmSit.p, WARMSIT_PARAM_RANGES);
    registerTuning('Ready and waiting', this.readyWaiting.p, READY_PARAM_RANGES);
    registerTuning('Waving', this.waveParams, WAVE_RANGES);
    registerTuning('Sulking in the cab', this.sulking.p, SULK_PARAM_RANGES);
    registerTuning('Shelter in a cab', this.cabShelter.p, CAB_SHELTER_PARAM_RANGES);
    registerTuning('Thunderstorm', this.thunderParams, THUNDER_PARAM_RANGES);
    registerTuning('Head start', this.headStart.p, HEADSTART_PARAM_RANGES);
    registerTuning('Talking about you', this.gossip.p, GOSSIP_PARAM_RANGES);
    registerTuning('Girls coaching each other', this.pillionCoach.p, PILLION_COACH_PARAM_RANGES);
    registerTuning('Driving lessons', this.lessons.p, LESSON_PARAM_RANGES);
    registerTuning('Hand on the throttle', this.throttleGrab.p, GRAB_PARAM_RANGES);
    registerTuning('Asleep on the back', this.napParams, NAP_PARAM_RANGES);
    registerTuning('Blinking', this.blinkParams, BLINK_PARAM_RANGES);
    registerTuning('Faces', this.faceParams, FACE_PARAM_RANGES);
    registerTuning('Two-stroke smoke', this.smokeSense.p, SMOKE_PARAM_RANGES);
    registerTuning('Shouting a fault', this.faultShout.p, SHOUT_PARAM_RANGES);
    registerTuning('Yard haze', this.haze.p, HAZE_PARAM_RANGES);
    registerTuning('Mist', this.mist.p, MIST_PARAM_RANGES);
    registerTuning('Rainbows', this.rainbow.p, RAINBOW_PARAM_RANGES);
    registerTuning('Fumes in the barn', this.barnFumes.p, FUMES_PARAM_RANGES);
    registerTuning('Racing', this.race.p, RACE_PARAM_RANGES);
    registerTuning('Drag race', this.drag.p, DRAG_PARAM_RANGES);
    registerTuning('Follow the leader', this.convoy.p, CONVOY_PARAM_RANGES);
    registerTuning('Doughnuts', this.doughnutWatch.p, DOUGHNUT_PARAM_RANGES);
    registerTuning('Tarmac', this.tarmacWatch.p, TARMAC_PARAM_RANGES);
    registerTuning('Drives that go somewhere', this.outingParams, OUTING_PARAM_RANGES);
    registerTuning('Taking you to see something', this.sightParams, SIGHT_PARAM_RANGES);
    registerTuning('Showing off', this.showOffParams, SHOWOFF_PARAM_RANGES);
    registerTuning('The jump', this.jumpWatch.p, JUMP_PARAM_RANGES);
    registerTuning('Nicking your quad', this.nicking.p, NICK_PARAM_RANGES);
    registerTuning('Lining them up', this.lineUpParams, LINEUP_PARAM_RANGES);
    registerTuning('Home and jogging', this.homeParams, HOME_PARAM_RANGES);
    registerTuning('Tea on the rack', this.tea.p, TEA_PARAM_RANGES);
    registerTuning('Things walk off', this.loose.p, LOOSE_PARAM_RANGES);
    registerTuning('Flask at the top of the hill', this.flask.p, FLASK_PARAM_RANGES);
    registerTuning('Girls carrying things', carryParams, CARRY_PARAM_RANGES);
    registerTuning('Jumpers', this.jumpers.p, JUMPER_PARAM_RANGES);
    registerTuning('Wax jackets', this.coats.p, COAT_PARAM_RANGES);
    registerTuning('Outfits', this.outfitParams, OUTFIT_PARAM_RANGES);
    registerTuning('Ponytail', this.ponytailParams, PONYTAIL_PARAM_RANGES);
    registerTuning('Helmets and goggles', this.headgear.p, HEADGEAR_PARAM_RANGES);
    registerTuning('Red diesel mistake', this.dieselMistake.p, DIESEL_MISTAKE_PARAM_RANGES);
    registerTuning('Reading the dash', this.dashReader.p, READING_PARAM_RANGES);
    registerTuning('Jump leads', this.leads.params, JUMP_LEAD_PARAM_RANGES);
    registerTuning('Skills', this.skills.p, SKILL_PARAM_RANGES);
    registerTuning('Watching you', this.watching.p, WATCH_PARAM_RANGES);
    registerTuning('Places', this.places.p, PLACE_PARAM_RANGES);
    registerTuning('Hayloft', this.loftParams, LOFT_PARAM_RANGES);
    registerTuning('Wind', this.wind.p, WIND_PARAM_RANGES);
    registerTuning('Favours asked', this.requests.p, REQUEST_PARAM_RANGES);
    registerTuning('Girls at the pub', this.pubParams, PUB_PARAM_RANGES);
    if (this.winch) registerTuning('Winch', this.winch.params, WINCH_PARAM_RANGES);
    if (this.chain) registerTuning('Tow chain', this.chain.params, CHAIN_PARAM_RANGES);
    registerTuning('Tow rope', this.towRope.params, TOW_ROPE_PARAM_RANGES);
    registerTuning('Girl steering a tow', this.towSteerParams, TOW_STEER_RANGES);
    registerTuning('Girl calling for help', this.strandedParams, STRANDED_RANGES);
    registerTuning('Player', this.player.params, PLAYER_PARAM_RANGES);
    for (const c of this.companions) {
      registerTuning(c.name, c.params, COMPANION_PARAM_RANGES, { onChange: () => c.refreshFigure() });
      registerTuning(`${c.name} pillion`, c.pillion.params, PILLION_PARAM_RANGES);
    }
    this.debugGui = new DebugGui(this);
    this.console = new GameConsole(this);

    this.applyDebugCamera();
    if (import.meta.env.DEV || location.search.includes('smoke')) window.game = this; // ?smoke lets tools/smoke.mjs drive the built game
    report('Settling…');
    this.restoreDay();
    await new Promise((r) => setTimeout(r, 0));
    this.settleVehicles();
    this.arriveInCar();
    await this.loadSounds(report);
  }

  /**
   * The morning (#229, farm/arrival.js): you are sat in your car on the pad by the Dutch barn, engine running and warm. A girl you gave a lift is
   * sat in it with you; each of the others is at the wheel of her own car beside it, engine running too. Done once the cars are on their wheels.
   */
  arriveInCar() {
    const mine = this.landys.p309;
    if (!mine?.unit) return;
    mine.unit.quad.engine.runWarm();
    this.mount(mine.unit);
    this.startPlaces = placesAt(mine.unit.quad.position, this.world.layout); // the end of the road doesn't count until you've left it (achievements/snapshot.js)
    const seats = liftSeats(this.arrivalDeal.lift);
    for (const c of this.companions) {
      const id = c.character.id;
      const own = Object.values(this.landys).find((l) => l.car && l.spec.owner === id && l.unit);
      const l = seats[id] ? mine : own;
      const slot = l?.mount.slots[seats[id] ?? 'driver'];
      if (!slot || !c.sitInNow(l.mount, slot)) continue;
      l.ride.ask(id); // she stays sat until the morning lets her out (updateArrival)
      if (l !== mine) l.unit.quad.engine.runWarm();
    }
    this.arrival = new Arrival(this.arrivalDeal);
  }

  /** This morning in a line, for the Girls tab and the console (farm/arrival.js). */
  describeArrival() {
    return this.arrival ? this.arrival.describe(Object.fromEntries(this.companions.map((c) => [c.character.id, c.name]))) : 'you did not arrive in your car today';
  }

  /** Each frame of the morning: lets each girl out of the car she arrived in when her time comes (farm/arrival.js), and switches her own off. */
  updateArrival(dt) {
    const a = this.arrival;
    if (!a || a.done) return;
    const mine = this.landys.p309;
    const seated = new Set();
    for (const c of this.companions) {
      const l = Object.values(this.landys).find((x) => x.mount && c.onHayRide && c.trailer === x.mount);
      const own = l?.spec.owner === c.character.id && c.traSlot?.name === 'driver';
      if (l && c.fsm.is('onTrailer') && !c.fsm.data?.leaving && (l === mine || own)) seated.add(c.character.id);
    }
    for (const e of a.update(dt, { youIn: this.riddenUnit === mine.unit, seated })) {
      const c = this.companions.find((o) => o.character.id === e.girl);
      const l = Object.values(this.landys).find((x) => x.mount && c?.trailer === x.mount);
      if (!c || !l) continue;
      if (e.from === 'own' && !e.leaveRunning) l.unit.quad.engine.setIgnition(false); // she's parked: she switches off as she gets out, most days
      else c.voice.say('liftThanks', { chance: 0.8 });
      l.ride.dismiss(e.girl);
      c.leaveTrailer();
    }
  }

  /**
   * Every vehicle spawns a little above the ground. Left to drop once the game starts, they all land at once, thud and knock on
   * their springs together and make a deafening crash. So the physics runs for a couple of seconds here, behind the loading screen,
   * until they're sitting on their wheels, and the thuds that queued meanwhile are thrown away.
   */
  settleVehicles(seconds = SETTLE_SECONDS) {
    for (let t = 0; t < seconds; t += FIXED_DT) this.fixedUpdate(FIXED_DT);
    for (const unit of this.units) unit.ride?.events.take();
  }

  /**
   * Every sound, loaded behind the loading screen so the game never starts silent: the engine worklet and its recorded banks, the ride
   * sounds and both girls' voices. The context starts suspended (no click yet); clicking to play only switches it on (AudioHub.unlock).
   */
  async loadSounds(report) {
    const hub = this.audioHub;
    const jobs = [];
    let done = 0;
    // Only the banks of the vehicles near where you start load now; the rest load when their engines are used or you come near (bankWant.js).
    const names = startBanks(this.units.map((u) => ({ audioBank: u.spec.audio?.recBank ?? 'engine-bank', at: u.quad.position })), this.player.position);
    const total = names.length + this.companions.length + 1; // the engine banks, each girl's voice, the ride sounds
    const tick = () => report(`Loading sounds… ${done}/${total}`);
    const engine = hub.prepare(() => {
      done++;
      tick();
    }, names);
    if (!engine) return; // no Web Audio in this browser
    await engine;
    for (const c of this.companions) {
      c.sounds.ensure();
      jobs.push(c.sounds.loading);
    }
    jobs.push(rideBuffers(hub).loading);
    tick();
    await Promise.all(jobs.map((job) => Promise.resolve(job).then(() => {
      done++;
      tick();
    })));
  }

  /** The start or pause card is up (not the small hint the tuning panel and console leave, nor the toolbox): the farm stands still. */
  isPaused() {
    const o = (this.overlayEl ??= document.getElementById('overlay'));
    return !!o && overlayPauses(o.classList, o.style.display);
  }

  /** Stops or restarts everything that runs on its own: the sound and the browser's speech (the simulation is skipped in `frame`). */
  setPaused(on) {
    this.audioHub.setPaused(on); // every frame: a click can switch the sound back on while the card is still up
    if (this.paused === on) return;
    this.paused = on;
    this.redraw = true;
    if (typeof speechSynthesis !== 'undefined') {
      if (on) speechSynthesis.pause();
      else speechSynthesis.resume();
    }
  }

  // The console's switches (src/console) ---------------------------------------------------------------

  /** Changes the weather to a kind at once, with the sky, the rain and the frost on the seats following. */
  /** The debug panel's and the console's stream level: sets it at once, for the water, the hill and the engine's drowning to follow. */
  setStreamLevel(level) {
    this.world.streamLevel.set(level);
    this.world.setStreamLevel();
  }

  setWeatherKind(kind) {
    if (!this.weather.setKind(kind)) return false;
    this.forecast.cancel(); // set by hand: the day no longer turns, and the board has nothing to say
    this.weather.promise = null;
    this.world.setWeather(this.weather);
    for (const unit of this.units) unit.quad.seatFrost = this.weather.seatFrost;
    return true;
  }

  /** How hard it is raining now, 0 to 1 (it settles back to what the weather would do in time). */
  /** Holds the mist in the barley hollow at a level now (the console), or null to let the morning decide. */
  setMist(level) {
    this.mist.forced = level === null ? null : Math.max(0, Math.min(1, level));
    if (this.mist.forced !== null) this.mist.level = this.mist.forced;
  }

  /** Holds a rainbow at a strength now (the console), or null to let the weather decide. */
  setRainbow(strength) {
    this.rainbow.forced = strength === null ? null : Math.max(0, Math.min(1, strength));
    if (this.rainbow.forced !== null) this.rainbow.strength = this.rainbow.forced;
  }

  setRain(amount) {
    this.weather.rain = this.weather.target = Math.max(0, Math.min(1, amount));
  }

  /** How hard it is snowing now, 0 to 1 (it settles back to what the weather would do in time). */
  setSnow(amount) {
    this.weather.snow = this.weather.snowTarget = Math.max(0, Math.min(1, amount));
  }

  /** How far the ground and the seats are under snow, 0 to 1. */
  setSnowCover(amount) {
    this.weather.cover = Math.max(0, Math.min(1, amount));
    for (const unit of this.units) unit.quad.seatFrost = this.weather.seatFrost;
  }

  /** The day's temperature in degrees C. */
  setTemperature(celsius) {
    // It goes on following the time of day from there: the day's warmest moves so that it is this now.
    if (this.daylight) this.weather.peak = this.daylight.peakFor(celsius);
    this.weather.temperature = celsius;
    for (const unit of this.units) unit.quad.seatFrost = this.weather.seatFrost;
  }

  /** Sets the time of day (hours after midnight; past 24 is the same night going on), with the temperature and the frost following at once. */
  setTime(hour) {
    if (!this.daylight) return;
    this.daylight.hour = hour;
    this.weather.temperature = Math.round(this.daylight.temperature(this.weather.peak) * 10) / 10;
    for (const unit of this.units) unit.quad.seatFrost = this.weather.seatFrost;
  }

  /** On: the girls start things on their own as usual. Off: nothing new starts; they follow, ride and answer you. */
  setGirlsAuto(on) {
    this.girlsAuto = on;
    for (const c of this.companions) c.params.ownMind = on;
  }

  /** Free-fly for the player (flight.js). */
  setFlying(on) {
    if (on && this.player.isRiding) return this.hud.toast('Get off first');
    this.player.flying = on;
    this.hud.toast(on ? 'Flying: WASD, Space up, C down, Shift fast' : 'Walking', 1.6);
  }

  /** ?cam=x,y,z,yawDeg,pitchDeg places the camera, for screenshots while developing. */
  applyDebugCamera() {
    const cam = new URLSearchParams(location.search).get('cam');
    if (!cam) return;
    const [x, y, z, yaw = 0, pitch = 0] = cam.split(',').map(Number);
    this.debugCamera = true;
    this.camera.position.set(x, y, z);
    this.camera.rotation.set((pitch * Math.PI) / 180, (yaw * Math.PI) / 180, 0, 'YXZ');
  }

  /** Builds every shader now, with the start screen up, rather than on the first frame that shows each (core/shaderPrep.js). Resolves when they are linked;
   * `shadersReady` is the same promise, and `shaderPrep` says what it cost. */
  prepareShaders() {
    this.shadersReady ??= prepareShaders(this.renderer, this.scene, this.camera).then((r) => (this.shaderPrep = { ...r, programs: this.renderer.info.programs.length }));
    return this.shadersReady;
  }

  start() {
    setTimeout(() => this.dressFinds(), 300); // the barn finds' damage, now the load is done
    const overlay = document.getElementById('overlay');
    overlay.addEventListener('click', () => {
      this.audioHub.unlock();
      this.input.requestPointerLock();
    });
    this.input.on('lockchange', (locked) => {
      overlay.classList.toggle('hidden', locked);
      if (!locked) {
        this.input.padPlaying = false;
        this.closeMenu();
      }
    });
    // A pad is seen once a button is pressed on it; the card then says how to start.
    const padLine = document.getElementById('overlay-pad');
    const sayPad = (names) => {
      if (padLine) padLine.textContent = names.length ? 'Gamepad found: press Start to play.' : '';
    };
    sayPad(this.input.padNames());
    this.input.on('padchange', sayPad);
    // The farm saves when you leave it, as well as every so often (updateFarmSave).
    addEventListener('pagehide', () => this.saveFarm());
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && this.saveFarm());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** What the pad's buttons mean right now (input/gamepad.js): a menu, the saddle, on foot, or nothing behind the start card. */
  padContext() {
    if (this.isPaused()) return { mode: 'paused' };
    const bucketOpen = this.hud.bucketOpen;
    if (this.menu.isOpen) return { mode: 'menu', menu: 'wheel' };
    if (this.workshop.isOpen) return { mode: 'menu', menu: 'workshop' };
    if (this.bench.isOpen) return { mode: 'menu', menu: 'bench' };
    if (this.notebook.isOpen || this.sparesShelf.isOpen || this.jobBoardView.isOpen || this.classifiedsView.isOpen || this.moneyTin.isOpen || this.storiesView.isOpen || this.shedView.isOpen || this.photos.view.isOpen) return { mode: 'menu', menu: 'notebook' };
    if (this.player.isRiding) {
      const q = this.riddenUnit?.quad;
      return { mode: 'ride', seat: this.player.seat, bucketOpen, gear: q?.manual ? q.drivetrain.gear : null, gears: q?.gearbox?.gears ?? 0 };
    }
    return { mode: 'foot', bucketOpen };
  }

  /** Reads the pad at the top of a frame: Start plays, pauses or shuts the radial menu, and the radial menu is drawn. */
  pollPad(dt) {
    const s = this.input.poll(dt, this.padContext());
    this.radialPad.update(s.radial);
    if (s.start) {
      if (this.isPaused()) this.startFromPad();
      else this.pauseFromPad();
    }
  }

  /** Drives the pad's motors from the seat's vibration: the low one from the engine and the ground, the high one from the bars. */
  updateRumble(dt, board) {
    const effect = this.rumble.update(dt, board ? board.vibration : null, { rider: this.player.seat === 'rider' });
    if (effect) playRumble(effect, navigator.getGamepads?.());
  }

  startFromPad() {
    this.audioHub.unlock();
    document.getElementById('overlay').classList.add('hidden');
    this.input.padPlaying = true;
    this.input.requestPointerLock();
  }

  pauseFromPad() {
    this.input.padPlaying = false;
    if (this.input.pointerLocked) this.input.exitPointerLock(); // its lockchange shows the card
    else {
      document.getElementById('overlay').classList.remove('hidden');
      this.closeMenu();
    }
  }

  /** The tractor walking off on its own: they remark on it, one runs after it and stops it, or it reaches the hedge (npc/tractorRunaway.js). */
  updateTractorRunaway(dt, ridden) {
    const unit = this.tractorUnit;
    const q = unit.quad;
    const girlOf = (id) => this.companions.find((c) => c.character.id === id);
    const stalled = q.creepStalled;
    q.creepStalled = false;
    const job = this.runawayJob;
    if (job) {
      const c = job.girl;
      job.time += dt;
      const caught = c.root.position.distanceTo(q.position) < 2.4;
      if (caught && q.creeping) {
        // Up beside the seat: the hand throttle shut, out of gear and the stop knob pulled.
        q.handSetting = 0;
        q.drivetrain.setGear(0);
        q.engine.stopKnob();
        c.voice.say('tractorRunawayStopped', { urgent: true });
      }
      if (caught || !q.creeping || ridden === unit || job.time > 40) {
        c.paceBoost = 1;
        this.runawayJob = null;
      } else if (c.fsm.is('idle')) c.fsm.transition('walking', { goal: 'stand', target: () => c.standPoint(undefined, q) });
    }
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      free: c.availability().free,
      dist: c.root.position.distanceTo(q.position),
    }));
    // The first hedge it's heading for, through the gateways (world/fields.js), less the hedge's thickness.
    const hedge = Math.max(0, this.world.fields.hedgeAhead(q.position.x, q.position.z, q.yaw) - this.world.layout.hedgeThickness);
    const ctx = { creeping: q.creeping, stalled, trailer: this.trailer.hitched, hedge, girls };
    for (const ev of this.tractorRunaway.update(dt, ctx)) {
      const c = girlOf(ev.girl);
      if (ev.type === 'note') c.voice.say(ev.trailer ? 'tractorCreepTrailer' : 'tractorCreepNote', { urgent: true });
      else if (ev.type === 'chase' && !this.runawayJob) {
        c.paceBoost = 2.4; // running, not walking
        this.runawayJob = { girl: c, time: 0 };
        c.fsm.transition('walking', { goal: 'stand', target: () => c.standPoint(undefined, q) });
        c.voice.say('tractorRunaway', { urgent: true });
      } else if (ev.type === 'hedge') {
        c.voice.say('tractorHedge', { urgent: true });
        this.hayLater.push({ left: 2, girl: c.others()[0], key: 'tractorHedgeBlame' });
      }
    }
  }

  /** The girls' remarks on the tractor (npc/tractorWatch.js). */
  updateTractorWatch(dt) {
    const unit = this.tractorUnit;
    const e = unit.quad.engine;
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      free: c.availability().free,
      x: c.root.position.x,
      z: c.root.position.z,
    }));
    const tractor = {
      x: unit.quad.position.x,
      z: unit.quad.position.z,
      running: e.isRunning,
      keyOn: e.ignitionOn,
      glowWaiting: this.riddenUnit === unit && e.ignitionOn && !e.isRunning && !e.glowHot && e.temperature < e.params.glowWarmAbove,
      caught: e.events.some((ev) => ev.type === 'caught'),
    };
    for (const ev of this.tractorWatch.update(dt, { tractor, girls })) {
      const girl = this.companions.find((c) => c.character.id === ev.girl);
      girl?.voice.say(`tractor${ev.type[0].toUpperCase()}${ev.type.slice(1)}`, { urgent: true });
    }
  }

  /** The girls' remarks when you come to the gravel pit's lip and when your engine stops down in it (npc/quarryWatch.js). */
  updateQuarryWatch(dt) {
    const quarry = this.world.fields.quarry;
    if (!quarry) return;
    const unit = this.boardUnit;
    const at = unit ? unit.quad.position : this.camera.position;
    const { a, s } = quarry.polar(at.x, at.z);
    const girls = this.companions.map((c) => ({ id: c.character.id, free: c.availability().canRemark, x: c.root.position.x, z: c.root.position.z }));
    const running = !!unit && unit.quad.engine.isRunning;
    for (const ev of this.quarryWatch.update(dt, { you: { x: at.x, z: at.z }, fromLip: quarry.inQuarry(at.x, at.z) ? s - quarry.rimAt(a) : Infinity, inPit: quarry.inPit(at.x, at.z), running, girls })) {
      this.companions.find((c) => c.character.id === ev.girl)?.voice.say(ev.type === 'near' ? 'pitNear' : 'pitStall', { urgent: ev.type === 'stall' });
    }
  }

  /** The girls' remarks at the river's crossing and when its deep water drowns your engine (npc/riverWatch.js). */
  updateRiverWatch(dt) {
    const river = this.world.river;
    if (!river) return;
    const cam = this.camera.position;
    const unit = this.boardUnit;
    const at = unit ? unit.quad.position : cam;
    const girls = this.companions.map((c) => ({ id: c.character.id, free: c.availability().canRemark, x: c.root.position.x, z: c.root.position.z }));
    const e = this.riddenUnit?.quad.engine;
    const drowned = !!e && e.water >= e.params.waterStallAt && river.zoneAt(at.x, at.z) === 'deep';
    const cz = this.world.heights.brook.zAt(river.cross.x);
    for (const ev of this.riverWatch.update(dt, { you: { x: at.x, z: at.z }, crossing: { x: river.cross.x, z: cz }, drowned, girls })) {
      this.companions.find((c) => c.character.id === ev.girl)?.voice.say(ev.type === 'near' ? 'riverNear' : 'riverStall', { urgent: ev.type === 'stall' });
    }
  }

  /** Where you are at the gravel pit and how it is dealt, with the pit climb, for the panel and the console. */
  describeQuarry() {
    const quarry = this.world.fields.quarry;
    if (!quarry) return 'no gravel pit on this farm';
    const at = this.boardUnit ? this.boardUnit.quad.position : this.camera.position;
    const { a, s } = quarry.polar(at.x, at.z);
    const where = !quarry.inQuarry(at.x, at.z) ? 'you are away from it' : quarry.inPit(at.x, at.z) ? `you are down in it, ${(quarry.rimAt(a) - s).toFixed(0)} m in from the lip` : `you are ${(s - quarry.rimAt(a)).toFixed(0)} m from the lip`;
    const p = quarry.pit;
    const wall = quarry.frameAt(p.steepAt, 10);
    const dx = wall.x - p.x;
    const dz = wall.z - p.z;
    const side = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'east' : 'west') : dz > 0 ? 'south' : 'north';
    const pc = this.pitClimb;
    const climb = pc.running ? `timing ${pc.run.time.toFixed(1)} s` : pc.youArmed ? 'you are asked for' : 'idle';
    const best = this.records.best('pit');
    return `${where}; ${p.depth.toFixed(1)} m deep, ${(p.rx * 2).toFixed(0)} by ${(p.rz * 2).toFixed(0)} m; steep wall on the ${side} side, ${p.chutes.length} chutes; haul road ${quarry.roadLength.toFixed(0)} m, ${p.road.dir > 0 ? 'clockwise' : 'anticlockwise'} down; ${p.heaps.length} heaps; pit climb ${climb}${best ? `, best ${formatValue('pit', best.value)}` : ''}`;
  }

  /** Where you are at the river and how the crossing stands, for the panel and the console. */
  describeRiver() {
    const river = this.world.river;
    if (!river) return 'no river on this farm';
    const at = this.boardUnit ? this.boardUnit.quad.position : this.camera.position;
    const zone = river.zoneAt(at.x, at.z);
    return `${zone ? `you are ${zone === 'crossing' ? 'on the crossing' : zone === 'deep' ? 'in the deep water' : 'on the bank'}` : 'you are away from it'}; the river is ${(this.world.streamLevel.level * 100).toFixed(0)}% up`;
  }

  /** J on the tractor or a quad with a rack: hook a trailer on when the hitch is at its ring, or take it off when you're stopped. */
  toggleHitch() {
    const unit = this.riddenUnit;
    if (!unit || !canTow(unit.quad)) return;
    const q = unit.quad;
    const tractor = !!this.tractorUnit && unit === this.tractorUnit;
    const hay = tractor ? this.trailer : null;
    const tip = this.tipTrailer;
    const mine = [hay, tip, this.sprayer].filter(Boolean);
    const blocked = this.hitchBlock(q);
    if (blocked) return this.hud.toast(blocked, 2);
    const on = mine.find((t) => t.hitched && (t === hay || t.puller === q));
    if (on) {
      if (q.speed > 0.5) return this.hud.toast('Stop before you unhitch the trailer', 2);
      on.unhitch();
      return this.hud.toast(tractor ? 'Trailer unhitched, bale spike fitted again' : 'Trailer unhitched', 2);
    }
    const can = mine.find((t) => t.canHitch(q));
    if (can) {
      can.hitch(q);
      this.achievements.note('hitched');
      return this.hud.toast(tractor ? 'Trailer hitched, bale spike taken off' : 'Trailer hitched', 2);
    }
    const near = Math.min(...mine.filter((t) => !t.hitched).map((t) => t.gap(q)));
    this.hud.toast(near < 8 ? 'Back the hitch up to the trailer\'s ring' : 'No trailer behind you', 2);
  }

  /** Why this vehicle's hitch is not free to take a trailer, or null. */
  hitchBlock(q) {
    if (q === this.tractorUnit?.quad) {
      if (this.chain?.state !== 'stowed') return 'The tow chain is on the drawbar';
      if (this.baleRig.held) return 'Put the bale down first: it is on the spike';
    } else if (this.towRope.state !== 'stowed' && this.towRope.puller === q) return 'The tow rope is on the hitch';
    return null;
  }

  /**
   * A trailer's drawbar, for E on foot (J is the same from the seat): { prompt, run } to hook on the vehicle parked at its ring or take it off,
   * or null when there is nothing to do.
   */
  drawbarAction(t, name) {
    const tractor = this.tractorUnit?.quad;
    if (t.hitched) {
      const q = t.tractor ?? t.puller;
      if (q.rider || q.driver) return null; // somebody is on it: J is theirs
      if (q.speed > 0.5) return { prompt: { info: `The ${name} is moving` } };
      return { prompt: `Unhitch the ${name}`, run: () => (t.unhitch(), this.hud.toast(`${name[0].toUpperCase()}${name.slice(1)} unhitched${q === tractor ? ', bale spike fitted again' : ''}`, 2)) };
    }
    const q = this.units.map((u) => u.quad).find((c) => (t === this.trailer ? c === tractor : canTow(c)) && !c.rider && !c.driver && t.canHitch(c));
    if (!q) return null;
    const why = this.hitchBlock(q);
    if (why) return { prompt: { info: why } };
    return {
      prompt: `Hook on the ${name}`,
      run: () => {
        t.hitch(q);
        this.achievements.note('hitched');
        this.hud.toast(`${name[0].toUpperCase()}${name.slice(1)} hitched${q === tractor ? ', bale spike taken off' : ''}`, 2);
      },
    };
  }

  /** A box at each trailer's drawbar to look at: E hooks it on to the vehicle backed up to its ring, or takes it off. */
  setUpDrawbars() {
    for (const [t, name] of [[this.trailer, 'bale trailer'], [this.tipTrailer, 'tipping trailer'], [this.sprayer, 'sprayer']]) {
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.9), new THREE.MeshBasicMaterial({ visible: false }));
      proxy.position.set(0, 0.5, t.motion.p.drawLength);
      t.model.add(proxy);
      this.interaction.add({
        target: proxy,
        priority: 1, // the trailer's own box is round it
        isAvailable: () => !this.player.isRiding && !this.handsFull && !!this.drawbarAction(t, name),
        prompt: () => this.drawbarAction(t, name)?.prompt ?? { info: '' },
        feedback: 'latch',
        interact: () => this.drawbarAction(t, name)?.run?.(),
      });
    }
  }

  /** The trailer a vehicle has on its hook, if any. */
  trailerOf(quad) {
    return [this.trailer, this.tipTrailer, this.sprayer].find((t) => t.hitched && (t.tractor ?? t.puller) === quad) ?? null;
  }

  /** A trailer that has just folded up against what is pulling it (reversed too far on the lock): the puller can't push any further. */
  noteFolded(t, ridden) {
    if (!t.motion.justJammed) return;
    const puller = t.tractor ?? t.puller;
    if (puller === ridden?.quad) this.hud.toast('The trailer has folded against you: pull forward to straighten it', 3);
    this.notice('bang', t.model.position, { key: 'jackknife', strength: 0.5 });
  }

  /** The debug panel's jack-knife (fold it right over) and unjam (straighten it up). */
  debugJackknife(unit, fold = true) {
    const t = this.trailerOf(unit.quad);
    if (!t) return 'Nothing hitched to it';
    const q = unit.quad;
    const limit = t.motion.p.jackknifeAngle;
    t.motion.setHitchAngle(fold ? limit + 0.05 : 0, q.yaw, t.pinOf(q));
    t.apply();
    return fold ? 'Trailer folded against it' : 'Trailer straightened';
  }

  /** The hay ride: the trailer follows the tractor, and the girls climb on, bounce about, lie back, fall off and climb down (npc/hayRide.js). */
  updateHayRide(dt, ridden, input) {
    const t = this.trailer;
    this.updateTrailerLoad(dt, ridden, input);
    t.update(dt, this.loadCtx);
    this.handleLoadEvents(t.events);
    this.noteFolded(t, ridden);
    // A quad on the back is weight for the tractor (the empty trailer takes nothing, as before).
    const puller = this.tractorUnit?.quad;
    if (puller && t.hitched && t.loaded) {
      Object.assign(puller.tow, towEffect(t.loaded.params.mass ?? 290, true, this.towParams));
      this.hayWeighs = true;
    } else if (puller && this.hayWeighs) {
      if (!this.tipTrailer.hitched || this.tipTrailer.puller !== puller) Object.assign(puller.tow, { driveFactor: 1, brakeFactor: 1 });
      this.hayWeighs = false;
    }
    const m = t.motion;
    const active = t.hitched && !!ridden && ridden === this.tractorUnit;
    const free = (c) => c.availability({ mine: 'hayFell' }).free; // a girl who fell off is still free to catch it up
    const girlOf = (id) => this.companions.find((c) => c.character.id === id);
    const say = (c, key) => c?.voice.say(key, { urgent: true });

    // Whoever has come off is straight after it, running, and nobody waits for the tractor to stop.
    for (const c of this.companions) {
      if (!c.hayFell || !c.fsm.is('idle')) continue;
      if (!active) c.hayFell = false;
      else if (free(c)) {
        const slot = t.freeSlot(c.root.position);
        if (slot) c.boardTrailer(t, slot, { chase: true });
      }
    }
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      free: free(c) && !c.hayFell,
      aboard: c.onHayRide && c.trailer === t,
      dist: c.root.position.distanceTo(t.model.position),
      seatX: c.traSlot ? c.traSlot.side * 0.5 : 0,
    }));
    for (const ev of this.hayRide.update(dt, { active, speed: m.speed, omega: m.omega, jolt: m.jolt, girls })) {
      const c = girlOf(ev.girl);
      if (ev.type === 'board') {
        const slot = t.freeSlot(c.root.position);
        if (slot && c.boardTrailer(t, slot)) say(c, 'hayBoard');
      } else if (ev.type === 'leave') {
        c.leaveTrailer();
        c.abortBoarding();
      } else if (ev.type === 'lie') {
        c.hayLie(true);
        say(c, 'hayLie');
      } else if (ev.type === 'sit') c.hayLie(false);
      else if (ev.type === 'bump') {
        for (const o of this.companions) o.hayFlail();
        say(c, 'hayBump');
      } else if (ev.type === 'slide') {
        if (c.slideOffTrailer(ev.side)) this.hayRide.clear(ev.girl);
      }
    }
    // A girl who has just landed says so, and the other one sees it.
    for (const c of this.companions) {
      if (!c.hayLanded || c.hayLandedSaid) c.hayLandedSaid &&= c.hayLanded;
      else {
        c.hayLandedSaid = true;
        const [own, other] = c.trailer && c.trailer === this.utvMount ? ['utvTipOut', 'utvTipLaugh'] : c.trailer === this.tipTrailer ? ['trailerTipOut', 'trailerTipLaugh'] : ['hayFall', 'hayFallOther'];
        say(c, own);
        this.hayLater.push({ left: 1.2, girl: c.others()[0], key: other });
      }
    }
    for (const l of this.hayLater) l.left -= dt;
    for (const l of this.hayLater.filter((x) => x.left <= 0)) say(l.girl, l.key);
    this.hayLater = this.hayLater.filter((x) => x.left > 0);
  }

  /** Everything about a quad on the bale trailer: T for the ramps, hold X to winch (with Shift to pay out), V to push it up, and the load's inputs. */
  updateTrailerLoad(dt, ridden, input) {
    const t = this.trailer;
    this.loadCtx = { winch: 0, push: 0 };
    const onFoot = !this.player.isRiding && !this.menu.isOpen && !this.workshop.isOpen;
    const g = t.geometry;
    const foot = t.model.localToWorld(new THREE.Vector3(0, 0, g.footZ));
    const seated = !!ridden && ridden === this.tractorUnit && t.hitched && ridden.quad.speed < 0.8 && !ridden.quad.isTipped;
    const nearRear = onFoot && this.player.position.distanceTo(foot) < 5;
    if ((nearRear || seated) && input.wasPressed('KeyT') && !this.handsFull) {
      const note = t.toggleRamps();
      this.hud.toast(note ?? (t.rampWant ? 'Ramps down' : 'Ramps up'), 1.8);
    }
    if (this.loadForced && t.load) {
      this.loadCtx.winch = this.loadForced === 'down' ? -1 : 1;
      if (this.loadForced === 'up' && t.load.mode === 'aboard') this.loadForced = null;
    } else if (!t.load) this.loadForced = null;
    if (!onFoot) return;
    const eligible = (unit) => this.loadBlock(unit);
    // Pushed (V) straight onto the foot of the ramp it starts up by itself.
    if (!t.load && t.rampsOpen) {
      for (const unit of this.units) {
        const q = unit.quad;
        if (!q.pushDir || eligible(unit)) continue;
        const line = t.lineUp(q);
        if (line.ok && q.pushDir * line.facing > 0) {
          t.startLoad(q, { winch: false, facing: line.facing });
          break;
        }
      }
    }
    const looked = this.interaction.focused?.unit;
    if (t.load) {
      const q = t.loaded;
      if (!t.load.held) this.loadCtx.push = q.pushDir * t.load.facing;
    }
    // Hold X near the foot of the ramp to winch the nearest quad on (Shift to pay out).
    const near = this.player.position.distanceTo(foot) < 9;
    if (near && t.rampsOpen && input.isDown('KeyX') && !this.handsFull && looked !== this.winch?.unit && looked !== this.tractorUnit) {
      const out = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
      if (t.load && (t.load.mode !== 'aboard' || !t.load.strapped)) this.loadCtx.winch = out ? -1 : 1;
      else if (t.load?.strapped && input.wasPressed('KeyX')) this.hud.toast('Undo the strap first (E on the quad)', 2);
      else if (!t.load && !out) {
        const fits = this.units
          .filter((u) => t.inReach(u.quad))
          .sort((a, b) => a.quad.position.distanceTo(foot) - b.quad.position.distanceTo(foot));
        const pick = fits.find((u) => !eligible(u));
        if (pick) {
          t.startLoad(pick.quad, { winch: true, facing: 1 });
          this.loadCtx.winch = 1;
        } else if (input.wasPressed('KeyX')) {
          this.hud.toast(fits.length ? eligible(fits[0]) : 'No quad within reach of the winch', 2.4);
        }
      }
    }
  }

  /** Why this quad can't go on the trailer now, or null if it can (vehicle/quadLoad.js mayLoad). */
  loadBlock(unit) {
    const q = unit.quad;
    const busy = this.companions.some((c) => c.quad === q && !c.fsm.is('idle'));
    return mayLoad({
      running: q.engine.isRunning,
      occupied: !!(q.rider || q.driver || q.passenger || q.input || q.ghost || busy),
      tipped: q.isTipped,
      excluded: !!(unit.spec.tractor || unit.spec.utv || unit.spec.landRover || unit.spec.car || unit.barnFind),
      hooked: !!(q.towed || this.winch?.target === q || this.chain?.target === q || this.towRope?.target === q),
    });
  }

  /** Debug panel and console: ramps down at once, and the trailer's winch fetches this quad up (as holding X would). Returns a note. */
  debugLoad(unit) {
    const t = this.trailer;
    if (t.load) return 'The trailer already has a quad on it';
    const why = this.loadBlock(unit);
    if (why) return why;
    t.rampWant = true;
    t.ramp = 1;
    t.refreshRamps();
    const at = t.model.localToWorld(new THREE.Vector3(0, 0, t.geometry.footZ - 3));
    unit.quad.placeAt(at.x, at.z, t.motion.yaw);
    unit.quad.model.position.copy(unit.quad.currPos); // the model catches up on the next frame; the load wants it now
    unit.quad.model.quaternion.copy(unit.quad.currQuat);
    t.startLoad(unit.quad, { winch: true, facing: 1 });
    this.loadForced = 'up';
    return 'winching it on';
  }

  /** Debug panel and console: the winch pays it back down the ramp. */
  debugUnload(unit) {
    const t = this.trailer;
    if (t.loaded !== unit.quad) return 'it is not on the trailer';
    t.rampWant = true;
    t.ramp = 1;
    t.refreshRamps();
    t.load.strapped = false;
    this.loadForced = 'down';
    return 'paying it out';
  }

  /** What happened to the load this step: a toast and now and then a word from a girl. */
  handleLoadEvents(events = []) {
    const t = this.trailer;
    const say = (key) => this.loadVoice(key, t.model.position);
    for (const e of events) {
      if (e === 'aboard') {
        this.hud.toast('It is on: E on the quad to strap it down', 2.4);
        say('loadAboard');
      } else if (e === 'released') this.hud.toast('Let go at the foot of the ramp', 1.6);
      else if (e === 'thump') this.hud.toast('It slid into the front. Strap it down', 2);
      else if (e === 'slid') {
        this.hud.toast('It slid off the back', 2);
        say('loadSlid');
      }
    }
  }

  loadedPrompt(quad) {
    const l = this.trailer.load;
    if (!l || l.mode !== 'aboard') return { text: 'On the ramps   ·   hold X to wind it up (Shift X to pay out), V to push it up' };
    if (l.strapped) return 'Undo the strap';
    return `Strap the ${this.units.find((u) => u.quad === quad)?.label ?? 'quad'} down`;
  }

  /** E on a quad on the trailer: the ratchet strap. */
  strapDown(quad) {
    const l = this.trailer.load;
    if (!l) return;
    const note = l.toggleStrap();
    if (note) return this.hud.toast(note, 2);
    this.hud.toast(l.strapped ? 'Strapped down' : 'Strap off', 1.6);
    if (l.strapped) this.loadVoice('loadStrap', quad.position);
  }

  /** One of the girls near the trailer, picked from the seed, says a loading line. */
  loadVoice(key, at) {
    this.loadRandom ??= createRandom(this.seed ^ 0x10ad);
    const near = this.companions.filter((c) => c.root.position.distanceTo(at) < 25);
    if (near.length) near[Math.floor(this.loadRandom() * near.length)].voice.say(key, { urgent: false });
  }

  /** The wheel's "Tractor" slice for a girl: up on the mudguard (or down again), or a go at driving it. */
  tractorWheelOption(c) {
    const unit = this.tractorUnit;
    const children = [];
    if (c.fsm.is('onTrailer') && c.trailer === this.tractorMount) children.push({ label: 'Get down off the tractor', run: () => (this.mudguard.dismiss(c.character.id), c.leaveTrailer()) });
    else if (c.fsm.is('idle')) {
      if (!this.trailer.hitched && this.tractorMount.freeSlot(c.root.position)) children.push({ label: 'Climb up on the mudguard', run: () => this.askOntoTractor(c) });
      if (this.tractorFree() && c.canDrive(unit.quad)) children.push({ label: 'Drive it', run: () => this.askDriveTractor(c) });
      if (this.canAskStart(c, 'tractor')) children.push({ label: 'Start it', run: () => c.requestStart(unit.quad) });
    }
    return { label: 'Tractor', color: unit.spec.bodyColor, children };
  }

  /** Nobody's on the tractor or on their way to it, it's stopped, and nothing is hitched to it. */
  tractorFree() {
    if (!this.tractorUnit) return false;
    const q = this.tractorUnit.quad;
    const busy = (c) => (c.quad === q && (c.fsm.is('driving', 'mounting', 'dismounting', 'shuffling') || (c.fsm.is('walking') && c.fsm.data?.goal === 'drive'))) || (c.onHayRide && c.trailer === this.tractorMount);
    return !q.rider && q.speed < 0.5 && !this.trailer.hitched && !this.companions.some(busy);
  }

  /** You ask her for a go on the tractor: Jess is thrilled, and Amy says no until her day has come. */
  askDriveTractor(c) {
    this.askDriveVehicle(c, 'tractor');
  }

  /** The tractor, the UTV and the two Land Rovers as the girls' goes know them: { unit, free(), ask line, refuse line }. */
  goVehicle(kind) {
    return { tractor: this.tractorUnit, utv: this.utvUnit, landy: this.landys.landy.unit, defender: this.landys.defender.unit, fiesta: this.landys.fiesta?.unit, corsa: this.landys.corsa?.unit, p309: this.landys.p309?.unit }[kind] ?? null;
  }

  /** Which of them this unit is, or null. */
  goKindOf(quad) {
    return GO_KINDS.find((k) => this.goVehicle(k)?.quad === quad) ?? null;
  }

  /** The seats of a UTV or Land Rover kind ('utv', 'landy', 'defender'): the mount the girls climb into. */
  mountOfKind(kind) {
    return kind === 'utv' ? this.utvMount : this.landys[kind].mount;
  }

  /** And the riding logic that goes with them. */
  rideOfKind(kind) {
    return kind === 'utv' ? this.utvRide : this.landys[kind].ride;
  }

  /** Nobody is in or on it or on their way to it, it's stopped, and (for the tractor) nothing is hitched; for the UTV the bed is down and empty. */
  goFree(kind) {
    const unit = this.goVehicle(kind);
    if (!unit) return false;
    if (kind === 'tractor') return this.tractorFree();
    const q = unit.quad;
    const mount = this.mountOfKind(kind);
    const busy = (c) => (c.quad === q && (c.fsm.is('driving', 'mounting', 'dismounting', 'shuffling', 'cranking') || (c.fsm.is('walking') && ['drive', 'crank'].includes(c.fsm.data?.goal)))) || (c.onHayRide && c.trailer === mount);
    if (kind === 'utv' && (this.utvBed.tip > 0.02 || mount.bedBusy)) return false;
    return !q.rider && !q.driver && !q.passenger && !q.isTipped && q.speed < 0.5 && !this.companions.some(busy);
  }

  /**
   * She can be asked to start it: stood about, it isn't running and nobody's on it or going to it. Either girl will, Amy too (she won't drive
   * them until her day, but she'll start them); on the Land Rover with a flat battery that means the starting handle.
   */
  canAskStart(c, kind) {
    const q = this.goVehicle(kind)?.quad;
    return !!q && c.fsm.is('idle') && !q.engine.isRunning && this.goFree(kind);
  }

  /** You ask her for a go: Jess is thrilled, and Amy says no until her day has come. */
  askDriveVehicle(c, kind) {
    const id = c.character.id;
    const line = { tractor: ['tractorRefuse', 'tractorGoAsk'], utv: ['utvRefuse', 'utvGoAsk'], landy: ['landyRefuse', 'landyGoAsk'], defender: ['defenderRefuse', 'defenderGoAsk'], fiesta: [null, 'carGoOff'], corsa: [null, 'carGoOff'], p309: [null, 'carGoOff'] }[kind];
    const refuse = OWNED_KINDS.includes(kind) ? refuseCarLine(id, this.landys[kind].spec) : this.tractorGo.ask(id) === 'refuse' ? line[0] : null;
    if (refuse) return void c.voice.say(refuse, { force: true });
    this.startGo(c, kind);
    c.voice.say(line[1], { force: true });
  }

  /** Jess tapes L plates to Amy's quad, Amy peels them off, and once she's confident she tapes them to the tractor (npc/lPlates.js). */
  /** What the L plates need to know (npc/lPlates.js), or null without both girls. */
  lPlatesContext() {
    const amy = this.companions.find((c) => c.character.id === 'amy');
    const jess = this.companions.find((c) => c.character.id === 'jess');
    if (!amy || !jess) return null;
    const mine = this.girlUnits.find((u) => u.spec.id === amy.claimedSpec);
    const near = mine ? Math.hypot(amy.root.position.x - mine.quad.position.x, amy.root.position.z - mine.quad.position.z) < 4 : false;
    return { amyFree: amy.availability().free, jessFree: jess.availability().free, amyByQuad: near, hasQuad: !!mine, confidence: meanSkill(this.skills.levels.amy), tractorFree: this.tractorFree() };
  }

  /** Acts on the L plates (npc/lPlates.js): Jess taping them on and Amy moving them to the tractor (their choices), Amy peeling them off. */
  handleLPlateEvent(ev) {
    const amy = this.companions.find((c) => c.character.id === 'amy');
    const jess = this.companions.find((c) => c.character.id === 'jess');
    if (ev.type === 'jessTape') {
      jess.voice.say('lplateTape', { force: true });
      this.hayLater.push({ left: 4, girl: amy, key: 'lplateFound' });
    } else if (ev.type === 'amyPeel') {
      amy.voice.say('lplatePeel', { force: true });
      this.hayLater.push({ left: 3.5, girl: jess, key: 'lplateCheek' });
    } else if (ev.type === 'amyStick') {
      amy.voice.say('lplateStick', { force: true });
      this.hayLater.push({ left: 4, girl: jess, key: 'lplateTractor' });
    }
  }

  updateLPlates(dt) {
    const ctx = this.lPlatesContext();
    if (!ctx) return;
    for (const ev of this.lPlates.update(dt, ctx)) this.handleLPlateEvent(ev);
    const amy = this.companions.find((c) => c.character.id === 'amy');
    const mine = this.girlUnits.find((u) => u.spec.id === amy.claimedSpec);
    const where = this.lPlates.where;
    if (where === 'tractor' && this.tractorUnit) this.lPlateSet.showOn(this.tractorUnit.quad.bodyRoot, 'tractor');
    else this.lPlateSet.showOn(where === 'quad' && mine ? mine.quad.bodyRoot : null, 'quad');
  }

  /** She walks over and has a go at starting and driving the tractor, the UTV or the Land Rover. */
  startGo(c, kind) {
    const unit = this.goVehicle(kind);
    if (!c.homeQuad && c.quad !== unit.quad) c.homeQuad = c.quad;
    if (CAR_KINDS.includes(kind)) this.carGo.started(c.character.id);
    else this.tractorGo.started(c.character.id);
    this.tractorSeen[c.character.id] = { stalls: 0, hops: 0, crunches: 0, setOff: false, wasDriving: false, kind, joinRolled: false, joined: null };
    c.requestDrive(unit.quad);
  }

  /**
   * Jess takes one now and then, Amy has her day, and each of them says what's happening on her go (npc/tractorGo.js, tractorGoLines.js,
   * vehicleGoLines.js). On the UTV and the Land Rover the other girl may climb in beside her; on the Land Rover with a flat battery she
   * swings the starting handle first (npc/crankAttempt.js).
   */
  /** What you can show her from where you are: bump-starting a dead manual, double-declutching on a box with no synchromesh. */
  watchableNow() {
    const q = this.riddenUnit?.quad;
    if (!q || !this.player.isRiding) return [];
    const out = [];
    if (q.manual && !q.engine.isRunning) out.push('bumpStart');
    if (q.manual && (q.gearbox?.crashGears ?? 0) > 0 && q.engine.isRunning) out.push('doubleDeclutch');
    return out;
  }

  /** The wheel's "Watch me" slices: she's stood about near you and there's something to show. */
  watchWheelOptions(c) {
    if (!this.askable(c, ['idle']) || c.root.position.distanceTo(this.player.position) > this.watching.p.watchRange) return [];
    return this.watchableNow().map((thing) => ({ label: WATCH_THINGS[thing].label, run: () => this.startWatching(c, thing) }));
  }

  /** She's asked to watch for `thing` (no check that you can do it: the debug panel starts it from anywhere). She holds still and looks. */
  startWatching(c, thing) {
    if (!this.watching.begin(c.character.id, thing)) return false;
    c.hold('watching', 'watching you');
    c.voice.say('watchOk', { force: true });
    return true;
  }

  /** Where she should be looking while she watches: your quad if you're on one, else you. */
  watchPoint() {
    const q = this.player.isRiding ? this.riddenUnit?.quad : null;
    return q ? { x: q.position.x, y: q.position.y + 0.8, z: q.position.z } : { x: this.player.position.x, y: this.player.position.y + 1.2, z: this.player.position.z };
  }

  /** Each frame while a girl watches: she turns to look, and when you do the thing she learns it, if she was looking. */
  updateWatching(dt) {
    if (!this.watching.sessions.size) return;
    const girl = (id) => this.companions.find((c) => c.character.id === id);
    const at = this.watchPoint();
    const ridden = this.riddenUnit?.quad;
    const looking = (id) => {
      const c = girl(id);
      const k = c?.lookPick;
      if (!k) return false;
      return k.key === 'focus' || k.key === 'you' || (ridden && k.key === `vehicle:${this.riddenUnit.id}`);
    };
    for (const id of this.watching.sessions.keys()) {
      const c = girl(id);
      if (!c || !c.fsm.is('idle')) {
        this.watching.cancel(id);
        c?.release('watching');
      } else c.attend(at, { weight: this.watching.p.watchWeight, seconds: 0.3 });
    }
    const done = [];
    for (const e of this.watching.update(dt, looking)) done.push(e);
    const eng = ridden?.engine;
    if (eng?.caughtBy === 'roll' && eng.events.some((ev) => ev.type === 'caught')) done.push(...this.watching.shown('bumpStart').map((r) => ({ ...r, type: 'shown' })));
    if (ridden?.declutched) {
      ridden.declutched = false;
      done.push(...this.watching.shown('doubleDeclutch').map((r) => ({ ...r, type: 'shown' })));
    }
    for (const e of done) {
      const c = girl(e.id);
      if (!c) continue;
      c.release('watching');
      if (e.type === 'gaveUp') c.voice.say('watchGaveUp', { force: true });
      else if (this.skills.watch(e.id, e.skill, e.saw) === 'learnt') {
        this.favour.add(e.id, this.skills.p.taughtFavour);
        c.voice.say('watchLearnt', { force: true });
      } else c.voice.say('watchMissed', { force: true });
    }
  }

  /** What a girl says as she pushes your vehicle for a bump-start (npc/pushStart.js, pushLines.js). */
  updatePushStart() {
    const mine = this.riddenUnit?.quad.engine;
    if (mine?.caughtBy === 'roll' && mine.events.some((ev) => ev.type === 'caught')) {
      this.achievements.note('bumpStart');
      this.discoveries.learn('bumpStart');
    }
    for (const c of this.companions) {
      for (const e of c.pushEvents.splice(0)) {
        if (e === 'start') c.voice.say('pushStart', { urgent: true });
        else if (e === 'now') c.voice.say('pushNow', { urgent: true, force: true });
        else if (e === 'caught') c.voice.say('pushCaught', { urgent: true });
        else if (e === 'tired') c.voice.say('pushTired', { urgent: true });
      }
    }
  }

  /** You wave (key 6). Each girl answers by where she is and what she is doing (npc/playerWave.js). Returns what each did, for the tests and the console. */
  waveAtGirls({ force = false, only = null } = {}) {
    const now = performance.now() / 1000;
    const you = this.player.position;
    const done = [];
    for (const c of this.companions) {
      const id = c.character.id;
      if (only && id !== only) continue;
      if (this.player.isRiding && this.riddenUnit?.quad === c.quad) continue; // she's on your quad: nothing to wave at
      const at = c.root.parent === this.scene ? c.root.position : c.quad?.position ?? c.root.position;
      const asked = c.availability({ asked: true, pull: true });
      const kinds = generalRequests({ state: c.fsm.name, avail: asked, youDistance: Math.hypot(at.x - you.x, at.z - you.z) });
      const s = {
        distance: Math.hypot(at.x - you.x, at.z - you.z),
        state: c.fsm.is('driving') ? 'driving' : c.fsm.name,
        askable: kinds.includes('come') || (c.fsm.is('driving') && asked.free),
        canPullUp: !!c.drive?.canWaveStop?.(),
        canRemark: c.availability().canRemark,
        since: force ? Infinity : now - (this.lastWaveAnswer.get(id) ?? -Infinity),
      };
      const answer = answerWave(s, this.waveParams, id);
      if (!answer) continue;
      this.lastWaveAnswer.set(id, now);
      if (answer.kind === 'waveBack') {
        const from = { x: you.x, y: you.y + 1.5, z: you.z };
        // Her hand goes up, or Jess pulls a face instead (the camera's face reaction); if she can't, a wave.
        if (!c.react(answer.face ? 'face' : 'wave', { from, force: true })) c.react('wave', { from, force: true });
      } else if (answer.kind === 'comeOver') {
        c.interrupt();
        c.requestComeHere(you);
        c.voice.onRequest('come');
      } else if (c.drive.waveStop(this.waveParams.driverWaits)) {
        c.voice.onRequest('stop');
      }
      done.push({ id, kind: answer.kind });
    }
    return done;
  }

  /** You can ask her for something general now: she is in one of these states and free to be asked (soft jobs and holds give way). */
  askable(c, states) {
    return states.some((st) => c.fsm.is(st)) && c.availability({ asked: true, pull: true }).free;
  }

  /** The wheel's general slices, whatever she is up to (generalRequests.js): come here, stop, I'll be a minute. */
  generalWheelOptions(c) {
    const kinds = generalRequests({ state: c.fsm.name, avail: c.availability({ asked: true, pull: true }), youDistance: c.root.position.distanceTo(this.player.position) });
    const ask = (kind, run) => () => {
      c.interrupt();
      this.leaveRides(c);
      run();
      c.voice.onRequest(kind);
    };
    const options = [];
    if (kinds.includes('come')) options.push({ label: 'Come here', run: ask('come', () => c.requestComeHere(this.player.position)) });
    if (kinds.includes('stop')) options.push({ label: 'Stop there', run: ask('stop', () => c.requestStop()) });
    if (kinds.includes('wait') && !this.readyWaiting.has(c.character.id)) options.push({ label: 'I\'ll be a minute', run: () => this.askToWait(c) });
    return options;
  }

  /** The wheel's "Steer the towed quad" slice: the rope is on a quad nobody is on, and she can sit on it; or, if she is, getting off it. */
  towSteerOption(c) {
    const rope = this.towRope;
    if (c.fsm.is('driving') && c.drive?.towing) return { label: 'Get off the towed quad', run: () => c.stopDriving('off') };
    const unit = rope.state === 'hooked' ? this.units.find((u) => u.quad === rope.target) : null;
    if (!unit || !this.askable(c, ['idle', 'walking', 'seated', 'mounting']) || !c.canSteerTowed(unit.quad, rope)) return null;
    return { label: `Steer the towed ${unit.label}`, run: () => c.requestTowSteer(unit.quad, rope) };
  }

  /** The wheel's "Push start" slice: you're at the controls of a manual that won't start, and she's free to push it. */
  pushStartOption(c) {
    const unit = this.riddenUnit;
    if (!unit || !this.askable(c, ['idle', 'walking', 'driving', 'seated', 'mounting']) || !c.canPushStart(unit.quad)) return null;
    return { label: 'Push start it', run: () => c.requestPush(unit.quad) };
  }

  /** What a go in her own car needs to know (npc/carGo.js): for each girl, whether she is free and her car is. */
  carGoContext(ridden) {
    const girls = {};
    for (const c of this.companions) {
      const id = c.character.id;
      const kind = CAR_KINDS.find((k) => this.landys[k]?.unit && this.landys[k].spec.owner === id) ?? null;
      girls[id] = { free: c.availability().free, car: kind, carFree: !!kind && this.goFree(kind) && ridden !== this.goVehicle(kind), weight: c.params.carGoWeight ?? 0 };
    }
    return { girls };
  }

  /** She takes her car out (npc/carGo.js): she says so and goes, the same go as the Land Rovers', down the road and back. */
  handleCarGoEvent(ev) {
    const c = this.companions.find((o) => o.character.id === ev.girl);
    if (!c) return;
    c.voice.say('carGoOff', { force: true });
    this.startGo(c, ev.vehicle);
  }

  /**
   * You and the girls' cars: the go clock, and each owner minding you taking hers (npc/carGo.js Borrowing): when she sees you drive off in it,
   * when you bring it back, and, sat in it with you, what she thinks of your driving.
   */
  updateCars(dt) {
    this.carGo.update(dt);
    for (const kind of CAR_KINDS) {
      const l = this.landys[kind];
      if (!l?.unit) continue;
      const q = l.unit.quad;
      const owner = this.companions.find((c) => c.character.id === l.spec.owner);
      if (!owner) continue;
      const driving = this.riddenUnit === l.unit;
      const herIn = owner.onHayRide && owner.trailer === l.mount;
      const sees = !herIn && owner.root.position.distanceTo(q.position) < this.carGo.p.seenRange;
      const faults = Object.values(q.faults.levels).filter((v) => v > 0.05).length;
      for (const e of this.borrowing[kind].update({ driving, herIn, sees, faults, bogged: q.bog.stuck })) {
        if (e.favour) this.favour.add(owner.character.id, e.favour);
        const key = { taken: 'carTaken', ridden: 'carRidden', back: e.damaged ? 'carBackDamaged' : 'carBack' }[e.type];
        owner.voice.say(key, { urgent: true, force: e.type !== 'ridden' });
      }
      // Sat beside you in her own car: Amy can't bear it fast, Jess can't bear it slow, and neither likes it stalled.
      if (!driving || !herIn) {
        l.slowFor = 0;
        continue;
      }
      if (q.engine.events.some((ev) => ev.type === 'stalled')) owner.voice.say('carStalled', { urgent: true });
      const fast = owner.character.id === 'amy' ? 18 : Infinity; // m/s, about 40 mph
      if (Math.abs(q.speed) > fast) owner.voice.say('carTooFast', { urgent: true });
      l.slowFor = q.engine.isRunning && Math.abs(q.speed) > 1 && Math.abs(q.speed) < 7 ? (l.slowFor ?? 0) + dt : 0;
      if (owner.character.id === 'jess' && l.slowFor > 20) {
        owner.voice.say('carTooSlow', { urgent: true });
        l.slowFor = 0;
      }
    }
  }

  /** A girl sat in your car while you drive it has a view on it now and then (#229): the bottles, the smell of diesel, the CDs. */
  updateYourCar(dt) {
    const l = this.landys.p309;
    if (!l?.unit || this.riddenUnit !== l.unit || Math.abs(l.unit.quad.speed) < 3) return;
    const aboard = this.companions.filter((c) => c.onHayRide && c.trailer === l.mount && c.fsm.is('onTrailer'));
    if (!aboard.length) {
      l.remarkIn = null;
      return;
    }
    l.remarkIn = (l.remarkIn ?? 20 + Math.random() * 40) - dt; // a while into the drive, then the line's own cooldown spaces them
    if (l.remarkIn > 0) return;
    l.remarkIn = 60 + Math.random() * 90;
    aboard[Math.floor(Math.random() * aboard.length)].voice.say('yourCarRide', { chance: 0.8 });
  }

  /** The radios in the Land Rovers and the girls' cars (vehicle/radio.js): their sound, and what each girl does about the one she is sat by. */
  setUpRadios() {
    this.radioAudio = new RadioAudio(this.audioHub);
    this.radioTaste = {}; // per girl and vehicle, made when she first sits in one
    registerTuning('Radio', RADIO_PARAMS, RADIO_PARAM_RANGES);
    registerTuning('Radio: the girls', RADIO_TASTE_PARAMS, RADIO_TASTE_PARAM_RANGES);
    registerTuning('Radio: sound', this.radioAudio.p, { volume: [0, 1.5, 0.01], crackleRate: [0, 30, 0.5] });
  }

  /** Every unit that has a radio. */
  radioUnits() {
    return this.units.filter((u) => u.quad.radio);
  }

  /** Switches every radio on or off together (the debug panel and the console). */
  setAllRadios(on) {
    for (const u of this.radioUnits()) u.quad.radio.set(on);
  }

  /** The girls who are sat in this vehicle now: driving it, or in it with you. */
  girlsIn(unit, mount) {
    return this.companions.filter((c) => (c.quad === unit.quad && c.fsm.is('driving')) || (mount && c.onHayRide && c.trailer === mount));
  }

  /** Each frame: the sound of every radio that is on, and a girl sat beside one reaching for it (npc/radioTaste.js). */
  updateRadios(dt) {
    const listener = this.camera.position;
    const board = this.boardUnit;
    const sets = [];
    const mounts = new Map(Object.values(this.landys).filter((l) => l.unit).map((l) => [l.unit, l.mount]));
    for (const unit of this.radioUnits()) {
      const radio = unit.quad.radio;
      const at = unit.quad.position;
      sets.push({ key: unit.spec.id, radio, distance: Math.hypot(listener.x - at.x, listener.y - at.y, listener.z - at.z), inside: board === unit });
      const girls = this.girlsIn(unit, mounts.get(unit));
      for (const c of this.companions) {
        const id = `${c.character.id}:${unit.spec.id}`;
        const taste = (this.radioTaste[id] ??= new RadioTaste());
        const move = taste.update(dt, girls.includes(c), c.params.radioKeen, radio, RADIO_TASTE_PARAMS);
        const said = move ? applyRadioMove(move, radio) : null;
        if (said) c.voice.say(said, { urgent: true });
      }
    }
    this.radioAudio.update(sets, dt, RADIO_PARAMS);
  }

  /** The girls' cars in a line, for the Girls tab and the console: where each is, who has it, and when its owner next takes it out. */
  describeCars() {
    return CAR_KINDS.filter((k) => this.landys[k]?.unit).map((k) => {
      const l = this.landys[k];
      const q = l.unit.quad;
      const owner = this.companions.find((c) => c.character.id === l.spec.owner);
      const driver = this.riddenUnit === l.unit ? 'you' : this.companions.find((c) => c.quad === q && c.fsm.is('driving'))?.name;
      const aboard = this.companions.filter((c) => c.onHayRide && c.trailer === l.mount).map((c) => c.name);
      const out = this.borrowing[k].out;
      const next = Math.max(0, (this.carGo.lastGo[l.spec.owner] ?? -Infinity) + this.carGo.p.every, this.carGo.p.firstAfter) - this.carGo.clock;
      const parts = [driver ? `${driver} driving` : 'parked', aboard.length ? `${aboard.join(' and ')} in it` : null, out ? (out.withHer ? 'you have it, with her' : out.seen ? 'you have it, and she saw' : 'you have it, unseen') : null, next > 0 ? `${owner?.name ?? l.spec.owner} out in it in ${Math.round(next)} s` : `${owner?.name ?? l.spec.owner} may take it out`];
      return `${l.spec.name}: ${parts.filter(Boolean).join(', ')}`;
    }).join('; ');
  }

  /** What a go on the big vehicles needs to know (npc/tractorGo.js): who is free and which of them are free to take. */
  tractorGoContext(ridden) {
    const girlsFree = {};
    for (const c of this.companions) girlsFree[c.character.id] = c.availability().free;
    const youOn = GO_KINDS.some((k) => !!ridden && ridden === this.goVehicle(k));
    const vehicles = GO_KINDS.filter((k) => !OWNED_KINDS.includes(k) && this.goFree(k) && ridden !== this.goVehicle(k)); // the cars are their owners' alone (carGoContext), and yours is yours
    return { free: girlsFree, vehicles: youOn ? [] : vehicles };
  }

  /** Acts on a go on the big vehicles (npc/tractorGo.js): Jess's go (her choice) or Amy's day. */
  handleGoEvent(ev) {
    const c = this.companions.find((o) => o.character.id === ev.girl);
    const ask = { tractor: 'tractorGoAsk', utv: 'utvGoAsk', landy: 'landyGoAsk', defender: 'defenderGoAsk' }[ev.vehicle];
    if (ev.type === 'amyDay') c.voice.say('tractorDay', { force: true });
    else c.voice.say(ask, { force: true });
    this.startGo(c, ev.vehicle);
  }

  updateTractorGo(dt, ridden) {
    for (const ev of this.tractorGo.update(dt, this.tractorGoContext(ridden))) this.handleGoEvent(ev);
    for (const c of this.companions) {
      const id = c.character.id;
      const seen = (this.tractorSeen[id] ??= { stalls: 0, hops: 0, crunches: 0, setOff: false, wasDriving: false, kind: 'tractor', joinRolled: false, joined: null });
      const other = c.others()[0];
      const kind = seen.kind;
      const q = this.goVehicle(kind)?.quad;
      if (!q) continue;
      const pre = { tractor: 'tractorGo', utv: 'utvGo', landy: 'landyGo', defender: 'defenderGo', fiesta: 'carGo', corsa: 'carGo' }[kind];
      // The starting handle, on a flat battery.
      for (const e of c.crankEvents.splice(0)) {
        if (e === 'swing') c.voice.say('landyGoSwing', { urgent: true });
        else if (e === 'kick') {
          c.voice.say('landyGoKick', { urgent: true });
          this.hayLater.push({ left: 1.5, girl: other, key: 'landyGoKickWatch' });
        } else if (e === 'noLuck') {
          c.voice.say('landyGoNoLuck', { urgent: true });
          seen.wasDriving = false;
        }
      }
      // The other girl may climb in beside her as she gets in (the tractor's is the mudguard ride's).
      if (kind !== 'tractor' && !seen.joinRolled && c.quad === q && c.fsm.is('mounting')) {
        seen.joinRolled = true;
        const g = this.tractorGo;
        if (g.random() < g.p.joinChance && other && other.fsm.is('idle') && other.root.position.distanceTo(q.position) < 30) {
          this.goJoins.push({ left: g.p.joinDelayMin + g.random() * (g.p.joinDelayMax - g.p.joinDelayMin), girl: other, kind, driver: id });
          seen.joined = other.character.id;
        }
      }
      const driving = c.quad === q && c.fsm.is('driving');
      if (driving) {
        const d = c.drive;
        seen.wasDriving = true;
        if (d.phase === 'drive' && !seen.setOff) {
          seen.setOff = true;
          c.voice.say(`${pre}SetOff`, { urgent: true });
          this.hayLater.push({ left: 4, girl: other, key: `${pre}Watch` });
        }
        if (d.stalls > seen.stalls) {
          seen.stalls = d.stalls;
          if (kind === 'tractor') c.voice.say('tractorGoStall', { urgent: true });
        }
        if ((q.shifter.hops ?? 0) > (seen.hops ?? 0)) {
          seen.hops = q.shifter.hops;
          c.voice.say('tractorGoLurch', { urgent: true });
          if (other.root.position.distanceTo(q.position) < 30) this.hayLater.push({ left: 1.4, girl: other, key: 'tractorGoLurch' });
        }
        if ((q.shifter.crunches ?? 0) > seen.crunches) {
          seen.crunches = q.shifter.crunches;
          c.voice.say('landyGoCrunch', { urgent: true });
          if (other.root.position.distanceTo(q.position) < 30) this.hayLater.push({ left: 1.2, girl: other, key: 'landyGoCrunchWatch' });
        }
      } else if (seen.wasDriving) {
        seen.wasDriving = false;
        if (c.drive?.result !== 'gaveUp') c.voice.say(`${pre}Done`, { urgent: true });
        this.endJoin(seen, kind);
      }
      // Back to her own quad once she's off it, so everything else that looks at her quad finds one of the girls'.
      if (c.homeQuad && c.quad === q && c.fsm.is('idle')) {
        c.quad = c.homeQuad;
        c.homeQuad = null;
      }
    }
    // The other girl setting off to climb in.
    for (const j of this.goJoins) j.left -= dt;
    for (const j of this.goJoins.filter((x) => x.left <= 0)) {
      const mount = this.mountOfKind(j.kind);
      const ride = this.rideOfKind(j.kind);
      const slot = j.girl.fsm.is('idle') ? mount.freeSlot(j.girl.root.position) : null;
      if (slot && j.girl.boardTrailer(mount, slot)) {
        ride.ask(j.girl.character.id); // she stays until the driver's done
        j.girl.voice.say('utvBoard', { urgent: true });
      }
    }
    this.goJoins = this.goJoins.filter((x) => x.left > 0);
  }

  /** The driver is done: the girl who climbed in beside her climbs out. */
  endJoin(seen, kind) {
    const id = seen.joined;
    seen.joined = null;
    const c = id && this.companions.find((o) => o.character.id === id);
    const mount = this.mountOfKind(kind);
    if (!c || c.trailer !== mount) return;
    this.rideOfKind(kind).dismiss(id);
    c.leaveTrailer();
    c.abortBoarding();
  }

  /** You asked her to climb up on the tractor's wheel arch: she goes at once and stays until you ask her down. */
  askOntoTractor(c) {
    const mount = this.tractorMount;
    const slot = mount.freeSlot(c.root.position);
    if (!slot || !c.boardTrailer(mount, slot)) return this.hud.toast('She can\'t just now');
    this.mudguard.ask(c.character.id);
    c.voice.say('mudBoard', { force: true });
  }

  /** A girl on the tractor's wheel arch: she climbs up when you stop with it running, shouts across at you, and climbs down when you get off. */
  updateMudguard(dt, ridden) {
    const mount = this.tractorMount;
    mount.update(dt);
    const unit = this.tractorUnit;
    const riding = ridden === unit;
    const girlOf = (id) => this.companions.find((c) => c.character.id === id);
    const on = (c) => c.onHayRide && c.trailer === mount;
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      free: c.availability().free,
      aboard: on(c),
      wants: this.requests.openFor(c.character.id)?.kind === 'mudguard', // she asked to sit up there while it idles
      dist: c.root.position.distanceTo(mount.model.position),
    }));
    const driver = this.companions.find((c) => c.quad === unit.quad && c.fsm.is('mounting', 'driving'));
    const settingOff = !!driver && (driver.fsm.is('mounting') || ['start', 'settle'].includes(driver.drive?.phase));
    const ctx = {
      active: riding && unit.quad.engine.isRunning,
      riding,
      parked: !riding && !unit.quad.rider && !driver,
      drivenBy: driver?.character.id ?? null,
      settingOff,
      trailer: this.trailer.hitched,
      speed: unit.quad.speed,
      running: unit.quad.engine.isRunning,
      girls,
    };
    for (const ev of this.mudguard.update(dt, ctx)) {
      const c = girlOf(ev.girl);
      if (ev.type === 'board') {
        const slot = mount.freeSlot(c.root.position);
        if (slot && c.boardTrailer(mount, slot)) c.voice.say('mudBoard', { urgent: true });
      } else if (ev.type === 'shout') c.voice.say('mudShout', { urgent: true });
      else if (ev.type === 'leave') {
        if (ev.bored) this.mudguard.dismiss(ev.girl);
        c.leaveTrailer();
        c.abortBoarding();
      }
    }
  }

  /** Builds the UTV, with its own seeded idle, roughness, fuel and hours, and adds it to `units` (not `girlUnits`). */
  addUtv(spawn) {
    const spec = this.bigSpecs.utv; // as it is this game: bought, it has its own colour and hours
    const random = createRandom(this.farmSeed ^ 0x07c5);
    const unit = new QuadUnit({
      spec,
      spawn,
      scene: this.scene,
      physics: this.physics,
      RAPIER: this.RAPIER,
      world: this.world,
      audioHub: this.audioHub,
    });
    unit.idleRpm = applyIdle(unit.engine.params, unit.quad.params, pickIdle(spec.idleRange, random));
    unit.variation = applyVariation(spec, unit.engine.params, unit.quad.fuel, random);
    unit.topRpm = applyTopRpm(spec, unit.engine.params, createRandom(this.farmSeed ^ 0x07c6));
    unit.quad.usage.hours = pickReading(spec.hoursRange, random);
    const [hoursLo, hoursHi] = spec.hoursRange;
    unit.quad.usage.odoMiles = pickRelatedReading(spec.odoRange, (unit.quad.usage.hours - hoursLo) / (hoursHi - hoursLo), random);
    unit.quad.parkBrake = true;
    this.units = [...this.units, unit];
    unit.where = spawn.where;
    return unit;
  }

  /** The UTV's tank has petrol in it, or its engine is soaked with it: worth pumping out. */
  utvTainted(unit) {
    const q = unit.quad;
    return q.engine.dieselSoak > 0.02 || (q.fuel.litres > 0.05 && q.fuel.diesel < 0.98);
  }

  /** The UTV: its tip lever and tailgate, the girls in its seats and bed, and what they say (npc/utvRide.js, vehicle/utvBed.js). */
  updateUtv(dt, ridden, input) {
    const unit = this.utvUnit;
    const q = unit.quad;
    const mount = this.utvMount;
    const bed = this.utvBed;
    mount.update(dt);
    const riding = ridden === unit;
    const girlOf = (id) => this.companions.find((c) => c.character.id === id);
    const seatOf = (c) => (c.onHayRide && c.trailer === mount ? c.traSlot?.name ?? null : null);
    const say = (c, key) => c?.voice.say(key, { urgent: true });

    // T pulls the tip lever, from the seat or standing by the bed.
    const near = riding || (!this.player.isRiding && this.player.position.distanceTo(q.position) < 3.2);
    if (near && input.wasPressed('KeyT') && !q.isTipped && !this.handsFull) {
      const note = bed.toggle(q.speed);
      if (note) this.achievements.note('tipped');
      if (note) this.hud.toast(note, 2);
    }
    bed.update(dt, { speed: q.speed, gateDown: mount.bedBusy });
    poseUtvBed(q.model, bed);
    // Whatever is stood in the bed slides out behind once it is high enough, and goes with the UTV otherwise.
    q.model.updateMatrixWorld(true);
    if (bed.sliding && this.utvCargo.items.length) this.utvCargo.tipOut(new THREE.Vector3(0, 0, -1).transformDirection(q.model.matrixWorld).setY(0).normalize());
    this.utvCargo.update(dt);
    this.updateLooseBed(this.utvCargo, q, dt);

    // The seat belts: who is in which seat, `;` for yours, and the girls do their own (vehicle/seatBelts.js).
    const youSeat = riding ? 'driver' : this.player.isRiding && q.passenger ? this.player.benchSeat : null;
    const sitting = { driver: null, mid: null, left: null };
    if (youSeat) sitting[youSeat] = 'you';
    for (const c of this.companions) {
      // Only once she is actually in the seat (not while she walks over or climbs in) does she count as sitting there.
      const seat = c.fsm.is('driving') && c.quad === q ? 'driver' : c.fsm.is('onTrailer') ? seatOf(c) : null;
      if (seat && seat in sitting) sitting[seat] = 'girl';
    }
    if (youSeat && input.wasPressed('Semicolon')) {
      q.belts.toggle(youSeat); // no message: you look at the belt and the lamp
    }
    if (q.belts.update(dt, sitting, q.engine.ignitionOn, dashClock().seconds())) this.audioHub.beltBing(q.position); // fading with distance, like its engine

    const girls = this.companions.map((c) => ({
      id: c.character.id,
      free: c.availability().free,
      seat: seatOf(c),
      dist: c.root.position.distanceTo(q.position),
    }));
    const parked = !riding && !q.rider && !q.driver && !q.passenger;
    const ctx = { active: riding && q.engine.isRunning, riding, parked, playerSeat: this.player.isRiding && q.passenger ? this.player.benchSeat : null, speed: q.speed, slide: bed.sliding, girls };
    for (const ev of this.utvRide.update(dt, ctx)) {
      const c = girlOf(ev.girl);
      if (ev.type === 'board') {
        const slot = mount.slots[ev.seat];
        if (!slot || slot.girl || (ev.seat === 'bed' && bed.tip > 0.02) || !c.boardTrailer(mount, slot)) continue;
        if (ev.seat === 'bed') say(c, 'utvBedGo');
        else if (ev.squabble?.winner === ev.girl) {
          say(c, 'utvMiddleWin');
          this.hayLater.push({ left: 2.6, girl: girlOf(ev.squabble.loser), key: 'utvMiddleLose' });
        } else if (!ev.squabble) say(c, 'utvBoard');
      } else if (ev.type === 'bedTell') say(c, 'utvBedTell');
      else if (ev.type === 'bedShout') say(c, 'utvBedShout');
      else if (ev.type === 'slide') {
        if (c.slideOffTrailer(1, new THREE.Vector3(0, 0, -1))) this.utvRide.clear(ev.girl);
      } else if (ev.type === 'leave') {
        if (ev.bored) this.utvRide.dismiss(ev.girl);
        c.leaveTrailer();
        c.abortBoarding();
      }
    }
    // Petrol in the diesel: it runs badly, and whoever is near says so, once until it's been put right.
    const soaked = q.engine.dieselSoak > 0.2 && q.engine.isRunning;
    if (!soaked && q.engine.dieselSoak < 0.05) this.utvPetrolSaid = false;
    else if (soaked && !this.utvPetrolSaid) {
      const speaker = this.companions.filter((c) => c.root.position.distanceTo(q.position) < 20).sort((a, b) => a.root.position.distanceTo(q.position) - b.root.position.distanceTo(q.position))[0];
      if (speaker) {
        this.utvPetrolSaid = true;
        say(speaker, 'utvPetrol');
      }
    }
  }

  /** Whichever jerry can, the toolbox, the jump leads or the oil bottle you are holding, or null. */
  heldLoad() {
    return [this.petrolCan, this.premixCan, this.dieselCan, this.toolbox, this.leads, this.oilBottle, this.heldBattery()].find((i) => i?.held) ?? null;
  }

  /** What to call whatever heldLoad() found. */
  loadName(item) {
    return item === this.toolbox ? 'toolbox' : item === this.leads ? 'jump leads' : item === this.oilBottle ? 'oil bottle' : item?.unitId === BOOSTER_ID ? 'booster pack' : item instanceof BatteryItem ? 'battery' : 'jerry can';
  }

  /** The UTV's bed as somewhere to stand a can, the toolbox, the leads or the oil bottle (vehicle/cargoHold.js). They tip out with the bed. */
  addUtvCargo(quad) {
    this.utvCargo = this.addBedCargo(quad, { name: "Yak's bed", blocked: () => this.utvBed.tip > 0.02 ? 'The bed is up' : null, yawFor: (item) => BED_CARGO_YAWS[item.model.name] ?? BED_CARGO_YAW });
    registerTuning('Yak load', this.utvCargo.p, CARGO_PARAM_RANGES);
  }

  /** The Series' tub: the same standing and loading as the UTV's bed, a tailgate dropped or not (vehicle/tailgate.js). */
  addLandyCargo(l) {
    l.cargo = this.addBedCargo(l.unit.quad, { name: "Tor's tub", blocked: () => null, yawFor: () => BED_CARGO_YAW, host: l.unit.quad.model });
    registerTuning('Tor load', l.cargo.p, CARGO_PARAM_RANGES);
    registerTuning('Tor tailgate', (l.unit.quad.tailgate ??= new Tailgate()).p, TAILGATE_PARAM_RANGES);
  }

  /** A row of cargo spots (`bedCargo0`...) and a `bedProxy` box on a model to look at: what you hold goes in, unless `blocked` says why not. */
  addBedCargo(quad, { name, blocked, yawFor, host = null }) {
    const bed = host ?? quad.model.getObjectByName('bed');
    const anchors = [];
    for (let i = 0; bed.getObjectByName(`bedCargo${i}`); i++) anchors.push(bed.getObjectByName(`bedCargo${i}`));
    const hold = new CargoHold({ scene: this.scene, ground: (x, z) => this.world.heightAt(x, z), anchors, yawFor });
    this.interaction.add({
      target: bed.getObjectByName('bedProxy'),
      priority: 1, // looking into the bed with something in your hands wins over the vehicle as a whole (and its tank)
      isAvailable: () => !!this.heldLoad() && !this.player.isRiding,
      prompt: () => {
        const what = this.loadName(this.heldLoad());
        const why = blocked();
        if (why) return { text: `${why}   ·   G put the ${what} down` };
        if (hold.freeSpot() === null) return { text: `It is full   ·   G put the ${what} down` };
        return `Put the ${what} in the ${name}`;
      },
      feedback: 'putDown',
      interact: () => {
        const item = this.heldLoad();
        if (item && !blocked()) hold.load(item);
      },
    });
    return hold;
  }

  /** Whether the trailer is by the muck heap with its tub down and room in it, and your hands are empty. */
  canForkMuck() {
    const m = this.tipTrailer.motion;
    return !this.heldLoad() && this.muck.canFork(this.world.layout.muckHeap, m.x, m.z, this.tipTrailer.bed.tip) && !this.player.isRiding;
  }

  /** Holding E at the trailer by the heap: fork muck in, the girls remark as the job starts and as the tub fills. */
  forkMuck(dt) {
    if (!this.canForkMuck()) return false;
    for (const e of this.muck.fork(dt)) {
      if (e.type === 'start') this.saySomethingAboutJob('muckStart');
      else if (e.type === 'full') this.saySomethingAboutJob('muckFull', true);
    }
    this.muckView.setLoad(this.muck.load);
    return true;
  }

  /** One girl, the nearest who is free to remark (or the other one), says a line about the job. */
  saySomethingAboutJob(key, other = false, at = this.tipTrailer.model.position) {
    const ranked = this.companions
      .filter((c) => c.availability().canRemark && c.root.position.distanceTo(at) < 30)
      .sort((a, b) => a.root.position.distanceTo(at) - b.root.position.distanceTo(at));
    ranked[other ? ranked.length - 1 : 0]?.voice.say(key);
  }

  // The bonfire ---------------------------------------------------------------------

  /** The bonfire site on the grass field, the hedge cuttings to carry to it, and the girls' sit by it (world/bonfire.js, npc/fireSit.js). */
  setUpBonfire() {
    const L = this.world.layout;
    this.bonfireParams = { ...DEFAULT_BONFIRE_PARAMS };
    this.bonfire = new Bonfire(this.bonfireParams);
    this.fireSit = new FireSit();
    registerTuning('Bonfire', this.bonfireParams, BONFIRE_PARAM_RANGES);
    registerTuning('Sitting by the bonfire', this.fireSit.p, FIRE_SIT_PARAM_RANGES);
    const site = L.bonfire;
    const seats = logSeats(site);
    this.bonfireView = new BonfireView({ scene: this.scene, site, seats, heightAt: (x, z) => this.world.heightAt(x, z), params: this.bonfireParams });
    // Rest spots for the logs: stable objects, since a girl's restSpot is compared by identity.
    this.fireSpots = seats.map((s, i) => ({ id: `fire${i}`, kind: 'log', x: s.x, z: s.z, yaw: s.yaw, seat: this.bonfireView.seatHeight + 0.04 }));
    this.brushwood = L.brushwood.map(([x, z, yaw], i) => new BrushwoodHeap({ scene: this.scene, world: this.world, x, z, yaw, random: createRandom(this.seed ^ (0xb0f0 + i)) }));
    for (const h of this.brushwood) {
      this.interaction.add({
        target: h.proxy,
        isAvailable: () => !h.held && !h.used && !this.handsFull && !this.player.isRiding,
        prompt: () => `Pick up the brushwood (${this.bonfire.piled} of ${this.bonfireParams.heapsNeeded} on the pile)`,
        feedback: 'pickUp',
        interact: () => {
          h.pickUp(this.camera);
          if (!this.fireHinted) {
            this.fireHinted = true;
            this.hud.toast('Carry it to the ring of stones on the south side of the field: three bundles make a fire', 4);
          }
        },
      });
    }
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 2.6), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.set(site.x, this.world.heightAt(site.x, site.z) + 0.5, site.z);
    this.scene.add(proxy);
    this.interaction.add({
      target: proxy,
      isAvailable: () => !this.player.isRiding && !!this.bonfireAction(),
      prompt: () => this.bonfireAction().prompt,
      feedback: () => (this.heldBrushwood ? 'putDown' : 'latch'),
      interact: () => this.bonfireAction().run(),
    });
    this.fireClock = 0;
    this.fireLastWarned = -Infinity;
  }

  get heldBrushwood() {
    return this.brushwood?.find((h) => h.held) ?? null;
  }

  /** What E does at the fire right now: { prompt, run }, or null for nothing. */
  bonfireAction() {
    const f = this.bonfire;
    const heap = this.heldBrushwood;
    if (heap) {
      if (!f.canAdd()) return null;
      return { prompt: `Put the brushwood on the pile (${f.piled + 1} of ${this.bonfireParams.heapsNeeded})`, run: () => this.putBrushwoodOn(heap) };
    }
    if (this.handsFull) return null;
    if (f.state === 'built' && f.built) {
      if (!f.canLight(this.weather.rain)) return { prompt: { text: 'Too wet to light the fire' }, run: () => {} };
      return { prompt: 'Light the bonfire', run: () => this.lightBonfire() };
    }
    const girl = this.fireGirl();
    if (girl) return { prompt: `Sit down by the fire with ${girl.name}`, run: () => this.askForFire(girl) };
    return null;
  }

  putBrushwoodOn(heap) {
    if (!this.bonfire.addHeap()) return;
    heap.burn();
    const f = this.bonfire;
    this.hud.toast(f.built ? 'The pile is made: E to light it' : `${f.piled} of ${this.bonfireParams.heapsNeeded} on the pile`, 2.4);
  }

  putBrushwoodDown() {
    const h = this.heldBrushwood;
    if (!h) return;
    const p = this.player.position;
    const yaw = this.player.yaw;
    h.putDown(new THREE.Vector3(p.x - Math.sin(yaw) * 0.9, 0, p.z - Math.cos(yaw) * 0.9), yaw + Math.PI / 2);
  }

  lightBonfire() {
    if (!this.bonfire.light(this.weather.rain)) return false;
    this.achievements.note('bonfireLit');
    this.hud.toast('The fire catches', 2.4);
    this.saySomethingAboutFire('fireLit');
    return true;
  }

  /** One of the girls nearest the fire says something about it (npc/fireLines.js). */
  saySomethingAboutFire(key) {
    const s = this.world.layout.bonfire;
    const c = this.companions
      .filter((g) => g.availability().canRemark && Math.hypot(g.root.position.x - s.x, g.root.position.z - s.z) < 40)
      .sort((a, b) => Math.hypot(a.root.position.x - s.x, a.root.position.z - s.z) - Math.hypot(b.root.position.x - s.x, b.root.position.z - s.z))[0];
    c?.voice.say(key);
  }

  /** The girl you'd sit by the fire with: the nearest free one close enough, with the fire blazing and a log free. */
  fireGirl() {
    if (!this.bonfire.blazing || !this.fireSit.seatsLeft(this.fireSpots.length).length) return null;
    const near = this.companions
      .filter((c) => !this.fireSit.sessions.has(c.character.id) && c.root.position.distanceTo(this.player.position) <= this.fireSit.p.askRange)
      .filter((c) => c.availability({ asked: true }).free)
      .sort((a, b) => a.root.position.distanceTo(this.player.position) - b.root.position.distanceTo(this.player.position));
    return near[0] ?? null;
  }

  askForFire(girl = this.fireGirl()) {
    if (!girl || !this.bonfire.blazing) return false;
    const e = this.fireSit.begin(girl.character.id, 'asked', this.fireSit.seatsLeft(this.fireSpots.length));
    if (!e) return false;
    this.handleFireEvent(e);
    return true;
  }

  /** What the fire sit needs to know to suggest it: the fire, the weather and how far each girl is from the fire. */
  fireSitContext() {
    const s = this.world.layout.bonfire;
    return {
      blazing: this.bonfire.blazing,
      seats: this.fireSit.seatsLeft(this.fireSpots.length).length,
      rain: this.weather.rain,
      darkness: this.daylight?.darkness ?? 0,
      girls: this.companions.map((c) => ({ id: c.character.id, free: c.availability().free, distance: Math.hypot(c.root.position.x - s.x, c.root.position.z - s.z) })),
    };
  }

  /** Acts on the fire sit: she goes to her log, speaks, gets up. */
  handleFireEvent(e) {
    const c = this.companions.find((o) => o.character.id === e.girl);
    if (!c) return this.fireSit.cancel(e.girl);
    if (e.type === 'go') {
      c.hold('fire', 'sitting by the bonfire');
      c.voice.say(e.how === 'offer' ? 'fireOffer' : 'fireYes', { force: true });
      if (!c.goRest(this.fireSpots[e.seat], { stay: Infinity })) {
        c.release('fire');
        this.fireSit.cancel(e.girl);
      }
    } else if (e.type === 'say') {
      c.voice.say(e.line, { force: true });
    } else if (e.type === 'end') {
      c.release('fire');
      if (c.isResting) c.leaveRest();
      if (e.why === 'done') {
        const p = this.fireSit.p;
        this.favour.add(e.girl, p.favour + (this.favour.mood(e.girl) === 'favoured' ? p.romanceFavour : 0));
        this.achievements.note('fireSat');
      }
    }
  }

  /** The fire, every frame: it burns on the weather, draws itself, warns a vehicle that gets too close, and the girls sit by it. */
  updateBonfire(dt, ridden) {
    const f = this.bonfire;
    const w = this.weather;
    const s = this.world.layout.bonfire;
    this.fireClock += dt;
    for (const e of f.update(dt, { rain: w.rain, wind: Math.hypot(this.wind.x, this.wind.z) })) {
      if (e.type === 'out' && Math.hypot(this.player.position.x - s.x, this.player.position.z - s.z) < 60) {
        this.hud.toast(e.why === 'rain' ? 'The rain has put the fire out' : e.why === 'wind' ? 'The wind has blown the fire out' : 'The fire has burnt out', 3);
      }
    }
    this.bonfireView.update(dt, f, { wind: this.wind, darkness: this.daylight?.darkness ?? 0 });
    if (f.burning && ridden && Math.hypot(ridden.quad.position.x - s.x, ridden.quad.position.z - s.z) < f.p.dangerRange + 0.9) {
      if (this.fireClock - this.fireLastWarned > 8) {
        this.fireLastWarned = this.fireClock;
        this.hud.toast('Mind the fire!', 1.6);
      }
    }
    const spots = this.fireSpots;
    const girls = {};
    for (const c of this.companions) {
      const id = c.character.id;
      if (!this.fireSit.sessions.has(id)) continue;
      const seat = this.fireSit.seatOf(id);
      girls[id] = {
        free: c.availability({ asked: true, mine: 'fire' }).free,
        seated: c.isResting && c.restPhase === 'sat' && c.restSpot === spots[seat],
        youNear: Math.hypot(c.root.position.x - this.player.position.x, c.root.position.z - this.player.position.z) < this.fireSit.p.youRange,
        favoured: this.favour.mood(id) === 'favoured',
      };
    }
    for (const e of this.fireSit.update(dt, { blazing: f.blazing, girls })) this.handleFireEvent(e);
  }

  debugLightFire() {
    this.bonfire.buildAll();
    this.bonfire.light();
  }

  debugResetFire() {
    this.bonfire.reset();
    for (const h of this.brushwood) h.reset();
  }

  /**
   * The bale spike on the tractor (items/baleSpike.js): ] raises the arms and [ lowers them while you drive it (with the engine running);
   * a standing silage bale the point runs into is speared, and one lowered to the ground or on a stack is left when you drive on.
   */
  updateBaleSpike(dt, ridden, input) {
    const u = this.tractorUnit;
    const driving = ridden === u && this.player.seat === 'rider' && !this.menu.isOpen;
    const q = u.quad;
    const trailerOn = this.trailer.hitched || (this.tipTrailer.hitched && this.tipTrailer.puller === q);
    const rig = this.baleRig;
    const before = rig.lift.lift;
    const events = rig.update(dt, {
      raise: driving && input.isDown('BracketRight'),
      lower: driving && input.isDown('BracketLeft'),
      powered: q.engine.isRunning,
      shown: !trailerOn && !this.splitterFitted, // the log splitter takes the spike's place on the lift arms
    });
    if (driving && !trailerOn && !this.splitterFitted && rig.lift.lift !== before && !this.spikeHinted) {
      this.spikeHinted = true;
      this.hud.toast('Bale spike: reverse the point into a standing silage bale, ] up and [ down', 3.5);
    }
    for (const e of events) {
      if (e.type === 'speared') {
        this.hud.toast('Bale on the spike: ] raise it to carry, lower it and drive on to leave it', 3);
        this.saySomethingAboutBale('baleSpiked');
      } else if (e.type === 'left') {
        this.baleSettled();
      }
    }
    const weight = rig.held ? this.spikeParams.towWeight : 0;
    if (weight || this.spikeWeighed) Object.assign(q.tow, towEffect(towLoad(0, weight, this.towParams), true, this.towParams));
    this.spikeWeighed = !!weight;
  }

  // The log splitter ---------------------------------------------------------------

  /**
   * The log splitter that takes the bale spike's place on the tractor (items/logSplitter.js): rounds lying in piles at the wood's gate, the
   * splitter's beam, the logs it makes and the stack they go in. The stack and whether the splitter is fitted are kept; the rounds are dealt fresh each load.
   */
  setUpLogSplitter() {
    this.logStack = null;
    const yard = this.world.layout.logYard;
    if (!yard || !this.tractorUnit) return;
    const p = (this.splitterParams = { ...DEFAULT_SPLITTER_PARAMS });
    registerTuning('Log splitter', p, SPLITTER_PARAM_RANGES);
    this.splitter = new LogSplitter(p);
    this.logStack = new LogStack(p);
    this.logStack.restore(this.farm.save?.logs, this.farm.day);
    this.splitterFitted = !!this.farm.save?.logs?.fitted;
    this.splitterPush = false;
    const random = createRandom(this.seed ^ 0x10c5);
    const world = this.world;
    this.rounds = [];
    yard.piles.forEach(([x, z, yaw], pile) => {
      for (let i = 0; i < p.roundsPerPile; i++) {
        const r = new WoodPiece({ scene: this.scene, world, kind: 'round', gnarled: random() < p.gnarlChance, random, x: x + (i % 3) * 0.38 - 0.38, z: z + Math.floor(i / 3) * 0.38, yaw: random() * 6 });
        r.putDown(r.home, r.home.yaw);
        this.rounds.push(r);
      }
    });
    this.logPieces = Array.from({ length: Math.max(1, this.rounds.length) * 4 }, () => new WoodPiece({ scene: this.scene, world, kind: 'log' }));
    this.woodPieces = [...this.rounds, ...this.logPieces];
    this.stackView = new StackView({ scene: this.scene, heightAt: (x, z) => world.heightAt(x, z), site: yard.stack, capacity: SPLITTER_PARAM_RANGES.capacity[1] });
    this.stackView.set(this.logStack.count);
    const q = this.tractorUnit.quad;
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    // The beam: look at it to load, push and (empty) swap back. The mast: look at it to fit the splitter. Both ride on the tractor.
    this.splitterProxy = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 1.7), hidden);
    this.splitterProxy.position.set(0, 1.1, -2.45);
    q.model.add(this.splitterProxy);
    this.fitProxy = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.5), hidden);
    this.fitProxy.position.set(0, 1.25, -1.85);
    q.model.add(this.fitProxy);
    poseLogSplitter(q.model, 0, this.splitterFitted);
    const onFoot = () => !this.player.isRiding;
    for (const w of this.woodPieces) {
      this.interaction.add({
        target: w.proxy,
        isAvailable: () => w.onGround && !this.handsFull && onFoot(),
        prompt: () => (w.kind === 'round' ? 'Pick up the round' : 'Pick up the log'),
        feedback: 'pickUp',
        interact: () => w.pickUp(this.camera),
      });
    }
    this.interaction.add({
      target: this.stackView.proxy,
      isAvailable: () => this.heldWood?.kind === 'log' && !this.logStack.full,
      prompt: () => `Stack the log (${this.logStack.count + 1} of ${p.capacity})`,
      feedback: 'putDown',
      interact: () => this.stackLog(),
    });
    this.interaction.add({
      target: this.splitterProxy,
      priority: 1, // it stands over the mast's box
      isAvailable: () => this.splitterShown() && onFoot() && (!this.handsFull || this.heldWood?.kind === 'round'),
      prompt: () => this.splitterPrompt(),
      feedback: () => (this.heldWood ? 'putDown' : 'latch'),
      interact: () => this.splitterInteract(),
      hold: () => this.splitterHold(),
    });
    this.interaction.add({
      target: this.fitProxy,
      isAvailable: () => !this.splitterFitted && !this.handsFull && onFoot() && !this.baleRig.held && !this.splitterTrailerOn(),
      prompt: () => 'Take the bale spike off and fit the log splitter',
      feedback: 'latch',
      interact: () => this.fitSplitter(true),
    });
  }

  get heldWood() {
    return this.woodPieces?.find((w) => w.held) ?? null;
  }

  splitterTrailerOn() {
    const q = this.tractorUnit.quad;
    return this.trailer.hitched || (this.tipTrailer.hitched && this.tipTrailer.puller === q);
  }

  /** The splitter is on the tractor and in view (a trailer on the drawbar hides it). */
  splitterShown() {
    return !!this.tractorUnit && this.splitterFitted && !this.splitterTrailerOn();
  }

  /** Whether the tractor is running and held, so the hydraulics will work. */
  splitterPowered() {
    const q = this.tractorUnit.quad;
    return splitterPowered({ running: q.engine.isRunning, parkBrake: q.parkBrake, gear: q.drivetrain.gear, speed: q.forwardSpeed });
  }

  splitterPrompt() {
    const sp = this.splitter;
    if (this.heldWood) return sp.canLoad() ? 'Put the round on the splitter' : { text: 'The splitter already has a round on it' };
    if (sp.loaded) return this.splitterPowered() ? 'Hold E to push the ram through the round' : { text: 'Start the tractor and put its brake on, then hold E to split' };
    return sp.canLoad() ? 'Take the log splitter off and fit the bale spike' : { text: 'Let the ram come back' };
  }

  splitterInteract() {
    const sp = this.splitter;
    const held = this.heldWood;
    if (held) {
      if (!sp.canLoad()) return;
      sp.putOn(held.gnarled);
      held.putOnBeam(this.tractorUnit.quad.model.getObjectByName('logSplitter'));
      this.splitterPiece = held;
      if (!this.splitterHinted) {
        this.splitterHinted = true;
        this.hud.toast(this.splitterPowered() ? 'Hold E to push the ram through' : 'Start the tractor and put its brake on, then hold E to split', 3.5);
      }
    } else if (!sp.loaded && sp.canLoad()) this.fitSplitter(false);
  }

  /** Holding E at the beam with a round on it: the ram goes out (updateLogSplitter moves it). */
  splitterHold() {
    if (this.heldWood || !this.splitter.loaded || !this.splitterPowered()) return false;
    this.splitterPush = true;
    return false; // true would make the pouring sound (the muck fork's does)
  }

  /** Swaps the bale spike for the splitter (or back) on the lift arms. */
  fitSplitter(on) {
    this.splitterFitted = on;
    poseLogSplitter(this.tractorUnit.quad.model, this.splitter.ram, on && !this.splitterTrailerOn());
    this.hud.toast(on ? 'Log splitter fitted in place of the bale spike. Rounds are piled by the wood\'s gate' : 'Bale spike back on', 3);
  }

  /** Every frame: the ram, the engine's governor and load, and what comes of a split. */
  updateLogSplitter(dt) {
    const q = this.tractorUnit.quad;
    const shown = this.splitterShown();
    const powered = shown && this.splitterPowered() && !this.player.isRiding;
    const push = this.splitterPush && powered;
    this.splitterPush = false;
    for (const e of this.splitter.update(dt, { push, powered })) {
      if (e.type === 'split') this.roundSplit(e);
    }
    const working = powered && (push || this.splitter.moving || this.splitter.load > 0);
    q.pto.throttle = working ? this.splitterParams.pumpThrottle : 0;
    q.pto.load = working ? this.splitter.load : 0;
    poseLogSplitter(q.model, this.splitter.ram, shown);
  }

  /** The round gave way: it is gone from the beam and its logs lie either side of the tractor's back. */
  roundSplit(e) {
    const q = this.tractorUnit.quad;
    const round = this.splitterPiece;
    round?.hide();
    this.splitterPiece = null;
    const at = q.localToWorld(0, SPLITTER.roundY + TRACTOR_GROUND_OFFSET, SPLITTER.roundZ);
    this.splitAudio.crack(at, e.gnarled);
    const n = this.splitterParams.logsPerRound;
    for (let i = 0; i < n; i++) {
      const log = this.logPieces.find((l) => l.state === 'hidden');
      if (!log) break;
      const side = i % 2 ? 1 : -1;
      const w = q.localToWorld(side * (0.55 + Math.floor(i / 2) * 0.3), 0, SPLITTER.roundZ + (Math.random() - 0.5) * 0.3);
      log.putDown({ x: w.x, z: w.z }, Math.atan2(w.x - at.x, w.z - at.z) + Math.PI / 2 + (Math.random() - 0.5) * 0.4);
    }
    if (!this.logSplitHinted) {
      this.logSplitHinted = true;
      this.hud.toast('Split. Carry the logs to the stack by the hedge', 3.5);
    }
  }

  stackLog() {
    const log = this.heldWood;
    if (!log || log.kind !== 'log' || this.logStack.add() < 0) return;
    log.hide();
    this.stackView.set(this.logStack.count);
    this.hud.toast(`${this.logStack.count} of ${this.splitterParams.capacity} on the stack`, 1.6);
    if (this.jobBoard.has('logs') && !this.jobBoard.finished.has('logs') && this.logStack.jobComplete) this.finishLogs();
  }

  finishLogs() {
    if (this.jobBoard.complete('logs')) {
      this.hud.toast('Logs stacked. Ticked off the board on the barn door', 3);
      this.jobBoardView.refresh();
      if (this.jobBoard.cleared) this.achievements.note('boardCleared');
    }
  }

  putWoodDown() {
    const w = this.heldWood;
    if (!w) return;
    const p = this.player.position;
    const yaw = this.player.yaw;
    w.putDown({ x: p.x - Math.sin(yaw) * 0.8, z: p.z - Math.cos(yaw) * 0.8 }, yaw + Math.PI / 2);
  }

  debugFinishLogs() {
    if (!this.logStack) return;
    while (!this.logStack.jobComplete && !this.logStack.full) this.logStack.add();
    this.stackView.set(this.logStack.count);
    if (this.jobBoard.has('logs')) this.finishLogs();
  }

  /** Empties the stack and deals the rounds back into their piles (the debug panel). */
  debugResetLogs() {
    if (!this.logStack) return;
    this.splitter.reset();
    this.splitterPiece = null;
    this.logStack.count = 0;
    this.stackView.set(0);
    for (const w of this.woodPieces) w.reset();
  }


  /** A bale has been left: if that brings the silage job's bales into the Dutch barn, tick it off. */
  baleSettled() {
    if (!this.siloRect || !this.jobBoard.has('silage') || this.jobBoard.finished.has('silage')) return;
    if (this.baleRig.yard.countIn(this.siloRect) < this.spikeParams.balesNeeded) return;
    this.finishSilage();
  }

  finishSilage() {
    this.achievements.note('silageMoved');
    if (this.jobBoard.complete('silage')) {
      this.hud.toast('Silage in. Ticked off the board on the barn door', 3);
      this.jobBoardView.refresh();
      if (this.jobBoard.cleared) this.achievements.note('boardCleared');
    }
    this.saySomethingAboutBale('silageDone');
  }

  /** One of the girls near the tractor says something about the bales (npc/farmJobLines.js). */
  saySomethingAboutBale(key) {
    const at = this.tractorUnit.quad.model.position;
    const c = this.companions
      .filter((g) => g.availability().canRemark && g.root.position.distanceTo(at) < 30)
      .sort((a, b) => a.root.position.distanceTo(at) - b.root.position.distanceTo(at))[0];
    c?.voice.say(key);
  }

  debugFinishSilage() {
    if (this.tractorUnit) this.finishSilage();
  }

  /** Puts every silage bale back where it started (the debug panel). */
  debugResetBales() {
    this.baleRig.reset();
  }

  /** The muck in the tub and what it leaves: patches behind the tub on the stubble (world/farmJobs.js). */
  updateMuck(dt) {
    const t = this.tipTrailer;
    this.muckWrongCool = Math.max(0, (this.muckWrongCool ?? 0) - dt);
    const yaw = t.model.rotation.y;
    // Muck leaves over the tailgate, a little behind the axle.
    const x = t.motion.x - Math.sin(yaw) * 1.2;
    const z = t.motion.z - Math.cos(yaw) * 1.2;
    const onStubble = this.world.fields.stubbleAt(x, z) > 0.5;
    const events = this.muck.update(dt, { x, z, speed: Math.abs(t.signedSpeed), tip: t.bed.tip, slideAt: t.bed.p.slideAt, onStubble });
    for (const e of events) {
      if (e.type === 'patch') this.muckView.lay(e.x, e.z);
      else if (e.type === 'pile') {
        this.muckView.lay(e.x, e.z, 1.3);
        this.hud.toast('The lot slid out in a heap', 2);
      } else if (e.type === 'wrong') {
        this.muckView.lay(e.x, e.z, 0.5);
        if (this.muckWrongCool <= 0) {
          this.hud.toast('Spread it on the stubble, not here', 2);
          this.muckWrongCool = 6;
        }
      } else if (e.type === 'done') this.finishMuck();
    }
    if (events.length) this.muckView.setLoad(this.muck.load);
  }

  /** Debug panel and console: set how full the tub is. */
  debugSetMuck(load) {
    this.muck.load = Math.max(0, Math.min(1, load));
    this.muck.started = this.muck.load > 0;
    this.muckView.setLoad(this.muck.load);
  }

  debugFillMuck() {
    this.debugSetMuck(1);
    this.hud.toast('The tub is full of muck: tip it a little and drive slowly over the stubble', 3);
  }

  debugFinishMuck() {
    this.muck.done = true;
    this.muck.laid = Math.max(this.muck.laid, this.muckParams.patchesNeeded);
    this.finishMuck();
  }

  debugResetMuck() {
    this.muck.reset();
    this.muckView.setLoad(0);
    this.muckView.clear();
  }

  /** The strip is down: tick it off the board. */
  finishMuck() {
    this.achievements.note('muckSpread');
    if (this.jobBoard.complete('muck')) {
      this.hud.toast('Muck spread. Ticked off the board on the barn door', 3);
      this.jobBoardView.refresh();
      if (this.jobBoard.cleared) this.achievements.note('boardCleared');
    }
    this.saySomethingAboutJob('muckDone');
  }

  tipTrailerPrompt() {
    const item = this.heldLoad();
    const t = this.tipTrailer;
    if (!item) {
      if (this.canForkMuck()) return { text: this.muck.full ? 'The tub is full of muck   ·   T to tip it' : 'Hold E to fork muck into the trailer' };
      return { text: t.cargo.length || t.bed.tip > 0.02 || !this.muck.empty ? 'T to tip the trailer' : 'The little tipping trailer   ·   T to tip it' };
    }
    const what = this.loadName(item);
    if (t.bed.tip > 0.02) return { text: `The tub is up   ·   G put the ${what} down` };
    if (t.freeCargoSpot() === null) return { text: `The trailer is full   ·   G put the ${what} down` };
    return `Put the ${what} in the trailer`;
  }

  /** E at the trailer with a can, the toolbox, the jump leads or the oil bottle in your hands: stand it in the tub. */
  loadTipTrailer() {
    const item = this.heldLoad();
    if (item) this.tipTrailer.load(item);
  }

  /** The tipping trailer: its tub, its weight on whatever pulls it, and the girl who rides in it (vehicle/tipTrailer.js, npc/trailerRide.js). */
  updateTipTrailer(dt, ridden, input) {
    const t = this.tipTrailer;
    t.update(dt);
    this.noteFolded(t, ridden);
    this.updateMuck(dt);
    // What it takes from the quad (or tractor) in front of it.
    if (this.tipPuller && this.tipPuller !== t.puller) Object.assign(this.tipPuller.tow, { driveFactor: 1, brakeFactor: 1 });
    this.tipPuller = t.puller;
    if (t.puller) Object.assign(t.puller.tow, towEffect(towLoad(t.girlCount, t.cargo.length + this.muck.load * this.muckParams.towWeight, this.towParams), !!t.puller.tractor || !!t.puller.landRover, this.towParams));

    const riding = !!ridden && t.hitched && ridden.quad === t.puller;
    // T tips the tub, from the seat of whatever pulls it or standing by it.
    const near = riding || (!this.player.isRiding && this.player.position.distanceTo(t.model.position) < 3);
    if (near && input.wasPressed('KeyT') && !this.handsFull && !(ridden && !riding) && !(riding && ridden.quad.isTipped)) {
      // With muck in the tub T tilts it just enough to spread and holds it there; Shift+T tips it all the way out in one heap.
      const spread = !this.muck.empty && !(input.isDown('ShiftLeft') || input.isDown('ShiftRight'));
      const note = t.toggleTip(spread ? this.muckParams.spreadTipTo : 1);
      if (!note && spread && t.bed.want) this.hud.toast('Tub tilted to spread: drive on slowly. T lowers it, Shift+T tips the lot out', 3);
      if (note) this.achievements.note('tipped');
      if (note) this.hud.toast(note.replace('the bed', 'the tub'), 2);
    }

    const girlOf = (id) => this.companions.find((c) => c.character.id === id);
    const say = (c, key) => c?.voice.say(key, { urgent: true });
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      free: c.availability().free,
      aboard: c.onHayRide && c.trailer === t,
      dist: c.root.position.distanceTo(t.model.position),
    }));
    const ctx = { riding, active: riding && ridden.quad.engine.isRunning, speed: t.motion.speed, jolt: t.motion.jolt, slide: t.bed.sliding, girls };
    for (const ev of this.tipRide.update(dt, ctx)) {
      const c = girlOf(ev.girl);
      if (ev.type === 'board') {
        const slot = t.freeSlot();
        if (slot && c.boardTrailer(t, slot)) say(c, 'trailerBoard');
      } else if (ev.type === 'tell') say(c, 'trailerTell');
      else if (ev.type === 'bump') say(c, 'trailerBump');
      else if (ev.type === 'shout') say(c, 'trailerShout');
      else if (ev.type === 'slide') {
        if (c.slideOffTrailer(1, new THREE.Vector3(0, 0, -1))) this.tipRide.clear(ev.girl);
      } else if (ev.type === 'leave') {
        if (ev.bored) this.tipRide.dismiss(ev.girl);
        c.leaveTrailer();
        c.abortBoarding();
      }
    }
  }

  /** The wheel's "Trailer" slice for a girl: climb into the tipping trailer, or out again. */
  tipTrailerWheelOption(c) {
    const t = this.tipTrailer;
    const children = [];
    if (c.fsm.is('onTrailer') && c.trailer === t) children.push({ label: 'Get out of the trailer', run: () => (this.tipRide.dismiss(c.character.id), c.leaveTrailer()) });
    else if (c.fsm.is('idle') && t.freeSlot()) children.push({ label: 'Get in the trailer', run: () => this.askIntoTipTrailer(c) });
    return { label: 'Trailer', color: 0x9aa3a6, children };
  }

  /** You asked her into the trailer: she goes at once and stays until you ask her out. */
  askIntoTipTrailer(c) {
    const t = this.tipTrailer;
    const slot = t.freeSlot();
    if (!slot || !c.boardTrailer(t, slot)) return this.hud.toast('She can\'t just now');
    this.tipRide.ask(c.character.id);
    c.voice.say('trailerAsked', { force: true });
  }

  /** The wheel's "UTV" slice for a girl: get in (she picks her own seat), ride in the bed, or get out again. */
  utvWheelOption(c) {
    const mount = this.utvMount;
    const children = [];
    if (c.fsm.is('onTrailer') && c.trailer === mount) children.push({ label: 'Get out of the Yak', run: () => (this.utvRide.dismiss(c.character.id), c.leaveTrailer()) });
    else if (c.fsm.is('idle') && this.utvFree()) {
      if (mount.freeSlot(c.root.position)) children.push({ label: 'Get in the Yak', run: () => this.askIntoUtv(c, false) });
      if (this.goFree('utv') && c.canDrive(this.utvUnit.quad)) children.push({ label: 'Drive it', run: () => this.askDriveVehicle(c, 'utv') });
      if (this.canAskStart(c, 'utv')) children.push({ label: 'Start it', run: () => c.requestStart(this.utvUnit.quad) });
      if (!mount.bedBusy && this.utvBed.tip < 0.02) children.push({ label: 'Ride in the bed', run: () => this.askIntoUtv(c, true) });
    }
    return { label: 'Yak', color: this.utvUnit.spec.bodyColor, children };
  }

  /** Nobody is driving the UTV and it is standing still. */
  utvFree() {
    const q = this.utvUnit.quad;
    return !q.rider && !q.driver && q.speed < this.utvRide.p.stopSpeed;
  }

  /** You asked her into the UTV: she goes at once and stays until you ask her out. Amy won't ride in the bed. */
  askIntoUtv(c, inBed) {
    const mount = this.utvMount;
    if (inBed && c.character.id === 'amy') return void c.voice.say('utvBedRefuse', { force: true });
    const slot = inBed ? mount.slots.bed : mount.freeSlot(c.root.position);
    if (!slot || slot.girl || !c.boardTrailer(mount, slot)) return this.hud.toast('She can\'t just now');
    this.utvRide.ask(c.character.id);
    c.voice.say(inBed ? 'utvBedGo' : 'utvBoard', { force: true });
  }

  /**
   * Builds a Land Rover or one of the girls' cars: a unit like the UTV (not one of the girls' quads), with a quad's wear, faults, quirks and
   * oil. Amy's tidy Fiesta gets at most one quirk; Jess's thrashed Corsa at least two, and its throttle cable is twice as likely to stick.
   */
  addLandRover(spawn, spec) {
    const seed = { landrover200: 0x1a5c, fiesta: 0x1a6c, corsa: 0x1a7c, p309: 0x1a8c }[spec.id] ?? 0x1a4c; // each its own stream (the Series' first)
    const random = createRandom(this.farmSeed ^ seed);
    const unit = new QuadUnit({ spec, spawn, scene: this.scene, physics: this.physics, RAPIER: this.RAPIER, world: this.world, audioHub: this.audioHub });
    unit.idleRpm = applyIdle(unit.engine.params, unit.quad.params, pickIdle(spec.idleRange, random));
    unit.variation = applyVariation(spec, unit.engine.params, unit.quad.fuel, random);
    unit.topRpm = applyTopRpm(spec, unit.engine.params, createRandom(this.farmSeed ^ (seed + 2)));
    unit.quad.usage.odoMiles = pickReading(spec.odoRange, random);
    unit.engine.wear = spec.wearRange[0] + (spec.wearRange[1] - spec.wearRange[0]) * random();
    unit.quad.tyres = new TyreSet(dealTyres(random, 4, this.tyreParams), this.tyreParams);
    unit.quad.tyres.useLayout(unit.quad.layout.wheels);
    const quirkCount = spec.id === 'fiesta' ? { countTwo: 0, countThree: 0 } : spec.id === 'corsa' ? { countTwo: 0.7, countThree: 0.3 } : {};
    unit.quad.quirks = new QuirkSet(pickQuirks(featuresOf(spec, false), random, { ...this.quirkParams, ...quirkCount }), this.quirkParams);
    unit.quad.brakes = new BrakeState(this.brakeParams, random);
    unit.quad.brakes.setBinding(random() < this.brakeParams.bindChance);
    unit.quad.iceCable = new FrozenCable(this.frozenCableParams, random); // stood in the barn, so never frozen
    unit.quad.waxParams = this.dieselWaxParams;
    unit.quad.bleedParams = this.bleedParams;
    if (unit.quad.sump) unit.quad.sump = new Sump({ level: startLevel(false, random, this.sumpParams), burner: false, params: this.sumpParams });
    unit.quad.faults.roll(createRandom(this.farmSeed ^ (seed + 3)));
    unit.quad.faults.prone.belt = 0; // a clutch, not a belt
    if (spec.engine.compressionIgnition || spec.engine.injected) unit.quad.faults.prone.carb = 0; // and a diesel or an injected car has no carb
    if (spec.id === 'corsa') unit.quad.faults.prone.cable = 2; // Jess's: a throttle cable that sticks
    unit.quad.parkBrake = true;
    this.units = [...this.units, unit];
    unit.where = spawn.where;
    return unit;
  }

  /**
   * The 200TDi's front backrests: tipped forward while a girl climbs into or out of the back past one, or for a moment after you do,
   * unless somebody's sat in it (vehicle/rearAccess.js).
   */
  updateSeatTips(dt, q, mount, sitting) {
    const moving = [];
    for (const c of this.companions) {
      const slot = c.trailer === mount ? c.traSlot : null;
      if (!slot?.rear) continue;
      const near = c.fsm.is('walking') && c.fsm.data?.goal === 'board' && c.root.position.distanceTo(mount.standPoint(slot.side, slot).position) < 1.5;
      const climbing = c.fsm.is('boarding') || (c.fsm.is('onTrailer') && (c.fsm.data.leaving || c.fsm.data.fromWorld));
      if (near || climbing) moving.push(mount.doorOf(slot));
    }
    for (const k of Object.keys(q.tipHold)) {
      q.tipHold[k] = Math.max(0, q.tipHold[k] - dt);
      if (q.tipHold[k] > 0) moving.push(k);
    }
    const occupied = Object.keys(q.seatTips).filter((s) => sitting[s]);
    easeSeatTips(q.seatTips, seatTipTargets(moving, occupied), dt, this.rearAccess.tipSpeed);
  }

  /** What standing at the Land Rover's front says: the starting handle, how you're holding it, and whether your hand still hurts. */
  crankPrompt(quad) {
    const c = quad.crank;
    if (!c.ready) return 'Your hand hurts. Give it a moment';
    const grip = c.grip === 'round' ? 'thumb round the handle' : 'thumb alongside your fingers';
    const key = quad.engine.ignitionOn ? '' : '   ·   K ignition first';
    return `Starting handle (${grip})   ·   hold P, let go to swing   ·   1 thumb round   ·   2 thumb alongside${key}`;
  }

  /** A Land Rover: where you stand for the Series' starting handle and what a kick-back gets you, and the girls on its bench (npc/utvRide.js). */
  updateLandRover(dt, ridden, input, l) {
    const unit = l.unit;
    const q = unit.quad;
    const mount = l.mount;
    mount.update(dt);
    const riding = ridden === unit;
    if (l.cargo || unit.spec.defender || unit.spec.car) {
      // T drops or raises the Series' tailgate (or swings the 200TDi's back door), from the seat or standing by it; what stands in the tub goes with it.
      const near = riding || (!this.player.isRiding && this.player.position.distanceTo(q.position) < 3.2);
      if (near && input.wasPressed('KeyT') && !q.isTipped && !this.handsFull) {
        const note = q.tailgate.toggle(q.speed);
        if (note) this.hud.toast(note, 2);
      }
      l.cargo?.update(dt);
      if (l.cargo) this.updateLooseBed(l.cargo, l.unit.quad, dt);
    }
    const girlOf = (id) => this.companions.find((c) => c.character.id === id);
    const say = (c, key) => c?.voice.say(key, { urgent: true });
    // At the front, on foot, with the starting handle's hole in reach (ground distance: you stand, it's down at the bumper).
    const hole = q.crankHole?.getWorldPosition(new THREE.Vector3());
    const me = this.player.position;
    q.atCrank = !!q.crank && !this.player.isRiding && !!hole && Math.hypot(me.x - hole.x, me.z - hole.z) < q.crank.p.reach;
    if (q.kicked) {
      q.kicked = false;
      const near = this.companions.filter((c) => c.root.position.distanceTo(q.position) < 15).sort((a, b) => a.root.position.distanceTo(q.position) - b.root.position.distanceTo(q.position))[0];
      say(near, 'landyKick');
    }

    // The seat belts, as the UTV's: `;` for yours, and the girls do their own (vehicle/seatBelts.js). The 200TDi has the lamp and the bong; the old Series has neither.
    const youSeat = riding ? 'driver' : this.player.isRiding && q.passenger ? this.player.benchSeat : null;
    const sitting = Object.fromEntries(Object.keys(q.belts.seats).map((s) => [s, null])); // every seat with a belt, the back bench's too
    if (youSeat) sitting[youSeat] = 'you';
    for (const c of this.companions) {
      const seat = c.fsm.is('driving') && c.quad === q ? 'driver' : c.fsm.is('onTrailer') && c.trailer === mount ? c.traSlot?.name ?? null : null;
      if (seat && seat in sitting) sitting[seat] = 'girl';
    }
    if (youSeat && input.wasPressed('Semicolon')) q.belts.toggle(youSeat);
    if (q.belts.update(dt, sitting, q.engine.ignitionOn, dashClock().seconds()) && unit.spec.defender) {
      this.audioHub.beltBing(q.position);
      // The bong is for whoever has no belt on: if that is you, the nearest girl remarks on it.
      if (youSeat) {
        const near = this.companions.filter((c) => c.root.position.distanceTo(q.position) < 15).sort((x, y) => x.root.position.distanceTo(q.position) - y.root.position.distanceTo(q.position))[0];
        say(near, 'defenderBong');
      }
    }
    if (mount.rearSlots.length) this.updateSeatTips(dt, q, mount, sitting);

    const girls = this.companions.map((c) => ({
      id: c.character.id,
      free: c.availability().free,
      seat: c.onHayRide && c.trailer === mount ? c.traSlot?.name ?? null : null,
      dist: c.root.position.distanceTo(q.position),
    }));
    const parked = !riding && !q.rider && !q.driver && !q.passenger;
    for (const ev of l.ride.update(dt, { active: riding && q.engine.isRunning, riding, parked, playerSeat: q.passenger ? this.player.benchSeat : null, speed: q.speed, slide: false, girls })) {
      const c = girlOf(ev.girl);
      if (ev.type === 'board') {
        const slot = mount.slots[ev.seat];
        if (!slot || slot.girl || !c.boardTrailer(mount, slot)) continue;
        if (ev.squabble?.winner === ev.girl) {
          say(c, 'utvMiddleWin');
          this.hayLater.push({ left: 2.6, girl: girlOf(ev.squabble.loser), key: 'utvMiddleLose' });
        } else if (!ev.squabble) say(c, 'utvBoard');
      } else if (ev.type === 'leave') {
        if (ev.bored) l.ride.dismiss(ev.girl);
        c.leaveTrailer();
        c.abortBoarding();
      }
    }
  }

  /** The wheel's slice for a Land Rover or a car (`l`, from `landys`) for a girl: get in (she picks her own seat), or get out again; drive it if she may. */
  landyWheelOption(c, l) {
    const { mount, ride, kind } = l;
    const q = l.unit.quad;
    const from = c.root.position;
    const owner = l.spec.owner ? this.companions.find((o) => o.character.id === l.spec.owner)?.name ?? l.spec.owner : '';
    const options = vehicleOptions({
      name: l.spec.name,
      inside: c.fsm.is('onTrailer') && c.trailer === mount,
      idle: c.fsm.is('idle'),
      busy: this.busyWhy(c),
      moving: q.speed >= ride.p.stopSpeed,
      youDriving: !!q.rider,
      girlDriving: !!q.driver,
      seatFree: !!(mount.freeSlot(from) || mount.freeRearSlot(from)),
      hasBack: !!mount.rearSlots.length,
      backFree: !!mount.freeRearSlot(from),
      mayDrive: mayDriveCar(c.character.id, l.spec) || l.spec.owner === 'you', // asked to drive yours, she says it's yours (refuseCarLine)
      ownerName: owner,
      canDrive: c.canDrive(q),
      driveFree: this.driveFree(kind),
      running: q.engine.isRunning,
      untouched: this.goFree(kind),
    });
    const children = wheelChildren(options, (key) => {
      if (key === 'out') (ride.dismiss(c.character.id), c.leaveTrailer());
      else if (key === 'in') this.askIntoLandy(c, l);
      else if (key === 'back') this.askIntoLandy(c, l, { back: true });
      else if (key === 'drive') this.askDriveVehicle(c, kind);
      else if (key === 'start') c.requestStart(q);
    });
    return { label: l.spec.name, color: l.spec.bodyColor, children };
  }

  /** Why she can't be asked something just now, for a greyed wheel option. */
  busyWhy(c) {
    const why = c.availability({ asked: true, pull: true }).why;
    return why && why !== 'free' ? `she's ${why}` : 'she\'s busy';
  }

  /**
   * Nobody is at the wheel, or on their way to it, and it's stopped. Unlike goFree, someone sat in the other seats (you, or her friend on the
   * bench) doesn't stop her taking the wheel, for the Land Rovers and the girls' cars.
   */
  driveFree(kind) {
    if (!CAB_KINDS.includes(kind)) return this.goFree(kind);
    const unit = this.goVehicle(kind);
    if (!unit) return false;
    const q = unit.quad;
    const busy = (c) => c.quad === q && (c.fsm.is('driving', 'mounting', 'dismounting', 'shuffling', 'cranking') || (c.fsm.is('walking') && ['drive', 'crank'].includes(c.fsm.data?.goal)));
    return !q.rider && !q.driver && !q.isTipped && q.speed < 0.5 && !this.companions.some(busy);
  }

  /** You asked her into a Land Rover: she goes at once and stays until you ask her out. `back`: the 200TDi's back bench. */
  askIntoLandy(c, l, { back = false } = {}) {
    const from = c.root.position;
    const slot = back ? l.mount.freeRearSlot(from) : l.mount.freeSlot(from) ?? l.mount.freeRearSlot(from);
    if (!slot || slot.girl || !c.boardTrailer(l.mount, slot)) return this.hud.toast('She can\'t just now');
    l.ride.ask(c.character.id);
    c.voice.say('utvBoard', { force: true });
  }

  /** One manual vehicle (a quad or the tractor) has a worn gearbox this game: a gear that jumps out under load on a climb. Seeded. */
  /** Hold V by a quad to shove it along its length, away from you (or backwards from the side): how you reverse one that has no reverse. */
  pushOnFoot(input, looked) {
    if (!input.isDown('KeyV') || this.handsFull) {
      this.pushing = null;
      return;
    }
    // Keep hold of the one you started on as it rolls, even when your eyes move off it.
    const unit = looked && !looked.spec.tractor ? looked : this.pushing;
    if (!unit || unit.spec.tractor || this.player.isRiding) return;
    const q = unit.quad;
    const p = q.controlsParams;
    const d = this.player.position.clone().sub(q.position);
    if (d.length() > p.pushRange + 1.5) {
      this.pushing = null;
      return;
    }
    if (q.parkBrake) {
      q.say('The parking brake is on (Space to take it off)');
      return;
    }
    this.pushing = unit;
    q.pushDir = pushDirection(localAlong(d.x, d.z, q.yaw), p);
  }

  /** Something has gone well or badly for a girl (npc/memory.js): she feels differently about that kind of thing for a while. `id` may be 'you'. */
  noteOutcome(id, outcome) {
    const c = this.companions.find((o) => o.character.id === id);
    c?.memory.note(outcome, c.params);
  }

  /** A girl stuck out in the field (npc/stranded.js): she shouts where she is, and what comes of you coming, or not, is her favour of you. */
  onStranded(c, e) {
    const id = c.character.id;
    const kind = c.stranded?.kind === 'tipped' ? 'tip' : 'bog';
    if (e.type === 'shout' && e.n === 0) {
      c.memory.note(kind === 'tip' ? 'tipped' : 'bogged', c.params); // her first call: it has just happened
      const unit = this.units.find((u) => u.quad === c.quad);
      this.dayEvents.add('stranded', { girl: id, how: kind, quad: unit ? shortName(unit.name) : 'quad' });
    }
    if (e.type === 'shout') {
      const spot = nearestNamedSpot(c.quad.position.x, c.quad.position.z);
      // The first, and every third after, say where she is; the rest are just a shout.
      const where = e.n % 3 === 0;
      c.voice.say(where ? `callout_${kind}_${spot.id}` : 'calloutAgain', { force: true });
    } else if (e.type === 'left') {
      this.favour.add(id, e.favour);
      c.voice.say('calloutLeft', { force: true });
    } else if (e.type === 'rescued') {
      if (e.came) {
        this.favour.add(id, e.favour);
        c.voice.say(e.quick ? 'calloutThanksQuick' : 'calloutThanksSlow', { urgent: true });
      }
    } else if (e.type === 'gaveUp') {
      if (e.favour) this.favour.add(id, e.favour);
      c.voice.say('calloutGiveUp', { urgent: true });
    }
  }

  /** An empty quad that's rolling off with its brake off: the girls near it say whose fault it was (a real tally, vehicle/handbrake.js). */
  updateHandbrake(dt) {
    const quads = this.units
      .filter((u) => !u.spec.tractor)
      .map((u) => {
        const q = u.quad;
        return { id: u.id, attended: !!(q.input || q.ghost || q.driver || q.creeping || q.towed || q.passenger || q.pushLeft > 0), braked: q.parkBrake, speed: Math.hypot(q.velocity.x, q.velocity.z), left: q.lastLeft };
      });
    for (const e of this.rollWatch.update(dt, quads)) {
      const at = this.units.find((u) => u.id === e.id).quad.position;
      const girls = this.companions.map((c) => ({ id: c.character.id, near: c.root.position.distanceTo(at) < this.handbrakeParams.hearRange && !c.fsm.is('driving') }));
      for (const r of rollReactions(e, girls)) this.companions.find((c) => c.character.id === r.girl)?.voice.say(r.situation, { force: true });
    }
  }

  /**
   * A girl taking the wheel of a quad with a 2WD / 4WD switch may remember to put it in 4WD (a per-girl chance); if she doesn't and it
   * bogs her down in 2WD, she works out why, flips it, and her friend (if near) says so (vehicle/driveMode.js).
   */
  updateFourWd(dt) {
    for (const c of this.companions) {
      const st = this.fourWdState.get(c) ?? { quad: null, watch: new StuckWatch(DEFAULT_DRIVE_PARAMS) };
      this.fourWdState.set(c, st);
      const q = c.fsm.is('driving') && c.quad.drive ? c.quad : null;
      if (q !== st.quad) {
        st.quad = q;
        st.watch.reset();
        if (q && Math.random() < c.params.remembers4wd) q.drive.engage4wd();
      }
      if (!q) continue;
      const mud = Math.max(this.world.mudAt(q.position.x, q.position.z), this.world.bogAt?.(q.position.x, q.position.z) ?? 0);
      const speed = Math.hypot(q.velocity.x, q.velocity.z);
      if (!st.watch.update(dt, { is2wd: !q.drive.frontDriven, throttle: q.throttle, mud, speed })) continue;
      q.drive.engage4wd();
      const near = this.companions.filter((o) => o === c || o.root.position.distanceTo(q.position) < DEFAULT_HANDBRAKE_PARAMS.hearRange).map((o) => o.character.id);
      for (const r of forgotReaction(c.character.id, near)) this.companions.find((o) => o.character.id === r.girl)?.voice.say(r.situation, { force: true });
    }
  }

  /** A split seat soaks up the rain, and soaks you if you sit on it wet; the nearest girl has something to say. */
  updateQuirks(dt, ridden) {
    const raining = this.weather.rain > 0.25;
    for (const u of this.units) {
      const q = u.quad;
      const covered = !!this.world.covered?.(q.position.x, q.position.z);
      q.quirks.seatStep(dt, { raining, covered });
      // The weather as it is now: the frost and the temperature move over the day.
      q.iceCable.update(dt, { running: u.engine.isRunning, engineTemp: u.engine.temperature, covered, frost: this.weather.frost, temperature: this.weather.temperature, sun: this.weather.warmth });
    }
    if (ridden === this.lastRiddenForSeat) return;
    this.lastRiddenForSeat = ridden;
    if (!ridden) return;
    const remark = (situation) => {
      const near = this.companions.filter((c) => c.quad.position.distanceTo(ridden.quad.position) < 10);
      near[Math.floor(Math.random() * near.length)]?.voice.say(situation, { force: true });
    };
    if (ridden.quad.seatFrost > 0.3) {
      this.hud.toast('The seat is frosted over', 2.5);
      remark('seatFrosty');
    }
    if (ridden.quad.quirks.sitOn()) {
      this.hud.toast('The seat is split and soaked: your trousers are wet through', 3);
      remark('seatSoaked');
    }
  }

  /** Gives a quad its past: wear, any starting faults and any tinkering left in (the toolbox opens on it as it is, with stock the factory's). */
  applyHistory(unit, random, faultChance, kept = null) {
    const [lo, hi] = unit.spec.hoursRange ?? [0, 0];
    const h = pickHistory(unit.spec, random, { faultChance, hoursT: hi > lo ? (unit.quad.usage.hours - lo) / (hi - lo) : 0.5 });
    if (kept) {
      // The farm remembers this one: its wear, faults and tuning are put back by restoreVehicles, and nobody else has tinkered with it.
      // It was still drawn above so the stream stays in step; who had it out yesterday is still dealt.
      Object.assign(h, { faults: [], tinker: null });
      this.history.quads[unit.id] = h;
      return;
    }
    unit.engine.wear = h.wear;
    if (unit.engine.params.strokes === 2) unit.engine.silencerBlown = Math.min(0.6, h.wear * 0.8); // an old two-stroke's packing has started to go
    for (const f of h.faults) unit.quad.faults.leave(f.kind, f.level);
    if (h.tinker) {
      const stock = captureStock(tuneTarget(unit));
      const settings = applyTune(tuneTarget(unit), stock, clampSettings({ ...stockSettings(stock), ...h.tinker }, stock));
      unit.leftovers = { stock, settings };
    }
    this.history.quads[unit.id] = h;
  }

  /**
   * The farm remembers (farm/farmState.js): each vehicle's condition from the last day, after the night, over what was dealt this
   * morning; its tuning; the barn find's progress; and where the pods are. Nothing on a new farm or a seeded game.
   */
  restoreVehicles() {
    const save = this.farm.save;
    if (!save) return;
    for (const unit of this.units) {
      const s = save.vehicles?.[unit.id];
      if (!s) continue;
      restoreVehicle(unit, overnight(s, this.farmParams));
      if (s.settings) {
        const stock = captureStock(tuneTarget(unit));
        const settings = applyTune(tuneTarget(unit), stock, clampSettings({ ...stockSettings(stock), ...s.settings }, stock));
        unit.leftovers = { stock, settings };
        unit.idleRpm = settings.idle;
      }
      if (unit.barnFind && s.barnFind) {
        unit.barnFind.restore(s.barnFind);
        unit.engine.startBlocked = unit.barnFind.startBlocked;
        if (unit.barnFind.tarpOff && unit.tarp) unit.tarp.visible = false; // (its look is not on yet: dressFinds does the rest)
        unit.rustyLook?.sync(unit.barnFind, { instant: true });
      }
      const h = this.history.quads[unit.id];
      if (h) Object.assign(h, { wear: unit.engine.wear, faults: savedFaults(s) });
    }
    for (const [kind, at] of Object.entries(save.pods ?? {})) {
      if (!(kind in this.podRack.at) || this.podRack.at[kind] === at) continue;
      const from = this.units.find((u) => u.id === this.podRack.at[kind]);
      if (from && this.podRack.takeOff(from.id)) from.quad.removePod();
      const to = this.units.find((u) => u.id === at);
      if (to?.quad.model.userData.podMount && this.podRack.fit(kind, to.id)) to.quad.fitPod(this.pods[kind]);
    }
  }

  /** The rest of what the farm remembers, once everything is built: the girls, the bucket list and the records (the logbook does its own). */
  restoreDay() {
    const save = this.farm.save;
    if (!save) return;
    restoreGirls(this, save.girls, this.farmParams);
    this.achievements.restore(save.bucket);
    this.discoveries.restore(save.learnt);
    this.records.restore(save.records);
    this.challenges.restore(save.challenges);
    this.jobBoardView.refresh();
    this.photos.wall.restore(save.photos);
    this.photos.view.refresh();
    this.showKeeper.restore(save.shows);
    this.records.extra = [this.showKeeper.recordLine()];
    this.jobBoardView.refresh();
    this.trophyShelf?.show(this.showKeeper.shelf());
    this.headgear.restore(save.headgear);
    this.helmetHooks.show(this.headgear.onHooks());
    this.spares.restore(save.spares);
    this.restoreBatteries(save.batteries);
    this.restoreBoosterPack(save.boosterPack);
    this.generator.restore(save.generator);
    this.sparesShelf.showParcel();
  }

  /** Everything the farm keeps, as plain data (farm/farmSave.js writes it). */
  /** Buys one of the board's ads (classifiedsView.js): the money goes now and the vehicle is in the yard tomorrow. Saved at once, so it is not lost if the tab closes. */
  buyAd(ad) {
    if (this.farm.seeded) return this.hud.toast('A seeded game is not kept, so nothing would turn up tomorrow', 3);
    const why = this.market.whyNot(ad);
    if (why) return this.hud.toast(why, 2.5);
    const spec = this.specsById[ad.specId];
    this.market.buy(ad, this.farm.day);
    this.notebook.note({ name: spec.name }, { kind: 'deal', deal: 'bought', price: ad.price }, { by: 'you', saw: true });
    this.saveFarm?.();
    this.refreshMarketViews();
    this.hud.toast(`Bought: the ${colourName(ad.colour)} ${spec.label}. It will be here in the morning`, 3.5);
    this.coinAudio.chink(0.9);
    this.saySomethingAboutMoney('moneyBought', { chance: this.marketTalkParams.buyChance });
  }

  /** The board and the tin show the money and the ads as they are now. */
  refreshMarketViews() {
    this.classifiedsView.refresh();
    this.moneyTin.refresh();
    this.shedView?.refresh();
  }

  /** Buys a piece of the shed kit from the catalogue (shedView.js): the money goes now and it stands in the barn tomorrow. Saved at once. */
  buyShedPiece(id) {
    if (this.farm.seeded) return this.hud.toast('A seeded game is not kept, so nothing would turn up tomorrow', 3);
    const why = this.shed.whyNot(id, this.market.purse);
    if (why) return this.hud.toast(why, 2.5);
    this.shed.buy(id, this.market, this.farm.day);
    this.saveFarm?.();
    this.refreshMarketViews();
    this.hud.toast(`Bought: the ${SHED_PIECES[id].name.toLowerCase()}. It will be in the barn in the morning`, 3.5);
    this.coinAudio.chink(0.9);
    this.saySomethingAboutShed('shedBought', { piece: id });
  }

  /** Ten seconds into a morning when a piece of the shed kit has turned up overnight, a girl nearby remarks on it, once. */
  updateShedTalk(dt) {
    this.shedTalkClock = (this.shedTalkClock ?? 0) + dt;
    if (this.shedArrivedSaid || this.shedTalkClock < 10) return;
    if (!this.shed.arrivals(this.farm.day).length) {
      this.shedArrivedSaid = true;
      return;
    }
    if (this.saySomethingAboutShed('shedArrived', { within: 25, chance: 0.5 })) this.shedArrivedSaid = true;
  }

  /** A girl remarks on the shed kit (npc/shedLines.js): the nearest who is free to, as for the money. */
  saySomethingAboutShed(situation, { chance = 1, ...rest } = {}) {
    return this.saySomethingAboutMoney(situation, { chance: situation === 'shedBought' ? 1 : chance, ...rest });
  }

  /** Hands a piece over and stands it in the barn at once (the debug panel and the console). */
  giveShedPiece(id, on = true) {
    if (on) this.shed.give(id);
    else this.shed.take(id);
    this.shedView.setStanding(id, on);
    this.refreshMarketViews();
  }

  /**
   * One girl says something about the money (npc/moneyLines.js): the nearest who is free to remark, or the nearest at all when `force` (the debug
   * panel). `girl` picks her; `at` is where to measure from (you, by default). Returns the girl who said it, or null.
   */
  saySomethingAboutMoney(situation, { chance = 1, force = false, girl = null, at = this.player.position, within = 30 } = {}) {
    const ranked = this.companions
      .filter((c) => (!girl || c.character.id === girl) && (force || c.availability().canRemark) && c.root.position.distanceTo(at) < within)
      .sort((a, b) => a.root.position.distanceTo(at) - b.root.position.distanceTo(at));
    const c = ranked[0];
    if (!c) return null;
    const said = c.voice.say(situation, force ? { force: true } : { chance });
    return said ? c : null;
  }

  /** The remarks that come from the state of things, not a moment: an ad on the board, the tin low or full, a bought vehicle turned up (farm/marketTalk.js). */
  updateMarketTalk(dt) {
    const free = this.companions.filter((c) => c.availability().canRemark);
    const you = this.player.position;
    const arrivals = this.market.arrivals(this.farm.day);
    const arrived = arrivals.map((b) => this.units.find((u) => u.spec.id === b.specId)).filter(Boolean);
    const p = this.marketTalkParams;
    const kind = this.marketTalk.update(dt, {
      atTin: you.distanceTo(this.moneyTin.position),
      girlNear: free.some((c) => c.root.position.distanceTo(you) < 15),
      purse: this.market.purse,
      ads: this.market.ads,
      arrivals: arrived.length,
      arrivalGirlNear: arrived.some((u) => free.some((c) => c.root.position.distanceTo(u.quad.position) < p.arrivedRange)),
    });
    if (!kind) return;
    const at = kind === 'moneyArrived' ? arrived.find((u) => free.some((c) => c.root.position.distanceTo(u.quad.position) < p.arrivedRange))?.quad.position : you;
    const girl = this.saySomethingAboutMoney(kind, { at, within: kind === 'moneyArrived' ? p.arrivedRange : 15 });
    if (!girl) return;
    if (kind === 'moneyAd') this.marketTalk.saidAds(this.market.ads);
    else this.marketTalk.said(kind);
  }

  /** The vehicles on the farm a buyer would take, each with its offer and why not if it can't go: [{ unit, specId, offer, why }]. */
  sellable() {
    const regulars = QUAD_SPECS.map((s) => s.id);
    const ctx = { onFarm: this.stockedIds, regulars };
    return this.units
      .filter((u) => u.spec.id in FOR_SALE && !u.barnFind)
      .map((unit) => {
        const faults = Object.values(unit.quad.faults?.started ?? {}).filter(Boolean).length;
        const offer = sellOffer(unit.spec.id, { wear: unit.engine.wear ?? 0, bodyWear: unit.spec.bodyWear ?? 0, faults }, this.marketParams);
        return { unit, specId: unit.spec.id, offer, why: this.market.sellWhyNot(unit.spec.id, ctx) };
      });
  }

  /** Sells a vehicle from the board (classifiedsView.js): the money now, the vehicle collected in the morning. Saved at once. */
  sellUnit(item) {
    if (this.farm.seeded) return this.hud.toast('A seeded game is not kept, so nobody would collect it', 3);
    const done = this.market.sell(item.specId, item.offer, { onFarm: this.stockedIds, regulars: QUAD_SPECS.map((s) => s.id) }, this.farm.day);
    if (!done) return this.hud.toast(item.why ?? 'Nobody wants that', 2.5);
    this.notebook.note(item.unit, { kind: 'deal', deal: 'sold', price: done.price }, { by: 'you', saw: true });
    this.saveFarm?.();
    this.refreshMarketViews();
    this.hud.toast(`Sold: the ${item.unit.label} for £${done.price}. It is collected in the morning`, 3.5);
    this.coinAudio.chink(0.9);
    this.saySomethingAboutMoney('moneySold', { chance: this.marketTalkParams.sellChance });
  }

  /** Debug: puts up ads now, whatever the day's dice said (up to three, from the models not on the farm), and redraws the board. */
  debugDealAds() {
    const P = { ...this.marketParams, adDayChance: 1, secondAdChance: 1, thirdAdChance: 1 };
    this.market.ads = dealAds(createRandom((Math.random() * 2 ** 31) >>> 0), { specs: this.specsById, onFarm: this.stockedIds, owned: this.market.bought, P });
    this.refreshMarketViews();
    return this.market.ads.length;
  }

  debugClearAds() {
    this.market.ads = [];
    this.refreshMarketViews();
  }

  debugSetPurse(pounds) {
    this.market.purse = Math.max(0, Math.round(pounds));
    this.refreshMarketViews();
  }

  /** One line about the shed kit, for the debug panel and the console. */
  describeShed() {
    const day = this.farm.day;
    return Object.keys(SHED_PIECES).map((id) => `${id}: ${this.shed.has(id, day) ? 'in the barn' : this.shed.onTheWay(id, day) ? 'on the way' : `£${this.shed.price(id)}`}`).join(', ');
  }

  /** One line about the market, for the debug panel and the console. */
  describeMarket() {
    const m = this.market;
    const bought = m.bought.map((b) => `${colourName(b.colour)} ${this.specsById[b.specId]?.label ?? b.specId}`).join(', ');
    return `£${m.purse} in the tin${m.sold.length ? `, going in the morning: ${m.sold.join(', ')}` : ''}, ${m.ads.length ? m.ads.map((a) => a.text).join(' | ') : 'no ads today'}${bought ? `; bought: ${bought}` : ''}`;
  }

  captureFarm() {
    const vehicles = {};
    for (const unit of this.units) {
      vehicles[unit.id] = captureVehicle(unit, { settings: this.history.settingsFor(unit), barnFind: unit.barnFind?.toJSON() });
    }
    return {
      day: this.farm.day,
      farmSeed: this.farmSeed,
      savedAt: Date.now(),
      fleet: this.fleetIds,
      market: this.market.toJSON(),
      shed: this.shed.toJSON(),
      vehicles: keepAway(vehicles, this.farm.save?.vehicles, this.carsAway), // a girl's car that stayed at home today keeps what it had (farm/arrival.js)
      pods: { ...this.podRack.at },
      girls: captureGirls(this),
      bucket: this.achievements.toJSON(),
      learnt: this.discoveries.toJSON(),
      records: this.records.toJSON(),
      challenges: this.challenges.toJSON(),
      photos: this.photos.wall.toJSON(),
      shows: this.showKeeper.toJSON(),
      logbook: this.notebook.book.toJSON(),
      stories: this.stories,
      spares: this.spares.toJSON(),
      generator: this.generator.toJSON(),
      headgear: this.headgear.capture(),
      bales: this.baleRig.yard.toJSON(),
      logs: this.logStack ? { ...this.logStack.toJSON(this.farm.day), fitted: this.splitterFitted } : undefined,
      hay: this.hay?.toJSON(),
      spray: this.spray?.toJSON(),
      lane: this.world.wear.laneToJSON(),
      boosterPack: { charge: this.boosterPack.engine.battery, where: this.boosterPack.where === 'charger' ? 'charger' : 'loose' },
      batteries: Object.fromEntries([...this.batteries].filter(([id, b]) => id !== BOOSTER_ID && b.out).map(([id, b]) => [id, { where: b.where === 'charger' ? 'charger' : 'loose' }])),
    };
  }

  /** The wall calendar is how you call it a day (farm/endOfDay.js): E on it in the evening, with the girls in the barn, fades to black and loads the next day. */
  setUpEndOfDay() {
    this.dayFade = new DayFade();
    this.dayRecap = new DayRecap();
    this.dayEvents = new DayEvents(); // what happened today, for the story on the card (farm/dayStory.js)
    this.stories = validStories(this.farm.save?.stories); // the last few days' stories, read on the calendar
    this.storiesView = new StoriesView({ game: this });
    this.sawSeized = new Set(); // quads already seen seized, so the story tells each once
    this.dayRecapEl = document.createElement('div');
    this.dayRecapEl.id = 'day-recap';
    this.dayRecapEl.addEventListener('click', () => this.dismissRecap());
    document.body.appendChild(this.dayRecapEl);
    this.dayFadeEl = document.createElement('div');
    this.dayFadeEl.id = 'day-fade';
    this.dayFadeEl.innerHTML = '<p></p>';
    document.body.appendChild(this.dayFadeEl);
    this.interaction.add({
      target: this.wallCalendar.group,
      isAvailable: () => !this.dayFade.active && !this.dayRecap.active,
      prompt: () => {
        const now = this.endOfDayNow();
        return { text: this.stories.length && !now.ok ? `${now.text}. Press E to read the last few days` : now.text };
      },
      feedback: 'own',
      interact: () => (this.stories.length && !this.endOfDayNow().ok ? this.storiesView.open() : this.callItADay()),
    });
  }

  /** Whether you could call it a day now, and what the calendar says about it. */
  endOfDayNow() {
    const b = this.world.layout.barn;
    const girls = this.companions.map((c) => ({
      name: c.character.name,
      home: Math.hypot(c.root.position.x - b.x, c.root.position.z - b.z) < this.farmParams.endDayHomeRadius,
    }));
    const now = endOfDay(
      { hour: this.daylight.hour, seeded: this.farm.seeded, canSave: !!this.farmStorage, girls, day: this.farm.day },
      { ...this.farmParams, endDayHour: Math.min(this.farmParams.endDayHour, this.daylight.p.sunset - 0.25) }, // a winter evening comes sooner
    );
    if (this.isShowToday()) now.text = now.ok ? `Press E to take your quad to the show (${this.showPreview()})` : `${now.text}. The show is today: ${this.showPreview()}`;
    return now;
  }

  /** The last Sunday of the month (farm/showDay.js), or made so from the debug panel. */
  isShowToday() {
    return this.showForced || isShowDay(this.date);
  }

  /** What the judge would read off a unit now (farm/showDay.js `judgeQuad` takes it): its mud, wear, damage and faults. */
  showCondition(unit) {
    const f = unit.quad.faults;
    return {
      mud: Math.max(unit.mud?.state.body ?? 0, unit.mud?.state.wheels ?? 0),
      mudBody: unit.mud?.state.body ?? 0,
      mudWheels: unit.mud?.state.wheels ?? 0,
      bodyWear: unit.spec.bodyWear ?? 0,
      damage: [f.tyre, f.rodWheel, f.rimWheel].filter((w) => w >= 0).length,
      engineWear: unit.engine.wear ?? 0,
      fouling: unit.engine.fouling ?? 0,
      faults: Object.values(f.started ?? {}).filter(Boolean).length,
      battery: unit.engine.battery ?? 1,
    };
  }

  /** The quad you would enter: the last quad you rode, if it is one (not the tractor or a car). */
  showEntry() {
    const u = this.lastRiddenUnit;
    return u && QUAD_SPECS.some((s) => s.id === u.spec.id) ? u : null;
  }

  /** The farm's entries: yours first, then each girl's own quad (if it is not yours): [{ id, name, label, quad }]. */
  showEntries() {
    const mine = this.showEntry();
    const out = [];
    if (mine) out.push({ id: 'you', name: 'You', label: `the ${mine.label}`, quad: this.showCondition(mine) });
    for (const c of this.companions) {
      const own = c.homeQuad ?? c.quad;
      const unit = own && this.units.find((u) => u.quad === own);
      if (unit && unit !== mine && QUAD_SPECS.some((s) => s.id === unit.spec.id)) out.push({ id: c.character.id, name: c.character.name, label: `the ${unit.label}`, quad: this.showCondition(unit) });
    }
    return out;
  }

  /** What the entry would score if the show were now, as a line for the calendar. */
  showPreview() {
    const u = this.showEntry();
    return u ? previewText(`the ${u.label}`, judgeQuad(this.showCondition(u), this.showParams)) : 'Nothing entered: ride a quad last and it is the entry';
  }

  /** The show: your quad and each girl's are judged against the others, the girls ride the slow race, and the result is kept (rosette, favour, bucket list). */
  judgeShow() {
    const show = runShow({ entries: this.showEntries(), farmSeed: this.farmSeed, date: this.date, rnd: createRandom((this.farmSeed ^ (this.farm.day * 7919)) >>> 0)(), p: this.showParams });
    if (show.place) {
      this.showKeeper.add(this.farm.day, this.date, show);
      this.trophyShelf.show(this.showKeeper.shelf());
      this.records.extra = [this.showKeeper.recordLine()];
      this.jobBoardView.refresh();
      for (const c of this.companions) this.favour.add(c.character.id, this.showParams.favourEntered + (show.place <= 2 ? this.showParams.favourWon : 0));
      if (show.place === 1) this.achievements.note('showFirst');
    }
    return show;
  }

  /** One line about the show, for the debug panel and the console. */
  describeShow() {
    const d = this.date;
    const k = this.showKeeper;
    return `${isShowDay(d) ? 'the show is today' : isShowEve(d) ? 'the show is tomorrow' : this.showForced ? 'made show day' : 'no show today'}; ${k.results.length} rosette${k.results.length === 1 ? '' : 's'}, ${k.wins()} first${k.wins() === 1 ? '' : 's'}${k.results.length ? `; latest: ${k.results[k.results.length - 1].month} ${['', '1st', '2nd', '3rd', '4th'][k.results[k.results.length - 1].place] ?? 'commended'}` : ''}`;
  }

  /** Each frame: which quad you rode last (the show judges it), and the girls saying the show is coming. */
  updateShowDay(dt) {
    if (this.riddenUnit) this.lastRiddenUnit = this.riddenUnit;
    if (this.showSaid || this.paused || (this.farm.seeded && !this.showForced)) return;
    const today = this.isShowToday();
    if (!today && !isShowEve(this.date)) return;
    this.showClock = (this.showClock ?? 0) + dt;
    if (this.showClock < this.showParams.showEveAfter) return;
    const girl = this.companions.find((c) => c.availability().canRemark);
    if (!girl) return;
    this.showSaid = true;
    girl.voice.say(today ? 'showToday' : 'showEve', { force: true });
    this.hud.toast(today ? 'It is the show today: the quad you last ride will be judged this evening' : 'The show is tomorrow: wash a quad, tidy it up and get it running sweet', 4);
  }

  /** The day as the briefing will read it (npc/briefing.js): the weather and board, the quad most playing up, what each girl has in mind. */
  briefingPlan() {
    const faults = Object.fromEntries(this.girlUnits.map((u) => [u.spec.id, u.quad.faults]));
    const agendas = Object.fromEntries(this.companions.map((c) => [c.character.id, c.agenda.id]));
    return planBriefing({ weather: this.weather, promise: this.weather.promise, trouble: worstTrouble(faults, FAULT_KINDS, this.briefingParams.briefingTroubleFrom), agendas });
  }

  /** Starts the briefing now, whatever the clock (the debug panel and the console). */
  startBriefing() {
    this.briefing.begin(this.briefingPlan());
  }

  /** Soon after the game loads, Amy reads out the day, a part at a time as the girls are free (npc/briefing.js). What they say here they don't say again unprompted. */
  updateBriefing(dt) {
    const b = this.briefing;
    if (this.paused || (!b.steps && !this.firstFrameDone)) return;
    if (b.due(dt)) this.startBriefing();
    const girlOf = (id) => this.companions.find((c) => c.character.id === id);
    const quiet = this.companions.every((c) => c.voice.floor.left <= 0);
    const step = b.next(dt, quiet, (id) => !!girlOf(id)?.availability().canRemark);
    if (!step) return;
    const c = girlOf(step.girl);
    const said = step.quad ? c.voice.sayQuad(step.key, step.quad, { force: true }) : c.voice.say(step.key, { force: true, chance: 1 });
    if (step.agenda) c.agenda.mention();
    for (const o of this.companions) {
      o.voice.weatherAt ??= 0;
      o.voice.weatherSaid = true; // the briefing covered the weather, the board and the season's remark waits its turn
      o.voice.forecastSaid = true;
    }
    return said;
  }

  /** Crosses the day off: the recap card comes up over the dark while the farm saves, and a press on it starts the fade (updateEndOfDay). */
  callItADay({ force = false } = {}) {
    if (this.dayFade.active || this.dayRecap.active) return;
    const now = this.endOfDayNow();
    if (!now.ok && !(force && !this.farm.seeded)) return this.hud.toast(now.text);
    this.lastShow = this.isShowToday() ? this.judgeShow() : null;
    this.writeDayStory();
    this.saveFarm();
    this.showRecap();
  }

  /** The day's story, written from what happened and kept with the last few: it goes on the card and into the save (farm/dayStory.js). */
  writeDayStory() {
    if (this.lastShow) this.dayEvents.add('show', { place: this.lastShow.place });
    this.story = this.storyNow();
    this.stories = keepStory(this.stories, this.farm.day, this.story, this.farmParams);
  }

  /** The story as it would read now, as sentences (the console and the panel show it; nothing is kept). */
  storyNow() {
    const a = this.achievements;
    const lines = this.jobBoard.lines();
    const totals = { metres: a.n('metres'), bogs: a.n('bogged'), jobs: lines.filter((l) => l.done).length, jobsCleared: this.jobBoard.cleared };
    return writeStory(this.dayEvents.list, totals, this.farmParams, createRandom((this.farmSeed ^ (this.farm.day * 104729)) >>> 0));
  }

  /** A quad seizing is the story's breakdown: seen once a quad, on the way in (the strip-down clears it, and it can seize again another day). */
  updateDayStory() {
    const primed = this.storyPrimed; // the first look only notes what was already seized when the day loaded (a kept farm's engines are restored by then)
    this.storyPrimed = true;
    for (const u of this.units) {
      const seized = !!u.engine?.seized;
      if (primed && seized && !this.sawSeized.has(u)) this.dayEvents.add('seized', { quad: shortName(u.name) });
      if (seized) this.sawSeized.add(u);
      else this.sawSeized.delete(u);
    }
  }

  /** The card over the dark: Amy's logbook for today, what was ticked off, and each girl's sign-off. */
  showRecap() {
    const a = this.achievements;
    const ticked = a.entries().filter((e) => e.done && a.unlocked.get(e.id) >= 0).map((e) => e.name);
    const r = dayRecap(
      {
        day: this.farm.day,
        entries: todaysLog(this.notebook.book.entries, formatEntry, this.notebook.book.day),
        ticked,
        score: a.score(),
        metres: a.n('metres'),
        bogs: a.n('bogged'),
        money: moneyFacts(this.market.today, this.market.purse),
        story: this.story,
      },
      this.farmParams,
    );
    const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
    const list = (items, more, none) =>
      items.length ? `<ul>${items.map((t) => `<li>${esc(t)}</li>`).join('')}${more ? `<li>and ${more} more</li>` : ''}</ul>` : `<p class="none">${none}</p>`;
    const show = this.lastShow && showCard(this.lastShow);
    const showHtml = show
      ? `<h3>${esc(show.title)}</h3>${show.rosette !== null ? rosetteSvg(show.rosette) : ''}<p class="total">${esc(show.headline)}</p>${show.lines.length ? `<ul>${show.lines.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}` +
        `${show.ranking.length ? `<ul class="ranking">${show.ranking.map((r) => `<li>${r.you ? '<b>' : ''}${esc(r.text)}${r.you ? '</b>' : ''}</li>`).join('')}</ul>` : ''}<p class="facts">${esc(show.race)}</p>`
      : '';
    this.dayRecapEl.innerHTML =
      `<h2>${esc(r.title)}</h2>${r.story ? `<p class="story">${esc(r.story)}</p>` : ''}${showHtml}<h3>Amy's logbook</h3>${list(r.log, r.logMore, 'Nothing written down today.')}` +
      `<h3>Bucket list</h3>${list(r.ticked, r.tickedMore, 'Nothing new ticked off.')}<p class="total">${esc(r.total)}</p>` +
      `${r.facts.length ? `<p class="facts">${esc(r.facts.join(', '))}</p>` : ''}${r.money ? `<p class="facts">${esc(r.money)}</p>` : ''}<p class="go">Press E to carry on</p>`;
    this.dayRecapEl.classList.add('shown');
    this.dayRecap.open();
    this.recapSpeech = (this.lastShow ? showSpeech(this.lastShow, this.farmParams.recapJessDelay) : [{ girl: 'amy', situation: 'dayDone', at: 0 }, { girl: 'jess', situation: 'dayDone', at: this.farmParams.recapJessDelay }]).map((x) => ({ ...x }));
    this.recapClock = 0;
  }

  /** E, Enter or a click on the card: the fade to black begins. */
  dismissRecap() {
    if (!this.dayRecap.dismiss(this.farmParams)) return;
    this.dayRecapEl.classList.remove('shown');
    this.dayFade.start();
    this.dayFadeEl.querySelector('p').textContent = `Day ${this.farm.day} done`;
  }

  updateEndOfDay(dt) {
    if (this.dayRecap.active) {
      this.dayRecap.update(dt);
      this.recapClock += dt;
      for (const x of this.recapSpeech ?? []) {
        if (x.done || this.recapClock < x.at) continue;
        x.done = true;
        this.companions.find((c) => c.character.id === x.girl)?.voice.say(x.situation, { force: true });
      }
      if (this.input.wasPressed('KeyE') || this.input.wasPressed('Enter')) this.dismissRecap();
    }
    if (!this.dayFade.active) return;
    const f = this.dayFade.update(dt, this.farmParams);
    this.dayFadeEl.style.opacity = String(f.alpha);
    this.dayFadeEl.classList.toggle('words', f.alpha >= 1);
    if (!f.done) return;
    this.saveFarm();
    try {
      sessionStorage.setItem('quadBikeFarmNextDay', '1'); // the start screen fades in from black (startScreen.js)
    } catch {
      // it just comes up without the fade
    }
    location.reload();
  }

  /** The first moment of play makes this day count (and hides Continue and New farm); after that it saves every so often. */
  updateFarmSave(dt) {
    if (this.paused) return;
    if (!this.farmStarted) {
      this.farmStarted = true;
      document.getElementById('overlay')?.classList.add('started');
      this.saveFarm();
    }
    this.farmClock = (this.farmClock ?? 0) + dt;
    if (this.farmClock < this.farmParams.saveEvery) return;
    this.farmClock = 0;
    this.saveFarm();
  }

  /** Saves the farm, once you've started playing and unless it's a seeded game. Returns whether it saved. */
  saveFarm() {
    if (this.farm.seeded || !this.farmStarted || this.farmWiped) return false;
    const ok = writeSave(this.farmStorage, this.captureFarm());
    if (ok) this.farmSavedAt = performance.now();
    return ok;
  }

  /**
   * Puts a save (as JSON, from `save copy`) in the browser for the next load, for a bug that only shows on a remembered farm. This game
   * stops saving, so it doesn't write over it. Throws if it isn't a save.
   */
  loadFarmJson(json) {
    let save;
    try {
      save = JSON.parse(json);
    } catch (e) {
      throw new Error(`that isn't JSON (${e.message})`);
    }
    if (!validSave(save)) throw new Error('that JSON is not a farm save (it needs version, day and farmSeed)');
    if (!writeSave(this.farmStorage, save)) throw new Error("the browser wouldn't store it");
    this.farmWiped = true;
    return `stored day ${save.day}: reload the page (without ?seed=) to play day ${save.day + 1}`;
  }

  /** One line about the save, for the debug panel and the console. */
  farmText() {
    const savedAgo = this.farmSavedAt === undefined ? null : (performance.now() - this.farmSavedAt) / 1000;
    return describeFarm({ day: this.farm.day, seeded: this.farm.seeded, wiped: !!this.farmWiped, started: !!this.farmStarted, savedAgo });
  }

  /** One line about the farm's date and season, for the debug panel and the console. */
  seasonText() {
    const d = this.date;
    return `${d.dom} ${d.monthName}, year ${d.year}: ${this.season} (${groundFor(this.season).label}); daylight ${this.daylight.p.sunrise}-${this.daylight.p.sunset}`;
  }

  /** The season is part of how the world is built (the trees, the wood's floor), so a different one means loading again with ?season= (the debug panel and console). */
  reloadAsSeason(season) {
    const params = new URLSearchParams(location.search);
    params.set('season', season);
    location.search = params.toString();
  }

  /** Forgets the farm: the next load deals a new one. Nothing is saved from this game after it. */
  wipeFarm() {
    wipeSave(this.farmStorage);
    this.farmWiped = true;
  }

  /** One readable block per vehicle of everything dealt out at random at the start (debug/startReport.js). */
  logStart() {
    for (const unit of this.units) {
      const h = this.history.quads[unit.id];
      const q = unit.quad;
      const worn = q.drivetrain.worn;
      console.info(
        describeVehicle({
          name: unit.name,
          where: unit.where,
          plate: unit.spec.plateNumber,
          idle: unit.idleRpm,
          top: unit.topRpm,
          redline: unit.engine.params.redlineRpm,
          roughness: unit.variation.roughness,
          litres: unit.variation.litres,
          tap: q.fuel.tap,
          hours: q.usage.hours,
          odo: q.usage.odoMiles,
          trip: q.tripMiles,
          pod: this.podRack.podOn(unit.id),
          wear: unit.engine.wear,
          faults: h?.faults ?? [],
          tinker: h?.tinker ?? null,
          lastRider: h?.lastRider ?? null,
          hasHistory: !!h,
          quirks: q.quirks.kinds,
          sump: q.sump ? { level: q.sump.level, burner: q.sump.burner } : null,
          tyres: q.tyres,
          parkBrake: q.parkBrake,
          wornGear: worn ? { gear: worn.gear, wear: worn.wear } : null,
          hand: unit.spec.tractor ? q.handSetting : null,
        }),
      );
    }
  }

  wearGearbox() {
    const manual = this.units.filter((u) => u.quad.manual);
    const pick = pickWornGearbox(manual.map((u) => ({ id: u.id, gears: u.quad.gearbox.gears })), createRandom(this.farmSeed ^ 0x6ea4));
    if (!pick) return;
    this.units.find((u) => u.id === pick.id).quad.drivetrain.wear(pick.gear, pick.wear);
  }

  /** Builds the tractor, with its own seeded idle, roughness, fuel and hours, and adds it to `units` (not `girlUnits`). */
  addTractor(spawn) {
    const spec = this.bigSpecs.tractor; // as it is this game: bought, it has its own colour and hours
    const random = createRandom(this.farmSeed ^ 0x7ac70);
    const unit = new QuadUnit({
      spec,
      spawn,
      scene: this.scene,
      physics: this.physics,
      RAPIER: this.RAPIER,
      world: this.world,
      audioHub: this.audioHub,
    });
    unit.idleRpm = applyIdle(unit.engine.params, unit.quad.params, pickIdle(spec.idleRange, random));
    unit.variation = applyVariation(spec, unit.engine.params, unit.quad.fuel, random);
    unit.topRpm = applyTopRpm(spec, unit.engine.params, createRandom(this.farmSeed ^ 0x70b6));
    unit.quad.usage.hours = pickReading(spec.hoursRange, random);
    // Its odometer isn't on the dash, but it counts from a start that goes with its hours (more hours, more miles).
    const [hoursLo, hoursHi] = spec.hoursRange;
    unit.quad.usage.odoMiles = pickRelatedReading(spec.odoRange, (unit.quad.usage.hours - hoursLo) / (hoursHi - hoursLo), random);
    unit.quad.handSetting = pickReading(spec.handStartRange, random); // the last driver left the hand throttle wherever
    this.units = [...this.units, unit];
    unit.where = spawn.where;
    return unit;
  }

  /** The barn find, if this game has one: a brown copy of a regular quad, under a tarp, with its jobs picked from the seed. Returns its unit or null. */
  addRusty() {
    const plan = pickBarnFind(createRandom(this.farmSeed ^ 0xba2f), QUAD_SPECS, this.barnFindParams);
    if (!plan) return null;
    const P = this.barnFindParams;
    const random = createRandom(this.farmSeed ^ 0xba30);
    const damage = planDamage(createRandom(this.farmSeed ^ 0xba31), plan.donor.id); // which rack bars are gone, how many patches, cracks and webs (vehicle/rustyDamage.js)
    const spec = {
      ...plan.donor,
      decay: damage,
      id: RUSTY_ID,
      label: 'rusty quad',
      name: 'Rusty quad',
      bodyColor: 0x6b4426, // brown, with the rust coming through
      hoursRange: P.hours,
      odoRange: P.odoMiles,
      wearRange: P.wear,
      owner: undefined,
      plateNumber: undefined,
    };
    const unit = new QuadUnit({ spec, spawn: this.world.layout.rusty, scene: this.scene, physics: this.physics, RAPIER: this.RAPIER, world: this.world, audioHub: this.audioHub });
    unit.idleRpm = applyIdle(unit.engine.params, unit.quad.params, pickIdle(spec.idleRange ?? [unit.engine.params.idleRpmWarm, unit.engine.params.idleRpmWarm], random));
    unit.variation = applyVariation(spec, unit.engine.params, unit.quad.fuel, random);
    unit.topRpm = applyTopRpm(spec, unit.engine.params, random);
    unit.quad.usage.hours = pickReading(P.hours, random);
    unit.quad.usage.odoMiles = pickReading(P.odoMiles, random);
    unit.engine.wear = P.wear[0] + (P.wear[1] - P.wear[0]) * random();
    unit.quad.tyres = new TyreSet(dealTyres(random, 4, this.tyreParams), this.tyreParams);
    unit.quad.tyres.useLayout(unit.quad.layout.wheels);
    unit.quad.parkBrake = true;
    unit.quad.seatFrost = 0;
    unit.where = 'at the back of the barn';
    // What's wrong with it. The engine can't catch until every job is done (startBlocked); the rest shows as it would on any quad.
    unit.barnFind = new BarnFind(plan, P);
    unit.engine.startBlocked = true;
    unit.quad.fuel.waterParams = this.fuelWaterParams;
    if (random() < P.waterChance) unit.quad.fuel.water = unit.quad.fuel.bowlWater = P.tankWater; // years of damp air have left water in the old tank
    unit.engine.battery = P.startBattery;
    if (plan.jobs.includes('tyre')) {
      unit.quad.faults.begin('puncture');
      unit.quad.faults.levels.puncture = 0.9;
      unit.quad.tyres.level(1);
    }
    if (plan.jobs.includes('fuel')) unit.engine.fouling = 0.35; // the varnish: it would only foul the plug
    if (plan.jobs.includes('carb')) {
      unit.quad.faults.begin('carb');
      unit.quad.faults.levels.carb = 0.9;
    }
    // Dust and rust, and the tarp over the lot.
    weatherModel(unit.quad.model, { rust: 0.5, dust: 0.25 }); // the metal well on its way to rust
    unit.mud.coat.look.wear = P.bodyWear; // and the wear layer turned right up: rust in every fold, the edges rubbed bare
    unit.tarp = buildTarp(unit.quad.model); // draped over this donor's own shape
    unit.quad.bodyRoot.add(unit.tarp);
    unit.rustyLook = null; // rust patches, cracks, webs, cracked tyres and (on the yellow) a mouse nest: put on after the load (dressFinds), under the tarp
    this.pendingLooks.push({ unit, damage });
    this.units = [...this.units, unit];
    return unit;
  }

  /**
   * Puts the barn finds' damage on, one at a time, once the game is ready: rust patches, cracks and webs are rays through every triangle (about 0.4 s a
   * vehicle) and the tarp hides them, so they wait until the start screen is showing instead of being part of the load.
   */
  dressFinds() {
    const next = this.pendingLooks.shift();
    if (!next) return;
    const { unit, damage } = next;
    unit.rustyLook = applyDamage(unit.quad.model, damage, unit.tarp);
    unit.rustyLook.sync(unit.barnFind, { instant: true });
    setTimeout(() => this.dressFinds(), 50);
  }

  /** The old bike (#38): the Plover, always under its tarp at the back of the barn, a restoration with its own jobs (vehicle/barnFind.js CLASSIC_JOBS). Returns its unit. */
  addPlover() {
    const P = this.barnFindParams;
    const spec = PLOVER_SPEC;
    const plan = pickClassicFind(createRandom(this.farmSeed ^ 0xba41), spec, P);
    const random = createRandom(this.farmSeed ^ 0xba42);
    const damage = planDamage(createRandom(this.farmSeed ^ 0xba43), spec.id); // patches, cracks and webs (it has no rack and no open intake for a nest)
    const unit = new QuadUnit({ spec, spawn: this.world.layout.plover, scene: this.scene, physics: this.physics, RAPIER: this.RAPIER, world: this.world, audioHub: this.audioHub });
    unit.idleRpm = applyIdle(unit.engine.params, unit.quad.params, pickIdle(spec.idleRange, random));
    unit.variation = applyVariation(spec, unit.engine.params, unit.quad.fuel, random);
    unit.topRpm = applyTopRpm(spec, unit.engine.params, random);
    unit.quad.usage.hours = pickReading(spec.hoursRange, random);
    unit.quad.usage.odoMiles = pickReading(spec.odoRange, random);
    unit.engine.wear = spec.wearRange[0] + (spec.wearRange[1] - spec.wearRange[0]) * random();
    unit.quad.parkBrake = true;
    unit.where = 'at the back of the barn';
    // What's wrong with it. The engine can't catch until every job is done (startBlocked), and the kickstart is seized until freed.
    unit.barnFind = new BarnFind(plan, P);
    unit.engine.startBlocked = true;
    unit.quad.kickLocked = unit.barnFind.kickSeized;
    unit.quad.fuel.waterParams = this.fuelWaterParams;
    if (random() < P.waterChance) unit.quad.fuel.water = unit.quad.fuel.bowlWater = P.tankWater;
    if (plan.jobs.includes('tyre')) {
      unit.quad.faults.begin('puncture');
      unit.quad.faults.levels.puncture = 0.9;
      unit.quad.tyres.level(1);
    }
    if (plan.jobs.includes('fuel')) unit.engine.fouling = 0.35; // the varnish: it would only foul the plug
    if (plan.jobs.includes('carb')) {
      unit.quad.faults.begin('carb');
      unit.quad.faults.levels.carb = 0.9;
    }
    weatherModel(unit.quad.model, { rust: 0.4, dust: 0.25 });
    unit.mud.coat.look.wear = P.bodyWear;
    unit.tarp = buildTarp(unit.quad.model);
    unit.quad.bodyRoot.add(unit.tarp);
    unit.rustyLook = null; // its rust, cracks and webs come after the load too (dressFinds)
    this.pendingLooks.push({ unit, damage });
    this.units = [...this.units, unit];
    return unit;
  }

  /** A girl near you who is free to remark says her line about the plug-saver you have just poured in (additiveLines.js). */
  saySomethingAboutAdditive() {
    const at = this.player.position;
    this.companions
      .filter((c) => c.availability().canRemark && c.root.position.distanceTo(at) < 12)
      .sort((a, b) => a.root.position.distanceTo(at) - b.root.position.distanceTo(at))[0]
      ?.voice.say('plugSaver', { force: true });
  }

  /** A can left out in the rain, not held and not under cover, collects water (the barn's roof and the lean-to keep it off). */
  updateCanWater(dt) {
    for (const can of [this.petrolCan, this.premixCan, this.dieselCan]) {
      const at = can.model.position;
      const exposed = !can.held && !can.carried && !this.world.covered?.(at.x, at.z);
      can.water = stepCanWater(can.water, dt, { rain: this.weather.rain, exposed }, this.fuelWaterParams);
    }
  }

  /** The barn finds' slow jobs: the charger going, the seized brake holding it, the seized kickstart, and the first start. */
  updateBarnFind(dt) {
    for (const unit of [this.rustyUnit, this.ploverUnit]) if (unit?.barnFind) this.updateFind(unit, dt);
  }

  /** The old bike's kick-back on you: the nearest girl within 15 m says something (oldBikeLines.js). A girl's own is hers to say (startingAttempt.js). */
  updateKickBack() {
    for (const u of this.units) {
      const q = u.quad;
      if (!q.engine.params.kickStart) continue;
      if (q.kickBack > 0 && !q.kickBackSaid) {
        q.kickBackSaid = true;
        if (q.helperPull || q.driver) continue; // she kicked it herself
        const near = this.companions.filter((c) => c.root.position.distanceTo(q.position) < 15).sort((a, b) => a.root.position.distanceTo(q.position) - b.root.position.distanceTo(q.position))[0];
        near?.voice.say('oldKick', { urgent: true });
      } else if (q.kickBack <= 0) q.kickBackSaid = false;
    }
  }

  updateFind(unit, dt) {
    const find = unit.barnFind;
    const e = unit.engine;
    unit.rustyLook?.sync(find); // the tarp slides off when it is taken off, the tyres and the nest follow their jobs
    unit.rustyLook?.step(dt);
    if (find.brakeSeized) unit.quad.parkBrake = true;
    unit.quad.kickLocked = find.kickSeized;
    if (!e.params.noStarter && find.setBattery(e.battery, !e.batteryOut)) this.notebook.note(unit, { kind: 'job', job: 'battery' }, { by: 'you' });
    e.startBlocked = find.startBlocked || !!unit.engineOut; // (its engine is out on the floor, once pulled)
    // Cranking it before it's ready: it tells you why.
    const cranking = e.state === 'cranking';
    if (cranking && !unit.findWasCranking && find.startBlocked && find.tarpOff) this.hud.toast(find.blockedReason(), 3.2);
    else if (cranking && !unit.findWasCranking && unit.engineOut) this.hud.toast('There is no engine in it', 3.2);
    unit.findWasCranking = cranking;
    // The first start: smoke everywhere, and both girls cheer.
    if (e.isRunning && find.ready && !find.started) {
      find.started = true;
      startRunningIn(e); // not run for years, and now it wants running in
      find.smokeLeft = find.params.smokeSeconds;
      this.hud.toast(unit.id === 'plover' ? 'It runs! The old bike fires up for the first time in years' : 'It runs! The first start in years');
      this.achievements.note(unit.id === 'plover' ? 'oldBike' : 'barnFind');
      for (const c of this.companions) c.voice.onBench('runs');
    }
    if (find.smokeLeft > 0) {
      find.smokeLeft -= dt;
      unit.smoke.burst = 1;
    }
  }

  // Mirrors ----------------------------------------------------------------

  /**
   * The mirrors of the vehicle you drive show the world behind it (vehicle/mirrorView.js): one mirror is drawn per turn, every few frames,
   * and only while you look ahead; every other vehicle keeps its dull glass. The vehicle itself and anyone sat in it are left out of the picture.
   */
  updateMirrors() {
    const unit = this.riddenUnit;
    const p = this.mirrorParams;
    for (const [u, v] of this.mirrorViews) if (v.live && (u !== unit || !p.enabled)) v.setLive(false);
    if (!unit || !p.enabled) return;
    let view = this.mirrorViews.get(unit);
    if (!view) {
      view = new MirrorView(unit.quad.model, p);
      this.mirrorViews.set(unit, view);
    }
    if (!view.count) return;
    if (!view.live) view.setLive(true);
    const model = unit.quad.model;
    const ahead = new THREE.Vector3(0, 0, 1).applyQuaternion(model.getWorldQuaternion(new THREE.Quaternion()));
    if (!lookingForward(this.camera.getWorldDirection(new THREE.Vector3()), ahead, p.lookAngle)) return;
    const turn = mirrorTurn(this.mirrorFrame++, p.every, view.count);
    if (turn === null) return;
    const hidden = [model];
    for (const c of this.companions) {
      if (insideFootprint(model.worldToLocal(c.root.getWorldPosition(new THREE.Vector3())), { x: 1.3, z: 2.6 })) hidden.push(c.root);
    }
    view.render(this.renderer, this.scene, turn, hidden);
  }

  // Which quad -------------------------------------------------------------

  /** The quad the player is riding, if any. */
  /** The quad you're at the controls of, if any. */
  get riddenUnit() {
    return this.player.isRiding && this.player.seat === 'rider' ? this.player.vehicle.unit : null;
  }

  /** The quad you're on, front or back. */
  get boardUnit() {
    return this.player.isRiding ? this.player.vehicle.unit : null;
  }

  /**
   * Tells the girls something happened that might catch their eye: `kind` (a NOTICE_KINDS key, attention.js), where (`at`, any
   * { x, y, z }), and optionally `key` (what made it, so a repeat refreshes rather than piles up) and `strength` (1 usual). This is the
   * one way anything in the world gets their attention; see .claude/rules/girls-minds.md.
   */
  notice(kind, at, { key = '', strength = 1 } = {}) {
    for (const c of this.companions) c.notice({ kind, key, x: at.x, y: at.y, z: at.z, strength });
  }

  /**
   * The girls' minds (npc/needs.js, npc/chooser.js): each girl's needs move with what she's doing and where she is, and every couple of
   * seconds while she's free she weighs what she could do against them and takes the best. With autonomy off nothing new starts. A
   * girl only doing something idle (sat resting, warming her hands) weighs only the urgent things, like shelter from the rain.
   */
  updateMinds(dt, ridden) {
    for (const c of this.companions) {
      const ctx = this.needsContext(c);
      c.needs.update(dt, ctx, c.params);
      this.favour.setWant(c.character.id, c.needs.attention); // her jealousy is what 'neglected' is made of (favour.js)
      const swing = c.mood.update(dt, c.needs, ctx, c.params);
      if (swing && c.availability().canRemark) c.voice.say(swing === 'low' ? 'moodLow' : 'moodHigh', { chance: 1 });
      c.wetNow = ctx.wet;
      // What the day is doing, for the ways she waits about (npc/waiting.js): the cold, the sun, a shower coming on.
      const w = this.weather;
      c.waitWeather = { chill: ctx.chill, wet: ctx.wet, sun: Math.min(1, w.def.sky.sunIntensity / 2.6) * (1 - w.rain) * w.sunUp, clouding: Math.max(0, w.target - w.rain) };
      c.intent.update(dt, `${c.fsm.name}:${c.fsm.data?.goal ?? ''}`);
      c.memory.update(dt, c.params);
      // What she has in mind for the day, said early on once she's stood about with nothing holding her (npc/agenda.js).
      if (c.agenda.due(dt) && c.availability().canRemark) {
        c.agenda.mention();
        c.voice.say(agendaKey(c.agenda.id), { chance: 1 });
      }
      const m = c.mind;
      m.since += dt;
      if ((m.thinkIn -= dt) > 0) continue;
      m.thinkIn = nextThink(c.params.thinkEvery, c.params.sleepySlowThink * c.needs.sleep); // sleepy, she thinks slowly
      if (!c.params.ownMind) {
        m.waiting = 'her own mind is off';
        continue;
      }
      const a = c.availability();
      // Sat about on a quad of her own choosing she can choose to get off; doing something idle, only something urgent takes her.
      const sitting = !a.free && (c.sittingAbout() || this.lessonGirls(ridden).includes(c.character.id));
      const urgentOnly = !a.free && !sitting && c.interruptible();
      if (!a.free && !urgentOnly && !sitting) {
        m.waiting = a.why;
        continue;
      }
      m.waiting = null;
      // Something you stopped her doing is still on her mind, so she's keener on it for a while (npc/intent.js).
      // Sleepy, she can't be bothered with anything but a doze (companionParams: sleepyLazy).
      const lazy = 1 - c.params.sleepyLazy * c.needs.sleep;
      let offers = this.offersFor(c, ridden).map((o) => ({ ...o, weight: o.weight * c.intent.boost(o.key, c.params) * c.memory.weight(o.key) * c.agenda.boost(o.key, c.params) * showOffBoost(o.key, this.trafficHost.kidsWatching, this.trafficHost.kidsParams) * (o.key === 'doze' || OFFER_KINDS[o.key]?.urgent ? 1 : lazy * c.mood.keen(c.params)) }));
      if (sitting) offers = offers.filter((o) => OFFER_KINDS[o.key]?.fromSeat);
      else if (urgentOnly) offers = offers.filter((o) => OFFER_KINDS[o.key]?.urgent);
      // Free again with a plan to carry on (npc/plans.js): the second part, if it's still on offer, is taken without weighing.
      const planned = a.free ? c.intent.nextStep(offers) : null;
      const { pick: chosen, scored } = choose(c.needs, offers, c.params);
      const pick = planned ?? chosen;
      // What she weighed and didn't take, for the debug panel's "nearly chose".
      m.scored = scored.filter((s) => s.offer !== pick).slice(0, 4).map((s) => ({ key: s.offer.key, score: s.score }));
      if (!pick) continue;
      const need = mainNeed(pick, c.needs);
      this.trafficHost.girlChose(c, pick.key);
      // Wanting company, she may ask you along first and wait for your answer (npc/askAlong.js).
      if (this.askBeforeGoing(c, pick, planned)) {
        m.last = { key: pick.key, need, score: scored[0].score, asking: true };
        m.since = 0;
        continue;
      }
      pick.take();
      c.needs.met(OFFER_KINDS[pick.key].satisfies);
      c.chose();
      // She walks to it at its pace, and on her way she can be stopped (npc/intent.js).
      c.pace = OFFER_KINDS[pick.key].pace ?? null;
      if (c.intent.chose(pick.key, `${c.fsm.name}:${c.fsm.data?.goal ?? ''}`)) c.voice.say('resumed', { urgent: true, chance: 0.8 });
      else {
        // Something that went badly or well before: she says so now and then (npc/memory.js).
        const feeling = c.memory.attitude(pick.key, c.params);
        if (feeling) c.voice.say(feeling < 0 ? 'memoryWary' : 'memoryKeen', { urgent: true, chance: c.params.memoryLineChance });
      }
      m.last = { key: pick.key, need, score: scored[0].score };
      m.since = 0;
    }
  }

  /** She's chosen `pick`; if it's something to ask you along to, she asks and waits instead (returns true). */
  askBeforeGoing(c, pick, planned) {
    const id = c.character.id;
    if (planned || !ALONG_KINDS[pick.key] || (pick.key === 'race' && !pick.youRiding)) return false;
    const ask = this.askAlong;
    const ctx = {
      distance: c.root.position.distanceTo(this.player.position),
      youFree: !this.menu.isOpen && !this.hiding.active && !this.climb && !this.tryst && !this.recalling,
      company: c.needs.company,
      askChance: c.params.askChance,
      fallenOut: this.fallingOut.active,
    };
    if (!ask.shouldAsk(id, pick.key, ctx)) return false;
    this.askGo[id] = { key: pick.key, together: pick.take, alone: pick.takeAlone ?? pick.take, satisfies: OFFER_KINDS[pick.key].satisfies, pace: OFFER_KINDS[pick.key].pace ?? null };
    this.handleAskEvent(ask.ask(id, pick.key));
    return true;
  }

  /** She asks: she says so, stands waiting for you, and her wheel offers the answer. */
  handleAskEvent(e) {
    const c = this.companions.find((o) => o.character.id === e.girl);
    c.voice.say(ALONG_KINDS[e.key].line, { force: true });
    c.hold('askAlong', 'asking you along');
    const p = this.player.position;
    c.attend({ x: p.x, y: p.y, z: p.z }, { weight: 3, seconds: this.askAlong.p.lapseAfter });
    this.hud.toast(`${c.name} is asking you along: talk to her`, 3);
  }

  /** You said yes or not now (or it lapsed): she goes with you, shrugs and goes alone, or sulks and goes later (askAlong.js). */
  answerAsk(c, yes) {
    const id = c.character.id;
    const r = this.askAlong.answer(id, yes, { goesAnyway: c.params.askGoesAnyway, standing: this.favour.standing(id) });
    c.release('askAlong');
    if (!r) return;
    const go = this.askGo[id];
    if (r.favour) this.favour.add(id, r.favour);
    if (r.type === 'yes') {
      c.voice.say('askYes', { force: true });
      this.startAsked(c, go, go.together);
    } else if (r.type === 'anyway') {
      c.voice.say('askAnyway', { force: true });
      this.startAsked(c, go, go.alone);
    } else {
      c.voice.say('askSulk', { force: true });
      this.favour.sulk(id, r.mood);
      if (c.fsm.is('seated', 'mounting')) c.requestStandBeside();
    }
    if (r.type !== 'sulk') delete this.askGo[id];
  }

  /** Carries out what she asked about, as the chooser would have, if she's still free to. */
  startAsked(c, go, run) {
    if (!go || !c.availability().free) return;
    run();
    c.needs.met(go.satisfies);
    c.chose();
    c.pace = go.pace;
  }

  /** The asks running out, and a girl who sulked going alone after all. */
  updateAskAlong(dt) {
    for (const e of this.askAlong.update(dt)) {
      const c = this.companions.find((o) => o.character.id === e.girl);
      if (e.type === 'lapsed') this.answerAsk(c, false);
      else if (e.type === 'later') {
        const go = this.askGo[e.girl];
        delete this.askGo[e.girl];
        if (go && c.availability().free) {
          c.voice.say('askLater', { force: true });
          this.startAsked(c, go, go.alone);
        }
      }
    }
    // Someone gave her something else to do while she was waiting for your answer.
    for (const c of this.companions) {
      const id = c.character.id;
      if (this.askAlong.pendingFor(id) && !c.fsm.is('idle')) {
        this.askAlong.cancel(id);
        c.release('askAlong');
        delete this.askGo[id];
      }
    }
  }

  /** For the debug panel and console: whether she has asked you along, and to what. */
  askAlongState(id) {
    const ask = this.askAlong.pendingFor(id);
    if (ask) return `asking you: ${ALONG_KINDS[ask.key].yes.toLowerCase()} (${Math.max(0, Math.round(ask.until - this.askAlong.clock))} s left)`;
    const later = this.askAlong.later.find((l) => l.girl === id);
    if (later) return `sulking, goes alone in ${Math.max(0, Math.round(later.at - this.askAlong.clock))} s`;
    return 'no';
  }

  /** Her wheel options while she's asked you along: yes, or not now. */
  askAlongWheelOptions(c) {
    const ask = this.askAlong.pendingFor(c.character.id);
    if (!ask) return [];
    return [
      { label: ALONG_KINDS[ask.key].yes, run: () => this.answerAsk(c, true) },
      { label: 'Not now', run: () => this.answerAsk(c, false) },
    ];
  }

  /** Everything this girl could choose to do now (npc/chooser.js): her boredom choices and what the moved features offer her. */
  offersFor(c, ridden) {
    const id = c.character.id;
    const mine = (list, act) => list.filter((o) => o.girl === id).map((o) => ({ ...o, take: () => act(o) }));
    const cabs = this.cabShelterContext();
    return [
      ...c.boredOffers(c.viewer),
      ...mine(this.warming.offers(this.warmingContext()), (o) => this.handleWarmingEvent(this.warming.take(o))),
      ...mine(this.cabShelter.offers(cabs), (o) => {
        const e = this.cabShelter.take(o, cabs);
        if (e) this.handleCabEvent(e);
      }),
      ...mine(this.places.offers(this.placesContext()), (o) => this.handlePlaceAction(this.places.take(o))),
      ...mine(this.dares.offers(this.daresContext()), (o) => this.handleDare(this.dares.take(o))),
      ...mine(this.phoneCalls.offers(this.phoneContext()), (o) => this.handlePhoneCall(this.phoneCalls.take(o))),
      ...mine(this.girlBench.offers(this.girlBenchContext()), (o) => this.handleGirlBench(this.girlBench.take(o))),
      ...mine(this.trailerGuide.offers(this.trailerGuideContext(ridden)), (o) => this.handleTrailerGuide(this.trailerGuide.take(o))),
      ...mine(this.workLight.offers(this.workLightContext(c)), (o) => {
        c.voice.say('workLightOffer', { urgent: true, force: true });
        this.handleWorkLight(this.workLight.take(o));
      }),
      ...mine(this.hayLoading?.offers(this.hayLoadContext()) ?? [], (o) => {
        this.companions.find((g) => g.character.id === o.girl).voice.say('hayGo', { urgent: true, force: true });
        this.handleHayLoad(this.hayLoading.take(o));
      }),
      ...mine(this.generatorStart.offers(this.generatorStartContext()), (o) => {
        this.companions.find((g) => g.character.id === o.girl).voice.say('generatorGo', { urgent: true, force: true });
        this.handleGeneratorStart(this.generatorStart.take(o));
      }),
      ...mine(this.tea.offers(this.teaContext(ridden)), (o) => this.handleTeaEvent(this.tea.take(o))),
      ...mine(this.flask.offers(this.flaskContext(ridden)), (o) => this.handleFlaskEvent(this.flask.take(o))),
      ...mine(this.hutHost.offers(), (o) => this.hutHost.take(o)),
      ...mine(this.fireSit.offers(this.fireSitContext()), (o) => this.handleFireEvent(this.fireSit.take(o, this.fireSit.seatsLeft(this.fireSpots.length)))),
      ...(this.hiding.active ? [] : mine(this.requests.offers(this.requestContext(ridden)), (o) => this.handleRequestEvent(this.requests.take(o)))),
      ...mine(this.jumpers.offers(this.jumpersContext()), (o) => this.handleJumperEvent(this.jumpers.take(o))),
      ...mine(this.coats.offers(this.jumpersContext()), (o) => this.handleCoatEvent(this.coats.take(o))),
      ...mine(this.headgear.offers(this.headgearContext()), (o) => this.handleHeadgearEvent(this.headgear.take(o))),
      ...mine(this.dieselMistake.offers(this.dieselContext(ridden)), (o) => this.handleDieselEvent(this.dieselMistake.take(o))),
      ...mine(this.pranks.offers(this.prankContext(ridden)), (o) => this.handlePrankEvent(this.pranks.take(o))),
      ...this.conkerOffers(c, ridden),
      ...this.rockPrankOffers(c),
      ...mine(this.headStart.offers(this.headStartContext()), (o) => this.handleHeadStartEvent(this.headStart.take(o))),
      ...mine(this.practising.offers(this.practiseContext()), (o) => this.handlePractiseGo(this.practising.take(o))),
      ...mine(this.nicking.offers(this.nickContext(ridden)), (o) => this.handleNickEvent(this.nicking.take(o))),
      ...(GO_KINDS.some((k) => this.goVehicle(k)) ? mine(this.tractorGo.offers(this.tractorGoContext(ridden)), (o) => this.handleGoEvent(this.tractorGo.take(o))) : []),
      ...mine(this.carGo.offers(this.carGoContext(ridden)), (o) => this.handleCarGoEvent(this.carGo.take(o))),
      ...this.lPlateOffers(id),
      ...this.togetherOffers(c, ridden),
      ...(this.tryst ? [] : mine(this.romance.offers(this.romanceContext()), (o) => {
        const e = this.romance.take(o);
        if (e) this.handleRomanceEvent(e);
      })),
      ...this.lessonOffers(id, ridden),
      ...c.seatOffers(),
    ];
  }

  /** The L plates, as offers for this girl (npc/lPlates.js). */
  lPlateOffers(id) {
    const ctx = this.lPlatesContext();
    if (!ctx) return [];
    return this.lPlates.offers(ctx).filter((o) => o.girl === id).map((o) => ({ ...o, take: () => this.handleLPlateEvent(this.lPlates.take(o)) }));
  }

  /** The things the two of them do together, as offers for this girl: a ride together, a race, Jess's drag dare, comparing notes. */
  togetherOffers(c, ridden) {
    if (this.recalling) return [];
    const id = c.character.id;
    const mine = (list, act) => list.filter((o) => o.girl === id).map((o) => ({ ...o, take: () => act(o) }));
    const compare = this.comparingContext();
    return [
      ...mine(this.makeUp.offers(this.makeUpContext()), (o) => this.handleMakeUp(this.makeUp.take(o))),
      ...mine(this.convoy.offers(this.convoyContext(ridden)), (o) => this.handleConvoyEvent(this.convoy.take(o))),
      ...(this.drag.active || this.hillClimb.active || this.coneCourse.active
        ? []
        : mine(this.race.offers(this.raceContext(ridden)), (o) => this.handleRaceEvent(this.race.take(o))).map((o) => ({
            ...o,
            takeAlone: () => this.handleRaceEvent(this.race.take({ ...o, youRiding: null })), // she goes without you after a not now
          }))),
      ...(this.race.active || this.hillClimb.active || this.coneCourse.active ? [] : mine(this.drag.offers(this.dragContext(ridden)), (o) => this.dragApproach(this.drag.take(o), ridden))),
      ...mine(this.hillClimb.offers(this.climbContext(ridden)), (o) => this.startHillClimb(this.hillClimb.take(o))),
      ...mine(this.coneCourse.offers(this.climbContext(ridden, 'cones')), (o) => this.startConeCourse(this.coneCourse.take(o))),
      ...mine(this.comparing.offers(compare), (o) => this.runComparing(this.comparing.take(o, compare))),
      ...mine(this.pair.offers(this.pairContext()), (o) => this.handlePairEvent(this.pair.take(o))),
    ];
  }

  /** What the two as a pair needs to know (npc/pair.js): where each girl is, whether she's free, settled or setting off somewhere. */
  pairContext() {
    return {
      fallenOut: this.fallingOut.active,
      girls: this.companions.map((c) => {
        const a = c.availability();
        const leaving = c.fsm.is('walking') ? (c.intent.current?.key ?? null) : null;
        const r = c.root.position;
        return { id: c.character.id, x: r.x, z: r.z, heading: c.heading, free: a.free, settled: a.canRemark && c.fsm.is('idle'), leaving, pairWeight: c.params.pairWeight, tagWeight: c.params.tagWeight };
      }),
    };
  }

  /** One girl goes over to stand with the other, or tags along after her (npc/pair.js; the chooser's pick, or the debug panel's). */
  handlePairEvent(e) {
    const c = this.companions.find((o) => o.character.id === e.girl);
    const friend = this.companions.find((o) => o.character.id === e.friend);
    if (!c || !friend) return;
    if (e.type === 'pairUp') {
      c.standWith(friend, this.pair.p);
      c.voice.say('pairGo', { chance: 0.4 });
    } else {
      c.tagAlong(friend, e.side, this.pair.p);
      c.voice.say('tagGo', { chance: 0.6 });
    }
  }

  /** Whether this girl is with her friend, for the debug panel and the console. */
  pairState(id) {
    const c = this.companions.find((o) => o.character.id === id);
    if (c?.fsm.is('walking') && c.fsm.data?.goal === 'follow') return `tagging along after ${c.fsm.data.friend.name}`;
    if (c?.pairFacing != null) return `stood with ${c.others()[0]?.name ?? 'her friend'}`;
    return 'no';
  }

  /**
   * The two stood together (npc/pair.js): each faces the other, and opens up to you when you come over. Fallen out, or with either
   * busy, neither is turned.
   */
  updatePair(dt) {
    this.pair.update(dt);
    const [a, b] = this.companions;
    const eye = this.camera.position;
    const you = this.player.isRiding ? null : { x: eye.x, z: eye.z };
    const standing = (c) => c.freeToTurn() && c.availability().free;
    const paired = a && b && !this.fallingOut.active && standing(a) && standing(b) && this.pair.together(a.root.position, b.root.position);
    for (const [c, f] of [[a, b], [b, a]]) {
      if (!c) continue;
      c.pairFacing = paired ? pairFacing(c.root.position, f.root.position, you, this.pair.p) : null;
    }
  }

  /** What moves a girl's needs this frame (npc/needs.js): the cold where she is, who's near, how fast she's going, what she's at. */
  needsContext(c) {
    const p = c.params;
    const at = c.root.getWorldPosition(this.needsAt ??= new THREE.Vector3());
    const inBarn = this.world.inBarn(at.x, at.z);
    const inCab = this.cabShelter.of(c.character.id)?.state === 'in';
    const inHut = this.hutHost.inside(at.x, at.z);
    const covered = inBarn || inCab || inHut;
    c.coveredNow = covered; // in the barn, the hut or a cab, for what she says about the dark (companionVoice.watchWeather)
    const w = this.weather;
    // A dull or wet day feels cold (as warming hands always had it), and a cold one colder.
    const dayChill = Math.min(1, Math.max(0, (0.6 - w.warmth) / 0.6) * 0.8 + w.chill * 0.5);
    const onBoard = c.root.parent !== this.scene;
    const ridingWith = onBoard && (this.riddenUnit?.quad === c.quad || c.others().some((o) => o.quad === c.quad && o.root.parent !== this.scene));
    const youAway = Math.hypot(this.camera.position.x - at.x, this.camera.position.z - at.z);
    let near = youAway;
    let friendAway = Infinity;
    let friendFromYou = Infinity;
    for (const o of c.others()) {
      const op = o.root.getWorldPosition(this.needsOther ??= new THREE.Vector3());
      friendAway = Math.min(friendAway, op.distanceTo(at));
      friendFromYou = Math.min(friendFromYou, Math.hypot(this.camera.position.x - op.x, this.camera.position.z - op.z));
    }
    near = Math.min(near, friendAway);
    // Jealousy (the attention need): you're with her if you're close or she's on your quad; she's with her friend if one is close.
    const youNear = youAway < p.needAttentionRange || (onBoard && this.riddenUnit?.quad === c.quad);
    const speed = onBoard && c.quad ? Math.abs(c.quad.speed) : 0;
    return {
      chill: covered ? 0 : dayChill,
      wet: !covered && w.rain > 0.25 && !this.coats.worn[c.character.id], // a wax jacket keeps the rain off
      warmed: !!c.warmingAt || inCab || inBarn || this.hutHost.warmsAt(at.x, at.z) || this.bonfire.warms(Math.hypot(at.x - this.world.layout.bonfire.x, at.z - this.world.layout.bonfire.z)),
      alone: near > p.needLonelyRange && !ridingWith,
      together: near < p.needCloseRange || ridingWith,
      thrill: Math.min(1, speed / 12 + (onBoard && c.quad?.airborne ? 0.5 : 0)),
      active: c.fsm.is('walking', 'driving', 'mounting', 'dismounting', 'starting', 'cranking', 'pushing', 'pranking', 'boarding', 'shuffling'),
      sitting: c.fsm.is('resting', 'seated', 'onTrailer'),
      dozing: c.isDozing,
      idle: c.availability().free || c.sittingAbout(), // sat about on a quad she chose is as good as stood about
      purposeRate: c.purposeRate ?? 0,
      youNear,
      withFriend: friendAway < p.needCloseRange,
      youWithFriend: friendFromYou < p.needAttentionRange,
    };
  }

  /** What the girls can see and hear this frame (attention.js): the people and moving vehicles about, and what the vehicles just did. */
  watchNotices(dt) {
    this.noticeWatch ??= new NoticeWatch(DEFAULT_NOTICE_PARAMS);
    const vehicles = this.units.map((u) => {
      const q = u.quad;
      const p = q.position;
      return { id: u.id, x: p.x, y: p.y + 0.8, z: p.z, events: u.engine.events.map((e) => e.type), rpm: u.engine.rpm, running: u.engine.isRunning, throttle: u.engine.throttle, idleRpm: u.engine.params.idleRpmWarm, maxRpm: u.engine.params.maxRpm, speed: Math.abs(q.forwardSpeed), horn: !!q.hornHeld, tipped: !!q.isTipped, airborne: !!q.airborne };
    });
    for (const n of this.noticeWatch.update(dt, vehicles)) this.notice(n.kind, n, { key: n.key, strength: n.strength });
    const eye = this.camera.position;
    this.attentionHeads ??= new Map();
    const girls = this.companions.map((c) => {
      const head = this.attentionHeads.get(c) ?? this.attentionHeads.set(c, new THREE.Vector3()).get(c);
      c.root.getWorldPosition(head);
      const ch = c.voice.chatter;
      return { key: c.character.id, x: head.x, y: head.y + c.params.height * 0.93, z: head.z, speaking: ch.speakingUntil > ch.time };
    });
    this.attentionWorld = {
      people: [{ key: 'you', x: eye.x, y: eye.y, z: eye.z }, ...girls],
      vehicles: vehicles.filter((v) => v.speed > 0.5).map((v) => ({ key: v.id, x: v.x, y: v.y, z: v.z, speed: v.speed })),
      engines: vehicles.filter((v) => v.running).map((v) => ({ x: v.x, z: v.z })), // what drowns out the rest, for her hearing
      rain: this.weather.rain,
    };
  }

  /** The first companion (for the debug console and test scripts). */
  get companion() {
    return this.companions[0];
  }

  get voice() {
    return this.companions[0].voice;
  }

  /** The companion on the front seat of this quad (driving it, or about to), if any. */
  herAtTheFront(quad) {
    return this.companions.find((c) => c.quad === quad && (c.fsm.is('driving') || (c.fsm.is('shuffling') && c.fsm.data?.to === 'rider'))) ?? null;
  }

  /** The companion on the back of this quad (or getting on or off it there), if any. */
  herOnBack(quad) {
    return this.companions.find((c) => c.quad === quad && c.claimedSeat === 'pillion' && c.fsm.is('mounting', 'seated', 'dismounting')) ?? null;
  }

  /** The companion on this quad in any seat (or getting on or off it), if any. */
  herOn(quad) {
    return this.companions.find((c) => c.quad === quad && c.fsm.is('mounting', 'seated', 'dismounting', 'driving', 'shuffling')) ?? null;
  }

  /** You could sit on the back of this quad: it's parked, upright and nobody's on it. */
  canSitOnBack(quad) {
    return (quad.hasPillion || (quad.hasBench && !!this.benchSeatFor(quad, this.lookingAtBack(quad)))) && !quad.driver && !quad.isTipped && !quad.passenger && !quad.rider && !this.herOn(quad) && quad.speed < 0.5 && !this.handsFull;
  }

  /**
   * Where the winch hook, the tow chain and the tow rope are kept, each a small box to look at: E takes it, G puts it back
   * (the hook worked from the seat stays X, a vehicle control). The rope is on every red and blue quad's rack.
   */
  setUpKitSpots() {
    const spot = (parent, at, size, item) => {
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ visible: false }));
      proxy.position.set(...at);
      parent.add(proxy);
      this.interaction.add({ target: proxy, priority: 1, ...item });
    };
    const w = this.winch;
    if (w) {
      const model = w.unit.quad.model;
      model.updateMatrixWorld(true);
      spot(model, model.worldToLocal((w.hookMesh ?? w.fairlead).getWorldPosition(new THREE.Vector3())).toArray(), [0.5, 0.4, 0.4], {
        isAvailable: () => w.state === 'stowed' && !this.handsFull && !this.player.isRiding,
        prompt: () => 'Take the winch hook',
        feedback: 'pickUp',
        interact: () => w.take(this.camera),
      });
    }
    const c = this.chain;
    if (c) {
      spot(this.tractorUnit.quad.model, [0, TRACTOR_GROUND_OFFSET + 0.52, -1.5], [0.6, 0.4, 0.5], {
        isAvailable: () => c.state === 'stowed' && !this.handsFull && !this.player.isRiding,
        prompt: () => (this.trailer.hitched ? { info: 'The trailer is on the drawbar: unhitch it before taking the chain' } : 'Take the tow chain'),
        feedback: 'pickUp',
        interact: () => {
          if (!this.trailer.hitched) c.take(this.camera);
        },
      });
    }
    const r = this.towRope;
    for (const unit of this.units.filter((u) => this.ropeQuadFor(u))) {
      const quad = unit.quad;
      const p = r.params;
      spot(quad.model, [0, p.hitchHeight, -p.hitchBack], [0.4, 0.3, 0.3], {
        isAvailable: () => r.state === 'stowed' && !this.handsFull && !this.player.isRiding,
        prompt: () => (this.tipTrailer.hitched && this.tipTrailer.puller === quad ? { info: `The trailer is on the ${unit.label}'s hitch: unhitch it before taking the rope` } : 'Take the tow rope'),
        feedback: 'pickUp',
        interact: () => {
          if (!(this.tipTrailer.hitched && this.tipTrailer.puller === quad)) r.take(this.camera, quad);
        },
      });
    }
  }

  /** Whether you are looking at the passenger's or the back seat rather than the driver's: E there sits you in it (interaction/seatLook.js). */
  lookingAtPassengerSeat(quad) {
    const at = this.interaction.focusPoint;
    if (!at || this.interaction.focused?.unit?.quad !== quad) return false;
    if (this.lookingAtBack(quad)) return true;
    const spot = (anchor) => {
      if (!anchor) return null;
      const l = quad.model.worldToLocal(anchor.getWorldPosition(new THREE.Vector3()));
      return { x: l.x, z: l.z };
    };
    const look = quad.model.worldToLocal(at.clone());
    return nearerPassenger({ x: look.x, z: look.z }, spot(quad.cameraAnchor), spot(quad.hasBench ? quad.benchCameras.left : quad.pillionCameraAnchor));
  }

  /** On the back of a parked quad with nobody driving; sooner or later a girl comes and takes you for a ride. */
  sitOnBack(unit) {
    if (unit.quad.hasBench) this.mountBench(unit);
    else this.mountPillion(unit);
  }

  /** Looking at the back half of a car with a back bench (the 200TDi), so E is for the back seats rather than the front. */
  lookingAtBack(quad) {
    const at = this.interaction.focusPoint;
    if (!quad.rearSeats?.length || !at || this.interaction.focused?.unit?.quad !== quad) return false;
    return quad.model.worldToLocal(at.clone()).z < this.rearAccess.backHalfZ;
  }

  /**
   * Sat on the back of a parked quad with nobody at the front: after a while a
   * free girl comes over and takes you for a ride (and gets off when she's bored,
   * unasked). Afterwards nobody offers again for a good while.
   */
  updateRideOffer(dt) {
    if (!this.companions.length) return;
    this.rideOffer ??= new RideOffer(this.companions[0].params);
    const offer = this.rideOffer;
    if (this.offeredBy) {
      // Wait for the ride to be over (she's off, or given up) before the rest period starts.
      if (this.offeredBy.fsm.is('walking', 'mounting', 'driving', 'shuffling')) return;
      offer.rest(this.offeredBy.params);
      this.offeredBy = null;
    }
    if (this.hiding.active) return; // they can't find you to offer
    const unit = this.boardUnit;
    const waiting = !!unit && this.player.seat === 'pillion' && !unit.quad.hasBench && unit.quad.speed < 0.5 && !this.menu.isOpen && !this.passengerPlan && !this.herOn(unit.quad);
    if (!offer.update(dt, waiting)) return;
    const girls = this.companions
      .filter((c) => c.canOfferRide(unit.quad))
      .map((c) => ({ c, distance: c.root.position.distanceTo(unit.quad.position), favour: this.favour.offerWeight(c.character.id) }));
    const pick = pickOfferer(girls);
    if (!pick) return offer.rest(); // nobody free: try again later
    pick.c.offerRide(unit.quad);
    this.offeredBy = pick.c;
  }

  /** On the back while she drives. */
  mountPillion(unit) {
    if (this.player.isRiding) return;
    this.player.mount(unit.quad, 'pillion');
    this.favourQuad(unit, this.favour.p.favouriteQuad);
    unit.quad.passenger = this.player;
    this.lastUnit = unit;
    this.input.takeWheelSteps();
    this.herAtTheFront(unit.quad)?.voice.onRequest('passengerOn');
  }

  /** The UTV's or Land Rover's seats as somewhere to ride (vehicle/utvMount.js), or null for anything else. */
  benchMountOf(quad) {
    if (quad === this.utvUnit?.quad) return this.utvMount;
    return Object.values(this.landys).find((l) => l.unit?.quad === quad)?.mount ?? null;
  }

  /**
   * The bench seat you would take, or null if it's full. Girls aboard or on their way count as taking one. `back`: one on the 200TDi's
   * back bench instead, nearest the door on your side (the driver's door only with nobody at the wheel).
   */
  benchSeatFor(quad, back = false) {
    const mount = this.benchMountOf(quad);
    if (!mount) return null;
    if (back) {
      const driverSide = quad.model.worldToLocal(this.player.position.clone()).x < 0 && !quad.driver && !quad.rider;
      return pickRearSeat(mount.rearSlots.filter((s) => s.girl).map((s) => s.name), driverSide, mount.rearSlots.map((s) => s.name));
    }
    return pickBenchSeat(BENCH_SEATS.filter((s) => !mount.slots[s] || mount.slots[s].girl)); // a seat a car hasn't got (the middle) counts as taken
  }

  /** You could get in beside the girl driving the UTV or Land Rover: she's at the wheel, the seat is free and you're not in the middle of something. */
  canRideBench(quad) {
    return quad.hasBench && !!this.herAtTheFront(quad) && !quad.passenger && !quad.rider && !quad.isTipped && !this.handsFull && !!this.benchSeatFor(quad, this.lookingAtBack(quad));
  }

  /** In the UTV's or Land Rover's other seat while she drives (the quads' pillion, on a bench). */
  mountBench(unit) {
    if (this.player.isRiding) return;
    const back = this.lookingAtBack(unit.quad);
    const seat = this.benchSeatFor(unit.quad, back);
    if (!seat) return;
    this.player.mount(unit.quad, 'pillion', seat);
    this.benchMountOf(unit.quad).slots[seat].girl = YOU_ABOARD;
    if (back) unit.quad.tipHold[rearDoor(seat, !!(unit.quad.driver || unit.quad.rider))] = this.rearAccess.holdSeconds; // the front seat tips as you climb past
    unit.quad.passenger = this.player;
    this.lastUnit = unit;
    this.input.takeWheelSteps();
    this.herAtTheFront(unit.quad)?.voice.onRequest('passengerOn');
  }

  /** How muddy and dusty each girl is: what her quad throws at her, the stubble dust, drying, brushing off and the hose; and her remark when she sees it. */
  updateMuddiness(dt) {
    const p = this.muddyParams;
    for (const c of this.companions) {
      const unit = c.quad && (c.isSeated || c.fsm.is('driving')) ? this.units.find((u) => u.quad === c.quad) : null;
      const mud = unit?.mud?.state;
      const ride = mud
        ? {
            pillion: c.fsm.is('seated') && c.seatKind === 'pillion',
            wheels: mud.wheels,
            body: mud.body,
            speed: unit.quad.speed,
            puddle: Math.max(0, ...unit.quad.physics.wheelInfo.map((w) => w.puddle ?? 0)),
            dust: Math.max(unit.quad.dust, unit.quad.dustIn),
          }
        : null;
      updateMuddiness(c.mucky, dt, { ride, walking: c.fsm.is('walking'), hosed: c.hosedNow ? 1 : 0 }, p);
      c.girlMud.update(c.mucky);
      const kind = noticing(c.mucky, p);
      if (kind && c.voice.onMuddy(kind)) markRemarked(c.mucky, kind, p);
    }
  }

  /** Mud and drops on your view: what a puddle, the quad ahead or hard rain throws up, drying, and X to wipe it (effects/lensMud.js). */
  updateLens(dt, ridden) {
    const p = this.headgear.you.goggles ? { ...this.lensParams, guard: Math.max(this.lensParams.guard, this.headgear.guard()) } : this.lensParams; // goggles keep the mud off
    const open = !!ridden && isOpenVehicle(ridden.spec.id);
    let situation = null;
    if (open) {
      const q = ridden.quad;
      const others = this.units
        .filter((u) => u !== ridden && u.quad.speed > 0)
        .map((u) => {
          const m = u.quad.physics.wheelMud;
          return { x: u.quad.position.x, z: u.quad.position.z, speed: u.quad.speed, mud: m.length ? m.reduce((a, b) => a + b, 0) / m.length : 0 };
        });
      situation = {
        speed: q.forwardSpeed,
        puddle: Math.max(0, ...q.physics.wheelInfo.map((w) => w.puddle ?? 0)),
        leader: leaderAhead({ x: q.position.x, z: q.position.z, yaw: q.yaw }, others, p),
        rain: this.weather.rain,
        covered: this.world.covered(q.position.x, q.position.z),
      };
      if (!this.menu.isOpen && this.input.wasPressed('KeyX')) {
        const had = this.lens.splats.length;
        wipeLens(this.lens, p);
        if (had) this.hud.toast(this.lens.splats.length ? 'Smeared it about' : 'Wiped it clear', 1.2);
      }
    }
    updateLens(this.lens, dt, situation, this.lensRandom, p);
    this.lensView.setLight(1 - (this.daylight?.darkness ?? 0)); // drawn with its own colours, so dimmed with the day like the other fixed-colour effects
    this.lensView.update(dt, this.lens, open);
  }

  /** The debug panel and console: a splat of mud on the lens now, or a wipe. */
  debugLens(what) {
    if (what === 'splat') for (let i = 0; i < 3; i++) addSplat(this.lens, this.lensRandom, this.lensParams, 'mud');
    else if (what === 'clear') this.lens.splats.length = 0;
    else wipeLens(this.lens, this.lensParams);
  }

  /** Spraying, the hose's reach, the hiss, and her reaction if you get her wet. */
  updateHose(dt) {
    const hose = this.hose;
    if (hose.held && this.player.isRiding) hose.putBack();
    if (hose.held && hose.distanceFrom(this.player.position) > hose.params.reach) {
      hose.putBack();
      this.hud.toast('The hose won\'t reach any further: it pulled out of your hand');
    }
    hose.spraying = hose.held && !this.menu.isOpen && this.input.isDown('KeyE');
    hose.update(dt);
    this.audioHub.setSpraying(hose.spraying, !!this.washing);
    for (const c of this.companions) {
      if (this.washing) c.voice.onWash?.('quad');
      // Spraying her: she's in front of you and close.
      c.hosedNow = false;
      if (hose.spraying) {
        const to = c.voice.head.clone().sub(this.camera.position);
        const dist = to.length();
        const ahead = this.camera.getWorldDirection(to.clone()).dot(to.normalize());
        if (dist < 7 && ahead > 0.96) {
          c.voice.onWash?.('her');
          c.hosedNow = true; // it takes the mud off her (muddiness.js)
        }
      }
    }
  }

  /** The girls bickering with each other (banter.js), when there's a moment for it. */
  updateBanter(dt, ridden) {
    if (this.companions.length < 2) return;
    this.banter ??= new Banter(BANTER);
    this.banterWatch ??= new BanterWatch();
    let triggers = this.banterWatch.triggers(dt, { companions: this.companions, ridden, you: this.camera.position, wheelOpen: this.menu.isOpen, rivalry: this.favour.rivalry() });
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    // Jess has just guessed wrong about a running quad with Amy close by: she puts her right.
    const said = byId.jess?.voice?.lastDiagnosis;
    if (said) {
      byId.jess.voice.lastDiagnosis = null;
      const amy = byId.amy;
      if (amy && !amy.fsm.is('driving', 'starting') && amy.voice.head.distanceTo(byId.jess.voice.head) < 10) {
        triggers.push({ when: 'corrected', edge: true, roles: { guesser: 'jess', corrector: 'amy', guess: said.guess, truth: said.truth } });
      }
    }
    // Waiting in the village pub's car park with you, and pulling away from it (npc/pubVisit.js).
    const at = (c) => c.root.getWorldPosition(c.tmpV.clone());
    triggers.push(
      ...this.pubVisit.triggers(
        dt,
        this.world.props.village?.shape.pubStop ?? null,
        this.camera.position,
        ridden && this.player.isRiding ? ridden.quad.speed : 0,
        this.companions.map((c) => ({ x: at(c).x, z: at(c).z, settled: c.fsm.is('idle', 'resting') || (c.isSeated && !c.fsm.is('driving')) })),
      ),
    );
    // A race has just finished, or one of them is well ahead on wins (npc/race.js).
    if (this.raceResult) {
      triggers.push({ when: 'raced', edge: true, roles: this.raceResult });
      this.raceResult = null;
    }
    if (this.convoySwapped) {
      triggers.push({ when: 'swapped', edge: true, roles: this.convoySwapped });
      this.convoySwapped = null;
    }
    const rivals = this.race.rivalry();
    const [first, second] = this.companions;
    if (rivals && first.fsm.is('idle') && second.fsm.is('idle') && first.root.position.distanceTo(second.root.position) < 12) triggers.push({ when: 'rivals', roles: rivals });
    // They have each worked out which quad is best at what, and differ (or for once agree): npc/quadOpinion.js.
    if (first.fsm.is('idle') && second.fsm.is('idle') && first.root.position.distanceTo(second.root.position) < 12) {
      const ids = this.strengthIds();
      const hers = [first.opinion, second.opinion];
      const clash = disagreements(...hers, ids, this.strengthTruth);
      if (clash.length) {
        const turn = this.strengthTurn ? 'amy' : 'jess';
        for (const d of clash) triggers.push({ when: 'strengths', roles: { kind: d.kind, starter: turn } });
      }
      for (const a of agreements(...hers, ids, this.strengthTruth)) triggers.push({ when: 'strengthsAgree', roles: { kind: a.kind } });
    }
    // Fallen out: the friendly digs stop and the bickering turns sharp.
    for (const t of this.fallingOutEvents.splice(0)) triggers.push(t);
    if (this.fallingOut.active) {
      const standingAbout = triggers.some((t) => t.when === 'idle');
      triggers = triggers.filter((t) => !['idle', 'favoured', 'rivals'].includes(t.when));
      if (standingAbout) triggers.push({ when: 'fallenOut' });
    }
    const speak = (speaker, text, opts) => (byId[speaker]?.params.voice ? byId[speaker].voice.speak(text, opts) : 0);
    const started = this.banter.update(dt, triggers, speak, this.talkFloor.left <= 0 && !this.menu.isOpen && !this.gossip.busy && !this.comparing.busy);
    if (started?.when === 'strengths') this.strengthTurn = !this.strengthTurn; // the other one raises it next time
    if (started && FRICTION_BANTER.includes(started.when)) this.noteFriction('digs');
    this.talkFloor.banter = this.banter.busy || this.gossip.busy || this.comparing.busy;
    this.updateGossip(dt, byId, speak);
  }

  /** Something between the girls adds friction (fallingOut.js); `fault` is the girl most to blame, if she is one of them. */
  noteFriction(kind, fault = null) {
    const girl = this.companions.some((c) => c.character.id === fault) ? fault : null;
    if (kind !== 'digs' && !girl) return;
    this.handleFallingOut(this.fallingOut.add(kind, girl));
  }

  /** They've just fallen out or made up: the row (or the apology) is raised as a moment for the banter. */
  handleFallingOut(event) {
    if (!event) return;
    if (event.type === 'fellOut') {
      this.fallingOutEvents.push({ when: 'fellOut', edge: true, roles: { kind: event.kind, fault: event.fault } });
      this.dayEvents.add('fellOut', { cause: event.kind, fault: event.fault });
      this.sulking.fellOut(event.kind, event.fault, this.companions.map((c) => c.character.id)); // the one who came off worse may go and sulk
      this.race.stand();
      this.convoy.stand();
    } else if (event.type === 'madeUp') {
      this.fallingOutEvents.push({ when: 'madeUp', edge: true, roles: { sorry: event.sorry } });
      this.dayEvents.add('madeUp');
    }
  }

  /** What making up needs to know (npc/makeUp.js): how long the row has lasted, who is at fault, who is free, and whose own quad is there to give. */
  makeUpContext() {
    const fo = this.fallingOut;
    return {
      fallenOut: fo.active,
      since: fo.elapsed,
      fault: fo.fault,
      girls: this.companions.map((c) => {
        const friend = c.others()[0];
        const unit = this.girlUnits.find((u) => u.spec.id === c.voice.favourite);
        const q = unit?.quad;
        const spare = q && friend && !q.isTipped && !q.rider && !q.driver && !q.passenger && !q.isGhostRiding && Math.abs(q.speed) < 0.5 && friend.canDrive(q) && !friend.takenByOther(q);
        const r = c.root.position;
        return { id: c.character.id, x: r.x, z: r.z, free: c.availability().free, settled: c.availability().canRemark && c.fsm.is('idle'), quad: spare ? unit.spec.id : null };
      }),
    };
  }

  /**
   * She makes the first move (npc/makeUp.js): walks over to her friend with a mug of tea, or to offer her own quad, says so, and her
   * friend takes it (the row ends, with no apology on top) or turns her down (it carries on and she waits before trying again).
   */
  handleMakeUp(e) {
    const c = this.companions.find((o) => o.character.id === e.girl);
    const friend = this.companions.find((o) => o.character.id === e.friend);
    if (!c || !friend) return this.makeUp.cancel(e.girl);
    let mug = null;
    const giveUp = () => {
      c.release('makeUp');
      this.makeUp.cancel(e.girl);
      if (mug) {
        c.endCarry();
        this.mugs.remove(mug);
      }
    };
    if (e.how === 'tea') {
      mug = this.mugs.make(e.girl === 'amy' ? 0x3a6ea5 : 0xb8322a);
      mug.position.copy(c.root.position);
      if (!c.startCarry('mug', mug, carryWeight('mug'), { inHand: true })) {
        this.mugs.remove(mug);
        mug = null;
        return giveUp();
      }
    }
    c.hold('makeUp', 'making it up with her friend');
    const at = standBy(c.root.position, friend.root.position, this.pair.p);
    const arrived = () => {
      c.release('makeUp');
      const gone = !this.fallingOut.active || friend.root.position.distanceTo(c.root.position) > 4;
      if (gone) return giveUp();
      c.voice.say(e.how === 'tea' ? 'makeUpTea' : 'makeUpQuad', { force: true });
      const accepted = this.makeUp.offered(e.girl);
      setTimeout(() => {
        if (!this.fallingOut.active) return;
        friend.voice.say(accepted ? 'makeUpTaken' : 'makeUpRefused', { force: true });
        if (accepted) {
          this.fallingOut.end();
          if (e.how === 'quad') {
            const unit = this.girlUnits.find((u) => u.spec.id === e.quad);
            if (unit && friend.fsm.is('idle') && friend.canDrive(unit.quad)) friend.requestDrive(unit.quad);
          }
        } else setTimeout(() => c.voice.say('makeUpTurnedDown', { force: true }), 2500);
      }, 2800);
      if (!mug) return;
      const side = c.root.localToWorld(new THREE.Vector3(-0.35, 0, 0.3));
      if (accepted && friend.startCarry('mug', mug, carryWeight('mug'), { sip: true, onSipped: () => friend.putDownCarry(side, 0, () => this.mugs.remove(mug)) })) {
        c.endCarry();
        return;
      }
      c.putDownCarry(side, 0, () => this.mugs.remove(mug));
    };
    if (!c.sneakTo({ x: at.x, z: at.z }, arrived, 1.2)) giveUp();
  }

  /**
   * While they're fallen out: each tells you her side the first time you come close, they keep their distance, and
   * stood about together (near you) the falling out runs down faster. They make up on their own in the end.
   */
  updateFallingOut(dt) {
    const fo = this.fallingOut;
    const p = fo.p;
    this.makeUp.update(dt);
    if (this.companions.length < 2) return;
    const [a, b] = this.companions;
    const here = (c) => c.root.getWorldPosition(c.tmpV.clone());
    const apart = here(a).distanceTo(here(b));
    const stood = (c) => c.fsm.is('idle', 'resting');
    const you = this.player.position;
    const together = fo.active && stood(a) && stood(b) && apart < p.togetherRange && here(a).distanceTo(you) < p.togetherNearYou && here(b).distanceTo(you) < p.togetherNearYou;
    this.handleFallingOut(fo.update(dt, together));
    if (!fo.active) return;
    const floorFree = this.talkFloor.left <= 0 && !this.banter?.busy && !this.menu.isOpen;
    for (const c of this.companions) {
      const id = c.character.id;
      if (fo.wantsToTell(id) && floorFree && stood(c) && here(c).distanceTo(you) < p.sideRange) {
        fo.tell(id);
        c.voice.say(`side${fo.cause.kind[0].toUpperCase()}${fo.cause.kind.slice(1)}`, { force: true });
      }
      // Too close to her friend: she goes and stands further off (not a headlong rush, and not every frame).
      const clock = fo.clock;
      if (stood(c) && apart < p.apartRange && clock - (this.fallingOutApartAt[id] ?? -Infinity) > 8 && !c.warmingAt && !c.pendingSpot && !this.makeUp.busy(id) && !this.makeUp.busy(c.others()[0]?.character.id)) {
        const friend = this.companions.find((o) => o !== c);
        const from = here(friend);
        const me = here(c);
        const away = new THREE.Vector3(me.x - from.x, 0, me.z - from.z);
        if (away.lengthSq() < 0.01) away.set(1, 0, 0);
        away.normalize().multiplyScalar(p.apartRange + 3);
        const target = new THREE.Vector3(me.x + away.x, 0, me.z + away.z);
        const area = this.world.fields?.areaOf(me.x, me.z);
        if (this.world.fields && area !== 'out') {
          const clamped = this.world.fields.clampToArea(area, target.x, target.z, 4);
          target.x = clamped.x;
          target.z = clamped.z;
        }
        target.y = this.world.heightAt(target.x, target.z);
        this.fallingOutApartAt[id] = clock;
        c.walkTo(target, Math.atan2(from.x - target.x, from.z - target.z));
      }
    }
  }

  // Round the back of the barn, and her quad ------------------------------------

  /** The quad she likes best, if it is one she could be sat on the back of right now with nobody else on it. */
  romanceQuad(c) {
    const unit = this.girlUnits.find((u) => u.spec.id === c.voice.favourite);
    const q = unit?.quad;
    if (!q || !q.hasPillion || q.isTipped || q.rider || q.driver || q.passenger || q.isGhostRiding || q.speed > 0.5) return null;
    if (this.herOn(q) || !c.canRidePillion(q)) return null;
    return unit;
  }

  /** Is she sat on her favourite quad and you stood on foot beside it? */
  onHerQuad(c) {
    const q = c.quad;
    return c.fsm.is('seated') && c.seatKind === 'pillion' && q.unit.spec.id === c.voice.favourite && !this.player.isRiding
      && this.player.position.distanceTo(q.position) < this.romance.p.quadRange;
  }

  updateRomance(dt) {
    this.watchTippedQuads(dt);
    if (this.tryst) return this.updateTryst(dt);
    for (const e of this.romance.update(dt, this.romanceContext())) this.handleRomanceEvent(e);
  }

  /** What the romance needs to know (npc/romance.js): how each girl rates you, whether she's free and near, and whether you are. */
  romanceContext() {
    const you = this.player.position;
    const youFree = !this.player.isRiding && !this.menu.isOpen && !this.hiding.active && !this.climb && !this.race.active && !this.drag.active && !this.recalling && !this.tryst;
    const girls = this.companions.map((c) => {
      const id = c.character.id;
      return {
        id,
        score: this.favour.scores[id],
        favoured: this.favour.mood(id) === 'favoured',
        free: c.availability().free,
        distance: c.root.position.distanceTo(you),
        fallenOut: this.fallingOut.active,
        quadOk: !!this.romanceQuad(c),
      };
    });
    return { girls, youFree };
  }

  /** What an invitation or a lapsed one does: she says so, and for the quad one goes to sit on it. */
  handleRomanceEvent(e) {
    const c = this.companions.find((o) => o.character.id === e.girl);
    if (e.type === 'invite') {
      const unit = e.kind === 'quad' ? this.romanceQuad(c) : null;
      if (e.kind === 'quad' && !unit) {
        this.romance.cancel(e.girl);
        return false;
      }
      c.voice.say(e.kind === 'quad' ? 'inviteQuad' : 'inviteBarn', { force: true });
      if (unit) this.romanceGetOnQuad(c, unit, 3);
      this.hud.toast(`${c.name} wants a word: talk to her`, 3);
    } else if (e.type === 'lapsed') {
      c.voice.say('inviteLapsed', { force: true });
      if (e.kind === 'quad' && c.fsm.is('seated', 'mounting')) c.requestStandBeside();
    }
    return true;
  }

  /** She starts her favourite quad first if it isn't running (trying again if it won't catch), then gets on the back of it. */
  romanceGetOnQuad(c, unit, tries) {
    const q = unit.quad;
    if (q.engine.isRunning) return c.requestMount(q);
    c.requestStart(q, {
      settleAt: this.romance.p.settleAt,
      then: (ran) => {
        if (!this.romance.pendingFor(c.character.id)) return; // it lapsed or you said no while she was at it
        if (!this.romanceQuad(c)) return this.romance.cancel(c.character.id); // you got on it, or it's gone over
        if (ran) c.requestMount(q);
        else if (tries > 1) this.romanceGetOnQuad(c, unit, tries - 1);
        else this.romance.cancel(c.character.id);
      },
    });
  }

  /** Her wheel options while she's asked: yes, or not now. */
  romanceWheelOptions(c) {
    const id = c.character.id;
    const ask = this.romance.pendingFor(id);
    if (!ask || this.tryst) return [];
    const no = {
      label: 'Not now',
      run: () => {
        this.romance.decline(id);
        c.voice.say('inviteDeclined', { force: true });
        if (ask.kind === 'quad' && c.fsm.is('seated', 'mounting')) c.requestStandBeside();
      },
    };
    if (ask.kind === 'barn') return [{ label: 'Go round the back of the barn', run: () => this.startTryst(c, 'barn') }, no];
    return this.onHerQuad(c) ? [{ label: 'Stand next to her on the quad', run: () => this.startTryst(c, 'quad') }, no] : [no];
  }

  startTryst(c, kind) {
    if (kind === 'barn' && !c.fsm.is('idle')) return this.hud.toast(`${c.name} is busy`, 1.6);
    this.closeMenu();
    this.romance.accept(c.character.id);
    this.tryst = { scene: new Tryst(c.character.id, kind, this.romance.p), girl: c };
    this.player.moveEnabled = false;
    this.player.lookEnabled = false;
  }

  /** Turns you to look at her. */
  lookAtHer(c) {
    const from = this.player.position;
    const to = c.root.getWorldPosition(c.tmpV.clone());
    this.player.yaw = Math.atan2(-(to.x - from.x), -(to.z - from.z));
    this.player.pitch = 0;
  }

  updateTryst(dt) {
    const { scene, girl: c } = this.tryst;
    const id = c.character.id;
    const kind = scene.kind;
    for (const e of scene.update(dt)) {
      if (e === 'place') {
        if (kind === 'barn') {
          // Behind the barn, you facing her.
          const b = this.world.layout.barn;
          const x = b.x - b.halfX - 3.2;
          const you = { x, y: this.world.heightAt(x, b.z), z: b.z };
          this.player.moveTo(you);
          const hx = x + 1.2;
          c.root.position.set(hx, this.world.heightAt(hx, b.z), b.z);
          c.heading = -Math.PI / 2;
          c.root.rotation.y = c.heading;
        }
        this.lookAtHer(c);
      } else if (e === 'moment') {
        this.lookAtHer(c);
        c.voice.say(kind === 'quad' ? 'trystQuad' : 'trystBarn', { force: true });
      } else if (e === 'back') {
        c.voice.say(kind === 'quad' ? 'afterQuad' : 'afterBarn', { force: true });
      } else if (e === 'done') this.endTryst(c, kind);
    }
    this.hud.setFade(scene.fade);
  }

  endTryst(c, kind) {
    const id = c.character.id;
    this.tryst = null;
    this.hud.setFade(0);
    this.player.moveEnabled = true;
    this.player.lookEnabled = true;
    const friend = this.companions.find((o) => o !== c);
    const result = this.romance.complete(id);
    this.favour.add(id, 2);
    if (result.type === 'lockedIn') {
      this.favour.lock(id, this.romance.p.lockScore);
      if (friend) setTimeout(() => friend.voice.say('sulkLockedOut', { force: true }), 6000);
    } else if (friend && Math.random() < 0.6) setTimeout(() => friend.voice.say('teaseRomance', { force: true }), 8000);
    if (kind === 'quad') c.requestStandBeside();
  }

  /** The one thing she won't forgive: you tip a quad over with her on it. */
  watchTippedQuads(dt) {
    const locked = this.companions.find((c) => c.character.id === this.romance.lockedGirl);
    const q = this.riddenUnit?.quad;
    if (q && locked && !q.isTipped && this.herOn(q) === locked) {
      this.sharedQuad = q;
      this.sharedFor = 0;
    } else if (this.sharedQuad) {
      this.sharedFor += dt; // a tip throws you off first, so give it a few seconds
      if (!locked || this.sharedFor > 4) this.sharedQuad = null;
    }
    const tipped = this.sharedQuad?.isTipped;
    if (tipped && !this.sharedTipped) {
      const id = locked.character.id;
      this.romance.betray(id);
      this.favour.unlock(id, this.romance.p.betrayScore);
      locked.voice.say('betrayed', { force: true });
      this.sharedQuad = null;
    }
    this.sharedTipped = !!tipped;
  }

  /** The wheel's two extras while they're fallen out and she's told you her side: take her side, or tell her to make up. */
  // Jess's dares -----------------------------------------------------------
  /** The dares that could be done now on this farm: the ramp, the ford and (if there is one) the fence, and the bank if there is a mini moto. */
  dareKinds() {
    const L = this.world.layout;
    const kinds = [];
    if (L.jumpRamp) kinds.push('ramp');
    kinds.push('ford');
    if (this.fence?.fence) kinds.push('fence');
    if (this.units.some((u) => u.id === 'moto')) kinds.push('bank');
    return kinds;
  }

  daresContext() {
    const p = this.player.position;
    return {
      kinds: this.dareKinds(),
      girls: this.companions.map((c) => ({
        id: c.character.id,
        free: c.availability().free,
        distance: Math.hypot(c.root.position.x - p.x, c.root.position.z - p.z),
        weight: c.params.dareWeight ?? 0,
      })),
    };
  }

  /** The debug panel's and console's dare: she dares you to `kind` (any of the four if left out). */
  startDare(id, kind) {
    const c = this.companions.find((o) => o.character.id === id);
    if (this.dares.active) return this.hud.toast(`${this.dares.describe()}`);
    const kinds = this.dareKinds();
    const k = kind ?? kinds[Math.floor(Math.random() * kinds.length)];
    if (!kinds.includes(k)) return this.hud.toast(`There is nothing to ${DARE_KINDS[k]?.label ?? k} on this farm`);
    const a = c.availability({ asked: true });
    if (!a.free) return this.hud.toast(`${c.name} is busy (${a.why})`);
    c.interrupt();
    this.handleDare(this.dares.begin(id, k));
  }

  updateDares(dt) {
    const d = this.dares;
    const board = this.boardUnit;
    const seat = this.player.seat === 'rider';
    let you = null;
    if (board && seat) {
      const q = board.quad;
      const ramp = this.world.layout.jumpRamp;
      const lip = ramp ? { x: ramp.x + Math.sin(ramp.yaw) * ramp.length, z: ramp.z + Math.cos(ramp.yaw) * ramp.length } : null;
      you = {
        rider: true,
        moto: board.id === 'moto',
        speed: Math.abs(q.speed),
        airborne: q.airborne,
        tipped: q.isTipped,
        nearRamp: lip ? Math.hypot(q.position.x - lip.x, q.position.z - lip.z) : Infinity,
        atFord: placesAt(q.position, this.world.layout).includes('ford'),
        x: q.position.x,
        y: q.position.y,
        z: q.position.z,
      };
    }
    for (const e of d.update(dt, you)) this.handleDare(e);
  }

  /** Acts on a dare (npc/dares.js): Jess says it, cheers or teases; Amy says what she thinks, or is worried after a tumble. */
  handleDare(e) {
    if (!e) return;
    const jess = this.companions.find((o) => o.character.id === e.girl);
    const friend = this.companions.find((o) => o.character.id !== e.girl);
    if (!jess) return this.dares.cancel();
    const Kind = e.kind ? e.kind[0].toUpperCase() + e.kind.slice(1) : '';
    const near = (c) => c && c.availability().canRemark && Math.hypot(c.root.position.x - this.player.position.x, c.root.position.z - this.player.position.z) < 40;
    if (e.type === 'dared') {
      jess.voice.say(`dare${Kind}`, { force: true, urgent: true });
      this.hud.toast(`${jess.name} dares you to ${DARE_KINDS[e.kind].label}`, 4);
    } else if (e.type === 'done') {
      jess.voice.say('dareWon', { force: true });
      this.favour.add(e.girl, this.dares.p.favourWin);
      if (friend) this.favour.add(friend.character.id, this.dares.p.favourAmy);
      this.achievements.note(`dare${Kind}`);
      if (e.fell && near(friend)) friend.voice.say('dareFell', { force: true });
      else if (near(friend)) friend.voice.say(`dareAmy${Kind}`, { chance: 0.9 });
    } else if (e.type === 'chicken') {
      jess.voice.say('dareChicken', { force: true });
    } else if (e.type === 'fell' && near(friend)) {
      friend.voice.say('dareFell', { force: true });
    }
  }

  // A girl at the bench -----------------------------------------------------
  /** Whether you are within `range` metres of the workbench. */
  nearBench(range) {
    const b = this.world.layout.bench;
    return Math.hypot(this.player.position.x - b.x, this.player.position.z - b.z) <= range;
  }

  /** The quad she would work on and the job it needs: { unit, kind }, or why not: { why }. Parked in the bay, switched off, toolbox on the bench. */
  benchWorkPlan() {
    if (this.bench.isOpen) return { why: 'the bench is in use' };
    if (this.girlBench.pending) return { why: 'there is a job left on the bench to finish' };
    if (!this.bench.toolboxHere()) return { why: "the toolbox isn't on the bench" };
    const unit = this.bench.unitInBay();
    if (!unit || unit.barnFind) return { why: 'there is no quad in the painted bay' };
    if (unit.engine.isRunning || unit.engine.state === 'cranking' || this.herOn(unit.quad) || unit.quad.rider) return { why: 'the quad in the bay is in use' };
    const f = unit.quad.faults;
    const e = unit.engine;
    const kind = pickJob(
      { puncture: f.started.puncture, carb: f.started.carb, fouling: e.fouling, wear: e.wear, twoStroke: e.params.strokes === 2, oilLow: (unit.quad.fuel.oil ?? 1) < this.bench.params.oilGood * 0.8 },
      (k) => this.bench.canBegin(k, unit),
    );
    return kind ? { unit: unit.id, kind } : { why: 'there is nothing she could do to it' };
  }

  /** What the girl-at-the-bench module needs to offer (npc/girlBench.js). */
  girlBenchContext() {
    const plan = this.benchWorkPlan();
    const b = this.world.layout.bench;
    return {
      bay: plan.why ? null : plan,
      girls: this.companions.map((g) => ({
        id: g.character.id,
        free: g.availability().free,
        distance: Math.hypot(g.root.position.x - b.x, g.root.position.z - b.z),
        weight: g.params.benchWeight ?? 0,
        slip: g.params.benchSlip ?? 0,
      })),
    };
  }

  /** The debug panel's and the console's way of sending her to the bench: says why not with a toast. */
  startGirlBench(id) {
    const c = this.companions.find((o) => o.character.id === id);
    const a = c.availability({ asked: true });
    if (!a.free) return this.hud.toast(`${c.name} is busy (${a.why})`);
    if (this.girlBench.active) return this.hud.toast(`${this.girlBench.girl} is at the bench already`);
    const plan = this.benchWorkPlan();
    if (plan.why) return this.hud.toast(`${c.name} can't: ${plan.why}`);
    c.interrupt();
    this.handleGirlBench(this.girlBench.begin(id, plan.unit, plan.kind, 'asked', { slips: (c.params.benchSlip ?? 0) >= 0.5 }));
  }

  updateGirlBench(dt) {
    const gb = this.girlBench;
    const ref = gb.session ?? gb.pending;
    const unit = ref && this.units.find((u) => u.id === ref.unit);
    const c = gb.girl && this.companions.find((o) => o.character.id === gb.girl);
    const spot = workSpot(this.world.layout.bay);
    const unitOk = !!unit && this.bench.unitInBay() === unit && !unit.engine.isRunning && unit.engine.state !== 'cranking';
    const ctx = {
      girl: c ? { there: c.fsm.is('idle') && Math.hypot(c.root.position.x - spot.x, c.root.position.z - spot.z) < 0.9 } : null,
      unitOk,
      benchOpen: this.bench.isOpen,
    };
    if (c && gb.session?.phase !== 'going' && unitOk) {
      c.benchAt = spot;
      const q = unit.quad.position;
      c.attend({ x: q.x, y: q.y + 0.7, z: q.z }, { weight: 4 });
    } else if (c) c.benchAt = null;
    for (const e of gb.update(dt, ctx)) this.handleGirlBench(e);
  }

  /** Acts on the girl at the bench (npc/girlBench.js): she walks over, speaks, is helped, finishes the job on the quad, or hands it to you. */
  handleGirlBench(e) {
    if (!e) return;
    const c = this.companions.find((o) => o.character.id === e.girl);
    if (!c) return this.girlBench.cancel();
    const gb = this.girlBench;
    const unit = e.unit && this.units.find((u) => u.id === e.unit);
    if (e.type === 'go') {
      c.hold('benchWork', 'working at the bench');
      c.voice.say('benchGirlGo', { force: true });
      const s = workSpot(this.world.layout.bay);
      c.walkTo(new THREE.Vector3(s.x, this.world.heightAt(s.x, s.z), s.z), s.yaw);
    } else if (e.type === 'say') {
      c.voice.say(e.line, { force: true });
    } else if (e.type === 'help') {
      this.favour.add(e.girl, e.quick ? gb.p.favourQuick : gb.p.favourSlow);
    } else if (e.type === 'finish' && unit) {
      this.hud.toast(`${c.name}: ${finishJob(e.job, { engine: unit.engine, faults: unit.quad.faults, fuel: unit.quad.fuel, tyres: unit.quad.tyres, sump: unit.quad.sump }, this.bench.params)}`);
      this.notebook.note(unit, { kind: 'job', job: e.kind, botched: e.botched }, { saw: true });
      c.voice.say(e.botched ? 'benchGirlBotched' : 'benchGirlDone', { force: true });
      if (!e.botched) this.favour.add(e.girl, gb.p.favourDone);
    } else if (e.type === 'handover') {
      c.voice.say('benchHandOver', { force: true });
    } else if (e.type === 'gaveUp') {
      if (e.why === 'waited') c.voice.say('benchGaveUp', { force: true });
    } else if (e.type === 'end') {
      c.release('benchWork');
      c.benchAt = null;
    }
  }

  /** You finished the job a girl left half done at the bench: she is pleased (npc/girlBench.js). */
  /** A quad in a bad way: a full or partial service goes on the board for the day, on top of the other jobs (workshop/service.js). */
  setUpServiceJob() {
    this.serviceJob = null;
    const quads = this.units
      .filter((u) => !u.barnFind && u.quad.faults && u.engine)
      .map((u) => ({ id: u.id, name: shortName(u.name), plan: servicePlan(factsOf(u)), state: stateOf(u) }));
    const pick = pickServiceJob(quads, createRandom(this.seed ^ 0x5e71), this.bench?.serviceParams);
    if (!pick) return;
    this.serviceJob = new ServiceJob(pick);
    this.jobBoard.add(`service:${pick.id}`, {
      chalk: serviceChalk(pick),
      hint: pick.full ? 'Do a full service at the bench: press S on the bench menu' : `At the bench: ${pick.kinds.join(', ')}`,
    });
  }

  /** A bench job is finished on a vehicle: it counts towards a service on the board. */
  serviceJobNoted(unit, kind, botched) {
    const job = this.serviceJob;
    if (!job || !job.note(unit.id, kind, botched)) return;
    if (this.jobBoard.complete(`service:${job.id}`)) {
      this.hud.toast('Service done: ticked off the board', 4);
      this.jobBoardView.refresh();
      if (this.jobBoard.cleared) this.achievements.note('boardCleared');
    }
  }

  girlBenchFinished(job) {
    const pn = this.girlBench.pending;
    if (!pn || pn.job !== job) return;
    this.girlBench.settle();
    const c = this.companions.find((o) => o.character.id === pn.girl);
    this.favour.add(pn.girl, this.girlBench.p.favourFinish);
    c?.voice.say('benchFinished', { force: true });
  }

  // Phone calls -------------------------------------------------------------
  /** What the phone module needs to offer (npc/phoneCalls.js): who is free, and how keen each is. */
  phoneContext() {
    return {
      girls: this.companions.map((c) => ({
        id: c.character.id,
        free: c.availability().free,
        weight: c.params.phoneWeight ?? 0,
        moodChance: c.params.phoneMoodChance ?? 0,
        moodSeconds: c.params.phoneMoodSeconds ?? 240,
      })),
    };
  }

  /** The debug panel's and the console's way of making her phone ring: says why not with a toast. */
  startPhoneCall(id, mood = null) {
    const c = this.companions.find((o) => o.character.id === id);
    const a = c.availability({ asked: true });
    if (!a.free) return this.hud.toast(`${c.name} is busy (${a.why})`);
    if (this.phoneCalls.active) return this.hud.toast(`${this.phoneCalls.girl}'s phone is already going`);
    c.interrupt();
    const bad = mood ?? Math.random() < (c.params.phoneMoodChance ?? 0);
    this.handlePhoneCall(this.phoneCalls.begin(id, 'asked', { mood: bad, moodSeconds: c.params.phoneMoodSeconds ?? 240 }));
  }

  updatePhoneCall(dt) {
    const pc = this.phoneCalls;
    const c = pc.girl && this.companions.find((o) => o.character.id === pc.girl);
    const ctx = {
      girl: c
        ? {
            free: c.availability({ asked: true, mine: 'phoneCall' }).free,
            there: !!c.callSpot && c.fsm.is('idle') && Math.hypot(c.root.position.x - c.callSpot.x, c.root.position.z - c.callSpot.z) < 1.2,
            youDistance: c.root.position.distanceTo(this.player.position),
          }
        : null,
    };
    if (c && pc.session?.phase === 'talking') {
      // Keeps the phone at her ear for the whole call (an idle pose only holds for a while), turned away from you.
      if (c.standingIdles?.name !== 'phoneCall') c.standingIdles?.force('phoneCall');
      c.standingIdles.left = Math.max(c.standingIdles.left, 2);
    }
    for (const e of pc.update(dt, ctx)) this.handlePhoneCall(e);
  }

  /** Acts on a phone call (npc/phoneCalls.js): it rings, she goes off to answer, talks, comes back to tell you, and the mood sets in. */
  handlePhoneCall(e) {
    if (!e) return;
    const c = this.companions.find((o) => o.character.id === e.girl);
    if (!c) return this.phoneCalls.cancel();
    if (e.type === 'ring') {
      this.phoneAudio.ring({ x: c.root.position.x, y: c.root.position.y + 1, z: c.root.position.z });
      if (!c.callSpot) {
        c.hold('phoneCall', 'on the phone');
        c.voice.say('phoneRing', { force: true });
        const away = this.phoneCalls.p.awayMin + (this.phoneCalls.p.awayMax - this.phoneCalls.p.awayMin) * Math.random();
        const spot = callSpot({ x: c.root.position.x, z: c.root.position.z }, this.player.position, away, (Math.random() - 0.5) * 1.6);
        const target = c.keepToField(new THREE.Vector3(spot.x, 0, spot.z));
        c.callSpot = { x: target.x, z: target.z };
        c.walkTo(target, Math.atan2(target.x - this.player.position.x, target.z - this.player.position.z));
      }
    } else if (e.type === 'answer') {
      c.standingIdles?.force('phoneCall');
    } else if (e.type === 'say') {
      c.voice.say(e.line, { force: true });
    } else if (e.type === 'hangUp') {
      c.standingIdles && (c.standingIdles.left = 0);
      c.callSpot = null;
      c.walkToYou(this.player.position);
    } else if (e.type === 'tell') {
      c.voice.say(e.mood ? 'phoneMood' : 'phoneNews', { force: true });
      if (e.mood) this.favour.sulk(e.girl, e.moodSeconds);
    } else if (e.type === 'end') {
      c.callSpot = null;
      c.release('phoneCall');
      if (c.standingIdles?.name === 'phoneCall') c.standingIdles.left = 0;
    }
  }

  // Guiding a trailer back --------------------------------------------------

  /** What guiding needs to know (npc/trailerGuide.js): the trailer on what you're riding and how it lies against it, and the girls. */
  trailerGuideContext(ridden) {
    const q = ridden?.quad;
    const t = q ? this.trailerOf(q) : null;
    const m = t?.motion;
    const cam = this.camera.position;
    return {
      hitched: !!t,
      speed: q ? q.forwardSpeed : 0,
      angle: m?.hitchAngle ?? 0,
      jammed: !!m?.jammed,
      limit: m?.p.jackknifeAngle ?? 1,
      steer: q ? q.steer / ((q.params.maxSteerDeg * Math.PI) / 180) : 0,
      you: { x: cam.x, z: cam.z },
      girls: this.companions.map((g) => ({ id: g.character.id, x: g.root.position.x, z: g.root.position.z, free: g.availability().free, weight: g.params.trailerGuideWeight ?? 0 })),
    };
  }

  /** Where the guide stands now, behind the trailer you are reversing. */
  trailerGuideSpot(c, t) {
    const m = t.motion;
    const rear = t === this.tipTrailer ? -TIP_TRAILER_FOOTPRINT.rearZ : -BALE_TRAILER_FOOTPRINT.rearZ;
    const s = guideSpot(m, rear, { x: c.root.position.x, z: c.root.position.z }, this.trailerGuide.p);
    return { point: new THREE.Vector3(s.x, this.world.heightAt(s.x, s.z), s.z), facing: s.facing };
  }

  /** She walks round behind the trailer and stands; she stays there, calling. */
  handleTrailerGuide(e) {
    const c = this.companions.find((o) => o.character.id === e.girl);
    if (!c) return;
    if (e.type === 'go') {
      c.hold('trailerGuide', 'guiding you back with the trailer');
      c.voice.say('guideOffer', { urgent: true, force: true });
      const t0 = this.trailerOf(this.riddenUnit?.quad);
      if (t0) {
        const s = this.trailerGuideSpot(c, t0);
        c.walkTo(s.point, s.facing);
      }
    } else if (e.type === 'call') {
      c.voice.say(`guide${e.call[0].toUpperCase()}${e.call.slice(1)}`, { urgent: true, force: true });
      this.regroupGuide(c);
    } else if (e.type === 'cross') {
      c.voice.say(e.hard ? 'guideCrossHard' : 'guideCross', { urgent: true, force: true });
    } else if (e.type === 'done') {
      c.release('trailerGuide');
      c.voice.say(e.why === 'quit' ? 'guideQuit' : e.why === 'finished' ? 'guideDone' : 'guideWalked', { chance: e.why === 'left' ? 0.4 : 1 });
    }
  }

  /** Back behind the trailer if it has moved off from her. */
  regroupGuide(c) {
    const t = this.trailerOf(this.riddenUnit?.quad);
    if (!t || !c.fsm.is('idle', 'walking')) return;
    const s = this.trailerGuideSpot(c, t);
    if (Math.hypot(c.root.position.x - s.point.x, c.root.position.z - s.point.z) > 3.5) c.walkTo(s.point, s.facing);
  }

  updateTrailerGuide(dt, ridden) {
    if (!this.companions.length) return;
    const ctx = this.trailerGuideContext(ridden);
    for (const e of this.trailerGuide.update(dt, ctx)) this.handleTrailerGuide(e);
  }

  // Lights to work by -------------------------------------------------------

  /**
   * What lights to work by needs to know (npc/workLight.js), for girl `c`: how dark it is, where you are and what you're stood at (a
   * quad or a gate), the girls, and the vehicles she could bring.
   */
  workLightContext(c) {
    const p = this.workLight.p;
    const cam = this.camera.position;
    const you = { x: cam.x, z: cam.z, onFoot: !this.player.isRiding };
    const L = this.world.layout;
    const things = [...this.units.map((u) => u.quad).filter((q) => Math.abs(q.speed) < 0.5).map((q) => ({ x: q.position.x, z: q.position.z })), ...(L.gate ? [{ x: L.gate.x, z: L.fieldHalf }] : [])];
    let workAt = null;
    for (const t of things) if (Math.hypot(t.x - you.x, t.z - you.z) < p.workNear && (!workAt || Math.hypot(t.x - you.x, t.z - you.z) < Math.hypot(workAt.x - you.x, workAt.z - you.z))) workAt = t;
    const lit = (q) => !q.noHeadlight && !!q.model?.userData.beams?.length;
    return {
      dark: this.daylight?.darkness ?? 0,
      you,
      workAt,
      girls: this.companions.map((g) => ({ id: g.character.id, x: g.root.position.x, z: g.root.position.z, free: g.availability().free, weight: g.params.workLightWeight ?? 0 })),
      vehicles: this.units.map((u) => {
        const q = u.quad;
        const free = !q.rider && !q.driver && !q.passenger && !q.isTipped && !q.isGhostRiding && c.mayRide(q) && c.canDrive(q) && !c.takenByOther(q, 'rider') && !this.herOn(q);
        return { id: u.id, x: q.position.x, z: q.position.z, cab: ['utv', 'landy', 'defender'].includes(this.goKindOf(q)), lights: lit(q), free };
      }),
    };
  }

  /** Lights to work by on her wheel: "Light me up" after dark, or "That'll do" while she's at it. */
  workLightWheelOptions(c) {
    const job = this.workLight.job;
    if (job?.girl === c.character.id) return [{ label: 'That\'ll do for light, thanks', run: () => this.handleWorkLight(this.workLight.finish('asked')) }];
    if ((this.daylight?.darkness ?? 0) < this.workLight.p.darkAbove * 0.5 || job) return [];
    return [{ label: 'Light me up', run: () => this.askWorkLight(c) }];
  }

  /** You asked her to light you up (the wheel, the debug panel, the console). Returns why not, or null. */
  askWorkLight(c) {
    const a = c.availability({ asked: true });
    if (!a.free) return `she is busy (${a.why})`;
    const plan = this.workLight.ask({ id: c.character.id, x: c.root.position.x, z: c.root.position.z }, this.workLightContext(c));
    if (plan.why) {
      c.voice.say('workLightCant', { force: true });
      this.hud.toast(`${c.name} can't: ${plan.why}`);
      return plan.why;
    }
    c.voice.say('workLightAsked', { urgent: true, force: true });
    this.handleWorkLight(this.workLight.take({ girl: c.character.id, ...plan }));
    return null;
  }

  /**
   * Lights to work by (npc/workLight.js). 'bring': she drives the vehicle round to the spot, facing you, lights on; once it's there she
   * moves over to the passenger side or gets out and stands by it, leaving it running. 'done': she gets out or off, and switches off
   * what she brought.
   */
  handleWorkLight(e) {
    const c = this.companions.find((o) => o.character.id === e.girl);
    const unit = this.units.find((u) => u.id === e.vehicle);
    if (!c || !unit) return;
    const q = unit.quad;
    const kind = this.goKindOf(q);
    if (e.type === 'bring') {
      c.hold('workLight', 'lighting the way for you');
      q.lights?.set('low');
      const spot = this.clampedSpot(e.spot, e.target);
      const then = (result) => {
        if (!this.workLight.job || this.workLight.job.girl !== e.girl) return;
        if (result !== 'parked' && Math.hypot(q.position.x - spot.x, q.position.z - spot.z) > 5) return this.handleWorkLight(this.workLight.finish('failed'));
        this.workLight.arrived();
        q.lights?.set('low');
        c.voice.say('workLightThere', { chance: 0.9 });
        if (this.workLight.job.passenger && kind && kind !== 'tractor') this.boardCab(c, kind, { passenger: true });
        else if (this.workLight.job.passenger && q.hasPillion && c.canRidePillion(q)) c.requestMount(q, { seat: 'pillion' });
        else c.requestStandBeside(q);
      };
      c.requestDrive(q, { park: { route: parkRoute(spot, this.lineUpParams), yaw: spot.yaw, crooked: false, home: true, light: true, then } });
    } else if (e.type === 'done') {
      c.release('workLight');
      if (e.why !== 'failed') c.voice.say('workLightDone', { chance: e.why === 'asked' ? 1 : 0.7 });
      if (kind && c.onHayRide && c.trailer === this.mountOfKind(kind)) {
        this.rideOfKind(kind).dismiss(e.girl);
        c.leaveTrailer();
      } else if (c.quad === q && c.fsm.is('seated', 'mounting')) c.requestStandBeside(q);
      else if (c.quad === q && c.fsm.is('driving')) c.stopDriving('off');
      // Nobody else on it: off it goes.
      if (q.engine.isRunning && !q.rider && !this.player.isRiding && !this.companions.some((o) => o !== c && this.herOn(q) === o)) {
        q.engine.setIgnition(false);
        q.lights?.set('off');
      }
    }
  }

  /** The spot she brings it to, kept inside the field she's in (as a wander is), facing what she's lighting. */
  clampedSpot(spot, target) {
    const fields = this.world.fields;
    const area = fields?.areaOf(target.x, target.z);
    if (!fields || area === 'out') return spot;
    const c = fields.clampToArea(area, spot.x, spot.z, area === 'road' || area === 'end' ? 1.5 : 3);
    return { x: c.x, z: c.z, yaw: Math.atan2(target.x - c.x, target.z - c.z) };
  }


  // Spraying the field --------------------------------------------------------------

  /** The field in the south wheat stubble, the sprayer's rules and how it looks (world/spraying.js, world/sprayView.js). */
  setUpSpraying() {
    const rect = this.world.layout.sprayField;
    if (!rect) return;
    this.sprayParams = { ...DEFAULT_SPRAY_PARAMS };
    this.spray = new Spraying({ rect, params: this.sprayParams });
    this.spray.restore(this.farm.save?.spray, this.farm.day);
    this.sprayView = new SprayView({ scene: this.scene, spraying: this.spray, heightAt: (x, z) => this.world.heightAt(x, z) });
    this.sprayNoticeIn = 0; // seconds to the next time the girls notice the mist
    this.sprayStarted = false; // the girls have been told the job has begun
    this.sprayEmptied = false;
    registerTuning('Spraying', this.sprayParams, SPRAY_PARAM_RANGES);
    this.farmMap.spray = this.spray; // the map draws your lines
    this.farmMap.sprayWanted = () => this.jobBoard.has('spray') && !this.spray.done;
    // The hose fills the tank: hold E at the sprayer with the hose in your hand.
    this.interaction.add({
      target: this.sprayer.proxy,
      priority: -1,
      isAvailable: () => this.hose.held && !this.player.isRiding,
      prompt: () => ({ text: this.spray.tank >= 0.999 ? 'The sprayer is full   ·   G put the hose back' : `Hold E to fill the sprayer (${Math.round(this.spray.tank * 100)}%)   ·   G put the hose back` }),
      feedback: 'hold',
      interact: () => {},
      hold: (dt) => this.fillSprayer(dt),
    });
  }

  fillSprayer(dt) {
    const sp = this.spray;
    if (!this.hose.held || this.player.position.distanceTo(this.sprayer.model.position) > sp.p.fillReach + 1) return false;
    if (sp.tank >= 0.999) return false;
    if (sp.fill(dt) === 'full') this.hud.toast('The sprayer is full', 2);
    this.sprayEmptied = false;
    return true;
  }

  /** What the status line says to someone pulling the sprayer. */
  sprayStatus() {
    const sp = this.spray;
    const level = `${Math.round(sp.tank * 100)}% in the tank`;
    if (!sp.out) return `Sprayer hitched, ${level}\nT to fold the boom ${sp.boomWant ? 'in' : 'out'}, J to unhitch`;
    return `${SPRAY_PHASE_TEXT[sp.phase]}\nBoom out, ${level}, ${Math.round(sp.coverage * 100)}% of the field sprayed\nT to fold it in`;
  }

  /** One of the girls near the sprayer says something about the spraying (npc/sprayLines.js). */
  saySomethingAboutSpray(key) {
    const at = this.sprayer.model.position;
    const c = this.companions
      .filter((g) => g.availability().canRemark && g.root.position.distanceTo(at) < 40)
      .sort((a, b) => a.root.position.distanceTo(at) - b.root.position.distanceTo(at))[0];
    c?.voice.say(key);
  }

  updateSprayer(dt, ridden, input) {
    const t = this.sprayer;
    const sp = this.spray;
    t.update(dt, { boom: sp.boom, tank: sp.tank });
    this.noteFolded(t, ridden);
    // What it takes from the quad in front of it: a full tank drags.
    if (this.sprayPuller && this.sprayPuller !== t.puller) Object.assign(this.sprayPuller.tow, { driveFactor: 1, brakeFactor: 1 });
    this.sprayPuller = t.puller;
    if (t.puller) Object.assign(t.puller.tow, towEffect(towLoad(0, sp.tank * t.p.towWeight, this.towParams), !!t.puller.tractor || !!t.puller.landRover, this.towParams));
    // T folds the boom out or in, from the seat of whatever pulls it or standing by it.
    const riding = !!ridden && t.hitched && ridden.quad === t.puller;
    const near = riding || (!this.player.isRiding && this.player.position.distanceTo(t.model.position) < 3);
    if (near && input.wasPressed('KeyT') && !this.handsFull && !(ridden && !riding) && !(riding && ridden.quad.isTipped)) {
      this.hud.toast(sp.toggleBoom() ? 'Boom folding out' : 'Boom folding in', 2);
    }
    const events = sp.update(dt, { x: t.motion.x, z: t.motion.z, yaw: t.motion.yaw, speed: Math.abs(t.signedSpeed), hitched: t.hitched, day: this.farm.day });
    for (const e of events) {
      if (e.type === 'sprayed') {
        this.sprayView.repaint(e.cells);
        if (!this.sprayStarted) {
          this.sprayStarted = true;
          this.saySomethingAboutSpray('sprayStart');
        }
      } else if (e.type === 'empty') {
        this.hud.toast('The tank is empty: fill it from the hose', 4);
        if (!this.sprayEmptied) this.saySomethingAboutSpray('sprayEmpty');
        this.sprayEmptied = true;
      } else if (e.type === 'done') this.sprayDone();
    }
    // The mist drifts: a girl close by turns her face away (a notice, so reactions.js decides).
    this.sprayNoticeIn -= dt;
    if (sp.spraying && this.sprayNoticeIn <= 0) {
      this.sprayNoticeIn = 8;
      this.notice('spray', t.model.position, { key: 'sprayer', strength: 0.6 });
    }
    this.sprayView.setLight(1 - (this.daylight?.darkness ?? 0)); // the mist has its own colour, so it dims with the day
    this.sprayView.update(dt, { model: t.model, on: sp.spraying });
  }

  /** Enough of the field is sprayed: tick the job off the board (if it is on today) and the girls remark. */
  sprayDone() {
    if (this.jobBoard.complete('spray')) {
      this.hud.toast('Field sprayed. Ticked off the board on the barn door; fold the boom in', 4);
      this.jobBoardView.refresh();
      if (this.jobBoard.cleared) this.achievements.note('boardCleared');
    } else this.hud.toast('Field sprayed', 3);
    this.saySomethingAboutSpray('sprayDone');
  }

  /** The debug panel: set the sprayer to a point in the job. `what`: out, in, empty, fill, half, done, clear. */
  debugSpray(what) {
    const sp = this.spray;
    if (!sp) return;
    if (!this.jobBoard.has('spray') && (what === 'done' || what === 'half')) this.jobBoard.add('spray', FARM_JOBS.spray);
    if (what === 'out') sp.setBoom(true);
    else if (what === 'in') sp.setBoom(false);
    else if (what === 'empty') sp.tank = 0;
    else if (what === 'fill') sp.tank = 1;
    else if (what === 'clear') {
      sp.clear();
      this.sprayStarted = this.sprayEmptied = false;
    } else if (what === 'half') {
      for (let i = 0; i < sp.cells / 2; i++) {
        sp.dose[i] = 1;
        sp.state[i] = 1;
      }
      sp.started = true;
      sp.since ??= this.farm.day;
    } else if (what === 'done') {
      sp.sprayAll(this.farm.day);
      this.sprayDone();
    }
    this.sprayView.refresh();
  }

  // Making hay -----------------------------------------------------------------------

  /** The hay patch in the north field, its bales and the girls who carry them (world/haymaking.js, npc/hayLoading.js). */
  setUpHay() {
    const rect = this.world.layout.hayMeadow;
    if (!rect) return;
    this.hayParams = { ...DEFAULT_HAY_PARAMS };
    this.hay = new Haymaking({ rect, params: this.hayParams });
    this.hay.restore(this.farm.save?.hay, this.farm.day);
    this.hayView = new HayView({ scene: this.scene, hay: this.hay, heightAt: (x, z) => this.world.heightAt(x, z), random: createRandom(this.farmSeed ^ 0x4a17) });
    this.hayCapacity = 16;
    this.haySlots = trailerSlots(this.hayCapacity);
    this.hayLoading = new HayLoading();
    this.hayStack();
    if (this.jobBoard.has('hay')) this.hay.start();
    this.hayView.refresh();
    this.hayPhase = this.hay.phase;
    registerTuning('Haymaking', this.hayParams, HAY_PARAM_RANGES);
    registerTuning('Loading the hay', this.hayLoading.p, HAY_LOADING_PARAM_RANGES);
    this.interaction.add({
      target: this.hayView.loose,
      isAvailable: () => this.hay.phase === 'load' && !this.handsFull && !this.player.isRiding,
      prompt: () => this.hayBalePrompt(),
      feedback: 'pickUp',
      interact: () => this.heaveBale(),
    });
  }

  /** The bales in the Dutch barn's bay, as many as the farm has stacked there. */
  hayStack() {
    const open = this.siloRect;
    if (!open) return;
    this.hayView.setStack(open, this.hay.stacked, this.world.heightAt((open.minX + open.maxX) / 2, (open.minZ + open.maxZ) / 2));
  }

  /** The tractor mowing and baling as it drives over the patch, the stages moving on, and the trailer unloading at the barn. */
  updateHay(dt) {
    const hay = this.hay;
    this.hayLoading.update(dt);
    this.hayView.update(dt);
    const q = this.tractorUnit?.quad;
    const events = q ? hay.update(dt, { x: q.position.x, z: q.position.z, heading: q.yaw, speed: q.speed, working: q.engine.isRunning, day: this.farm.day }) : [];
    for (const e of events) {
      if (e.type === 'cut' || e.type === 'baled') this.hayView.repaint(e.cells);
      else if (e.type === 'bale') this.hayView.addLoose(e.bale);
    }
    if (hay.phase === 'stack' && this.siloRect) {
      const m = this.trailer.model.position;
      const done = hay.deliver(this.siloRect, { x: m.x, z: m.z, speed: Math.abs(this.trailer.signedSpeed) });
      if (done) {
        this.hayView.remove(done.ids);
        this.hayStack();
      }
    }
    if (hay.phase !== this.hayPhase) this.hayStageChanged(hay.phase);
  }

  /** Says the next thing to do when a stage is over, and ticks the job off at the end. */
  hayStageChanged(phase) {
    this.hayPhase = phase;
    if (phase === 'bale') {
      this.hud.toast('The patch is mown. Drive over the cut hay and the baler leaves bales behind you', 4);
      this.saySomethingAboutHay('hayCut');
    } else if (phase === 'load') {
      this.hud.toast('Bales made. Bring the trailer to them: the girls will carry them up, or press E to heave one on', 5);
      this.saySomethingAboutHay('hayBaled');
    } else if (phase === 'stack') {
      this.hud.toast('The trailer is loaded. Take it into the Dutch barn and stop', 4);
      this.saySomethingAboutHay('hayLoaded');
    } else if (phase === 'done') {
      this.achievements.note('hayMade');
      if (this.jobBoard.complete('hay')) {
        this.hud.toast('Hay stacked. Ticked off the board on the barn door', 3);
        this.jobBoardView.refresh();
        if (this.jobBoard.cleared) this.achievements.note('boardCleared');
      }
      this.saySomethingAboutHay('hayDone');
    }
  }

  /** One of the girls near the trailer says something about the hay (npc/hayLines.js). */
  saySomethingAboutHay(key) {
    const at = this.trailer.model.position;
    const c = this.companions
      .filter((g) => g.availability().canRemark && g.root.position.distanceTo(at) < 40)
      .sort((a, b) => a.root.position.distanceTo(at) - b.root.position.distanceTo(at))[0];
    c?.voice.say(key);
  }

  /** What the girls need to know to go and carry a bale (npc/hayLoading.js). */
  hayLoadContext() {
    const hay = this.hay;
    const t = this.trailer;
    const m = t.model.position;
    const near = hay.nearest(m.x, m.z, hay.p.trailerReach);
    return {
      ready: hay.canLoad(hay.freeSlot(this.hayCapacity) >= 0 ? 1 : 0) && !!near,
      at: near,
      girls: this.companions.map((c) => ({
        id: c.character.id,
        x: c.root.position.x,
        z: c.root.position.z,
        free: c.availability().free,
        weight: c.params.hayLoadWeight ?? 0,
      })),
    };
  }

  /** She takes the bale nearest her, carries it to the trailer's side and throws it up, a miss now and then (Jess's a lot more often than Amy's). */
  handleHayLoad(e) {
    if (!e) return;
    const c = this.companions.find((o) => o.character.id === e.girl);
    const hay = this.hay;
    const loading = this.hayLoading;
    const done = () => {
      c.release('hay');
      loading.finished(e.girl, c.params.hayCooldown);
    };
    const at = c.root.position;
    const bale = hay.nearest(at.x, at.z);
    const slotIndex = hay.freeSlot(this.hayCapacity);
    if (!bale || slotIndex < 0 || !hay.canLoad(1)) return loading.finished(e.girl, 0);
    hay.claim(bale.id, e.girl, slotIndex);
    c.hold('hay', 'carrying a bale to the trailer');
    const away = () => {
      hay.release(bale.id);
      done();
    };
    const d = Math.hypot(at.x - bale.x, at.z - bale.z) || 1;
    const spot = { x: bale.x + ((at.x - bale.x) / d) * 0.9, z: bale.z + ((at.z - bale.z) / d) * 0.9 };
    const reached = () => {
      const mesh = this.hayView.meshOf(bale.id);
      const started = mesh && c.startCarry('squareBale', mesh, carryWeight('squareBale'), {
        onLowered: (pos) => {
          hay.release(bale.id, pos); // she was called away: it is left where she stood
          this.hayView.putDown(hay.get(bale.id));
          done();
        },
        onRaised: () => this.hayCarryUp(c, bale, slotIndex, done),
      });
      if (!started) away();
    };
    if (!c.sneakTo(spot, reached, 2)) away();
  }

  /** She has the bale in her hands: to the trailer's side, opposite its slot, and up it goes. */
  hayCarryUp(c, bale, slotIndex, done) {
    const slot = this.haySlots[slotIndex];
    const side = slot.x >= 0 ? 1 : -1;
    const stand = this.trailer.body.localToWorld(new THREE.Vector3(side * 1.85, 0, slot.z));
    const arrive = () => {
      const slotAt = this.trailer.body.localToWorld(new THREE.Vector3(slot.x, slot.y, slot.z));
      if (Math.hypot(c.root.position.x - slotAt.x, c.root.position.z - slotAt.z) > 4) return c.dropCarry(); // the trailer has been driven off
      this.hayThrow(c, bale, slotIndex, done);
    };
    if (!c.carryTo({ x: stand.x, z: stand.z }, arrive)) c.dropCarry();
  }

  /** The bale leaves her hands: up onto the trailer, or short of it. */
  hayThrow(c, bale, slotIndex, done) {
    const hay = this.hay;
    const hand = c.root.localToWorld(new THREE.Vector3(-0.5, 1.05, 0.3));
    c.endCarry();
    if (Math.random() < c.params.hayMissChance) {
      const short = c.root.localToWorld(new THREE.Vector3(0, 0, 0.9));
      hay.release(bale.id, { x: short.x, z: short.z });
      this.hayView.putDown(hay.get(bale.id));
      c.voice.say('hayMiss', { urgent: true, force: true });
      return done();
    }
    this.hayView.throwOnto(bale, this.trailer.body, this.haySlots[slotIndex], this.hayParams.throwSeconds, hand, () => {
      hay.load(bale.id, slotIndex);
      c.voice.say('hayThrown', { urgent: true, chance: 0.5 });
    });
    done();
  }

  hayBalePrompt() {
    const m = this.trailer.model.position;
    const p = this.player.position;
    if (Math.hypot(p.x - m.x, p.z - m.z) > this.hayParams.playerReach) return { text: 'Hay bale   ·   bring the trailer closer to heave it on' };
    if (this.hay.freeSlot(this.hayCapacity) < 0) return { text: 'The trailer is full' };
    return 'Heave the bale onto the trailer';
  }

  /** E at a bale beside the trailer: you throw it up yourself. */
  heaveBale() {
    const hay = this.hay;
    const p = this.player.position;
    const m = this.trailer.model.position;
    if (Math.hypot(p.x - m.x, p.z - m.z) > this.hayParams.playerReach) return;
    const slotIndex = hay.freeSlot(this.hayCapacity);
    const bale = hay.nearest(p.x, p.z, 4);
    if (slotIndex < 0 || !bale) return;
    hay.claim(bale.id, 'you', slotIndex);
    const from = new THREE.Vector3(p.x, p.y - 0.4, p.z);
    this.hayView.throwOnto(bale, this.trailer.body, this.haySlots[slotIndex], this.hayParams.throwSeconds, from, () => hay.load(bale.id, slotIndex));
  }

  /** The debug panel: the cut hay grows back at once (as it does after regrowDays), the stack stays. */
  debugHayRegrow() {
    const hay = this.hay;
    hay.state.fill(0);
    hay.cutDay = null;
    hay.cut = 0;
    hay.baledCells = 0;
    this.hayView.refresh();
  }

  /** The debug panel: the barn's hay stack is taken away. */
  debugHayEmptyStack() {
    this.hay.stacked = 0;
    this.hayStack();
  }

  /** The debug panel: jump the job to a stage (cut, bale, load, stack, done) with what it needs in place. */
  debugHayStage(stage) {
    const hay = this.hay;
    if (!hay) return;
    if (!this.jobBoard.has('hay')) this.jobBoard.add('hay', FARM_JOBS.hay);
    if (!hay.active) hay.start();
    const order = ['cut', 'bale', 'load', 'stack', 'done'];
    const at = order.indexOf(stage);
    hay.state.fill(0);
    hay.bales.length = 0;
    this.hayView.reset();
    hay.cut = hay.made = hay.loaded = hay.delivered = 0;
    if (at >= 1) {
      hay.cut = hay.p.cutNeeded;
      for (let i = 0; i < hay.p.cutNeeded; i++) hay.state[i] = 1;
      this.hayView.refresh();
    }
    if (at >= 2) {
      for (let i = hay.made; i < hay.p.balesNeeded; i++) this.hayView.addLoose(hay.drop({ x: hay.rect.minX + 6 + i * 3, z: (hay.rect.minZ + hay.rect.maxZ) / 2, heading: 0 }));
    }
    if (at >= 3) {
      for (const b of hay.bales) {
        hay.load(b.id, hay.freeSlot(this.hayCapacity));
        this.hayView.seat(b, this.trailer.body, this.haySlots[b.slot]);
      }
    }
    if (at >= 4) {
      const done = hay.deliver({ minX: -1e9, maxX: 1e9, minZ: -1e9, maxZ: 1e9 }, { x: 0, z: 0, speed: 0 });
      if (done) this.hayView.remove(done.ids);
      this.hayStack();
    }
    this.hayStageChanged(hay.phase);
  }

  // Starting the generator --------------------------------------------------

  /** What a girl starting the generator needs to know (npc/generatorStart.js): the set, the dark, the charger and where the girls are. */
  generatorStartContext() {
    const g = this.generator;
    return {
      set: { running: g.running, fuel: g.fuel },
      dark: this.daylight?.darkness ?? 0,
      charging: this.charger.busy,
      at: this.generatorAt,
      girls: this.companions.map((c) => ({ id: c.character.id, x: c.root.position.x, z: c.root.position.z, free: c.availability().free, weight: c.params.generatorWeight ?? 0 })),
    };
  }

  /** She goes to the cord and pulls it, a few goes if it won't catch (a choice she made, or the debug panel's). */
  handleGeneratorStart(e) {
    if (!e) return;
    const c = this.companions.find((o) => o.character.id === e.girl);
    const m = this.generatorStart;
    const stand = this.world.layout.generator.stand;
    const tries = m.p.tries;
    const pullAgain = (n) => {
      const result = this.pullGenerator(c.character.id);
      if (result === 'caught') {
        c.voice.say('generatorCaught', { urgent: true, force: true });
        return m.finished();
      }
      if (result === 'dry' || n >= tries || this.generator.running || Math.hypot(c.root.position.x - stand.x, c.root.position.z - stand.z) > 3) return m.finished();
      c.voice.say('generatorCough', { urgent: true, chance: 0.7 });
      setTimeout(() => pullAgain(n + 1), m.p.tryGap * 1000);
    };
    const set = c.sneakTo(stand, () => {
      if (this.generator.running) return m.finished();
      m.started();
      pullAgain(1);
    }, tries * m.p.tryGap + 2);
    if (!set) m.finished();
  }

  /** Each frame: whether it's over, and which vehicle the light pool should favour. */
  updateWorkLight(dt) {
    if (!this.companions.length) return; // a game without the girls has nobody to bring a light
    const ctx = { dark: this.daylight?.darkness ?? 0, ...this.workLightContext(this.companions[0]) };
    for (const e of this.workLight.update(dt, ctx)) this.handleWorkLight(e);
    const job = this.workLight.job;
    this.lightingUnit = job ? this.units.find((u) => u.id === job.vehicle) ?? null : null;
  }

  fallingOutWheelOptions(c) {
    const fo = this.fallingOut;
    const id = c.character.id;
    if (!fo.active || fo.wantsToTell(id)) return [];
    const friend = this.companions.find((o) => o !== c);
    return [
      {
        label: "You're right",
        run: () => {
          if (!fo.sideWith(id)) return;
          this.favour.add(id, fo.p.sideFavour);
          if (friend) this.favour.add(friend.character.id, -fo.p.sideFavour);
          c.voice.say('sideThanks', { force: true });
        },
      },
      {
        label: 'Make it up',
        run: () => {
          const event = fo.nudge(id);
          if (event) this.handleFallingOut(event);
          else c.voice.say('nudged', { force: true });
        },
      },
    ];
  }

  /** Talking about you while they think you can't hear (npc/gossip.js). */
  updateGossip(dt, byId, speak) {
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      x: c.root.position.x,
      z: c.root.position.z,
      free: c.availability().free,
    }));
    const loud = this.menu.isOpen || this.units.some((u) => u.quad.engine.isRunning && girls.some((g) => Math.hypot(u.quad.position.x - g.x, u.quad.position.z - g.z) < this.gossip.p.noticeRange));
    const v = this.player.velocity;
    const ctx = { you: { x: this.player.position.x, z: this.player.position.z, onFoot: !this.player.isRiding, speed: Math.hypot(v.x, v.z) }, girls, loud, floorFree: this.talkFloor.left <= 0 && !this.banter.busy };
    for (const e of this.gossip.update(dt, ctx, speak, () => this.companions.forEach((c) => c.voice.cut()))) {
      byId[e.girl]?.voice.say('gossipCaught', { urgent: true, force: true });
    }
  }

  /**
   * The time of day moving on (world/daylight.js): the temperature with it, so the frost on the ground and the seats forms as the night
   * cools and thaws as the morning warms. The sky follows in world.update.
   */
  updateDaylight(dt) {
    const d = this.daylight;
    if (!d) return;
    d.update(dt);
    const w = this.weather;
    w.temperature = Math.round(d.temperature(w.peak) * 10) / 10;
    w.sunUp = d.sun.light;
    w.dark = d.darkness; // for what the girls say about it (companionVoice.watchWeather)
    for (const unit of this.units) {
      unit.quad.dayFrost = w.seatFrost;
      // A girl driving a cab in the dark puts its lights on.
      const q = unit.quad;
      if (q.lights && q.lights.mode === 'off' && d.darkness > 0.5 && this.companions.some((c) => c.quad === q && c.fsm.is('driving'))) q.lights.set('low');
    }
    const turn = this.forecast.update(d.hour);
    if (turn) this.turnWeather(turn);
    this.station.update(d.hour, w.temperature, w.kind, w.rain, w.target, w.from, w.mix);
    this.station.setForecast(this.forecast.board(d.hour));
    const board = this.boardUnit ?? this.player.vehicle?.unit ?? null;
    this.vehicleLights.update(this.units, this.camera.position, board, this.lightingUnit ?? null, d.darkness);
  }

  /** The weather turns to another kind (forecast.js): the sky eases across, the rain follows and the day's warmest moves; the girls notice. */
  turnWeather(turn) {
    const seconds = (this.forecastParams.shiftHours * 3600) / this.daylight.p.clockRate;
    const warmth = ((KIND_WARMTH[turn.to] ?? 0) - (KIND_WARMTH[turn.from] ?? 0)) * this.forecastParams.tempShiftScale;
    this.weather.beginShift(turn.to, seconds, { warmth, note: { ...turn } });
    console.info(`The weather turns from ${turn.from} to ${turn.to} (${turn.told ? 'as the board said' : 'not on the board'}) over ${Math.round(seconds)} s`);
  }

  /** Turns the weather now, as it would at its time (the debug panel and the console). Returns false if this kind has nowhere to turn. */
  turnWeatherNow() {
    const turn = this.forecast.turnNow(this.weather.kind, this.daylight.hour, this.forecastRandom);
    if (!turn) return false;
    this.turnWeather(turn);
    return true;
  }

  /**
   * The wind (world/wind.js): ticks the day's wind and gusts, leans the hedges and trees with it, swings the hay door's shutter (a bang
   * when it slams, which the girls hear) and now and then blows loose hay out of the loft door.
   */
  updateWind(dt) {
    const wind = this.wind;
    wind.update(dt, this.weather.wind);
    const p = wind.p;
    windUniforms.uWindDir.value = [Math.sin(wind.heading), Math.cos(wind.heading)];
    windUniforms.uWindPush.value = wind.strength;
    windUniforms.uWindTime.value += dt;
    swayMetres.hedge.value = p.swayHedge;
    swayMetres.tree.value = p.swayTree;
    const barn = this.world.props?.barn;
    if (!barn?.shutter) return;
    const OUT = Math.PI / 2; // the hay door looks east: out of it is +x
    const bang = this.shutter.update(dt, wind.along(OUT));
    barn.shutter.rotation.y = -this.shutter.angle;
    this.shutterBangCool = Math.max(0, this.shutterBangCool - dt);
    if (bang && this.shutterBangCool <= 0) {
      this.shutterBangCool = 3;
      this.doorAudio.bang(bang.strength);
      this.notice('bang', { x: barn.hayDoor.x + 0.3, y: barn.hayDoor.y + 0.7, z: barn.hayDoor.z }, { key: 'shutter', strength: 0.6 * bang.strength });
    }
    if (wind.hayBlows(OUT)) this.blowHay();
    this.hayBlow.update(dt);
  }

  /** Loose hay lifted off the loft floor and out of the hay door on a strong gust, to land in the yard downwind. */
  blowHay() {
    const door = this.world.props.barn.hayDoor;
    const wind = this.wind;
    const len = Math.max(0.1, Math.hypot(wind.x, wind.z));
    const to = { x: door.x + (wind.x / len) * 8, y: door.y, z: door.z + (wind.z / len) * 8 };
    this.hayBlow.drop({ x: door.x + 0.2, y: door.y + 0.3, z: door.z }, to, this.world.heightAt(to.x, to.z));
  }

  /** Rain round you and its sound, and the wind on the exhaust smoke. */
  updateWeather(dt) {
    const w = this.weather;
    if (this.world.streamEvent) {
      // The stream came up or went back down: whoever is stood about near you says so.
      const near = this.companions.filter((c) => c.availability().canRemark && c.root.position.distanceTo(this.camera.position) < 40);
      near[Math.floor(Math.random() * near.length)]?.voice.say(this.world.streamEvent === 'up' ? 'streamUp' : 'streamDown', { chance: 0.85 });
    }
    const cam = this.camera.position;
    const world = this.world;
    // The barn: no rain under its roof, the drumming of it on the tin, a dimmer light inside with the bulb on, and a room's echo.
    const indoor = world.indoor(cam.x, cam.z);
    this.updateWind(dt);
    const wind = this.wind;
    this.rain.wind = { x: wind.x, z: wind.z };
    this.snow.wind = { x: wind.x, z: wind.z };
    this.rain.update(dt, this.camera, w.rain, 1, (x, z) => world.covered(x, z));
    this.snow.update(dt, this.camera, w.snow, 1, (x, z) => world.covered(x, z));
    this.updateLeafFall(dt);
    this.audioHub.setRain(w.rain, indoor, world.barnParams);
    this.updateStorm(dt, indoor);
    this.audioHub.room ??= { inside: (x, z) => world.inBarn(x, z), params: world.barnParams, listenerIn: false };
    this.audioHub.room.listenerIn = world.inBarn(cam.x, cam.z);
    const barn = world.props?.barn;
    if (barn) {
      world.sky.hemi.intensity *= 1 - 0.55 * indoor;
      const gloom = Math.min(1, 1.3 - w.warmth * 0.9);
      // After dark the bulb is left on, so the barn glows from outside too.
      const dark = this.daylight?.darkness ?? 0;
      // The bulb and the light work off the generator (items/generator.js): with it off the barn is as dark as the day makes it.
      const lit = this.generator.powered;
      barn.light.intensity = lit ? BARN_BULB * Math.max(indoor * gloom, dark > 0.5 ? 0.8 : 0) : 0;
      if (barn.light2) barn.light2.intensity = barn.light.intensity;
      if (this.bulbLit !== lit) {
        this.bulbLit = lit;
        barn.bulb.material.color.setHex(lit ? 0xfff1c9 : 0x5d5c55);
        barn.bulb2?.material.color.setHex(lit ? 0xfff1c9 : 0x5d5c55);
      }
    }
    // Smoke, steam, dust and mud are drawn with their own fixed light, so they're dimmed with the daylight or they'd glow at night.
    const light = this.daylight ? this.daylight.p.nightLight + (1 - this.daylight.p.nightLight) * this.daylight.sun.light : 1;
    const dim = (m, name) => {
      const u = m?.uniforms?.[name];
      if (!u) return;
      m.userData.baseLight ??= u.value.clone();
      u.value.copy(m.userData.baseLight).multiplyScalar(light);
    };
    dim(this.bonfireView?.smoke.material, 'uLight');
    dim(this.hutHost?.view?.smoke.material, 'uLight');
    dim(this.generatorSmoke?.material, 'uLight');
    for (const unit of this.units) {
      for (const fx of [unit.smoke, unit.steam, unit.heatSteam]) dim(fx?.material, 'uLight');
      dim(unit.dustCloud?.material, 'uColor');
      dim(unit.mud?.spray?.material, 'uLight');
      const s = unit.smoke.params;
      s.windX = wind.x;
      s.windZ = wind.z;
      if (unit.dustCloud) unit.dustCloud.wind = { x: wind.x, z: wind.z };
      // A pop's flash from the pipe shows in poor light: none on a sunny day, plenty under heavy cloud.
      unit.smoke.darkness = Math.max(0, Math.min(1, 1 - w.warmth * 1.3));
    }
    const tint = (m, hex) => m?.color.setHex(hex).multiplyScalar(light);
    for (const layer of [this.hazeLayer, this.barnFumesLayer, this.mistLayer]) for (const b of layer?.blobs ?? []) tint(b.sprite.material, 0xaeb9c8);
    tint(this.rain.lines?.material, 0xc4ccd2);
    tint(this.snow.points?.material, 0xf2f5f8);
  }

  /**
   * A thunderstorm (world/thunder.js): lightning lights the sky, thunder follows and the girls hear it. Amy won't ride in one (she gets off
   * a quad stood still and says so); Jess would. Nothing is ever hit.
   */
  updateStorm(dt, indoor) {
    const storm = this.weather.storm;
    for (const e of this.thunder.update(dt, storm)) {
      if (e.type !== 'thunder') continue;
      const loud = Thunderstorm.loudness(e.strike.distance, this.thunderParams);
      const cracks = Thunderstorm.cracks(e.strike.distance, this.thunderParams);
      this.thunderAudio?.rumble(loud, cracks, indoor);
      // It comes from the whole sky, so it is placed where you are; how near the strike was is its strength.
      this.notice('thunder', this.camera.position, { key: 'thunder', strength: loud * 1.4 });
      const near = this.companions.filter((c) => c.availability().canRemark);
      near[Math.floor(Math.random() * near.length)]?.voice.say(cracks ? 'thunderClose' : 'thunderFar', { chance: cracks ? 0.8 : 0.3 });
    }
    const f = this.thunder.flash;
    if (f > 0.002) {
      // The whole sky and everything under it lit at once, less in the barn.
      const k = f * (1 - 0.8 * indoor);
      const sky = this.world.sky;
      sky.hemi.intensity += 2.5 * k;
      sky.sun.intensity += 2 * k;
      this.renderer.toneMappingExposure *= 1 + 0.5 * k;
      for (const c of [sky.scene.fog.color, sky.scene.background]) c.lerp(this.flashWhite, 0.5 * k);
      for (const u of [sky.uniforms.horizonColor, sky.uniforms.zenithColor]) u.value.lerp(this.flashWhite, 0.6 * k);
    }
    for (const c of this.companions) {
      c.inStorm = storm > 0.5;
      // Amy gets off a quad she is sat on, stood still, once; she won't be on one in this.
      if (c.inStorm && c.refusesStorm() && c.fsm.is('seated') && c.quad && c.quad.speed < 1) {
        if (!c.stormTold) {
          c.stormTold = true;
          c.voice.say('stormGetOff', { urgent: true, chance: 1 });
          c.requestStandBeside(c.quad);
        }
      } else if (!c.inStorm) {
        c.stormTold = false;
      }
    }
  }

  /** A strike of lightning now (the debug panel and the console): `distance` metres off, or at random. */
  strikeNow(distance) {
    return this.thunder.strike(distance);
  }

  /** Carrying the can, the hose, the toolbox or the winch hook. */
  /** Whichever jerry can you're holding, else the red petrol one. */
  get can() {
    return this.premixCan?.held ? this.premixCan : this.dieselCan?.held ? this.dieselCan : this.petrolCan;
  }

  /** Pouring this can into that quad is a mistake: 'straight' petrol in a two-stroke, 'premix' in a four-stroke. */
  mixWrongFor(quad, can) {
    if (quad.engine.params.petrolFussy) return can.diesel < 0.95 ? 'petrol' : null; // the UTV is a diesel too, but fussy about it
    if (quad.engine.params.runsOnDiesel) return null; // the tractor takes red diesel; what else goes in it isn't modelled
    if (can.diesel > 0.05) return 'diesel';
    if (quad.engine.params.strokes === 2) return can.oil < 0.002 ? 'straight' : null;
    return can.oil > 0.004 ? 'premix' : null;
  }

  get handsFull() {
    return this.petrolCan.held || this.premixCan.held || this.dieselCan.held || this.hose.held || this.toolbox.held || this.leads.held || this.oilBottle.held || this.coolantBottle.held || this.antiGelBottle.held || this.feedBucket.held || !!this.heldBrushwood || !!this.heldWood || !!this.heldBattery() || this.winch?.state === 'carried' || this.chain?.state === 'carried' || this.towRope?.state === 'carried';
  }

  /** The debug panel's winch button: the green's winch onto this vehicle (or, on the green itself, onto the nearest tree), or off again. */
  debugWinch(unit) {
    const w = this.winch;
    if (!w) return 'No winch in this game';
    const onIt = unit === w.unit ? !!w.anchor : w.target === unit.quad;
    if (w.state === 'hooked' && onIt) {
      w.stow();
      return 'Winch off';
    }
    w.stow();
    w.take(this.camera);
    if (unit !== w.unit) {
      w.hookOn(unit.quad);
      return `Winch hooked on the ${unit.label}${w.selfPull ? `: the ${w.unit.label} pulls itself up to it` : ''}`;
    }
    const at = w.quad.position;
    const tree = w.anchors.map((a) => ({ a, d: Math.hypot(a.x - at.x, a.z - at.z) })).sort((p, q) => p.d - q.d)[0];
    if (!tree || tree.d > 30) {
      w.stow();
      return 'No tree within 30 m';
    }
    w.hookTree(tree.a);
    return `Winch hooked on a tree ${Math.round(tree.d)} m away`;
  }

  /** The debug panel's tow rope button: hook the rope from the nearest utility quad onto this vehicle, or take it off again. */
  debugTowRope(unit) {
    const r = this.towRope;
    if (r.state === 'hooked' && r.target === unit.quad) {
      r.stow();
      return 'Tow rope off';
    }
    const near = this.units
      .filter((u) => u !== unit && this.ropeQuadFor(u))
      .map((u) => ({ u, d: u.quad.position.distanceTo(unit.quad.position) }))
      .sort((a, b) => a.d - b.d)[0];
    if (!near || near.d > 8) return 'No utility quad within 8 m to tow it with';
    r.stow();
    r.take(this.camera, near.u.quad);
    r.hookOn(unit.quad);
    return `Tow rope from the ${near.u.label} to the ${unit.label}`;
  }

  /** A quad that carries the tow rope on its rack: a utility quad, not the green (its X is the winch) and not the tractor or the Land Rover. */
  ropeQuadFor(unit) {
    return !!unit && unit !== this.winch?.unit && !unit.spec.tractor && !unit.spec.landRover && !unit.spec.car && !unit.spec.utv && !!unit.quad.mugAnchor;
  }

  /** The tow rope: it comes out of your hand if you go further than it reaches, or when you get on something; a snatch makes her on the dead quad shout. */
  updateTowRope() {
    const r = this.towRope;
    if (r.state === 'carried' && this.player.isRiding) r.stow();
    if (r.state === 'carried' && r.distanceFrom(this.player.position) > r.params.reach) {
      r.stow();
      this.hud.toast('The rope won\'t reach any further: the hook pulled out of your hand');
    }
    r.update();
    for (const e of r.events.splice(0)) {
      const girl = this.companions.find((c) => c.fsm.is('driving') && c.quad === r.target && c.drive?.towing);
      if (girl && e === 'snatch') girl.driveEvents.push('snatch');
    }
  }

  /** The tow chain: it comes out of your hand if you go further than it reaches, or when you get on something. */
  updateChain() {
    const c = this.chain;
    if (!c) return;
    if (c.state === 'carried' && this.player.isRiding) c.stow();
    if (c.state === 'carried' && c.distanceFrom(this.player.position) > c.params.length) {
      c.stow();
      this.hud.toast('The chain won\'t reach any further: the hook pulled out of your hand');
    }
    c.update();
  }

  /** The winch: the cable's reach, and winding in while X is held by the green (or on it). */
  updateWinch(dt = 0) {
    const w = this.winch;
    if (!w) return;
    if (w.state === 'carried' && this.player.isRiding) w.stow();
    if (w.state === 'carried' && w.distanceFrom(this.player.position) > w.params.length) {
      w.stow();
      this.hud.toast('The winch cable won\'t reach any further: the hook pulled out of your hand');
    }
    const onIt = this.boardUnit === w.unit;
    const near = !this.player.isRiding && w.distanceFrom(this.player.position) < w.params.remoteReach;
    this.winchReel = w.state === 'hooked' && (onIt || near) && !this.menu.isOpen && this.input.isDown('KeyX');
    w.update(dt);
  }

  /** The trunk you are looking at while you hold the winch hook (or have it on a tree), if any. */
  winchTreeLooked() {
    const w = this.winch;
    if (!w || this.player.isRiding || !(w.state === 'carried' || w.anchor)) return null;
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    return pickTree(w.anchors, origin, dir, 6);
  }

  /** Off the back: only once she's stopped (or nearly). */
  getOffBack() {
    const quad = this.boardUnit.quad;
    if (quad.speed > this.player.params.dismountSpeed) {
      this.hud.toast('Ask her to stop first');
      return false;
    }
    // Out of the 200TDi's back by the door you'd have come in by, its front seat tipping as you go.
    const backDoor = quad.rearSeats?.includes(this.player.benchSeat) ? rearDoor(this.player.benchSeat, !!(quad.driver || quad.rider)) : null;
    if (backDoor) quad.tipHold[backDoor] = this.rearAccess.holdSeconds;
    const spot = this.findDismountSpot(
      quad,
      quad.hasBench
        ? benchDismountSpots(backDoor === 'driver' && quad.driverStand ? quad.driverStand : quad.benchStand)
        : [
            [1.05, -0.6],
            [-1.05, -0.6],
            [0, -1.9],
          ],
    );
    if (!spot) {
      this.hud.toast('No room to get off here');
      return false;
    }
    const slot = this.benchMountOf(quad)?.slots[this.player.benchSeat];
    if (slot?.girl === YOU_ABOARD) slot.girl = null;
    quad.passenger = null;
    this.player.dismount(spot, quad.yaw + Math.PI);
    return true;
  }

  /** Enter this frame, unless the end of the day is on screen (it dismisses that). */
  talkPressed(input) {
    return input.wasPressed('Enter') && !this.dayRecap.active && !this.dayFade.active;
  }

  /** The girl in the middle of your view, near enough to talk to, whatever you are on (the ground's interactables are cleared on a quad). */
  lookedGirl() {
    const it = this.interaction.update(this.player, this.player.params.interactRange, (i) => i.person);
    this.interaction.clear();
    return it?.person ?? null;
  }

  /** Your own wheel: what you ask for rather than ask of her. Enter looking at nobody. */
  openYourWheel() {
    const ridden = this.player.isRiding && this.player.seat !== 'pillion' ? this.riddenUnit : null;
    const runs = { climb: () => this.askForClimb(), pit: () => this.askForPit(), cones: () => this.askForCones(), drag: () => this.askForDrag(ridden), race: () => this.askForRace(ridden) };
    this.openWheel('You ask for', yourAsks({ riding: !!ridden, near: ridden ? this.askNear(ridden) : {} }).map((a) => ({ ...a, run: runs[a.id] })));
    this.player.lookEnabled = false;
    this.player.moveEnabled = false;
  }

  /** Your menu riding on the back: talk to her about the ride. */
  openPassengerMenu() {
    const c = this.herAtTheFront(this.boardUnit.quad) ?? this.herOn(this.boardUnit.quad);
    if (!c) return void this.openYourWheel(); // sat on the back by yourself: nobody to talk to, E gets you off
    const quad0 = this.boardUnit.quad;
    this.passengerHer = c; // who any plan below is with, even once she's off the front
    const drive = c.fsm.is('driving') ? c.drive : null;
    const stopped = !drive || drive.phase === 'parked' || drive.done;
    const actions = [];
    const ask = (kind, label, run) => actions.push({ kind, label, run: () => (run(), c.voice.onRequest(kind)) });
    if (stopped) ask('letMeOff', 'I\'ll get off here', () => this.getOffBack());
    else ask('letMeOff', 'Let me off', () => ((this.passengerPlan = 'off'), drive.pullUp()));
    if (drive && !stopped) {
      ask('stopHere', 'Stop here', () => drive.pullUp());
      ask('slower', 'Slow down a bit', () => drive.setCruiseScale(drive.cruiseScale * 0.75));
      ask('faster', 'Go a bit faster', () => drive.setCruiseScale(drive.cruiseScale * 1.25));
    }
    if (drive && drive.phase === 'parked') ask('goAgain', 'Off we go again', () => drive.resume());
    if (c.fsm.is('driving') && !quad0.hasBench) ask('swap', 'Let me drive', () => ((this.passengerPlan = 'swap'), drive?.pullUp()));
    // Advice that fits what she's just got wrong (or is about to): only those are on the wheel.
    const coaching = drive && !stopped ? drive.coachable() : [];
    if (coaching.length) actions.push({ label: 'Coach her', children: coaching.map((key) => ({ label: COACHING[key].label, run: () => this.coachHer(c, key) })) });
    this.openWheel(`Ask ${c.name} to`, actions, c);
    this.player.lookEnabled = false;
    this.player.moveEnabled = false;
  }

  /** You tell her how to do something from the back. She learns if it's the right moment; at the wrong one, or again too soon, she doesn't. */
  coachHer(c, key) {
    this.applyCoaching(c, key, true);
  }

  /**
   * Coaching lands on her by the same rules whoever gives it. `byYou` earns or costs you her favour; when the other girl
   * coaches her there's no favour, and the driver answers after the coach has finished speaking.
   */
  applyCoaching(c, key, byYou) {
    const { skill } = COACHING[key];
    const id = c.character.id;
    const fitting = !!c.drive?.isMoment(skill);
    const result = this.skills.coach(id, skill, fitting);
    const say = (situation) => (byYou ? c.voice.say(situation, { force: true }) : setTimeout(() => c.voice.say(situation, { force: true }), 2500));
    if (result === 'taught') {
      if (byYou) this.favour.add(id, this.skills.p.taughtFavour);
      // She does it right away where she can.
      if (skill === 'choke' && c.quad.choke > 0) c.quad.choke = 0;
      if (skill === 'mud' && c.drive) c.drive.boost = 2;
      say(`taught_${skill}`);
    } else if (result === 'nagged') {
      if (byYou) this.favour.add(id, this.skills.p.nagFavour);
      say('coachNagged');
    } else {
      say('coachWrongTime');
    }
  }

  /** A girl on the back of a quad the other girl is driving coaches her, and it teaches by the same rules as yours. */
  updatePillionCoach(dt) {
    let share = null;
    for (const driver of this.companions) {
      if (!driver.fsm.is('driving') || !driver.drive || driver.drive.done || driver.drive.phase === 'stop') continue;
      const coach = this.companions.find((o) => o !== driver && o.quad === driver.quad && o.fsm.is('seated') && o.seatKind === 'pillion');
      if (coach) share = { coach: coach.character.id, driver: driver.character.id, moments: driver.drive.coachable(), from: coach, to: driver };
      break;
    }
    for (const e of this.pillionCoach.update(dt, share)) {
      share.from.voice.say(`coachGive_${e.key}`, { force: true });
      this.applyCoaching(share.to, e.key, false);
    }
  }

  // Driving lessons ---------------------------------------------------------

  /** The girls sat on the back of the manual quad you are driving (the only ones who can teach you). */
  lessonGirls(ridden) {
    const q = ridden?.quad;
    if (!q?.manual) return [];
    return this.companions.filter((c) => c.quad === q && c.fsm.is('seated') && c.seatKind === 'pillion').map((c) => c.character.id);
  }

  /** What the drivetrain is doing now, for a lesson to judge (npc/lessons.js). */
  lessonSample(ridden) {
    const q = ridden?.quad;
    if (!q?.manual) return null;
    const d = q.drivetrain;
    const ip = q.engine.params;
    return {
      running: q.engine.isRunning,
      gear: d.gear,
      pedal: d.pedal,
      clutch: d.clutch,
      throttle: q.throttle,
      speed: q.forwardSpeed,
      climb: q.climb,
      revs: Math.max(0, (q.engine.rpm - ip.idleRpmWarm) / (ip.maxRpm - ip.idleRpmWarm)),
    };
  }

  updateLessons(dt, ridden) {
    for (const e of this.lessons.update(dt, { girls: this.lessonGirls(ridden), sample: this.lessonSample(ridden) })) this.handleLessonEvent(e);
  }

  /** The lessons she could offer now, as offers for this girl (npc/lessons.js). */
  lessonOffers(id, ridden) {
    return this.lessons.offers({ girls: this.lessonGirls(ridden) }).filter((o) => o.girl === id).map((o) => ({ ...o, take: () => this.handleLessonEvent(this.lessons.take(o)) }));
  }

  /** Says what a lesson event means (the words are the girl's; passing a drill is worth her favour, finishing them all more). */
  handleLessonEvent(e) {
    const c = this.companions.find((o) => o.character.id === e.girl);
    if (!c) return;
    const say = (situation) => c.voice.say(situation, { force: true });
    const p = this.lessons.p;
    if (e.type === 'begin') say('lessonBegin');
    else if (e.type === 'set') say(`lessonSet_${e.drill}`);
    else if (e.type === 'nudge') say('lessonNudge');
    else if (e.type === 'good') say(`lessonGood_${e.drill}`);
    else if (e.type === 'bad') say(`lessonBad_${e.why}`);
    else if (e.type === 'passed') {
      this.favour.add(e.girl, p.passFavour);
      this.hud.toast(`${c.name}: ${DRILLS[e.drill].label}, passed`);
      if (!this.lessons.graduated[e.girl]) say(`lessonPassed_${e.drill}`);
    } else if (e.type === 'graduated') {
      this.favour.add(e.girl, p.graduateFavour);
      if (e.girl === 'amy') this.achievements.note('amysTest');
      say('lessonDone');
    } else if (e.type === 'end') {
      if (e.why === 'gaveUp') say('lessonGiveUp');
      else if (e.why === 'long') say('lessonBye');
    }
  }

  /** Things you asked for on the back that wait until she's stopped. */
  updatePassenger() {
    const unit = this.boardUnit;
    if (!unit || this.player.seat !== 'pillion' || !this.passengerPlan) return;
    const quad = unit.quad;
    if (quad.speed > 0.3) return;
    const c = this.passengerHer;
    if (this.passengerPlan === 'off') {
      if (this.getOffBack()) this.passengerPlan = null;
    } else if (this.passengerPlan === 'swap') {
      // She gets off the front, then hops on the back once you've slid forward.
      if (c.fsm.is('driving')) {
        c.stopDriving('off', () => c.requestMount(quad));
        return;
      }
      if (c.quad === quad && c.fsm.is('dismounting')) return;
      quad.passenger = null;
      this.player.seat = 'rider';
      quad.setRider(this.player, this.input);
      this.passengerPlan = null;
    }
  }

  /** The quad the player is looking at on foot, if any. */
  get focusedUnit() {
    return this.interaction.focused?.unit ?? null;
  }

  /** The quad the HUD and tuning panel should describe: ridden, else looked at, else the last one. */
  inspectedUnit() {
    return this.riddenUnit ?? this.focusedUnit ?? this.lastUnit;
  }

  // Who you favour ----------------------------------------------------------

  /** Whichever girl likes this quad best is pleased you're on it, or washing it. */
  favourQuad(unit, amount) {
    for (const c of this.companions) if (c.voice.favourite === unit.spec.id) this.favour.add(c.character.id, amount);
  }

  /** What there is to take you to see now (npc/sights.js): a gate left open, the view up the hill, a quad left running that isn't hers. */
  sightsFor(girl) {
    const hill = this.world.fields?.hill;
    const running = [];
    for (const unit of this.girlUnits) {
      const q = unit.quad;
      const who = this.leftRunning?.culprit(unit.id);
      if (!who || q === girl.quad || q.rider || q.driver || q.passenger || !unit.engine.isRunning) continue;
      running.push({ x: q.position.x, z: q.position.z, line: leftRunningSituation(who, this.leftRunning.times(who), this.leftRunning.p) });
    }
    return {
      gates: gatesFoundOpen(this.world.props?.gates ?? []),
      view: hill?.waitSpot ? { x: hill.waitSpot.x, z: hill.waitSpot.z, look: { x: hill.waitSpot.x, z: hill.waitSpot.z + 50 } } : null,
      running,
    };
  }

  /** Each frame: who's at the controls of each quad (you, or a girl's id), and the wear that lands on them. */
  updateWearLedger(dt) {
    this.wearLedger ??= new WearLedger();
    this.leftRunning ??= new LeftRunning();
    this.drivers = new Map();
    for (const unit of this.girlUnits) {
      const girl = this.companions.find((c) => c.fsm.is('driving') && c.quad === unit.quad);
      const who = unit === this.riddenUnit ? 'you' : girl ? girl.character.id : null;
      if (who) this.drivers.set(unit, who);
      this.wearLedger.record(unit.id, unit.engine.wear, who);
      // A girl having a go at starting it has it too, so when she wanders off the blame is hers.
      const starter = this.companions.find((c) => c.fsm.is('starting') && c.quad === unit.quad);
      const q = unit.quad;
      this.leftRunning.record(unit.id, dt, {
        running: unit.engine.isRunning,
        attended: !!(q.rider || q.driver || q.passenger || starter),
        who: who ?? starter?.character.id ?? null,
      });
    }
  }

  /**
   * A girl who got a sick quad going (npc/keepAlive.js) goes and sits on the back of it, instead of switching it off, while it runs with nobody
   * on it. `forced` sends her whatever she thinks of it. Returns whether she set off.
   */
  sendToKeepAlive(c, unit, forced = false) {
    const q = unit.quad;
    if (!c.fsm.is('idle') || !q.engine.isRunning || q.rider || q.driver || q.passenger || q.isTipped || !c.canRidePillion(q)) return false;
    if (forced) q.startTrouble = Math.max(q.startTrouble, this.keepParams.hardStartCranks);
    else if (!c.keepAlive.wouldGo({ sick: c.quadSickness(q).sick, running: true, unattended: true, distance: c.root.position.distanceTo(q.position) })) return false;
    c.requestMount(q);
    return true;
  }

  /** Each frame: the girl who last had a sick, running quad with nobody on it may go and sit on it to keep it going. */
  updateKeepAlive(dt) {
    for (const unit of this.girlUnits) {
      const q = unit.quad;
      const starting = this.companions.some((c) => c.fsm.is('starting') && c.quad === q);
      if (!unit.engine.isRunning && !starting) q.startTrouble = 0; // a hard start only counts while it is still running from it
    }
    if (this.menu.isOpen) return;
    for (const c of this.companions) {
      c.keepAlive.cool(dt);
      if (!c.fsm.is('idle') || Math.random() >= this.keepParams.goChance * dt) continue;
      const unit = this.girlUnits.find((u) => this.leftRunning.lastWho.get(u.id) === c.character.id);
      if (unit) this.sendToKeepAlive(c, unit);
      else if (Math.random() < (c.character.id === 'jess' ? this.keepParams.chargeGoJess : 1)) {
        // A running quad with a weak battery and nobody on it (after a jump, say) wants its revs kept up by whoever is free: Amy mostly.
        const weak = this.girlUnits.find((u) => u.engine.isRunning && u.engine.battery < this.keepParams.weakBatteryBelow && c.root.position.distanceTo(u.quad.position) <= this.keepParams.goRange);
        if (weak) this.sendToKeepAlive(c, weak);
      }
    }
  }

  /** Each frame: a parked quad with a sticky float and the tap on drips petrol (vehicle/carbDrip.js), leaving a damp patch and a flooded carb. */
  updateCarbDrip(dt) {
    for (const unit of this.units) {
      if (!this.carbDrip.state.has(unit.id)) continue;
      const q = unit.quad;
      const starter = this.companions.some((c) => c.fsm.is('starting') && c.quad === q);
      const parked = !unit.engine.isRunning && !(q.rider || q.driver || q.passenger || starter);
      const res = this.carbDrip.update(unit.id, dt, { parked, tapOpen: q.fuel.tap !== 'off', litres: q.fuel.litres });
      q.fuel.litres -= res.lost;
      if (parked) unit.engine.fouling = Math.max(unit.engine.fouling, this.carbDrip.floodFouling(unit.id));
      let patch = this.dripPatches.get(unit.id);
      if (res.stuck && q.position.distanceTo(this.player.position) < 12) this.discoveries.learn('carbDrip');
      if (!patch && (res.stuck || this.carbDrip.puddle(unit.id) > 0)) {
        patch = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a2418, roughness: 0.15, transparent: true, opacity: 0.65, depthWrite: false }));
        patch.renderOrder = 1;
        this.scene.add(patch);
        this.dripPatches.set(unit.id, patch);
      }
      if (!patch) continue;
      if (res.stuck) patch.position.set(q.position.x, this.world.heightAt(q.position.x, q.position.z) + 0.03, q.position.z); // where it started to drip
      const size = this.carbDrip.puddle(unit.id);
      patch.visible = size > 0.01;
      patch.scale.setScalar(0.15 + 0.85 * size);
    }
  }

  /** Each frame: a leaking radiator leaves a damp patch under a parked water-cooled quad (engine/coolant.js), where it first showed. */
  updateCoolantLeak(dt) {
    for (const unit of this.units) {
      if (!unit.engine.params.waterCooled) continue;
      const q = unit.quad;
      const size = unit.engine.coolantPuddle;
      let patch = this.coolantPatches.get(unit.id);
      if (!patch && size > 0) {
        patch = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4f7a4a, roughness: 0.1, transparent: true, opacity: 0.4, depthWrite: false }));
        patch.renderOrder = 1;
        patch.userData.fresh = true;
        this.scene.add(patch);
        this.coolantPatches.set(unit.id, patch);
      }
      if (!patch) continue;
      // It drips where it stands, so the patch follows a parked quad while it's small and stays put once it's grown.
      if (size < 0.1 && !unit.engine.isRunning) patch.position.set(q.position.x, this.world.heightAt(q.position.x, q.position.z) + 0.03, q.position.z);
      patch.visible = size > 0.01;
      patch.scale.setScalar(0.12 + 0.7 * size);
    }
  }

  /** Each frame: scores fade, and the girl giving you a ride earns it while her friend, left on foot, notices. */
  updateFavour(dt, ridden) {
    this.favour.update(dt);
    const driver = ridden && this.player.seat === 'pillion' ? this.companions.find((c) => c.fsm.is('driving') && c.quad === ridden.quad) : null;
    if (!driver) return;
    this.favour.add(driver.character.id, this.favour.p.ridePerSecond * dt);
    for (const c of this.companions) if (c !== driver && c.fsm.is('idle', 'walking')) this.favour.add(c.character.id, -this.favour.p.ignoredPerSecond * dt);
  }

  // The hayloft ---------------------------------------------------------------

  youOnLoft() {
    const p = this.player.position;
    return onLoft(this.world.layout, p.x, p.y, p.z, this.loft.top - this.world.layout.loft.floor);
  }

  /** Up or down the ladder, whichever you're at the foot or top of. */
  startClimb() {
    if (this.climb || this.player.isRiding) return;
    const up = !this.youOnLoft();
    if (up) this.achievements.note('loft');
    const p = this.player.position;
    const lf = this.loft;
    const from = { x: p.x, y: p.y, z: p.z };
    const top = { x: lf.ladderTop.x, y: lf.top, z: lf.ladderTop.z };
    const foot = { x: lf.ladderFoot.x - 0.1, y: lf.ladderFoot.y, z: lf.ladderFoot.z };
    this.climb = new Climb(from, up ? top : foot, this.loftParams.climbSeconds);
    this.climbUp = up;
    this.player.moveEnabled = false;
  }

  startHiding() {
    this.achievements.note('hid');
    const h = this.world.layout.loft.hideSpot;
    const p = this.player.position;
    this.hiddenFrom = { x: p.x, y: p.y, z: p.z };
    this.player.moveTo({ x: h.x, y: this.loft.top, z: h.z });
    this.player.moveEnabled = false;
    this.player.eyeDropTarget = 1.0;
    this.hiding.hide();
  }

  stopHiding() {
    this.hiding.reveal();
    this.player.eyeDropTarget = 0;
    this.player.moveEnabled = true;
    if (this.hiddenFrom) this.player.moveTo(this.hiddenFrom);
    this.hiddenFrom = null;
  }

  /** The ladder climb, hiding in the hay, a girl up in the loft, and Jess's straw. */
  updateLoft(dt) {
    this.strawFall.update(dt);
    if (this.climb) {
      const at = this.climb.update(dt);
      this.player.moveTo(at);
      if (at.done) {
        this.climb = null;
        this.player.moveEnabled = true;
        // Climbing down puts you at the foot facing the barn; up, at the top.
      }
    }
    const girlUp = this.companions.find((c) => c.currentSpot()?.id === this.loftSpot.id && c.isResting && c.restPhase === 'sat');
    if (this.hiding.active) {
      const e = this.hiding.update(dt, { girlInLoft: !!girlUp });
      if (e) {
        const free = this.companions.filter((c) => c.fsm.is('idle', 'walking', 'resting'));
        const girl = girlUp ?? free[Math.floor(Math.random() * free.length)];
        if (e === 'found') this.stopHiding();
        girl?.voice.say(e === 'found' ? 'loftFound' : 'loftCall', { force: true });
      }
    }
    const jess = this.companions.find((c) => c.character.id === 'jess');
    const p = this.player.position;
    const jessUp = !!jess && girlUp === jess;
    if (this.strawDrop.update(dt, { jessUp, you: { x: p.x, z: p.z, below: !this.youOnLoft() && !this.player.isRiding }, jess: { x: this.loftSpot.x, z: this.loftSpot.z } })) {
      this.strawFall.drop({ x: this.loftSpot.x + this.world.layout.loft.strawDx, y: this.loft.top + 0.5, z: this.loftSpot.z }, p, this.loft.ladderFoot.y);
      for (const c of this.companions) c.voice.say('loftDrop', { force: c === jess, urgent: true });
    }
  }

  // Places to be ------------------------------------------------------------

  /** Rain sends them to the barn doorway; drying off lets them out. */
  /** What places to be needs to know (npc/places.js): the rain, the spots and where each girl is at. */
  placesContext() {
    return {
      rain: this.weather.rain,
      dark: this.daylight?.darkness ?? 0,
      fine: isFine(this.weather.name, this.weather.rain, this.places.p),
      sun: this.sunWarmth(),
      spots: this.restSpots,
      girls: this.companions.map((c) => {
        const spot = c.currentSpot();
        return { id: c.character.id, dozeWeight: c.params.dozeWeight, x: c.root.position.x, z: c.root.position.z, spot, state: c.fsm.is('idle') ? 'idle' : c.isResting && c.restPhase === 'sat' ? 'resting' : 'busy' };
      }),
    };
  }

  /** How bright and warm the sun is on the farm now (0..1): what makes it a day for dozing outside. */
  sunWarmth() {
    const w = this.weather;
    return Math.min(1, w.def.sky.sunIntensity / 2.6) * (1 - w.rain) * w.sunUp;
  }

  updatePlaces(dt) {
    for (const a of this.places.update(dt, this.placesContext())) this.handlePlaceAction(a);
  }

  /** Acts on places to be (npc/places.js): running for the barn doorway (a choice she made), coming out once it's dry. */
  handlePlaceAction(a) {
    const c = this.companions.find((o) => o.character.id === a.girl);
    if (a.do === 'shelter') {
      const go = () => {
        if (c.goRest(a.spot)) c.selfEvents.push(a.dark ? 'goInDark' : 'restRain');
        else c.pendingSpot = null;
      };
      c.pendingSpot = a.spot; // held for her while she gets up, so her friend picks another
      if (c.isResting) c.leaveRest(go);
      else go();
    } else if (a.do === 'doze') {
      c.pendingSpot = a.spot;
      if (c.goRest(a.spot, { stay: dozeStay(this.places.p), doze: true })) c.selfEvents.push('dozeGo');
      else c.pendingSpot = null;
    } else if (a.do === 'leave') c.leaveRest();
  }

  // Favours she asks for ----------------------------------------------------

  /** What the favour logic needs to know about the farm right now. */
  requestContext(ridden) {
    const pos = this.player.position;
    return {
      you: { x: pos.x, z: pos.z, onFoot: !this.player.isRiding },
      girls: this.companions.map((c) => ({
        id: c.character.id,
        x: c.root.position.x,
        z: c.root.position.z,
        free: c.availability().free,
        favourite: c.voice.favourite,
      })),
      quads: this.girlUnits.map((u) => ({
        id: u.spec.id,
        x: u.quad.position.x,
        z: u.quad.position.z,
        muddy: Math.max(u.mud.state.body, u.mud.state.wheels),
        speed: u.quad.speed,
        ridden: u === ridden,
        hasPillion: u.quad.hasPillion,
        pillion: this.companions.find((c) => c.isSeated && c.quad === u.quad && c.seatKind !== 'rider')?.character.id ?? null,
        onGrid: (u.ride?.gridShare ?? 0) > 0,
        slams: u.quad.seatSlams.filter((x) => x.kind === 'pillion').length,
      })),
      can: { ...this.petrolCan.model.getWorldPosition(new THREE.Vector3()), held: this.petrolCan.held }, // it may be standing in the trailer
      bales: this.bales,
      pub: this.world.props.village?.shape.pubStop ?? null, // where you pull up at the village pub (the girls' 'take me to the pub')
      grid: !!this.world.cattleGrid,
      tractor: {
        exists: !!this.tractorUnit,
        running: !!this.tractorUnit?.engine.isRunning,
        mudguard: this.tractorMount ? this.companions.find((c) => c.onHayRide && c.trailer === this.tractorMount)?.character.id ?? null : null,
      },
    };
  }

  updateRequests(dt, ridden) {
    if (this.hiding.active) return; // nobody to ask
    const ctx = this.requestContext(ridden);
    // She asked to go to the bales and you've got on a quad: she comes and climbs on the back, rather than waiting to be told.
    const ru = ctx.quads.find((q) => q.ridden);
    const joiner = this.requests.joiner(dt, { you: ctx.you, girls: ctx.girls, ridden: ru && this.player.isRiding ? ru : null });
    if (joiner) {
      const c = this.companions.find((o) => o.character.id === joiner);
      c?.requestMount(ridden.quad);
      const kind = this.requests.openFor(joiner)?.kind ?? 'bales';
      c?.voice.say(`remind${kind[0].toUpperCase()}${kind.slice(1)}`, { force: true });
    }
    for (const e of this.requests.update(dt, ctx)) this.handleRequestEvent(e);
  }

  /** Acts on favours (npc/requests.js): asking (a choice she made, or the debug panel's), done, lapsed. */
  handleRequestEvent(e) {
    const r = e.request;
    const girl = this.companions.find((c) => c.character.id === r.girl);
    const kind = r.kind[0].toUpperCase() + r.kind.slice(1);
    if (e.type === 'ask') girl?.voice.say(`ask${kind}`, { force: true });
    else if (e.type === 'done') {
      this.favour.add(r.girl, this.requests.p.doneFavour);
      girl?.voice.say(`thanks${kind}`, { force: true });
      // The favoured one crows if her friend's close enough to hear.
      const friend = girl?.others().find((o) => o.root.position.distanceTo(girl.root.position) < 12);
      if (friend && this.favour.mood(r.girl) === 'favoured' && Math.random() < 0.6) setTimeout(() => girl.voice.say('gloatFavour', { force: true }), 4000);
    } else if (e.type === 'lapsed') this.favour.add(r.girl, this.requests.p.ignoredFavour);
  }

  /** Talking to her: she reminds you of what she asked, or holds a lapsed one against you (once). */
  remindOfFavour(her) {
    const id = her.character.id;
    const open = this.requests.openFor(id);
    const grudge = this.requests.grudge(id);
    const cap = (k) => k[0].toUpperCase() + k.slice(1);
    if (open) her.voice.say(`remind${cap(open.kind)}`, { force: true });
    else if (grudge && !grudge.told) {
      grudge.told = true;
      her.voice.say(`grudge${cap(grudge.kind)}`, { force: true });
    }
  }

  // Rev-offs -----------------------------------------------------------------

  /** A girl can answer a blip from a running quad she's sat on with nobody at its controls. */
  revOffQuad(c) {
    const q = c.quad;
    return c.fsm.is('seated') && !q.rider && !q.driver && q.engine.isRunning ? q : null;
  }

  /** A girl free beside a quad her friend is sat on, running, reaches over and blips it so it rocks (Jess does; Amy doesn't). */
  updateRockPrank(dt) {
    this.rockPrank ??= { until: 0, quad: null, next: 0 };
    const r = this.rockPrank;
    r.next -= dt;
    if (r.quad) {
      if (this.revOff.clock < r.until) return;
      r.quad.helperThrottle = 0;
      r.quad = null;
    }
  }

  /** Blipping her friend's quad from beside it (the rock prank), as an offer for the chooser: she's keen as her rockPrankWeight says. */
  rockPrankOffers(c) {
    const r = this.rockPrank;
    const p = c.params;
    if (!r || r.quad || r.next > 0 || !p.rockPrankWeight) return [];
    const friend = this.companions.find((o) => o !== c && this.revOffQuad(o) && !o.holdingIdle && c.root.position.distanceTo(o.quad.position) <= p.rockPrankRange);
    return friend ? [{ key: 'rockPrank', girl: c.character.id, weight: p.rockPrankWeight, take: () => this.rockPrankNow(c, friend) }] : [];
  }

  /** She reaches over and gives her friend's quad a handful. */
  rockPrankNow(c, friend) {
    const r = this.rockPrank;
    r.quad = friend.quad;
    r.until = this.revOff.clock + 0.4;
    r.next = 120;
    friend.quad.helperThrottle = 1;
    c.voice.say('rockPrank', { force: true });
    friend.voice.say('rockPrankAmy', { force: true });
  }

  /** Jess sat on a running quad blips it over Amy mid-sentence; Amy cuts off and tells her to stop, and Jess does; the engine keeps running (npc/drownOut.js). */
  updateDrownOut(dt) {
    const jess = this.companions.find((c) => c.character.id === 'jess');
    const amy = this.companions.find((c) => c.character.id === 'amy');
    if (!jess || !amy) return;
    const quad = this.revOffQuad(jess);
    const busy = this.revOff.answering('jess') || quad === this.rockPrank?.quad || jess.holdingIdle;
    const ch = amy.voice.chatter;
    const ctx = {
      jessCanRev: !!quad && !busy && !this.menu.isOpen,
      amyLeft: Math.max(0, ch.speakingUntil - ch.time),
      distance: jess.root.position.distanceTo(amy.root.position),
    };
    const events = this.drownOut.update(dt, ctx);
    if (quad && !busy) quad.helperThrottle = this.drownOut.throttleFor();
    for (const e of events) {
      if (e.type === 'rev') {
        amy.voice.cut();
        jess.voice.say('drownRev', { force: true });
      } else if (e.type === 'tellOff') {
        amy.voice.say('drownTellOff', { force: true });
        jess.voice.say('drownProtest', { force: true });
      }
    }
  }

  updateRevOff(dt, ridden) {
    const q = ridden?.quad;
    const girls = this.companions.map((c) => ({ id: c.character.id, canBlip: !!this.revOffQuad(c) && !c.holdingIdle, x: c.root.position.x, z: c.root.position.z }));
    const you = { riding: !!q && !this.menu.isOpen, running: !!q?.engine.isRunning, speed: Math.abs(q?.speed ?? 0), throttle: q?.throttle ?? 0, x: this.player.position.x, z: this.player.position.z };
    const events = this.revOff.update(dt, { you, girls });
    for (const c of this.companions) {
      const quad = this.revOffQuad(c);
      if (quad && quad !== this.rockPrank?.quad && !c.holdingIdle) quad.helperThrottle = this.revOff.throttleFor(c.character.id);
    }
    for (const e of events) {
      const girl = this.companions.find((c) => c.character.id === e.girl);
      if (!girl) continue;
      if (e.type === 'done') {
        if (girl.quad.helperThrottle > 0 && !girl.holdingIdle) girl.quad.helperThrottle = 0;
      } else if (e.type === 'answer') {
        girl.voice.say(e.round > 1 ? 'revAnswerMore' : 'revAnswer', { force: true });
      } else if (e.type === 'complain') {
        if (e.by === 'amy') this.companions.find((c) => c.character.id === 'amy')?.voice.say('revComplain', { force: true });
        else if (this.revOff.stalls(girl.quad.engine)) {
          girl.quad.engine.stall('revOff');
          girl.voice.say('revStall', { force: true });
        }
      }
    }
  }

  // Horns --------------------------------------------------------------------

  updateHorns(dt, ridden) {
    // A horn that works when it likes only sounds some of the time you hold it, and the girls only answer what they hear.
    const held = !!ridden && !this.menu.isOpen && this.input.isDown('KeyL');
    const honking = ridden ? ridden.quad.quirks.horn(dt, held) : false;
    const girls = this.companions.map((c) => {
      const driving = c.fsm.is('driving');
      return { id: c.character.id, x: c.root.position.x, z: c.root.position.z, yaw: c.quad.yaw, speed: Math.abs(c.quad.speed), driving, canHonk: driving || c.fsm.is('seated') };
    });
    const events = this.horns.update(dt, { you: { x: this.player.position.x, z: this.player.position.z, honking }, girls });
    const girl = (id) => this.companions.find((c) => c.character.id === id);
    for (const e of events) {
      if (e.type === 'answer') {
        girl(e.girl)?.voice.say('hornAnswer', { force: true });
        if (ridden) this.achievements.note('hornAnswered');
      }
      else if (e.type === 'creep') girl('jess')?.voice.say('hornJump', { force: true });
      else if (e.type === 'jump') girl(e.girl)?.voice.say('hornJump', { force: true });
    }
    for (const u of this.units) {
      const c = this.companions.find((o) => o.quad === u.quad);
      const sounding = u === ridden ? honking : u.quad.quirks.horn(dt, !!c && this.horns.beeping(c.character.id));
      u.ride.setHorn(sounding);
      u.quad.hornHeld = sounding; // a wheel pad that sinks while it sounds
      if (u.quad.signalClick) {
        this.audioHub.indicatorClick(u.quad.signalClick === 'on', u.quad.position); // the relay, fading with distance
        u.quad.signalClick = null;
      }
    }
  }

  // Names, whose quad, and hearing one ------------------------------------

  /** Who is at the controls of this quad: 'you', the girl driving it, or nobody. */
  quadUser(u, ridden) {
    if (u === ridden) return 'you';
    return this.companions.find((c) => c.quad === u.quad && c.fsm.is('driving'))?.character.id ?? null;
  }

  updateQuadTalk(dt, ridden) {
    const pos = this.player.position;
    const girls = this.companions.map((c) => ({ id: c.character.id, x: c.root.position.x, z: c.root.position.z, free: c.availability().canRemark }));
    const quads = this.girlUnits.map((u) => {
      const user = this.quadUser(u, ridden);
      const q = u.quad;
      return { id: u.spec.id, x: q.position.x, z: q.position.z, user, driver: user, running: q.engine.isRunning, speed: q.speed, throttle: q.throttle, temperature: q.engine.temperature, wear: q.engine.wear };
    });
    const careQuads = this.girlUnits.map((u, i) => ({
      ...quads[i],
      revs: u.quad.engine.rpm / u.quad.engine.params.redlineRpm,
      fuel: u.quad.fuel.litres / u.quad.fuel.params.tankCapacity,
    }));
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const later = (ms, fn) => setTimeout(fn, ms);

    // Jess names a quad, and Amy won't use it.
    const jess = girls.find((g) => g.id === 'jess');
    if (jess) {
      const near = [...quads].sort((a, b) => Math.hypot(a.x - jess.x, a.z - jess.z) - Math.hypot(b.x - jess.x, b.z - jess.z)).map((q) => q.id);
      const named = this.quadNames.update(dt, { jessFree: jess.free, youNear: Math.hypot(pos.x - jess.x, pos.z - jess.z) < this.quadNames.p.nameRange, candidates: near });
      if (named) {
        byId.jess.voice.say(quadKey('nameQuad', named.specId, named.nick), { force: true });
        const amy = girls.find((g) => g.id === 'amy');
        if (amy && Math.hypot(amy.x - jess.x, amy.z - jess.z) < 15) later(3500, () => byId.amy.voice.say('nameAmy', { force: true }));
      }
    }
    // Amy slips: Jess pounces.
    if (byId.amy?.voice.slipped) {
      byId.amy.voice.slipped = false;
      later(2500, () => byId.jess?.voice.say('nameCaved', { force: true }));
    }

    // Whose is whose.
    for (const e of this.ownership.update(dt, { you: { x: pos.x, z: pos.z, onFoot: !this.player.isRiding }, girls, quads })) {
      if (e.type === 'upset') this.noteFriction('borrow', e.by);
      if (e.type === 'claim') byId[e.girl].voice.sayQuad('claim', e.spec, { urgent: true });
      else if (byId[e.girl].voice.say(`ownerUpset_${e.by}`, { force: true }) && e.by === 'jess' && Math.random() < this.ownership.p.teaseChance) {
        later(3500, () => byId.jess?.voice.say('borrowTease', { force: true }));
      }
    }

    // Caring for her quad: running it dry or thrashing it, and a wash (npc/quadCare.js).
    const owners = Object.fromEntries(Object.entries(this.ownership.claims).map(([girl, spec]) => [spec, girl]));
    for (const e of this.quadCare.update(dt, { girls, owners, quads: careQuads })) {
      const kind = e.type === 'dry' ? 'quadDry' : 'quadThrashed';
      if (byId[e.girl].voice.sayQuad(kind, e.spec, { urgent: true }) && e.by === 'you' && e.type === 'thrashed') {
        this.favour.add(e.girl, this.quadCare.thrashFavour(e.girl));
      }
    }
    const washed = this.washing && this.ownership.ownerOf(this.washing.spec.id);
    if (washed && byId[washed]) {
      this.favour.add(washed, this.quadCare.washFavour(washed, dt));
      if (this.quadCare.wash(washed, dt)) byId[washed].voice.sayQuad('quadProud', this.washing.spec.id, { urgent: true });
    } else this.quadCare.stopWash();

    // Hearing a quad out of sight.
    for (const e of this.hearing.update(dt, { girls, quads })) {
      byId[e.girl].voice.sayQuad(`ear${e.sound[0].toUpperCase()}${e.sound.slice(1)}`, e.spec, { urgent: true });
    }
  }

  // Sheltering in a cab --------------------------------------------------

  /** The UTV, the Land Rovers and the girls' cars as somewhere to get in out of the weather: where each is, whether it is free to climb into, and how many seats. */
  cabContext() {
    return ['utv', ...CAB_KINDS].filter((k) => this.goVehicle(k)).map((kind) => {
      const q = this.goVehicle(kind).quad;
      const mount = this.mountOfKind(kind);
      const busy = (c) => c.quad === q && (c.fsm.is('driving', 'mounting', 'dismounting', 'shuffling', 'cranking') || (c.fsm.is('walking') && ['drive', 'crank', 'start'].includes(c.fsm.data?.goal)));
      const open = !q.rider && !q.driver && !q.passenger && !q.isTipped && q.speed < 0.5 && !this.companions.some(busy) && !this.cabShelter.isSulkCab(kind) && !(kind === 'utv' && (this.utvBed.tip > 0.02 || mount.bedBusy));
      const seats = [mount.slots.left, mount.slots.mid].filter((s) => s && !s.girl).length;
      return { id: kind, x: q.position.x, z: q.position.z, open, seats, running: q.engine.isRunning, warm: kind !== 'utv' };
    });
  }

  /** She climbs into this cab (when she's stood about). Returns whether she set off. */
  boardCab(c, kind, { passenger = false } = {}) {
    const mount = this.mountOfKind(kind);
    const slot = passenger ? mount.slots.left : mount.freeSlot(c.root.position); // sulking, she takes the passenger's seat
    if (!slot || slot.girl || !c.boardTrailer(mount, slot)) return false;
    this.rideOfKind(kind).ask(c.character.id); // she stays until the weather turns or she's bored
    return true;
  }

  /** What the cab shelter needs to know about the girls and cabs right now. */
  cabShelterContext() {
    const cabKinds = ['utv', 'landy', 'defender'];
    return {
      rain: this.weather.rain,
      warmth: this.weather.warmth,
      cabs: this.cabContext(),
      girls: this.companions.map((c) => ({
        id: c.character.id,
        x: c.root.position.x,
        z: c.root.position.z,
        free: c.availability().free,
        interruptible: c.interruptible(), // the rain can get her up off a seat, or away from warming her hands
        cab: cabKinds.find((k) => this.goVehicle(k) && c.onHayRide && c.trailer === this.mountOfKind(k)) ?? null,
      })),
    };
  }

  /** Acts on what the cab shelter decided (also the debug panel's button, through `sendToCab`). */
  handleCabEvent(e) {
    const c = this.companions.find((o) => o.character.id === e.girl);
    if (e.type === 'go') {
      const unit = this.goVehicle(e.cab);
      const go = () => {
        if (!this.boardCab(c, e.cab, { passenger: e.reason === 'sulk' })) this.cabShelter.drop(e.girl, []);
      };
      if (e.reason !== 'sulk') c.voice.say(e.reason === 'cold' ? 'cabColdGo' : 'cabRainGo', { urgent: true, chance: 0.9 });
      const settleAt = e.reason === 'sulk' ? 0.3 : 0.5;
      if (e.start && needsStartingHandle(unit.quad)) {
        c.requestStart(unit.quad, { settleAt, then: (ran) => (ran || unit.quad.engine.isRunning ? go() : this.cabShelter.drop(e.girl, [])) });
      } else if (e.start) {
        // Climbs in first and starts it from the seat, choke and all, rather than standing out in the cold.
        if (this.boardCab(c, e.cab, { passenger: e.reason === 'sulk' })) {
          c.startFromSeat(unit.quad, { settleAt, then: (ran) => { if (!ran) { this.cabShelter.drop(e.girl, []); this.rideOfKind(e.cab).dismiss(e.girl); c.leaveTrailer(); } } });
        } else this.cabShelter.drop(e.girl, []);
      } else go();
    } else if (e.type === 'in') {
      if (e.reason !== 'sulk') c.voice.say('cabIn', { chance: 0.8 });
    }
    else if (e.type === 'out') {
      this.rideOfKind(e.cab).dismiss(e.girl);
      c.leaveTrailer();
      if (e.reason !== 'sulk') c.voice.say('cabOut', { chance: 0.6 });
    } else if (e.type === 'switchOff') {
      const q = this.goVehicle(e.cab).quad;
      if (q.engine.isRunning && !q.rider && !q.driver && !q.passenger && !this.companions.some((o) => o.onHayRide && o.trailer === this.mountOfKind(e.cab))) q.engine.setIgnition(false);
    }
  }

  /** `quiet`: autonomy is off, so only a sulk (sent by the button) carries on; no weather sends anyone to a cab. */
  updateCabShelter(dt, quiet = false) {
    const ctx = this.cabShelterContext();
    if (quiet) Object.assign(ctx, { rain: 0, warmth: 1 });
    for (const e of this.cabShelter.update(dt, ctx)) this.handleCabEvent(e);
  }

  // Seats that ride differently -----------------------------------------------

  /** A seat slams (its spring bottomed out, or the bed threw her up): whoever is sat there reacts, now and then. */
  updateSeatSlams() {
    for (const unit of this.units) {
      const q = unit.quad;
      for (const slam of q.seatSlams) {
        for (const c of this.companions) {
          if (c.quad !== q) continue;
          const slot = c.fsm.is('onTrailer') && c.trailer?.quad === q ? c.traSlot : null;
          const kind = slot ? (slot.name === 'bed' ? 'bed' : slot.rear ? 'rear' : 'front') : c.fsm.is('seated') ? (c.seatKind === 'rack' ? 'rack' : 'pillion') : null;
          if (kind !== slam.kind || (kind === 'front' && !slot)) continue;
          const key = kind === 'bed' && slam.up ? 'seatBedAir' : { pillion: 'seatPillion', rack: 'seatRack', rear: 'seatRear', bed: 'seatBed' }[kind];
          if (key && slam.strength > 0.3) c.voice.say(key, { chance: 0.6 });
        }
      }
    }
  }

  // Ready and waiting -----------------------------------------------------

  /** The quad she'll sit on for you: your usual one, then her favourite, then the nearest, anywhere she can get on the back of. */
  readyQuadFor(c) {
    const fit = (u) => u.quad.hasPillion && !u.quad.isTipped && !u.quad.rider && !u.quad.driver && !u.quad.passenger && c.mayRide(u.quad) && c.canRidePillion(u.quad) && !this.herOn(u.quad);
    const free = this.girlUnits.filter(fit);
    const byId = (id) => free.find((u) => u.spec.id === id);
    return byId(this.headStart.usual())?.quad ?? byId(c.voice.favourite)?.quad ?? free.sort((a, b) => a.quad.position.distanceTo(c.root.position) - b.quad.position.distanceTo(c.root.position))[0]?.quad ?? null;
  }

  /** "I'll be a minute": she gets a quad going and sits on the back of it, revving and tooting, until you come. Returns whether she set off. */
  askToWait(c, forced = false) {
    const id = c.character.id;
    const q = this.readyQuadFor(c);
    this.closeMenu();
    if (!q || !(forced ? c.fsm.is('idle') : this.askable(c, ['idle', 'walking', 'driving']))) {
      if (!forced) this.hud.toast(`${c.name} can't just now`);
      return false;
    }
    this.readyWaiting.begin(id);
    this.readyQuads.set(id, q);
    c.voice.say('readyGo', { force: true });
    const sit = () => (c.requestMount(q), c.seatedByChoice = false); // on the back, and she stays there until you come or give up
    if (q.engine.isRunning) sit();
    else c.requestStart(q, { settleAt: 0.3, then: (ran) => (ran || q.engine.isRunning ? sit() : this.readyWaiting.drop(id)) });
    return true;
  }

  /** Each frame: the girls who are getting a quad ready for you, or sat on one revving and tooting. */
  updateReady(dt) {
    const w = this.readyWaiting;
    const ridden = this.riddenUnit;
    for (const c of this.companions) c.readyHolding = w.waiting(c.character.id) || this.warmSit.sitting(c.character.id) || this.practising.sitting(c.character.id); // so nothing else revs her quad or she switches it off
    const girls = this.companions.filter((c) => w.has(c.character.id)).map((c) => {
      const q = this.readyQuads.get(c.character.id);
      return {
        id: c.character.id,
        ready: !!q && c.fsm.is('seated') && c.quad === q && c.seatKind === 'pillion' && q.engine.isRunning,
        youDistance: c.root.position.distanceTo(this.player.position),
        youOn: !!ridden && ridden.quad === q,
      };
    });
    for (const e of w.update(dt, { girls })) {
      const c = this.companions.find((o) => o.character.id === e.girl);
      const q = this.readyQuads.get(e.girl);
      if (e.type === 'rev') this.readyRev = { quad: q, left: e.seconds };
      else if (e.type === 'toot') {
        this.horns.toot(e.girl, e.length);
        c.voice.say(e.impatient ? 'readyImpatient' : 'readyToot', { force: true });
      } else if (e.type === 'here') c.voice.say('readyHere', { force: true });
      else if (e.type === 'giveUp') {
        if (e.keyOff) q.engine.setIgnition(false);
        c.voice.say('readyGiveUp', { force: true });
        c.fsm.transition('dismounting');
      }
      if (e.type === 'here' || e.type === 'giveUp' || e.type === 'lost') {
        this.readyQuads.delete(e.girl);
        if (this.readyRev?.quad === q) this.readyRev = null;
        if (q && !this.companions.some((o) => o.quad === q && o.holdingIdle)) q.helperThrottle = 0;
      }
    }
    // Sat there she keeps a little choke and throttle on while it is cold, or it dies on her (as for the sulker in the cab).
    const cared = new Set();
    for (const [id, q] of [...this.readyQuads, ...this.warmSitQuads]) {
      const c = this.companions.find((o) => o.character.id === id);
      if (c.fsm.is('starting') || !q.engine.isRunning || q.engine.temperature >= q.engine.params.warmLightThreshold) continue; // (while she is starting it she minds the choke herself)
      cared.add(q);
      if (q.choke < 0.3) q.choke = 0.3;
      if (this.readyRev?.quad !== q) q.helperThrottle = 0.15;
    }
    for (const q of this.readyCare ?? []) {
      if (!cared.has(q)) {
        q.choke = 0;
        if (this.readyRev?.quad !== q) q.helperThrottle = 0;
      }
    }
    this.readyCare = cared;
    if (this.readyRev) {
      const r = this.readyRev;
      r.left -= dt;
      if (r.left <= 0 || !r.quad.engine.isRunning) {
        r.quad.helperThrottle = 0;
        this.readyRev = null;
      } else r.quad.helperThrottle = 1;
    }
  }

  // Sulking in the cab ---------------------------------------------------

  /** The girl sulking in this vehicle (a Land Rover), if one is in it. */
  sulkerIn(quad) {
    const id = this.sulking.who;
    if (!id || !this.sulking.isIn(id)) return null;
    const c = this.companions.find((o) => o.character.id === id);
    return c && c.quad === quad ? c : null;
  }

  /** She is cross: after a row or a slight she goes and sits alone in a Land Rover, engine on (npc/sulking.js). Each frame. */
  updateSulking(dt) {
    const s = this.sulking;
    const girls = this.companions.map((c) => {
      const m = this.cabShelter.of(c.character.id);
      return {
        id: c.character.id,
        free: c.availability().free,
        neglected: this.favour.mood(c.character.id) === 'neglected',
        cab: m?.reason === 'sulk' ? m.state : null,
      };
    });
    for (const e of s.update(dt, { girls })) {
      const c = this.companions.find((o) => o.character.id === e.girl);
      if (e.type === 'go') {
        if (this.sendToCab(e.girl, 'sulk')) c.voice.say('sulkGo', { force: true });
        else s.drop(e.girl);
      } else if (e.type === 'out') {
        const m = this.cabShelter.of(e.girl);
        if (m) {
          this.handleCabEvent({ type: 'out', girl: e.girl, cab: m.cab, reason: 'sulk' });
          this.cabShelter.drop(e.girl, []);
        }
        c.voice.say(e.why === 'round' ? 'sulkRound' : 'sulkOut', { force: true });
      } else if (e.type === 'over') {
        const m = this.cabShelter.of(e.girl);
        if (m?.reason === 'sulk') this.cabShelter.drop(e.girl, []);
      }
    }
    // She keeps a little choke and throttle on while a cold engine warms, or it dies on her once she's stopped minding it.
    const sat = this.sulking.who && this.sulking.isIn(this.sulking.who) ? this.cabShelter.of(this.sulking.who) : null;
    if (sat) {
      const q = this.goVehicle(sat.cab).quad;
      if (q.engine.isRunning && q.engine.temperature < q.engine.params.warmLightThreshold) {
        if (q.choke < 0.3) q.choke = 0.3;
        if (!this.sulkRev) q.helperThrottle = 0.15; // and a touch of throttle from the seat beside
        this.sulkChoke = q;
      } else if (this.sulkChoke === q) {
        q.choke = 0;
        if (!this.sulkRev) q.helperThrottle = 0;
        this.sulkChoke = null;
      }
    } else if (this.sulkChoke) {
      this.sulkChoke.choke = 0;
      this.sulkChoke.helperThrottle = 0;
      this.sulkChoke = null;
    }
    // Jess's revving: the engine blipped open for a moment at a time.
    if (this.sulkRev) {
      this.sulkRev.left -= dt;
      const q = this.sulkRev.quad;
      if (this.sulkRev.left <= 0 || !q.engine.isRunning) {
        q.helperThrottle = 0;
        this.sulkRev = null;
      } else q.helperThrottle = 1;
    }
  }

  /** You knock on the window of a Land Rover with a sulking girl in it. */
  knockOnWindow(c) {
    const id = c.character.id;
    const r = this.sulking.knock(id, { neglected: this.favour.mood(id) === 'neglected' });
    if (!r) return;
    this.hud.toast(r.kind === 'ignored' ? `You knock. ${c.name} doesn't look round` : 'You knock on the window', 1.5);
    if (r.kind === 'answer') c.voice.say('sulkAnswer', { force: true });
    else if (r.kind === 'rev') {
      c.voice.say('sulkAnswer', { force: true });
      this.sulkRev = { quad: c.quad, left: this.sulking.p.revSeconds };
    } else if (r.kind === 'pushed') c.voice.say('sulkPushed', { force: true });
  }

  /** The debug panel's and the console's way to send a girl to a cab now. Returns whether she set off. */
  sendToCab(id, reason = 'rain', cab = null) {
    const e = this.cabShelter.force(id, this.cabShelterContext(), reason, cab);
    if (e) this.handleCabEvent(e);
    return !!e;
  }

  // Warming their hands --------------------------------------------------

  /** What warming hands needs to know (npc/warming.js): the weather, the girls and the idling quads. */
  warmingContext() {
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      x: c.root.position.x,
      z: c.root.position.z,
      free: c.availability().free,
      warmSpec: c.warmingAt?.unit.spec.id ?? null,
    }));
    const quads = this.girlUnits.map((u) => {
      const q = u.quad;
      const idling = q.engine.isRunning && !q.rider && !q.driver && !q.passenger && !q.isGhostRiding && q.speed < 0.3 && !this.herOn(q);
      return { id: u.spec.id, x: q.position.x, z: q.position.z, idling };
    });
    return { weather: this.weather, girls, quads };
  }

  updateWarming(dt) {
    for (const e of this.warming.update(dt, this.warmingContext())) this.handleWarmingEvent(e);
  }

  /** Acts on warming hands (npc/warming.js): going (a choice she made), putting her hands out, leaving. */
  handleWarmingEvent(e) {
    const c = this.companions.find((o) => o.character.id === e.girl);
    if (e.type === 'go') {
      if (c.goWarm(this.girlUnits.find((u) => u.spec.id === e.spec).quad)) c.voice.say(e.join ? 'warmJoin' : 'warmGo', { urgent: true, chance: 0.8 });
    } else if (e.type === 'warm') c.voice.say('warmHands', { chance: 0.8 });
    else if (e.type === 'leave') {
      c.stopWarming();
      if (e.off) c.voice.say('warmOff', { force: true });
    }
  }

  // A head start on your usual quad ----------------------------------------

  /** What the head start needs to know (npc/headStart.js): the day, where you are, the girls and which quads could be started. */
  headStartContext() {
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      x: c.root.position.x,
      z: c.root.position.z,
      free: c.availability().free,
      mood: this.favour.mood(c.character.id),
      own: c.claimedSpec,
    }));
    const quads = this.girlUnits.map((u) => {
      const q = u.quad;
      const claimed = this.companions.some((c) => c.quad === q && c.fsm.is('walking', 'starting'));
      const startable = !q.engine.isRunning && !q.rider && !q.driver && !q.passenger && !q.isTipped && !q.isGhostRiding && !this.herOn(q) && !claimed;
      return { id: u.spec.id, x: q.position.x, z: q.position.z, startable };
    });
    return { cold: isChilly(this.weather, this.warming.p), you: { x: this.player.position.x, z: this.player.position.z, onFoot: !this.player.isRiding }, girls, quads };
  }

  updateHeadStart(dt, ridden) {
    if (ridden) this.headStart.ride(ridden.spec.id, dt);
    this.headStart.update(dt, this.headStartContext());
  }

  /** Acts on the head start (npc/headStart.js): the favoured girl starting yours, or the neglected one starting her own (her choice). */
  handleHeadStartEvent(e) {
    const c = this.companions.find((o) => o.character.id === e.girl);
    const quad = this.girlUnits.find((u) => u.spec.id === e.spec).quad;
    if (c.takenByOther(quad, 'rider')) return;
    if (e.type === 'warmFor') return void this.warmUpFor(c, quad.unit);
    c.requestStart(quad);
    c.voice.say('snubGo', { urgent: true, force: true });
  }

  // Sitting on it while it warms ---------------------------------------------

  /** Where she could sit while this vehicle warms: the back of a quad, or the passenger seat of a Land Rover or the UTV. null if there is nowhere. */
  warmSitSpot(c, unit) {
    const q = unit.quad;
    const cab = ['utv', ...CAB_KINDS].find((k) => this.goVehicle(k) === unit);
    if (cab) {
      const slot = this.mountOfKind(cab).slots.left;
      return slot && !slot.girl && !q.rider && !q.driver && !q.passenger ? { cab } : null;
    }
    if (q.tractor) return null;
    return c.canRidePillion(q) ? { back: true } : null;
  }

  /** She is starting your usual vehicle for you: from beside it as ever, or (mostly) sitting on it while it warms, maybe asking first. */
  warmUpFor(c, unit, forced = false) {
    const q = unit.quad;
    const spot = this.warmSitSpot(c, unit);
    const near = c.root.position.distanceTo(this.player.position);
    const mode = forced ? (spot ? 'sit' : 'beside') : this.warmSit.decide(!!spot, near);
    if (mode === 'ask') {
      c.voice.say('warmSitAsk', { urgent: true, force: true });
      const ask = (this.warmAsk = { c, unit, spot, done: false });
      const pick = (sit) => () => {
        ask.done = true;
        if (sit) this.warmSitGo(c, unit, spot);
        else c.requestStart(q);
      };
      this.openWheel(`${c.name} asks`, [{ label: 'Go on', run: pick(true) }, { label: 'No, I\'ll take it', run: pick(false) }], null);
      this.player.lookEnabled = false;
      this.player.moveEnabled = false;
      return;
    }
    c.voice.say('headStartGo', { urgent: true, force: true });
    if (mode === 'sit') this.warmSitGo(c, unit, spot);
    else c.requestStart(q);
  }

  /** She starts it (if it isn't running) and takes her seat to enjoy the warm-up. */
  warmSitGo(c, unit, spot) {
    const q = unit.quad;
    const id = c.character.id;
    if (!spot || !c.fsm.is('idle')) return c.requestStart(q);
    this.warmSit.begin(id);
    this.warmSitQuads.set(id, q);
    const sit = () => {
      if (spot.cab) {
        if (!this.boardCab(c, spot.cab, { passenger: true })) this.warmSit.drop(id);
      } else {
        c.requestMount(q);
        c.seatedByChoice = false; // and stays there until you come, or she gives up
      }
    };
    if (q.engine.isRunning) sit();
    else if (spot.cab && !needsStartingHandle(q)) {
      // In a cab she climbs in and starts it from the seat.
      if (this.boardCab(c, spot.cab, { passenger: true })) c.startFromSeat(q, { settleAt: 0.3, then: (ran) => { if (!ran) { this.warmSit.drop(id); this.rideOfKind(spot.cab).dismiss(id); c.leaveTrailer(); } } });
      else this.warmSit.drop(id);
    } else c.requestStart(q, { settleAt: 0.3, then: (ran) => (ran || q.engine.isRunning ? sit() : this.warmSit.drop(id)) });
  }

  /** Each frame: a girl sat on a warming vehicle. */
  updateWarmSit(dt, ridden) {
    const w = this.warmSit;
    if (this.warmAsk && !this.warmAsk.done && !this.menu.isOpen) {
      // The wheel was closed without an answer: she gets on with it as she always did.
      const { c, unit } = this.warmAsk;
      this.warmAsk.done = true;
      c.requestStart(unit.quad);
    }
    const girls = this.companions.filter((c) => w.has(c.character.id)).map((c) => {
      const id = c.character.id;
      const q = this.warmSitQuads.get(id);
      const cab = ['utv', 'landy', 'defender'].find((k) => this.goVehicle(k)?.quad === q);
      const sat = cab ? c.onHayRide && c.trailer === this.mountOfKind(cab) : c.fsm.is('seated') && c.quad === q && c.seatKind === 'pillion';
      return {
        id,
        ready: !!q && sat && q.engine.isRunning,
        temperature: q?.engine.temperature ?? 0,
        warm: !!q && q.engine.temperature >= q.engine.params.warmLightThreshold,
        youDistance: c.root.position.distanceTo(this.player.position),
        youOn: !!ridden && ridden.quad === q,
      };
    });
    for (const e of w.update(dt, { girls })) {
      const c = this.companions.find((o) => o.character.id === e.girl);
      const q = this.warmSitQuads.get(e.girl);
      const line = { in: 'warmSitIn', smoothing: 'warmSitSmoothing', smooth: 'warmSitSmooth', slow: 'warmSitSlow', giveUp: 'warmSitGiveUp' }[e.type];
      if (line) c.voice.say(line, { force: true });
      if (e.type === 'off' || e.type === 'giveUp') {
        const cab = ['utv', 'landy', 'defender'].find((k) => this.goVehicle(k)?.quad === q);
        if (cab) {
          this.rideOfKind(cab).dismiss(e.girl);
          c.leaveTrailer();
        } else c.fsm.transition('dismounting');
      }
      if (e.type === 'off' || e.type === 'giveUp' || e.type === 'lost') this.warmSitQuads.delete(e.girl);
    }
  }

  // Practising on her own ---------------------------------------------------

  /** The parked manual (a clutch of its own, nobody on it) she would go and practise on: the nearest she can sit on the back of, or null. */
  practiseUnitFor(c) {
    const taken = new Set(this.practiseQuads.values());
    const fit = (u) => {
      const q = u.quad;
      return q.faults.hasClutch && !taken.has(q) && !q.rider && !q.driver && !q.passenger && !q.isTipped && !q.isGhostRiding && q.speed < 0.5 && !this.herOn(q)
        && c.mayRide(q) && !c.takenByOther(q) && c.canRidePillion(q) && q.position.distanceTo(c.root.position) <= this.practising.p.goRange;
    };
    return this.girlUnits.filter(fit).sort((a, b) => a.quad.position.distanceTo(c.root.position) - b.quad.position.distanceTo(c.root.position))[0] ?? null;
  }

  practiseContext() {
    return {
      girls: this.companions.map((c) => {
        const id = c.character.id;
        const free = c.availability().free && !this.menu.isOpen && !this.recalling;
        return { id, free, unit: free ? this.practiseUnitFor(c)?.id ?? null : null, level: this.skills.level(id, 'starting') };
      }),
    };
  }

  /** She chose to practise (or the debug panel sent her): off to the quad, started first if it is off, then sat on the back of it. */
  handlePractiseGo(e) {
    const c = this.companions.find((o) => o.character.id === e.girl);
    const unit = this.girlUnits.find((u) => u.id === e.unit);
    if (!c || !unit) return void this.practising.drop(e.girl);
    const q = unit.quad;
    const id = c.character.id;
    this.practiseQuads.set(id, q);
    c.voice.say('practiseGo', { urgent: true, force: true });
    const sit = () => (c.requestMount(q), c.seatedByChoice = false); // she stays there until she has done, or you come
    if (q.engine.isRunning) sit();
    else c.requestStart(q, { settleAt: 0.3, then: (ran) => (ran || q.engine.isRunning ? sit() : (this.practising.drop(id), this.practiseQuads.delete(id))) });
  }

  /** For the debug panel and the console: she goes now (the picked vehicle if it fits, else the nearest). Returns whether she set off. */
  practiseNow(c, unit = null) {
    const u = unit && unit.quad.faults.hasClutch && c.canRidePillion(unit.quad) && !unit.quad.rider && !unit.quad.driver ? unit : this.practiseUnitFor(c);
    if (!u || !c.fsm.is('idle') || this.practising.has(c.character.id)) return false;
    this.handlePractiseGo(this.practising.take({ girl: c.character.id, unit: u.id }));
    return true;
  }

  /** Each frame: a girl sat on a parked manual working at the clutch, and what her hands do to it. */
  updatePractising(dt, ridden) {
    const w = this.practising;
    const girls = this.companions.filter((c) => w.has(c.character.id)).map((c) => {
      const id = c.character.id;
      const q = this.practiseQuads.get(id);
      return {
        id,
        sat: !!q && c.fsm.is('seated') && c.quad === q && c.seatKind === 'pillion',
        running: !!q && q.engine.isRunning,
        cold: !!q && q.engine.temperature < q.engine.params.warmLightThreshold,
        level: { starting: this.skills.level(id, 'starting'), choke: this.skills.level(id, 'choke') },
        youDistance: c.root.position.distanceTo(this.player.position),
        youOn: !!ridden && ridden.quad === q,
      };
    });
    const events = w.update(dt, { girls });
    for (const e of events) {
      const c = this.companions.find((o) => o.character.id === e.girl);
      const q = this.practiseQuads.get(e.girl);
      const say = (key, chance = 1) => c.voice.say(key, { force: chance >= 1, urgent: true, chance });
      if (e.type === 'stall') q.engine.stall('practice');
      else if (e.type === 'bite' || e.type === 'caught') this.skills.practice(e.girl, 'starting', w.p.gainScale);
      else if (e.type === 'chokeOff') this.skills.practice(e.girl, 'choke', w.p.gainScale);
      const line = { stall: 'practiseStall', bite: 'practiseBite', chokeOff: 'practiseChoke', chokeLate: 'practiseChokeLate', gaveUp: 'practiseGiveUp', slow: 'practiseSlow' }[e.type];
      if (line) say(line, e.type === 'bite' || e.type === 'chokeOff' ? 0.5 : 1);
      if (e.type === 'off') {
        if (e.keyOff) q.engine.setIgnition(false);
        c.fsm.transition('dismounting');
      }
      if (e.type === 'off' || e.type === 'lost') {
        if (q) {
          q.helperThrottle = 0;
          q.choke = 0;
          q.helperStarter = false;
          q.practising = false;
        }
        this.practiseQuads.delete(e.girl);
      }
    }
    // Her hands on it while she is at it.
    for (const [id, q] of this.practiseQuads) {
      const sitting = w.sitting(id);
      q.practising = sitting; // (the girls don't mind a stall they caused: companionVoice.watchEngines)
      if (!sitting) continue;
      const h = w.controls(id);
      q.helperThrottle = h.throttle;
      q.helperStarter = h.starter;
      q.choke = h.choke;
    }
  }

  // Don't fix it ------------------------------------------------------------

  /** Each frame: a service or repair that takes the wear off a girl's favourite makes her mind. */
  updateDontFix(dt) {
    const units = this.girlUnits.map((u) => ({ id: u.spec.id, wear: u.engine.wear }));
    const girls = this.companions.map((c) => ({ id: c.character.id, favourite: c.voice.favourite, distance: c.root.position.distanceTo(this.player.position) }));
    for (const e of this.dontFix.update(dt, { units, girls })) this.companions.find((c) => c.character.id === e.girl)?.voice.onFixedFavourite();
  }

  // What the girls make of the quads ------------------------------------------

  /** The spec ids of the quads that have a hidden strength (vehicle/strength.js): the only ones the girls have views about. */
  strengthIds() {
    return this.girlUnits.filter((u) => strengthOf(u.spec)).map((u) => u.spec.id);
  }

  /** The truth for a quad and a kind of ground (a share like the strength), which the girls only work out by riding. */
  strengthTruth = (id, kind) => bonusFor(this.girlUnits.find((u) => u.spec.id === id)?.spec, kind);

  /** A girl riding a quad (driving it, or sat behind) up a hill, through mud or along tarmac learns a little of what it is good at. */
  updateStrengthOpinions(dt) {
    for (const c of this.companions) {
      const q = c.quad;
      const spec = q?.unit?.spec;
      if (!spec || !strengthOf(spec) || !(c.fsm.is('driving') || c.fsm.is('seated'))) continue;
      const kind = groundKind(q.groundUnder());
      if (kind) c.opinion.ride(dt, spec.id, kind);
    }
  }

  // Comparing notes --------------------------------------------------------

  /** The girls compare which quads shake them most (npc/comparingNotes.js): each line, Amy's note in her logbook, and the swap to settle it. */
  /** What comparing notes needs to know (npc/comparingNotes.js): the girls and their buzz, and whether anyone else is talking. */
  comparingContext() {
    const exists = (id) => this.girlUnits.some((u) => u.spec.id === id);
    return {
      girls: this.companions.map((c) => ({ id: c.character.id, x: c.root.position.x, z: c.root.position.z, free: c.availability().free, buzz: c.content.buzz })),
      floorFree: this.talkFloor.left <= 0 && !this.banter?.busy && !this.gossip.busy && !this.menu.isOpen,
      only: exists,
    };
  }

  updateComparing(dt) {
    this.runComparing(this.comparing.update(dt, this.comparingContext()));
  }

  runComparing(steps) {
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    for (const s of steps) {
      if (s.type === 'say') {
        if (s.spec) byId[s.girl]?.voice.sayQuad(s.kind, s.spec, { force: true });
        else byId[s.girl]?.voice.say(s.kind, { force: true });
      } else if (s.type === 'note') {
        const names = (this.comparing.last?.ranking ?? []).map((id) => this.girlUnits.find((u) => u.spec.id === id)).filter(Boolean).map((u) => shortName(u.name));
        this.notebook.noteRanking(names.slice(0, 3));
      } else if (s.type === 'swap') {
        // Each goes and sits on the other's pick, if she can.
        for (const [id, spec] of Object.entries(s.picks)) {
          const c = byId[id];
          const q = this.girlUnits.find((u) => u.spec.id === spec)?.quad;
          if (c && q && c.fsm.is('idle') && q.hasPillion && c.mayRide(q) && c.canRidePillion(q) && !c.takenByOther(q)) c.requestBuzzSit(q);
        }
      }
    }
  }

  // Hand on the throttle ---------------------------------------------------

  updateThrottleGrab(dt, ridden) {
    const q = ridden?.quad;
    const girls = this.companions.map((c) => ({ id: c.character.id, onBack: !!q && c.quad === q && c.fsm.is('seated') && c.seatKind === 'pillion' && !c.nap.asleep }));
    const riding = !!q && q.engine.isRunning && !this.menu.isOpen;
    const grab = this.throttleGrab;
    for (const e of grab.update(dt, { riding, speed: Math.abs(q?.forwardSpeed ?? 0), girls })) {
      const c = this.companions.find((o) => o.character.id === e.girl);
      if (e.type === 'start') c.voice.say('grabGo', { force: true });
      else if (e.type === 'end') {
        // Amy apologises (her one go); Jess is pleased with herself.
        if (e.girl === 'amy' || Math.random() < 0.6) c.voice.say('grabSorry', { force: true });
      }
    }
    for (const c of this.companions) {
      const mine = grab.grab?.girl === c.character.id;
      c.pillion.throttleReach = mine ? grab.reach : 0;
    }
    if (q) q.handThrottle = grab.throttle;
    for (const u of this.girlUnits) if (u.quad !== q && u.quad.handThrottle) u.quad.handThrottle = 0;
  }

  // Asleep on the back -----------------------------------------------------

  /** A girl on the pillion seat of the quad you ride drifts off on a smooth ride and wakes with a start on a rough one (npc/backNap.js). */
  updateBackNaps(dt, ridden) {
    const q = ridden?.quad;
    const riding = !!q && q.engine.isRunning && !this.menu.isOpen;
    for (const c of this.companions) {
      const onBack = !!q && c.quad === q && c.fsm.is('seated') && c.seatKind === 'pillion';
      const a = c.pillion.dynamics.accel;
      const events = c.nap.update(dt, {
        onBack,
        riding,
        speed: Math.abs(q?.forwardSpeed ?? 0),
        accel: a.forward,
        jolt: Math.abs(a.up),
        shake: c.voice.level,
        sleepy: c.needs.sleep,
        prone: c.params.napProne,
      });
      for (const e of events) {
        if (e.type === 'asleep') c.nap.side = Math.random() < 0.5 ? -1 : 1;
        else if (e.type === 'wake') this.napWoke(c, e.how);
      }
      c.pillion.nap = c.nap.depth;
      c.pillion.napSide = c.nap.side;
    }
  }

  /** She wakes: with a start for a bump, a brake or a rough engine, gently if the ride stopped or you spoke to her. */
  napWoke(c, how) {
    const start = how === 'jolt' || how === 'brake' || how === 'rough';
    c.voice.say(start ? 'napStart' : 'napGentle', { force: true });
  }

  // Two-stroke smoke ---------------------------------------------------------

  /** A quad in another's dust cloud breathes it (world/dust.js): sets how thick, for its air filter. */
  updateDustClouds() {
    const clouds = this.units.map((u) => ({ x: u.quad.position.x, z: u.quad.position.z, yaw: u.quad.yaw, dust: u.quad.dust }));
    if (!clouds.some((c) => c.dust > 0)) {
      for (const u of this.units) u.quad.dustIn = 0;
      return;
    }
    this.units.forEach((u, i) => {
      u.quad.dustIn = dustExposure(u.quad.position, clouds, this.world.dustParams, clouds[i]);
    });
  }

  updateSmokeSense(dt) {
    const smoke = this.girlUnits[0].smoke.params;
    const girls = this.companions.map((c) => ({ id: c.character.id, x: c.root.position.x, z: c.root.position.z, free: c.availability().canRemark }));
    const quads = this.girlUnits.map((u) => {
      const q = u.quad;
      return { id: u.spec.id, x: q.position.x, z: q.position.z, yaw: q.yaw, twoStroke: q.engine.params.strokes === 2, running: q.engine.isRunning, throttle: q.throttle || q.helperThrottle, temperature: q.engine.temperature };
    });
    for (const e of this.smokeSense.update(dt, { wind: { x: smoke.windX, z: smoke.windZ }, girls, quads })) {
      const c = this.companions.find((o) => o.character.id === e.girl);
      if (e.type === 'cough') {
        // She turns away from it and waves it off (npc/reactions.js); if she can't turn, she just waves.
        const from = this.girlUnits.find((u) => u.spec.id === e.spec)?.quad.position;
        if (!from || !c.react('turnAway', { from })) c.waveOff(this.smokeSense.p.waveFor);
        c.voice.say('smokeCough', { urgent: true });
      } else c.voice.say('smokeLove', { urgent: true, chance: 0.8 });
    }
  }

  /** A girl behind or beside you sees smoke, steam, a soft tyre or a loose silencer on your quad and shouts it (npc/shoutFault.js). */
  updateFaultShout(dt) {
    const unit = this.riddenUnit;
    const q = unit?.quad;
    const e = q?.engine;
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      x: c.root.position.x,
      z: c.root.position.z,
      // Not on your quad, and not busy at the menu or climbing on or off something.
      watching: !this.menu.isOpen && !(c.quad === q && (c.isSeated || c.fsm.is('mounting'))) && c.fsm.is('idle', 'walking', 'driving', 'seated', 'resting'),
    }));
    const signs = q && e.isRunning ? { oil: e.oilRich, steam: e.steam, diesel: e.dieselSoak, tyre: q.faults.levels.puncture, hanging: e.silencerBlown } : {};
    const ctx = { quad: q && e.isRunning ? { x: q.position.x, z: q.position.z, yaw: q.yaw, speed: q.forwardSpeed } : null, signs, girls };
    for (const ev of this.faultShout.update(dt, ctx)) {
      const c = this.companions.find((o) => o.character.id === ev.girl);
      c?.voice.say(`shout${ev.what[0].toUpperCase()}${ev.what.slice(1)}`, { urgent: true });
    }
  }

  /** Idling in the yard builds a haze that still air keeps; the girls stood in it cough and wave it away. */
  updateHaze(dt) {
    const w = this.weather;
    const smoke = this.girlUnits[0].smoke.params;
    const engines = this.units.map((u) => {
      const e = u.quad.engine;
      return { x: u.quad.position.x, z: u.quad.position.z, running: e.isRunning, throttle: e.throttle, twoStroke: e.params.strokes === 2, diesel: !!e.params.runsOnDiesel };
    });
    const girls = this.companions.map((c) => ({ id: c.character.id, x: c.root.position.x, z: c.root.position.z, free: c.availability().canRemark }));
    for (const e of this.haze.update(dt, { wind: w.wind, rain: w.rain, engines, girls })) {
      const c = this.companions.find((o) => o.character.id === e.girl);
      // Turned away from where the wind brings it, if there is a wind to speak of; otherwise she just waves it off.
      const wind = Math.hypot(smoke.windX, smoke.windZ);
      const at = c.root.position;
      const from = wind > 0.3 ? { x: at.x - (smoke.windX / wind) * 5, z: at.z - (smoke.windZ / wind) * 5 } : null;
      if (!from || !c.react('turnAway', { from })) c.waveOff(this.haze.p.waveFor);
      c.voice.say('hazeCough', { urgent: true });
    }
    this.hazeLayer.update(dt, this.haze.level, smoke.windX, smoke.windZ, (x, z) => this.world.heightAt(x, z));
  }

  /** Mist in the barley hollow on a damp cool morning, and a rainbow after a shower with the sun out (world/mist.js). */
  updateMist(dt) {
    const w = this.weather;
    const sun = this.daylight.sun;
    const smoke = this.girlUnits[0].smoke.params;
    this.mist.update(dt, { hour: this.daylight.hour, sunrise: this.daylight.p.sunrise, temperature: w.temperature, wet: w.wet, wind: w.wind, rain: w.rain, snow: w.snow });
    this.mistLayer.update(dt, this.mist.level, smoke.windX, smoke.windZ, (x, z) => this.world.heightAt(x, z), this.mist.p.maxOpacity);
    const sunshine = sun.light * Math.min(1, w.baseSky.sunIntensity / 1.25);
    this.rainbow.update(dt, { rain: w.rain, sunElevation: sun.elevation, sunshine });
    this.rainbowView.update(this.rainbow.strength, sun.dir, this.camera, this.rainbow.p, sun.light);
  }

  /** An engine run in the barn fills it with fumes; free girls inside cough and walk out, and Amy switches it off from the doorway (world/barnFumes.js). */
  updateBarnFumes(dt) {
    const w = this.weather;
    const bs = barnShape(this.world.layout);
    const engines = this.units.map((u) => {
      const q = u.quad;
      const e = q.engine;
      const starter = this.companions.some((c) => c.fsm.is('starting') && c.quad === q);
      return {
        id: u.id, running: e.isRunning, throttle: e.throttle, twoStroke: e.params.strokes === 2, diesel: !!e.params.runsOnDiesel,
        inside: this.world.inBarn(q.position.x, q.position.z), attended: !!(q.rider || q.driver || q.passenger || starter),
      };
    });
    const amy = this.companions.find((c) => c.character.id === 'amy');
    const girls = this.companions.map((c) => ({
      id: c.character.id, free: c.availability().canRemark, inside: this.world.inBarn(c.root.position.x, c.root.position.z),
    }));
    const events = this.barnFumes.update(dt, { wind: w.wind, engines, girls, amyFree: !!amy && amy.availability().free });
    const out = new THREE.Vector3(bs.door.x + 1.4, 0, bs.z);
    for (const e of events) {
      const c = this.companions.find((o) => o.character.id === (e.girl ?? 'amy'));
      if (e.type === 'cough') {
        // Out of the barn doors and into the yard, coughing; a girl on her way to switch it off stays put.
        if (!(e.girl === 'amy' && this.barnFumes.going)) c.recall(new THREE.Vector3(out.x + 2, this.world.heightAt(out.x + 2, out.z), out.z), Math.PI / 2);
        c.voice.say('fumesCough', { urgent: true });
      } else if (e.type === 'amyGoes') {
        c.recall(new THREE.Vector3(out.x, this.world.heightAt(out.x, out.z), out.z), -Math.PI / 2);
        c.voice.say('fumesSwitchOff', { urgent: true });
      } else if (e.type === 'switchOff') {
        this.units.find((u) => u.id === e.engine)?.quad.engine.setIgnition(false);
      } else if (e.type === 'tell') c.voice.say('fumesTell', { urgent: true });
    }
    const smoke = this.girlUnits[0].smoke.params;
    this.barnFumesLayer.update(dt, this.barnFumes.level, Math.max(0, smoke.windX) + 0.3, 0, (x, z) => this.world.heightAt(x, z), 0.3);
  }

  // Reading the dash out -----------------------------------------------------

  updateDashReading(dt, ridden) {
    const q = ridden?.quad;
    const girls = this.companions.map((c) => ({ id: c.character.id, onBack: !!q && c.quad === q && c.fsm.is('seated') && c.seatKind === 'pillion' }));
    const dash = q ? { fuelLamp: !!q.lamps?.fuel, tempLamp: !!q.lamps?.temp, fuelLevel: q.fuel.level, temperature: q.engine.temperature } : {};
    const events = this.dashReader.update(dt, { riding: !!q && q.engine.isRunning && !this.menu.isOpen, girls, dash, speed: Math.abs(q?.forwardSpeed ?? 0), throttle: q?.throttle ?? 0 });
    for (const e of events) this.companions.find((c) => c.character.id === e.girl)?.voice.say(`read${e.what[0].toUpperCase()}${e.what.slice(1)}`, { force: true });
  }

  // Calling them back ------------------------------------------------------

  /** Where each girl stands when called back: in front of the barn doors, side by side. */
  recallSpot(i) {
    const b = this.world.layout.barn;
    const x = b.x + b.halfX + 3;
    const side = this.fallingOut.active ? 3.5 : 1.4; // fallen out, they keep their distance
    return { point: new THREE.Vector3(x, this.world.heightAt(x, b.z + (i === 0 ? -side : side)), b.z + (i === 0 ? -side : side)), facing: Math.PI / 2 };
  }

  /** Stop whatever they're doing and gather by the barn doors. */
  recallGirls() {
    this.race.stand();
    this.drag.stand();
    this.hillClimb.stand();
    this.pitClimb?.stand();
    this.coneCourse.stand();
    this.convoy.stand();
    this.recalling = { left: 120, spots: this.companions.map((c, i) => this.recallSpot(i)), said: false };
    this.hud.toast('Girls: stop what you are doing and come to the barn');
  }

  /**
   * The bell: they hear it anywhere on the farm. Rung while they're already on their way, it just gives them longer to get
   * there, and one who isn't there yet may tell you she heard it the first time.
   */
  ringBell() {
    this.bell.ring();
    this.achievements.note('bell');
    const r = this.recalling;
    if (!r) return this.recallGirls();
    r.left = 120;
    if (!r.said) return;
    const late = this.companions.filter((c, i) => !this.recallArrived(c, r.spots[i]));
    late[Math.floor(Math.random() * late.length)]?.voice.say('bellAgain', { chance: 0.6 });
  }

  recallArrived(c, spot) {
    return c.fsm.is('idle') && c.root.position.distanceTo(spot.point) < 2.5;
  }

  /** Tells whichever ride she is in (a cab, the tractor's arch, the tipping trailer) that she is leaving, so it doesn't send her back. */
  leaveRides(c) {
    const t = c.trailer;
    if (!t || !c.onHayRide) return;
    const id = c.character.id;
    for (const kind of ['utv', ...CAB_KINDS]) if (this.goVehicle(kind) && this.mountOfKind(kind) === t) this.rideOfKind(kind).dismiss(id);
    if (t === this.tractorMount) this.mudguard.dismiss(id);
    if (t === this.tipTrailer) this.tipRide.dismiss(id);
  }

  /** Keeps at it until each is there (a girl mid-change gets another nudge), or two minutes have gone. */
  updateRecall(dt) {
    const r = this.recalling;
    if (!r) return;
    r.left -= dt;
    r.nudge = (r.nudge ?? 0) - dt;
    let waiting = false;
    this.companions.forEach((c, i) => {
      if (this.recallArrived(c, r.spots[i])) return;
      waiting = true;
      if (r.nudge <= 0) {
        this.leaveRides(c);
        c.recall(r.spots[i].point, r.spots[i].facing);
      }
    });
    if (r.nudge <= 0) {
      r.nudge = 0.7;
      if (!r.said) {
        r.said = true;
        for (const c of this.companions) c.voice.say('recalled', { force: true });
      }
    }
    if (!waiting || r.left <= 0) this.recalling = null;
  }

  // Tea on the rack ----------------------------------------------------------

  /** What tea on the rack needs to know (npc/tea.js): the girls and the quads with racks. */
  teaContext(ridden) {
    const girls = this.companions.map((c) => ({ id: c.character.id, free: c.availability().free, x: c.root.position.x, z: c.root.position.z }));
    const quads = this.girlUnits.map((u) => {
      const q = u.quad;
      return { id: u.spec.id, x: q.position.x, z: q.position.z, speed: Math.abs(q.speed), rider: u === ridden, driver: this.quadUser(u, ridden) !== 'you' ? this.quadUser(u, ridden) : null, tipped: q.isTipped, hasRack: !!q.mugAnchor };
    });
    return { girls, quads };
  }

  updateTea(dt, ridden) {
    for (const e of this.tea.update(dt, this.teaContext(ridden))) this.handleTeaEvent(e);
    this.mugs.update(dt);
  }

  /** The loose state of this model on its vehicle (vehicle/looseThings.js), made when first asked for; loading a bed clears it (CargoHold.load). */
  looseOf(model) {
    return (model.userData.loose ??= newLoose());
  }

  /** A mug on a rack creeps with the shake of the quad under it, and goes over the edge in the end. */
  updateLooseMugs(dt) {
    for (const [girl, mug] of Object.entries(this.teaMugs)) {
      const spec = this.tea.mugOf(girl)?.spec;
      const unit = this.units.find((u) => u.spec.id === spec);
      if (!unit || mug.parent !== unit.quad.mugAnchor) continue;
      const s = creepStep(this.looseOf(mug), dt, unit.vibration.intensity, this.loose.p);
      mug.position.set(s.x, 0, s.z);
      if (offRack(s, this.loose.p)) {
        const e = this.tea.shaken(girl);
        if (e) this.handleTeaEvent(e);
      }
    }
  }

  /** What stands in a bed shuffles about its spot with the shake of the vehicle, and a can shaken hard for long enough goes over. */
  updateLooseBed(hold, quad, dt) {
    const shake = quad.unit?.vibration?.intensity ?? 0;
    for (const item of hold.items) {
      if (!hold.holds(item)) continue;
      const m = item.model;
      const s = this.looseOf(m);
      shuffleStep(s, dt, shake, this.loose.p);
      if (m.name === 'jerryCan') tipStep(s, dt, shake, this.loose.p);
      const yaw = hold.yawFor(item) + s.twist;
      m.position.set(s.x, s.tipped ? 0.18 : 0, s.z); // on its side it sits half its width up
      m.rotation.order = 'YXZ';
      m.rotation.set(0, yaw, s.tipped ? Math.PI / 2 : 0);
    }
  }

  /** Acts on tea on the rack (npc/tea.js): putting a mug down (a choice she made, or the debug panel's), collecting it, losing it. */
  handleTeaEvent(e) {
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const unitOf = (spec) => this.girlUnits.find((u) => u.spec.id === spec);
    // A girl walks to the back of the quad, pauses, and does it (the same walk-up as for a prank).
    const sendTo = (girl, spec, act) => {
      const quad = unitOf(spec).quad;
      const c = byId[girl];
      const side = c.nearSide(quad);
      const p = quad.localToWorld(side * 0.85, 0, -0.95);
      const spot = { x: p.x, z: p.z };
      if (c.sneakTo(spot, act)) return true;
      this.tea.cancel(girl);
      return false;
    };
    const c = byId[e.girl];
    if (e.type === 'place') {
      // She brings a mug from the house in her hand, walks round to the back of the quad and sets it on the rack.
      const colour = e.girl === 'amy' ? 0x3a6ea5 : 0xb8322a;
      const mug = this.mugs.make(colour);
      mug.position.copy(c.root.position);
      if (!c.startCarry('mug', mug, carryWeight('mug'), { inHand: true })) {
        this.mugs.remove(mug);
        this.tea.cancel(e.girl);
        return;
      }
      c.voice.say('teaGo', { urgent: true, chance: 0.7 });
      const going = sendTo(e.girl, e.spec, () => {
        const u = unitOf(e.spec);
        const free = !u.quad.rider && !u.quad.driver && Math.abs(u.quad.speed) < 0.3;
        const rack = free && u.quad.mugAnchor?.getWorldPosition(new THREE.Vector3());
        if (!rack) {
          c.endCarry();
          this.mugs.remove(mug);
          return this.tea.cancel(e.girl);
        }
        c.putDownCarry(rack, 0, () => {
          if (!this.mugs.putMug(u.quad, mug)) return this.mugs.remove(mug);
          this.teaMugs[e.girl] = mug;
          this.tea.placed(e.girl, e.spec);
          c.voice.say('teaPlace', { urgent: true, chance: 0.9 });
        });
      });
      if (!going) {
        c.endCarry();
        this.mugs.remove(mug);
      }
    } else if (e.type === 'collect') {
      sendTo(e.girl, e.spec, () => {
        const u = unitOf(e.spec);
        const mug = this.teaMugs[e.girl];
        if (u.quad.rider || u.quad.driver || Math.abs(u.quad.speed) > 0.3 || !mug) return this.tea.cancel(e.girl);
        // She lifts it off the rack, has a drink, and that's the end of it.
        delete this.teaMugs[e.girl];
        this.tea.collected(e.girl);
        c.startCarry('mug', mug, carryWeight('mug'), {
          sip: true,
          onSipped: () => {
            const side = c.root.localToWorld(new THREE.Vector3(-0.35, 0, 0.3));
            c.putDownCarry(side, 0, () => this.mugs.remove(mug));
          },
        });
        c.voice.say('teaCollect', { urgent: true, chance: 0.8 });
      });
    } else if (e.type === 'fall') {
      const q = unitOf(e.spec).quad;
      this.mugs.drop(this.teaMugs[e.girl], q.velocity);
      delete this.teaMugs[e.girl];
      c.voice.say(e.shaken ? 'teaShaken' : 'teaFell', { force: true });
    }
  }


  // Flask at the top of the hill ------------------------------------------------

  /** The rock's seat as a rest spot (a girl sits on it like a bale) and the E prompt at it; the rock itself is built with the hill's props. */
  setupFlask() {
    const v = this.world.layout.hill?.viewpoint;
    this.flaskSpot = v ? { id: 'viewpoint', kind: 'rock', x: v.x, z: v.z, yaw: v.yaw, seat: v.height + 0.08 } : null;
    if (!v) return;
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 1.6), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.set(v.x, this.world.heightAt(v.x, v.z) + 0.5, v.z);
    proxy.rotation.y = v.yaw;
    this.scene.add(proxy);
    this.interaction.add({
      target: proxy,
      isAvailable: () => !this.handsFull && !this.player.isRiding && !this.flask.active && !!this.flaskGirl(),
      prompt: () => `Sit down with ${this.flaskGirl().name} and have a cup of tea from the flask`,
      feedback: 'own',
      interact: () => this.askForFlask(),
    });
  }

  /** The girl you'd share the flask with: the nearest one close enough, stood about or sat on a quad you've left. */
  flaskGirl() {
    const v = this.flaskSpot;
    if (!v || !this.fineForFlask()) return null;
    const near = this.companions
      .filter((c) => c.root.position.distanceTo(this.player.position) <= this.flask.p.askRange)
      .filter((c) => c.availability({ asked: true }).free || (c.fsm.is('seated') && c.quad && Math.abs(c.quad.speed) < 0.5))
      .sort((a, b) => a.root.position.distanceTo(this.player.position) - b.root.position.distanceTo(this.player.position));
    return near[0] ?? null;
  }

  fineForFlask() {
    return this.flask.fine({ rain: this.weather.rain, darkness: this.daylight?.darkness ?? 0 });
  }

  /** The weather as the flask module wants it. */
  flaskWeather() {
    const w = this.weather;
    return { rain: w.rain, darkness: this.daylight?.darkness ?? 0, cold: w.warmth < 0.5, sunny: w.name === 'sunny' || w.name === 'sunny intervals' };
  }

  /** E at the rock: the girl beside you sits down with the flask. */
  askForFlask(girl = this.flaskGirl()) {
    if (!girl || this.flask.active) return false;
    const e = this.flask.begin(girl.character.id, 'asked', { seated: girl.fsm.is('seated') });
    if (!e) return false;
    this.handleFlaskEvent(e);
    return true;
  }

  /** What the flask needs to know (npc/flask.js) to suggest it: the girls' distance from the rock, and you. */
  flaskContext(ridden) {
    const v = this.flaskSpot;
    if (!v) return { girls: [], youDistance: Infinity, youSlow: false, weather: this.flaskWeather() };
    const girls = this.companions.map((c) => ({ id: c.character.id, free: c.availability().free, distance: Math.hypot(c.root.position.x - v.x, c.root.position.z - v.z) }));
    const speed = ridden ? Math.abs(ridden.quad.speed) : 0;
    return { girls, youDistance: Math.hypot(this.player.position.x - v.x, this.player.position.z - v.z), youSlow: speed < 2, weather: this.flaskWeather() };
  }

  updateFlask(dt) {
    const v = this.flaskSpot;
    const id = this.flask.girl;
    const c = id && this.companions.find((o) => o.character.id === id);
    const ctx = {
      girl: c ? { free: c.availability({ asked: true, mine: 'flask' }).free, seated: c.isResting && c.restPhase === 'sat' && c.restSpot === v, x: c.root.position.x, z: c.root.position.z } : null,
      youDistance: v ? Math.hypot(this.player.position.x - v.x, this.player.position.z - v.z) : Infinity,
      favoured: !!id && this.favour.mood(id) === 'favoured',
      weather: this.flaskWeather(),
    };
    for (const e of this.flask.update(dt, ctx)) this.handleFlaskEvent(e);
  }

  /** Acts on the flask (npc/flask.js): she gets off or goes to the rock, the tea comes out, she speaks, it ends. */
  handleFlaskEvent(e) {
    const c = this.companions.find((o) => o.character.id === e.girl);
    const v = this.flaskSpot;
    if (!c || !v) return this.flask.cancel();
    if (e.type === 'getOff') {
      c.hold('flask', 'having tea at the top of the hill');
      c.voice.say('flaskYes', { force: true });
      c.requestStandBeside(c.quad); // then update sends her up to the rock once she's on her feet
    } else if (e.type === 'go') {
      c.hold('flask', 'having tea at the top of the hill');
      if (e.how) c.voice.say(e.how === 'offer' ? 'flaskOffer' : 'flaskYes', { force: true });
      if (!c.goRest(v, { stay: Infinity })) {
        c.release('flask');
        this.flask.cancel();
      }
    } else if (e.type === 'pour') {
      this.putOutFlask();
    } else if (e.type === 'say') {
      c.voice.say(e.line, { force: true });
    } else if (e.type === 'end') {
      c.release('flask');
      if (c.isResting) c.leaveRest();
      this.clearFlask();
      if (e.why === 'done') {
        this.favour.add(e.girl, this.flask.p.favour + (this.favour.mood(e.girl) === 'favoured' ? this.flask.p.romanceFavour : 0));
        this.achievements.note('flask');
      }
    }
  }

  /** The flask and two mugs on the ground beside the rock, in its own frame. */
  putOutFlask() {
    this.clearFlask();
    const v = this.flaskSpot;
    const group = new THREE.Group();
    group.position.set(v.x, this.world.heightAt(v.x, v.z), v.z);
    group.rotation.y = v.yaw;
    const flask = this.mugs.makeFlask();
    const mugs = [this.mugs.make(0x3a6ea5), this.mugs.make(0xb8322a)];
    [[flask, 1.15, 0.55], [mugs[0], 0.9, 0.7], [mugs[1], 1.35, 0.75]].forEach(([o, x, z]) => {
      group.add(o);
      o.position.set(x, 0, z);
    });
    this.scene.add(group);
    this.flaskSet = group;
  }

  clearFlask() {
    if (!this.flaskSet) return;
    this.scene.remove(this.flaskSet);
    this.flaskSet = null;
  }

  // Jumpers from the barn ------------------------------------------------------

  /** What jumpers need to know (npc/jumpers.js): the weather, the girls and the rail. */
  jumpersContext() {
    const girls = this.companions.map((c) => ({ id: c.character.id, free: c.availability().free, x: c.root.position.x, z: c.root.position.z }));
    return { weather: this.weather, girls, rail: this.world.layout.jumperRail };
  }

  updateJumpers(dt) {
    for (const e of this.jumpers.update(dt, this.jumpersContext())) this.handleJumperEvent(e);
  }

  /** Acts on jumpers (npc/jumpers.js): fetching one (a choice she made, or asked), hanging it back up. */
  handleJumperEvent(e) {
    if (!e) return;
    const c = this.companions.find((o) => o.character.id === e.girl);
    const rail = this.world.layout.jumperRail;
    const colour = this.jumpers.colourOf(e.jumper);
    const act = e.type === 'fetch'
      ? () => {
          this.jumpers.dressed(e.girl, e.jumper);
          c.setJumper(colour);
          c.voice.say('jumperOn', { urgent: true, chance: 0.9 });
          this.showRack();
        }
      : () => {
          this.jumpers.hung(e.girl);
          c.setJumper(null);
          c.voice.say('jumperOff', { urgent: true, chance: 0.8 });
          this.showRack();
        };
    // In and out through the big doors: they're on the +x side, so go through the doorway first (and back out through it after).
    const door = rail.door;
    if (!c.sneakTo(rail.stand, act, 2.6, { via: door.in, out: door.out })) this.jumpers.cancel(e.girl);
  }


  // Wax jackets from the barn ---------------------------------------------------

  /** Fetching and hanging up a coat (only while the girls are left to themselves), and her hood up or down with the rain. */
  updateCoats(dt, auto) {
    const ctx = this.jumpersContext();
    if (auto) for (const e of this.coats.update(dt, ctx)) this.handleCoatEvent(e);
    else this.coats.clock += dt;
    const girls = this.companions.map((c) => {
      const id = c.character.id;
      const inClosed = !!c.quad && c.fsm.is('mounting', 'driving', 'seated', 'shuffling') && !this.girlRide(c);
      return { id, helmet: this.headgear.wearing(id), covered: !!c.coveredNow || inClosed };
    });
    for (const e of this.coats.updateHoods(this.weather.rain, girls)) {
      const c = this.companions.find((o) => o.character.id === e.girl);
      c.setHood(e.up);
      if (e.up) c.voice.say('hoodUp', { chance: 0.5 });
    }
  }

  /** Acts on coats (npc/coats.js) as on jumpers: to the rack through the big doors, then on or off. */
  handleCoatEvent(e) {
    if (!e) return;
    const c = this.companions.find((o) => o.character.id === e.girl);
    const rail = this.world.layout.jumperRail;
    const act = e.type === 'fetch'
      ? () => {
          this.coats.dressed(e.girl, e.jumper);
          c.setCoat(this.coats.colourOf(e.jumper));
          c.voice.say('coatOn', { urgent: true, chance: 0.9 });
          this.showRack();
        }
      : () => {
          this.coats.hung(e.girl);
          c.setCoat(null);
          c.voice.say('coatOff', { urgent: true, chance: 0.8 });
          this.showRack();
        };
    const door = rail.door;
    if (!c.sneakTo(rail.stand, act, 2.6, { via: door.in, out: door.out })) this.coats.cancel(e.girl);
  }

  /** What hangs on the rack: the jumpers and coats nobody has on. */
  showRack() {
    this.jumperRail.show([...this.jumpers.onRail(), ...this.coats.onRail()].map((j) => j.id));
  }

  // Helmets and goggles -----------------------------------------------------

  /** Which open vehicle (its unit) a girl is sat on or driving, or null (npc/headgear.js is about those). */
  girlRide(c) {
    if (!c.quad || !c.fsm.is('mounting', 'driving', 'seated', 'shuffling')) return null;
    const unit = this.units.find((u) => u.quad === c.quad);
    return unit && isOpenVehicle(unit.spec.id) ? unit : null;
  }

  /** What helmets need to know (npc/headgear.js): the girls, what they're on and the vehicles' speeds. */
  headgearContext() {
    const girls = this.companions.map((c) => {
      const ride = this.girlRide(c);
      const p = c.params;
      return {
        id: c.character.id, free: c.availability().free, riding: !!ride, vehicle: ride?.id ?? null, x: c.root.position.x, z: c.root.position.z,
        weight: p.helmetWeight, leave: p.helmetLeave, ground: p.helmetGround,
      };
    });
    const vehicles = {};
    for (const u of this.units) vehicles[u.id] = { speed: u.quad.speed, x: u.quad.position.x, z: u.quad.position.z };
    return { girls, vehicles, hooks: this.world.layout.helmetHooks };
  }

  updateHeadgear(dt, ridden) {
    for (const e of this.headgear.update(dt, this.headgearContext())) this.handleHeadgearEvent(e);
    this.syncHelmets();
    // Amy minding your bare head, and liking it when you wear one.
    const open = !!ridden && isOpenVehicle(ridden.spec.id);
    const here = this.player.isRiding && ridden ? ridden.quad.position : this.player.position;
    const e = this.headgear.watch(dt, {
      riding: open,
      speed: open ? ridden.quad.forwardSpeed : 0,
      girls: this.companions.map((c) => ({
        id: c.character.id,
        nags: c.params.helmetNags > 0,
        canRemark: c.availability().canRemark || !!this.girlRide(c),
        dist: Math.hypot(c.root.position.x - here.x, c.root.position.z - here.z),
      })),
    });
    if (e) {
      const c = this.companions.find((o) => o.character.id === e.girl);
      if (e.type === 'nag') c.voice.say('helmetNag', { urgent: true, force: true });
      else {
        c.voice.say('helmetPraise', { urgent: true, chance: 0.9 });
        this.favour.add(e.girl, this.headgear.p.praiseFavour);
      }
    }
    this.gogglesOverlay.update(this.headgear.you, open && !this.menu.isOpen);
  }

  /** Acts on helmets (npc/headgear.js): a girl going to the hooks to take hers down (a choice she made, or asked) or hang it back up, and a fall. */
  handleHeadgearEvent(e) {
    if (!e) return;
    const c = this.companions.find((o) => o.character.id === e.girl);
    if (e.type === 'drop') return void c.voice.say('helmetFell', { chance: 0.7 });
    if (e.type === 'don' && e.from === 'rack') return void this.helmetHooks.show(this.headgear.onHooks());
    if (e.type !== 'fetch' && e.type !== 'hang') return;
    const hooks = this.world.layout.helmetHooks;
    const act = e.type === 'fetch'
      ? () => {
          this.headgear.put(e.girl);
          c.voice.say('helmetOn', { urgent: true, chance: 0.9 });
          this.helmetHooks.show(this.headgear.onHooks());
        }
      : () => {
          this.headgear.leave(e.girl, 'rack');
          this.helmetHooks.show(this.headgear.onHooks());
        };
    if (!c.sneakTo(hooks.stand, act, 2.6, { via: hooks.door.in, out: hooks.door.out })) this.headgear.cancel(e.girl);
  }

  /** Puts each girl's helmet where headgear.js says it is: on her head, on a seat, on the ground, or not out. */
  syncHelmets() {
    for (const c of this.companions) {
      const id = c.character.id;
      const g = this.headgear.girl(id);
      this.helmetView.setWorn(id, g.place === 'head', id === 'jess' && !g.riding, this.headgear.p.helmetFit * c.params.helmetSize, this.headgear.p.helmetLift + c.params.helmetRaise);
      c.setUnderHelmet(g.place === 'head'); // her ponytail out under the back of it
      let where = null;
      let key = '';
      if (g.place === 'ground') {
        where = { x: g.x, z: g.z };
        key = `g${g.x.toFixed(1)},${g.z.toFixed(1)}`;
      } else if (g.place === 'seat') {
        const unit = this.units.find((u) => u.id === g.vehicle);
        const anchor = unit?.quad.riderAnchor;
        if (anchor) {
          const local = unit.quad.model.worldToLocal(anchor.getWorldPosition(new THREE.Vector3()));
          where = { parent: unit.quad.model, local: local.add(new THREE.Vector3(0, 0.06, -0.3)), yaw: 0 };
          key = `s${g.vehicle}`;
        } else {
          g.place = 'ground'; // nowhere to rest it on that vehicle: it goes on the floor beside it
          g.x = unit?.quad.position.x ?? g.x;
          g.z = unit?.quad.position.z ?? g.z;
        }
      }
      if (this.helmetSeen[id] !== key) {
        this.helmetSeen[id] = key;
        this.helmetView.setLoose(id, where);
      }
    }
  }

  hookPrompt(what) {
    const y = this.headgear.you;
    return what === 'you' ? (y.helmet ? 'Hang your helmet up' : 'Put your helmet on') : y.goggles ? 'Hang your goggles up' : 'Put your goggles on';
  }

  /** E at the hooks, and the debug panel and console: yours on or off. */
  toggleYourGear(what) {
    const on = what === 'you' ? this.headgear.toggleHelmet() : this.headgear.toggleGoggles();
    this.helmetHooks.show(this.headgear.onHooks());
    const name = what === 'you' ? 'helmet' : 'goggles';
    this.hud.toast(on ? `Put your ${name} on` : `Hung your ${name} up`, 1.4);
    if (on && what === 'goggles') {
      const c = this.companions.find((o) => Math.hypot(o.root.position.x - this.player.position.x, o.root.position.z - this.player.position.z) < 14 && o.availability().canRemark);
      c?.voice.say('gogglesOn', { chance: 0.7 });
    }
    return on;
  }

  // Red diesel by mistake ----------------------------------------------------

  /** Jess takes the diesel can to a low quad and pours it in; Amy, near enough to see, tells her off. */
  /** What the red diesel mistake needs to know (npc/dieselMistake.js): the girls and the quads' tanks. */
  dieselContext(ridden) {
    const girls = this.companions.map((c) => ({ id: c.character.id, free: c.availability().free, x: c.root.position.x, z: c.root.position.z }));
    const quads = this.girlUnits.map((u) => {
      const q = u.quad;
      return { id: u.spec.id, x: q.position.x, z: q.position.z, speed: Math.abs(q.speed), rider: u === ridden, driver: this.quadUser(u, ridden) !== 'you' ? this.quadUser(u, ridden) : null, tipped: q.isTipped, space: q.fuel.space, level: q.fuel.level };
    });
    return { girls, quads };
  }

  /** Acts on the red diesel mistake (npc/dieselMistake.js): Jess going to pour (a choice she made, or the debug panel's). */
  handleDieselEvent(e) {
    if (!e) return;
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const m = this.dieselMistake;
    const unitOf = (spec) => this.girlUnits.find((u) => u.spec.id === spec);
    const c = byId[e.girl];
    const quad = unitOf(e.spec).quad;
    const p = quad.localToWorld(c.nearSide(quad) * 0.85, 0, -0.95);
    const stay = m.p.pourSeconds + 1.6;
    const set = c.sneakTo({ x: p.x, z: p.z }, () => {
      if (quad.rider || quad.driver || Math.abs(quad.speed) > 0.3 || quad.isTipped) return m.finished();
      m.started();
      this.dieselJob = { spec: e.spec, left: m.p.pourSeconds, rate: m.p.litres / m.p.pourSeconds, girl: e.girl };
      c.voice.say('dieselPour', { urgent: true, chance: 0.9 });
      const amy = byId.amy;
      if (amy && amy !== c && amy.root.position.distanceTo(quad.position) < m.p.amyRange && Math.random() < m.p.amyChance) {
        setTimeout(() => {
          if (!this.dieselJob) return;
          if (amy.voice.say('dieselCaught', { force: true })) setTimeout(() => c.voice.say('dieselCaughtReply', { force: true }), 3500);
        }, 2500);
      }
    }, stay);
    if (!set) m.finished();
  }

  updateDieselMistake(dt, ridden) {
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const m = this.dieselMistake;
    const unitOf = (spec) => this.girlUnits.find((u) => u.spec.id === spec);
    for (const e of m.update(dt, this.dieselContext(ridden))) this.handleDieselEvent(e);
    const job = this.dieselJob;
    if (job) {
      const u = unitOf(job.spec);
      const c = byId[job.girl];
      const stillThere = c.root.position.distanceTo(u.quad.position) < 3.5 && !u.quad.rider && !u.quad.driver && Math.abs(u.quad.speed) < 0.3;
      if (stillThere && job.left > 0) {
        job.left -= dt;
        u.quad.fuel.add(job.rate * dt, 0, 1);
      } else {
        this.dieselJob = null;
        m.finished();
      }
    }
  }

  // Nicking your quad ---------------------------------------------------------

  /** She takes this quad off for a while; Amy, if she sees it go, objects. */
  startNick(c, quad) {
    c.nickQuad(quad, { seconds: this.nicking.awayFor(), returnSpeed: this.nicking.p.returnSpeed });
    setTimeout(() => {
      const amy = this.companions.find((o) => o !== c && o.fsm.is('idle') && o.root.position.distanceTo(quad.position) < 60);
      amy?.voice.say('nickWatch', { urgent: true });
    }, 3000);
  }

  /** What nicking your quad needs to know (npc/nicking.js): what you're riding, where you are, the quads and the girls. */
  nickContext(ridden) {
    const quads = this.girlUnits.map((u) => {
      const q = u.quad;
      const claimed = this.companions.some((c) => c.quad === q && c.fsm.is('walking', 'starting'));
      return { id: u.spec.id, x: q.position.x, z: q.position.z, running: q.engine.isRunning, free: !q.rider && !q.driver && !q.passenger && !q.isTipped && !q.isGhostRiding && !this.herOn(q) && !claimed };
    });
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      x: c.root.position.x,
      z: c.root.position.z,
      free: c.availability().free,
      chance: c.params.nickChance ?? 0,
    }));
    const you = { x: this.player.position.x, z: this.player.position.z };
    return { riding: ridden?.spec.id ?? null, you, quads, girls };
  }

  /** Acts on nicking your quad (npc/nicking.js): Jess taking it (her choice). */
  handleNickEvent(e) {
    const c = this.companions.find((o) => o.character.id === e.girl);
    const quad = this.girlUnits.find((u) => u.spec.id === e.spec).quad;
    if (!c.takenByOther(quad, 'rider') && c.canDrive(quad)) this.startNick(c, quad);
  }

  updateNicking(dt, ridden) {
    const np = this.nicking.p;
    this.nicking.update(dt, this.nickContext(ridden));
    // While she has it: tearing it up (the mud it comes back in), burning fuel, and laughing. A job that has come to nothing
    // (you got back on, or she gave up) is dropped.
    for (const c of this.companions) {
      const job = c.nickJob;
      if (!job) continue;
      if (c.fsm.is('idle', 'seated', 'resting')) {
        c.nickJob = null;
        continue;
      }
      if (job.phase !== 'away' || !c.fsm.is('driving')) continue;
      job.quad.churn = np.churn;
      job.quad.fuel.litres = Math.max(0, job.quad.fuel.litres - np.extraBurn * dt);
      job.laughed += dt;
      if (job.laughed > np.laughGap) {
        job.laughed = 0;
        c.voice.say('nickLaugh', { urgent: true, chance: 0.8 });
      }
    }
  }

  // The jump ------------------------------------------------------------------

  /** Whether the line from the run-up to well past the landing is free of parked quads, you and the other girl (not the quad she's going to take). */
  jumpLineClear(girl, ramp, jp) {
    const others = [...this.girlUnits.map((u) => u.quad.position), this.player.position, ...this.companions.filter((o) => o !== girl).map((o) => o.root.position)];
    for (let along = -jp.runUp; along <= ramp.length + 24; along += 3) {
      const pt = rampPoint(ramp, along);
      if (others.some((o) => Math.hypot(o.x - pt.x, o.z - pt.z) < 3)) return false;
    }
    return true;
  }

  updateJumps(dt) {
    const ramp = this.world.layout.jumpRamp;
    if (!ramp) return;
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const jumper = this.companions.find((c) => c.fsm.is('driving') && c.drive?.jump);
    // New landings: the jumper has her own thing to say, the other girl rates it a moment later.
    for (const c of this.companions) {
      const run = c.fsm.is('driving') ? c.drive?.jump?.run : null;
      if (!run) {
        c.jumpSeen = 0;
        continue;
      }
      for (; (c.jumpSeen ?? 0) < run.results.length; c.jumpSeen = (c.jumpSeen ?? 0) + 1) {
        const r = run.results[c.jumpSeen];
        this.jumpWatch.landed(c.character.id, r.rating);
        this.lastJump = { girl: c.character.id, ...r };
        c.voice.say(`jumpLand_${r.rating}`, { urgent: true, force: r.rating === 'bail' });
      }
    }
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      free: c.availability().free,
      distance: Math.hypot(c.root.position.x - ramp.x, c.root.position.z - ramp.z),
    }));
    for (const e of this.jumpWatch.update(dt, { jumper: jumper?.character.id ?? null, girls })) {
      const c = byId[e.girl];
      if (e.type === 'rate') c.voice.say(`jumpRate_${e.rating}`, { urgent: true });
      else if (e.type === 'turn') this.sendToRamp(c, 'jumpTurn');
    }
  }

  /** Sends a girl (who is stood about) to take a quad to the ramp. Returns whether she went. */
  sendToRamp(c, line) {
    if (!c.fsm.is('idle')) return false;
    const quads = this.girlUnits.filter((u) => c.mayRide(u.quad) && c.canDrive(u.quad) && !u.quad.tractor && !c.takenByOther(u.quad) && !this.herOn(u.quad) && u !== this.riddenUnit).map((u) => u.quad);
    quads.sort((a, b) => (c.ownsQuad(b) ? 1 : 0) - (c.ownsQuad(a) ? 1 : 0) || a.position.distanceTo(c.root.position) - b.position.distanceTo(c.root.position));
    const plan = c.jumpPlan();
    if (!quads.length || !plan) return false;
    if (line) c.voice.say(line, { force: true });
    setTimeout(() => {
      if (c.fsm.is('idle')) c.requestDrive(quads[0], { jump: plan });
    }, 2000);
    return true;
  }

  // The tarmac -----------------------------------------------------------------

  /** Jess egging you on and Amy telling you off for squealing the tyres, while you ride the farm road. */
  updateTarmac(dt) {
    const road = this.world.layout.road;
    const unit = this.riddenUnit;
    const q = unit?.quad;
    let you = null;
    if (q && road) {
      const v = q.physics.body.linvel();
      const forward = v.x * Math.sin(q.yaw) + v.z * Math.cos(q.yaw);
      const sideways = v.x * Math.cos(q.yaw) - v.z * Math.sin(q.yaw);
      const on = onTarmac(road, q.position.x, q.position.z);
      const speed = Math.abs(q.speed);
      you = { onRoad: on, speed, squeal: on ? squealLevel(this.world.squealParams, { tarmac: 1, slip: slipAngle(forward, sideways), speed, brake: q.brake ?? 0, spin: q.physics.traction?.spin ?? 0 }) : 0 };
    }
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      free: c.availability().free,
      role: c.fsm.is('driving') ? 'driving' : q && c.fsm.is('seated') && c.seatKind === 'pillion' && c.quad === q ? 'pillion' : null,
      onRoad: onTarmac(road, c.root.position.x, c.root.position.z),
      distance: q ? Math.hypot(c.root.position.x - q.position.x, c.root.position.z - q.position.z) : Infinity,
    }));
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    for (const e of this.tarmacWatch.update(dt, { you, girls })) byId[e.girl].voice.say(e.type === 'egg' ? 'roadEgg' : 'roadScold', { urgent: true });
  }

  // Doughnuts ----------------------------------------------------------------

  updateDoughnuts(dt) {
    const spinner = this.companions.find((c) => c.fsm.is('driving') && c.drive?.doughnut?.spinning);
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      free: c.availability().free,
      distance: spinner ? c.root.position.distanceTo(spinner.root.position) : Infinity,
    }));
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    for (const e of this.doughnutWatch.update(dt, { spinner: spinner?.character.id ?? null, girls })) {
      const c = byId[e.girl];
      if (e.type === 'watch') c.voice.say('doughnutWatch', { urgent: true });
      else if (e.type === 'join') {
        c.voice.say('doughnutJoin', { force: true });
        setTimeout(() => {
          if (!c.fsm.is('idle')) return;
          const quads = this.girlUnits.filter((u) => c.mayRide(u.quad) && c.canDrive(u.quad) && !c.takenByOther(u.quad) && !this.herOn(u.quad) && u !== this.riddenUnit).map((u) => u.quad);
          const quad = quads.find((q) => c.ownsQuad(q)) ?? quads[0];
          const plan = c.doughnutPlan(1.3);
          if (quad && plan) c.requestDrive(quad, { doughnut: plan });
        }, 2500);
      }
    }
    // The ground a quad has been torn up with stays marked for a good while, not the usual forty seconds.
    for (const u of this.girlUnits) {
      if (u.quad.churn > 0 && !u.torn) {
        u.torn = true;
        u.mud.ruts.uniforms.uGrassLife.value = 240;
        u.mud.ruts.uniforms.uGrassAlpha.value = 0.5;
      }
    }
  }

  // Follow the leader --------------------------------------------------------

  /** What follow the leader needs to know (npc/convoy.js): who is free, which quads each could take, and whether anything else is on. */
  convoyContext(ridden) {
    const girls = this.companions.map((c) => ({ id: c.character.id, free: c.availability().free }));
    const options = {};
    for (const c of this.companions) {
      options[c.character.id] = this.girlUnits.filter((u) => u !== ridden && c.mayRide(u.quad) && c.canDrive(u.quad) && !c.takenByOther(u.quad) && !this.herOn(u.quad) && !u.quad.bog.stuck).map((u) => u.spec.id);
    }
    return { girls, options, claims: this.ownership.claims, busy: this.race.active || this.drag.active || !!this.recalling || this.fallingOut.active };
  }

  /** Acts on follow the leader (npc/convoy.js): the invite (one of them suggested it), the follower overtaking, the end. */
  handleConvoyEvent(e) {
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const cv = this.convoy;
    if (e.type === 'invite') {
      byId[e.leader].voice.say('convoyInvite', { force: true });
      setTimeout(() => byId[e.follower]?.voice.say('convoyAccept', { force: true }), 3500);
      const quadOf = (id) => this.girlUnits.find((u) => u.spec.id === e.picks[id]).quad;
      byId[e.leader].requestDrive(quadOf(e.leader), { convoyLead: true });
      byId[e.follower].requestDrive(quadOf(e.follower), { follow: true, followWho: () => quadOf(e.leader) });
    } else if (e.type === 'swap') {
      // The follower is to overtake whoever is in front.
      const f = byId[e.follower];
      if (!f.drive?.startPass()) cv.passFailed();
    } else if (e.type === 'end') {
      for (const c of this.companions) if (c.fsm.is('driving') && c.drive && !c.drive.done) c.drive.endActivity();
    }
  }

  updateConvoy(dt, ridden) {
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    this.updateRaceYou(dt, ridden);
    const cv = this.convoy;
    // A girl who has stopped or finished driving ends it for both: nobody is left leading nobody.
    if (cv.active) {
      for (const id of Object.keys(cv.picks ?? {})) {
        const c = byId[id];
        const busy = c.fsm.is('walking', 'mounting', 'driving', 'shuffling') || (cv.phase === 'forming' && c.fsm.is('dismounting'));
        this.convoyIdle[id] = busy ? 0 : (this.convoyIdle[id] ?? 0) + dt;
        const lost = c.drive?.done || this.convoyIdle[id] > 4 || (c.fsm.is('driving') && c.quad.rider);
        if (lost) {
          cv.stand();
          for (const o of this.companions) if (o.fsm.is('driving') && o.drive && !o.drive.done) o.drive.stop('bored');
          break;
        }
        if (cv.phase === 'forming') {
          const driving = c.fsm.is('driving') && c.drive && ['drive', 'settle'].includes(c.drive.phase) && (id !== cv.leader || c.drive.phase === 'drive');
          if (driving) cv.ready(id);
        }
      }
      // The follower has got ahead: they swap.
      const f = byId[cv.follower];
      if (cv.phase === 'running' && cv.passing && f?.drive?.pass?.phase === 'waiting') {
        const order = cv.passed();
        const nl = byId[order.leader];
        const ol = byId[order.follower];
        // The old leader follows the new one, who carries on in her own loops.
        ol.drive.follow = () => nl.quad;
        ol.drive.pass = null;
        ol.drive.waypoints = [];
        nl.drive.follow = null;
        nl.drive.pass = null;
        nl.drive.waypoints = [];
        nl.drive.index = 0;
        nl.drive.driveFor = 1e6;
        this.convoySwapped = { front: order.leader, back: order.follower };
      } else if (cv.phase === 'running' && cv.passing && f?.drive && !f.drive.pass) {
        cv.passFailed();
      }
    } else this.convoyIdle = {};
    for (const e of cv.update(dt, this.convoyContext(ridden))) this.handleConvoyEvent(e);
  }

  // Racing ------------------------------------------------------------------

  /**
   * The lap as waypoints for a girl on her side of the track: a staging point `STAGE_BACK` metres behind the line (so she comes at the
   * grid along the track and ends up facing the right way), the grid point, then round the loop and back to the grid point.
   */
  raceRoute(lateral) {
    const L = this.world.layout;
    const h = this.world.heights;
    const hazards = [...this.world.bogHazards(), ...(h.puddles ?? []).map((p) => ({ x: p.x, z: p.z, radius: L.puddleRadius + 1.5 }))]; // a puddle at speed drowns the engine, so well clear
    const track = this.world.track;
    const at = (back) => {
      const s = track.sample(this.raceStart - back / track.totalLength);
      return { x: s.x - s.tz * lateral, z: s.z + s.tx * lateral };
    };
    return [at(RACE_STAGE_BACK), at(0), ...planLap(track, this.raceStart, hazards, { spacing: this.race.p.routeSpacing, margin: this.race.p.hazardMargin, lateral })];
  }

  /** Where you are for the race: on a quad or not, how near the start line, and whether you've sat still there. */
  raceYou(ridden) {
    const q = ridden?.quad;
    if (!q || !this.girlUnits.includes(ridden)) return { riding: null, near: false, still: false };
    const line = this.world.track.sample(this.raceStart);
    return {
      riding: ridden.spec.id,
      near: Math.hypot(q.position.x - line.x, q.position.z - line.z) < this.race.p.nearLine,
      still: Math.abs(q.forwardSpeed) < 1 && q.engine.isRunning,
    };
  }

  /** You ask the girls for a race, from the saddle near the start line. They start one as soon as both are free. */
  askForRace(ridden) {
    if (!this.raceYou(ridden).riding) return this.hud.toast('You need to be on a quad to ask for a race', 2);
    if (!this.raceYou(ridden).near) return this.hud.toast('Ride up to the start line by the yard first', 2);
    if (this.race.active) return this.hud.toast('There is a race on already', 1.6);
    this.askGirls('race');
  }

  /** Which starts you are at, on this quad, for what your wheel offers (the hill climb's cones, the cone course's, the drag strip). */
  askNear(ridden) {
    const q = ridden.quad;
    const within = (g, r) => Math.hypot(q.position.x - g.x, q.position.z - g.z) < r;
    return {
      climb: within(this.climbGates[0], this.hillClimb.p.nearStart),
      pit: !!this.pitClimb && this.pitClimb.distanceToStart(q.position) < this.pitClimb.p.nearStart,
      cones: within(this.coneGates[0], this.coneCourse.p.nearStart),
      drag: this.dragYou(ridden).near,
    };
  }

  /** Your part in a race: lined up on the grid, then your lap judged (npc/race.js). */
  updateRaceYou(dt, ridden) {
    const race = this.race;
    if (!race.active || !race.picks?.you) return void (this.youRun = null);
    const q = ridden?.quad;
    const line = this.world.track.sample(this.raceStart);
    const dist = q ? Math.hypot(q.position.x - line.x, q.position.z - line.z) : Infinity;
    if (race.phase === 'gather' || race.phase === 'countdown') {
      // Once lined up you may roll a little on a slope; the count-down only drops you if you really move off.
      const speed = q ? (race.ready.has('you') && Math.abs(q.forwardSpeed) < 2 ? 0 : q.forwardSpeed) : 9;
      const on = !!q && ridden.spec.id === race.picks.you && youOnGrid({ dist, speed, yaw: q.yaw }, Math.atan2(line.tx, line.tz), race.p);
      if (on && !race.ready.has('you')) {
        race.grid('you');
        this.hud.toast('On the line. Waiting for the girls', 2);
      } else if (!on) race.ungrid('you');
    } else if (race.phase === 'race') {
      this.youRun ??= new YouRun(this.raceStart, race.p);
      this.youClock = (this.youClock ?? 0) + dt;
      if (this.youClock < 0.2) return;
      const step = this.youClock;
      this.youClock = 0;
      const u = q ? nearestTrackFraction(this.world.track, q.position.x, q.position.z) : this.raceStart;
      const verdict = this.youRun.update(step, { riding: !!q && ridden.spec.id === race.picks.you, running: !!q && q.engine.isRunning, u, distToLine: dist });
      if (verdict === 'finish') race.finish('you');
      else if (verdict === 'out') race.abort('you');
    }
  }

  /**
   * The girls struggled to get onto the start line and face along it, so once one has arrived and is holding on the grid she is eased onto her
   * exact point and round to face the right way, over about a second, until the start. (Used by both the lap race and the drag race.)
   */
  helpOnGrid(dt) {
    if (!(this.race.phase === 'gather' || this.race.phase === 'countdown' || this.drag.phase === 'gather' || this.drag.phase === 'countdown')) return;
    for (const c of this.companions) {
      const race = c.drive?.race;
      if (!race || race.assistYaw === undefined || c.drive.phase !== 'grid') continue;
      const q = c.quad;
      const target = race.route[race.gridIndex];
      if (!q || !target || Math.abs(q.forwardSpeed) > 1.5) continue;
      const k = Math.min(1, dt * 2.5);
      const dx = target.x - q.position.x;
      const dz = target.z - q.position.z;
      const dist = Math.hypot(dx, dz);
      const off = Math.atan2(Math.sin(race.assistYaw - q.yaw), Math.cos(race.assistYaw - q.yaw));
      if (dist < 0.05 && Math.abs(off) < 0.02) continue;
      if (dist > 5) continue; // she's nowhere near it: not for this to fix
      q.placeAt(q.position.x + dx * k, q.position.z + dz * k, q.yaw + off * k);
    }
  }

  /** What a race needs to know (npc/race.js): who is free, which quads each could take, and you at the line. */
  raceContext(ridden) {
    const asked = this.asking?.kind === 'race';
    return { girls: this.askedGirls(asked), options: this.askedOptions(ridden, asked), claims: this.ownership.claims, you: this.raceYou(ridden) };
  }

  // Asking the girls ------------------------------------------------------------

  /** The girls as a race, drag run or climb sees them. While you are asking for it they can be taken from walking, sitting or driving too. */
  askedGirls(asked) {
    return this.companions.map((c) => {
      const a = c.availability(asked ? { asked: true, pull: true } : {});
      return { id: c.character.id, name: c.name, free: a.free, why: a.why };
    });
  }

  /** The quads each girl could take. Asked, a girl may take the one she is already on, and the quad you are on is the only one never offered. */
  askedOptions(ridden, asked) {
    const options = {};
    for (const c of this.companions) {
      options[c.character.id] = this.girlUnits
        .filter((u) => {
          if (u === ridden || !c.mayRide(u.quad) || c.takenByOther(u.quad) || u.quad.bog.stuck) return false;
          if (!asked) return c.canDrive(u.quad) && !this.herOn(u.quad);
          const on = this.herOn(u.quad);
          return on ? on === c : c.canDrive(u.quad);
        })
        .map((u) => u.spec.id);
    }
    return options;
  }

  /** Why nothing can start at all just now, for this kind of ask, or null. */
  askBusy(kind) {
    if (this.recalling) return 'the bell has been rung and they are coming back';
    if (kind === 'climb' && this.hillClimb.active) return 'a girl is already out on the climb';
    if (kind === 'cones' && this.coneCourse.active) return 'a girl is already out on the cone course';
    if (kind !== 'climb' && this.hillClimb.active) return 'a girl is out on the hill climb';
    if (kind !== 'cones' && this.coneCourse.active) return 'a girl is out on the cone course';
    if (this.drag.active) return 'a drag race is on';
    if (this.race.active) return 'a race is on';
    if ((kind === 'climb' || kind === 'cones') && this.fallingOut.active) return 'the girls have fallen out';
    return null;
  }

  /** What would stop an ask for this kind working now: a list of sentences, empty if nothing (npc/asking.js). The debug panel and console show it. */
  askNow(kind, ridden = this.riddenUnit) {
    const girls = this.askedGirls(true);
    const options = this.askedOptions(ridden, true);
    const distinct = kind === 'race' ? !!pickQuads(options, this.ownership.claims, () => 0) : null;
    return askProblems(kind, { girls, options, busy: this.askBusy(kind), riding: !!this.raceYou(ridden).riding, distinct });
  }

  /**
   * You ask the girls for a race, a drag run or the hill climb. It is a priority for them: they leave what they were doing, find a quad
   * and set off. If they cannot in `ASK_PATIENCE` seconds the ask is called off with the reason (updateAsk), so it is never silent.
   */
  askGirls(kind) {
    const busy = this.askBusy(kind);
    if (busy) return this.hud.toast(`Not now: ${busy}`, 2.5);
    this.asking = { kind, age: 0, tried: 0 };
    this.lastAsk = null;
    if (kind === 'race') this.race.forced = true;
    else if (kind === 'drag') this.drag.forced = true;
    else if (kind === 'cones') this.coneCourse.forced = true;
    else this.hillClimb.forced = true;
    this.hud.toast(kind === 'race' ? 'Asking the girls for a race' : kind === 'drag' ? 'Asking for a drag race' : kind === 'cones' ? 'Asking for someone to run the cones against you' : 'Asking for someone to race you up the hill', 2);
  }

  /** Each frame while an ask is open: for the climb, tries to send a girl; for all, ends it when it has started or run out of time. */
  updateAsk(dt, ridden) {
    const a = this.asking;
    if (!a) return;
    a.age += dt;
    const module = a.kind === 'race' ? this.race : a.kind === 'drag' ? this.drag : a.kind === 'cones' ? this.coneCourse : this.hillClimb;
    if ((a.kind === 'climb' || a.kind === 'cones') && module.forced && (a.tried -= dt) <= 0) {
      a.tried = 0.5;
      const offers = module.offers(this.climbContext(ridden, a.kind));
      if (offers.length) {
        const o = module.take(offers[Math.floor(Math.random() * offers.length)]);
        if (a.kind === 'cones') this.startConeCourse(o);
        else this.startHillClimb(o);
      }
    }
    if (module.active) {
      this.asking = null; // they are off
      return;
    }
    if (!module.forced) return void (this.asking = null); // the module let it go (you got off, say)
    if (a.age < ASK_PATIENCE) return;
    module.forced = false;
    this.asking = null;
    const problems = this.askNow(a.kind, ridden);
    this.lastAsk = askLine(a.kind, problems.length ? problems : ['they could not get going']);
    this.hud.toast(this.lastAsk, 5);
  }

  /** Takes her from whatever she was doing to drive `quad` with these options (requestDrive's), stopping a drive or getting her up first. */
  sendToDrive(c, quad, options) {
    c.interrupt();
    c.warmingAt = null;
    if (c.fsm.is('resting')) return void c.leaveRest(() => c.requestDrive(quad, options));
    if (c.fsm.is('driving') && c.quad === quad && !c.drive?.race) return void c.stopDriving('off', () => c.requestDrive(quad, options));
    c.requestDrive(quad, options);
  }

  /** Acts on a race (npc/race.js): the invite (one of them suggested it, or Jess dared you), the count, the go, the finish. */
  handleRaceEvent(e) {
    const p = this.race.p;
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const later = (ms, fn) => setTimeout(fn, ms);
    if (e.type === 'invite') {
      byId[e.challenger].voice.say(e.youIn ? 'raceInviteYou' : 'raceInvite', { force: true });
      later(3500, () => byId[e.other]?.voice.say(e.youIn ? 'raceJoinYou' : 'raceAccept', { force: true }));
      if (e.youIn) this.hud.toast('Race: line up on the start line by the yard, pointing along the track', 4);
      let side = 1;
      for (const [id, spec] of Object.entries(e.picks)) {
        const c = byId[id];
        if (!c) continue; // you
        const quad = this.girlUnits.find((u) => u.spec.id === spec).quad;
        const confidence = c.driveConfidence ?? c.params.driveConfidence;
        const race = {
          route: this.raceRoute((e.youIn ? p.gridSpacing : 1.5) * side),
          gridIndex: 1,
          assistYaw: Math.atan2(this.world.track.sample(this.raceStart).tx, this.world.track.sample(this.raceStart).tz), // eased round on the grid (helpOnGrid), not driven round again
          cruise: p.cruiseBase + p.cruiseConfidence * confidence + (Math.random() * 2 - 1) * p.cruiseSpread,
          throttle: p.throttle,
          keepDriving: Math.random() < p.keepRidingChance,
          go: () => this.race.go(),
          alive: () => this.race.active,
          onGrid: () => this.race.grid(id),
          onFinish: () => this.race.finish(id),
          onAbort: () => this.race.abort(id),
        };
        side = -side;
        this.sendToDrive(c, quad, { race });
      }
    } else if (e.type === 'countdown') byId[this.race.challenger]?.voice.say('raceCount', { force: true });
    else if (e.type === 'go') {
      if (this.race.picks.you) this.hud.toast('Go!', 1.2);
    } else if (e.type === 'youDropped') this.hud.toast('The girls are going without you', 2.5);
    else if (e.type === 'finish') {
      this.noteRecord('lap', e.girl, e.time, this.race.picks?.[e.girl]);
      if (e.girl === 'you') {
        this.dayEvents.add('youRaced', { place: e.place });
        this.achievements.note('races');
        if (e.place === 1) this.achievements.note('raceWins');
      }
      if (e.girl === 'you') this.hud.toast(['', 'You won!', 'You came second', 'You came third'][e.place] ?? `You finished`, 3);
      else if (e.place === 1) byId[e.girl].voice.say(e.youIn ? 'raceBeatYou' : 'raceWin', { force: true });
      else later(2500, () => byId[e.girl]?.voice.say(e.ahead.includes('you') ? 'raceLoseToYou' : 'raceLose', { force: true }));
    } else if (e.type === 'out') {
      if (e.girl === 'you') this.hud.toast('You are out of the race', 2.5);
      else byId[e.girl]?.voice.say('raceOut', { force: true });
    } else if (e.type === 'result' && e.winner && e.loser) {
      this.raceResult = { winner: e.winner, loser: e.loser };
      this.noteOutcome(e.winner, 'raceWon');
      this.noteOutcome(e.loser, 'raceLost');
      this.noteFriction('race', e.loser);
      this.dayEvents.add('race', { winner: e.winner, loser: e.loser });
    }
  }

  updateRace(dt, ridden) {
    if (this.drag.active && !this.race.active) return; // one race at a time
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    // A racer who has stopped doing anything about it (told to do something else, say) is out, rather than holding it up.
    if (this.race.active && this.race.phase !== 'over') {
      for (const id of Object.keys(this.race.picks ?? {})) {
        const c = byId[id];
        if (!c) continue; // you
        const busy = c.fsm.is('walking', 'mounting', 'driving', 'shuffling', 'dismounting', 'resting', 'seated', 'starting', 'cranking') || !!c.drive?.race;
        this.raceIdle[id] = busy ? 0 : (this.raceIdle[id] ?? 0) + dt;
        if (this.raceIdle[id] > 4) this.race.abort(id);
      }
    } else this.raceIdle = {};
    for (const e of this.race.update(dt, this.raceContext(ridden))) this.handleRaceEvent(e);
  }

  // Drag racing --------------------------------------------------------------

  /** Where you are for the drag race: on a quad or not, how near the start line, how still, your throttle and which side of the strip's middle. */
  dragYou(ridden) {
    const q = ridden?.quad;
    if (!q || !this.girlUnits.includes(ridden)) return { riding: null, near: false, still: false, stalled: true, throttle: 0, across: 0 };
    const strip = this.world.layout.dragStrip;
    const f = stripFrame(strip, q.position.x, q.position.z);
    return {
      riding: ridden.spec.id,
      near: Math.hypot(f.along, f.across) < this.drag.p.nearStrip,
      still: Math.abs(q.forwardSpeed) < 1 && q.engine.isRunning,
      stalled: !q.engine.isRunning,
      throttle: q.throttle ?? 0,
      across: f.across,
    };
  }

  /** You ask one of the girls for a drag race, from the saddle near the strip's start. */
  askForDrag(ridden) {
    if (this.race.active || this.drag.active) return this.hud.toast('There is a race on already', 1.6);
    if (!this.dragYou(ridden).riding) return;
    this.askGirls('drag');
  }

  /** The route for a girl in the drag race: the staging point behind the line, her grid point, then down the strip and past the finish. */
  dragRoute(lane) {
    const s = this.world.layout.dragStrip;
    const back = this.drag.p.gridBack;
    return [stripPoint(s, -back - 10, lane), stripPoint(s, -back, lane), stripPoint(s, s.length + s.runOff * 0.7, lane)];
  }

  /** Your part in the drag race: lined up on your side of the grid, then how far down the strip you are. */
  updateDragYou(ridden) {
    const drag = this.drag;
    if (drag.phase !== 'gather' && drag.phase !== 'countdown') return;
    const q = ridden?.quad;
    const s = this.world.layout.dragStrip;
    const point = stripPoint(s, -drag.p.gridBack, -drag.lane * drag.p.laneOffset);
    const dist = q ? Math.hypot(q.position.x - point.x, q.position.z - point.z) : Infinity;
    // Once lined up you may roll a little on a slope; the count-down only drops you if you really move off.
    const speed = q ? (drag.ready.has('you') && Math.abs(q.forwardSpeed) < 2 ? 0 : q.forwardSpeed) : 9;
    const on = !!q && ridden.spec.id === drag.picks.you && onDragGrid({ dist, speed, yaw: q.yaw }, s.yaw, drag.p);
    if (on && !drag.ready.has('you')) {
      drag.grid('you');
      this.hud.toast('On the line. Waiting for her', 2);
    } else if (!on) drag.ungrid('you');
  }

  /** What the drag challenge needs to know to offer it (npc/drag.js): who is free, which quads each could take, and you. */
  dragContext(ridden) {
    const asked = this.asking?.kind === 'drag';
    return { girls: this.askedGirls(asked), options: this.askedOptions(ridden, asked), claims: this.ownership.claims, busy: this.race.active, you: this.dragYou(ridden) };
  }

  /** Jess drives over to sit beside you and challenge you (her choice: npc/drag.js). */
  dragApproach(e, ridden) {
    const drag = this.drag;
    const q = ridden?.quad;
    const c = this.companions.find((o) => o.character.id === e.girl);
    if (!q || !c) return drag.cancel([], true);
    const side = { x: -Math.cos(q.yaw), z: Math.sin(q.yaw) };
    const beside = { x: q.position.x + side.x * 3.2, z: q.position.z + side.z * 3.2 };
    const quad = this.girlUnits.find((u) => u.spec.id === e.pick).quad;
    c.requestDrive(quad, {
      race: {
        route: [beside],
        gridIndex: 0,
        cruise: 9,
        throttle: 0.7,
        go: () => false,
        alive: () => drag.active,
        onGrid: () => drag.grid(e.girl),
        onFinish: () => {},
        onAbort: () => drag.abort(e.girl),
        blip: () => drag.blipping(),
      },
    });
  }

  updateDrag(dt, ridden) {
    const drag = this.drag;
    const s = this.world.layout.dragStrip;
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const later = (ms, fn) => setTimeout(fn, ms);
    const asked = this.asking?.kind === 'drag';
    const girls = this.askedGirls(asked);
    const options = this.askedOptions(ridden, asked);
    // The girl racing you has stopped doing anything about it (told to do something else, say): she's out.
    if (drag.active && drag.phase !== 'over' && drag.girl) {
      const c = byId[drag.girl];
      const busy = c.fsm.is('walking', 'mounting', 'driving', 'shuffling', 'dismounting', 'resting', 'seated', 'starting', 'cranking') || !!c.drive?.race;
      this.dragIdle = busy ? 0 : this.dragIdle + dt;
      if (this.dragIdle > 4) drag.abort(drag.girl);
    } else this.dragIdle = 0;
    if (!drag.active) this.dragBlipSaid = false;
    else if (drag.phase === 'blip' && !this.dragBlipSaid) {
      this.dragBlipSaid = true;
      byId[drag.girl]?.voice.say('dragBlip', { force: true });
    }
    this.updateDragYou(ridden);
    const along = {};
    if (drag.phase === 'countdown' || drag.phase === 'race') {
      const mine = ridden?.quad;
      if (mine) along.you = stripFrame(s, mine.position.x, mine.position.z).along;
      const spec = drag.picks?.[drag.girl];
      const hers = this.girlUnits.find((u) => u.spec.id === spec)?.quad;
      if (hers) along[drag.girl] = stripFrame(s, hers.position.x, hers.position.z).along;
    }
    const race = (id, lane, spec) => ({
      route: this.dragRoute(lane),
      gridIndex: 1,
      assistYaw: s.yaw,
      cruise: 30, // flat out: the quad's power decides
      throttle: 1,
      keepDriving: Math.random() < this.race.p.keepRidingChance,
      go: () => drag.go(),
      alive: () => drag.active,
      onGrid: () => drag.grid(id),
      onFinish: () => drag.finish(id),
      onAbort: () => drag.abort(id),
    });
    for (const e of drag.update(dt, { girls, options, claims: this.ownership.claims, busy: this.race.active, you: this.dragYou(ridden), along, length: s.length })) {
      if (e.type === 'approach') this.dragApproach(e, ridden);
      else if (e.type === 'chicken') byId[e.girl]?.voice.say('dragChicken', { force: true });
      else if (e.type === 'invite') {
        const c = byId[e.girl];
        c.voice.say(e.blipped ? 'dragAccepted' : 'dragAsked', { force: true });
        this.hud.toast('Drag race: line up on your side of the start line, pointing along the strip', 4);
        const r = race(e.girl, e.lane * drag.p.laneOffset);
        const quad = this.girlUnits.find((u) => u.spec.id === e.picks[e.girl]).quad;
        if (c.fsm.is('driving') && c.drive && c.quad === quad) c.drive.reroute(r);
        else this.sendToDrive(c, quad, { race: r });
      } else if (e.type === 'countdown') byId[drag.girl]?.voice.say('dragCount', { force: true });
      else if (e.type === 'falseStart') {
        byId[e.girl]?.voice.say('dragFalseStart', { force: true });
        this.hud.toast('False start. Back on the line', 2.5);
      } else if (e.type === 'go') this.hud.toast('Go!', 1.2);
      else if (e.type === 'finish') {
        this.noteRecord('drag', e.id, e.time, drag.picks?.[e.id]);
        if (e.id === 'you') {
          this.achievements.note('drags');
          if (e.place === 1) this.achievements.note('dragWins');
        }
        if (e.id === 'you') this.hud.toast(e.place === 1 ? 'You won!' : 'She won', 3);
        else if (e.place === 1) byId[e.id]?.voice.say('dragWin', { force: true });
        else later(2000, () => byId[e.id]?.voice.say('dragLose', { force: true }));
        this.noteOutcome(e.id, e.place === 1 ? 'dragWon' : 'dragLost');
      } else if (e.type === 'out') {
        if (e.id === 'you') this.hud.toast('You are out of the race', 2.5);
        else byId[e.id]?.voice.say('dragOut', { force: true });
      } else if (e.type === 'cancel') this.hud.toast('Drag race called off', 2);
    }
  }


  // Records and the hill climb --------------------------------------------------

  /** A result for the chalkboard. Returns { record, quadBest, previous }; you are told when you set one. */
  noteRecord(kind, who, value, quadId) {
    const r = this.records.submit(kind, who, value, quadId);
    if (r.record) {
      this.jobBoardView.refresh();
      if (who === 'you') {
        this.achievements.note('records');
        this.hud.toast(`New record on the board: ${RECORD_KINDS[kind].label}, ${formatValue(kind, value)}`, 4);
      }
    }
    return r;
  }

  /** Longest jump: whoever is on a quad is measured from take-off to landing, and a good one goes to the board. */
  updateJumpRecords(dt, ridden) {
    const units = new Set([...this.girlUnits, ridden].filter(Boolean));
    for (const u of units) {
      const q = u.quad;
      const driver = this.companions.find((c) => c.quad === q && c.fsm.is('driving'));
      const who = ridden === u ? 'you' : driver?.character.id;
      let m = this.jumpMeasures.get(q);
      if (!who) {
        m?.reset();
        continue;
      }
      if (!m) this.jumpMeasures.set(q, (m = new JumpMeasure(this.recordParams)));
      const j = m.update(dt, { airborne: !!q.airborne, x: q.position.x, z: q.position.z });
      if (!j) continue;
      if (who === 'you') this.hud.toast(`Jump: ${j.distance.toFixed(1)} m`, 2);
      this.noteRecord('jump', who, j.distance, u.spec.id);
    }
  }

  // The challenges on the chalkboard --------------------------------------------

  /** Each frame: which quads have run today, the cold-start clock, and whether your climb is staying clean. */
  updateChallenges(dt, ridden) {
    for (const u of this.girlUnits) if (u.engine.isRunning) this.ranToday.add(u.id);
    if (this.coldRun.active) {
      const verdict = this.coldRun.update(dt, this.girlUnits.filter((u) => u.engine.isRunning).map((u) => u.id));
      if (verdict === 'done') this.finishChallenge('coldStart', this.coldRun.time);
      else if (verdict === 'out') this.hud.toast(`Cold start: out of time, ${this.coldRun.left.size} still to start`, 4);
    }
    const run = this.hillClimb.runs.you;
    if (run?.state === 'running') {
      const q = ridden?.quad;
      this.cleanWatch.update({ running: !!q?.engine.isRunning, tipped: !!q?.isTipped });
    }
  }

  /** The quads that are cold: not run since the day began. */
  coldQuadIds() {
    return this.girlUnits.filter((u) => !this.ranToday.has(u.id) && !u.engine.isRunning).map((u) => u.id);
  }

  /** The chalkboard's 1: the cold-start clock runs from now, until every quad that is cold has been started. */
  startColdStart() {
    if (this.coldRun.active) {
      this.coldRun.cancel();
      this.hud.toast('Cold start: called off', 2.5);
      return;
    }
    const cold = this.coldQuadIds();
    if (!this.coldRun.start(cold)) {
      this.hud.toast(`Cold start: only ${cold.length} quad${cold.length === 1 ? ' is' : 's are'} cold, it needs ${this.challengeParams.coldMin}. They have been run today`, 5);
      return;
    }
    this.hud.toast(`Cold start: ${cold.length} quads to start in ${formatChallenge('coldStart', this.challengeParams.coldLimit)}. Go!`, 5);
  }

  /** How the quads stand in the bays now, without putting it on the board. */
  lineUpNow() {
    const parked = this.girlUnits.map((u) => ({
      id: u.id, x: u.quad.position.x, z: u.quad.position.z, yaw: u.quad.yaw, speed: Math.abs(u.quad.speed),
      occupied: !!(u.quad.rider || u.quad.driver),
    }));
    return judgeLineUp(this.lineUpBays.bays, parked, this.challengeParams);
  }

  /** The chalkboard's 2: judges the quads parked in the yard's bays. */
  judgeLineUp() {
    const r = this.lineUpNow();
    if (!r.ok) {
      this.hud.toast(`Line-up: ${r.why}`, 5);
      return r;
    }
    this.finishChallenge('lineUp', r.score);
    return r;
  }

  /** What the challenges are doing, for the panel and the console. */
  describeChallenges() {
    const cold = this.coldRun;
    const running = cold.active ? `cold start running: ${Math.floor(cold.time)} s, ${cold.left.size} of ${cold.total} left` : `${this.coldQuadIds().length} quads are cold`;
    return `${this.challenges.lines().map((l) => `${l.label}: ${l.text}`).join('; ')}. ${running}`;
  }

  /** A result for a challenge: to the board with a toast, and a girl says something. */
  finishChallenge(kind, value) {
    const r = this.noteChallenge(kind, value);
    const text = formatChallenge(kind, value);
    this.hud.toast(`${CHALLENGE_KINDS[kind].label}: ${text}${r.best ? '. Your best!' : ''}`, 4);
    this.companions.find((c) => c.availability().canRemark)?.voice.say(r.best ? 'challengeBest' : 'challengeDone', { force: true });
    return r;
  }

  noteChallenge(kind, value) {
    const r = this.challenges.submit(kind, value);
    if (r.best) this.jobBoardView.refresh();
    return r;
  }

  /** You ask to be timed up the hill (Enter by the start cones): the clock runs when you ride through them. */
  askForClimb() {
    this.hillClimb.arm();
    this.askGirls('climb');
    this.hud.toast('Hill climb: ride through the start cones when you are ready, then up through the gates to the top', 5);
  }

  /** What the hill climb needs to know to offer it to a girl (npc/hillClimb.js). */
  climbContext(ridden, kind = 'climb') {
    const asked = this.asking?.kind === kind;
    return {
      girls: this.askedGirls(asked),
      options: this.askedOptions(ridden, asked),
      claims: this.ownership.claims,
      busy: this.race.active || this.drag.active || (kind === 'climb' ? this.coneCourse.active : this.hillClimb.active) || !!this.recalling || this.fallingOut.active,
      dark: !asked && this.daylight.darkness > 0.6, // asked, she'll go up in the dark (the quads have lights)
    };
  }

  /** She chose to climb: she drives her quad to the cones, waits a moment, then goes (HerDrive's race mode through the gates). */
  startHillClimb(e) {
    const c = this.companions.find((o) => o.character.id === e.girl);
    const unit = this.girlUnits.find((u) => u.spec.id === e.pick);
    if (!c || !unit) return this.hillClimb.stand();
    const hc = this.hillClimb;
    // From the farm she goes down the lane and across the ford (world/fields.js gateways), then along the pasture's bottom to the cones.
    const lane = this.world.layout.hill.lane;
    const there = climbRoute(this.climbGates, hc.p);
    const via = this.world.fields.route(unit.quad.position, there[0]).slice(0, -1).map((p) => ({ x: p.x, z: p.z }));
    if (via.length) via.push({ x: lane.x, z: this.world.layout.hill.stream.z + 9 });
    const route = [...via, ...there];
    const s = this.climbGates[0];
    const confidence = c.driveConfidence ?? c.params.driveConfidence;
    c.voice.say('climbOff', { force: true });
    this.sendToDrive(c, unit.quad, {
      race: {
        route,
        gridIndex: via.length + 1,
        assistYaw: Math.atan2(s.tx, s.tz),
        cruise: hc.p.cruise + 3 * confidence,
        throttle: 1,
        keepDriving: Math.random() < this.race.p.keepRidingChance,
        go: () => hc.go(),
        alive: () => hc.active,
        onGrid: () => hc.grid(e.girl),
        onFinish: () => {},
        onAbort: () => hc.abort(e.girl),
      },
    });
  }

  updateClimb(dt, ridden) {
    const hc = this.hillClimb;
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const at = {};
    const q = ridden?.quad;
    if (q) at.you = { x: q.position.x, z: q.position.z, riding: true, running: q.engine.isRunning };
    else if (hc.runs.you) at.you = { x: this.player.position.x, z: this.player.position.z, riding: false, running: false };
    if (hc.active) {
      const c = byId[hc.girl];
      const quad = this.girlUnits.find((u) => u.spec.id === hc.pick)?.quad;
      if (c && quad) {
        const mine = c.quad === quad && c.fsm.is('driving');
        at[hc.girl] = { x: quad.position.x, z: quad.position.z, riding: mine, running: quad.engine.isRunning };
        // She has stopped doing anything about it (told to do something else): out.
        const busy = c.fsm.is('walking', 'mounting', 'driving', 'shuffling', 'dismounting', 'resting', 'seated', 'starting', 'cranking') || !!c.drive?.race;
        this.climbIdle = busy ? 0 : this.climbIdle + dt;
        if (this.climbIdle > 4) hc.abort(hc.girl);
      } else hc.abort(hc.girl);
    } else this.climbIdle = 0;
    const girl = hc.girl;
    const pick = hc.pick;
    for (const e of hc.update(dt, { at })) {
      const quadId = e.id === 'you' ? ridden?.spec.id : pick;
      if (e.type === 'start' && e.id === 'you') {
        this.cleanWatch.reset();
        this.hud.toast('Go!', 1.2);
      }
      else if (e.type === 'gate' && e.id === 'you') this.hud.toast(e.gatesLeft > 1 ? 'Gate' : 'Gate. The finish cones are next', 1.2);
      else if (e.type === 'out') {
        if (e.id === 'you') this.hud.toast('Hill climb: you are out', 2.5);
        else byId[e.id]?.voice.say('climbOut', { force: true });
      } else if (e.type === 'finish') this.finishClimb(e, quadId, byId, girl);
    }
  }

  /** You ask to be timed up the gravel pit's wall (Enter by the cones on its floor): the clock runs when you ride through them. */
  askForPit() {
    this.pitClimb.arm();
    this.hud.toast(PIT_ASK_MESSAGE, 5);
  }

  /** Your pit climb: the clock, the gate, the finish and the time to the board (world/pitClimb.js). */
  updatePitClimb(dt, ridden) {
    const pc = this.pitClimb;
    if (!pc) return;
    const q = ridden?.quad;
    let at = null;
    if (q) at = { x: q.position.x, z: q.position.z, riding: true, running: q.engine.isRunning };
    else if (pc.run) at = { x: this.player.position.x, z: this.player.position.z, riding: false, running: false };
    for (const e of pc.update(dt, at)) {
      if (e.type === 'finish') this.finishPitClimb(e, ridden);
      else this.hud.toast(pitMessage(e), e.type === 'out' ? 2.5 : 1.2);
    }
  }

  /** You have been through the finish cones over the lip: the time to the board, and whoever is near the top says something. */
  finishPitClimb(e, ridden) {
    const r = this.noteRecord('pit', 'you', e.time, ridden?.spec.id);
    this.achievements.note('pitClimbs');
    this.hud.toast(pitMessage(e, r), 4);
    const top = this.pitGates[this.pitGates.length - 1];
    const timer = this.companions
      .filter((c) => c.availability().canRemark && Math.hypot(c.root.position.x - top.x, c.root.position.z - top.z) < 45)
      .sort((a, b) => Math.hypot(a.root.position.x - top.x, a.root.position.z - top.z) - Math.hypot(b.root.position.x - top.x, b.root.position.z - top.z))[0];
    timer?.voice.say(r.record ? 'pitRecord' : 'pitYou', { force: true });
  }

  /** Someone has been through the finish cones: the time to the board, and what is said. */
  finishClimb(e, quadId, byId, girl) {
    const r = this.noteRecord('climb', e.id, e.time, quadId);
    const time = formatValue('climb', e.time);
    if (e.id !== 'you') {
      this.noteOutcome(e.id, r.record ? 'climbRecord' : 'climbDone');
      byId[e.id]?.voice.say(r.record ? 'climbRecord' : 'climbDone', { force: true });
      return;
    }
    this.achievements.note('climbs');
    const clean = this.cleanWatch.clean ? this.noteChallenge('cleanClimb', e.time) : null;
    this.hud.toast(`Hill climb: ${time}${r.record ? '. A record!' : r.quadBest ? '. Your best on this quad' : ''}${clean ? `. A clean run${clean.best ? ', your best' : ''}` : ''}`, 4);
    // Whoever is near the top has timed you.
    const top = this.climbGates[this.climbGates.length - 1];
    const near = this.companions
      .filter((c) => c.availability().canRemark && Math.hypot(c.root.position.x - top.x, c.root.position.z - top.z) < 40)
      .sort((a, b) => Math.hypot(a.root.position.x - top.x, a.root.position.z - top.z) - Math.hypot(b.root.position.x - top.x, b.root.position.z - top.z))[0];
    const timer = near ?? null;
    if (timer) timer.voice.say(r.record ? 'climbYouRecord' : 'climbYou', { force: true });
    if (r.record && r.previous && r.previous.who !== 'you') {
      const loser = byId[r.previous.who];
      if (loser && loser !== timer) setTimeout(() => loser.voice.say('climbYouRecord', { force: true }), 2500);
    }
  }

  // Amy's cone course -----------------------------------------------------------

  /** You ask to be timed round the cones (Enter by the first ones): Amy lays them out, and the clock runs when you ride through the start. */
  askForCones() {
    this.coneField.standUp();
    this.coneCourse.arm();
    this.askGirls('cones');
    this.hud.toast('Cone course: ride through the first cones when you are ready, then weave through every gap. Each cone down costs 2 seconds', 5);
  }

  /** Stands the cones up (your E at them, or Amy tidying, or a new run starting). */
  standCones() {
    this.coneField.standUp();
  }

  /** She chose the cone course: she drives to the first cones, waits, then weaves through (HerDrive's race mode through the gates). */
  startConeCourse(e) {
    const c = this.companions.find((o) => o.character.id === e.girl);
    const unit = this.girlUnits.find((u) => u.spec.id === e.pick);
    if (!c || !unit) return this.coneCourse.stand();
    const cc = this.coneCourse;
    this.coneField.standUp();
    let there = climbRoute(this.coneGates, cc.p, 5);
    this.coneKnocking = cc.knocksOnPurpose(e.girl);
    if (this.coneKnocking) there = knockRoute(this.coneGates, there);
    const via = this.world.fields.route(unit.quad.position, there[0]).slice(0, -1).map((p) => ({ x: p.x, z: p.z }));
    const route = [...via, ...there];
    const s = this.coneGates[0];
    const confidence = c.driveConfidence ?? c.params.driveConfidence;
    c.voice.say(this.coneKnocking ? 'coneKnock' : 'coneOff', { force: true });
    this.sendToDrive(c, unit.quad, {
      race: {
        route,
        gridIndex: via.length + 1,
        assistYaw: Math.atan2(s.tx, s.tz),
        cruise: (e.girl === 'jess' ? cc.p.cruiseJess : cc.p.cruiseAmy) + confidence,
        throttle: 1,
        keepDriving: Math.random() < this.race.p.keepRidingChance,
        go: () => cc.go(),
        alive: () => cc.active,
        onGrid: () => cc.grid(e.girl),
        onFinish: () => {},
        onAbort: () => cc.abort(e.girl),
      },
    });
  }

  updateCones(dt, ridden) {
    const cc = this.coneCourse;
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const at = {};
    const q = ridden?.quad;
    if (q) at.you = { x: q.position.x, z: q.position.z, riding: true, running: q.engine.isRunning };
    else if (cc.runs.you) at.you = { x: this.player.position.x, z: this.player.position.z, riding: false, running: false };
    if (cc.active) {
      const c = byId[cc.girl];
      const quad = this.girlUnits.find((u) => u.spec.id === cc.pick)?.quad;
      if (c && quad) {
        const mine = c.quad === quad && c.fsm.is('driving');
        at[cc.girl] = { x: quad.position.x, z: quad.position.z, riding: mine, running: quad.engine.isRunning };
        const busy = c.fsm.is('walking', 'mounting', 'driving', 'shuffling', 'dismounting', 'resting', 'seated', 'starting', 'cranking') || !!c.drive?.race;
        this.coneIdle = busy ? 0 : this.coneIdle + dt;
        if (this.coneIdle > 4) cc.abort(cc.girl);
      } else cc.abort(cc.girl);
    } else this.coneIdle = 0;

    // The cones go over under whoever is moving through them.
    const things = [];
    const seen = new Set();
    const add = (quad, id) => {
      if (!quad || seen.has(quad)) return;
      seen.add(quad);
      things.push({ id, x: quad.position.x, z: quad.position.z, speed: Math.abs(quad.forwardSpeed) });
    };
    add(q, 'you');
    for (const u of this.girlUnits) add(u.quad, this.companions.find((c) => c.quad === u.quad && c.fsm.is('driving'))?.character.id ?? null);
    for (const c of this.companions) if (c.fsm.is('walking')) things.push({ id: c.character.id, x: c.root.position.x, z: c.root.position.z, speed: 1.4, foot: true });
    for (const h of this.coneField.hit(things)) {
      if (h.id) cc.hit(h.id);
      if (h.id === 'you' && cc.runs.you?.state === 'running') this.hud.toast('Cone down', 0.8);
    }
    const tidied = this.coneField.update(dt);
    this.coneField.cones.forEach((c, i) => layCone(this.coneView.cones[i], c.fall, c.dx, c.dz));
    if (tidied) this.sayConeTidy(byId);

    const girl = cc.girl;
    const pick = cc.pick;
    const knocking = this.coneKnocking;
    for (const e of cc.update(dt, { at })) {
      const quadId = e.id === 'you' ? ridden?.spec.id : pick;
      if (e.type === 'start' && e.id === 'you') this.hud.toast('Go!', 1.2);
      else if (e.type === 'gate' && e.id === 'you') this.hud.toast(e.gatesLeft > 1 ? 'Gate' : 'Gate. The finish cones are next', 1);
      else if (e.type === 'out') {
        if (e.id === 'you') this.hud.toast('Cone course: you are out', 2.5);
        else byId[e.id]?.voice.say('coneOut', { force: true });
        this.coneField.tidySoon();
      } else if (e.type === 'finish') this.finishCones(e, quadId, byId, knocking);
    }
  }

  /** Amy stands the cones up, saying so if she is about. */
  sayConeTidy(byId) {
    const amy = byId.amy;
    if (amy?.availability().canRemark) amy.voice.say('coneTidy', { force: true });
  }

  /** Someone has been through the finish cones: the score to the board, and what is said. */
  finishCones(e, quadId, byId, knocking) {
    const r = this.noteRecord('cones', e.id, e.time, quadId);
    const clean = e.cones === 0 && e.misses === 0;
    this.coneField.tidySoon();
    if (e.id !== 'you') {
      this.noteOutcome(e.id, clean && !knocking ? 'conesClean' : 'conesMessy');
      byId[e.id]?.voice.say(r.record ? 'coneRecord' : clean && !knocking ? 'coneClean' : 'coneDone', { force: true });
      return;
    }
    this.achievements.note('coneRuns');
    if (clean) this.achievements.note('coneClean');
    const extra = [e.cones ? `${e.cones} cone${e.cones > 1 ? 's' : ''} down` : '', e.misses ? `${e.misses} gate${e.misses > 1 ? 's' : ''} missed` : ''].filter(Boolean).join(', ');
    this.hud.toast(`Cone course: ${formatValue('cones', e.time)}${extra ? ` (${extra})` : ', a clean round'}${r.record ? '. A record!' : r.quadBest ? '. Your best on this vehicle' : ''}`, 5);
    const end = this.coneGates[this.coneGates.length - 1];
    const timer = this.companions
      .filter((c) => c.availability().canRemark && Math.hypot(c.root.position.x - end.x, c.root.position.z - end.z) < 40)
      .sort((a, b) => Math.hypot(a.root.position.x - end.x, a.root.position.z - end.z) - Math.hypot(b.root.position.x - end.x, b.root.position.z - end.z))[0];
    if (timer) timer.voice.say(r.record ? 'coneYouRecord' : 'coneYou', { force: true });
    if (r.record && r.previous && r.previous.who !== 'you') {
      const loser = byId[r.previous.who];
      if (loser && loser !== timer) setTimeout(() => loser.voice.say('coneYouRecord', { force: true }), 2500);
    }
  }

  // Pranks -----------------------------------------------------------------

  /** What the prank logic needs to know about the farm right now. */
  prankContext(ridden) {
    const at = (thing) => thing.model.getWorldPosition(new THREE.Vector3()); // it may be standing in the trailer
    const item = (thing, name) => ({ x: at(thing).x, z: at(thing).z, held: thing.held || !!thing.carried, home: this.itemHome[name] ?? thing.model.position });
    return {
      you: { x: this.player.position.x, z: this.player.position.z, riding: ridden?.spec.id ?? null },
      girls: this.companions.map((c) => ({ id: c.character.id, free: c.availability().free, mood: this.favour.mood(c.character.id) })),
      quads: this.girlUnits.map((u) => ({
        id: u.spec.id,
        x: u.quad.position.x,
        z: u.quad.position.z,
        taken: !!u.quad.rider || this.companions.some((c) => c.quad === u.quad && !c.fsm.is('idle')),
        running: u.quad.engine.isRunning,
        tap: u.quad.fuel.tap,
        choke: u.quad.choke,
        temperature: u.quad.engine.temperature,
      })),
      items: { can: item(this.petrolCan, 'can'), toolbox: item(this.toolbox, 'toolbox') },
      spots: this.world.layout.jerryCanSpots,
    };
  }

  updatePranks(dt, ridden) {
    for (const e of this.pranks.update(dt, this.prankContext(ridden))) this.handlePrankEvent(e);
  }

  /** Acts on pranks (npc/pranks.js): starting one (a choice she made), being found out, putting a hidden thing back. */
  /** Leaves drifting down round you under the trees, dimmed with the daylight (world/autumn.js). */
  updateLeafFall(dt) {
    const cam = this.camera.position;
    const light = this.daylight ? this.daylight.p.nightLight + (1 - this.daylight.p.nightLight) * this.daylight.sun.light : 1;
    const count = this.autumn ? leavesInAir(this.autumnParams, this.world.fields.woods, cam.x, cam.z) : 0;
    this.leafFall.update(dt, this.camera, this.weather.rain > 0.5 ? count * 0.4 : count, this.wind?.strength ?? 1, light);
  }

  /** What the conkers need to know (npc/conkers.js): where you are, and where each girl is and whether she is free to throw. */
  conkerContext(ridden) {
    const woods = this.world.fields.woods;
    const cam = this.camera.position;
    const girls = this.companions.map((c) => {
      const r = c.root.position;
      return { id: c.character.id, free: c.availability().free, x: r.x, z: r.z, inWoods: !!woods?.inWoods(r.x, r.z), throwing: !!c.throwing };
    });
    const amy = this.companions.find((c) => c.character.id === 'amy');
    const amyNear = amy && amy.root.position.distanceTo(cam) < 30;
    return {
      autumn: this.autumn,
      you: { x: cam.x, y: cam.y, z: cam.z },
      girls,
      youInWoods: !!woods?.inWoods(cam.x, cam.z),
      youRiding: !!ridden,
      wet: this.weather.wet,
      amyCanRemark: !!amyNear && amy.availability().canRemark,
    };
  }

  /** Jess throwing a conker at you, as an offer for the chooser (npc/conkers.js). */
  conkerOffers(c, ridden) {
    const ctx = this.conkerContext(ridden);
    return this.conkers.offers(ctx).filter((o) => o.girl === c.character.id).map((o) => ({ ...o, take: () => this.handleConkerEvent(this.conkers.take(o, ctx)) }));
  }

  /** The throw and what follows it: her arm goes back, the conker flies, it lands with a thock and a line (npc/conkers.js). */
  handleConkerEvent(e) {
    const c = this.companions.find((o) => o.character.id === e.girl);
    if (e.type === 'windup') {
      if (!c?.throwConker(e.facing, e.seconds)) {
        this.conkers.windup = null;
        return;
      }
      c.attend(this.camera.position, { weight: 1, seconds: e.seconds + 1 });
      c.voice.say('conkerGo', { force: true });
    } else if (e.type === 'release') {
      if (!this.conkerMesh) {
        this.conkerMesh = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: 0x4a2a12, roughness: 0.35 }));
        this.scene.add(this.conkerMesh);
      }
      this.conkerMesh.position.set(e.from.x, e.from.y, e.from.z);
      this.conkerMesh.visible = true;
    } else if (e.type === 'land') {
      if (this.conkerMesh) this.conkerMesh.visible = false;
      this.conkerAudio.thock(e.at, e.hit ? 1 : 0.5);
      c?.voice.say(e.hit ? 'conkerHit' : 'conkerMiss', { force: true });
      const amy = this.companions.find((o) => o.character.id === 'amy');
      if (amy && amy !== c && amy.root.position.distanceTo(this.camera.position) < 40 && amy.availability().canRemark) amy.voice.say('conkerAmy', { chance: 0.7 });
    } else if (e.type === 'remark') {
      this.companions.find((o) => o.character.id === 'amy')?.voice.say(e.kind === 'slippery' ? 'conkerSlippery' : 'conkerWood', { force: true });
    }
  }

  updateConkers(dt, ridden) {
    if (!this.autumn) return;
    const jess = this.companions.find((o) => o.character.id === 'jess');
    const ctx = { ...this.conkerContext(ridden), hand: null };
    const hand = jess?.rig?.bones?.RightHand;
    if (hand) {
      const v = hand.getWorldPosition(new THREE.Vector3());
      ctx.hand = { x: v.x, y: v.y, z: v.z };
    }
    for (const e of this.conkers.update(dt, ctx)) this.handleConkerEvent(e);
    const at = this.conkers.position();
    if (at && this.conkerMesh) this.conkerMesh.position.set(at.x, at.y, at.z);
  }

  handlePrankEvent(e) {
    const a = e.prank;
    const girl = this.companions.find((c) => c.character.id === a.girl);
    if (e.type === 'start') this.startPrank(a, girl);
    else if (e.type === 'found') {
      girl?.voice.say('prankGiggle', { force: true });
      this.discoveries.learn(prankDiscovery(a));
      this.noteOutcome(a.girl, 'prankLanded');
    }
    else if (e.type === 'restore') {
      const thing = a.item === 'can' ? this.petrolCan : this.toolbox;
      const home = this.itemHome[a.item];
      if (home && !thing.held && !thing.carried) this.restoreItem(girl, thing, a.item, home);
    }
    if (e.type === 'resolved' || e.type === 'restore') delete this.itemHome[a.item];
  }

  /** Time's up: she goes and fetches it back to where it was, or just puts it back if she's busy. */
  restoreItem(girl, thing, kind, home) {
    const put = () => {
      thing.putDown(home, home.yaw);
      if (home.y !== undefined) thing.model.position.y = home.y; // back on the bench, not under it
    };
    const at = thing.model.position;
    const from = girl?.root.position;
    const d = from ? Math.hypot(from.x - at.x, from.z - at.z) || 1 : 1;
    const spot = from ? { x: at.x + ((from.x - at.x) / d) * 0.55, z: at.z + ((from.z - at.z) / d) * 0.55 } : null;
    const act = () => {
      if (thing.held || thing.carried) return;
      if (!this.carryThing(girl, thing, kind, home, null)) put();
    };
    if (!girl || !spot || !girl.sneakTo(spot, act)) put();
  }

  /** She sets off to do it; it only happens if it's still fair game when she gets there. */
  startPrank(a, girl) {
    if (!girl) return this.pranks.cancel(a);
    const quad = a.quad ? this.girlUnits.find((u) => u.spec.id === a.quad).quad : null;
    const thing = a.item === 'can' ? this.petrolCan : a.item === 'toolbox' ? this.toolbox : null;
    const at = quad ? quad.position : thing.model.position;
    // Stops short of it, on her side (an arm's length from an item she's to pick up).
    const from = girl.root.position;
    const d = Math.hypot(from.x - at.x, from.z - at.z) || 1;
    const gap = quad ? 1.3 : 0.55;
    const spot = { x: at.x + ((from.x - at.x) / d) * gap, z: at.z + ((from.z - at.z) / d) * gap };
    const act = () => {
      if (quad) {
        if (quad.rider || quad.engine.isRunning) return this.pranks.cancel(a);
        if (a.kind === 'tap') quad.fuel.tap = 'off';
        else quad.choke = 1;
        this.pranks.apply(a);
        return;
      }
      if (thing.held || thing.carried) return this.pranks.cancel(a);
      this.itemHome[a.item] = { x: thing.model.position.x, z: thing.model.position.z, yaw: thing.model.rotation.y, y: thing.model.position.y };
      // She picks it up, carries it to where she's hiding it and sets it down there.
      const ok = this.carryThing(girl, thing, a.item, { x: a.spot.x, z: a.spot.z, yaw: Math.random() * Math.PI * 2 }, () => {
        if (this.pranks.active.includes(a)) this.pranks.apply(a);
        else delete this.itemHome[a.item];
      });
      if (!ok) this.pranks.cancel(a);
    };
    if (!girl.sneakTo(spot, act)) this.pranks.cancel(a);
  }

  /** The item as a girl carries it: 'can' or 'toolbox'. */
  carryWeightOf(thing, kind) {
    return kind === 'can' ? carryWeight('can', thing.litres, thing.params.capacity) : carryWeight('toolbox');
  }

  /**
   * She's at `thing` (a jerry can or the toolbox, standing on the ground): she picks it up, walks it to `dest` ({ x, z, yaw, y? }) and sets it down,
   * then `onDown()`. False if she can't take it. If she's called away on the way it's set down where she is.
   */
  carryThing(girl, thing, kind, dest, onDown) {
    const down = (pos, yaw) => {
      thing.carried = false;
      thing.putDown(pos, yaw);
      if (dest.y !== undefined && Math.hypot(pos.x - dest.x, pos.z - dest.z) < 0.01) thing.model.position.y = dest.y;
      onDown?.();
    };
    const started = girl.startCarry(kind, thing.model, this.carryWeightOf(thing, kind), {
      onLowered: down,
      onRaised: () => {
        // Walks up to it from wherever she is, stopping just short, and bends to set it down.
        const here = girl.root.position;
        const d = Math.hypot(here.x - dest.x, here.z - dest.z) || 1;
        const near = { x: dest.x + ((here.x - dest.x) / d) * 0.55, z: dest.z + ((here.z - dest.z) / d) * 0.55 };
        if (!girl.carryTo(near, () => girl.putDownCarry({ x: dest.x, y: dest.y, z: dest.z }, dest.yaw))) girl.dropCarry();
      },
    });
    if (started) thing.carried = true;
    return started;
  }

  /**
   * You ask her to do something. A neglected girl sometimes says no, but only
   * when her friend can take it on, so you're never left without: the friend
   * does it, and often gloats.
   */
  askHer(c, action) {
    const friend = c.others().find((o) => o.fsm.is('idle') && o.getActions(this.girlUnits.map((u) => u.quad)).find((x) => x.kind === action.kind && x.quad === action.quad));
    const refusable = ['giveRide', 'follow', 'drive', 'start', 'mount', 'mountRack'].includes(action.kind);
    if (friend && refusable && Math.random() < Math.max(this.favour.refuseChance(c.character.id), this.requests.refuseChance(c.character.id))) {
      c.voice.say('refuseRequest', { force: true });
      const take = friend.getActions(this.girlUnits.map((u) => u.quad)).find((x) => x.kind === action.kind && x.quad === action.quad);
      setTimeout(() => {
        take.run();
        if (Math.random() < this.favour.p.gloatChance) friend.voice.say('gloatTakeOver', { force: true });
        else friend.voice.onRequest(action.kind);
      }, 2200);
      return;
    }
    action.run();
    c.voice.onRequest(action.kind);
  }

  // Companion menu ---------------------------------------------------------

  openCompanionMenu(c) {
    // Asleep on the back: you talk to her and she wakes, gently.
    if (c.nap.asleep) this.napWoke(c, 'gentle'), c.nap.wake('gentle');
    // She's sat out or in the doorway: she gets up first (a moment, with a "hang on"), then you can talk.
    if (c.isResting) {
      const dozing = c.isDozing; // woken gently by you talking to her: her own line, not the "hang on"
      if (dozing) c.wakeUp('gentle');
      if (c.leaveRest(() => this.openCompanionMenu(c)) && !dozing) c.selfEvents.push('restLeave');
      return;
    }
    if (c.isSeated && c.quad.speed > this.player.params.mountSpeed) {
      this.hud.toast('She can\'t get off while it\'s moving');
      return;
    }
    // Up on the tractor's wheel arch already: the one thing to ask is to come down.
    if (c.fsm.is('onTrailer') && this.tractorMount && c.trailer === this.tractorMount) {
      this.openWheel(`Ask ${c.name} to`, [this.tractorWheelOption(c)], c);
      this.player.lookEnabled = false;
      this.player.moveEnabled = false;
      return;
    }
    if (c.fsm.is('onTrailer') && c.trailer === this.tipTrailer) {
      this.openWheel(`Ask ${c.name} to`, [this.tipTrailerWheelOption(c)], c);
      this.player.lookEnabled = false;
      this.player.moveEnabled = false;
      return;
    }
    const ridingLandy = c.fsm.is('onTrailer') && Object.values(this.landys).find((l) => l.mount && l.mount === c.trailer);
    if (c.fsm.is('onTrailer') && c.trailer && (c.trailer === this.utvMount || ridingLandy)) {
      this.openWheel(`Ask ${c.name} to`, [c.trailer === this.utvMount ? this.utvWheelOption(c) : this.landyWheelOption(c, ridingLandy), ...this.workLightWheelOptions(c)], c);
      this.player.lookEnabled = false;
      this.player.moveEnabled = false;
      return;
    }
    const actions = c.getActions(this.girlUnits.map((u) => u.quad));
    const general = this.generalWheelOptions(c);
    if (!actions.length && !general.length) {
      const why = c.availability({ asked: true, pull: true }).why;
      this.hud.toast(why && why !== 'free' ? `${c.name} is ${why}` : 'She\'s busy');
      return;
    }
    // She answers when you ask her something.
    const answer = (a) => () => this.askHer(c, a);
    // On the wheel: anything not about a particular quad, then a slice for each
    // quad (nearest her first) opening a ring of what she could do with it.
    const options = actions.filter((a) => !a.quad).map((a) => ({ label: a.label, run: answer(a) }));
    const push = this.pushStartOption(c);
    if (push) options.push(push);
    options.push(...this.watchWheelOptions(c));
    const tow = this.towSteerOption(c);
    if (tow) options.push(tow);
    options.push(...general);
    const tractor = this.tractorUnit && this.tractorWheelOption(c);
    const other = 'Other vehicles'; // the top ring folds these into one slice (interaction/wheelGroups.js)
    if (tractor?.children.length) options.push({ ...tractor, group: other });
    const utv = this.utvUnit && this.utvWheelOption(c);
    if (utv?.children.length) options.push({ ...utv, group: other });
    for (const l of Object.values(this.landys)) {
      const landy = l.unit && this.landyWheelOption(c, l);
      if (landy?.children.length) options.push({ ...landy, group: other });
    }
    const tipTrailer = this.tipTrailerWheelOption(c);
    if (tipTrailer.children.length) options.push({ ...tipTrailer, group: other });
    for (const unit of [...new Set(actions.filter((a) => a.quad).map((a) => a.quad.unit))]) {
      const own = actions.filter((a) => a.quad === unit.quad);
      options.push({
        label: unit.name,
        color: unit.spec.bodyColor,
        group: 'Quads',
        hint: unit.quad === c.quad && c.isSeated ? 'she\'s on it' : null,
        children: own.map((a) => ({ label: a.short ?? a.label, run: answer(a) })),
      });
    }
    // The quads she can do nothing with just now stay on the wheel, greyed, so its shape doesn't change under you.
    const shown = new Set(actions.filter((a) => a.quad).map((a) => a.quad.unit));
    const why = c.fsm.is('idle') ? 'not just now' : this.busyWhy(c);
    for (const unit of this.girlUnits) {
      if (!shown.has(unit)) options.push({ label: unit.name, color: unit.spec.bodyColor, group: 'Quads', children: [{ label: 'Not just now', disabled: true, hint: why }] });
    }
    options.push(...this.workLightWheelOptions(c));
    options.push(...this.fallingOutWheelOptions(c));
    options.push(...this.romanceWheelOptions(c));
    options.unshift(...this.askAlongWheelOptions(c));
    this.openWheel(`Ask ${c.name} to`, groupWheelOptions(options), c);
    this.player.lookEnabled = false;
    this.player.moveEnabled = false;
  }

  /** Opens the companion wheel, putting the help away so it isn't showing through. */
  openWheel(title, options, her = null) {
    this.hud.toggleHelp(false);
    // Whatever you ask her takes her from what she was on her way to, and she says so (npc/intent.js).
    if (her) {
      const interrupting = (list) => list.map((o) => ({ ...o, ...(o.run ? { run: (...a) => (her.interrupt(), her.answerAsked(), o.run(...a)) } : {}), ...(o.children ? { children: interrupting(o.children) } : {}) }));
      options = interrupting(options);
    }
    this.talkingTo = her; // only she answers, and only she stops what she was about to do
    if (her && this.banterWatch) this.banterWatch.noteTalk(her, this.companions);
    if (her) {
      // Caught out, she owns up as soon as you speak to her.
      const prank = this.pranks.unconfessed(her.character.id);
      // Dressed up today (a shirt and tie), she says why the first time you talk to her (npc/outfits.js).
      const remark = outfitRemark(her.outfit?.style, this.farm.day, her.outfitRemarkedOn);
      if (prank) {
        this.pranks.confess(prank);
        her.voice.say('prankConfess', { force: true });
      } else if (remark) {
        her.outfitRemarkedOn = this.farm.day;
        her.voice.say(remark, { force: true });
      } else this.remindOfFavour(her);
      this.favour.add(her.character.id, this.favour.p.talk);
      her.needs.noticed(her.params.needTalkEase);
      // Her friend stood there watching you talk to the other one.
      const jealous = this.banterWatch?.talked?.jealous;
      if (jealous) {
        this.favour.add(jealous.character.id, -this.favour.p.ignored);
        jealous.needs.slighted(jealous.params.needSlightBump);
      }
    }
    this.menu.open(title, options);
  }

  closeMenu() {
    if (this.menu.isOpen) this.menu.close();
    this.player.lookEnabled = true;
    this.player.moveEnabled = true;
  }

  // Riding ---------------------------------------------------------------

  toggleParkBrake(quad) {
    quad.parkBrake = !quad.parkBrake;
    if (quad.parkBrake) this.achievements.note('parkBrake');
  }

  mount(unit) {
    if (this.player.isRiding || this.tooFastToMount(unit.quad)) return;
    const atWheel = Object.values(this.landys).find((l) => l.unit === unit)?.mount?.slots.driver?.girl; // a girl sat in her parked car of a morning
    if (atWheel) return void this.hud.toast(`${atWheel.name} is in the driver's seat`, 2);
    this.player.mount(unit.quad);
    this.favourQuad(unit, this.favour.p.favouriteQuad);
    unit.quad.setRider(this.player, this.input);
    this.lastUnit = unit;
    this.input.takeWheelSteps();
  }

  /** A moving quad you can't catch hold of (whether or not anyone is on it). */
  tooFastToMount(quad) {
    return quad.speed > this.player.params.mountSpeed;
  }

  /** The companion at the controls of this quad and still going, if any. */
  herDriving(quad) {
    return this.companions.find((c) => c.quad === quad && c.fsm.is('driving') && c.drive?.phase !== 'stop') ?? null;
  }

  tryDismount() {
    const quad = this.riddenUnit.quad;
    if (Math.abs(quad.forwardSpeed) > this.player.params.dismountSpeed) {
      this.jumpOff(quad);
      return;
    }
    const spot = this.findDismountSpot(quad);
    if (!spot) {
      this.hud.toast('No room to get off here');
      return;
    }
    const throttle = quad.throttle;
    quad.setRider(null, null);
    quad.lastLeft = { who: 'you', braked: quad.parkBrake };
    if (!quad.parkBrake && !this.handbrakeHinted) {
      this.handbrakeHinted = true;
      this.hud.toast('Space sets the parking brake, or it will roll off a slope', 3);
    }
    quad.holdRev(throttle); // still revving when you got off: it stays revving
    this.player.dismount(spot, quad.yaw + Math.PI);
  }

  /** A two-wheeler has gone down under you (bikeLean.js): thrown clear to the side it fell, the engine dead, and whoever's near has a word. */
  throwOff(unit) {
    const quad = unit.quad;
    const side = quad.bike.fallSide;
    const spot = this.findDismountSpot(quad, [[side * 1.1, -0.15], [-side * 1.1, -0.15], [0, -1.8]], 0.3);
    this.hud.toast(`You came off the ${unit.label}`, 2.5);
    if (!spot) return; // nowhere clear to land: you stay put, and T rights it
    const push = new THREE.Vector3(spot.x - quad.position.x, 0, spot.z - quad.position.z).normalize();
    const look = this.camera.getWorldDirection(new THREE.Vector3());
    const carry = quad.velocity;
    quad.setRider(null, null);
    quad.lastLeft = { who: 'you', braked: false };
    this.player.leapOff(spot, {
      yaw: Math.atan2(-look.x, -look.z),
      pitch: Math.asin(THREE.MathUtils.clamp(look.y, -1, 1)),
      carry,
      push,
      speed: Math.max(quad.speed, 6),
      collider: quad.physics.collider,
    });
    const near = this.companions.filter((c) => c.root.position.distanceTo(quad.position) < 40).sort((a, b) => a.root.position.distanceTo(quad.position) - b.root.position.distanceTo(quad.position))[0];
    near?.voice.say('youCameOff', { urgent: true });
  }

  /**
   * Getting off at speed: jump clear to the outside of the turn (or whichever
   * side is free) and let the quad carry on without you, throttle and bars
   * left where they were.
   */
  jumpOff(quad) {
    // Positive steer turns left, so the outside of the turn is the right (-x).
    const side = quad.steer > 0.02 ? -1 : 1;
    const spot = this.findDismountSpot(
      quad,
      [
        [side * 1.05, -0.15],
        [-side * 1.05, -0.15],
        [0, -1.8],
      ],
      0.3,
    );
    if (!spot) {
      this.hud.toast('No room to jump off here');
      return;
    }
    const throttle = quad.throttle;
    const speed = quad.speed;
    const carry = quad.velocity;
    const push = new THREE.Vector3(spot.x - quad.position.x, 0, spot.z - quad.position.z).normalize();
    // Keep looking wherever you were looking.
    const look = this.camera.getWorldDirection(new THREE.Vector3());
    quad.setRider(null, null);
    quad.lastLeft = { who: 'you', braked: false }; // jumped off at speed: no time for the brake
    quad.carryOn(throttle);
    this.player.leapOff(spot, {
      yaw: Math.atan2(-look.x, -look.z),
      pitch: Math.asin(THREE.MathUtils.clamp(look.y, -1, 1)),
      carry,
      push,
      speed,
      collider: quad.physics.collider,
    });
  }

  /**
   * Free spot beside the bike for the player's feet, trying each [x, z] offset
   * in chassis space in turn (default: left, right, behind, then in front).
   * `lift` raises the feet off the ground, for jumping off.
   */
  findDismountSpot(
    quad,
    candidates = [
      [1.0, -0.15],
      [-1.0, -0.15],
      [0, -1.7],
      [0, 1.8],
    ],
    lift = 0,
  ) {
    const RAPIER = this.RAPIER;
    const shape = new RAPIER.Capsule(PLAYER_CAPSULE.halfHeight, PLAYER_CAPSULE.radius);
    const terrain = this.world.terrain.collider;
    for (const c of candidates) {
      const [lx, lz] = clearOfChassis(c, quad.physics.layout?.chassis, quad.scale, PLAYER_CAPSULE.radius);
      const p = quad.localToWorld(lx, 0, lz);
      const feetY = this.world.heightAt(p.x, p.z) + 0.05 + lift;
      const centre = { x: p.x, y: feetY + PLAYER_CAPSULE.feetToCentre + 0.05, z: p.z };
      const hit = this.physics.intersectionWithShape(
        centre,
        { x: 0, y: 0, z: 0, w: 1 },
        shape,
        undefined,
        undefined,
        undefined,
        undefined,
        (collider) => collider.handle !== terrain.handle,
      );
      if (!hit) return new THREE.Vector3(p.x, feetY, p.z);
    }
    return null;
  }

  /** Puts the jerry can on the ground just in front of the player. */
  putCanDown() {
    const p = this.player.position;
    const yaw = this.player.yaw;
    const spot = new THREE.Vector3(p.x - Math.sin(yaw) * 0.7, 0, p.z - Math.cos(yaw) * 0.7);
    this.can.putDown(spot, yaw + Math.PI / 2);
  }

  /**
   * Stood looking at a four-stroke: Y pulls the dipstick and says where the oil is; holding it near the oil bottle (by the petrol tank)
   * pours some in, up to the top mark.
   */
  dipstick(unit, input, dt) {
    const sump = unit.quad.sump;
    if (!sump) {
      if (input.wasPressed('KeyY') && !unit.quad.engine.params.tickler) this.hud.toast('A two-stroke has no dipstick: its oil goes in with the petrol'); // (Y is the old bike's tickler)
      return;
    }
    if (input.wasPressed('KeyY')) {
      this.yHeld = 0;
      const { text } = readStick(sump.level, Math.random() * 2 - 1, this.sumpParams);
      sump.checked = true;
      this.achievements.note('dipstick');
      this.hud.toast(`Dipstick: ${text}${sump.low ? '. Hold Y beside the oil bottle to top it up' : sump.tooMuch ? '. Hold Y away from the bottle to let some out at the drain plug' : ''}`, 3);
      return;
    }
    if (!input.isDown('KeyY')) {
      this.yHeld = 0;
      return;
    }
    this.yHeld = (this.yHeld ?? 0) + dt;
    if (this.yHeld < 0.5) return;
    const bottle = this.oilBottle.worldPosition();
    const q = unit.quad.position;
    if (Math.hypot(q.x - bottle.x, q.z - bottle.z) > this.sumpParams.bottleRange) {
      // Too much in: away from the bottle, holding the key lets it out at the drain plug, down to the line.
      if (sump.tooMuch || sump.level > 1) {
        sump.drain(dt);
        this.hud.setStatus(`Letting oil out at the drain plug: ${readStick(sump.level, 0, this.sumpParams).text}`);
      } else if (this.yHeld < 0.6) this.hud.toast('The oil bottle is by the petrol tank: pick it up and bring it here', 2.5);
      return;
    }
    if (sump.pour(dt) > 0) {
      this.achievements.note('oilPoured');
      this.hud.setStatus(`${sump.level > 1 ? 'Too much oil' : 'Topping up the oil'}: ${readStick(sump.level, 0, this.sumpParams).text}`);
    } else if (this.yHeld < 0.6) this.hud.toast('As full as it will hold');
  }

  /** What a dip of this quad's tank shows: the stick's reading and whether it has a fuel gauge to compare with (null: none to show). */
  tankDipOf(unit) {
    const f = unit.quad.fuel;
    const reading = readTank({ litres: f.litres, capacity: f.params.tankCapacity, reserve: f.params.noTap ? 0 : f.params.reserveLitres, noise: Math.random() * 2 - 1 }, this.dipParams);
    const hasGauge = featuresOf(unit.spec, !!unit.quad.pod).fuelGauge;
    return { reading, shown: hasGauge ? unit.quad.shownFuel : null };
  }

  /**
   * Stood looking at a quad: U puts a stick down the tank and says what is really in it, and whether the gauge agrees. If Amy is near
   * enough to see it, a gauge that is off goes in her logbook.
   */
  dipTank(unit) {
    const { reading, shown } = this.tankDipOf(unit);
    this.audioHub.useCue('latch');
    this.hud.toast(dipMessage(reading, shown, this.dipParams), 3.5);
    const quirk = ['fuelSticks', 'fuelHigh'].find((k) => unit.quad.quirks.has(k));
    if (quirk && shown !== null && gaugeLies(shown, reading.share, this.dipParams)) this.notebook.note(unit, { kind: 'quirk', quirk });
  }

  /**
   * Amy walks round a quad before she rides it: squeezes the tyres, looks it over and checks the dipstick, and tops it up if it wants some,
   * saying what she finds. Jess goes straight to the starter. Once per ride. `c.walkFound` keeps what she found, for the girls to act on later.
   */
  updateOilChecks() {
    for (const c of this.companions) {
      const driving = c.fsm.is('driving');
      if (!driving) {
        c.oilChecked = null;
        continue;
      }
      if (!c.quad || c.oilChecked === c.quad) continue;
      c.oilChecked = c.quad;
      c.walkFound = [];
      const driven = this.units.find((u) => u.quad === c.quad);
      if (c.character.id !== 'amy') continue;
      if (Math.random() < this.walkParams.amyWalks) {
        c.walkFound = walkRound({ tyres: c.quad.tyres, faults: c.quad.faults }, this.walkParams);
        if (driven) c.knows.learn(driven.spec.id, c.walkFound);
        const refused = driven ? c.wontRide(c.quad) : null;
        if (refused && !this.eventOn()) {
          // Not on that: she says why instead of the usual remark, pulls up and gets off.
          c.voice.say(WONT_LINE[refused], { urgent: true, chance: 1 });
          c.requestStandBeside(c.quad);
          if (driven) for (const finding of c.walkFound) this.notebook.note(driven, { kind: 'walk', finding }, { saw: true });
          continue;
        } else {
          c.walkFound.forEach((key, i) => c.voice.say(key, { urgent: i === 0, chance: 1 }));
        }
        if (driven) for (const finding of c.walkFound) this.notebook.note(driven, { kind: 'walk', finding }, { saw: true });
      }
      if (driven && !c.walkFound.length && this.amyDipsTank(c, driven)) continue;
      const sump = c.quad.sump;
      if (!sump || Math.random() > this.sumpParams.amyChecks) continue;
      if (sump.tooMuch) {
        sump.drain(1e6); // she has the drain plug out and back in without ceremony
        c.voice.say('oilOver', { urgent: true, chance: 1 });
        if (driven) this.notebook.note(driven, { kind: 'oil' }, { saw: true });
      } else if (sump.level < this.sumpParams.minMark + this.sumpParams.amyTopUpMargin) {
        sump.fill();
        c.voice.say('oilTopUp', { urgent: true, chance: 1 });
        if (driven) this.notebook.note(driven, { kind: 'oil' }, { saw: true });
      } else if (!c.walkFound.length) {
        c.voice.say('oilFine', { chance: 0.35 });
      }
    }
  }

  /**
   * Amy dips the tank of a quad whose gauge she knows lies, before she rides it, and says what she finds. Returns true if she did,
   * which is her remark for the walk-round. She writes it up as she does the oil.
   */
  amyDipsTank(c, unit) {
    const quirk = ['fuelSticks', 'fuelHigh'].find((k) => c.voice.knowsQuirk(unit, k));
    if (!quirk || Math.random() > this.dipParams.amyDips) return false;
    const { reading, shown } = this.tankDipOf(unit);
    if (shown === null) return false;
    c.voice.say(reading.low ? 'tankDipLow' : gaugeLies(shown, reading.share, this.dipParams) ? 'tankDipLies' : 'tankDipFine', { urgent: true, chance: 1 });
    if (unit.quad.quirks.has(quirk)) this.notebook.note(unit, { kind: 'quirk', quirk }, { saw: true });
    return true;
  }

  /** A race, drag race, follow the leader or recall is on, so a girl shouldn't walk out of it. */
  eventOn() {
    return this.race.active || this.drag.active || this.convoy.active || !!this.recalling;
  }

  /** E on a quad with the jump leads in hand. */
  clampLeads(quad) {
    this.achievements.note('leads');
    const result = this.leads.clamp(quad);
    if (result === 'first') this.hud.toast('Clamped on. Now the other end on a running quad');
    else if (result === 'joined') this.hud.toast('Leads on: a running quad charges a flat one. Keep them close, nose to nose');
  }

  putLeadsDown() {
    const p = this.player.position;
    const yaw = this.player.yaw;
    this.leads.putDown(new THREE.Vector3(p.x - Math.sin(yaw) * 0.7, 0, p.z - Math.cos(yaw) * 0.7), yaw);
  }

  /** The toolbox, jump leads or oil bottle in your hands, which the workbench has a place for: { name, item, spot }, or null. */
  benchItem() {
    const L = this.world.layout;
    if (this.toolbox.held) return { name: 'toolbox', item: this.toolbox, spot: L.toolbox };
    if (this.leads.held) return { name: 'jump leads', item: this.leads, spot: L.benchLeads };
    if (this.heldBattery()?.unitId === BOOSTER_ID) return { name: 'booster pack', item: this.heldBattery(), spot: L.benchPack };
    if (this.oilBottle.held) return { name: 'oil bottle', item: this.oilBottle, spot: L.benchOil };
    return null;
  }

  /** E at the workbench with the toolbox or the leads in your hands: back in their place on top of it. */
  putOnBench({ item, spot }) {
    item.putDown(new THREE.Vector3(spot.x, 0, spot.z), spot.yaw);
    item.model.position.y += this.world.layout.bench.height;
  }

  putCoolantBottleDown() {
    const p = this.player.position;
    const yaw = this.player.yaw;
    this.coolantBottle.putDown(new THREE.Vector3(p.x - Math.sin(yaw) * 0.7, 0, p.z - Math.cos(yaw) * 0.7), yaw);
  }

  /** Holding E looking at a vehicle with the coolant bottle in your hands: tops the radiator up, then flushes a stuck thermostat free (items/coolantBottle.js). True while it pours. */
  coolantTopUp(unit, dt) {
    const e = unit.engine;
    const how = pourStep(e, dt, this.coolantBottle.params);
    this.eHeld = (this.eHeld ?? 0) + dt;
    if (how === 'pouring') this.hud.setStatus(`Topping up the coolant: ${levelText(e.coolant)}`);
    else if (how === 'flushing') this.hud.setStatus('Flushing coolant through the engine');
    else if (how === 'freed') this.hud.toast('Flushed right through: the thermostat has freed up', 3);
    else if (this.eHeld < 0.6) {
      this.hud.toast(how === 'air' ? 'No radiator: that one is air-cooled' : how === 'hot' ? 'Too hot to open the cap: switch it off and let it cool' : 'The radiator is full', 2.5);
    }
    return how === 'pouring' || how === 'flushing';
  }

  putAntiGelBottleDown() {
    const p = this.player.position;
    const yaw = this.player.yaw;
    this.antiGelBottle.putDown(new THREE.Vector3(p.x - Math.sin(yaw) * 0.7, 0, p.z - Math.cos(yaw) * 0.7), yaw);
  }

  /** Holding E looking at a vehicle with the anti-gel in your hands: doses a diesel's tank (items/antiGelBottle.js). True while it pours. */
  antiGelDose(unit, dt) {
    const q = unit.quad;
    const how = doseStep(q.fuel, unit.engine, dt, this.antiGelBottle.params);
    this.eHeld = (this.eHeld ?? 0) + dt;
    if (how === 'pouring') this.hud.setStatus(`Treating the diesel: ${Math.round(q.fuel.antiGel * 100)}% of the tank`);
    else if (this.eHeld < 0.6) {
      this.hud.toast(how === 'petrol' ? 'That runs on petrol: it never waxes' : how === 'empty' ? 'Nothing in the tank to treat' : 'The tank is already treated', 2.5);
    }
    return how === 'pouring';
  }

  putOilBottleDown() {
    const p = this.player.position;
    const yaw = this.player.yaw;
    this.oilBottle.putDown(new THREE.Vector3(p.x - Math.sin(yaw) * 0.7, 0, p.z - Math.cos(yaw) * 0.7), yaw);
  }

  // Batteries --------------------------------------------------------------------

  /** The bench charger and the batteries: every vehicle with a starter has a battery that can come out (items/battery.js). */
  setUpBatteries() {
    const L = this.world.layout;
    this.batteries = new Map(); // by vehicle id, made when the battery first comes out
    this.charger = new Charger();
    this.boosterParams = { ...DEFAULT_BOOSTER_PARAMS };
    registerTuning('Booster pack', this.boosterParams, BOOSTER_PARAM_RANGES);
    this.setUpBoosterPack();
    registerTuning('Battery charger', this.charger.params, CHARGER_PARAM_RANGES);
    const built = buildChargerModel();
    this.chargerModel = built;
    const top = this.world.heightAt(L.benchCharger.x, L.benchCharger.z) + L.bench.height;
    built.group.position.set(L.benchCharger.x, top, L.benchCharger.z);
    this.scene.add(built.group);
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.set(CHARGER_SLOT.x / 2, 0.12, 0.02);
    built.group.add(proxy);
    this.interaction.add({
      target: proxy,
      priority: 1, // it sits on the bench, whose box would otherwise be hit first
      isAvailable: () => !!this.heldBattery() || (!!this.chargedBattery() && !this.handsFull),
      prompt: () => {
        const held = this.heldBattery();
        if (held) return this.charger.busy ? { text: 'The charger already has a battery on   ·   G put it down' } : `Put the ${held.name} on the charger${this.generator.powered ? '' : ' (it needs the generator running)'}`;
        return `Pick up the ${this.chargedBattery().name}`;
      },
      feedback: () => (this.heldBattery() ? 'putDown' : 'pickUp'),
      interact: () => {
        const held = this.heldBattery();
        if (held && !this.charger.busy) this.putOnCharger(held);
        else if (!held && !this.handsFull) this.pickUpBattery(this.chargedBattery());
      },
    });
  }

  /** The next morning: a battery that was on the charger is on it still and has had all night; any other loose one is left on the floor by the bench. */
  restoreBatteries(saved = {}) {
    const L = this.world.layout;
    let n = 0;
    for (const unit of this.units) {
      if (!unit.engine.batteryOut) continue;
      const b = this.batteryOf(unit);
      if (saved[unit.id]?.where === 'charger' && !this.charger.busy) {
        this.putOnCharger(b);
        unit.engine.battery = 1;
        this.charger.full = true;
      } else {
        b.putDown(new THREE.Vector3(L.bench.x - 1.4 + n * 0.4, 0, L.bench.z + 0.85), 0.3 * n);
        n++;
      }
    }
  }

  /** The next morning: the pack has lost a little sitting about; if it was on the charger it is on it still, and full. */
  restoreBoosterPack(saved) {
    if (!saved) return;
    const pack = this.boosterPack;
    pack.engine.battery = packOvernight(saved.charge ?? 1, this.boosterParams);
    if (saved.where === 'charger' && !this.charger.busy) {
      this.putOnCharger(pack);
      pack.engine.battery = 1;
      this.charger.full = true;
    }
  }

  /** Where a unit's battery is, in words (the debug panel). */
  batteryWhere(unit) {
    const b = this.batteries.get(unit.id);
    return !b?.out ? 'in the vehicle' : b.held ? 'in your hands' : b.where === 'charger' ? 'on the bench charger' : 'loose, out of the vehicle';
  }

  describeBoosterPack() {
    const p = this.boosterPack;
    return `${Math.round(p.engine.battery * 100)}%, ${p.held ? 'in your hands' : p.where === 'charger' ? 'on the charger' : 'loose'}`;
  }

  /** The panel's and the console's pack setting: its charge, 0 to 1. */
  debugBoosterCharge(v) {
    this.boosterPack.engine.battery = Math.max(0, Math.min(1, v));
  }

  describeCharger() {
    const b = this.chargedBattery();
    return b ? `${b.name} at ${Math.round(b.engine.battery * 100)}%${this.charger.full ? ', full' : ''}` : 'empty';
  }

  debugBatteryOut(unit) {
    if (!hasBattery(unit)) return this.hud.toast('It has no battery to take out');
    const b = this.batteryOf(unit);
    if (b.out) return;
    const q = unit.quad.position;
    b.putDown({ x: q.x + 1.6, z: q.z }, 0.4);
  }

  /** The panel's and the console's engine swap: true takes the engine out onto the floor by the parts rack, false fits the first spare that suits it. Same as the bench. */
  debugEngineOut(unit, out) {
    if (out && canPull(unit)) this.hud.toast(this.bench.pullEngine(unit));
    else if (!out && unit.engineOut && fitIndex(this.spares.engines, unit) >= 0) this.hud.toast(this.bench.fitEngine(unit, 1));
  }

  debugBatteryIn(unit) {
    if (this.batteries.get(unit.id)?.out) this.batteryIn(unit);
  }

  debugChargerClear() {
    const b = this.chargedBattery();
    if (b) this.pickUpBattery(b);
  }

  /** The debug panel's and the console's generator buttons call the real game methods. */
  describeGenerator() {
    return `${this.generator.describe()}; the barn bulb is ${this.generator.powered ? 'on' : 'off'}${this.charger.busy ? ', the charger is drawing on it' : ''}`;
  }

  debugGeneratorPull() {
    const r = this.pullGenerator('debug');
    this.hud.toast(r === null ? (this.generator.running ? 'It is already running' : 'A pull is in hand') : r === 'caught' ? 'The generator catches' : r === 'dry' ? 'Empty tank' : 'It coughs');
  }

  debugGeneratorFuel(litres) {
    if (this.generator.running) this.switchGeneratorOff();
    this.generator.fuel = Math.max(0, Math.min(this.generator.params.tank, litres));
  }

  /** The battery on the charger, or null. */
  chargedBattery() {
    return this.charger.busy ? this.batteries.get(this.charger.unitId) ?? null : null;
  }

  /** The battery in your hands, or null. */
  heldBattery() {
    for (const b of this.batteries?.values() ?? []) if (b.held) return b;
    return null;
  }

  /** The unit's battery item, made on first use. */
  batteryOf(unit) {
    let b = this.batteries.get(unit.id);
    if (!b) {
      b = new BatteryItem({ scene: this.scene, world: this.world, unit });
      this.batteries.set(unit.id, b);
      this.interaction.add({
        target: b.proxy,
        isAvailable: () => b.out && !b.held && !this.handsFull,
        prompt: () => `Pick up the ${b.name}`,
        feedback: 'pickUp',
        interact: () => this.pickUpBattery(b),
      });
    }
    return b;
  }

  pickUpBattery(b) {
    if (this.charger.holds(b.unitId)) {
      this.charger.take();
      this.chargerModel.set({});
    }
    b.pickUp(this.camera);
  }

  /** Lifts a unit's battery out into your hands (the bench job). */
  batteryOut(unit) {
    if (!hasBattery(unit)) return false;
    this.pickUpBattery(this.batteryOf(unit));
    return true;
  }

  /** Fits the battery you hold into its vehicle (the bench job, or E at the vehicle). */
  batteryIn(unit) {
    const b = this.batteries.get(unit.id);
    if (!b?.out) return false;
    if (this.charger.holds(unit.id)) this.charger.take();
    b.fit();
    return true;
  }

  /** The booster pack lies on the workbench with a full charge; it is in the `batteries` map so carrying and the charger treat it as one (items/boosterPack.js). */
  setUpBoosterPack() {
    const L = this.world.layout;
    const pack = new BoosterPack({ scene: this.scene, world: this.world });
    this.batteries.set(BOOSTER_ID, pack);
    this.boosterPack = pack;
    pack.putDown(new THREE.Vector3(L.benchPack.x, 0, L.benchPack.z), L.benchPack.yaw, this.world.heightAt(L.benchPack.x, L.benchPack.z) + L.bench.height);
    this.interaction.add({
      target: pack.proxy,
      priority: 1, // it sits on the bench, whose box would otherwise be hit first
      isAvailable: () => !this.handsFull && pack.where === 'loose',
      prompt: () => 'Pick up the booster pack',
      feedback: 'pickUp',
      interact: () => this.pickUpBattery(pack),
    });
  }

  /** Holding E at a vehicle with the booster pack in your hands: pushes charge into its battery, up to starting. True while it flows. */
  boostWithPack(unit, dt) {
    const how = boostStep(this.boosterPack.engine, unit.engine, dt, this.boosterParams);
    this.eHeld = (this.eHeld ?? 0) + dt;
    if (how === 'boosting') {
      this.hud.setStatus(`Boosting the ${unit.label}: battery ${Math.round(unit.engine.battery * 100)}%, pack ${Math.round(this.boosterPack.engine.battery * 100)}%`);
    } else if (this.eHeld < 0.6) {
      const why = { out: `The ${unit.label} has no battery in it`, running: `The ${unit.label} is running: switch it off first`, enough: `The ${unit.label} has enough to start on`, flat: 'The booster pack is flat: put it on the charger' };
      this.hud.toast(why[how], 2.5);
    }
    return how === 'boosting';
  }

  batteryPrompt(unit) {
    const b = this.heldBattery();
    if (b.unitId === BOOSTER_ID) {
      if (unit.engine.batteryOut) return { text: `The ${unit.label} has no battery in it   ·   G put the pack down` };
      return { action: `Boost the ${unit.label} from the pack (${Math.round(b.engine.battery * 100)}%)`, hold: true, keys: [['G', 'Put the pack down']] };
    }
    if (b.unitId !== unit.id) return { text: `That is the ${b.name}, not the ${unit.label}'s   ·   G put it down` };
    if (unit.engine.isRunning || unit.engine.state === 'cranking') return { text: `Switch the ${unit.label} off first   ·   G put the battery down` };
    return `Fit the battery in the ${unit.label}   ·   G put it down`;
  }

  fitHeldBattery(unit) {
    const b = this.heldBattery();
    if (b.unitId !== unit.id || unit.engine.isRunning || unit.engine.state === 'cranking') return;
    this.batteryIn(unit);
    this.hud.toast(unit.engine.battery >= 0.9 ? `The ${unit.label} battery is back in, fully charged` : `The ${unit.label} battery is back in, though it is not fully charged`);
  }

  putBatteryDown() {
    const b = this.heldBattery();
    const p = this.player.position;
    const yaw = this.player.yaw;
    b.putDown(new THREE.Vector3(p.x - Math.sin(yaw) * 0.7, 0, p.z - Math.cos(yaw) * 0.7), yaw);
  }

  putOnCharger(b) {
    const g = this.chargerModel.group;
    const at = g.localToWorld(new THREE.Vector3(CHARGER_SLOT.x, 0.006, CHARGER_SLOT.z));
    b.setOnCharger(at, g.rotation.y);
    this.charger.put(b.unitId, b.engine);
  }

  /** The charger working: the needle and lamps follow the battery on it. */
  updateCharger(dt) {
    const b = this.chargedBattery();
    // It runs off the generator: with that off, the lamps are dark and nothing charges.
    const live = this.generator.powered;
    if (this.charger.update(live ? dt : 0, b?.engine) === 'full') this.hud.toast(`The charger light has gone green: the ${b.name} is full`);
    this.chargerModel.set({ level: live ? b?.engine.battery ?? 0 : 0, charging: !!b && live, full: this.charger.full });
  }

  // The generator ----------------------------------------------------------------

  /** The diesel set outside the barn door (items/generator.js): it powers the barn bulb and the bench charger, and is off every morning. */
  setUpGenerator() {
    const L = this.world.layout.generator;
    this.generator = new Generator();
    registerTuning('Generator', this.generator.params, GENERATOR_PARAM_RANGES);
    this.generatorAudio = new GeneratorAudio(this.audioHub);
    const built = buildGeneratorModel();
    this.generatorModel = built;
    const y = this.world.heightAt(L.x, L.z);
    built.group.position.set(L.x, y, L.z);
    built.group.rotation.y = L.yaw;
    this.scene.add(built.group);
    this.generatorAt = { x: L.x, y: y + 0.4, z: L.z };
    // A thin grey-blue puff from the stack while it runs: a few a second, thicker for the first seconds after it catches and with the charger on.
    this.generatorSmoke = new ExhaustSmoke(this.scene, (x, z) => this.world.heightAt(x, z), { ...DEFAULT_SMOKE_PARAMS, startSize: 0.07, endSize: 1.1, lifeMin: 1.4, lifeMax: 3, buoyancy: 0.5, opacity: 1.7, tint: '#d8e0ea' });
    built.group.updateMatrixWorld(true);
    this.generatorSmokeTop = built.group.localToWorld(new THREE.Vector3(GENERATOR_EXHAUST.x, GENERATOR_EXHAUST.y, GENERATOR_EXHAUST.z));
    this.generatorSmokeBudget = 0;
    this.generatorNoVel = { x: 0, y: 0, z: 0 };
    this.generatorClock = 0;
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(GENERATOR_SIZE.x, GENERATOR_SIZE.y, GENERATOR_SIZE.z), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.y = GENERATOR_SIZE.y / 2;
    built.group.add(proxy);
    // A set that cannot be walked through.
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), L.yaw);
    this.physics.createCollider(
      this.RAPIER.ColliderDesc.cuboid(GENERATOR_SIZE.x / 2, GENERATOR_SIZE.y / 2, GENERATOR_SIZE.z / 2).setTranslation(L.x, y + GENERATOR_SIZE.y / 2, L.z).setRotation(q),
    );
    this.interaction.add({
      target: proxy,
      isAvailable: () => !this.handsFull || !!this.can.held,
      prompt: () => this.generatorPrompt(),
      feedback: 'own',
      interact: () => {
        if (this.can.held) return;
        if (this.generator.running) this.switchGeneratorOff();
        else this.pullGenerator();
      },
      hold: (dt) => this.pourIntoGenerator(dt),
    });
  }

  generatorPrompt() {
    const g = this.generator;
    const fuel = `${g.fuel.toFixed(1)} / ${g.params.tank} L`;
    if (this.can.held) {
      if (g.running) return { text: `The generator is running: switch it off before you refuel it (${fuel})` };
      if (this.can.diesel < 0.5 || this.can.litres < 0.01) return { text: `The generator takes red diesel: this can has ${this.can.litres < 0.01 ? 'nothing in it' : 'petrol in it'}` };
      if (g.space < 0.01) return { text: `The generator's tank is full (${fuel})` };
      return { text: `Hold E to fill the generator with diesel (${fuel})` };
    }
    if (g.running) return `Switch the generator off (${fuel})`;
    return g.fuel <= 0 ? 'Pull the cord (the tank looks empty)' : `Pull the cord to start the generator (${fuel})`;
  }

  /** Holding E with a can: red diesel into the generator's tank, while it is off. */
  pourIntoGenerator(dt) {
    const g = this.generator;
    if (!this.can.held || g.running || this.can.diesel < 0.5 || g.space < 0.01) return false;
    const poured = g.add(this.can.take(Math.min(g.params.pourRate * dt, g.space)), this.can.diesel);
    return poured > 0;
  }

  /** A pull of the cord, by you or a girl. Returns what came of it ('caught', 'coughed', 'dry' or null if one was in hand). */
  pullGenerator(by = 'you') {
    const g = this.generator;
    const result = g.pull();
    const at = this.generatorAt;
    if (result === 'caught') {
      this.generatorAudio.catch(at);
      this.notice('engineStart', at, { key: 'generator', strength: 1 });
      this.hud.toast('The generator catches');
    } else if (result === 'coughed' || result === 'dry') {
      this.generatorAudio.crank(at, result === 'dry');
      if (by === 'you') this.hud.toast(result === 'dry' ? 'Nothing happens: the tank is empty' : 'It coughs and dies. Pull again');
    }
    return result;
  }

  switchGeneratorOff() {
    if (!this.generator.stop()) return;
    this.generatorAudio.stop(this.generatorAt);
    this.hud.toast('The generator is off');
  }

  /** The set running: fuel burning (more with the charger on), its sound and shake, and the dial on its panel. */
  updateGenerator(dt) {
    const g = this.generator;
    this.generatorClock += dt;
    if (g.update(dt, this.charger.busy ? 1 : 0) === 'stalled') {
      this.generatorAudio.stop(this.generatorAt, true);
      this.notice('stall', this.generatorAt, { key: 'generator', strength: 1 });
      this.hud.toast('The generator has run out of diesel');
      const near = this.companions.filter((c) => c.availability().canRemark && c.root.position.distanceTo(this.camera.position) < 30);
      near[0]?.voice.say('generatorOut', { chance: 0.9 });
    }
    if (g.running) {
      this.generatorAudio.ensureLoop(this.generatorAt);
      this.generatorAudio.update(this.generatorAt, this.world.indoor(this.camera.position.x, this.camera.position.z));
    }
    // The smoke: puffs from the stack leaning downwind, the first few seconds after it catches the thickest.
    const sm = this.generatorSmoke;
    sm.params.windX = this.wind.x;
    sm.params.windZ = this.wind.z;
    const choke = g.running ? Math.max(0, 1 - g.ranFor / 4) : 0;
    this.generatorSmokeBudget = Math.min(this.generatorSmokeBudget + (g.running ? 3 + 5 * choke + 3 * (this.charger.busy ? 1 : 0) : 0) * dt, 3);
    sm.tipPos.copy(this.generatorSmokeTop);
    sm.tipDir.set(0, 1, 0.1);
    while (this.generatorSmokeBudget >= 1) {
      this.generatorSmokeBudget -= 1;
      sm.spawn(0.2 + 0.25 * choke + (g.fuel < g.params.sputterAt ? 0.2 : 0), 0.55 - 0.3 * choke, 0.7 + Math.random() * 0.5, this.generatorNoVel, 0);
    }
    sm.simulate(dt);
    this.generatorModel.set({ level: g.level, running: g.running, pull: g.pulling > 0 ? Math.sin((1 - g.pulling / g.params.pullSeconds) * Math.PI) : 0, time: this.generatorClock });
  }

  putToolboxDown() {
    const p = this.player.position;
    const yaw = this.player.yaw;
    this.toolbox.putDown(new THREE.Vector3(p.x - Math.sin(yaw) * 0.7, 0, p.z - Math.cos(yaw) * 0.7), yaw);
  }

  // The bucket list ----------------------------------------------------------

  achievementUnlocked(a) {
    this.hud.toast(`\u2713 ${a.name}  (+${a.points})`, 3.5);
    this.audioHub.chime();
    if (this.hud.bucketOpen) this.showBucketList();
  }

  /** A quiet toast and nothing else: it isn't a prize, and the girls don't remark on it. */
  discoveryLearnt() {
    this.hud.toast('Added to your notebook', 3);
    if (this.hud.bucketOpen) this.showBucketList();
  }

  /** What stalling the vehicle you're on has taught you (a stall that isn't a lesson, like the key coming off, teaches nothing). */
  updateDiscoveries() {
    const unit = this.riddenUnit;
    if (!unit) return;
    for (const ev of unit.quad.engine.events) {
      if (ev.type !== 'stalled') continue;
      const id = stallDiscovery(ev.reason, unit.quad.choke ?? 0);
      if (id) this.discoveries.learn(id);
    }
  }

  /** The bucket list's pages, then (from a fresh spread) the notebook's "Things I've learnt". */
  notebookPages() {
    const list = paginate(this.achievements.entries()).map((pg) => ({ ...pg, title: 'Bucket list' }));
    if (list.length % 2) list.push({ lines: [], title: 'Bucket list' });
    const learnt = paginate(this.discoveries.entries(), 7).map((pg) => ({ ...pg, title: 'Things I\'ve learnt' }));
    return [...list, ...learnt];
  }

  showBucketList() {
    this.bucketPages = this.notebookPages();
    const shown = this.hud.showBucket(this.bucketPages, this.achievements.score(), this.bucketSpread ?? 0, this.discoveries.score());
    this.bucketSpread = shown.spread;
    this.bucketSpreads = shown.count;
  }

  /** Turns the notebook's page (+1 forward, -1 back). */
  turnBucketPage(by) {
    this.bucketSpread = Math.max(0, Math.min((this.bucketSpread ?? 0) + by, (this.bucketSpreads ?? 1) - 1));
    this.showBucketList();
  }

  toggleBucketList() {
    if (this.hud.bucketOpen) this.hud.hideBucket();
    else this.showBucketList();
  }

  updateAchievements(dt, ridden) {
    this.achievements.update(dt, achievementSnapshot(this, ridden));
  }

  // Loop -----------------------------------------------------------------

  /**
   * The vehicles' wear (vehicle/detail/wear.js) is baked a piece at a time after loading rather than during it (about 150 ms a
   * vehicle): `budgetMs` of it a frame, more behind the start card where nothing moves. Until a vehicle is baked it shows no edges.
   */
  bakeWear(budgetMs) {
    const start = performance.now();
    for (const unit of this.units) {
      const coat = unit.mud?.coat;
      while (coat?.bakeStep()) if (performance.now() - start > budgetMs) return;
    }
    for (const t of [this.trailer, this.tipTrailer, this.sprayer]) while (t?.coat?.bakeStep()) if (performance.now() - start > budgetMs) return; // and the trailers'
  }

  frame() {
    // Under the fps cap a screen tick that comes too soon is skipped whole: no time passes, and keys pressed wait for the next frame.
    const started = performance.now();
    const due = nextFrameAt(started / 1000, this.frameDueAt, this.graphics.maxFps);
    if (due === null) return;
    this.frameDueAt = due;
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), MAX_FRAME_DT);
    const input = this.input;
    this.pollPad(dt);
    // Paused: the farm as it stands behind the card and nothing else, so no time passes for anything. Nothing moves, so it is drawn when
    // the pause starts or the window changes, and twice a second in case something finished loading. The very first frame runs
    // regardless, so the camera is put at your eyes and everything is placed before the start screen shows the farm behind it.
    this.setPaused(this.isPaused());
    if (this.photos.modeActive && this.paused) this.photos.exitMode(); // the pause card ends photo mode
    if (this.firstFrameDone) this.bakeWear(this.paused ? 12 : 2);
    if (this.paused && this.firstFrameDone) {
      this.updateEndOfDay(dt); // a fade to the next day carries on if the pointer lock is let go of
      if (this.redraw || started - (this.pausedDrawAt ?? 0) > 500) {
        this.renderer.render(this.scene, this.camera);
        this.redraw = false;
        this.pausedDrawAt = started;
      }
      input.endFrame();
      return;
    }
    // Photo mode: the world stands still, so none of the game below runs; the camera flies, the held poses show and the shutter goes.
    if (this.photos.modeActive) {
      this.photos.modeFrame(dt, input);
      this.renderer.render(this.scene, this.camera);
      this.photos.afterRender();
      input.endFrame();
      return;
    }
    const fb = this.frameBreakdown;
    fb.begin(started);
    this.updateFarmSave(dt);
    this.updateEndOfDay(dt);

    if (input.wasPressed('KeyH')) this.hud.toggleHelp();
    if (input.wasPressed('Backquote')) this.debugGui.toggle();
    if ((input.wasPressed('Backslash') || input.wasPressed('IntlBackslash')) && !this.console.visible) this.console.open();
    if (input.wasPressed('KeyJ')) this.toggleHitch();
    if (input.wasPressed('KeyM') && !this.workshop.isOpen) {
      this.farmMap.toggle();
      this.achievements.note('map');
    }
    if (input.wasPressed('Tab')) this.toggleBucketList();
    if (this.hud.bucketOpen) {
      if (input.wasPressed('ArrowRight')) this.turnBucketPage(1);
      if (input.wasPressed('ArrowLeft')) this.turnBucketPage(-1);
    }
    if (input.wasPressed('KeyN')) {
      this.audioHub.params.muted = !this.audioHub.params.muted;
      this.hud.toast(this.audioHub.params.muted ? 'Sound off' : 'Sound on', 1.2);
    }

    // 7: raise the camera, 8: photo mode (photos/photoHost.js), unless you are in a menu, up the ladder or hidden in the hay.
    const noPhoto =
      this.menu.isOpen || this.workshop.isOpen || this.bench.isOpen || this.notebook.isOpen || this.sparesShelf.isOpen || this.jobBoardView.isOpen ||
      this.classifiedsView.isOpen || this.moneyTin.isOpen || this.storiesView.isOpen || this.shedView.isOpen || this.photos.view.isOpen || this.climb || this.tryst || this.hiding.active;
    if (input.wasPressed('Digit7') && !noPhoto) this.photos.press();
    if (input.wasPressed('Digit8') && !noPhoto) this.photos.enterMode();

    // 6: wave. Close girls wave back, a free girl further off comes over, a driving one pulls up (npc/playerWave.js).
    if (
      input.wasPressed('Digit6') &&
      !(this.menu.isOpen || this.workshop.isOpen || this.bench.isOpen || this.notebook.isOpen || this.sparesShelf.isOpen || this.jobBoardView.isOpen || this.classifiedsView.isOpen || this.moneyTin.isOpen || this.storiesView.isOpen || this.shedView.isOpen || this.photos.view.isOpen) &&
      !(this.climb || this.tryst || this.hiding.active)
    ) {
      this.waveAtGirls();
    }

    for (const unit of this.units) {
      unit.quad.setRemote(null);
      unit.quad.pushDir = 0;
    }
    let pouring = false;
    this.washing = null;
    if (this.menu.isOpen) {
      this.menu.handleInput(input);
      if (!this.menu.isOpen) this.closeMenu();
    } else if (this.player.isRiding && this.player.seat === 'pillion') {
      // On the back: Enter to talk to her about the ride, E to get off once she has stopped.
      this.interaction.clear();
      if (this.talkPressed(input)) this.openPassengerMenu();
      else if (input.wasPressed('KeyE')) this.getOffBack();
    } else if (this.player.isRiding) {
      this.interaction.clear();
      this.riddenUnit.quad.handleFrameInput(dt);
      if (this.riddenUnit.quad.bike?.takeFall()) this.throwOff(this.riddenUnit);
      else {
        if (input.wasPressed('Space')) this.toggleParkBrake(this.riddenUnit.quad);
        if (input.wasPressed('KeyE')) this.tryDismount();
        // Enter talks to the girl you are looking at, from the seat too, or opens your own wheel (a race and the rest).
        if (this.talkPressed(input)) {
          const her = this.lookedGirl();
          if (her) this.openCompanionMenu(her);
          else this.openYourWheel();
        }
      }
    } else if (this.workshop.isOpen) {
      this.workshop.handleInput(input);
    } else if (this.bench.isOpen) {
      this.interaction.clear();
      this.bench.handleInput(input);
    } else if (this.notebook.isOpen) {
      this.interaction.clear();
      this.notebook.handleInput(input);
    } else if (this.sparesShelf.isOpen) {
      this.interaction.clear();
      this.sparesShelf.handleInput(input);
    } else if (this.jobBoardView.isOpen) {
      this.interaction.clear();
      this.jobBoardView.handleInput(input);
    } else if (this.storiesView.isOpen) {
      this.interaction.clear();
      this.storiesView.handleInput(input);
    } else if (this.moneyTin.isOpen) {
      this.interaction.clear();
      this.moneyTin.handleInput(input);
    } else if (this.shedView.isOpen) {
      this.interaction.clear();
      this.shedView.handleInput(input);
    } else if (this.classifiedsView.isOpen) {
      this.interaction.clear();
      this.classifiedsView.handleInput(input);
    } else if (this.photos.view.isOpen) {
      this.interaction.clear();
      this.photos.view.handleInput(input);
    } else if (this.climb || this.tryst) {
      this.interaction.clear();
      input.takeWheelSteps();
    } else if (this.hiding.active) {
      // Hidden in the hay: any key or E gets you up again.
      this.interaction.clear();
      input.takeWheelSteps();
      if (['KeyE', 'KeyG', 'Escape', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].some((k) => input.wasPressed(k))) this.stopHiding();
    } else {
      input.takeWheelSteps();
      const focused = this.interaction.update(this.player, this.player.params.interactRange);
      // Looking at a quad lets you work its ignition, starter and choke from beside it.
      if (focused?.unit) {
        focused.unit.quad.setRemote(input);
        focused.unit.quad.handleFrameInput(dt);
        if (!this.coolantBottle.held && !this.antiGelBottle.held) this.dipstick(focused.unit, input, dt);
        if (input.wasPressed('KeyU')) this.dipTank(focused.unit);
        this.lastUnit = focused.unit;
      }
      if (focused && !focused.person && input.wasPressed('KeyE')) {
        // Worked out before the act, which changes what you hold: a prompt that only gives a reason (a full can) did nothing, so no sound.
        const cue = normalisePrompt(focused.prompt())?.action ? cueFor(focused) : null;
        focused.interact();
        if (cue) this.audioHub.useCue(cue);
      }
      if (this.talkPressed(input)) {
        if (focused?.person) this.openCompanionMenu(focused.person);
        else this.openYourWheel();
      }
      else if (!focused && input.wasPressed('KeyE') && this.winch) {
        // The winch hook on a tree: E on a trunk hooks it, E on the hooked trunk takes it off.
        const tree = this.winchTreeLooked();
        if (tree && this.winch.state === 'carried') this.winch.hookTree(tree);
        else if (tree && this.winch.anchor === tree) this.winch.unhook(this.camera);
      }
      this.pushOnFoot(input, focused?.unit);
      // Holding E pours fuel or fills the can.
      this.wrongMix = null;
      if (!input.isDown('KeyE')) this.eHeld = 0;
      if (focused?.hold && input.isDown('KeyE') && focused.hold(dt)) pouring = true;
      // The winch hook, tow chain and tow rope are taken with E at where they are kept (setUpKitSpots) and put back with G.
      // Putting something down makes its small sound: whatever G did, if your hands are empty of what they held.
      const putting = input.wasPressed('KeyG') && this.handsFull;
      if (input.wasPressed('KeyG')) {
        if (this.winch?.state === 'carried') this.winch.stow();
        else if (this.chain?.state === 'carried') this.chain.stow();
        else if (this.towRope.state === 'carried') this.towRope.stow();
      }
      if (this.hose.held && input.wasPressed('KeyG')) this.hose.putBack();
      else if (this.can.held && input.wasPressed('KeyG')) this.putCanDown();
      else if (this.toolbox.held && input.wasPressed('KeyG')) this.putToolboxDown();
      else if (this.leads.held && input.wasPressed('KeyG')) this.putLeadsDown();
      else if (this.oilBottle.held && input.wasPressed('KeyG')) this.putOilBottleDown();
      else if (this.coolantBottle.held && input.wasPressed('KeyG')) this.putCoolantBottleDown();
      else if (this.antiGelBottle.held && input.wasPressed('KeyG')) this.putAntiGelBottleDown();
      else if (this.feedBucket.held && input.wasPressed('KeyG')) this.putFeedBucketDown();
      else if (this.heldBrushwood && input.wasPressed('KeyG')) this.putBrushwoodDown();
      else if (this.heldWood && input.wasPressed('KeyG')) this.putWoodDown();
      else if (this.heldBattery() && input.wasPressed('KeyG')) this.putBatteryDown();
      if (putting && !this.handsFull) this.audioHub.useCue('putDown');
    }

    fb.lap('input and prompts', performance.now());
    this.accumulator += dt;
    while (this.accumulator >= FIXED_DT) {
      this.fixedUpdate(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }
    const alpha = this.accumulator / FIXED_DT;
    fb.lap('physics', performance.now());

    this.guard.run('updatePassenger', () => this.updatePassenger());
    this.guard.run('updateRideOffer', () => this.updateRideOffer(dt));
    this.guard.run('updateAskAlong', () => this.updateAskAlong(dt));
    for (const unit of this.units) unit.listenerOnBoard = unit === this.boardUnit;
    for (const unit of this.units) unit.update(dt, alpha);
    fb.lap('vehicles', performance.now());
    const ridden = this.riddenUnit;
    this.talkFloor.left = Math.max(0, this.talkFloor.left - dt);
    this.guard.run('updateFavour', () => this.updateFavour(dt, ridden));
    this.guard.run('updateWearLedger', () => this.updateWearLedger(dt));
    this.guard.run('updateCarbDrip', () => this.updateCarbDrip(dt));
    this.guard.run('updateCoolantLeak', () => this.updateCoolantLeak(dt));
    this.guard.run('updateQuirks', () => this.updateQuirks(dt, ridden));
    this.guard.run('updateOilChecks', () => this.updateOilChecks());
    this.guard.run('updateHandbrake', () => this.updateHandbrake(dt));
    this.guard.run('updateFourWd', () => this.updateFourWd(dt));
    this.skills.update(dt);
    this.guard.run('updatePillionCoach', () => this.updatePillionCoach(dt));
    this.guard.run('updateLessons', () => this.updateLessons(dt, ridden));
    // With the girls' autonomy off (console: girls.autonomy) nothing new starts on their own; what is under way carries on.
    const auto = this.girlsAuto;
    if (auto) {
      this.guard.run('updateRequests', () => this.updateRequests(dt, ridden));
      this.guard.run('updatePlaces', () => this.updatePlaces(dt));
      this.guard.run('updatePranks', () => this.updatePranks(dt, ridden));
      this.guard.run('updateConkers', () => this.updateConkers(dt, ridden));
      this.guard.run('updateRevOff', () => this.updateRevOff(dt, ridden));
    }
    this.guard.run('updateHorns', () => this.updateHorns(dt, ridden));
    if (this.tractorUnit) this.guard.run('updateTractorWatch', () => this.updateTractorWatch(dt));
    this.guard.run('updateRiverWatch', () => this.updateRiverWatch(dt));
    this.guard.run('updateQuarryWatch', () => this.updateQuarryWatch(dt));
    if (this.tractorUnit) this.guard.run('updateTractorRunaway', () => this.updateTractorRunaway(dt, ridden));
    this.guard.run('updateHayRide', () => this.updateHayRide(dt, ridden, input));
    if (this.tractorUnit) this.guard.run('updateMudguard', () => this.updateMudguard(dt, ridden));
    if (this.utvUnit) this.guard.run('updateUtv', () => this.updateUtv(dt, ridden, input));
    for (const l of Object.values(this.landys)) if (l.unit) this.guard.run('updateLandRover', () => this.updateLandRover(dt, ridden, input, l));
    this.guard.run('updateTipTrailer', () => this.updateTipTrailer(dt, ridden, input));
    if (this.spray) this.guard.run('updateSprayer', () => this.updateSprayer(dt, ridden, input));
    if (this.hay) this.guard.run('updateHay', () => this.updateHay(dt));
    if (this.tractorUnit) this.guard.run('updateBaleSpike', () => this.updateBaleSpike(dt, ridden, input));
    if (this.logStack) this.guard.run('updateLogSplitter', () => this.updateLogSplitter(dt));
    if (GO_KINDS.some((k) => this.goVehicle(k)) && auto) this.guard.run('updateTractorGo', () => this.updateTractorGo(dt, ridden));
    this.guard.run('updateRadios', () => this.updateRadios(dt));
    this.guard.run('updateArrival', () => this.updateArrival(dt));
    this.guard.run('updateYourCar', () => this.updateYourCar(dt));
    this.guard.run('updateCars', () => this.updateCars(dt)); // (minding you taking her car is a reaction, so it runs with the girls on hold too)
    this.guard.run('updateLPlates', () => this.updateLPlates(dt));
    this.guard.run('updatePushStart', () => this.updatePushStart());
    this.guard.run('updateDiscoveries', () => this.updateDiscoveries());
    this.guard.run('updateWatching', () => this.updateWatching(dt));
    this.guard.run('updateQuadTalk', () => this.updateQuadTalk(dt, ridden));
    this.guard.run('updateWarming', () => this.updateWarming(dt));
    if (auto || this.sulking.who) this.guard.run('updateCabShelter', () => this.updateCabShelter(dt, !auto));
    if (auto || this.sulking.who) this.guard.run('updateSulking', () => this.updateSulking(dt));
    this.guard.run('updateReady', () => this.updateReady(dt));
    this.guard.run('updateWarmSit', () => this.updateWarmSit(dt, ridden));
    this.guard.run('updatePractising', () => this.updatePractising(dt, ridden));
    this.guard.run('updateDontFix', () => this.updateDontFix(dt));
    if (auto) this.guard.run('updateComparing', () => this.updateComparing(dt));
    this.guard.run('updateStrengthOpinions', () => this.updateStrengthOpinions(dt));
    this.guard.run('updateSeatSlams', () => this.updateSeatSlams());
    if (auto) this.guard.run('updateKeepAlive', () => this.updateKeepAlive(dt));
    if (auto) this.guard.run('updateHeadStart', () => this.updateHeadStart(dt, ridden));
    this.guard.run('updateDoughnuts', () => this.updateDoughnuts(dt));
    this.guard.run('updateTarmac', () => this.updateTarmac(dt));
    this.guard.run('updateJumps', () => this.updateJumps(dt));
    if (auto) this.guard.run('updateNicking', () => this.updateNicking(dt, ridden));
    if (auto || this.tea.forced) this.guard.run('updateTea', () => this.updateTea(dt, ridden));
    this.guard.run('updateLooseMugs', () => this.updateLooseMugs(dt));
    if (auto || this.flask.active) this.guard.run('updateFlask', () => this.updateFlask(dt));
    this.guard.run('updateBonfire', () => this.updateBonfire(dt, ridden));
    this.guard.run('updateHut', () => this.hutHost.update(dt));
    if (auto || this.girlBench.active || this.girlBench.pending) this.guard.run('updateGirlBench', () => this.updateGirlBench(dt));
    if (auto || this.phoneCalls.active) this.guard.run('updatePhoneCall', () => this.updatePhoneCall(dt));
    this.guard.run('updateDares', () => this.updateDares(dt));
    if (auto) this.guard.run('updateJumpers', () => this.updateJumpers(dt));
    this.guard.run('updateCoats', () => this.updateCoats(dt, auto));
    this.guard.run('updateHeadgear', () => this.updateHeadgear(dt, ridden));
    if (auto || this.dieselMistake.forced) this.guard.run('updateDieselMistake', () => this.updateDieselMistake(dt, ridden));
    this.bell.update(dt);
    this.guard.run('updateFlock', () => this.updateFlock(dt));
    this.guard.run('updateWildlife', () => this.updateWildlife(dt));
    this.guard.run('updateCat', () => this.updateCat(dt));
    this.guard.run('updateDog', () => this.updateDog(dt, ridden));
    this.guard.run('updateFarmAnimals', () => this.updateFarmAnimals(dt));
    this.guard.run('updateFence', () => this.updateFence(dt));
    this.trafficHost.update(dt);
    this.guard.run('updateNeighbour', () => this.neighbourHost.update(dt));
    this.guard.run('updateRecall', () => this.updateRecall(dt));
    if (!this.recalling && (auto || this.convoy.active || this.convoy.forced)) this.guard.run('updateConvoy', () => this.updateConvoy(dt, ridden));
    this.guard.run('updateDashReading', () => this.updateDashReading(dt, ridden));
    this.guard.run('updateAsk', () => this.updateAsk(dt, ridden));
    if (!this.recalling && (auto || this.race.active || this.race.forced)) this.guard.run('updateRace', () => this.updateRace(dt, ridden));
    if (!this.recalling && (auto || this.drag.active || this.drag.forced)) this.guard.run('updateDrag', () => this.updateDrag(dt, ridden));
    this.guard.run('updateClimb', () => this.updateClimb(dt, ridden));
    this.guard.run('updatePitClimb', () => this.updatePitClimb(dt, ridden));
    this.guard.run('updateCones', () => this.updateCones(dt, ridden));
    this.guard.run('updateJumpRecords', () => this.updateJumpRecords(dt, ridden));
    this.guard.run('updateChallenges', () => this.updateChallenges(dt, ridden));
    this.helpOnGrid(dt);
    this.guard.run('updateSmokeSense', () => this.updateSmokeSense(dt));
    this.guard.run('updateDustClouds', () => this.updateDustClouds());
    this.guard.run('updateFaultShout', () => this.updateFaultShout(dt));
    this.guard.run('updateHaze', () => this.updateHaze(dt));
    this.guard.run('updateMist', () => this.updateMist(dt));
    this.guard.run('updateBarnFumes', () => this.updateBarnFumes(dt));
    this.guard.run('updateThrottleGrab', () => this.updateThrottleGrab(dt, ridden));
    this.guard.run('updateBackNaps', () => this.updateBackNaps(dt, ridden));
    if (auto) this.guard.run('updateRockPrank', () => this.updateRockPrank(dt));
    this.guard.run('updateDrownOut', () => this.updateDrownOut(dt));
    if (auto || this.fallingOut.active) this.guard.run('updateFallingOut', () => this.updateFallingOut(dt));
    if (auto || this.tryst) this.guard.run('updateRomance', () => this.updateRomance(dt));
    this.guard.run('updateBanter', () => this.updateBanter(dt, ridden));
    fb.lap('farm features', performance.now());
    this.guard.run('updateMinds', () => this.updateMinds(dt, ridden));
    this.guard.run('updateMuddiness', () => this.updateMuddiness(dt));
    this.guard.run('updateMoneyTin', () => this.moneyTin.update(dt));
    this.guard.run('updateVillage', () => this.villageHost.update(dt));
    this.guard.run('updateMarketTalk', () => this.updateMarketTalk(dt));
    this.guard.run('updateShowDay', () => this.updateShowDay(dt));
    this.guard.run('updateBriefing', () => this.updateBriefing(dt));
    this.guard.run('updateShedTalk', () => this.updateShedTalk(dt));
    this.guard.run('updateLens', () => this.updateLens(dt, ridden));
    this.guard.run('updatePair', () => this.updatePair(dt));
    this.watchNotices(dt);
    for (const c of this.companions) {
      c.update(dt, c.quad.unit.vibration, {
        world: this.attentionWorld, // who and what is about, for what she looks at (attention.js)
        position: this.camera.position,
        forward: this.camera.getWorldDirection(this.viewForward),
        isRiding: this.player.isRiding,
        talking: (this.menu.isOpen && this.talkingTo === c) || this.tryst?.girl === c,
      });
      c.sounds.ensure();
      c.voice.update(dt, {
        listener: this.camera.position,
        ridden,
        units: this.girlUnits,
        drivers: this.drivers,
        ledger: this.wearLedger,
        left: this.leftRunning,
        drip: this.carbDrip,
        coolantPatches: this.coolantPatches,
        history: this.history,
        menuOpen: this.menu.isOpen,
        talkingToHer: this.menu.isOpen && this.talkingTo === c,
        weather: this.weather,
        pouring,
        wrongMix: pouring ? this.wrongMix : null,
      });
    }
    fb.lap('girls', performance.now());
    const board = this.boardUnit;
    if (!this.debugCamera) this.player.update(dt, alpha, board ? board.vibration : null);
    this.guard.run('updateRumble', () => this.updateRumble(dt, board));
    this.can.pouring = pouring;
    this.petrolCan.update(dt);
    this.premixCan.update(dt);
    this.dieselCan.update(dt);
    this.guard.run('updateCanWater', () => this.updateCanWater(dt));
    this.guard.run('updateHose', () => this.updateHose(dt));
    this.guard.run('updateWinch', () => this.updateWinch(dt));
    this.guard.run('updateChain', () => this.updateChain());
    this.guard.run('updateTowRope', () => this.updateTowRope());
    this.workshop.update(dt);
    this.bench.update(dt);
    this.guard.run('updateCharger', () => this.updateCharger(dt));
    this.guard.run('updateGenerator', () => this.updateGenerator(dt));
    this.guard.run('updateBarnFind', () => this.updateBarnFind(dt));
    this.guard.run('updateKickBack', () => this.updateKickBack());
    this.notebook.update(dt);
    this.sparesShelf.update(dt);
    this.guard.run('updateLoft', () => this.updateLoft(dt));
    fb.lap('player and items', performance.now());
    this.audioHub.setPouring(pouring, dt);
    this.audioHub.update(dt, this.camera);
    this.rideWind.update(dt, board ? board.quad.speed : 0);
    fb.lap('audio', performance.now());
    this.guard.run('updateWorkLight', () => this.updateWorkLight(dt));
    this.guard.run('updateTrailerGuide', () => this.updateTrailerGuide(dt, this.riddenUnit));
    this.generatorStart.update(dt);
    this.guard.run('updateDaylight', () => this.updateDaylight(dt));
    this.world.update(dt, board ? board.quad.position : this.player.position, this.camera);
    this.guard.run('updateWeather', () => this.updateWeather(dt));
    fb.lap('world, weather and effects', performance.now());
    this.guard.run('updateAchievements', () => this.updateAchievements(dt, ridden));
    this.guard.run('updateDayStory', () => this.updateDayStory());
    this.guard.run('updateHud', () => this.updateHud(dt));
    this.photos.update(dt);
    fb.lap('hud', performance.now());
    this.guard.run('updateMirrors', () => this.updateMirrors());

    this.renderer.render(this.scene, this.camera);
    this.photos.afterRender();
    fb.lap('drawing', performance.now());
    fb.end();
    const frameMs = performance.now() - started;
    this.stutters.frame({
      at: started / 1000, ms: frameMs, stages: fb.latest, features: this.guard.frame, shaders: this.renderer.info.programs?.length ?? 0,
      heapBytes: performance.memory?.usedJSHeapSize,
    });
    this.guard.endFrame();
    input.endFrame();
    this.firstFrameDone = true;
    this.frameStats.record(started / 1000, frameMs);
  }

  /** The flocks (world/flock.js): the hill pasture's, grazing on the gentler ground past the stream, out of the gorse, the wood and the water. */
  setUpFlock() {
    const hill = this.world.fields.hill;
    this.flock = null;
    this.flocks = [];
    if (!hill) return;
    const allowed = (x, z) =>
      hill.inPasture(x, z, 3) && z > hill.farEdge(x) + this.world.layout.hill.foot + 2 && !hill.inWood(x, z, -2) && hill.waterAt(x, z) < 0.05 &&
      hill.gorseAt(x, z) < 0.25 && hill.climbSlope(x, z) < 0.45 && !hill.nearHut(x, z);
    const p = hill.pasture;
    const random = createRandom(this.seed ^ 0x5eed);
    const spot = findFlockSpot(allowed, { minX: p.minX + 8, maxX: p.maxX - 8, minZ: p.minZ + 20, maxZ: p.maxZ - 8 }, random);
    if (!spot) return;
    this.flockParams = { ...DEFAULT_FLOCK_PARAMS };
    registerTuning('Sheep', this.flockParams, FLOCK_PARAM_RANGES);
    this.flock = new Flock({ allowed, random, params: this.flockParams });
    this.flock.place(spot);
    this.flockView = new FlockView(this.scene, this.flock, (x, z) => this.world.groundHeightAt(x, z));
    this.flocks.push({ flock: this.flock, view: this.flockView });
    this.sheepAudio = new SheepAudio(this.audioHub);
    this.setUpFieldFlock(hill, random);
  }

  /** A smaller flock in the sheep field beside the lane, south of its drystone wall (hill.sheepFieldOk). */
  setUpFieldFlock(hill, random) {
    const e = hill.east;
    if (!e || !this.flockParams.fieldCount) return;
    const wallZ = this.world.layout.hill.paddocks.east.wall?.z ?? e.minZ;
    const spot = findFlockSpot(hill.sheepFieldOk, { minX: e.minX + 8, maxX: e.maxX - 6, minZ: wallZ + 6, maxZ: e.maxZ - 6 }, random);
    if (!spot) return;
    const flock = new Flock({ allowed: hill.sheepFieldOk, random, params: this.flockParams, count: this.flockParams.fieldCount });
    flock.place(spot);
    this.flocks.push({ flock, view: new FlockView(this.scene, flock, (x, z) => this.world.groundHeightAt(x, z)) });
  }

  /**
   * Rabbits on the grass field and pheasants lying in the hedge feet (world/wildlife.js). Both go from what comes near: the rabbits
   * bolt for the hedge and freeze in a headlight after dark, the pheasants burst out and the girls hear it (the 'pheasant' notice).
   */
  setUpWildlife() {
    const f = this.world.fields;
    const L = this.world.layout;
    const random = createRandom(this.seed ^ 0xb1ed5);
    this.wildlifeParams = { ...DEFAULT_WILDLIFE_PARAMS };
    registerTuning('Wildlife', this.wildlifeParams, WILDLIFE_PARAM_RANGES);
    const clear = (x, z) =>
      f.tarmacAt(x, z) < 0.05 && f.hedgeDistance(x, z) > 1.2 && !this.world.outbuildings.builtAt(x, z, 2) && !this.world.inBarn(x, z, 3) &&
      Math.hypot(x - L.yard.x, z - L.yard.z) > L.yard.radius;
    const spots = hedgeSpots(f.hedges, f.inGap, (x, z) => ['grass', 'north', 'south'].includes(f.areaOf(x, z)) && clear(x, z));
    const burrows = spots.filter((s) => f.areaOf(s.x, s.z) === 'grass');
    this.rabbits = new Rabbits({ allowed: (x, z) => f.areaOf(x, z) === 'grass' && clear(x, z), burrows, random, params: this.wildlifeParams });
    this.rabbits.place();
    this.pheasants = new Pheasants({ spots, random, params: this.wildlifeParams });
    this.pheasants.place();
    this.wildlifeView = new WildlifeView(this.scene, this.rabbits, this.pheasants, (x, z) => this.world.groundHeightAt(x, z));
    this.wildlifeAudio = new WildlifeAudio(this.audioHub);
  }

  /** What the wildlife shies from: every vehicle (with its headlights' bearing and brightness), you and the girls. */
  wildlifeThreats() {
    const threats = [{ x: this.player.position.x, z: this.player.position.z, speed: 0, yaw: 0, beam: 0 }];
    for (const u of this.units) threats.push({ x: u.quad.position.x, z: u.quad.position.z, speed: u.quad.speed, yaw: u.quad.yaw, beam: u.quad.headlightLevel ?? 0 });
    for (const c of this.companions) threats.push({ x: c.root.position.x, z: c.root.position.z, speed: 0, yaw: 0, beam: 0 });
    return threats;
  }

  updateWildlife(dt) {
    if (!this.rabbits) return;
    const threats = this.wildlifeThreats();
    const at = (e) => ({ x: e.x, y: this.world.groundHeightAt(e.x, e.z) + 0.3, z: e.z });
    for (const e of this.rabbits.update(dt, threats, this.daylight?.darkness ?? 0)) {
      if (e.thump) this.wildlifeAudio.thump(at(e));
    }
    for (const e of this.pheasants.update(dt, threats, threats[0])) {
      this.firePheasantEvent(e);
    }
    this.wildlifeView.update(dt, this.daylight?.darkness ?? 0);
  }

  firePheasantEvent(e) {
    if (e.kind === 'call') return this.wildlifeAudio.call({ x: e.x, y: this.world.groundHeightAt(e.x, e.z) + 0.5, z: e.z });
    const where = { x: e.x, y: this.world.groundHeightAt(e.x, e.z) + 0.5, z: e.z };
    this.wildlifeAudio.burst({ ...where, strength: e.strength });
    this.notice('pheasant', where, { key: 'pheasant', strength: e.strength });
  }

  /**
   * The barn cat (world/cat.js): one cat that prowls the yard, sleeps on a warm engine or in the sun on a seat until you shoo it off, rubs
   * round a girl stood about, goes into the barn when it is wet, frosty or dark, and runs from a revving or fast vehicle.
   */
  setUpCat() {
    const L = this.world.layout;
    const b = L.barn;
    this.catParams = { ...DEFAULT_CAT_PARAMS };
    registerTuning('Cat', this.catParams, CAT_PARAM_RANGES);
    const world = this.world;
    const f = world.fields;
    const inside = (x, z, m = 0.5) => Math.abs(x - b.x) < b.halfX - m && Math.abs(z - b.z) < b.halfZ - m;
    // The barn's wall is shut except at its door on the +x side; the cat comes and goes by the door.
    const inDoor = (x, z) => Math.abs(z - b.z) < b.door.halfWidth - 0.4 && x > b.x + b.halfX - 0.6 && x < b.x + b.halfX + 0.6;
    const allowed = (x, z) => {
      if (inside(x, z) || inDoor(x, z)) return true;
      if (world.inBarn(x, z, 0.4) || world.outbuildings.builtAt(x, z, 0.5)) return false;
      return Math.hypot(x - L.yard.x, z - L.yard.z) < L.yard.radius + 12 && f.hedgeDistance(x, z) > 0.8;
    };
    const home = { x: b.x - 1.5, z: b.z + 2.2, via: { x: b.x + b.halfX + 1.2, z: b.z } };
    const random = createRandom(this.farmSeed ^ 0xca7);
    this.cat = new Cat({ allowed, home, inHome: (x, z) => inside(x, z, 0.1), groundAt: (x, z) => world.groundHeightAt(x, z), random, params: this.catParams });
    // Starts somewhere in the yard, off the barn's wall, as the farm's seed has it.
    for (let i = 0; i < 30; i++) {
      const a = random() * Math.PI * 2;
      const r = 3 + random() * (L.yard.radius - 3);
      const x = L.yard.x + Math.cos(a) * r;
      const z = L.yard.z + Math.sin(a) * r;
      if (allowed(x, z)) {
        this.cat.place(x, z);
        break;
      }
    }
    this.catView = new CatView(this.scene, this.cat, (x, z) => world.groundHeightAt(x, z));
    this.catAudio = new CatAudio(this.audioHub);
    this.catPerchTop = new WeakMap(); // unit -> how high its seat or engine is for the cat to lie on, from its model
    this.catForceShelter = false;
    this.interaction.add({
      target: this.catView.proxy,
      isAvailable: () => !!this.catParams.enabled && !this.cat.panicked && !this.riddenUnit,
      range: () => 3,
      prompt: () => (this.cat.perched ? 'Shoo the cat off' : 'Shoo the cat'),
      feedback: 'own',
      interact: () => this.shooCat(),
    });
  }

  /** Whose seat or engine the cat can lie on and how high: open vehicles only (a cab's roof is no place for a nap). */
  catPerchHeight(unit) {
    let h = this.catPerchTop.get(unit);
    if (h === undefined) {
      const box = new THREE.Box3().setFromObject(unit.quad.model);
      const top = box.max.y - unit.quad.position.y;
      h = top > 1.35 ? 0 : Math.min(1.0, Math.max(0.5, top * 0.62));
      this.catPerchTop.set(unit, h);
    }
    return h;
  }

  /** What the cat might lie on now, and what it keeps clear of: see world/cat.js for the shape of it. */
  catContext() {
    const w = this.weather;
    const idleOf = (u) => u.idleRpm ?? u.engine.params.idleRpmWarm ?? 1000;
    const perches = [];
    const threats = [{ x: this.player.position.x, z: this.player.position.z, speed: 0, loud: 0 }];
    for (const u of this.units) {
      const q = u.quad;
      const running = u.engine.isRunning;
      const idle = idleOf(u);
      const span = Math.max(1, (u.topRpm ?? u.engine.params.maxRpm ?? idle + 4000) - idle);
      const loud = running ? Math.min(1, Math.max(0, (u.engine.rpm - idle) / (0.5 * span))) : 0;
      threats.push({ x: q.position.x, z: q.position.z, speed: Math.abs(q.speed ?? 0), loud });
      const h = this.catPerchHeight(u);
      if (!h) continue;
      const occupied = this.boardUnit === u || this.companions.some((c) => c.quad === u.quad && !c.fsm.is('idle'));
      const sheltered = this.world.inBarn(q.position.x, q.position.z, 0);
      perches.push({
        id: u.id,
        x: q.position.x,
        z: q.position.z,
        y: q.position.y + h,
        warm: perchWarmth({ soak: u.engine.soak, sun: sheltered ? 0 : w.warmth, wet: w.rain, snow: w.snow }),
        taken: running || occupied || Math.abs(q.speed ?? 0) > 0.3,
      });
    }
    const friends = this.companions.map((c) => ({ id: c.character.id, x: c.root.position.x, z: c.root.position.z, free: c.availability().canRemark && c.fsm.is('idle') }));
    const shelter = this.catForceShelter || catShelter({ rain: w.rain, snow: w.snow, temperature: w.temperature, darkness: this.daylight?.darkness ?? 0 }, this.catParams);
    return { threats, perches, friends, shelter };
  }

  updateCat(dt) {
    if (!this.cat) return;
    const on = !!this.catParams.enabled;
    this.catView.root.visible = on;
    if (!on) return;
    for (const e of this.cat.update(dt, this.catContext())) this.fireCatEvent(e);
    this.catView.update(dt);
    this.catAudio.update(dt, this.cat.at(), this.cat.purring);
  }

  /** What the cat did, sounded and told to the girls. */
  fireCatEvent(e) {
    if (e.kind === 'mew') this.catAudio.mew(e);
    else if (e.kind === 'fled' || (e.kind === 'woke' && e.scared)) {
      this.catAudio.mew(e, 'cry');
      this.catSay('catFled');
    } else if (e.kind === 'settled') this.catSay('catPerched');
    else if (e.kind === 'greeted') {
      this.catAudio.mew(e);
      this.catSay('catGreeted', e.id);
    } else if (e.kind === 'fussed') this.catSay('catFussed', e.id);
  }

  /** A girl who is free to remark (the one the cat went to, if `id`; otherwise the nearest to you) says a line about the cat. */
  catSay(key, id = null) {
    this.animalSay(key, id);
  }

  /** The same for any of the farm's animals: `key` is the line set's key (catLines.js, dogLines.js). */
  animalSay(key, id = null) {
    const p = this.player.position;
    const c = id
      ? this.companions.find((o) => o.character.id === id)
      : this.companions.filter((o) => o.availability().canRemark).sort((a, b) => a.root.position.distanceTo(p) - b.root.position.distanceTo(p))[0];
    if (!c || !c.availability().canRemark || c.root.position.distanceTo(p) > 40) return;
    c.voice.say(key);
  }

  /** E at the cat: off the seat or out of your way; it hisses, goes, and keeps off that perch for a while. */
  shooCat() {
    const p = this.player.position;
    const how = this.cat.shoo(p.x, p.z);
    if (!how) return false;
    this.catAudio.hiss(this.cat.at());
    this.catSay('catShooed');
    return true;
  }

  /** The debug panel's and console's cat buttons. */
  debugCat(action, arg) {
    const cat = this.cat;
    const p = this.player.position;
    if (action === 'call') {
      const d = this.camera.getWorldDirection(new THREE.Vector3());
      const n = Math.hypot(d.x, d.z) || 1;
      cat.place(p.x + (d.x / n) * 2.5, p.z + (d.z / n) * 2.5);
    } else if (action === 'shoo') return !!cat.shoo(p.x, p.z);
    else if (action === 'perch') {
      const unit = [...this.units].filter((u) => this.catPerchHeight(u)).sort((a, b) => a.quad.position.distanceTo(p) - b.quad.position.distanceTo(p))[0];
      if (!unit) return false;
      unit.engine.soak = Math.max(unit.engine.soak, 0.7);
      const q = unit.quad.position;
      cat.place(q.x, q.z);
      cat.perchId = unit.id;
      cat.y = q.y + this.catPerchHeight(unit);
      cat.mode = 'sleep';
      cat.t = cat.p.sleepMax;
    } else if (action === 'visit') return cat.visit(arg);
    else if (action === 'shelter') this.catForceShelter = arg ?? !this.catForceShelter;
    return true;
  }

  /**
   * The farm dog, Meg (world/dog.js): she follows you, sits when you stop, hops up on the rear rack of the quad you pull up on, chases the
   * girls' quads and goes after their heels, and jumps out of the way of a vehicle coming at her. Nothing about her is saved.
   */
  setUpDog() {
    const L = this.world.layout;
    const b = L.barn;
    const world = this.world;
    const f = world.fields;
    this.dogParams = { ...DEFAULT_DOG_PARAMS };
    registerTuning('Dog', this.dogParams, DOG_PARAM_RANGES);
    const inside = (x, z, m = 0.5) => Math.abs(x - b.x) < b.halfX - m && Math.abs(z - b.z) < b.halfZ - m;
    const inDoor = (x, z) => Math.abs(z - b.z) < b.door.halfWidth - 0.4 && x > b.x + b.halfX - 0.6 && x < b.x + b.halfX + 0.6;
    // A hedge stops her except through a gap with its gate open.
    const hedged = (x, z) => {
      for (const h of f.hedges) {
        const d = h.alongX ? Math.hypot(Math.max(h.x1 - x, 0, x - h.x2), z - h.z1) : Math.hypot(x - h.x1, Math.max(h.z1 - z, 0, z - h.z2));
        if (d < 0.45 && !h.gaps.some((g) => !g.shut && Math.abs((h.alongX ? x : z) - g.at) < g.half)) return true;
      }
      return false;
    };
    const allowed = (x, z) => {
      if (inside(x, z) || inDoor(x, z)) return true;
      return !world.inBarn(x, z, 0.4) && !world.outbuildings.builtAt(x, z, 0.5) && !hedged(x, z);
    };
    this.dog = new Dog({ allowed, groundAt: (x, z) => world.groundHeightAt(x, z), random: createRandom(this.farmSeed ^ 0xd06), params: this.dogParams });
    this.dogView = new DogView(this.scene, this.dog, (x, z) => world.groundHeightAt(x, z));
    this.dogAudio = new DogAudio(this.audioHub);
    this.snoreAudio = new SnoreAudio(this.audioHub);
    this.dogPlaced = false;
    this.dogGirlPrev = new Map(); // girl id -> where she was last frame, for how fast she is walking
  }

  // The hens and the pig ------------------------------------------------------------

  /** The hens' run, the pig's sty, the feed bin and bucket (world/farmAnimals.js, items/feedBucket.js). The feeding job is on the board on some days. */
  setUpFarmAnimals() {
    const L = this.world.layout.farmAnimals;
    const world = this.world;
    this.animalParams = { ...DEFAULT_ANIMAL_PARAMS };
    this.farmAnimals = new FarmAnimals({ pen: L.pen, sty: L.sty, random: createRandom(this.farmSeed ^ 0x4e45), params: this.animalParams });
    this.farmAnimalsView = new FarmAnimalsView({ scene: this.scene, animals: this.farmAnimals, groundAt: (x, z) => world.groundHeightAt(x, z), physics: this.physics, RAPIER: this.RAPIER });
    this.animalAudio = new AnimalAudio(this.audioHub);
    this.feedBin = new FeedBin({ scene: this.scene, world, position: L.bin, yaw: L.bin.yaw });
    this.feedBucket = new FeedBucket({ scene: this.scene, world, position: L.bucket, yaw: L.bucket.yaw });
    // One proxy over each of the run and the sty, so that looking at the hens or the pig is looking at what to feed.
    const proxyFor = (rect, which) => {
      const w = rect.maxX - rect.minX;
      const d = rect.maxZ - rect.minZ;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.3, d), new THREE.MeshBasicMaterial({ visible: false }));
      m.position.set((rect.minX + rect.maxX) / 2, world.groundHeightAt((rect.minX + rect.maxX) / 2, (rect.minZ + rect.maxZ) / 2) + 0.65, (rect.minZ + rect.maxZ) / 2);
      this.scene.add(m);
      this.interaction.add({
        target: m,
        isAvailable: () => !this.player.isRiding,
        prompt: () => this.feedPrompt(which),
        feedback: 'hold',
        interact: () => {},
        hold: (dt) => this.feedAnimals(which, dt),
      });
    };
    proxyFor(L.pen, 'hens');
    proxyFor(L.sty, 'pig');
    this.interaction.add({
      target: this.feedBin.proxy,
      isAvailable: () => !this.player.isRiding,
      prompt: () => (this.feedBucket.held ? { text: this.feedBucket.full ? 'The feed bucket is full' : 'Hold E to fill the bucket with feed' } : { text: 'The feed bin: bring the bucket to fill it' }),
      feedback: 'hold',
      interact: () => {},
      hold: (dt) => this.feedBucket.held && this.feedBucket.fill(dt),
    });
    this.interaction.add({
      target: this.feedBucket.proxy,
      isAvailable: () => !this.feedBucket.held,
      prompt: () => (this.handsFull ? { text: 'The feed bucket: put what you are holding down first' } : `Pick up the feed bucket (${Math.round(this.feedBucket.feed * 100)}% full)`),
      feedback: 'pickUp',
      interact: () => {
        if (!this.handsFull) this.feedBucket.pickUp(this.camera);
      },
    });
  }

  putFeedBucketDown() {
    const p = this.player.position;
    const yaw = this.player.yaw;
    this.feedBucket.putDown(new THREE.Vector3(p.x - Math.sin(yaw) * 0.7, 0, p.z - Math.cos(yaw) * 0.7), yaw);
  }

  /** What the prompt says at the hens' run or the pig's sty. */
  feedPrompt(which) {
    const a = this.farmAnimals;
    const name = which === 'hens' ? 'hens' : 'pig';
    const state = a.hungry(which) ? `the ${name} ${which === 'hens' ? 'are' : 'is'} hungry` : `the ${name} ${which === 'hens' ? 'look' : 'looks'} content`;
    if (!this.feedBucket.held) return { text: `${which === 'hens' ? 'The hens' : 'The pig'}: ${state}   ·   bring the feed bucket to feed ${which === 'hens' ? 'them' : 'her'}` };
    if (a.hunger[which] <= 0.02) return { text: `${which === 'hens' ? 'The hens have' : 'The pig has'} just been fed` };
    if (this.feedBucket.empty) return { text: 'The bucket is empty: fill it at the feed bin by the barn' };
    const p = this.player.position;
    if (!a.canFeed(which, p.x, p.z)) return { text: `Go right up to the fence to feed the ${name}` };
    return { text: `Hold E to feed the ${name}` };
  }

  /** Holding E at the run or the sty with the bucket: feeds them. Returns whether feed went (the pouring sound). */
  feedAnimals(which, dt) {
    const a = this.farmAnimals;
    const b = this.feedBucket;
    const p = this.player.position;
    if (!b.held || !a.canFeed(which, p.x, p.z)) return false;
    const { used, events } = a.feeding(which, dt, b.feed);
    if (used > 0) b.use(used);
    for (const e of events) {
      if (e.type === 'empty') this.hud.toast('The bucket has run out: fill it at the feed bin', 2.5);
      else if (e.type === 'fed') this.animalsFed(e.which);
    }
    if (used > 0 && !this.feedStartSaid) {
      this.feedStartSaid = true; // once a game: they remark when you begin, not at every scoop
      if (this.jobBoard.has('feed') && !this.jobBoard.finished.has('feed')) this.saySomethingAboutJob('feedStart', false, this.feedBin.model.position);
    }
    return used > 0;
  }

  /** One lot has had enough. Both, with the job on the board, ticks it off. */
  animalsFed(which) {
    const a = this.farmAnimals;
    this.hud.toast(which === 'hens' ? 'The hens swarm the feed' : 'The pig buries her nose in it', 2.5);
    if (this.jobBoard.has('feed') && !this.jobBoard.finished.has('feed') && a.allFed) this.finishFeeding();
  }

  finishFeeding() {
    if (this.jobBoard.complete('feed')) {
      this.hud.toast('Everyone fed. Ticked off the board on the barn door', 3);
      this.jobBoardView.refresh();
      if (this.jobBoard.cleared) this.achievements.note('boardCleared');
    }
    this.saySomethingAboutJob('feedDone', false, this.feedBin.model.position);
  }

  /** The animals' step: what is running near the hens, where you are, and what they did. */
  updateFarmAnimals(dt) {
    const a = this.farmAnimals;
    if (!a) return;
    const boarded = this.boardUnit?.quad;
    const p = boarded ? boarded.position : this.player.position;
    const threats = this.units.map((u) => ({ x: u.quad.position.x, z: u.quad.position.z, running: !!u.engine?.isRunning, speed: Math.abs(u.quad.speed ?? 0) }));
    const pig = a.pig;
    const events = a.update(dt, { threats, you: { x: p.x, z: p.z }, near: Math.hypot(p.x - pig.x, p.z - pig.z) < 60 });
    this.farmAnimalsView.update(dt);
    for (const e of events) {
      if (e.type === 'cluck') this.animalAudio.cluck(e);
      else if (e.type === 'scatter') {
        this.animalAudio.squawk(e);
        this.saySomethingAboutJob('hensScatter', false, new THREE.Vector3(e.x, 0, e.z));
      } else if (e.type === 'squeal') this.animalAudio.squeal(e);
      else if (e.type === 'grunt') this.animalAudio.grunt(e);
    }
  }

  /** The debug panel's and console's animal buttons. */
  debugAnimals(action) {
    const a = this.farmAnimals;
    if (action === 'hungry') a.hunger.hens = a.hunger.pig = 1;
    else if (action === 'fed') {
      a.hunger.hens = a.hunger.pig = 0;
      a.fed.hens = a.fed.pig = true;
      if (this.jobBoard.has('feed')) this.finishFeeding();
    } else if (action === 'bucket') this.feedBucket.setFeed(1);
    else if (action === 'scatter') {
      const h = a.hens[0];
      for (const hen of a.hens) hen.panic = a.p.panicSeconds;
      this.animalAudio.squawk({ x: h.x, z: h.z });
    } else if (action === 'squeal') this.animalAudio.squeal(a.pig);
    else if (action === 'day') {
      a.reset();
      this.feedBucket.setFeed(0);
    } else if (action === 'job') {
      if (!this.jobBoard.has('feed')) this.jobBoard.add('feed', FARM_JOBS.feed);
      this.jobBoardView.refresh();
    } else return false;
    return true;
  }

  /** What the dog needs to know about you, the quad you are on, the other vehicles and the girls on foot: see world/dog.js for the shape. */
  dogContext(dt, ridden) {
    const boarded = this.boardUnit;
    const q = boarded?.quad;
    const p = q ? q.position : this.player.position;
    const owner = q
      ? { x: p.x, z: p.z, speed: Math.abs(q.speed ?? 0), yaw: q.yaw, riding: true }
      : { x: p.x, z: p.z, speed: Math.hypot(this.player.velocity.x, this.player.velocity.z), yaw: this.player.yaw, riding: false };
    let rack = null;
    if (ridden && q.mugAnchor) {
      const at = q.mugAnchor.getWorldPosition(this._dogRackAt ??= new THREE.Vector3());
      rack = { id: ridden.id, x: at.x, y: at.y, z: at.z, yaw: q.yaw, ok: !this.herOnBack(q) && !q.isTipped };
    }
    const vehicles = this.units
      .filter((u) => u !== boarded)
      .map((u) => ({ id: u.id, x: u.quad.position.x, z: u.quad.position.z, speed: Math.abs(u.quad.speed ?? 0), yaw: u.quad.yaw, driver: this.quadUser(u, ridden) }));
    const girls = [];
    for (const c of this.companions) {
      const id = c.character.id;
      const at = c.root.position;
      const prev = this.dogGirlPrev.get(id);
      const speed = prev && dt > 0 ? Math.hypot(at.x - prev.x, at.z - prev.z) / dt : 0;
      this.dogGirlPrev.set(id, { x: at.x, z: at.z });
      if (c.fsm.is('walking')) girls.push({ id, x: at.x, z: at.z, yaw: c.root.rotation.y, speed });
    }
    return { owner, rack, vehicles, girls };
  }

  updateDog(dt, ridden) {
    if (!this.dog) return;
    const on = !!this.dogParams.enabled;
    this.dogView.root.visible = on;
    if (!on) return;
    const ctx = this.dogContext(dt, ridden);
    if (!this.dogPlaced) {
      this.dogPlaced = true;
      if (!this.dog.catchUp(ctx.owner)) this.dog.place(ctx.owner.x + 3, ctx.owner.z + 3);
    }
    this.dogCtx = ctx;
    for (const e of this.dog.update(dt, ctx)) this.fireDogEvent(e);
    this.dogView.update(dt);
    this.dogAudio.update(dt, this.dog.at(), this.dog.panting);
    for (const c of this.companions) this.snoreAudio.update(dt, c.character.id, c.root.position, c.isAsleep || c.nap.asleep, this.places.p.dozeSnoreRange, c.character.id === 'jess' ? 1.15 : 1);
  }

  /** What the dog did, sounded and told to the girls. */
  fireDogEvent(e) {
    if (e.kind === 'bark') {
      this.dogAudio.bark(e, e.excited);
      this.dogView.bark();
    } else if (e.kind === 'yelp') {
      this.dogAudio.yelp(e);
      this.animalSay('dogYelp');
    } else if (e.kind === 'mounted') this.animalSay('dogMounted');
    else if (e.kind === 'chase') this.animalSay('dogChasing', e.girl);
    else if (e.kind === 'nip') this.animalSay('dogBoots', e.id);
  }

  /** The debug panel's and console's dog buttons. */
  debugDog(action, arg) {
    const dog = this.dog;
    const p = this.player.position;
    const ctx = this.dogCtx;
    if (action === 'call') {
      const d = this.camera.getWorldDirection(new THREE.Vector3());
      const n = Math.hypot(d.x, d.z) || 1;
      dog.place(p.x + (d.x / n) * 2.5, p.z + (d.z / n) * 2.5);
    } else if (action === 'ride') {
      if (!ctx?.rack?.ok) return false;
      dog.mount(ctx.rack);
    } else if (action === 'down') {
      if (!dog.riding) return false;
      dog.banned = 0;
      dog.lastRack = ctx?.rack ?? dog.lastRack;
      const events = [];
      dog.getDown(events);
      for (const e of events) this.fireDogEvent(e);
    } else if (action === 'chase') {
      const v = ctx?.vehicles.filter((q) => q.speed > 0.5).sort((a, b) => Math.hypot(a.x - dog.x, a.z - dog.z) - Math.hypot(b.x - dog.x, b.z - dog.z))[0];
      if (!v) return false;
      dog.chaseCool = 0;
      const e = dog.start('chase', v.id, ctx);
      if (e) this.fireDogEvent(e);
      return !!e;
    } else if (action === 'boots') {
      const g = ctx?.girls.find((o) => o.id === arg) ?? ctx?.girls[0];
      if (!g) return false;
      const e = dog.start('nip', g.id, ctx);
      if (e) this.fireDogEvent(e);
      return !!e;
    } else if (action === 'bark') {
      this.fireDogEvent({ kind: 'bark', ...dog.at(), excited: true });
    }
    return true;
  }

  /** The debug panel's and console's flush: the pheasant nearest you bursts out as if you had walked up to it. */
  debugFlushPheasant() {
    const p = this.player.position;
    const e = this.pheasants?.flush(p.x, p.z);
    if (e) this.firePheasantEvent(e);
    return !!e;
  }

  /** The electric fence across the hill pasture (world/electricFence.js): it ticks, and a quad's nose or tail or your feet on the wire get a jolt. */
  setUpFence() {
    const fence = createElectricFence(this.world.layout);
    this.fenceParams = { ...DEFAULT_FENCE_PARAMS };
    registerTuning('Electric fence', this.fenceParams, FENCE_PARAM_RANGES);
    this.fence = new ElectricFence(fence, this.fenceParams);
    this.fenceAudio = new FenceAudio(this.audioHub);
    this.thunderAudio = new ThunderAudio(this.audioHub);
    this.phoneAudio = new PhoneAudio(this.audioHub);
    this.fenceLed = this.scene.getObjectByName('fence led') ?? null;
    this.fenceLedOn = 0;
  }

  /** Where the energiser stands, for the tick's sound. */
  fenceEnergiser() {
    const f = this.fence.fence;
    return { x: f.toX, y: this.world.groundHeightAt(f.toX, f.z) + 1.1, z: f.z };
  }

  /** Who could be touching the wire: every moving quad (its nose, middle and tail) and you on foot. */
  fenceTouchers() {
    const out = [];
    for (const u of this.units) {
      const q = u.quad;
      if (q.speed < 0.2) continue;
      const sx = Math.sin(q.yaw);
      const cz = Math.cos(q.yaw);
      const x = q.position.x;
      const z = q.position.z;
      out.push({ id: u.id, kind: 'vehicle', unit: u, points: [{ x: x + sx, z: z + cz }, { x, z }, { x: x - sx, z: z - cz }] });
    }
    if (!this.player.isRiding) out.push({ id: 'you', kind: 'foot', points: [{ x: this.player.position.x, z: this.player.position.z }] });
    return out;
  }

  updateFence(dt) {
    if (!this.fence?.fence) return;
    const touchers = this.fenceTouchers();
    for (const e of this.fence.update(dt, touchers)) {
      if (e.type === 'tick') {
        this.fenceAudio.tick(this.fenceEnergiser(), this.fenceParams.hearWithin);
        this.fenceLedOn = 0.12;
      } else this.fireFenceZap(e, touchers.find((t) => t.id === e.id)?.unit ?? null);
    }
    this.fenceLedOn = Math.max(0, this.fenceLedOn - dt);
    this.fenceLed?.material.color.setHex(this.fenceLedOn > 0 ? 0xff2a1a : 0x400000);
  }

  /** Something caught the wire: the jolt, the snap, a yelp from whoever is on the quad, a word from a girl who saw, and every girl hears it. */
  fireFenceZap(e, unit) {
    const p = this.fenceParams;
    const where = { x: e.x, y: this.world.groundHeightAt(e.x, e.z) + 0.8, z: e.z };
    this.fenceAudio.zap(where);
    this.notice('zap', where, { key: 'fence', strength: 1 });
    if (unit ? unit === this.boardUnit : e.kind === 'foot') this.dares.zap(); // it got you: Jess's dare
    const hit = [];
    if (unit) {
      unit.vibration.zap(p.zapKick);
      const body = unit.quad.physics.body;
      const v = body.linvel();
      body.setLinvel({ x: v.x * p.zapSlow, y: v.y, z: v.z * p.zapSlow }, true);
      if (unit.quad.rider || (this.player.isRiding && unit.quad.passenger)) this.hud.toast('Ow! That fence is live.', 2);
      for (const c of [this.herAtTheFront(unit.quad), this.herOnBack(unit.quad)]) {
        if (!c) continue;
        hit.push(c);
        c.voice.say('fenceZap', { urgent: true, chance: 1 });
        c.react('flinch', { from: where, strength: 1.2, force: true });
      }
    } else if (e.kind === 'foot') this.hud.toast('Ow! That fence is live.', 2);
    // A girl who is free and nearby (not one of those hit) says something about it.
    const watcher = this.companions.filter((c) => !hit.includes(c) && c.availability().canRemark)
      .sort((a, b) => Math.hypot(a.root.position.x - e.x, a.root.position.z - e.z) - Math.hypot(b.root.position.x - e.x, b.root.position.z - e.z))[0];
    if (watcher && Math.hypot(watcher.root.position.x - e.x, watcher.root.position.z - e.z) < 40) watcher.voice.say('fenceZapSeen', { chance: 0.7 });
  }

  /** The debug panel's and console's zap: you (or the quad you are on) catch the wire where you are, whether or not you are near it. */
  debugZapFence() {
    if (!this.fence?.fence) return false;
    const f = this.fence.fence;
    const pos = this.player.position;
    const unit = this.units.find((u) => u.quad.rider || (this.player.isRiding && u.quad.passenger)) ?? null;
    const e = this.fence.zapNow(unit ? unit.id : 'you', unit ? 'vehicle' : 'foot', pos.x, f.z);
    this.fireFenceZap(e, unit);
    return true;
  }

  /** Moves the flock: it keeps clear of every vehicle that comes close (faster ones from further off), the girls and you. */
  updateFlock(dt) {
    if (!this.flocks?.length) return;
    const threats = this.units.map((u) => ({ x: u.quad.position.x, z: u.quad.position.z, speed: u.quad.speed }));
    threats.push({ x: this.player.position.x, z: this.player.position.z, speed: 0 });
    for (const c of this.companions) threats.push({ x: c.root.position.x, z: c.root.position.z, speed: 0 });
    for (const { flock, view } of this.flocks) {
      for (const b of flock.update(dt, threats)) {
        this.sheepAudio.bleat({ ...b, y: this.world.groundHeightAt(b.x, b.z) + 0.7 });
      }
      view.update();
    }
  }

  fixedUpdate(dt) {
    this.player.fixedUpdate(dt);
    this.winch?.fixedUpdate(dt, this.winchReel);
    this.chain?.fixedUpdate(dt);
    this.towRope?.fixedUpdate(dt);
    if (this.leads.update(dt, this.camera.position) === 'pulledOff') this.hud.toast('The jump leads came off');
    for (const unit of this.units) {
      unit.quad.backRider = !!this.herOnBack(unit.quad);
      unit.fixedUpdate(dt);
    }
    this.physics.step();
    for (const unit of this.units) unit.recordTransform();
  }

  updateHud(dt) {
    const f = this.interaction.focused;
    // A prompt is either an E action (a string) or plain text ({ text }).
    let p = f ? f.prompt() : '';
    if (this.player.isRiding && this.player.seat === 'pillion' && !this.menu.isOpen) {
      const her = this.herOn(this.boardUnit.quad);
      p = { action: 'Get off', keys: [['C', 'Look back']].concat(her ? [['Enter', `Talk to ${her.name}`]] : []) };
    }
    // On the back you're a passenger: no crosshair or prompt, just the view (the help panel says E and C).
    const onBack = this.player.isRiding && this.player.seat === 'pillion' && !this.menu.isOpen;
    this.hud.setCrosshairVisible(!onBack);
    if (onBack) p = '';
    this.hud.setPrompt(p);
    // No readout for the quad: its dash is all you get.
    if (this.chain?.state === 'carried') {
      this.hud.setStatus('Tow chain\nE on a quad to hook it on, G to put it back\nThen drive the tractor off, forwards');
    } else if (this.towRope?.state === 'carried') {
      this.hud.setStatus('Tow rope\nE on a dead quad to hook it on, G to put it back\nThen ride off gently: it stretches and can snatch');
    } else if (this.winch?.state === 'carried') {
      this.hud.setStatus(`Winch hook\n${this.winchTreeLooked() ? 'E to hook the tree: the RB300 will pull itself up to it' : 'E on a tree or a vehicle to hook it on, G to put it back'}`);
    } else if (this.winch?.state === 'hooked' && this.winch.anchor) {
      this.hud.setStatus(`Winch on a tree\n${this.winchTreeLooked() === this.winch.anchor ? 'E to unhook it, ' : ''}hold X by the RB300 or on it to wind in`);
    } else if (this.hose.held) {
      this.hud.setStatus('Hose\nHold E to spray, G to put it back');
    } else if (this.leads.held) {
      this.hud.setStatus('Jump leads\nE on a quad to clamp one end, then another quad for the other\nG to put them down');
    } else if (this.heldBattery()) {
      const b = this.heldBattery();
      this.hud.setStatus(b.unitId === BOOSTER_ID ? `Booster pack  ${Math.round(b.engine.battery * 100)}%\nHold E on a switched-off vehicle to boost its battery, at the bench charger to charge it\nG to put it down` : `${b.name}\nE on its vehicle to fit it, at the bench charger to charge it\nG to put it down`);
    } else if (this.heldWood) {
      this.hud.setStatus(this.heldWood.kind === 'round' ? 'Round\nE at the log splitter on the tractor to put it on the beam\nG to put it down' : `Log\nE at the stack to add it (${this.logStack.count} of ${this.splitterParams.capacity})\nG to put it down`);
    } else if (this.heldBrushwood) {
      this.hud.setStatus(`Brushwood\nE at the ring of stones to put it on the pile (${this.bonfire.piled} of ${this.bonfireParams.heapsNeeded})\nG to put it down`);
    } else if (this.coolantBottle.held) {
      this.hud.setStatus('Coolant bottle\nHold E at a water-cooled engine that is off and cool to top it up; keep holding when it is full to flush a stuck thermostat\nG to put it down');
    } else if (this.antiGelBottle.held) {
      this.hud.setStatus('Diesel anti-gel\nHold E at a diesel (tractor, Yak, Moorland) to treat its tank, so it will not wax in a hard frost; it thaws what has waxed\nG to put it down');
    } else if (this.feedBucket.held) {
      this.hud.setStatus(`Feed bucket (${Math.round(this.feedBucket.feed * 100)}% full)\n${this.feedBucket.empty ? 'Hold E at the feed bin by the barn to fill it' : 'Hold E at the hens\' run or the pig\'s sty to feed them'}\nG to put it down`);
    } else if (this.oilBottle.held) {
      this.hud.setStatus('Oil bottle\nY at a four-stroke to top up its oil, near it\nG to put it down');
    } else if (this.toolbox.held) {
      this.hud.setStatus('Toolbox\nTake it to a quad that is switched off\nG to put it down');
    } else if (this.can.held) {
      this.hud.setStatus(`Jerry can  ${this.can.litres.toFixed(1)} / ${this.can.params.capacity} L, ${fuelText(this.can.oil, this.can.diesel, this.can.water, this.can.additive)}\nG to put it down`);
    } else if (!this.player.isRiding && this.trailer.load && this.player.position.distanceTo(this.trailer.model.position) < 7) {
      const l = this.trailer.load;
      this.hud.setStatus(l.mode === 'aboard' ? `Quad on the bale trailer${l.strapped ? ', strapped' : ''}\nE on it to ${l.strapped ? 'undo the strap' : 'strap it down'}${l.strapped ? '' : ', Shift X to lower it'}` : 'Quad on the ramps\nHold X to wind it up, V to push it');
    } else if (!this.player.isRiding && this.trailer.rampWant && this.player.position.distanceTo(this.trailer.model.position) < 7) {
      this.hud.setStatus('Ramps down\nHold X to winch a switched-off quad on, or push it up with V\nT to fold them up');
    } else if (this.tractorUnit && this.riddenUnit === this.tractorUnit && this.trailer.canHitch(this.tractorUnit.quad)) {
      this.hud.setStatus('The drawbar is at the trailer\'s ring\nJ to hitch it on');
    } else if (this.riddenUnit && this.sprayer.canHitch(this.riddenUnit.quad)) {
      this.hud.setStatus('The hitch is at the sprayer\'s ring\nJ to hitch it on');
    } else if (this.riddenUnit && this.sprayer.puller === this.riddenUnit.quad && this.spray) {
      this.hud.setStatus(this.sprayStatus());
    } else if (this.riddenUnit && this.tipTrailer.canHitch(this.riddenUnit.quad)) {
      this.hud.setStatus('The hitch is at the trailer\'s ring\nJ to hitch it on');
    } else if (this.riddenUnit && this.tipTrailer.puller === this.riddenUnit.quad && this.riddenUnit.quad.speed < 0.8) {
      this.hud.setStatus('Trailer hitched\nT to tip it, J to unhitch');
    } else {
      this.hud.setStatus('');
    }
    // Anything the tractor has to say (the starter in gear, a gear change without the clutch) to whoever's at it.
    for (const u of this.units) {
      const note = u.quad.takeNote();
      if (note && (u === this.riddenUnit || u.quad.position.distanceTo(this.player.position) < 6)) this.hud.toast(note, 2.2);
    }
    this.hud.update(dt);
    if (this.farmMap.isOpen) this.farmMap.draw(this.mapMarkers());
  }

  /** You, the girls, the vehicles, the trailers and the things you carry about, for the farm map. */
  mapMarkers() {
    const v = this.mapVec ??= new THREE.Vector3();
    const d = this.mapDir ??= new THREE.Vector3();
    const at = (obj) => obj.getWorldPosition(v);
    const yawOf = (obj) => (obj.getWorldDirection(d), Math.atan2(d.x, d.z));
    const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
    const markers = [];
    this.camera.getWorldPosition(v);
    this.camera.getWorldDirection(d);
    markers.push({ kind: 'you', x: v.x, z: v.z, yaw: Math.atan2(d.x, d.z), label: 'You' });
    this.companions.forEach((c, i) => {
      const ch = CHARACTERS[i];
      at(c.root);
      markers.push({ kind: 'girl', x: v.x, z: v.z, colour: ch.mapColour, label: c.stranded ? `${ch.name} (needs help)` : ch.name, short: ch.name[0], help: !!c.stranded });
    });
    const big = new Set(['tractor', 'utv', 'landrover', 'landrover200']);
    for (const u of this.units) {
      const q = u.quad;
      const hidden = u.barnFind && !u.barnFind.tarpOff;
      markers.push({
        kind: 'vehicle', x: q.position.x, z: q.position.z, yaw: q.yaw, big: big.has(u.spec.id),
        colour: hidden ? '#8b8270' : hex(u.spec.bodyColor), label: hidden ? 'Under the tarp' : u.spec.name,
      });
    }
    for (const [t, label] of [[this.trailer, 'Bale trailer'], [this.tipTrailer, 'Tipping trailer'], [this.sprayer, 'Sprayer']]) {
      at(t.model);
      markers.push({ kind: 'trailer', x: v.x, z: v.z, yaw: yawOf(t.model), colour: '#9a9a96', label });
    }
    const items = [
      [this.petrolCan, '#b8241c', 'Petrol can'],
      [this.premixCan, hex(PREMIX_CAN_COLOURS.colour), 'Pre-mix can'],
      [this.dieselCan, hex(DIESEL_CAN_COLOURS.colour), 'Diesel can'],
      [this.toolbox, '#c8452c', 'Toolbox'],
      [this.leads, '#222222', 'Jump leads'],
      [this.oilBottle, '#e8e2c8', 'Oil bottle'],
      [this.coolantBottle, '#1f9bd0', 'Coolant bottle'],
      [this.antiGelBottle, '#3a7bd5', 'Diesel anti-gel'],
      [this.feedBucket, '#c9a553', 'Feed bucket'],
      ...this.brushwood.filter((h) => !h.used).map((h) => [h, '#6b4d30', 'Brushwood']),
      ...(this.woodPieces ?? []).filter((w) => w.onGround && w.kind === 'round').map((w) => [w, '#7a5a3a', 'Round']),
      ...[...this.batteries.values()].filter((b) => b.out).map((b) => [b, '#c2231b', b.name]),
    ];
    for (const [item, colour, label] of items) {
      at(item.model);
      markers.push({ kind: 'item', x: v.x, z: v.z, colour, label });
    }
    return markers;
  }

  /** The window changed size, or the render scale did. */
  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(pixelRatioFor(window.devicePixelRatio, this.graphics));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.redraw = true;
    this.updateSmokeScale();
  }

  updateSmokeScale() {
    for (const unit of this.units ?? []) unit.setViewport(window.innerHeight * this.renderer.getPixelRatio(), this.camera.fov);
    this.bonfireView?.setViewport(window.innerHeight * this.renderer.getPixelRatio(), this.camera.fov);
    this.hutHost?.view?.setViewport(window.innerHeight * this.renderer.getPixelRatio(), this.camera.fov);
    this.generatorSmoke?.setViewport(window.innerHeight * this.renderer.getPixelRatio(), this.camera.fov);
  }
}
