// Where each registered tuning group goes on the debug panel's Tune tab. A group not listed here lands in "Other" at the bottom,
// and tests/tuneCategories.test.js fails until it is listed, so the tab stays ordered. Vehicles' own groups ("Red quad/Engine"...)
// are not here: they live under the Vehicles tab.

export const TUNE_CATEGORIES = {
  'Driving and towing': [
    '2WD and 4WD', 'Throttle key', 'Brake key', 'Gamepad', 'Brakes', 'Frozen throttle cable', 'Handbrake', 'Headlights', 'Vehicle lights', 'UTV lights', 'Indicators', 'Seat belts', 'Two-wheeler lean', 'Three-wheeler rider lean', 'Tyres', 'Tyre squeal', 'Towing', 'Tow chain', 'Trailer', 'Tipping trailer', 'Trailer tub',
    'UTV bed', 'UTV load', 'UTV riders', 'Land Rover riders', '200TDi riders', '200TDi back seats', 'Trailer riders', 'Tractor creep', 'Tractor runaway',
  ],
  'Engines, fuel and faults': ['Quirks', 'Engine oil', 'Dripping carb', 'Water in the fuel', 'Barn find', 'Red diesel mistake', 'Two-stroke smoke'],
  'Items and workshop': ['Toolbox', 'Logbook', 'Workshop bench', 'Jerry can', 'Pre-mix can', 'Diesel can', 'Oil bottle', 'Hose', 'Jump leads', 'Winch', 'Loading ramps', 'Bell', 'Hayloft', 'Muck job', 'Job board', 'Records'],
  'World, weather and sound': ['Time of day', 'Surfaces', 'Dust', 'Ground wear', 'Road mud', 'Barn', 'Sky', 'Yard haze', 'Fumes in the barn', 'Map', 'Sound', 'Player', 'Sheep', 'Farm that remembers', 'Graphics'],
  'Girls: themselves': [], // each girl's own build and her riding pillion; named from the characters, see GIRL_GROUP
  'Girls: moving about': [
    'Amy walk-round', "Amy won't ride", 'Getting on and off', 'Standing about', 'Waiting about', 'What catches the eye', 'Hearing a quad', 'Warming hands', 'Shelter in a cab', 'Girls carrying things', 'Home and jogging', 'Walking round buildings',
    'Lining them up', 'Places', 'Tea on the rack', 'Flask at the top of the hill', 'Jumpers', 'L plates', 'Quad names', 'Whose quad', 'The two as a pair',
  ],
  'Girls: how they feel about you': [
    'Favour', 'Favours asked', 'Falling out', 'Romance', 'Talking about you', 'Pranks', 'Achievements', 'Who wore it out', 'Skills', 'Nicking your quad', 'Sulking in the cab',
    'Left running', 'Ready and waiting', 'Shouting a fault', 'Reading the dash', 'Rev-offs', 'Drowning out', 'Horns', 'Head start', 'Sitting while it warms', 'Minding a fix', 'Numb bum', 'Comparing notes', 'Hand on the throttle', 'Girls coaching each other',
  ],
  'Girls: things they do': [
    'Racing', 'Drag race', 'Drives that go somewhere', 'Hill climb', 'Follow the leader', 'Doughnuts', 'Tarmac', 'Showing off', 'The jump', 'Hay ride', 'Hay ride seat', 'Mudguard ride', 'Muddy girls',
    'Tractor remarks', 'Mini moto nerve', 'Thrown off the moto', 'Tractor go', 'Tractor go drive', 'Tractor go start', 'Tractor go novice',
    'UTV go drive', 'Land Rover go drive', 'Land Rover go handle', 'Girl pushing a start', 'Keeping it alive', 'Lights to work by',
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
