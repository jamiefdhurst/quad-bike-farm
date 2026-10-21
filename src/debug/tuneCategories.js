// Where each registered tuning group goes on the debug panel's Tune tab. A group not listed here lands in "Other" at the bottom,
// and tests/tuneCategories.test.js fails until it is listed, so the tab stays ordered. Vehicles' own groups ("Red quad/Engine"...)
// are not here: they live under the Vehicles tab.

export const TUNE_CATEGORIES = {
  'Driving and towing': [
    '2WD and 4WD', 'Throttle key', 'Brake key', 'Gamepad', 'Gamepad rumble', 'Brakes', 'Frozen throttle cable', 'Diesel waxing', 'Bleeding a diesel', 'Handbrake', 'Headlights', 'Vehicle lights', 'Yak lights', 'Spotlamps', 'Snorkel', 'Indicators', 'Seat belts', 'Mud on the lens', 'Two-wheeler lean', 'Three-wheeler rider lean', 'Tyres', 'Quad strengths', 'Tyre squeal', 'Towing', 'Tow chain', 'Tow rope', 'Trailer', 'Tipping trailer', 'Trailer tub', 'Sprayer trailer',
    'Yak bed', 'Yak load', 'Tor load', 'Tor tailgate', 'Crag back door', 'Finch hatch', 'Griffin hatch', 'Bale trailer wear', 'Bale trailer mud', 'Tipping trailer wear', 'Tipping trailer mud', 'Sprayer trailer wear', 'Sprayer trailer mud', 'Yak riders', 'Tor riders', 'Crag riders', 'Crag back seats', 'Finch riders', 'Griffin riders', 'Trailer riders', 'Tractor creep', 'Tractor runaway',
  ],
  'Engines, fuel and faults': ['Quirks', 'Engine oil', 'Dripping carb', 'Carb icing', 'Water in the fuel', 'Barn find', 'Red diesel mistake', 'Two-stroke smoke'],
  'Items and workshop': ['Toolbox', 'Logbook', 'Workshop bench', 'Service', 'Battery charger', 'Generator', 'Spares shelf', 'Girl at the bench', 'Bale spike', 'Log splitter', 'Phone calls', 'Jerry can', 'Pre-mix can', 'Diesel can', 'Oil bottle', 'Feed bucket', 'Things walk off', 'Coolant bottle', 'Anti-gel bottle', 'Plug-saver', 'Hose', 'Jump leads', 'Winch', 'Loading ramps', 'Bell', 'Hayloft', 'Muck job', 'Haymaking', 'Spraying', 'Job board', 'Second-hand market', 'Shed kit', 'Money talk', 'Records', 'Photos', 'Photo mode'],
  'World, weather and sound': ['Time of day', 'Forecast', 'Thunderstorm', 'Wind', 'Surfaces', 'Puddle ice', 'Dust', 'Ground wear', 'Road mud', 'Barn', 'Bonfire', 'Stream', 'Sky', 'Autumn', 'Yard haze', 'Mist', 'Rainbows', 'Fumes in the barn', 'Map', 'Sound', 'Radio', 'Radio: sound', 'Player', 'Sheep', 'Wildlife', 'Farm animals', 'Cat', 'Dog', 'Electric fence', 'Traffic', 'Neighbour', 'Gates', 'Girls and the grid gate', 'Farm that remembers', 'Show day', 'Graphics'],
  'Girls: themselves': ['Outfits'], // each girl's own build and her riding pillion; named from the characters, see GIRL_GROUP
  'Girls: moving about': [
    'Amy walk-round', "Amy won't ride", 'Getting on and off', 'Standing about', 'Waiting about', 'What catches the eye', 'Hearing a quad', 'Warming hands', 'Shelter in a cab', 'Girls carrying things', 'Home and jogging', 'Walking round buildings',
    'Lining them up', 'Places', 'Tea on the rack', 'Flask at the top of the hill', 'Sitting by the bonfire', 'Jumpers', 'Wax jackets', 'Helmets and goggles', 'L plates', 'Quad names', 'Whose quad', 'Caring for her quad', 'The two as a pair', 'Asking you along', 'Learning the quads',
  ],
  'Girls: how they feel about you': [
    'Favour', 'Favours asked', 'Falling out', 'Making up', 'Romance', 'Talking about you', 'Pranks', 'Achievements', 'Who wore it out', 'Skills', 'Watching you', 'Nicking your quad', 'Sulking in the cab',
    'Left running', 'Ready and waiting', 'Waving', 'Shouting a fault', 'Reading the dash', 'Rev-offs', 'Drowning out', 'Horns', 'Head start', 'Sitting while it warms', 'Minding a fix', 'Numb bum', 'Comparing notes', 'Hand on the throttle', 'Asleep on the back', 'Girls coaching each other', 'Driving lessons',
  ],
  'Girls: things they do': [
    'Racing', 'Drag race', 'Drives that go somewhere', 'Taking you to see something', 'Hill climb', 'Cone course', 'Follow the leader', 'Doughnuts', 'Practising the clutch', 'Tarmac', 'Showing off', 'The jump', 'Hay ride', 'Hay ride seat', 'Mudguard ride', 'Muddy girls',
    'Tractor remarks', 'Mini moto nerve', 'Thrown off the moto', 'Tractor go', 'Tractor go drive', 'Tractor go start', 'Tractor go novice',
    'Yak go drive', 'Tor go drive', 'Tor go handle', 'Their cars', 'Girl pushing a start', 'Girl steering a tow', 'Girl calling for help', 'Keeping it alive', 'Lights to work by', 'Guiding a trailer back', 'Starting the generator', 'Loading the hay', 'Dares', 'Radio: the girls',
  ],
};

/** The girls' own groups are registered under their names ("Amy", "Amy pillion"), so they're matched rather than listed. */
const GIRL_GROUP = /^(Amy|Jess)( pillion)?$/;

export const OTHER_CATEGORY = 'Other';

/** The categories in the order they show, with "Other" last. */
export const CATEGORY_ORDER = [...Object.keys(TUNE_CATEGORIES), OTHER_CATEGORY];

const lookup = new Map();
for (const [category, names] of Object.entries(TUNE_CATEGORIES)) for (const name of names) lookup.set(name, category);

export function categoryOf(name) {
  if (GIRL_GROUP.test(name)) return 'Girls: themselves';
  return lookup.get(name) ?? OTHER_CATEGORY;
}

/** Orders groups by category, then by name, so the tab reads the same whatever order the game registered them in. */
export function sortTuneGroups(groups) {
  const rank = (g) => CATEGORY_ORDER.indexOf(categoryOf(g.name));
  return [...groups].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}
