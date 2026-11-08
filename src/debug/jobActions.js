// The farm's jobs and what you can do to each, shared by the debug panel's Jobs folder (a button each) and the console (`job hay cut`),
// so both call the same game methods. A job is listed only when this farm has it. A label is a plain action: no ": " in it, because
// the panel cuts a button's text there (buttonText.js) and the rest would be left as a tooltip.

/**
 * @typedef {object} JobAction
 * @property {string} verb    what the console calls it
 * @property {string} label   the panel's button text
 * @property {() => (string | void)} run   does it; may return a sentence saying what happened (or why it could not)
 */
/**
 * @typedef {object} Job
 * @property {string} id      what the console calls it
 * @property {string} name    how the panel and `job` name it
 * @property {() => string} describe   its stage, as the panel's row shows it
 * @property {JobAction[]} actions
 */

/** @param {import('../game.js').Game} g @returns {{ jobs: Job[], find: (id: string) => Job | undefined }} */
export function jobActions(g) {
  const a = (verb, label, run) => ({ verb, label, run });
  /** @type {Job[]} */
  const jobs = [];
  const add = (id, name, describe, actions) => jobs.push({ id, name, describe, actions });

  add('muck', 'Muck out', () => `${Math.round(g.muck.load * 100)}% in the tub, ${g.muck.laid} patches laid on the stubble${g.muck.done ? ', done' : ''}`, [
    a('fill', 'Fill the trailer with muck', () => g.farmJobs.debugFillMuck()),
    a('done', 'Muck job done now', () => g.farmJobs.debugFinishMuck()),
    a('reset', 'Empty the tub and clear the ground', () => g.farmJobs.debugResetMuck()),
  ]);

  if (g.hay) {
    const stages = ['cut', 'bale', 'load', 'stack', 'done'].map((stage) => a(stage, `Jump the hay job to the ${stage} stage`, () => g.debugHayStage(stage)));
    add('hay', 'Make hay', () => `${g.hay.describe()}; ${g.hayLoading.describe()}`, [
      ...stages,
      a('regrow', 'Let the cut hay patch grow back', () => g.debugHayRegrow()),
      a('lift-tracks', 'Lift the tracks in the long grass', () => g.debugHayTracksClear()),
      a('empty-stack', 'Empty the hay stack in the Dutch barn', () => g.debugHayEmptyStack()),
    ]);
  }

  if (g.mowGrid) {
    add('mow', 'Mow the lawns', () => g.mowGrid.describe(g.farm.day), [
      a('cut', 'Cut both lawns now', () => g.debugCutLawns()),
      a('regrow', 'Let the lawns grow back', () => g.debugGrowLawns()),
      a('done', 'Mowing job done now', () => g.debugFinishMowing()),
    ]);
  }

  if (g.spray) {
    const spray = (verb, label) => a(verb, label, () => g.debugSpray(verb));
    add('spray', 'Spray the field', () => g.spray.describe(), [
      a('boom-out', 'Fold the sprayer boom out', () => g.debugSpray('out')),
      a('boom-in', 'Fold the sprayer boom in', () => g.debugSpray('in')),
      spray('empty', 'Empty the sprayer tank'),
      spray('fill', 'Fill the sprayer tank'),
      spray('half', 'Spray half the field'),
      spray('done', 'Finish the spraying job now'),
      spray('clear', 'Clear the field to spray it again'),
    ]);
  }

  if (g.harrow) {
    const harrow = (verb, label) => a(verb, label, () => g.debugHarrow(verb));
    add('harrow', 'Harrow the field', () => g.harrow.describe(), [
      harrow('down', 'Lower the harrows\' tines'),
      harrow('up', 'Lift the harrows\' tines'),
      harrow('half', 'Harrow half the field'),
      harrow('done', 'Finish the harrowing job now'),
      harrow('clear', 'Clear the field to harrow it again'),
    ]);
  }

  add('silage', 'Silage to the Dutch barn', () => `${g.jobBoard.finished.has('silage') ? 'done' : g.jobBoard.has('silage') ? 'on the board' : 'not on the board'}; on the spike: ${g.baleRig.held?.id ?? 'nothing'}`, [
    a('done', 'Silage job done now', () => g.farmJobs.debugFinishSilage()),
    a('reset', 'Put the silage bales back', () => g.debugResetBales()),
  ]);

  if (g.logStack) {
    add('logs', 'Split and stack logs', () => `${g.splitterFitted ? 'splitter fitted' : 'splitter not fitted'}, ram ${Math.round(g.splitter.ram * 100)}%, ${g.splitter.loaded ? 'a round on the beam' : 'beam empty'}, ${g.logStack.count} of ${g.splitterParams.capacity} logs stacked`, [
      a('fit', 'Fit the log splitter on the tractor', () => g.fitSplitter(true)),
      a('unfit', 'Put the bale spike back on the tractor', () => g.fitSplitter(false)),
      a('done', 'Finish the log job now', () => g.farmJobs.debugFinishLogs()),
      a('reset', 'Empty the log stack (rounds dealt back)', () => g.debugResetLogs()),
    ]);
  }

  add('bonfire', 'The bonfire', () => `${g.bonfire.state}, ${g.bonfire.piled} of ${g.bonfireParams.heapsNeeded} on the pile, ${Math.round(g.bonfire.intensity * 100)}% blaze${g.bonfire.damp ? ', smoky' : ''}`, [
    a('light', 'Build and light the bonfire', () => g.debugLightFire()),
    a('out', 'Put the bonfire out', () => (g.bonfire.putOut() ? undefined : 'It is not lit')),
    a('reset', 'Clear the bonfire (brushwood restored)', () => g.debugResetFire()),
  ]);

  if (g.hutHost) {
    add('stove', 'The hut stove', () => g.hutHost.describe(), [
      a('light', 'Light the hut stove (kettle boiled)', () => g.hutHost.debugLight()),
      a('out', 'Put the hut stove out', () => g.hutHost.debugPutOut()),
      a('door', 'Open or shut the hut door', () => g.hutHost.debugDoor(!g.hutHost.door.isOpen)),
    ]);
  }

  add('feed', 'Feed the animals', () => `hens ${Math.round(g.farmAnimals.hunger.hens * 100)}% hungry, pig ${Math.round(g.farmAnimals.hunger.pig * 100)}% hungry, bucket ${Math.round(g.feedBucket.feed * 100)}%; ${g.jobBoard.has('feed') ? (g.jobBoard.finished.has('feed') ? 'done' : 'on the board') : 'not today'}`, [
    a('board', 'Put the feeding job on the board', () => g.debugAnimals('job')),
    a('hungry', 'Make the hens and the pig hungry', () => g.debugAnimals('hungry')),
    a('bucket', 'Fill the feed bucket', () => g.debugAnimals('bucket')),
    a('done', 'Feed them both now', () => g.debugAnimals('fed')),
    a('day', 'A fresh day for the animals', () => g.debugAnimals('day')),
  ]);

  if (g.serviceJob) {
    add('service', 'The service at the bench', () => `${g.serviceJob.name}: ${g.serviceJob.kinds.join(', ')} (${g.serviceJob.left.size} left)`, [
      a('done', 'Service job done now', () => g.farmJobs.debugFinishService()),
    ]);
  }

  const mot = g.villageHost?.mot;
  if (mot) {
    add('mot', 'The MOT at Hollis Motors', () => mot.describe(), [
      a('test', 'MOT test the Land Rover in the bay (free)', () => (mot.debugTest() ? undefined : mot.why() ?? 'Park a Land Rover in the MOT bay first')),
      a('forget', 'Forget every MOT test', () => mot.debugForget()),
    ]);
  }

  add('photos', 'Photos', () => (g.photos.modeActive ? `photo mode on${g.photos.hudHidden ? ', HUD hidden' : ''}${g.photos.girlsPosing ? ', girls posing' : ''}` : 'photo mode off'), [
    a('take', 'Take a photo now', () => (g.photos.press() ? undefined : 'The camera is not ready')),
    a('mode', 'Photo mode on or off (8)', () => g.photos.toggleMode()),
    a('clear', 'Take all the photos down', () => g.photos.clear()),
  ]);

  return { jobs, find: (id) => jobs.find((j) => j.id === String(id).toLowerCase()) };
}
