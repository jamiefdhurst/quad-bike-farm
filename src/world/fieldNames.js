// What the fields are called (#814): about sixty plain British field names, by kind of field, and the dealing of them to a farm's fields. Each farm
// is dealt its own from its seed (so the same farm has the same names every day, and `?seed=N` repeats them), no name twice on one farm, and a
// name only goes to a field it makes sense for: no "Brook Meadow" without water, no "Hill Pasture" on the flat. Pure: no Three.js, no DOM.

import { createRandom } from '../core/random.js';
import { keptFieldNames } from '../farm/farmSave.js';

/**
 * What a field can be said to be, worked out from the plan (layoutNew.js `traitsOf`) or set by hand where only the plan knows:
 * `north`/`south` (up or down the farm), `far`/`near` (from the yard), `long` (twice as long as wide or near it), `high`/`low` (on the landform),
 * `water` (beside the river, the brook or the pond), `pond`, `wood` (touching Hollow Wood), `pit` (touching the gravel pit), `lane` (beside a lane or the drive), `sheep` (the sheep field).
 */
export const FIELD_TRAITS = ['north', 'south', 'far', 'near', 'long', 'high', 'low', 'water', 'pond', 'wood', 'pit', 'lane', 'sheep'];

const n = (name, kinds, needs = []) => ({ name, kinds, needs });

/**
 * The names. `kinds` are the kinds of field it suits (fieldPlan.js `FIELD_KINDS`), `needs` the traits a field must have for it. A name with no
 * needs suits any field of its kinds, so every kind has plenty of those to fall back on.
 */
export const FIELD_NAMES = [
  // Arable: the big ones, ploughed and drilled.
  n('Top Field', ['arable'], ['north']), n('Back Field', ['arable'], ['north']), n('Long Piece', ['arable'], ['long']), n('Long Acre', ['arable'], ['long']),
  n('Far Field', ['arable'], ['far']), n('Lane Field', ['arable'], ['lane']), n('Barn Field', ['arable'], ['near']), n('Bottom Field', ['arable'], ['south']),
  n('Windy Piece', ['arable'], ['high']), n('Wood Field', ['arable'], ['wood']), n('Pit Field', ['arable'], ['pit']), n('Low Piece', ['arable'], ['low']),
  n('Broad Close', ['arable']), n('Ten Acre', ['arable']), n('Middle Piece', ['arable']), n('Cross Field', ['arable']), n('Ash Field', ['arable']),
  n('Seven Acres', ['arable']), n('Great Close', ['arable']), n('Oak Piece', ['arable']), n('Stoney Field', ['arable']), n('Nine Acre', ['arable']),
  n('Twelve Acre', ['arable']), n('Brick Field', ['arable']), n('Little Close', ['arable']), n('Mill Piece', ['arable']),
  // Meadow and pasture: grazing, some of it wet.
  n('Brook Meadow', ['pasture'], ['water']), n('Water Meadow', ['pasture', 'ley'], ['water']), n('Pond Close', ['pasture'], ['pond']),
  n('Long Meadow', ['pasture', 'hay'], ['long']), n('Far Meadow', ['pasture'], ['far']), n('Top Meadow', ['pasture'], ['north']),
  n('Low Pasture', ['pasture'], ['low']), n('Paddock Field', ['pasture'], ['near']), n('Wood Meadow', ['pasture'], ['wood']),
  n('Sheep Field', ['pasture'], ['sheep']), n('Lamb Close', ['pasture']), n('Cow Pasture', ['pasture']), n('Calf Croft', ['pasture']), n('Horse Close', ['pasture']),
  n('Little Meadow', ['pasture']), n('Big Meadow', ['pasture', 'hay']), n('Hollow Meadow', ['pasture']), n('Rush Pasture', ['pasture']),
  // Hay: the meadows that are cut.
  n('Hay Meadow', ['hay']), n('Hay Close', ['hay']), n('Mowing Field', ['hay']), n('Barn Meadow', ['hay'], ['near']), n('Dry Meadow', ['hay']),
  // Leys: grass that is ploughed up in its turn.
  n('Low Ley', ['ley'], ['low']), n('Long Ley', ['ley'], ['long']), n('New Ley', ['ley']), n('Clover Ley', ['ley']), n('Great Ley', ['ley']),
  n('River Ley', ['ley'], ['water']),
  // Rough ground on the hill.
  n('Hill Pasture', ['rough'], ['high']), n('High Rough', ['rough'], ['high']), n('Fell Side', ['rough'], ['high']), n('Moor Side', ['rough'], ['high']),
  n('Bracken Bank', ['rough']), n('Gorse Bank', ['rough']), n('Stoney Bank', ['rough']), n('Rough Pasture', ['rough']), n('Heather Bank', ['rough'], ['high']),
];

/** The kinds the dealing names. Wood, yard, lane and Home Ground (`grass`) keep the names the game already knows them by. */
export const DEALT_KINDS = ['arable', 'pasture', 'hay', 'ley', 'rough'];

