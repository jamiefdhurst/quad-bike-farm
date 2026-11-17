// What the fields are called (#814): about sixty plain British field names, by kind of field, and the dealing of them to a farm's fields. Each farm
// is dealt its own from its seed (so the same farm has the same names every day, and `?seed=N` repeats them), no name twice on one farm, and a
// name only goes to a field it makes sense for: no "Brook Meadow" without water, no "Hill Pasture" on the flat. Pure: no Three.js, no DOM.

import { createRandom } from '../core/random.js';
import { keptFieldNames } from '../farm/farmSave.js';

/**
 * What a field can be said to be, worked out from the plan (layoutNew.js `traitsOf`) or set by hand where only the plan knows:
 * `north`/`south` (up or down the farm), `far`/`near` (from the yard), `long` (twice as long as wide or near it), `high`/`low` (on the landform),
 * `water` (beside the river, the brook or the pond), `pond`, `wood` (touching Hollow Wood), `pit` (touching the gravel pit), `lane` (beside a lane or the drive).
 */
export const FIELD_TRAITS = ['north', 'south', 'far', 'near', 'long', 'high', 'low', 'water', 'pond', 'wood', 'pit', 'lane'];

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
  n('Sheep Field', ['pasture']), n('Lamb Close', ['pasture']), n('Cow Pasture', ['pasture']), n('Calf Croft', ['pasture']), n('Horse Close', ['pasture']),
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

/**
 * Names for `fields` (each `{ name, kind, traits }`, `name` being its key in the layout): { key: name }. Every field gets a name that suits
 * its kind and traits, none is used twice, and the fields with the fewest choices are dealt first so a field that needs water gets it before
 * a field that anything would do for. Throws if a field has no name left (the list is long enough that no plan this size runs out).
 */
export function dealFieldNames(fields, random) {
  const left = new Set(FIELD_NAMES.map((x) => x.name));
  const order = [...fields].sort((a, b) => FIELD_NAMES.filter((x) => fits(x, a)).length - FIELD_NAMES.filter((x) => fits(x, b)).length);
  const dealt = {};
  for (const f of order) {
    const choices = FIELD_NAMES.filter((x) => left.has(x.name) && fits(x, f));
    if (!choices.length) throw new Error(`no field name left for ${f.name} (${f.kind}, ${(f.traits ?? []).join(' ') || 'no traits'})`);
    // A name that wants a trait the field has is a better fit than one that fits any field: take the fussier names first, then any.
    const fussy = choices.filter((x) => x.needs.length);
    const pool = fussy.length && random() < 0.7 ? fussy : choices;
    const pick = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
    dealt[f.name] = pick.name;
    left.delete(pick.name);
  }
  return Object.fromEntries(fields.map((f) => [f.name, dealt[f.name]]));
}

/** What a save kept as the names of `fields`, or null when it can't be used (farm/farmSave.js): the names are dealt again from the seed. */
export const usableFieldNames = keptFieldNames;

/**
 * The layout with this farm's names in its fields' `label`s (what the map writes on each), and `dealtFieldNames` for the save to keep. The farm's
 * own seed deals them; what an earlier save kept comes back as it was, and a save from before names (or a broken one) is dealt them from the
 * seed. A field marked `fixed` keeps the name it has. A layout of today's farm, which has no fields as data, comes back as it is.
 */
export function namedLayout(layout, farmSeed, saved) {
  if (!layout.fields) return layout;
  const dealable = layout.fields.filter((f) => !f.fixed && DEALT_KINDS.includes(f.kind));
  const names = usableFieldNames(saved, dealable) ?? dealFieldNames(dealable, createRandom((farmSeed ^ NAMES_STREAM) >>> 0));
  return { ...layout, fields: layout.fields.map((f) => (f.name in names ? { ...f, label: names[f.name] } : f)), dealtFieldNames: names };
}

/** A field's name for the map and the chalkboard: the dealt name, or its key where the layout has none. */
export const fieldLabel = (layout, key) => layout.fields?.find((f) => f.name === key)?.label ?? key;

/**
 * How a girl says where, for a field: its kind (and the crop on the stubble), not its name. Her lines are recorded into banks ahead of time and
 * a name dealt per farm can't be, so a name is read on the map and the chalkboard and she says "the barley field".
 */
export function fieldPhrase(kind, crop) {
  if (kind === 'arable') return crop ? `the ${crop} field` : 'the field';
  return { hay: 'the hay meadow', ley: 'the ley', pasture: 'the meadow', rough: 'the hill', grass: 'the home field', wood: 'the wood', yard: 'the yard', lane: 'the lane' }[kind] ?? 'the field';
}

/** One line of what each field is called on this farm, for the debug panel and the console: "Top Field (top), Long Piece (longpiece), ...". Empty on today's farm. */
export const describeFieldNames = (layout) => (layout.fields ? `the fields: ${layout.fields.map((f) => `${f.label ?? f.name} (${f.name})`).join(', ')}` : '');