/** How many names a field of this kind and these traits could be given (the fewest-choice field is dealt first). */
const fits = (name, field) => name.kinds.includes(field.kind) && name.needs.every((t) => (field.traits ?? []).includes(t));

/** Mixed into the farm's seed, so the names are their own stream and move nothing else the seed deals. */
const NAMES_STREAM = 0xf1e1d5;

const firstWord = (name) => name.split(' ')[0];

/**
 * Names for `fields` (each `{ name, kind, traits }`, `name` being its key in the layout): { key: name }. Every field gets a name that suits
 * its kind and traits, none is used twice, no two start with the same word ("Long Piece" and "Long Acre" would be mixed up on a chalkboard), and the
 * fields with the fewest choices are dealt first so a field that needs water gets it before a field that anything would do for. `taken` are names
 * the farm already has (a save's): they are not dealt again and their first words count. Throws if a field has no name left (the list is long
 * enough that no plan this size runs out; a field that only a name with a used first word suits is given it rather than none).
 */
export function dealFieldNames(fields, random, taken = []) {
  const left = new Set(FIELD_NAMES.map((x) => x.name));
  for (const t of taken) left.delete(t);
  const words = new Set(taken.map(firstWord));
  const order = [...fields].sort((a, b) => FIELD_NAMES.filter((x) => fits(x, a)).length - FIELD_NAMES.filter((x) => fits(x, b)).length);
  const dealt = {};
  for (const f of order) {
    const suits = FIELD_NAMES.filter((x) => left.has(x.name) && fits(x, f));
    if (!suits.length) throw new Error(`no field name left for ${f.name} (${f.kind}, ${(f.traits ?? []).join(' ') || 'no traits'})`);
    const apart = suits.filter((x) => !words.has(firstWord(x.name)));
    const choices = apart.length ? apart : suits;
    // A name that wants a trait the field has is a better fit than one that fits any field: take the fussier names first, then any.
    const fussy = choices.filter((x) => x.needs.length);
    const pool = fussy.length && random() < 0.7 ? fussy : choices;
    const pick = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
    dealt[f.name] = pick.name;
    left.delete(pick.name);
    words.add(firstWord(pick.name));
  }
  return Object.fromEntries(fields.map((f) => [f.name, dealt[f.name]]));
}

/** The names a save kept for `fields`, the ones it has a good name for (farm/farmSave.js); the rest are dealt from the seed. */
export const usableFieldNames = keptFieldNames;

/**
 * The layout with this farm's names in its fields' `label`s (what the map writes on each), and `dealtFieldNames` for the save to keep. The farm's
 * own seed deals them; each name an earlier save kept comes back as it was, and the fields it has none for (a save from before names, a broken
 * one, a field added since) are dealt from the seed out of the names left. A field marked `fixed` keeps the name it has. A layout of today's farm, which has no fields as data, comes back as it is.
 */
export function namedLayout(layout, farmSeed, saved) {
  if (!layout.fields) return layout;
  const dealable = layout.fields.filter((f) => !f.fixed && DEALT_KINDS.includes(f.kind));
  const kept = usableFieldNames(saved, dealable);
  const dealt = dealFieldNames(dealable.filter((f) => !(f.name in kept)), createRandom((farmSeed ^ NAMES_STREAM) >>> 0), Object.values(kept));
  const names = Object.fromEntries(dealable.map((f) => [f.name, kept[f.name] ?? dealt[f.name]]));
  return { ...layout, fields: layout.fields.map((f) => (f.name in names ? { ...f, label: names[f.name] } : f)), dealtFieldNames: names };
}

/** A field's name for the map and the chalkboard: the dealt name, or its key where the layout has none. */
export const fieldLabel = (layout, key) => layout.fields?.find((f) => f.name === key)?.label ?? key;

/** What a girl calls the fields that are places of their own (the pit, the sheep field), by key. */
const PLACES = { wood: 'the wood', pit: 'the pit', home: 'the home field', farmstead: 'the yard', drive: 'the drive', sheep: 'the sheep field' };

/**
 * How a girl says where, for a field: the place if it is one of its own (`PLACES`), otherwise its kind (and the crop on the stubble), not its
 * dealt name. Her lines are recorded into banks ahead of time and a name dealt per farm can't be, so a name is read on the map and the chalkboard
 * and she says "the barley field", "the pit".
 */
export function fieldPhrase(key, kind, crop) {
  if (PLACES[key]) return PLACES[key];
  if (kind === 'arable') return crop ? `the ${crop} field` : 'the field';
  return { hay: 'the hay meadow', ley: 'the ley', pasture: 'the meadow', rough: 'the hill', grass: 'the home field', wood: 'the wood', yard: 'the yard', lane: 'the lane' }[kind] ?? 'the field';
}

/** One line of what each field is called on this farm, for the debug panel and the console: "Top Field (top), Long Piece (longpiece), ...". Empty on today's farm. */
export const describeFieldNames = (layout) => (layout.fields ? `the fields: ${layout.fields.map((f) => `${f.label ?? f.name} (${f.name})`).join(', ')}` : '');
